import cron from 'node-cron'
import { getCollection } from '../db.js'
import {
  SPORTS,
  getAllLeagueIds,
  getCurrentSeason,
  getPreviousSeason,
  getSeasonStartDate,
  getSeasonEndDate,
} from '../config/sports.js'
import { fetchScores, fetchStandings, fetchRoster, fetchInjuries } from './fetchers/goalserve.js'
import { fetchOdds } from './fetchers/oddsApi.js'
import { getNormalizer } from './normalizers/index.js'
import { calculateEdges } from './edgeCalculator.js'
import { buildSeasonDoc } from './normalizers/shared.js'

/**
 * Upsert an array of normalized documents into a collection.
 */
async function upsertMany(collectionName, docs, matchKey) {
  const col = getCollection(collectionName)
  if (!Array.isArray(docs) || docs.length === 0) return 0

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { [matchKey]: doc[matchKey] },
      update: { $set: doc },
      upsert: true,
    },
  }))

  if (ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false })
  }

  return ops.length
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const activePlayerStatsJobs = new Map()
let startupPlayerStatsBackfillActive = false
const PLAYER_STATS_BACKFILL_JOB = 'player_stats_backfill'
let criticalPlayerStatsIndexesEnsured = false

function parseBooleanEnv(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(String))]
}

async function ensureCriticalPlayerStatsIndexes() {
  if (criticalPlayerStatsIndexesEnsured) return

  console.log('[scheduler] Ensuring critical player stats indexes...')

  const playerStatsCollection = getCollection('player_stats')
  const existingPlayerStatsIndexes = await playerStatsCollection.indexes()
  const legacyGameIndex = existingPlayerStatsIndexes.find(
    (index) =>
      index.name === 'playerId_1_statType_1_eventId_1' &&
      !index.partialFilterExpression
  )

  if (legacyGameIndex) {
    console.log('[scheduler] Replacing legacy player_stats game uniqueness index...')
    await playerStatsCollection.dropIndex(legacyGameIndex.name)
  }

  await getCollection('events').createIndex({ eventId: 1 }, { unique: true })
  await getCollection('players').createIndex({ playerId: 1 }, { unique: true })
  await playerStatsCollection.createIndex(
    { playerId: 1, statType: 1, eventId: 1 },
    {
      name: 'player_game_unique',
      unique: true,
      partialFilterExpression: { statType: 'game' },
    }
  )
  await playerStatsCollection.createIndex(
    { playerId: 1, statType: 1, season: 1 },
    {
      name: 'player_season_unique',
      unique: true,
      partialFilterExpression: { statType: 'season' },
    }
  )
  await playerStatsCollection.createIndex({ playerId: 1, statType: 1, season: 1, gameDate: -1 })
  await getCollection('source_id_map_v2').createIndex(
    { source: 1, sourceId: 1, entityType: 1, sport: 1 },
    { unique: true }
  )
  await getCollection('source_id_map_v2').createIndex({ moneylineId: 1 })
  await getCollection('ingestion_state').createIndex(
    { jobType: 1, leagueId: 1, season: 1 },
    { unique: true }
  )
  await getCollection('ingestion_state').createIndex({ jobType: 1, status: 1, updatedAt: -1 })

  criticalPlayerStatsIndexesEnsured = true
  console.log('[scheduler] Critical player stats indexes ready')
}

export function selectPendingBackfillSeasons(targetSeasons, completedSeasons, { force = false } = {}) {
  const requested = uniqueStrings(targetSeasons)
  if (force) return requested

  const completed = new Set(uniqueStrings(completedSeasons))
  return requested.filter((season) => !completed.has(season))
}

async function getCompletedPlayerStatsBackfillSeasons(leagueId, seasons) {
  const requested = uniqueStrings(seasons)
  if (requested.length === 0) return []

  const docs = await getCollection('ingestion_state')
    .find(
      {
        jobType: PLAYER_STATS_BACKFILL_JOB,
        leagueId,
        season: { $in: requested },
        status: 'completed',
      },
      { projection: { _id: 0, season: 1 } }
    )
    .toArray()

  return docs.map((doc) => doc.season)
}

