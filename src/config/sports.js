/**
 * Central sport configuration registry.
 * Single source of truth for all sport-specific settings.
 */

const NBA_PLAYER_PROP_MARKETS = [
  'player_points',
  'player_points_q1',
  'player_rebounds',
  'player_rebounds_q1',
  'player_assists',
  'player_assists_q1',
  'player_threes',
  'player_blocks',
  'player_steals',
  'player_blocks_steals',
  'player_turnovers',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_rebounds_assists',
  'player_field_goals',
  'player_frees_made',
  'player_frees_attempts',
  'player_first_basket',
  'player_first_team_basket',
  'player_double_double',
  'player_triple_double',
  'player_method_of_first_basket',
  'player_fantasy_points',
  'player_points_alternate',
  'player_rebounds_alternate',
  'player_assists_alternate',
  'player_blocks_alternate',
  'player_steals_alternate',
  'player_turnovers_alternate',
  'player_threes_alternate',
  'player_points_assists_alternate',
  'player_points_rebounds_alternate',
  'player_rebounds_assists_alternate',
  'player_points_rebounds_assists_alternate',
  'player_fantasy_points_alternate',
]

const NFL_PLAYER_PROP_MARKETS = [
  'player_assists',
  'player_defensive_interceptions',
  'player_field_goals',
  'player_kicking_points',
  'player_pass_attempts',
  'player_pass_completions',
  'player_pass_interceptions',
  'player_pass_longest_completion',
  'player_pass_rush_yds',
  'player_pass_rush_reception_tds',
  'player_pass_rush_reception_yds',
  'player_pass_tds',
  'player_pass_yds',
  'player_pass_yds_q1',
  'player_pats',
  'player_receptions',
  'player_reception_longest',
  'player_reception_tds',
  'player_reception_yds',
  'player_rush_attempts',
  'player_rush_longest',
  'player_rush_reception_tds',
  'player_rush_reception_yds',
  'player_rush_tds',
  'player_rush_yds',
  'player_sacks',
  'player_solo_tackles',
  'player_tackles_assists',
  'player_tds_over',
  'player_1st_td',
  'player_anytime_td',
  'player_last_td',
  'player_assists_alternate',
  'player_field_goals_alternate',
  'player_kicking_points_alternate',
  'player_pass_attempts_alternate',
  'player_pass_completions_alternate',
  'player_pass_interceptions_alternate',
  'player_pass_longest_completion_alternate',
  'player_pass_rush_yds_alternate',
  'player_pass_rush_reception_tds_alternate',
  'player_pass_rush_reception_yds_alternate',
  'player_pass_tds_alternate',
  'player_pass_yds_alternate',
  'player_pats_alternate',
  'player_receptions_alternate',
  'player_reception_longest_alternate',
  'player_reception_tds_alternate',
  'player_reception_yds_alternate',
  'player_rush_attempts_alternate',
  'player_rush_longest_alternate',
  'player_rush_reception_tds_alternate',
  'player_rush_reception_yds_alternate',
  'player_rush_tds_alternate',
  'player_rush_yds_alternate',
  'player_sacks_alternate',
  'player_solo_tackles_alternate',
  'player_tackles_assists_alternate',
]

const MLB_PLAYER_PROP_MARKETS = [
  'batter_home_runs',
  'batter_first_home_run',
  'batter_hits',
  'batter_total_bases',
  'batter_rbis',
  'batter_runs_scored',
  'batter_hits_runs_rbis',
  'batter_singles',
  'batter_doubles',
  'batter_triples',
  'batter_walks',
  'batter_strikeouts',
  'batter_stolen_bases',
  'pitcher_strikeouts',
  'pitcher_record_a_win',
  'pitcher_hits_allowed',
  'pitcher_walks',
  'pitcher_earned_runs',
  'pitcher_outs',
  'batter_total_bases_alternate',
  'batter_home_runs_alternate',
  'batter_hits_alternate',
  'batter_rbis_alternate',
  'batter_walks_alternate',
  'batter_strikeouts_alternate',
  'batter_runs_scored_alternate',
  'batter_singles_alternate',
  'batter_doubles_alternate',
  'batter_triples_alternate',
  'pitcher_hits_allowed_alternate',
  'pitcher_walks_alternate',
  'pitcher_strikeouts_alternate',
]

const NHL_PLAYER_PROP_MARKETS = [
  'player_points',
  'player_power_play_points',
  'player_assists',
  'player_blocked_shots',
  'player_shots_on_goal',
  'player_goals',
  'player_total_saves',
  'player_goal_scorer_first',
  'player_goal_scorer_last',
  'player_goal_scorer_anytime',
  'player_points_alternate',
  'player_assists_alternate',
  'player_power_play_points_alternate',
  'player_goals_alternate',
  'player_shots_on_goal_alternate',
  'player_blocked_shots_alternate',
  'player_total_saves_alternate',
]

