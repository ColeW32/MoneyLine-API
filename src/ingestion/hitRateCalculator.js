import { getCollection } from '../db.js'
import { getCurrentSeason } from '../config/sports.js'

const HIT_RATE_SCHEMA_VERSION = 2

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
    player_points:                            ['points'],
    player_rebounds:                          ['total_rebounds'],
    player_assists:                           ['assists'],
    player_blocks:                            ['blocks'],
    player_steals:                            ['steals'],
    player_turnovers:                         ['turnovers'],
    player_threes:                            ['threepoint_goals_made'],
    player_field_goals:                       ['field_goals_made'],
    player_frees_made:                        ['freethrows_goals_made'],
    player_frees_attempts:                    ['freethrows_goals_attempts'],
    player_blocks_steals:                     ['blocks', 'steals'],
    player_points_rebounds:                   ['points', 'total_rebounds'],
    player_points_assists:                    ['points', 'assists'],
    player_rebounds_assists:                  ['total_rebounds', 'assists'],
    player_points_rebounds_assists:           ['points', 'total_rebounds', 'assists'],
    player_points_alternate:                  ['points'],
    player_rebounds_alternate:                ['total_rebounds'],
    player_assists_alternate:                 ['assists'],
    player_blocks_alternate:                  ['blocks'],
    player_steals_alternate:                  ['steals'],
    player_turnovers_alternate:               ['turnovers'],
    player_threes_alternate:                  ['threepoint_goals_made'],
    player_points_rebounds_alternate:         ['points', 'total_rebounds'],
    player_points_assists_alternate:          ['points', 'assists'],
    player_rebounds_assists_alternate:        ['total_rebounds', 'assists'],
    player_points_rebounds_assists_alternate: ['points', 'total_rebounds', 'assists'],
  },
  nhl: {
    player_shots_on_goal:                 ['skater.shots_on_goal'],
    player_goals:                         ['skater.goals'],
    player_assists:                       ['skater.assists'],
    player_points:                        ['skater.goals', 'skater.assists'],
    player_blocked_shots:                 ['skater.blocked_shots'],
    player_power_play_points:             ['skater.pp_goals', 'skater.pp_assists'],
    player_total_saves:                   ['goalkeeping.saves'],
    // Yes/no markets: hit = player achieved stat > 0 (use line=0)
    player_goal_scorer_anytime:           ['skater.goals'],
    player_shots_on_goal_alternate:       ['skater.shots_on_goal'],
    player_goals_alternate:               ['skater.goals'],
    player_points_alternate:              ['skater.goals', 'skater.assists'],
    player_assists_alternate:             ['skater.assists'],
    player_power_play_points_alternate:   ['skater.pp_goals', 'skater.pp_assists'],
    player_blocked_shots_alternate:       ['skater.blocked_shots'],
    player_total_saves_alternate:         ['goalkeeping.saves'],
  },
  mlb: {
    batter_hits:                        ['hitting.hits'],
    batter_home_runs:                   ['hitting.home_runs'],
    batter_hits_runs_rbis:              ['hitting.hits', 'hitting.runs', 'hitting.runs_batted_in'],
    batter_runs_scored:                 ['hitting.runs'],
    batter_rbis:                        ['hitting.runs_batted_in'],
    batter_total_bases:                 ['hitting.total_bases'],
    batter_singles:                     ['hitting.singles'],
    batter_doubles:                     ['hitting.doubles'],
    batter_triples:                     ['hitting.triples'],
    batter_walks:                       ['hitting.walks'],
    batter_strikeouts:                  ['hitting.strikeouts'],
    batter_stolen_bases:                ['hitting.stolen_bases'],
    pitcher_strikeouts:                 ['pitching.strikeouts'],
    pitcher_hits_allowed:               ['pitching.hits'],
    pitcher_walks:                      ['pitching.walks'],
    pitcher_earned_runs:                ['pitching.earned_runs'],
    pitcher_outs:                       ['pitching.outs_recorded'],
    batter_total_bases_alternate:       ['hitting.total_bases'],
    batter_home_runs_alternate:         ['hitting.home_runs'],
    batter_hits_alternate:              ['hitting.hits'],
    batter_rbis_alternate:              ['hitting.runs_batted_in'],
    batter_walks_alternate:             ['hitting.walks'],
    batter_strikeouts_alternate:        ['hitting.strikeouts'],
    batter_runs_scored_alternate:       ['hitting.runs'],
    batter_singles_alternate:           ['hitting.singles'],
    batter_doubles_alternate:           ['hitting.doubles'],
    batter_triples_alternate:           ['hitting.triples'],
    pitcher_hits_allowed_alternate:     ['pitching.hits'],
    pitcher_walks_alternate:            ['pitching.walks'],
    pitcher_strikeouts_alternate:       ['pitching.strikeouts'],
  },
  nfl: {
    player_pass_yds:               ['passing.yards'],
    player_pass_tds:               ['passing.passing_touch_downs'],
    player_pass_completions:       ['passing.comp_att.completions'],
    player_pass_attempts:          ['passing.comp_att.attempts'],
    player_pass_interceptions:     ['passing.interceptions'],
    player_pass_longest_completion:['passing.longest_pass'],
    player_receptions:             ['receiving.total_receptions'],
    player_reception_yds:          ['receiving.yards'],
    player_reception_tds:          ['receiving.receiving_touch_downs'],
    player_reception_longest:      ['receiving.longest_reception'],
    player_rush_yds:               ['rushing.yards'],
    player_rush_attempts:          ['rushing.total_rushes'],
    player_rush_tds:               ['rushing.rushing_touch_downs'],
    player_rush_longest:           ['rushing.longest_rush'],
    player_pass_rush_yds:          ['passing.yards', 'rushing.yards'],
    player_pass_rush_reception_yds:['passing.yards', 'rushing.yards', 'receiving.yards'],
    player_pass_rush_reception_tds:['passing.passing_touch_downs', 'rushing.rushing_touch_downs', 'receiving.receiving_touch_downs'],
    player_rush_reception_yds:     ['rushing.yards', 'receiving.yards'],
    player_rush_reception_tds:     ['rushing.rushing_touch_downs', 'receiving.receiving_touch_downs'],
    player_sacks:                  ['defensive.sacks.count', 'passing.sacks.count'],
    player_solo_tackles:           ['defensive.tackles'],
    player_tackles_assists:        ['defensive.tackles', 'defensive.assists'],
    // Yes/no and over_only markets: hit = player scored any TD (> 0)
    player_anytime_td:             ['rushing.rushing_touch_downs', 'receiving.receiving_touch_downs', 'passing.passing_touch_downs'],
    player_tds_over:               ['rushing.rushing_touch_downs', 'receiving.receiving_touch_downs', 'passing.passing_touch_downs'],
    player_pass_yds_alternate:     ['passing.yards'],
    player_pass_tds_alternate:     ['passing.passing_touch_downs'],
    player_pass_attempts_alternate:['passing.comp_att.attempts'],
    player_pass_completions_alternate: ['passing.comp_att.completions'],
    player_pass_interceptions_alternate: ['passing.interceptions'],
    player_pass_longest_completion_alternate: ['passing.longest_pass'],
    player_pass_rush_yds_alternate: ['passing.yards', 'rushing.yards'],
    player_pass_rush_reception_yds_alternate: ['passing.yards', 'rushing.yards', 'receiving.yards'],
    player_pass_rush_reception_tds_alternate: ['passing.passing_touch_downs', 'rushing.rushing_touch_downs', 'receiving.receiving_touch_downs'],
    player_receptions_alternate:   ['receiving.total_receptions'],
    player_reception_yds_alternate:['receiving.yards'],
    player_reception_tds_alternate:['receiving.receiving_touch_downs'],
    player_reception_longest_alternate: ['receiving.longest_reception'],
    player_rush_yds_alternate:     ['rushing.yards'],
    player_rush_attempts_alternate:['rushing.total_rushes'],
    player_rush_tds_alternate:     ['rushing.rushing_touch_downs'],
    player_rush_longest_alternate: ['rushing.longest_rush'],
    player_rush_reception_yds_alternate: ['rushing.yards', 'receiving.yards'],
    player_rush_reception_tds_alternate: ['rushing.rushing_touch_downs', 'receiving.receiving_touch_downs'],
    player_sacks_alternate:        ['defensive.sacks.count', 'passing.sacks.count'],
    player_solo_tackles_alternate: ['defensive.tackles'],
    player_tackles_assists_alternate: ['defensive.tackles', 'defensive.assists'],
  },
}