async function setPlayerStatsBackfillState(leagueId, seasons, status, payload = {}) {
  const stateCol = getCollection('ingestion_state')
  const seasonList = uniqueStrings(seasons)

  for (const season of seasonList) {
    await stateCol.updateOne(
      { jobType: PLAYER_STATS_BACKFILL_JOB, leagueId, season },
      {
        $set: {
          jobType: PLAYER_STATS_BACKFILL_JOB,
          leagueId,
          season,
          status,
          updatedAt: new Date(),
          ...payload,
        },
      },
      { upsert: true }
    )
  }
}

export async function runTrackedPlayerStatsBackfill(config, {
  seasons = getDefaultPlayerStatsBackfillSeasons(config.leagueId),
  force = false,
  reason = 'manual',
} = {}) {
  const tag = config.leagueId.toUpperCase()
  const requestedSeasons = uniqueStrings(seasons)
  const completedSeasons = force
    ? []
    : await getCompletedPlayerStatsBackfillSeasons(config.leagueId, requestedSeasons)
  const pendingSeasons = selectPendingBackfillSeasons(requestedSeasons, completedSeasons, { force })

  if (pendingSeasons.length === 0) {
    console.log(`[scheduler] ${tag} startup backfill skipped — seasons already completed (${requestedSeasons.join(', ')})`)
    return {
      skipped: true,
      reason: 'already_completed',
      requestedSeasons,
      completedSeasons,
      pendingSeasons,
    }
  }

  console.log(`[scheduler] ${tag} startup backfill pending seasons: ${pendingSeasons.join(', ')}${force ? ' (forced)' : ''}`)
  await setPlayerStatsBackfillState(config.leagueId, pendingSeasons, 'running', {
    reason,
    startedAt: new Date(),
    lastError: null,
  })

  try {
    const result = await jobPlayerStats(config, { backfill: true, seasons: pendingSeasons })
    if (!result?.skipped) {
      await setPlayerStatsBackfillState(config.leagueId, pendingSeasons, 'completed', {
        reason,
        lastError: null,
        completedAt: new Date(),
        summary: {
          gameCount: result?.gameCount || 0,
          seasonCount: result?.seasonCount || 0,
          datesWithMatches: result?.datesWithMatches || 0,
          datesWithStats: result?.datesWithStats || 0,
          dateFailures: result?.dateFailures || 0,
        },
      })
    }

    return {
      ...result,
      requestedSeasons,
      completedSeasons,
      pendingSeasons,
    }
  } catch (err) {
    await setPlayerStatsBackfillState(config.leagueId, pendingSeasons, 'failed', {
      reason,
      completedAt: null,
      lastError: err.message,
    })
    throw err
  }
}

function formatGoalserveDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function buildDateRange(startDate, endDate) {
  const dates = []
  const cursor = startOfUtcDay(startDate)
  const end = startOfUtcDay(endDate)

  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function getRecentStatsDates() {
  const today = startOfUtcDay(new Date())
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return [today, yesterday]
}

export function getDefaultPlayerStatsBackfillSeasons(leagueId) {
  const currentSeason = getCurrentSeason(leagueId)
  const previousSeason = getPreviousSeason(leagueId, currentSeason)
  return [...new Set([previousSeason, currentSeason])]
}

export function buildPlayerStatsBackfillWindows(leagueId, seasons = getDefaultPlayerStatsBackfillSeasons(leagueId)) {
  const today = startOfUtcDay(new Date())

  return seasons
    .map((season) => {
      const startDate = startOfUtcDay(getSeasonStartDate(leagueId, season))
      const seasonEndDate = startOfUtcDay(getSeasonEndDate(leagueId, season))
      const endDate = seasonEndDate < today ? seasonEndDate : today
      return { season, startDate, endDate }
    })
    .filter((window) => window.startDate <= window.endDate)
}

async function rebuildSeasonDocs(playerSeasonKeys, { tag } = {}) {
  const col = getCollection('player_stats')
  let seasonCount = 0
  const keys = Array.from(playerSeasonKeys)

  if (tag) {
    console.log(`[scheduler] ${tag} rebuilding ${keys.length} season doc candidates...`)
  }

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index]
    const [playerId, season] = key.split('::')
    const gameDocs = await col
      .find({ playerId, season, statType: 'game' }, { projection: { _id: 0 } })
      .sort({ gameDate: 1, updatedAt: 1 })
      .toArray()

    if (gameDocs.length === 0) continue

    const seasonDoc = buildSeasonDoc(gameDocs[0], gameDocs)
    await col.updateOne(
      { playerId, statType: 'season', season },
      {
        $set: seasonDoc,
        $unset: {
          eventId: '',
          gameDate: '',
          gameStartTime: '',
          opponent: '',
          homeAway: '',
          result: '',
        },
      },
      { upsert: true }
    )
    seasonCount++

    if (tag && ((index + 1) % 250 === 0 || index === keys.length - 1)) {
      console.log(`[scheduler] ${tag} rebuild progress: ${index + 1}/${keys.length} season keys processed, ${seasonCount} season docs upserted`)
    }
  }

  return seasonCount
}

