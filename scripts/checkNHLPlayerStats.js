/**
 * checkNHLPlayerStats.js
 *
 * Diagnostic script for NHL player stats ingestion.
 * Run this to see exactly what GoalServe returns for NHL scores and
 * what (if anything) is already in MongoDB.
 *
 * Usage:
 *   node scripts/checkNHLPlayerStats.js
 *   node scripts/checkNHLPlayerStats.js --date 23.03.2026   (specific date dd.MM.yyyy)
 *   node scripts/checkNHLPlayerStats.js --raw               (dump full match JSON)
 */

import { connectDB, closeDB, getCollection } from '../src/db.js'
import { SPORTS } from '../src/config/sports.js'

const args = process.argv.slice(2)
const dateArg = args[args.indexOf('--date') + 1] || null
const showRaw = args.includes('--raw')

const BASE_URL = process.env.DATA_SOURCE_A_BASE_URL
const API_KEY  = process.env.DATA_SOURCE_A_KEY

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const RED    = '\x1b[31m'

function col(text, color) { return `${color}${text}${RESET}` }

function formatDate(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function printStructure(obj, indent = 0, maxDepth = 4) {
  if (indent > maxDepth) return `${' '.repeat(indent)}...`
  const pad = ' '.repeat(indent)
  if (obj === null || obj === undefined) return `${pad}${col('null', DIM)}`
  if (typeof obj !== 'object') return `${pad}${col(JSON.stringify(obj), DIM)}`
  if (Array.isArray(obj)) {
    const len = obj.length
    if (len === 0) return `${pad}${col('[]', DIM)}`
    const sample = obj[0]
    return `${pad}${col(`[Array(${len})]`, CYAN)} first item:\n${printStructure(sample, indent + 2, maxDepth)}`
  }
  const lines = []
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      lines.push(`${pad}${col(key, BOLD)}: ${Array.isArray(value) ? col(`[Array(${value.length})]`, CYAN) : col('{...}', DIM)}`)
      if (!Array.isArray(value) || value.length > 0) {
        lines.push(printStructure(value, indent + 2, maxDepth))
      }
    } else {
      const display = String(value).slice(0, 60)
      lines.push(`${pad}${col(key, BOLD)}: ${col(display, DIM)}`)
    }
  }
  return lines.join('\n')
}

async function fetchNHLScores(date) {
  const url = new URL(`${BASE_URL}/${API_KEY}/hockey/nhl-scores`)
  url.searchParams.set('json', '1')
  if (date) url.searchParams.set('date', date)

  console.log(`\n  Fetching: ${col(url.toString().replace(API_KEY, '***'), DIM)}`)
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      console.log(col(`  HTTP ${res.status} error`, RED))
      return null
    }
    return await res.json()
  } catch (err) {
    console.log(col(`  Fetch failed: ${err.message}`, RED))
    return null
  }
}

