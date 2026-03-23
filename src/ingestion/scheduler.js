import cron from 'node-cron'
import { getCollection } from '../db.js'
import { SPORTS, getAllLeagueIds } from '../config/sports.js'
import { fetchScores, fetchStandings, fetchRoster, fetchInjuries, fetchStats } from './fetchers/goalserve.js'
import { fetchOdds } from './fetchers/oddsApi.js'
import { getNormalizer } from './normalizers/index.js'
import { calculateEdges } from './edgeCalculator.js'

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

async function jobPlayerStats(config) {
  const tag = config.leagueId.toUpperCase()
  console.log(`[scheduler] Running ${tag} player stats job...`)
  let gameCount = 0
  let seasonCount = 0

  const normalizer = getNormalizer(config.leagueId)

  for (const abbr of config.teamAbbrs) {
    const raw = await fetchStats(config, abbr)
    if (!raw) continue

    const result = await normalizer.normalizePlayerStats(raw, abbr)
    if (!result) continue

    for (const doc of result.games || []) {
      await getCollection('player_stats').updateOne(
        { playerId: doc.playerId, statType: 'game', eventId: doc.eventId },
        { $set: doc },
        { upsert: true }
      )
      gameCount++
    }

    for (const doc of result.seasons || []) {
      await getCollection('player_stats').updateOne(
        { playerId: doc.playerId, statType: 'season', season: doc.season },
        { $set: doc },
        { upsert: true }
      )
      seasonCount++
    }

    await sleep(200)
  }

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

    // Scores: every 10 min, staggered
    const scoreMins = Array.from({ length: 6 }, (_, i) => (offset + i * 10) % 60).join(',')
    cron.schedule(`${scoreMins} * * * *`, () => jobScores(config))

    // Odds: every 10 min, staggered (offset by 5 from scores)
    const oddsMins = Array.from({ length: 6 }, (_, i) => (offset + 5 + i * 10) % 60).join(',')
    cron.schedule(`${oddsMins} * * * *`, () => jobOdds(config))

    // Standings: every 6 hours
    cron.schedule(`${offset} */6 * * *`, () => jobStandings(config))

    // Injuries: every 6 hours, staggered by 1h
    cron.schedule(`${offset} 1,7,13,19 * * *`, () => jobInjuries(config))

    // Player stats: daily
    cron.schedule(`${offset} 5 * * *`, () => jobPlayerStats(config))

    // Rosters: daily at 6 AM
    cron.schedule(`${offset} 6 * * *`, () => jobRosters(config))

    console.log(`  - ${config.name}: scores/odds every 10m, standings/injuries 6h, player stats daily, rosters daily`)
  })

  // Run initial fetch for all leagues
  console.log('[scheduler] Running initial data fetch...')
  for (const leagueId of leagues) {
    const config = SPORTS[leagueId]
    jobScores(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} scores failed:`, e.message))
    jobStandings(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} standings failed:`, e.message))
    jobPlayerStats(config).catch((e) => console.error(`[scheduler] Initial ${leagueId} player stats failed:`, e.message))
  }
}