function buildPlayerUpsertOps(gameDocs) {
  const opsByPlayerId = new Map()

  for (const doc of gameDocs) {
    opsByPlayerId.set(doc.playerId, {
      updateOne: {
        filter: { playerId: doc.playerId },
        update: {
          $set: {
            playerId: doc.playerId,
            teamId: doc.teamId,
            leagueId: doc.leagueId,
            name: doc.playerName,
            position: doc.position || '',
            updatedAt: new Date(),
          },
          $setOnInsert: {
            status: 'active',
          },
        },
        upsert: true,
      },
    })
  }

  return [...opsByPlayerId.values()]
}

function buildPlayerStatUpsertOps(gameDocs) {
  return gameDocs.map((doc) => ({
    updateOne: {
      filter: { playerId: doc.playerId, statType: 'game', eventId: doc.eventId },
      update: { $set: doc },
      upsert: true,
    },
  }))
}

// --- Generic job handlers ---

async function jobScores(config) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} scores job...`)
  const raw = await fetchScores(config)
  if (!raw) return

  const normalizer = getNormalizer(config.leagueId)
  const events = await normalizer.normalizeScores(raw)
  if (events.length === 0) return

  const count = await upsertMany('events', events, 'eventId')
  console.log(`[scheduler] Upserted ${count} ${tag} events`)
}

async function jobStandings(config) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} standings job...`)
  const raw = await fetchStandings(config)
  if (!raw) return

  const normalizer = getNormalizer(config.leagueId)
  const standings = await normalizer.normalizeStandings(raw)
  for (const s of standings) {
    await getCollection('standings').updateOne(
      { leagueId: s.leagueId, season: s.season, conference: s.conference, division: s.division },
      { $set: s },
      { upsert: true }
    )
  }
  console.log(`[scheduler] Upserted ${standings.length} ${tag} standings groups`)
}

async function jobRosters(config) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} rosters job...`)
  let teamCount = 0
  let playerCount = 0

  const normalizer = getNormalizer(config.leagueId)

  for (const abbr of config.teamAbbrs) {
    const raw = await fetchRoster(config, abbr)
    if (!raw) continue

    const result = await normalizer.normalizeRoster(raw, abbr)
    if (!result) continue

    await getCollection('rosters').updateOne(
      { teamId: result.roster.teamId },
      { $set: result.roster },
      { upsert: true }
    )
    await getCollection('teams').updateOne(
      { teamId: result.team.teamId },
      { $set: result.team },
      { upsert: true }
    )
    for (const p of result.players) {
      await getCollection('players').updateOne(
        { playerId: p.playerId },
        { $set: p },
        { upsert: true }
      )
      playerCount++
    }
    teamCount++
    await sleep(200)
  }
  console.log(`[scheduler] Upserted ${teamCount} ${tag} teams, ${playerCount} players`)
}

async function jobInjuries(config) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} injuries job...`)
  let count = 0

  const normalizer = getNormalizer(config.leagueId)

  for (const abbr of config.teamAbbrs) {
    const raw = await fetchInjuries(config, abbr)
    if (!raw) continue

    const result = await normalizer.normalizeInjuries(raw, abbr)
    if (!result) continue

    await getCollection('injuries').updateOne(
      { teamId: result.teamId },
      { $set: result },
      { upsert: true }
    )
    count++
    await sleep(200)
  }
  console.log(`[scheduler] Upserted ${count} ${tag} injury reports`)
}