/**
 * Markets where hit-rate computation is not possible from boxscore totals because
 * they depend on in-game ordering (first/last event) or proprietary scoring formulas.
 * getStatFields() returns null for these, but callers should use isHitRateComputable()
 * to distinguish "not computable" from "not yet mapped".
 */
export const UNCOMPUTABLE_MARKETS = {
  nba: new Set([
    'player_first_basket',
    'player_first_team_basket',
    'player_method_of_first_basket',
    'player_double_double',
    'player_triple_double',
    'player_fantasy_points',
    'player_fantasy_points_alternate',
  ]),
  nhl: new Set([
    'player_goal_scorer_first',
    'player_goal_scorer_last',
  ]),
  nfl: new Set([
    'player_1st_td',
    'player_last_td',
  ]),
  mlb: new Set([
    'batter_first_home_run',
    'pitcher_record_a_win',
  ]),
}

/**
 * Returns false if the market is explicitly known to be uncomputable from boxscore
 * data (e.g. first-scorer, last-scorer, fantasy points). Returns true if the market
 * has a stat mapping OR is simply not yet mapped (unknown market).
 */
export function isHitRateComputable(leagueId, market) {
  return !UNCOMPUTABLE_MARKETS[leagueId]?.has(market)
}

/**
 * Get the stat fields for a market in a league. Returns null if not mapped.
 */
