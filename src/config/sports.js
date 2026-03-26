/**
 * Central sport configuration registry.
 * Single source of truth for all sport-specific settings.
 */

function createPlayerPropMarket(
  key,
  marketName,
  {
    format = 'over_under',
    isAlternate = key.includes('_alternate'),
    supportsPoint = format === 'over_under',
  } = {}
) {
  return {
    key,
    marketName,
    format,
    isAlternate,
    supportsPoint,
  }
}

function overUnderMarket(key, marketName) {
  return createPlayerPropMarket(key, marketName)
}

function yesNoMarket(key, marketName) {
  return createPlayerPropMarket(key, marketName, {
    format: 'yes_no',
    supportsPoint: false,
  })
}

function overOnlyMarket(key, marketName) {
  return createPlayerPropMarket(key, marketName, {
    format: 'over_only',
    supportsPoint: false,
  })
}

function variousMarket(key, marketName) {
  return createPlayerPropMarket(key, marketName, {
    format: 'various',
    supportsPoint: false,
  })
}

const NBA_PLAYER_PROP_MARKETS = [
  overUnderMarket('player_points', 'Points'),
  overUnderMarket('player_points_q1', '1st Quarter Points'),
  overUnderMarket('player_rebounds', 'Rebounds'),
  overUnderMarket('player_rebounds_q1', '1st Quarter Rebounds'),
  overUnderMarket('player_assists', 'Assists'),
  overUnderMarket('player_assists_q1', '1st Quarter Assists'),
  overUnderMarket('player_threes', 'Threes'),
  overUnderMarket('player_blocks', 'Blocks'),
  overUnderMarket('player_steals', 'Steals'),
  overUnderMarket('player_blocks_steals', 'Blocks + Steals'),
  overUnderMarket('player_turnovers', 'Turnovers'),
  overUnderMarket('player_points_rebounds_assists', 'Points + Rebounds + Assists'),
  overUnderMarket('player_points_rebounds', 'Points + Rebounds'),
  overUnderMarket('player_points_assists', 'Points + Assists'),
  overUnderMarket('player_rebounds_assists', 'Rebounds + Assists'),
  overUnderMarket('player_field_goals', 'Field Goals'),
  overUnderMarket('player_frees_made', 'Free Throws Made'),
  overUnderMarket('player_frees_attempts', 'Free Throws Attempted'),
  yesNoMarket('player_first_basket', 'First Basket Scorer'),
  yesNoMarket('player_first_team_basket', 'First Team Basket Scorer'),
  yesNoMarket('player_double_double', 'Double Double'),
  yesNoMarket('player_triple_double', 'Triple Double'),
  variousMarket('player_method_of_first_basket', 'Method of First Basket'),
  overUnderMarket('player_fantasy_points', 'Fantasy Points'),
  overUnderMarket('player_points_alternate', 'Alternate Points'),
  overUnderMarket('player_rebounds_alternate', 'Alternate Rebounds'),
  overUnderMarket('player_assists_alternate', 'Alternate Assists'),
  overUnderMarket('player_blocks_alternate', 'Alternate Blocks'),
  overUnderMarket('player_steals_alternate', 'Alternate Steals'),
  overUnderMarket('player_turnovers_alternate', 'Alternate Turnovers'),
  overUnderMarket('player_threes_alternate', 'Alternate Threes'),
  overUnderMarket('player_points_assists_alternate', 'Alternate Points + Assists'),
  overUnderMarket('player_points_rebounds_alternate', 'Alternate Points + Rebounds'),
  overUnderMarket('player_rebounds_assists_alternate', 'Alternate Rebounds + Assists'),
  overUnderMarket('player_points_rebounds_assists_alternate', 'Alternate Points + Rebounds + Assists'),
  overUnderMarket('player_fantasy_points_alternate', 'Alternate Fantasy Points'),
]

