/**
 * GoalServe data fetcher.
 * All upstream provider details are internal-only.
 * Base URL pattern: {BASE_URL}/{API_KEY}/{sport}/{endpoint}?json=1
 */

const BASE_URL = () => process.env.DATA_SOURCE_A_BASE_URL
const API_KEY = () => process.env.DATA_SOURCE_A_KEY

async function fetchJSON(sport, endpoint, params = {}) {
  const url = new URL(`${BASE_URL()}/${API_KEY()}/${sport}/${endpoint}`)
  url.searchParams.set('json', '1')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      console.error(`[goalserve] HTTP ${res.status} for ${sport}/${endpoint}`)
      return null
    }
    return await res.json()
  } catch (err) {
    console.error(`[goalserve] Fetch failed for ${sport}/${endpoint}:`, err.message)
    return null
  }
}

// --- Generic endpoints (accept sport config from src/config/sports.js) ---

export function fetchScores(config, date) {
  const params = date ? { date } : {}
  return fetchJSON(config.goalserve.sportCode, `${config.goalserve.leaguePrefix}-scores`, params)
}

export function fetchSchedule(config) {
  return fetchJSON(config.goalserve.sportCode, `${config.goalserve.leaguePrefix}-shedule`) // GoalServe typo
}

export function fetchStandings(config) {
  return fetchJSON(config.goalserve.sportCode, `${config.goalserve.leaguePrefix}-standings`)
}

export function fetchPlayByPlay(config) {
  return fetchJSON(config.goalserve.sportCode, `${config.goalserve.leaguePrefix}-playbyplay`)
}

export function fetchRoster(config, teamAbbr) {
  return fetchJSON(config.goalserve.sportCode, `${teamAbbr}_rosters`)
}

export function fetchInjuries(config, teamAbbr) {
  return fetchJSON(config.goalserve.sportCode, `${teamAbbr}_injuries`)
}

export function fetchStats(config, teamAbbr) {
  return fetchJSON(config.goalserve.sportCode, `${teamAbbr}_stats`)
}