async function run() {
  if (!BASE_URL || !API_KEY) {
    console.log(col('\nError: DATA_SOURCE_A_BASE_URL or DATA_SOURCE_A_KEY not set\n', RED))
    process.exit(1)
  }

  await connectDB()

  console.log()
  console.log(col('━━━ NHL Player Stats Diagnostic ━━━━━━━━━━━━━━━━━━━━━━━━━━━', BOLD))

  // ── 1. Check MongoDB for existing NHL player stats ──────────────────────
  console.log(`\n${col('1. MongoDB State', BOLD)}`)
  const playerStatsCol = getCollection('player_stats')
  const nhlGameCount   = await playerStatsCol.countDocuments({ leagueId: 'nhl', statType: 'game' })
  const nhlSeasonCount = await playerStatsCol.countDocuments({ leagueId: 'nhl', statType: 'season' })
  const nhlPlayerCount = await getCollection('players').countDocuments({ leagueId: 'nhl' })

  console.log(`  NHL player_stats (game):   ${col(nhlGameCount, nhlGameCount > 0 ? GREEN : RED)}`)
  console.log(`  NHL player_stats (season): ${col(nhlSeasonCount, nhlSeasonCount > 0 ? GREEN : RED)}`)
  console.log(`  NHL players collection:    ${col(nhlPlayerCount, nhlPlayerCount > 0 ? GREEN : YELLOW)}`)

  if (nhlGameCount > 0) {
    const sample = await playerStatsCol.findOne({ leagueId: 'nhl', statType: 'game' }, { projection: { _id: 0 } })
    console.log(`\n  Sample game doc keys: ${col(Object.keys(sample).join(', '), DIM)}`)
    if (sample.stats) {
      console.log(`  Stats sub-keys: ${col(Object.keys(sample.stats).join(', '), CYAN)}`)
    }
  }

  // ── 2. Fetch NHL scores from GoalServe ──────────────────────────────────
  console.log(`\n${col('2. GoalServe API — NHL Scores', BOLD)}`)

  // Try yesterday and today (NHL games are usually evening ET)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const datesToTry = dateArg
    ? [dateArg]
    : [formatDate(yesterday), formatDate(today)]

  for (const date of datesToTry) {
    console.log(`\n  ${col(`Date: ${date}`, BOLD)}`)
    const raw = await fetchNHLScores(date)

    if (!raw) {
      console.log(col('  No response', RED))
      continue
    }

    const topKeys = Object.keys(raw)
    console.log(`  Top-level keys: ${col(topKeys.join(', '), DIM)}`)

    const matches = raw?.scores?.category?.match
    if (!matches) {
      console.log(col(`  No matches found (raw.scores.category.match is missing)`, YELLOW))
      console.log(`  scores keys: ${col(JSON.stringify(Object.keys(raw?.scores || {})), DIM)}`)
      if (raw?.scores?.category) {
        console.log(`  scores.category keys: ${col(JSON.stringify(Object.keys(raw.scores.category)), DIM)}`)
      }
      continue
    }

    const matchArr = Array.isArray(matches) ? matches : [matches]
    console.log(`  Found ${col(matchArr.length, BOLD)} matches`)

    let matchesWithPlayerStats = 0
    let matchesWithGoalkeeperStats = 0

    for (const m of matchArr) {
      const hasPlayer     = !!m?.player_stats
      const hasGoalkeeper = !!m?.goalkeeper_stats
      if (hasPlayer) matchesWithPlayerStats++
      if (hasGoalkeeper) matchesWithGoalkeeperStats++
    }

    console.log(`  Matches with player_stats:     ${col(matchesWithPlayerStats, matchesWithPlayerStats > 0 ? GREEN : YELLOW)}`)
    console.log(`  Matches with goalkeeper_stats: ${col(matchesWithGoalkeeperStats, matchesWithGoalkeeperStats > 0 ? GREEN : YELLOW)}`)

    // Show structure of first completed/final match
    const finalMatch = matchArr.find(m =>
      m?.status?.toLowerCase()?.includes('final') ||
      m?.player_stats ||
      m?.goalkeeper_stats
    ) || matchArr[0]

    if (finalMatch) {
      console.log(`\n  ${col('First relevant match:', BOLD)} ${finalMatch.hometeam?.name} vs ${finalMatch.awayteam?.name}`)
      console.log(`  Status: ${col(finalMatch.status || '?', DIM)}`)
      console.log(`  Match-level keys: ${col(Object.keys(finalMatch).join(', '), DIM)}`)

      if (finalMatch.player_stats) {
        const psKeys = Object.keys(finalMatch.player_stats)
        console.log(`\n  ${col('player_stats keys:', GREEN)} ${col(psKeys.join(', '), DIM)}`)
        for (const key of psKeys) {
          const sub = finalMatch.player_stats[key]
          if (sub && typeof sub === 'object') {
            const subKeys = Object.keys(sub)
            console.log(`    player_stats.${col(key, CYAN)} keys: ${col(subKeys.join(', '), DIM)}`)
            for (const sk of subKeys) {
              const deeper = sub[sk]
              if (deeper && typeof deeper === 'object') {
                console.log(`      player_stats.${key}.${col(sk, CYAN)} keys: ${col(Object.keys(deeper).join(', '), DIM)}`)
                // Show first player record
                const playerArr = Array.isArray(deeper) ? deeper : (deeper.player ? (Array.isArray(deeper.player) ? deeper.player : [deeper.player]) : [deeper])
                if (playerArr.length > 0) {
                  const p = playerArr[0]
                  if (typeof p === 'object') {
                    console.log(`        First player keys: ${col(Object.keys(p).join(', '), DIM)}`)
                  }
                }
              }
            }
          }
        }
      } else {
        console.log(col('\n  No player_stats in this match', YELLOW))
      }

      if (finalMatch.goalkeeper_stats) {
        const gkKeys = Object.keys(finalMatch.goalkeeper_stats)
        console.log(`\n  ${col('goalkeeper_stats keys:', GREEN)} ${col(gkKeys.join(', '), DIM)}`)
        for (const key of gkKeys) {
          const sub = finalMatch.goalkeeper_stats[key]
          if (sub && typeof sub === 'object') {
            const subKeys = Object.keys(sub)
            console.log(`    goalkeeper_stats.${col(key, CYAN)} keys: ${col(subKeys.join(', '), DIM)}`)
          }
        }
      }

      if (showRaw) {
        console.log(`\n  ${col('Full match JSON:', BOLD)}`)
        console.log(JSON.stringify(finalMatch, null, 2))
      }
    }
  }

  // ── 3. Also test a date from mid-season where games definitely happened ──
  console.log(`\n${col('3. Testing mid-season date (Feb 15, 2026)', BOLD)}`)
  const midSeasonDate = '15.02.2026'
  const midRaw = await fetchNHLScores(midSeasonDate)
  if (midRaw) {
    const midMatches = midRaw?.scores?.category?.match
    if (midMatches) {
      const midArr = Array.isArray(midMatches) ? midMatches : [midMatches]
      const withStats = midArr.filter(m => m?.player_stats || m?.goalkeeper_stats).length
      console.log(`  ${midSeasonDate}: ${col(midArr.length, BOLD)} matches, ${col(withStats, withStats > 0 ? GREEN : RED)} with stats`)
    } else {
      console.log(col(`  No matches for ${midSeasonDate}`, YELLOW))
    }
  }

  console.log()
  await closeDB()
}

run().catch((err) => {
  console.error(col(`\nError: ${err.message}`, RED))
  process.exit(1)
})
