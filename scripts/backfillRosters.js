/**
 * backfillRosters.js
 *
 * Re-fetches all team rosters from GoalServe and writes full player names +
 * normalizedName to the players collection. Run this to fix any league where
 * roster ingestion was previously broken or where abbreviated names snuck in
 * via boxscore/stats data.
 *
 * After running this script, run backfillPlayerPropsIds.js to re-resolve
 * player props against the now-correct player names.
 *
 * Usage:
 *   node scripts/backfillRosters.js
 *   node scripts/backfillRosters.js --league nhl     (single league)
 *   node scripts/backfillRosters.js --clear-cache    (also wipe source_id_map_v2 player entries so
 *                                                     resolution re-runs from scratch)
 *   node scripts/backfillRosters.js --league nhl --clear-cache
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'
import { fetchRoster } from '../src/ingestion/fetchers/goalserve.js'
import { normalizePlayerNameForMatching } from '../src/ingestion/playerIdentityResolver.js'
import { SPORTS } from '../src/config/sports.js'

const args = process.argv.slice(2)
const leagueArg = args[args.indexOf('--league') + 1] || null
const clearCache = args.includes('--clear-cache')

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'

function col(text, color) { return `${color}${text}${RESET}` }

const LEAGUE_IDS = ['nfl', 'mlb', 'nba', 'nhl']

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function processLeague(leagueId) {
  const config = SPORTS[leagueId]
  if (!config?.teamAbbrs) {
    console.log(`  ${col('SKIP', YELLOW)} — no teamAbbrs config`)
    return { teamCount: 0, playerCount: 0, errorCount: 0 }
  }

  const getNormalizer = (await import('../src/ingestion/normalizers/index.js')).getNormalizer
  const normalizer = getNormalizer(leagueId)

  if (!normalizer?.normalizeRoster) {
    console.log(`  ${col('SKIP', YELLOW)} — no normalizeRoster for ${leagueId}`)
    return { teamCount: 0, playerCount: 0, errorCount: 0 }
  }

  let teamCount = 0
  let playerCount = 0
  let errorCount = 0

  for (const abbr of config.teamAbbrs) {
    try {
      const raw = await fetchRoster(config, abbr)
      if (!raw) {
        console.log(`  ${col('WARN', YELLOW)} ${abbr} — no data returned`)
        errorCount++
        continue
      }

      const result = await normalizer.normalizeRoster(raw, abbr)
      if (!result) {
        console.log(`  ${col('WARN', YELLOW)} ${abbr} — normalizeRoster returned null`)
        errorCount++
        continue
      }

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
          { $set: { ...p, normalizedName: normalizePlayerNameForMatching(p.name) } },
          { upsert: true }
        )
        playerCount++
      }

      teamCount++
      process.stdout.write(`  ${col(abbr.padEnd(4), DIM)} ${result.players.length} players\n`)
    } catch (err) {
      console.log(`  ${col('ERROR', RED)} ${abbr}: ${err.message}`)
      errorCount++
    }
    await sleep(200)
  }

  return { teamCount, playerCount, errorCount }
}

async function run() {
  await connectDB()

  const leagues = leagueArg ? [leagueArg] : LEAGUE_IDS

  console.log(col('\nRoster Backfill', BOLD))
  console.log(`  Leagues : ${leagues.join(', ')}`)
  if (clearCache) console.log(col('  --clear-cache : will wipe source_id_map_v2 player entries after roster write', YELLOW))
  console.log()

  let totalPlayers = 0
  let totalErrors = 0

  for (const leagueId of leagues) {
    const sport = SPORTS[leagueId]?.sport
    console.log(col(`${leagueId.toUpperCase()}`, BOLD))

    const { teamCount, playerCount, errorCount } = await processLeague(leagueId)
    totalPlayers += playerCount
    totalErrors += errorCount

    console.log(
      `  → ${col(String(teamCount), GREEN)} teams, ${col(String(playerCount), GREEN)} players written` +
      (errorCount > 0 ? `, ${col(String(errorCount), RED)} errors` : '') +
      '\n'
    )

    if (clearCache && sport) {
      const deleted = await getCollection('source_id_map_v2').deleteMany({
        source: 'oddsapi',
        entityType: 'player',
        sport,
      })
      await getCollection('player_name_review').deleteMany({ sport })
      console.log(col(`  Cleared ${deleted.deletedCount} source_id_map_v2 entries and player_name_review for ${sport}\n`, YELLOW))
    }
  }

  console.log(col('Done.', GREEN))
  console.log(`  Total players written : ${totalPlayers}`)
  if (totalErrors > 0) console.log(`  Errors                : ${col(String(totalErrors), RED)}`)
  if (clearCache) {
    console.log()
    console.log('Next step: node scripts/backfillPlayerPropsIds.js' + (leagueArg ? ` --league ${leagueArg}` : ''))
  }

  await closeDB()
}

run().catch((err) => {
  console.error('Roster backfill failed:', err)
  process.exit(1)
})
