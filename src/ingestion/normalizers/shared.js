import { getCollection } from '../../db.js'
import { getMoneylineId } from '../idMapper.js'
import { getCurrentSeason, getSeasonForDate } from '../../config/sports.js'
import { lookupBookmaker, bookmakerSortComparator } from '../bookmakerCatalog.js'

/**
 * Shared normalization utilities used across all sports.
 */

/**
 * Parse GoalServe datetime_utc "dd.MM.yyyy HH:mm" to Date.
 */
export function parseDateTime(dtStr) {
  if (!dtStr) return null
  const [datePart, timePart] = dtStr.split(' ')
  const [dd, mm, yyyy] = datePart.split('.')
  if (!timePart) return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
  const [hh, min] = timePart.split(':')
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`)
}

/**
 * Convert a UTC Date to the calendar date in US Eastern Time (America/New_York),
 * returned as midnight UTC of that ET date.
 *
 * Needed because US sports games start in the evening ET, which falls on the next
 * UTC calendar day (e.g. 7:30 PM ET = 00:30 AM UTC). Without this, gameDate would
 * be off by one day for all evening games.
 */
export function toEasternDate(utcDate) {
  if (!utcDate) return null
  const etStr = utcDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return new Date(`${etStr}T00:00:00Z`)
}

export function toArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function parseNumericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed || trimmed === '--') return null

  if (/^[-+]?\d+(\.\d+)?$/.test(trimmed) || /^[-+]?\.\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  if (/^\d+:\d+$/.test(trimmed)) {
    const [mins, secs] = trimmed.split(':').map(Number)
    return mins * 60 + secs
  }

  return null
}

export function normalizeFlatStats(row, { excludeKeys = [], keyMap = {}, valueParsers = {} } = {}) {
  if (!isObject(row)) return null

  const result = {}
  const exclude = new Set(excludeKeys)

  for (const [key, value] of Object.entries(row)) {
    if (exclude.has(key)) continue

    const parser = valueParsers[key] || parseNumericValue
    const normalized = parser(value, row)
    if (normalized == null) continue

    result[keyMap[key] || key] = normalized
  }

  return Object.keys(result).length > 0 ? result : null
}

export function getGameResult(homeScore, awayScore, side) {
  const home = Number(homeScore)
  const away = Number(awayScore)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  if (home === away) return 'T'

  const isHome = side === 'hometeam'
  const won = isHome ? home > away : away > home
  return won ? 'W' : 'L'
}

/**
 * Normalize odds from The Odds API to MoneyLine schema.
 * Parameterized by leagueId and sport.
 */
export function normalizeOdds(oddsApiData, leagueId, sport) {
  if (!Array.isArray(oddsApiData)) return []

  return oddsApiData.map((event) => {
    const bookmakers = (event.bookmakers || []).map((bk) => {
      const catalog = lookupBookmaker(bk.key)
      if (!catalog) {
        console.warn(`[normalizeOdds] Unknown bookmaker key: "${bk.key}" — storing as sourceType:unknown`)
      }
      return {
        bookmakerId: bk.key,
        bookmakerName: bk.title,
        sourceRegion: catalog?.sourceRegion || 'unknown',
        sourceType: catalog?.sourceType || 'unknown',
        lastUpdate: new Date(bk.last_update),
        markets: (bk.markets || []).map((market) => ({
          marketType: normalizeMarketKey(market.key),
          outcomes: (market.outcomes || []).map((o) => ({
            name: o.name,
            price: o.price,
            impliedProbability: americanToImplied(o.price),
            ...(o.point != null && { point: o.point }),
          })),
        })),
      }
    })

    // Deterministic order: sportsbooks first, then exchanges, then alphabetical within each group
    bookmakers.sort(bookmakerSortComparator)

    return {
      eventId: `${leagueId}-odds-${event.id}`,
      leagueId,
      sport,
      fetchedAt: new Date(),
      _sourceHomeTeam: event.home_team,
      _sourceAwayTeam: event.away_team,
      _sourceCommenceTime: new Date(event.commence_time),
      bookmakers,
    }
  })
}

export function normalizeMarketKey(key) {
  const map = { h2h: 'moneyline', spreads: 'spread', totals: 'total' }
  return map[key] || key
}

export function americanToImplied(american) {
  if (american > 0) return Math.round((100 / (american + 100)) * 1000) / 1000
  return Math.round((Math.abs(american) / (Math.abs(american) + 100)) * 1000) / 1000
}

const PLAYER_ID_KEYS = ['player_id', 'id', 'playerid']
const PLAYER_NAME_KEYS = ['player_name', 'name', 'player']
const TEAM_ID_KEYS = ['team_id', 'id']
const TEAM_NAME_KEYS = ['team_name', 'name']
const DATE_KEYS = ['date', 'game_date', 'datetime', 'datetime_utc', 'played_at', 'start_time']
const EVENT_ID_KEYS = ['event_id', 'game_id', 'match_id', 'id']
const OPPONENT_NAME_KEYS = ['opponent', 'opponent_name', 'opp', 'versus', 'vs']
const HOME_AWAY_KEYS = ['home_away', 'location']
const RESULT_KEYS = ['result', 'outcome', 'wl']

const STAT_METADATA_KEYS = new Set([
  ...PLAYER_ID_KEYS,
  ...PLAYER_NAME_KEYS,
  ...TEAM_ID_KEYS,
  ...TEAM_NAME_KEYS,
  ...DATE_KEYS,
  ...EVENT_ID_KEYS,
  ...OPPONENT_NAME_KEYS,
  ...HOME_AWAY_KEYS,
  ...RESULT_KEYS,
  'season',
  'position',
  'number',
  'jersey',
  'status',
  'starter',
  'games',
  'game',
  'matches',
  'match',
  'updatedAt',
  'sourceUpdatedAt',
])

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function readField(obj, keys) {
  if (!isObject(obj)) return null
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== '') return obj[key]
  }
  return null
}

function parseFlexibleDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const goalserveMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (goalserveMatch) {
    const [, dd, mm, yyyy, hh = '00', min = '00'] = goalserveMatch
    return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`)
  }

  const isoDateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}$/)
  if (isoDateOnly) {
    return new Date(`${trimmed}T00:00:00Z`)
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildPlayerName(node) {
  const direct = readField(node, PLAYER_NAME_KEYS)
  if (typeof direct === 'string') return direct

  const first = readField(node, ['firstname', 'first_name'])
  const last = readField(node, ['lastname', 'last_name'])
  if (first || last) return [first, last].filter(Boolean).join(' ')

  return null
}

function isNumericStat(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^[-+]?\d+(\.\d+)?$/.test(trimmed)) return false
  return Number.isFinite(Number(trimmed))
}