const NFL_PLAYER_PROP_MARKETS = [
  overUnderMarket('player_assists', 'Assists'),
  overUnderMarket('player_defensive_interceptions', 'Defensive Interceptions'),
  overUnderMarket('player_field_goals', 'Field Goals'),
  overUnderMarket('player_kicking_points', 'Kicking Points'),
  overUnderMarket('player_pass_attempts', 'Pass Attempts'),
  overUnderMarket('player_pass_completions', 'Pass Completions'),
  overUnderMarket('player_pass_interceptions', 'Pass Interceptions'),
  overUnderMarket('player_pass_longest_completion', 'Longest Pass Completion'),
  overUnderMarket('player_pass_rush_yds', 'Pass + Rush Yards'),
  overUnderMarket('player_pass_rush_reception_tds', 'Pass + Rush + Reception Touchdowns'),
  overUnderMarket('player_pass_rush_reception_yds', 'Pass + Rush + Reception Yards'),
  overUnderMarket('player_pass_tds', 'Pass Touchdowns'),
  overUnderMarket('player_pass_yds', 'Pass Yards'),
  overUnderMarket('player_pass_yds_q1', '1st Quarter Pass Yards'),
  overUnderMarket('player_pats', 'Points After Touchdown'),
  overUnderMarket('player_receptions', 'Receptions'),
  overUnderMarket('player_reception_longest', 'Longest Reception'),
  overUnderMarket('player_reception_tds', 'Reception Touchdowns'),
  overUnderMarket('player_reception_yds', 'Reception Yards'),
  overUnderMarket('player_rush_attempts', 'Rush Attempts'),
  overUnderMarket('player_rush_longest', 'Longest Rush'),
  overUnderMarket('player_rush_reception_tds', 'Rush + Reception Touchdowns'),
  overUnderMarket('player_rush_reception_yds', 'Rush + Reception Yards'),
  overUnderMarket('player_rush_tds', 'Rush Touchdowns'),
  overUnderMarket('player_rush_yds', 'Rush Yards'),
  overUnderMarket('player_sacks', 'Sacks'),
  overUnderMarket('player_solo_tackles', 'Solo Tackles'),
  overUnderMarket('player_tackles_assists', 'Tackles + Assists'),
  overOnlyMarket('player_tds_over', 'Touchdowns'),
  yesNoMarket('player_1st_td', '1st Touchdown Scorer'),
  yesNoMarket('player_anytime_td', 'Anytime Touchdown Scorer'),
  yesNoMarket('player_last_td', 'Last Touchdown Scorer'),
  overUnderMarket('player_assists_alternate', 'Alternate Assists'),
  overUnderMarket('player_field_goals_alternate', 'Alternate Field Goals'),
  overUnderMarket('player_kicking_points_alternate', 'Alternate Kicking Points'),
  overUnderMarket('player_pass_attempts_alternate', 'Alternate Pass Attempts'),
  overUnderMarket('player_pass_completions_alternate', 'Alternate Pass Completions'),
  overUnderMarket('player_pass_interceptions_alternate', 'Alternate Pass Interceptions'),
  overUnderMarket('player_pass_longest_completion_alternate', 'Alternate Longest Pass Completion'),
  overUnderMarket('player_pass_rush_yds_alternate', 'Alternate Pass + Rush Yards'),
  overUnderMarket('player_pass_rush_reception_tds_alternate', 'Alternate Pass + Rush + Reception Touchdowns'),
  overUnderMarket('player_pass_rush_reception_yds_alternate', 'Alternate Pass + Rush + Reception Yards'),
  overUnderMarket('player_pass_tds_alternate', 'Alternate Pass Touchdowns'),
  overUnderMarket('player_pass_yds_alternate', 'Alternate Pass Yards'),
  overUnderMarket('player_pats_alternate', 'Alternate Points After Touchdown'),
  overUnderMarket('player_receptions_alternate', 'Alternate Receptions'),
  overUnderMarket('player_reception_longest_alternate', 'Alternate Longest Reception'),
  overUnderMarket('player_reception_tds_alternate', 'Alternate Reception Touchdowns'),
  overUnderMarket('player_reception_yds_alternate', 'Alternate Reception Yards'),
  overUnderMarket('player_rush_attempts_alternate', 'Alternate Rush Attempts'),
  overUnderMarket('player_rush_longest_alternate', 'Alternate Longest Rush'),
  overUnderMarket('player_rush_reception_tds_alternate', 'Alternate Rush + Reception Touchdowns'),
  overUnderMarket('player_rush_reception_yds_alternate', 'Alternate Rush + Reception Yards'),
  overUnderMarket('player_rush_tds_alternate', 'Alternate Rush Touchdowns'),
  overUnderMarket('player_rush_yds_alternate', 'Alternate Rush Yards'),
  overUnderMarket('player_sacks_alternate', 'Alternate Sacks'),
  overUnderMarket('player_solo_tackles_alternate', 'Alternate Solo Tackles'),
  overUnderMarket('player_tackles_assists_alternate', 'Alternate Tackles + Assists'),
]