export const SPORTS = {
  nba: {
    leagueId: 'nba',
    sport: 'basketball',
    name: 'NBA',
    fullName: 'National Basketball Association',
    goalserve: {
      sportCode: 'bsktbl',
      leaguePrefix: 'nba',
    },
    oddsApi: {
      sportKey: 'basketball_nba',
      featuredMarkets: ['h2h', 'spreads', 'totals'],
      playerPropMarkets: NBA_PLAYER_PROP_MARKETS,
    },
    teamAbbrs: [
      'atl', 'bos', 'cha', 'chi', 'cle', 'dal', 'den', 'det',
      'gs', 'hou', 'ind', 'lac', 'lal', 'mem', 'mia', 'mil',
      'min', 'nj', 'no', 'ny', 'okc', 'orl', 'phi', 'phx',
      'por', 'sac', 'sa', 'tor', 'utah', 'wsh',
    ],
    season: { startMonth: 9, endMonth: 5, format: 'split' }, // Oct-Jun → "2025-26"
  },

  nfl: {
    leagueId: 'nfl',
    sport: 'football',
    name: 'NFL',
    fullName: 'National Football League',
    goalserve: {
      sportCode: 'football',
      leaguePrefix: 'nfl',
    },
    oddsApi: {
      sportKey: 'americanfootball_nfl',
      featuredMarkets: ['h2h', 'spreads', 'totals'],
      playerPropMarkets: NFL_PLAYER_PROP_MARKETS,
    },
    teamAbbrs: [
      'ari', 'atl', 'bal', 'buf', 'car', 'chi', 'cin', 'cle',
      'dal', 'den', 'det', 'gb', 'hou', 'ind', 'jac', 'kc',
      'lv', 'lac', 'lar', 'mia', 'min', 'ne', 'no', 'nyg',
      'nyj', 'phi', 'pit', 'sf', 'sea', 'tb', 'ten', 'wsh',
    ],
    season: { startMonth: 8, endMonth: 1, format: 'split' }, // Sep-Feb → "2025-26"
  },

  mlb: {
    leagueId: 'mlb',
    sport: 'baseball',
    name: 'MLB',
    fullName: 'Major League Baseball',
    goalserve: {
      sportCode: 'baseball',
      leaguePrefix: 'mlb',
      scoreEndpoint: 'usa',
    },
    oddsApi: {
      sportKey: 'baseball_mlb',
      featuredMarkets: ['h2h', 'spreads', 'totals'],
      playerPropMarkets: MLB_PLAYER_PROP_MARKETS,
    },
    teamAbbrs: [
      'ari', 'atl', 'bal', 'bos', 'chc', 'cws', 'cin', 'cle',
      'col', 'det', 'hou', 'kc', 'laa', 'lad', 'mia', 'mil',
      'min', 'nym', 'nyy', 'oak', 'phi', 'pit', 'sd', 'sf',
      'sea', 'stl', 'tb', 'tex', 'tor', 'wsh',
    ],
    season: { startMonth: 2, endMonth: 9, format: 'year' }, // Mar-Oct → "2026"
  },

  nhl: {
    leagueId: 'nhl',
    sport: 'hockey',
    name: 'NHL',
    fullName: 'National Hockey League',
    goalserve: {
      sportCode: 'hockey',
      leaguePrefix: 'nhl',
    },
    oddsApi: {
      sportKey: 'icehockey_nhl',
      featuredMarkets: ['h2h', 'spreads', 'totals'],
      playerPropMarkets: NHL_PLAYER_PROP_MARKETS,
    },
    teamAbbrs: [
      'ana', 'ari', 'bos', 'buf', 'cgy', 'car', 'chi', 'col',
      'cbj', 'dal', 'det', 'edm', 'fla', 'la', 'min', 'mtl',
      'nsh', 'nj', 'nyi', 'nyr', 'ott', 'phi', 'pit', 'sj',
      'sea', 'stl', 'tb', 'tor', 'van', 'vgk', 'wpg', 'wsh',
    ],
    season: { startMonth: 9, endMonth: 5, format: 'split' }, // Oct-Jun → "2025-26"
  },
}

export function getSportConfig(leagueId) {
  const config = SPORTS[leagueId]
  if (!config) throw new Error(`Unknown league: ${leagueId}`)
  return config
}

export function getAllLeagueIds() {
  return Object.keys(SPORTS)
}

export function getCurrentSeason(leagueId) {
  return getSeasonForDate(leagueId, new Date())
}

export function getSeasonForDate(leagueId, dateInput) {
  const config = SPORTS[leagueId]
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() // 0-indexed

  if (config.season.format === 'year') {
    // Single calendar year (MLB)
    return String(year)
  }

  // Split season (NBA, NFL, NHL): if before startMonth, it's previous year's season
  if (month < config.season.startMonth) {
    return `${year - 1}-${String(year).slice(2)}`
  }
  return `${year}-${String(year + 1).slice(2)}`
}

export function getSeasonStartDate(leagueId, season = getCurrentSeason(leagueId)) {
  const config = SPORTS[leagueId]

  if (config.season.format === 'year') {
    return new Date(Date.UTC(Number(season), config.season.startMonth, 1))
  }

  const [startYear] = String(season).split('-')
  return new Date(Date.UTC(Number(startYear), config.season.startMonth, 1))
}

export function getSeasonEndDate(leagueId, season = getCurrentSeason(leagueId)) {
  const config = SPORTS[leagueId]

  if (config.season.format === 'year') {
    return new Date(Date.UTC(Number(season), config.season.endMonth + 1, 0))
  }

  const [startYear] = String(season).split('-')
  return new Date(Date.UTC(Number(startYear) + 1, config.season.endMonth + 1, 0))
}

export function getPreviousSeason(leagueId, season = getCurrentSeason(leagueId)) {
  const config = SPORTS[leagueId]

  if (config.season.format === 'year') {
    return String(Number(season) - 1)
  }

  const [startYear] = String(season).split('-')
  const previousStartYear = Number(startYear) - 1
  return `${previousStartYear}-${String(previousStartYear + 1).slice(2)}`
}