function normalizeStatsPayload(node) {
  if (Array.isArray(node)) {
    const items = node
      .map((item) => normalizeStatsPayload(item))
      .filter(Boolean)
    return items.length > 0 ? items : null
  }

  if (!isObject(node)) {
    return isNumericStat(node) ? Number(node) : null
  }

  const result = {}
  for (const [key, value] of Object.entries(node)) {
    if (STAT_METADATA_KEYS.has(key)) continue
    const normalized = normalizeStatsPayload(value)
    if (normalized == null) continue
    if (Array.isArray(normalized) && normalized.length === 0) continue
    if (isObject(normalized) && Object.keys(normalized).length === 0) continue
    result[key] = normalized
  }

  return Object.keys(result).length > 0 ? result : null
}

function hasStatsPayload(payload) {
  if (payload == null) return false
  if (typeof payload === 'number') return true
  if (Array.isArray(payload)) return payload.some((item) => hasStatsPayload(item))
  if (!isObject(payload)) return false
  return Object.values(payload).some((value) => hasStatsPayload(value))
}

function mergeNumericStats(target, source) {
  if (!isObject(source)) return target

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      target[key] = (typeof target[key] === 'number' ? target[key] : 0) + value
      continue
    }

    if (!isObject(value)) continue
    if (!isObject(target[key])) target[key] = {}
    mergeNumericStats(target[key], value)
  }

  return target
}

