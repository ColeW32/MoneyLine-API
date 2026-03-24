/**
 * checkOddsIngestion.js
 *
 * Prints a clear report of the most recent ingested odds to verify:
 *   1. Bookmakers are classified with sourceRegion and sourceType
 *   2. Sportsbooks sort before exchanges within each event
 *   3. us2 books appear alongside us books
 *   4. us_ex exchanges are present
 *   5. Unknown bookmaker keys are flagged
 *
 * Usage:
 *   node scripts/checkOddsIngestion.js
 *   node scripts/checkOddsIngestion.js --league nba
 *   node scripts/checkOddsIngestion.js --league nba --event 1   (check only first event)
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'

const args = process.argv.slice(2)
const leagueArg = args[args.indexOf('--league') + 1] || null
const eventLimit = parseInt(args[args.indexOf('--event') + 1]) || 3

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const RED    = '\x1b[31m'
const MAGENTA = '\x1b[35m'

function col(text, color) { return `${color}${text}${RESET}` }

async function run() {
  await connectDB()

  const filter = {}
  if (leagueArg) filter.leagueId = leagueArg

  const events = await getCollection('odds')
    .find(filter, { projection: { _id: 0 } })
    .sort({ fetchedAt: -1 })
    .limit(eventLimit)
    .toArray()

  if (events.length === 0) {
    console.log(col('\nNo odds found. Run the odds job first.\n', YELLOW))
    await closeDB()
    return
  }

  // ── Summary: bookmaker counts by type across all events ──────────────────
  const totals = { sportsbook: new Set(), exchange: new Set(), unknown: new Set() }
  for (const ev of events) {
    for (const bk of ev.bookmakers || []) {
      const bucket = totals[bk.sourceType] || totals.unknown
      bucket.add(bk.bookmakerId)
    }
  }

  console.log()
  console.log(col('━━━ Odds Ingestion Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))
  console.log(`  Checking ${col(events.length, BOLD)} most recent events${leagueArg ? ` (league: ${leagueArg})` : ''}`)
  console.log(`  Fetched at: ${col(events[0].fetchedAt?.toISOString() ?? 'unknown', DIM)}`)
  console.log()
  console.log(col('  Unique bookmakers seen across sampled events:', BOLD))
  console.log(`    ${col('Sportsbooks', GREEN)}  (us + us2):  ${col([...totals.sportsbook].join(', ') || 'none', GREEN)}`)
  console.log(`    ${col('Exchanges', CYAN)}    (us_ex):     ${col([...totals.exchange].join(', ') || 'none', CYAN)}`)
  if (totals.unknown.size > 0) {
    console.log(`    ${col('⚠ Unknown', RED)}              ${col([...totals.unknown].join(', '), RED)}`)
  }

  // ── Per-event detail ──────────────────────────────────────────────────────
  for (const ev of events) {
    const bks = ev.bookmakers || []
    console.log()
    console.log(col(`  ┌─ ${ev.leagueId?.toUpperCase()} │ ${ev.eventId}`, BOLD))
    console.log(    `  │  Fetched: ${col(ev.fetchedAt?.toISOString() ?? '?', DIM)}`)

    if (bks.length === 0) {
      console.log(col('  │  No bookmakers.', YELLOW))
      console.log(    '  └─────────────────────────────────────────')
      continue
    }

    // Check ordering: all sportsbooks should come before exchanges
    const firstExchangeIdx = bks.findIndex((b) => b.sourceType === 'exchange')
    const lastSportsbookIdx = [...bks].reverse().findIndex((b) => b.sourceType === 'sportsbook')
    const lastSportsbookIdxFwd = lastSportsbookIdx === -1 ? -1 : bks.length - 1 - lastSportsbookIdx
    const orderOk = firstExchangeIdx === -1 || lastSportsbookIdxFwd === -1 || lastSportsbookIdxFwd < firstExchangeIdx
    const orderLabel = orderOk
      ? col('✓ correct (sportsbooks before exchanges)', GREEN)
      : col('✗ WRONG ORDER — sportsbook appears after exchange!', RED)

    console.log(`  │  Sort order: ${orderLabel}`)
    console.log(`  │`)
    console.log(`  │  ${'#'.padEnd(3)} ${'bookmakerId'.padEnd(20)} ${'sourceRegion'.padEnd(12)} ${'sourceType'.padEnd(12)} moneyline prices`)
    console.log(`  │  ${'─'.repeat(80)}`)

    for (let i = 0; i < bks.length; i++) {
      const bk = bks[i]
      const ml = bk.markets?.find((m) => m.marketType === 'moneyline')
      const prices = ml
        ? ml.outcomes.map((o) => `${o.name}: ${o.price > 0 ? '+' : ''}${o.price}`).join('  ')
        : col('(no moneyline)', DIM)

      const typeColor = bk.sourceType === 'sportsbook' ? GREEN
                      : bk.sourceType === 'exchange'   ? CYAN
                      : RED
      const regionColor = bk.sourceRegion === 'us'    ? GREEN
                        : bk.sourceRegion === 'us2'   ? YELLOW
                        : bk.sourceRegion === 'us_ex' ? CYAN
                        : RED

      console.log(
        `  │  ${String(i + 1).padEnd(3)} ` +
        `${col(bk.bookmakerId.padEnd(20), BOLD)} ` +
        `${col((bk.sourceRegion || 'unknown').padEnd(12), regionColor)} ` +
        `${col((bk.sourceType  || 'unknown').padEnd(12), typeColor)} ` +
        `${col(prices, DIM)}`
      )
    }

    // Flag unknowns
    const unknowns = bks.filter((b) => b.sourceType === 'unknown' || !b.sourceType)
    if (unknowns.length > 0) {
      console.log(`  │`)
      console.log(`  │  ${col(`⚠  ${unknowns.length} unknown key(s) — add to bookmakerCatalog.js:`, RED)}`)
      for (const u of unknowns) {
        console.log(`  │     ${col(u.bookmakerId, RED)}`)
      }
    }

    console.log(`  └${'─'.repeat(82)}`)
  }

  // ── Edge data spot-check ──────────────────────────────────────────────────
  const edgeFilter = {}
  if (leagueArg) edgeFilter.leagueId = leagueArg

  const edgeDocs = await getCollection('edge_data')
    .find(edgeFilter, { projection: { _id: 0 } })
    .sort({ calculatedAt: -1 })
    .limit(5)
    .toArray()

  console.log()
  console.log(col('━━━ Edge Data Spot-Check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))

  if (edgeDocs.length === 0) {
    console.log(col('  No edge data found yet.', YELLOW))
  } else {
    const typeCounts = {}
    const venueCounts = {}
    for (const doc of edgeDocs) {
      for (const e of doc.edges || []) {
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
        if (e.venueType) venueCounts[e.venueType] = (venueCounts[e.venueType] || 0) + 1
      }
    }
    console.log(`  Edge docs sampled: ${col(edgeDocs.length, BOLD)}`)
    console.log(`  Edge types:  ${Object.entries(typeCounts).map(([k, v]) => `${k}=${col(v, BOLD)}`).join('  ')}`)
    if (Object.keys(venueCounts).length > 0) {
      console.log(`  Arb venueTypes: ${Object.entries(venueCounts).map(([k, v]) => `${k}=${col(v, BOLD)}`).join('  ')}`)
    }

    const valueEdges = edgeDocs.flatMap((d) => d.edges?.filter((e) => e.type === 'value') || [])
    const evEdges    = edgeDocs.flatMap((d) => d.edges?.filter((e) => e.type === 'ev')    || [])
    const arbEdges   = edgeDocs.flatMap((d) => d.edges?.filter((e) => e.type === 'arbitrage') || [])

    console.log()
    if (valueEdges.length > 0) {
      const e = valueEdges[0]
      console.log(`  ${col('Sample value edge:', GREEN)} ${e.outcome} @ ${e.valueBet?.odds} (${e.valueBet?.bookmaker}) ` +
                  `edge=${e.valueBet?.edgePct}% sourceType=${col(e.sourceType, GREEN)}`)
    } else {
      console.log(`  ${col('No value edges found (expected after first re-ingest post-deploy)', YELLOW)}`)
    }

    if (arbEdges.length > 0) {
      const e = arbEdges[0]
      console.log(`  ${col('Sample arb edge:', MAGENTA)} ${e.outcome} venueType=${col(e.venueType, MAGENTA)} ` +
                  `profit=${e.arbitrage?.profitPct}%`)
    }

    if (evEdges.length > 0) {
      const e = evEdges[0]
      console.log(`  ${col('Sample ev edge:', CYAN)} ${e.outcome} @ ${e.evBet?.odds} evPct=${e.evBet?.evPct}% sourceType=${col(e.sourceType, CYAN)}`)
    }
  }

  console.log()
  await closeDB()
}

run().catch((err) => {
  console.error(col(`\nError: ${err.message}`, RED))
  process.exit(1)
})