const MLB_PLAYER_PROP_MARKETS = [
  overUnderMarket('batter_home_runs', 'Batter Home Runs'),
  yesNoMarket('batter_first_home_run', 'Batter First Home Run'),
  overUnderMarket('batter_hits', 'Batter Hits'),
  overUnderMarket('batter_total_bases', 'Batter Total Bases'),
  overUnderMarket('batter_rbis', 'Batter RBIs'),
  overUnderMarket('batter_runs_scored', 'Batter Runs Scored'),
  overUnderMarket('batter_hits_runs_rbis', 'Batter Hits + Runs + RBIs'),
  overUnderMarket('batter_singles', 'Batter Singles'),
  overUnderMarket('batter_doubles', 'Batter Doubles'),
  overUnderMarket('batter_triples', 'Batter Triples'),
  overUnderMarket('batter_walks', 'Batter Walks'),
  overUnderMarket('batter_strikeouts', 'Batter Strikeouts'),
  overUnderMarket('batter_stolen_bases', 'Batter Stolen Bases'),
  overUnderMarket('pitcher_strikeouts', 'Pitcher Strikeouts'),
  yesNoMarket('pitcher_record_a_win', 'Pitcher To Record A Win'),
  overUnderMarket('pitcher_hits_allowed', 'Pitcher Hits Allowed'),
  overUnderMarket('pitcher_walks', 'Pitcher Walks'),
  overUnderMarket('pitcher_earned_runs', 'Pitcher Earned Runs'),
  overUnderMarket('pitcher_outs', 'Pitcher Outs'),
  overUnderMarket('batter_total_bases_alternate', 'Alternate Batter Total Bases'),
  overUnderMarket('batter_home_runs_alternate', 'Alternate Batter Home Runs'),
  overUnderMarket('batter_hits_alternate', 'Alternate Batter Hits'),
  overUnderMarket('batter_rbis_alternate', 'Alternate Batter RBIs'),
  overUnderMarket('batter_walks_alternate', 'Alternate Batter Walks'),
  overUnderMarket('batter_strikeouts_alternate', 'Alternate Batter Strikeouts'),
  overUnderMarket('batter_runs_scored_alternate', 'Alternate Batter Runs Scored'),
  overUnderMarket('batter_singles_alternate', 'Alternate Batter Singles'),
  overUnderMarket('batter_doubles_alternate', 'Alternate Batter Doubles'),
  overUnderMarket('batter_triples_alternate', 'Alternate Batter Triples'),
  overUnderMarket('pitcher_hits_allowed_alternate', 'Alternate Pitcher Hits Allowed'),
  overUnderMarket('pitcher_walks_alternate', 'Alternate Pitcher Walks'),
  overUnderMarket('pitcher_strikeouts_alternate', 'Alternate Pitcher Strikeouts'),
]

const NHL_PLAYER_PROP_MARKETS = [
  overUnderMarket('player_points', 'Points'),
  overUnderMarket('player_power_play_points', 'Power Play Points'),
  overUnderMarket('player_assists', 'Assists'),
  overUnderMarket('player_blocked_shots', 'Blocked Shots'),
  overUnderMarket('player_shots_on_goal', 'Shots On Goal'),
  overUnderMarket('player_goals', 'Goals'),
  overUnderMarket('player_total_saves', 'Total Saves'),
  yesNoMarket('player_goal_scorer_first', 'First Goal Scorer'),
  yesNoMarket('player_goal_scorer_last', 'Last Goal Scorer'),
  yesNoMarket('player_goal_scorer_anytime', 'Anytime Goal Scorer'),
  overUnderMarket('player_points_alternate', 'Alternate Points'),
  overUnderMarket('player_assists_alternate', 'Alternate Assists'),
  overUnderMarket('player_power_play_points_alternate', 'Alternate Power Play Points'),
  overUnderMarket('player_goals_alternate', 'Alternate Goals'),
  overUnderMarket('player_shots_on_goal_alternate', 'Alternate Shots On Goal'),
  overUnderMarket('player_blocked_shots_alternate', 'Alternate Blocked Shots'),
  overUnderMarket('player_total_saves_alternate', 'Alternate Total Saves'),
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
    // GoalServe MLB abbreviations (some differ from standard team codes)
    teamAbbrs: [
      'ari', 'atl', 'bal', 'bos', 'chc', 'chw', 'cin', 'cle',
      'col', 'det', 'hou', 'kan', 'laa', 'lad', 'fla', 'mil',
      'min', 'nym', 'nyy', 'oak', 'phi', 'pit', 'sdg', 'sfo',
      'sea', 'stl', 'tam', 'tex', 'tor', 'was',
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
      'ana', 'phx', 'bos', 'buf', 'cgy', 'car', 'chi', 'col',
      'cbj', 'dal', 'det', 'edm', 'fla', 'la', 'min', 'mtl',
      'nsh', 'nj', 'nyi', 'nyr', 'ott', 'phi', 'pit', 'sj',
      'sea', 'stl', 'tb', 'tor', 'van', 'vgs', 'atl', 'wsh',
    ],
    season: { startMonth: 9, endMonth: 5, format: 'split' }, // Oct-Jun → "2025-26"
  },
}

export function getSportConfig(leagueId) {
  const config = SPORTS[leagueId]
  if (!config) throw new Error(`Unknown league: ${leagueId}`)
  return config
}

export function getPlayerPropMarkets(leagueId) {
  return getSportConfig(leagueId).oddsApi?.playerPropMarkets || []
}

export function getPlayerPropMarketKeys(leagueId) {
  return getPlayerPropMarkets(leagueId).map((market) => market.key)
}

export function getPlayerPropMarketDefinition(leagueId, marketKey) {
  return getPlayerPropMarkets(leagueId).find((market) => market.key === marketKey) || null
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