export async function jobPlayerStats(config, { backfill = false, seasons } = {}) {
  const tag = config.leagueId.toUpperCase()
  const existingRun = activePlayerStatsJobs.get(config.leagueId)
  if (existingRun) {
    const existingKind = existingRun.backfill ? 'backfill' : 'scheduled'
    console.log(`[scheduler] Skipping ${tag} player stats job${backfill ? ' (backfill)' : ''} — ${existingKind} run already in progress`)
    return { skipped: true, reason: 'already_running' }
  }

  if (!backfill && startupPlayerStatsBackfillActive) {
    console.log(`[scheduler] Skipping ${tag} player stats job — startup player-stats backfill still in progress`)
    return { skipped: true, reason: 'startup_backfill_active' }
  }

  activePlayerStatsJobs.set(config.leagueId, { backfill, startedAt: new Date() })
  console.log(`[scheduler] Running ${tag} player stats job${backfill ? ' (backfill)' : ''}...`)
  try {
    await ensureCriticalPlayerStatsIndexes()

    let gameCount = 0
    let datesWithMatches = 0
    let datesWithStats = 0
    let sampledNoStats = false
    let dateFailures = 0

    const normalizer = getNormalizer(config.leagueId)
    const playerSeasonKeys = new Set()
    const backfillWindows = backfill
      ? buildPlayerStatsBackfillWindows(config.leagueId, seasons)
      : []
    const dates = backfill
      ? backfillWindows.flatMap(({ startDate, endDate }) => buildDateRange(startDate, endDate))
      : getRecentStatsDates()

    if (backfill && backfillWindows.length > 0) {
      const summary = backfillWindows
        .map(({ season, startDate, endDate }) => `${season} (${formatGoalserveDate(startDate)} → ${formatGoalserveDate(endDate)})`)
        .join(', ')
      console.log(`[scheduler] ${tag} player stats backfill windows: ${summary}`)
      console.log(`[scheduler] ${tag} player stats backfill will scan ${dates.length} date(s)`)
    }

    for (let index = 0; index < dates.length; index++) {
      const date = dates[index]
      const dateStartedAt = Date.now()
      try {
        if (backfill) {
          console.log(`[scheduler] ${tag} backfill date ${index + 1}/${dates.length} starting: ${formatGoalserveDate(date)}`)
        }

        const raw = await fetchScores(config, formatGoalserveDate(date), {
          retries: 2,
          tolerateMissing: true,
        })
        if (!raw) continue

        const historicalEvents = await normalizer.normalizeScores(raw)
        if (historicalEvents.length > 0) {
          datesWithMatches++
          await upsertMany('events', historicalEvents, 'eventId')
        }

        const result = await normalizer.normalizePlayerStatsFromScores?.(raw)
        if (!result?.games?.length) {
          // Log one sample to help diagnose why stats are missing
          if (backfill && !sampledNoStats && historicalEvents.length > 0) {
            sampledNoStats = true
            const matches = raw?.scores?.category?.match
            const matchArr = matches ? (Array.isArray(matches) ? matches : [matches]) : []
            const sampleMatch = matchArr.find(m => m?.player_stats || m?.goalkeeper_stats) || matchArr[0]
            if (sampleMatch) {
              const hasPlayerStats = !!sampleMatch.player_stats
              const hasGoalkeeperStats = !!sampleMatch.goalkeeper_stats
              const matchKeys = Object.keys(sampleMatch).filter(k => k.toLowerCase().includes('stat') || k.toLowerCase().includes('player') || k.toLowerCase().includes('goal'))
              console.log(`[scheduler] ${tag} sample match on ${formatGoalserveDate(date)}: player_stats=${hasPlayerStats}, goalkeeper_stats=${hasGoalkeeperStats}, stat-related keys=${JSON.stringify(matchKeys)}`)
              if (hasPlayerStats) {
                console.log(`[scheduler] ${tag} player_stats sub-keys: ${JSON.stringify(Object.keys(sampleMatch.player_stats))}`)
              }
            }
          }

          if (backfill && ((index + 1) % 5 === 0 || index === dates.length - 1)) {
            console.log(`[scheduler] ${tag} backfill progress: ${index + 1}/${dates.length} dates scanned, ${datesWithMatches} with matches, ${datesWithStats} with stats, ${gameCount} game logs so far`)
          }

          await sleep(100)
          continue
        }

        datesWithStats++

        const playerOps = buildPlayerUpsertOps(result.games)
        const playerStatOps = buildPlayerStatUpsertOps(result.games)

        if (playerOps.length > 0) {
          await getCollection('players').bulkWrite(playerOps, { ordered: false })
        }

        if (playerStatOps.length > 0) {
          await getCollection('player_stats').bulkWrite(playerStatOps, { ordered: false })
        }

        for (const doc of result.games) {
          gameCount++
          playerSeasonKeys.add(`${doc.playerId}::${doc.season}`)
        }

        if (backfill) {
          const durationMs = Date.now() - dateStartedAt
          console.log(`[scheduler] ${tag} backfill date ${index + 1}/${dates.length} complete in ${(durationMs / 1000).toFixed(1)}s: ${historicalEvents.length} events, ${result.games.length} game logs`)
        }

        if (backfill && ((index + 1) % 5 === 0 || index === dates.length - 1)) {
          console.log(`[scheduler] ${tag} backfill progress: ${index + 1}/${dates.length} dates scanned, ${datesWithMatches} with matches, ${datesWithStats} with stats, ${gameCount} game logs so far`)
        }

        await sleep(100)
      } catch (err) {
        dateFailures++
        console.error(`[scheduler] ${tag} player stats failed on ${formatGoalserveDate(date)}:`, err.message)
      }
    }

    const seasonCount = await rebuildSeasonDocs(playerSeasonKeys, { tag })
    if (backfill) {
      console.log(`[scheduler] ${tag} backfill: ${datesWithMatches} dates with matches, ${datesWithStats} with stats, ${gameCount} game logs, ${seasonCount} season docs, ${dateFailures} date failures`)
    } else {
      console.log(`[scheduler] Upserted ${gameCount} ${tag} player game logs and ${seasonCount} season docs`)
    }

    return {
      skipped: false,
      backfill,
      gameCount,
      seasonCount,
      datesWithMatches,
      datesWithStats,
      dateFailures,
    }
  } finally {
    activePlayerStatsJobs.delete(config.leagueId)
  }
}

