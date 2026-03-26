import { getCollection } from '../db.js'
import { getCurrentSeason } from '../config/sports.js'

/**
 * Maps Odds API market keys to player_stats.stats field names (GoalServe raw keys).
 * Multiple fields are summed (e.g., pts + reb + ast for PRA).
 *
 * NOTE: Field names must match what GoalServe returns in boxscore player rows.
 * NBA boxscores: verify pts/reb/ast/blk/stl/to/tp/fgm/ftm against live data.
 * NHL boxscores: verify sog/g/ast/pts/bs/ppp against live data.
 * MLB boxscores: verify h/hr/r/rbi/tb/bb/sb/so against live data.
 */
export const MARKET_TO_STAT_FIELDS = {
  nba: {
    player_points:                            ['pts'],
    player_rebounds:                          ['reb'],
    player_assists:                           ['ast'],
    player_blocks:                            ['blk'],
    player_steals:                            ['stl'],
    player_turnovers:                         ['to'],
    player_threes:                            ['tp'],
    player_field_goals:                       ['fgm'],
    player_frees_made:                        ['ftm'],
    player_frees_attempts:                    ['fta'],
    player_blocks_steals:                     ['blk', 'stl'],
    player_points_rebounds:                   ['pts', 'reb'],
    player_points_assists:                    ['pts', 'ast'],
    player_rebounds_assists:                  ['reb', 'ast'],
    player_points_rebounds_assists:           ['pts', 'reb', 'ast'],
    player_points_alternate:                  ['pts'],
    player_rebounds_alternate:                ['reb'],
    player_assists_alternate:                 ['ast'],
    player_blocks_alternate:                  ['blk'],
    player_steals_alternate:                  ['stl'],
    player_turnovers_alternate:               ['to'],
    player_threes_alternate:                  ['tp'],
    player_points_rebounds_alternate:         ['pts', 'reb'],
    player_points_assists_alternate:          ['pts', 'ast'],
    player_rebounds_assists_alternate:        ['reb', 'ast'],
    player_points_rebounds_assists_alternate: ['pts', 'reb', 'ast'],
  },
  nhl: {
    player_shots_on_goal:           ['sog'],
    player_goals:                   ['g'],
    player_assists:                 ['ast'],
    player_points:                  ['pts'],
    player_blocked_shots:           ['bs'],
    player_power_play_points:       ['ppp'],
    player_goals_assists:           ['g', 'ast'],
    player_shots_on_goal_alternate: ['sog'],
    player_goals_alternate:         ['g'],
    player_points_alternate:        ['pts'],
  },
  mlb: {
    player_hits:                        ['h'],
    player_home_runs:                   ['hr'],
    player_runs_scored:                 ['r'],
    player_rbis:                        ['rbi'],
    player_total_bases:                 ['tb'],
    player_walks:                       ['bb'],
    player_stolen_bases:                ['sb'],
    player_batter_strikeouts:           ['so'],
    player_hits_runs_rbis:              ['h', 'r', 'rbi'],
    player_strikeouts_pitcher:          ['so'],
    player_pitcher_hits_allowed:        ['h'],
    player_hits_alternate:              ['h'],
    player_home_runs_alternate:         ['hr'],
    player_strikeouts_pitcher_alternate: ['so'],
  },
  nfl: {
    player_pass_yds:         ['pass_yds'],
    player_pass_tds:         ['pass_td'],
    player_pass_completions: ['completions'],
    player_pass_attempts:    ['attempts'],
    player_rush_yds:         ['rush_yds'],
    player_rush_attempts:    ['rush_att'],
    player_reception_yds:    ['rec_yds'],
    player_receptions:       ['rec'],
    player_sacks:            ['sacks'],
    player_solo_tackles:     ['solo_tackles'],
    player_tackles_assists:  ['solo_tackles', 'ast_tackles'],
  },
}

/**
 * Get the stat fields for a market in a league. Returns null if not mapped.
 */
export function getStatFields(leagueId, market) {
  return MARKET_TO_STAT_FIELDS[leagueId]?.[market] ?? null
}

/**
 * Sum the specified stat fields from a game's stats object.
 * Returns null if none of the fields are present.
 */
function sumStatFields(stats, fields) {
  if (!stats || !fields?.length) return null

  let total = 0
  let found = false
  for (const field of fields) {
    const val = stats[field]
    if (typeof val === 'number' && Number.isFinite(val)) {
      total += val
      found = true
    }
  }

  return found ? total : null
}

/**
 * Compute hit rates for a player against a specific line.
 * Uses pre-fetched game stats sorted newest-first.
 *
 * @param {Array}  games     - player_stats game docs sorted by gameDate descending
 * @param {Array}  fields    - stat fields to sum (from MARKET_TO_STAT_FIELDS)
 * @param {number} line      - the prop line threshold
 * @param {string} direction - 'over' or 'under'
 * @param {string} season    - current season string for season-rate calculation
 */