function findPlayerNodes(node, results = [], seen = new WeakSet()) {
  if (!isObject(node) && !Array.isArray(node)) return results
  if (isObject(node)) {
    if (seen.has(node)) return results
    seen.add(node)
  }

  if (isObject(node)) {
    const playerId = readField(node, PLAYER_ID_KEYS)
    const playerName = buildPlayerName(node)
    const explicitPlayerShape = node.player_id != null
      || node.player_name != null
      || node.firstname != null
      || node.lastname != null
      || node.first_name != null
      || node.last_name != null
      || node.position != null

    if (playerId && playerName && explicitPlayerShape) {
      results.push(node)
    }

    for (const value of Object.values(node)) {
      findPlayerNodes(value, results, seen)
    }
    return results
  }

  for (const item of node) {
    findPlayerNodes(item, results, seen)
  }

  return results
}

function findGameNodes(node, results = [], seen = new WeakSet()) {
  if (!isObject(node) && !Array.isArray(node)) return results
  if (isObject(node)) {
    if (seen.has(node)) return results
    seen.add(node)

    const gameDate = parseFlexibleDate(readField(node, DATE_KEYS))
    const stats = normalizeStatsPayload(node)
    if (gameDate && hasStatsPayload(stats)) {
      results.push(node)
    }

    for (const value of Object.values(node)) {
      findGameNodes(value, results, seen)
    }
    return results
  }

  for (const item of node) {
    findGameNodes(item, results, seen)
  }

  return results
}

async function resolveTeamId({ source, sport, leagueId, teamNode, playerId, fallbackAbbr }) {
  const sourceTeamId = readField(teamNode, TEAM_ID_KEYS)
  const teamName = readField(teamNode, TEAM_NAME_KEYS)

  if (sourceTeamId) {
    return getMoneylineId(source, sourceTeamId, 'team', sport, teamName || fallbackAbbr)
  }

  if (fallbackAbbr) {
    const team = await getCollection('teams').findOne({ leagueId, abbreviation: fallbackAbbr })
    if (team?.teamId) return team.teamId
  }

  if (playerId) {
    const player = await getCollection('players').findOne({ playerId })
    if (player?.teamId) return player.teamId
  }

  return null
}

async function resolveEventId({
  source,
  sport,
  leagueId,
  sourceEventId,
  playerId,
  gameDate,
  teamId,
  opponentName,
  fallbackIndex,
}) {
  if (sourceEventId) {
    return getMoneylineId(source, sourceEventId, 'event', sport)
  }

  if (teamId && gameDate) {
    const start = new Date(gameDate)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)

    const events = await getCollection('events')
      .find(
        {
          leagueId,
          startTime: { $gte: start, $lt: end },
          $or: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        { projection: { _id: 0, eventId: 1, homeTeamName: 1, awayTeamName: 1 } }
      )
      .toArray()

    if (opponentName) {
      const matched = events.find((event) =>
        [event.homeTeamName, event.awayTeamName]
          .filter(Boolean)
          .some((name) => String(name).toLowerCase() === String(opponentName).toLowerCase())
      )
      if (matched?.eventId) return matched.eventId
    }

    if (events.length === 1) return events[0].eventId
  }

  const dateKey = gameDate.toISOString().slice(0, 10)
  return `${leagueId}-stat-${playerId}-${dateKey}-${String(fallbackIndex).padStart(3, '0')}`
}