async function jobOdds(config) {
  if (!process.env.DATA_SOURCE_B_KEY) {
    console.log('[scheduler] Skipping odds job — DATA_SOURCE_B_KEY not set')
    return
  }

  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} odds job...`)
  const raw = await fetchOdds(config)
  if (!raw) return

  const normalizer = getNormalizer(config.leagueId)
  const odds = normalizer.normalizeOdds(raw)

  for (const o of odds) {
    if (o._sourceHomeTeam && o._sourceAwayTeam) {
      const existingEvent = await getCollection('events').findOne({
        leagueId: config.leagueId,
        homeTeamName: o._sourceHomeTeam,
        awayTeamName: o._sourceAwayTeam,
        startTime: {
          $gte: new Date(o._sourceCommenceTime.getTime() - 86_400_000),
          $lte: new Date(o._sourceCommenceTime.getTime() + 86_400_000),
        },
      })
      if (existingEvent) {
        o.eventId = existingEvent.eventId
      }
    }

    delete o._sourceHomeTeam
    delete o._sourceAwayTeam
    delete o._sourceCommenceTime

    await getCollection('odds').updateOne(
      { eventId: o.eventId },
      { $set: o },
      { upsert: true }
    )
  }
  console.log(`[scheduler] Upserted ${odds.length} ${tag} odds`)

  await calculateEdges(config.leagueId, config.sport)
}

// --- Schedule setup ---

export function startScheduler() {
  console.log('[scheduler] Starting cron jobs...')

  const leagues = getAllLeagueIds()

  leagues.forEach((leagueId, index) => {
    const config = SPORTS[leagueId]
    const offset = index * 2
    const leagueMinuteOffset = index * 15

    // Scores: every 10 min, staggered
    const scoreMins = Array.from({ length: 6 }, (_, i) => (offset + i * 10) % 60).join(',')
    cron.schedule(`${scoreMins} * * * *`, () => jobScores(config))

    // Odds: every 10 min, staggered (offset by 5 from scores)
    const oddsMins = Array.from({ length: 6 }, (_, i) => (offset + 5 + i * 10) % 60).join(',')
    cron.schedule(`${oddsMins} * * * *`, () => jobOdds(config))

    // Standings: every 6 hours, spread out by league across the hour
    cron.schedule(`${leagueMinuteOffset} */6 * * *`, () => jobStandings(config))

    // Injuries: every 6 hours, offset 5 minutes after standings within each league window
    cron.schedule(`${(leagueMinuteOffset + 5) % 60} 1,7,13,19 * * *`, () => jobInjuries(config))

    // Player stats: every 6 hours, 15 minutes apart by league
    cron.schedule(`${leagueMinuteOffset} 2,8,14,20 * * *`, () => jobPlayerStats(config))

    // Rosters: daily at 6 AM, 15 minutes apart by league
    cron.schedule(`${leagueMinuteOffset} 6 * * *`, () => jobRosters(config))

    console.log(`  - ${config.name}: scores/odds every 10m, standings/injuries 6h (15m stagger), player stats every 6h, rosters daily`)
  })

  // Run initial fetch for all leagues.
  // Scores and standings fire in parallel (lightweight, no rate-limit risk).
  // Player stats backfills run sequentially so we don't hammer GoalServe with
  // 4 concurrent streams of hundreds of requests each.
  console.log('[scheduler] Running initial data fetch...')
  for (const leagueId of leagues) {
    const config = SPORTS[leagueId]
    jobScores(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} scores failed:`, e.message))
    jobStandings(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} standings failed:`, e.message))
  }

  const startupBackfillSetting = process.env.PLAYER_STATS_STARTUP_BACKFILL
  const shouldRunStartupBackfill = startupBackfillSetting == null
    ? true
    : parseBooleanEnv(startupBackfillSetting)
  if (!shouldRunStartupBackfill) {
    console.log('[scheduler] Startup player stats backfill disabled (set PLAYER_STATS_STARTUP_BACKFILL=true to enable)')
    return
  }

  const forceStartupBackfill = parseBooleanEnv(process.env.PLAYER_STATS_STARTUP_BACKFILL_FORCE)
  console.log(`[scheduler] Startup player stats backfill enabled${forceStartupBackfill ? ' (force mode)' : ''}`)

  startupPlayerStatsBackfillActive = true

  ;(async () => {
    try {
      let ranAnyBackfill = false
      for (const leagueId of leagues) {
        const config = SPORTS[leagueId]
        try {
          const result = await runTrackedPlayerStatsBackfill(config, {
            seasons: getDefaultPlayerStatsBackfillSeasons(leagueId),
            force: forceStartupBackfill,
            reason: 'startup',
          })
          if (!result?.skipped) ranAnyBackfill = true
        } catch (e) {
          console.error(`[scheduler] Initial ${leagueId} player stats failed:`, e.message)
        }
      }
      console.log(`[scheduler] Initial player stats backfills complete${ranAnyBackfill ? '' : ' (nothing pending)'}`)
    } finally {
      startupPlayerStatsBackfillActive = false
    }
  })()
}
