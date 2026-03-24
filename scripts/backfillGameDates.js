/**
 * backfillGameDates.js
 *
 * Backfills `gameStartTime` and corrects `gameDate` on all existing player_stats
 * game documents. Previously, `gameDate` was stored as the raw UTC datetime from
 * GoalServe, which caused US evening games (7:30 PM ET = 00:30 AM UTC next day)
 * to appear on the wrong calendar date.
 *
 * Fix:
 *   - gameStartTime = exact UTC datetime of game start (from events.startTime)
 *   - gameDate      = midnight UTC of the Eastern Time date for that game
 *
 * Usage:
 *   node scripts/backfillGameDates.js
 *   node scripts/backfillGameDates.js --dry-run   (preview changes without writing)
 *   node scripts/backfillGameDates.js --league nba (only fix one league)
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const leagueFilter = args[args.indexOf('--league') + 1] || null

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const DIM    = '\x1b[2m'

function col(text, color) { return `${color}${text}${RESET}` }

/**
 * Convert a UTC Date to midnight UTC of the Eastern Time calendar date.
 * Handles EST (UTC-5) and EDT (UTC-4) automatically via Intl API.
 */
function toEasternDate(utcDate) {
  if (!utcDate) return null
  const etStr = utcDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return new Date(`${etStr}T00:00:00Z`)
}

async function run() {
  await connectDB()

  const playerStatsCol = getCollection('player_stats')
  const eventsCol      = getCollection('events')

  console.log()
  console.log(col('━━━ Backfill gameStartTime + gameDate ━━━━━━━━━━━━━━━━━━━━━━', BOLD))
  console.log(`  Dry run: ${dryRun ? col('YES — no DB writes', YELLOW) : col('NO — writing to DB', GREEN)}`)
  if (leagueFilter) console.log(`  League filter: ${col(leagueFilter, BOLD)}`)
  console.log()

  // Build a lookup cache: eventId → startTime
  const eventCache = new Map()
  const eventQuery = leagueFilter ? { leagueId: leagueFilter } : {}
  const eventCursor = eventsCol.find(eventQuery, { projection: { _id: 0, eventId: 1, startTime: 1 } })
  for await (const ev of eventCursor) {
    if (ev.eventId && ev.startTime) {
      eventCache.set(ev.eventId, new Date(ev.startTime))
    }
  }
  console.log(`  Loaded ${col(eventCache.size, BOLD)} events into cache`)

  // Process all game-level player stat docs
  const query = { statType: 'game', ...(leagueFilter ? { leagueId: leagueFilter } : {}) }
  const totalDocs = await playerStatsCol.countDocuments(query)
  console.log(`  Processing ${col(totalDocs, BOLD)} player_stats game docs\n`)

  let updated = 0
  let skipped = 0
  let noEvent = 0
  let errors  = 0
  let processed = 0

  const cursor = playerStatsCol.find(query, {
    projection: { _id: 1, eventId: 1, gameDate: 1, gameStartTime: 1 },
  })

  for await (const doc of cursor) {
    processed++
    if (processed % 500 === 0) {
      process.stdout.write(`\r  [${String(Math.round((processed / totalDocs) * 100)).padStart(3)}%] ${col(updated, GREEN)} updated, ${col(noEvent, YELLOW)} missing event, ${col(errors, RED)} errors`)
    }

    try {
      const startTime = eventCache.get(doc.eventId)

      if (!startTime) {
        noEvent++
        continue
      }

      const correctGameDate = toEasternDate(startTime)

      // Check if already correct (idempotency)
      const existingDateOk = doc.gameDate instanceof Date
        && doc.gameDate.getTime() === correctGameDate.getTime()
      const existingStartTimeOk = doc.gameStartTime instanceof Date
        && doc.gameStartTime.getTime() === startTime.getTime()

      if (existingDateOk && existingStartTimeOk) {
        skipped++
        continue
      }

      if (!dryRun) {
        await playerStatsCol.updateOne(
          { _id: doc._id },
          { $set: { gameStartTime: startTime, gameDate: correctGameDate } }
        )
      }
      updated++
    } catch (err) {
      errors++
      console.error(`\n  Error on doc ${doc._id}: ${err.message}`)
    }
  }

  process.stdout.write('\n')

  console.log()
  console.log(col('━━━ Backfill Complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))
  console.log(`  Total docs processed: ${col(processed, BOLD)}`)
  console.log(`  Updated:              ${col(updated, GREEN)}`)
  console.log(`  Already correct:      ${col(skipped, DIM)}`)
  console.log(`  No event found:       ${col(noEvent, noEvent > 0 ? YELLOW : DIM)}`)
  if (errors > 0) {
    console.log(`  Errors:               ${col(errors, RED)}`)
  }
  if (dryRun) {
    console.log(`\n  ${col('Dry run — no changes written to DB', YELLOW)}`)
  }
  console.log()

  await closeDB()
}

run().catch((err) => {
  console.error(col(`\nFatal error: ${err.message}`, RED))
  process.exit(1)
})
