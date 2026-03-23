/**
 * Central sport configuration registry.
 * Single source of truth for all sport-specific settings.
 */

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
    },
    teamAbbrs: [
      'atl', 'bos', 'cha', 'chi', 'cle', 'dal', 'den', 'det',
      'gs', 'hou', 'ind', 'lac', 'lal', 'mem', 'mia', 'mil',
      'min', 'nj', 'no', 'ny', 'okc', 'orl', 'phi', 'phx',
      'por', 'sac', 'sa', 'tor', 'utah', 'wsh',
    ],
    season: { startMonth: 9, format: 'split' }, // Oct-Jun → "2025-26"
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
    },
    teamAbbrs: [
      'ari', 'atl', 'bal', 'buf', 'car', 'chi', 'cin', 'cle',
      'dal', 'den', 'det', 'gb', 'hou', 'ind', 'jac', 'kc',
      'lv', 'lac', 'lar', 'mia', 'min', 'ne', 'no', 'nyg',
      'nyj', 'phi', 'pit', 'sf', 'sea', 'tb', 'ten', 'wsh',
    ],
    season: { startMonth: 8, format: 'split' }, // Sep-Feb → "2025-26"
  },

  mlb: {
    leagueId: 'mlb',
    sport: 'baseball',
    name: 'MLB',
    fullName: 'Major League Baseball',
    goalserve: {
      sportCode: 'baseball',
      leaguePrefix: 'mlb',
    },
    oddsApi: {
      sportKey: 'baseball_mlb',
    },
    teamAbbrs: [
      'ari', 'atl', 'bal', 'bos', 'chc', 'cws', 'cin', 'cle',
      'col', 'det', 'hou', 'kc', 'laa', 'lad', 'mia', 'mil',
      'min', 'nym', 'nyy', 'oak', 'phi', 'pit', 'sd', 'sf',
      'sea', 'stl', 'tb', 'tex', 'tor', 'wsh',
    ],
    season: { startMonth: 2, format: 'year' }, // Mar-Oct → "2026"
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
    },
    teamAbbrs: [
      'ana', 'ari', 'bos', 'buf', 'cgy', 'car', 'chi', 'col',
      'cbj', 'dal', 'det', 'edm', 'fla', 'la', 'min', 'mtl',
      'nsh', 'nj', 'nyi', 'nyr', 'ott', 'phi', 'pit', 'sj',
      'sea', 'stl', 'tb', 'tor', 'van', 'vgk', 'wpg', 'wsh',
    ],
    season: { startMonth: 9, format: 'split' }, // Oct-Jun → "2025-26"
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
