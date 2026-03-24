import cron from 'node-cron'
import { getCollection } from '../db.js'
import { SPORTS, getAllLeagueIds, getCurrentSeason, getSeasonStartDate } from '../config/sports.js'
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
  let count = 0
  for (const doc of docs) {
    await col.updateOne(
      { [matchKey]: doc[matchKey] },
      { $set: doc },
      { upsert: true }
    )
    count++
  }
  return count
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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

async function rebuildSeasonDocs(playerSeasonKeys) {
  const col = getCollection('player_stats')
  let seasonCount = 0

  for (const key of playerSeasonKeys) {
    const [playerId, season] = key.split('::')
    const gameDocs = await col
      .find({ playerId, season, statType: 'game' }, { projection: { _id: 0 } })
      .sort({ gameDate: 1, updatedAt: 1 })
      .toArray()

    if (gameDocs.length === 0) continue

    const seasonDoc = buildSeasonDoc(gameDocs[0], gameDocs)
    await col.updateOne(
      { playerId, statType: 'season', season },
      { $set: seasonDoc },
      { upsert: true }
    )
    seasonCount++
  }

  return seasonCount
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

async function jobPlayerStats(config, { backfill = false } = {}) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} player stats job${backfill ? ' (backfill)' : ''}...`)
  let gameCount = 0

  const normalizer = getNormalizer(config.leagueId)
  const playerSeasonKeys = new Set()
  const dates = backfill
    ? buildDateRange(getSeasonStartDate(config.leagueId, getCurrentSeason(config.leagueId)), new Date())
    : getRecentStatsDates()

  for (const date of dates) {
    const raw = await fetchScores(config, formatGoalserveDate(date))
    if (!raw) continue

    const historicalEvents = await normalizer.normalizeScores(raw)
    if (historicalEvents.length > 0) {
      await upsertMany('events', historicalEvents, 'eventId')
    }

    const result = await normalizer.normalizePlayerStatsFromScores?.(raw)
    if (!result?.games?.length) {
      await sleep(100)
      continue
    }

    for (const doc of result.games) {
      await getCollection('players').updateOne(
        { playerId: doc.playerId },
        {
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
        { upsert: true }
      )

      await getCollection('player_stats').updateOne(
        { playerId: doc.playerId, statType: 'game', eventId: doc.eventId },
        { $set: doc },
        { upsert: true }
      )
      gameCount++
      playerSeasonKeys.add(`${doc.playerId}::${doc.season}`)
    }

    await sleep(100)
  }

  const seasonCount = await rebuildSeasonDocs(playerSeasonKeys)
  console.log(`[scheduler] Upserted ${gameCount} ${tag} player game logs and ${seasonCount} season docs`)
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

  // Run initial fetch for all leagues
  console.log('[scheduler] Running initial data fetch...')
  for (const leagueId of leagues) {
    const config = SPORTS[leagueId]
    jobScores(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} scores failed:`, e.message))
    jobStandings(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} standings failed:`, e.message))
    jobPlayerStats(config, { backfill: true }).catch((e) => console.error(`[scheduler] Initial ${leagueId} player stats failed:`, e.message))
  }
}
