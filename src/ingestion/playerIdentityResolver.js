import { getCollection } from '../db.js'
import { SPORTS } from '../config/sports.js'

const ID_MAP_COLLECTION = 'source_id_map_v2'
const REVIEW_COLLECTION = 'player_name_review'
const ODDS_SOURCE = 'oddsapi'
const ENTITY_TYPE = 'player'

// Suffix tokens to strip from player names (e.g. "Jr", "III")
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])

// How long to suppress re-resolution attempts for unresolved names
const NEGATIVE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Normalize a player name to a compact lowercase string for matching.
 * Follows the same pattern as canonicalizeTeamNameForMatching() in scheduler.js.
 *
 * Examples:
 *   "Jayson Tatum"        → "jaysontatum"
 *   "Al Horford Jr."      → "alhorford"
 *   "D'Angelo Russell"    → "dangelorussell"
 *   "Karl-Anthony Towns"  → "karlanthonytowns"
 *   "P.J. Washington"     → "pjwashington"
 */
export function normalizePlayerNameForMatching(name) {
  const raw = String(name || '')
    .normalize('NFD')             // decompose accented chars: é → e + combining accent
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()

  if (!raw) return ''

  const tokens = raw.split(/\s+/).filter(Boolean)

  // Strip trailing suffix tokens
  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop()
  }

  return tokens.join('')
}

/**
 * Split a name into lowercase alpha-only tokens (used for fuzzy matching).
 * Preserves token boundaries unlike normalizePlayerNameForMatching.
 *
 * "P.J. Washington" → ["pj", "washington"]
 * "LeBron James"    → ["lebron", "james"]
 */
function tokenizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !NAME_SUFFIXES.has(t))
}

/**
 * Upsert a player name resolution result into source_id_map_v2.
 * Stores resolutionStrategy and resolvedAt alongside the standard fields.
 * For null results, also sets retryAfter to suppress re-resolution.
 */
async function upsertPlayerNameMapping(normalizedName, sport, resolvedId, strategy) {
  const col = getCollection(ID_MAP_COLLECTION)
  const key = { source: ODDS_SOURCE, sourceId: normalizedName, entityType: ENTITY_TYPE, sport }
  const now = new Date()

  await col.updateOne(
    key,
    {
      $set: {
        ...key,
        moneylineId: resolvedId ?? null,
        resolutionStrategy: strategy,
        resolvedAt: now,
        ...(resolvedId == null && { retryAfter: new Date(now.getTime() + NEGATIVE_CACHE_TTL_MS) }),
      },
    },
    { upsert: true }
  )
}

/**
 * Write an unresolved player name to the review collection for manual inspection.
 * Upserts on { normalizedName, sport } to avoid duplicates.
 */
async function writeToReviewQueue(playerName, normalizedName, leagueId, sport, eventId) {
  const col = getCollection(REVIEW_COLLECTION)
  const now = new Date()

  await col.updateOne(
    { normalizedName, sport },
    {
      $set: {
        playerName,
        normalizedName,
        leagueId,
        sport,
        eventId,
        retryAfter: new Date(now.getTime() + NEGATIVE_CACHE_TTL_MS),
        updatedAt: now,
      },
      $setOnInsert: { firstSeenAt: now },
    },
    { upsert: true }
  )
}

/**
 * Resolve a player name string from the Odds API to a MoneyLine playerId.
 *
 * Resolution tiers (in order):
 *   1. Cache lookup (source_id_map_v2)
 *   2. Exact normalized name match across league
 *   3. Team-scoped exact match (players on the two teams in the event)
 *   4. Fuzzy: last name + first initial within team roster
 *   5. Fuzzy: unique last name within team roster
 *
 * Returns a playerId string or null.
 */