export function buildSeasonDoc(baseDoc, gameDocs) {
  const stats = {}
  let latestUpdate = baseDoc.updatedAt
  let latestSourceUpdate = baseDoc.sourceUpdatedAt

  for (const doc of gameDocs) {
    mergeNumericStats(stats, doc.stats)
    if (doc.updatedAt > latestUpdate) latestUpdate = doc.updatedAt
    if (doc.sourceUpdatedAt > latestSourceUpdate) latestSourceUpdate = doc.sourceUpdatedAt
  }

  stats.gamesPlayed = gameDocs.length

  return {
    playerId: baseDoc.playerId,
    playerName: baseDoc.playerName,
    teamId: baseDoc.teamId,
    leagueId: baseDoc.leagueId,
    sport: baseDoc.sport,
    season: baseDoc.season,
    statType: 'season',
    stats,
    sourceUpdatedAt: latestSourceUpdate,
    updatedAt: latestUpdate,
  }
}

export async function normalizePlayerStats(raw, {
  source,
  sport,
  leagueId,
  defaultSeason = getCurrentSeason(leagueId),
  fallbackAbbr = null,
} = {}) {
  const teamNode = raw?.team || raw?.stats?.team || raw
  const playerNodes = findPlayerNodes(teamNode)
  const games = []
  const seasons = []

  for (const playerNode of playerNodes) {
    try {
      const sourcePlayerId = readField(playerNode, PLAYER_ID_KEYS)
      const playerName = buildPlayerName(playerNode)
      if (!sourcePlayerId || !playerName) continue

      const playerId = await getMoneylineId(source, sourcePlayerId, 'player', sport, playerName)
      const teamId = await resolveTeamId({
        source,
        sport,
        leagueId,
        teamNode,
        playerId,
        fallbackAbbr,
      })

      const gameNodes = findGameNodes(playerNode)
      const playerGames = []
      const seenGameKeys = new Set()
      let syntheticIndex = 0

      for (const gameNode of gameNodes) {
        const gameDate = parseFlexibleDate(readField(gameNode, DATE_KEYS))
        const stats = normalizeStatsPayload(gameNode)
        if (!gameDate || !hasStatsPayload(stats)) continue

        const season = String(readField(gameNode, ['season']) || getSeasonForDate(leagueId, gameDate))
        if (season !== defaultSeason) continue

        const sourceEventId = readField(gameNode, EVENT_ID_KEYS)
        const opponentName = readField(gameNode, OPPONENT_NAME_KEYS)
        const eventId = await resolveEventId({
          source,
          sport,
          leagueId,
          sourceEventId,
          playerId,
          gameDate,
          teamId,
          opponentName,
          fallbackIndex: syntheticIndex,
        })

        const dedupeKey = `${playerId}:${eventId}:${gameDate.toISOString()}`
        if (seenGameKeys.has(dedupeKey)) continue
        seenGameKeys.add(dedupeKey)
        syntheticIndex++

        playerGames.push({
          playerId,
          playerName,
          teamId,
          leagueId,
          sport,
          season,
          statType: 'game',
          eventId,
          gameStartTime: gameDate,
          gameDate: toEasternDate(gameDate),
          opponent: opponentName || null,
          homeAway: readField(gameNode, HOME_AWAY_KEYS) || null,
          result: readField(gameNode, RESULT_KEYS) || null,
          stats,
          sourceUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
      }

      if (playerGames.length === 0) {
        const seasonStats = normalizeStatsPayload(playerNode)
        if (!hasStatsPayload(seasonStats)) continue

        seasons.push({
          playerId,
          playerName,
          teamId,
          leagueId,
          sport,
          season: String(readField(playerNode, ['season']) || defaultSeason),
          statType: 'season',
          stats: seasonStats,
          sourceUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        continue
      }

      games.push(...playerGames)

      const seasonBuckets = new Map()
      for (const doc of playerGames) {
        const bucketKey = `${doc.playerId}:${doc.season}`
        if (!seasonBuckets.has(bucketKey)) seasonBuckets.set(bucketKey, [])
        seasonBuckets.get(bucketKey).push(doc)
      }

      for (const docs of seasonBuckets.values()) {
        seasons.push(buildSeasonDoc(docs[0], docs))
      }
    } catch (err) {
      console.error(`[player-stats-normalizer] Failed to normalize player stats:`, err.message)
    }
  }

  return { games, seasons }
}