export function computeHitRates(games, fields, line, direction = 'over', season = null) {
  const windows = { L5: 5, L10: 10, L25: 25 }
  const result = {}

  for (const [label, n] of Object.entries(windows)) {
    const slice = games.slice(0, n)
    if (slice.length === 0) {
      result[label] = null
      continue
    }

    let hits = 0
    for (const game of slice) {
      const val = sumStatFields(game.stats, fields)
      if (val === null) continue
      const hit = direction === 'over' ? val > line : val < line
      if (hit) hits++
    }

    result[label] = {
      games: slice.length,
      hits,
      rate: slice.length > 0 ? Math.round((hits / slice.length) * 1000) / 1000 : null,
    }
  }

  // Season rate: all games from the current season
  const seasonGames = season ? games.filter((g) => g.season === season) : games
  if (seasonGames.length > 0) {
    let hits = 0
    for (const game of seasonGames) {
      const val = sumStatFields(game.stats, fields)
      if (val === null) continue
      const hit = direction === 'over' ? val > line : val < line
      if (hit) hits++
    }
    result.season = {
      games: seasonGames.length,
      hits,
      rate: Math.round((hits / seasonGames.length) * 1000) / 1000,
    }
  } else {
    result.season = null
  }

  return result
}

/**
 * Run hit rate pre-computation for all players with active props in a league.
 * Stores results in the hit_rates collection.
 * Called from scheduler after player_props ingestion completes.
 */
export async function calculateHitRates(leagueId) {
  console.log(`[hit-rates] Calculating hit rates for ${leagueId}...`)

  const leagueMarketMap = MARKET_TO_STAT_FIELDS[leagueId]
  if (!leagueMarketMap) {
    console.log(`[hit-rates] No stat field map for ${leagueId}, skipping.`)
    return
  }

  // Get all active player_props for this league (today's games)
  const now = new Date()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)

  // Find events scheduled today
  const events = await getCollection('events')
    .find(
      { leagueId, startTime: { $gte: dayStart, $lt: dayEnd } },
      { projection: { _id: 0, eventId: 1 } }
    )
    .toArray()

  if (events.length === 0) {
    console.log(`[hit-rates] No events today for ${leagueId}.`)
    return
  }

  const eventIds = events.map((e) => e.eventId)

  const propDocs = await getCollection('player_props')
    .find({ eventId: { $in: eventIds } })
    .toArray()

  if (propDocs.length === 0) {
    console.log(`[hit-rates] No player props found for ${leagueId}.`)
    return
  }

  // Collect all unique (playerId, market, line) combinations
  const computations = new Map() // key: "playerId:market:line" → { playerId, leagueId, market, line }

  for (const doc of propDocs) {
    for (const player of doc.players || []) {
      if (!player.playerId) continue

      for (const marketEntry of player.markets || []) {
        const fields = leagueMarketMap[marketEntry.marketType]
        if (!fields) continue

        for (const lineEntry of marketEntry.lines || []) {
          if (lineEntry.point == null) continue
          const key = `${player.playerId}:${marketEntry.marketType}:${lineEntry.point}`
          if (!computations.has(key)) {
            computations.set(key, {
              playerId: player.playerId,
              leagueId,
              market: marketEntry.marketType,
              line: lineEntry.point,
              fields,
            })
          }
        }
      }
    }
  }

  if (computations.size === 0) {
    console.log(`[hit-rates] No resolved player IDs in props for ${leagueId}.`)
    return
  }

  // Batch-fetch last 25 game stats for all unique playerIds
  const allPlayerIds = [...new Set([...computations.values()].map((c) => c.playerId))]
  const currentSeason = getCurrentSeason(leagueId)

  const allGameStats = await getCollection('player_stats')
    .find(
      { playerId: { $in: allPlayerIds }, statType: 'game' },
      { projection: { _id: 0, playerId: 1, season: 1, gameDate: 1, stats: 1 } }
    )
    .sort({ gameDate: -1 })
    .toArray()

  // Group by playerId
  const statsByPlayer = new Map()
  for (const stat of allGameStats) {
    if (!statsByPlayer.has(stat.playerId)) statsByPlayer.set(stat.playerId, [])
    statsByPlayer.get(stat.playerId).push(stat)
  }

  // Compute and store hit rates
  const ops = []
  const calculatedAt = new Date()

  for (const computation of computations.values()) {
    const games = statsByPlayer.get(computation.playerId) || []
    const hitRates = computeHitRates(games, computation.fields, computation.line, 'over', currentSeason)

    ops.push({
      updateOne: {
        filter: {
          playerId: computation.playerId,
          leagueId: computation.leagueId,
          market: computation.market,
          line: computation.line,
        },
        update: {
          $set: {
            playerId: computation.playerId,
            leagueId: computation.leagueId,
            market: computation.market,
            line: computation.line,
            direction: 'over',
            L5: hitRates.L5,
            L10: hitRates.L10,
            L25: hitRates.L25,
            season: hitRates.season,
            calculatedAt,
          },
        },
        upsert: true,
      },
    })
  }

  if (ops.length > 0) {
    await getCollection('hit_rates').bulkWrite(ops, { ordered: false })
  }

  console.log(`[hit-rates] Computed ${ops.length} hit rate entries for ${leagueId}.`)
}