export async function resolvePlayerIdFromName(playerName, leagueId, eventId) {
  const normalizedName = normalizePlayerNameForMatching(playerName)
  if (!normalizedName) return null

  const sport = SPORTS[leagueId]?.sport
  if (!sport) return null

  // 1. Cache lookup
  const cached = await getCollection(ID_MAP_COLLECTION).findOne({
    source: ODDS_SOURCE,
    sourceId: normalizedName,
    entityType: ENTITY_TYPE,
    sport,
  })

  if (cached) {
    // Positive cache hit
    if (cached.moneylineId) return cached.moneylineId
    // Negative cache — suppress until retryAfter
    if (cached.retryAfter && cached.retryAfter > new Date()) return null
    // Stale negative cache — fall through to re-resolve
  }

  // 2. Exact normalized match across league
  const playersCol = getCollection('players')
  const exactMatches = await playersCol
    .find({ leagueId, normalizedName }, { projection: { _id: 0, playerId: 1, teamId: 1, name: 1 } })
    .toArray()

  if (exactMatches.length === 1) {
    await upsertPlayerNameMapping(normalizedName, sport, exactMatches[0].playerId, 'exact')
    return exactMatches[0].playerId
  }

  // 3. Team-scoped narrowing (need eventId for this and fuzzy steps)
  if (!eventId) {
    await upsertPlayerNameMapping(normalizedName, sport, null, 'unresolved')
    await writeToReviewQueue(playerName, normalizedName, leagueId, sport, null)
    return null
  }

  const event = await getCollection('events').findOne(
    { eventId },
    { projection: { _id: 0, homeTeamId: 1, awayTeamId: 1 } }
  )

  if (!event?.homeTeamId || !event?.awayTeamId) {
    await upsertPlayerNameMapping(normalizedName, sport, null, 'unresolved')
    await writeToReviewQueue(playerName, normalizedName, leagueId, sport, eventId)
    return null
  }

  const teamIds = [event.homeTeamId, event.awayTeamId]

  // Team-scoped exact match
  const teamScopedExact = exactMatches.filter((p) => teamIds.includes(p.teamId))
  if (teamScopedExact.length === 1) {
    await upsertPlayerNameMapping(normalizedName, sport, teamScopedExact[0].playerId, 'team_scoped')
    return teamScopedExact[0].playerId
  }

  // 4 & 5. Fuzzy matching — load full roster for both teams
  const roster = await playersCol
    .find(
      { teamId: { $in: teamIds } },
      { projection: { _id: 0, playerId: 1, name: 1, teamId: 1 } }
    )
    .toArray()

  if (roster.length === 0) {
    await upsertPlayerNameMapping(normalizedName, sport, null, 'unresolved')
    await writeToReviewQueue(playerName, normalizedName, leagueId, sport, eventId)
    return null
  }

  const inputTokens = tokenizeName(playerName)
  if (inputTokens.length === 0) {
    await upsertPlayerNameMapping(normalizedName, sport, null, 'unresolved')
    return null
  }

  const inputLast = inputTokens[inputTokens.length - 1]
  const inputFirstInitial = inputTokens[0]?.[0]

  // 4. Last name + first initial match
  if (inputFirstInitial) {
    const lastInitialMatches = roster.filter((p) => {
      const tokens = tokenizeName(p.name)
      if (tokens.length === 0) return false
      const last = tokens[tokens.length - 1]
      const firstInitial = tokens[0]?.[0]
      return last === inputLast && firstInitial === inputFirstInitial
    })

    if (lastInitialMatches.length === 1) {
      await upsertPlayerNameMapping(normalizedName, sport, lastInitialMatches[0].playerId, 'fuzzy_last_initial')
      return lastInitialMatches[0].playerId
    }
  }

  // 5. Unique last name on roster
  const lastNameMatches = roster.filter((p) => {
    const tokens = tokenizeName(p.name)
    return tokens.length > 0 && tokens[tokens.length - 1] === inputLast
  })

  if (lastNameMatches.length === 1) {
    await upsertPlayerNameMapping(normalizedName, sport, lastNameMatches[0].playerId, 'fuzzy_last_name')
    return lastNameMatches[0].playerId
  }

  // Unresolved — store negative cache and review entry
  await upsertPlayerNameMapping(normalizedName, sport, null, 'unresolved')
  await writeToReviewQueue(playerName, normalizedName, leagueId, sport, eventId)
  return null
}

/**
 * Enrich a player_props document with resolved playerIds.
 * Mutates the document in place and returns it.
 *
 * Adds:
 *   - players[].playerId (string | null)
 *   - playerIds (string[]) — top-level array of resolved IDs, mirrors playerNames
 */
export async function enrichPlayerPropsWithIds(playerPropsDoc) {
  if (!playerPropsDoc?.players?.length) return playerPropsDoc

  const { leagueId, eventId } = playerPropsDoc
  const resolvedIds = []

  for (const entry of playerPropsDoc.players) {
    const playerId = await resolvePlayerIdFromName(entry.playerName, leagueId, eventId)
    entry.playerId = playerId ?? null
    if (playerId) resolvedIds.push(playerId)
  }

  playerPropsDoc.playerIds = resolvedIds
  return playerPropsDoc
}
