/**
 * backfillPlayerPropsIds.js
 *
 * One-shot script to enrich existing player_props documents with resolved playerIds.
 * Run this after deploying the unified player identity system and after the first
 * roster ingestion cycle has completed (so players.normalizedName fields are populated).
 *
 * Usage:
 *   node scripts/backfillPlayerPropsIds.js
 *   node scripts/backfillPlayerPropsIds.js --league nba     (single league only)
 *   node scripts/backfillPlayerPropsIds.js --dry-run        (resolve without writing to DB)
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'
import { enrichPlayerPropsWithIds } from '../src/ingestion/playerIdentityResolver.js'

const args = process.argv.slice(2)
const leagueArg = args[args.indexOf('--league') + 1] || null
const dryRun = args.includes('--dry-run')

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'

function col(text, color) { return `${color}${text}${RESET}` }

const LOG_INTERVAL = 50

async function run() {
  await connectDB()

  console.log(col('\nPlayer Props ID Backfill', BOLD))
  if (leagueArg) console.log(`  League filter : ${leagueArg}`)
  if (dryRun) console.log(col('  DRY RUN — no writes', YELLOW))
  console.log()

  // Match docs where any player entry is missing a playerId OR has playerId: null
  const filter = { 'players.playerId': null }
  if (leagueArg) filter.leagueId = leagueArg

  const total = await getCollection('player_props').countDocuments(filter)
  console.log(`Documents to process: ${col(String(total), BOLD)}\n`)

  if (total === 0) {
    console.log(col('Nothing to backfill.', GREEN))
    await closeDB()
    return
  }

  const cursor = getCollection('player_props')
    .find(filter, { projection: { _id: 1, eventId: 1, leagueId: 1, sport: 1, players: 1, playerNames: 1 } })
    .sort({ leagueId: 1, eventId: 1 })

  let processed = 0
  let enriched = 0
  let skipped = 0

  for await (const doc of cursor) {
    const before = (doc.players || []).filter((p) => p.playerId).length

    if (!dryRun) {
      await enrichPlayerPropsWithIds(doc)

      const after = (doc.players || []).filter((p) => p.playerId).length
      const resolvedCount = after - before

      if (resolvedCount > 0 || doc.playerIds?.length > 0) {
        const updateFields = {}
        for (let i = 0; i < doc.players.length; i++) {
          updateFields[`players.${i}.playerId`] = doc.players[i].playerId ?? null
        }
        updateFields.playerIds = doc.playerIds || []

        await getCollection('player_props').updateOne(
          { _id: doc._id },
          { $set: updateFields }
        )
        enriched++
      } else {
        skipped++
      }
    } else {
      // Dry run — resolve but don't write
      await enrichPlayerPropsWithIds(doc)
      const resolved = (doc.players || []).filter((p) => p.playerId).length
      if (resolved > 0) enriched++
      else skipped++
    }

    processed++
    if (processed % LOG_INTERVAL === 0 || processed === total) {
      const pct = Math.round((processed / total) * 100)
      console.log(
        `  ${col(String(processed).padStart(5), DIM)}/${total}  (${pct}%)` +
        `  enriched=${col(String(enriched), GREEN)}  skipped=${skipped}`
      )
    }
  }

  console.log()
  console.log(col('Done.', GREEN))
  console.log(`  Total processed : ${processed}`)
  console.log(`  With IDs added  : ${enriched}`)
  console.log(`  No IDs resolved : ${skipped}`)
  if (dryRun) console.log(col('\n  No changes written (dry run).', YELLOW))

  await closeDB()
}

run().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
