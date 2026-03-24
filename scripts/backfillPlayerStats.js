import 'dotenv/config'
import { connectDB, closeDB } from '../src/db.js'
import { SPORTS, getAllLeagueIds } from '../src/config/sports.js'
import { runTrackedPlayerStatsBackfill, getDefaultPlayerStatsBackfillSeasons } from '../src/ingestion/scheduler.js'

const args = process.argv.slice(2)

function parseListArg(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return null

  const value = args[index + 1]
  if (!value) return null
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function hasFlag(flag) {
  return args.includes(flag)
}

async function main() {
  const requestedLeagues = parseListArg('--league') || getAllLeagueIds()
  const requestedSeasons = parseListArg('--season')
  const force = hasFlag('--force')

  for (const leagueId of requestedLeagues) {
    if (!SPORTS[leagueId]) {
      throw new Error(`Unknown league "${leagueId}". Expected one of: ${getAllLeagueIds().join(', ')}`)
    }
  }

  await connectDB()

  try {
    for (const leagueId of requestedLeagues) {
      const config = SPORTS[leagueId]
      const seasons = requestedSeasons || getDefaultPlayerStatsBackfillSeasons(leagueId)
      console.log(`[backfill:player-stats] ${leagueId}: seasons ${seasons.join(', ')}${force ? ' (forced)' : ''}`)
      await runTrackedPlayerStatsBackfill(config, { seasons, force, reason: 'manual' })
    }
  } finally {
    await closeDB()
  }
}

main().catch((err) => {
  console.error(`[backfill:player-stats] Failed: ${err.message}`)
  process.exit(1)
})