export function getStatFields(leagueId, market) {
  return MARKET_TO_STAT_FIELDS[leagueId]?.[market] ?? null
}

export function getHitRateSchemaVersion() {
  return HIT_RATE_SCHEMA_VERSION
}

/**
 * Sum the specified stat fields from a game's stats object.
 * Returns null if none of the fields are present.
 */
function readNestedStat(stats, field) {
  if (!stats || !field) return null

  if (field === 'hitting.singles') {
    const hits = readNestedStat(stats, 'hitting.hits')
    const doubles = readNestedStat(stats, 'hitting.doubles') || 0
    const triples = readNestedStat(stats, 'hitting.triples') || 0
    const homeRuns = readNestedStat(stats, 'hitting.home_runs') || 0
    return hits == null ? null : Math.max(0, hits - doubles - triples - homeRuns)
  }

  if (field === 'hitting.total_bases') {
    const singles = readNestedStat(stats, 'hitting.singles')
    const doubles = readNestedStat(stats, 'hitting.doubles') || 0
    const triples = readNestedStat(stats, 'hitting.triples') || 0
    const homeRuns = readNestedStat(stats, 'hitting.home_runs') || 0
    return singles == null ? null : singles + (2 * doubles) + (3 * triples) + (4 * homeRuns)
  }

  if (field === 'pitching.outs_recorded') {
    const innings = readNestedStat(stats, 'pitching.innings_pitched')
    if (innings == null) return null
    const whole = Math.trunc(innings)
    const fractional = Math.round((innings - whole) * 10)
    return (whole * 3) + fractional
  }

  const segments = String(field).split('.')
  let value = stats
  for (const segment of segments) {
    if (value == null || typeof value !== 'object') return null
    value = value[segment]
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function sumStatFieldsForGame(stats, fields) {
  if (!stats || !fields?.length) return null

  let total = 0
  let found = false
  for (const field of fields) {
    const val = String(field).includes('.')
      ? readNestedStat(stats, field)
      : (typeof stats[field] === 'number' && Number.isFinite(stats[field]) ? stats[field] : null)
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
      const val = sumStatFieldsForGame(game.stats, fields)
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
      const val = sumStatFieldsForGame(game.stats, fields)
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
          // Yes/no markets (e.g. player_goal_scorer_anytime) have point=null.
          // Treat them as line=0: hit = stat > 0 (did the player achieve the outcome).
          const effectiveLine = lineEntry.point ?? 0
          const key = `${player.playerId}:${marketEntry.marketType}:${effectiveLine}`
          if (!computations.has(key)) {
            computations.set(key, {
              playerId: player.playerId,
              leagueId,
              market: marketEntry.marketType,
              line: effectiveLine,
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
            schemaVersion: HIT_RATE_SCHEMA_VERSION,
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
