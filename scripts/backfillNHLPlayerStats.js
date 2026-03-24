/**
 * backfillNHLPlayerStats.js
 *
 * One-shot script to backfill NHL player stats from GoalServe boxscores.
 * Run this after fixing/deploying to immediately seed MongoDB with
 * historical NHL player game logs for the current season.
 *
 * Usage:
 *   node scripts/backfillNHLPlayerStats.js
 *   node scripts/backfillNHLPlayerStats.js --from 01.10.2025   (custom start date dd.MM.yyyy)
 *   node scripts/backfillNHLPlayerStats.js --dry-run           (fetch + parse without writing to DB)
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'
import { SPORTS, getCurrentSeason, getSeasonStartDate } from '../src/config/sports.js'
import { fetchScores } from '../src/ingestion/fetchers/goalserve.js'
import * as nhlNormalizer from '../src/ingestion/normalizers/nhl.js'
import { buildSeasonDoc } from '../src/ingestion/normalizers/shared.js'

const args = process.argv.slice(2)
const fromArg  = args[args.indexOf('--from') + 1] || null
const dryRun   = args.includes('--dry-run')

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const DIM    = '\x1b[2m'

function col(text, color) { return `${color}${text}${RESET}` }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function parseArgDate(str) {
  const [dd, mm, yyyy] = str.split('.')
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function formatGoalserveDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function buildDateRange(startDate, endDate) {
  const dates = []
  const cursor = startOfUtcDay(startDate)
  const end    = startOfUtcDay(endDate)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

async function run() {
  const config = SPORTS.nhl

  if (!dryRun) {
    await connectDB()
  }

  const season    = getCurrentSeason('nhl')
  const startDate = fromArg
    ? parseArgDate(fromArg)
    : getSeasonStartDate('nhl', season)
  const endDate   = new Date()
  const dates     = buildDateRange(startDate, endDate)

  console.log()
  console.log(col('━━━ NHL Player Stats Backfill ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))
  console.log(`  Season:   ${col(season, BOLD)}`)
  console.log(`  From:     ${col(formatGoalserveDate(startDate), DIM)}`)
  console.log(`  To:       ${col(formatGoalserveDate(endDate), DIM)}`)
  console.log(`  Dates:    ${col(dates.length, BOLD)} days to process`)
  console.log(`  Dry run:  ${dryRun ? col('YES — no DB writes', YELLOW) : col('NO — writing to DB', GREEN)}`)
  console.log()

  let totalGames  = 0
  let totalSeasons = 0
  let totalDatesWithData = 0
  let totalErrors = 0
  const playerSeasonKeys = new Set()

  for (let i = 0; i < dates.length; i++) {
    const date    = dates[i]
    const dateStr = formatGoalserveDate(date)
    const pct     = Math.round(((i + 1) / dates.length) * 100)

    process.stdout.write(`\r  [${String(pct).padStart(3)}%] ${dateStr} — ${col(totalGames, GREEN)} games, ${col(totalErrors, totalErrors > 0 ? RED : DIM)} errors`)

    try {
      const raw = await fetchScores(config, dateStr)
      if (!raw) {
        await sleep(200)
        continue
      }

      // Also upsert events so foreign keys resolve correctly
      if (!dryRun) {
        const events = await nhlNormalizer.normalizeScores(raw)
        if (events.length > 0) {
          const eventsCol = getCollection('events')
          for (const ev of events) {
            await eventsCol.updateOne({ eventId: ev.eventId }, { $set: ev }, { upsert: true })
          }
        }
      }

      const result = await nhlNormalizer.normalizePlayerStatsFromScores(raw)
      if (!result?.games?.length) {
        await sleep(150)
        continue
      }

      totalDatesWithData++

      if (!dryRun) {
        const playersCol     = getCollection('players')
        const playerStatsCol = getCollection('player_stats')

        for (const doc of result.games) {
          // Upsert player record
          await playersCol.updateOne(
            { playerId: doc.playerId },
            {
              $set: {
                playerId:  doc.playerId,
                teamId:    doc.teamId,
                leagueId:  doc.leagueId,
                name:      doc.playerName,
                position:  doc.position || '',
                updatedAt: new Date(),
              },
              $setOnInsert: { status: 'active' },
            },
            { upsert: true }
          )

          // Upsert game log
          await playerStatsCol.updateOne(
            { playerId: doc.playerId, statType: 'game', eventId: doc.eventId },
            { $set: doc },
            { upsert: true }
          )

          playerSeasonKeys.add(`${doc.playerId}::${doc.season}`)
          totalGames++
        }
      } else {
        totalGames += result.games.length
        for (const doc of result.games) {
          playerSeasonKeys.add(`${doc.playerId}::${doc.season}`)
        }
      }
    } catch (err) {
      totalErrors++
      console.error(`\n  Error on ${dateStr}: ${err.message}`)
    }

    await sleep(150)
  }

  process.stdout.write('\n')

  // Rebuild season aggregates
  if (!dryRun && playerSeasonKeys.size > 0) {
    console.log(`\n  Rebuilding ${col(playerSeasonKeys.size, BOLD)} season docs...`)
    const playerStatsCol = getCollection('player_stats')

    for (const key of playerSeasonKeys) {
      const [playerId, season] = key.split('::')
      const gameDocs = await playerStatsCol
        .find({ playerId, season, statType: 'game' }, { projection: { _id: 0 } })
        .sort({ gameDate: 1 })
        .toArray()

      if (gameDocs.length === 0) continue

      const seasonDoc = buildSeasonDoc(gameDocs[0], gameDocs)
      await playerStatsCol.updateOne(
        { playerId, statType: 'season', season },
        { $set: seasonDoc },
        { upsert: true }
      )
      totalSeasons++
    }
  }

  console.log()
  console.log(col('━━━ Backfill Complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))
  console.log(`  Dates with game data: ${col(totalDatesWithData, GREEN)}`)
  console.log(`  Game logs written:    ${col(totalGames, GREEN)}`)
  console.log(`  Season docs rebuilt:  ${col(totalSeasons, GREEN)}`)
  if (totalErrors > 0) {
    console.log(`  Errors:               ${col(totalErrors, RED)}`)
  }
  console.log()

  if (!dryRun) await closeDB()
}

run().catch((err) => {
  console.error(col(`\nFatal error: ${err.message}`, RED))
  process.exit(1)
})
