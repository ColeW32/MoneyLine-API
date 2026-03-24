import 'dotenv/config'

import { connectDB, closeDB, getCollection } from '../src/db.js'
import { getAllLeagueIds } from '../src/config/sports.js'

const LEAGUE_PREFIX = {
  nba: 'nba-',
  nfl: 'nfl-',
  mlb: 'mlb-',
  nhl: 'nhl-',
}

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

async function getLeagueSeasonSummaries(col, leagueId, seasons) {
  const match = { leagueId }
  if (seasons?.length) {
    match.season = { $in: seasons }
  }

  return col.aggregate([
    { $match: match },
    {
      $group: {
        _id: { season: '$season', statType: '$statType' },
        docs: { $sum: 1 },
        players: { $addToSet: '$playerId' },
      },
    },
    {
      $project: {
        _id: 0,
        season: '$_id.season',
        statType: '$_id.statType',
        docs: 1,
        players: { $size: '$players' },
      },
    },
    { $sort: { season: 1, statType: 1 } },
  ]).toArray()
}

async function main() {
  const leagues = parseListArg('--league') || getAllLeagueIds()
  const seasons = parseListArg('--season')
  const strict = hasFlag('--strict')

  await connectDB()

  try {
    const playerStatsCol = getCollection('player_stats')
    let hasFailures = false

    for (const leagueId of leagues) {
      const prefix = LEAGUE_PREFIX[leagueId] || `${leagueId}-`
      const invalidFilter = {
        leagueId,
        statType: 'game',
        $or: [
          { eventId: { $exists: false } },
          { eventId: null },
          { eventId: '' },
          { eventId: /undefined/i },
          { eventId: { $not: new RegExp(`^${prefix}`) } },
        ],
      }

      if (seasons?.length) {
        invalidFilter.season = { $in: seasons }
      }

      const invalidCount = await playerStatsCol.countDocuments(invalidFilter)
      const invalidSamples = await playerStatsCol.find(
        invalidFilter,
        {
          projection: {
            _id: 0,
            leagueId: 1,
            season: 1,
            playerId: 1,
            playerName: 1,
            eventId: 1,
            gameDate: 1,
            teamId: 1,
            opponent: 1,
          },
        }
      ).limit(5).toArray()

      const summaries = await getLeagueSeasonSummaries(playerStatsCol, leagueId, seasons)

      console.log(`\n[verify:player-stats] ${leagueId.toUpperCase()}`)
      if (summaries.length === 0) {
        console.log('  No player_stats documents found')
        if (strict) hasFailures = true
      } else {
        for (const row of summaries) {
          console.log(`  ${row.season} ${row.statType}: ${row.docs} docs across ${row.players} players`)
        }
      }

      console.log(`  Invalid game docs: ${invalidCount}`)
      if (invalidSamples.length > 0) {
        for (const sample of invalidSamples) {
          console.log(`    sample: ${sample.season} ${sample.playerName} (${sample.playerId}) -> ${sample.eventId}`)
        }
      }

      if (strict) {
        if (invalidCount > 0) hasFailures = true

        if (seasons?.length) {
          for (const season of seasons) {
            const hasGameDocs = summaries.some((row) => row.season === season && row.statType === 'game' && row.docs > 0)
            const hasSeasonDocs = summaries.some((row) => row.season === season && row.statType === 'season' && row.docs > 0)
            if (!hasGameDocs || !hasSeasonDocs) {
              hasFailures = true
              console.log(`    missing coverage for season ${season}: game=${hasGameDocs} season=${hasSeasonDocs}`)
            }
          }
        }
      }
    }

    if (strict && hasFailures) {
      process.exitCode = 1
    }
  } finally {
    await closeDB()
  }
}

main().catch((err) => {
  console.error(`[verify:player-stats] Failed: ${err.message}`)
  process.exit(1)
})
