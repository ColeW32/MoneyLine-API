/**
 * GoalServe data fetcher.
 * All upstream provider details are internal-only.
 * Base URL pattern: {BASE_URL}/{API_KEY}/{sport}/{endpoint}?json=1
 */

const BASE_URL = () => process.env.DATA_SOURCE_A_BASE_URL
const API_KEY = () => process.env.DATA_SOURCE_A_KEY

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJSON(sport, endpoint, params = {}, options = {}) {
  const {
    retries = 0,
    tolerateMissing = false,
  } = options
  const url = new URL(`${BASE_URL()}/${API_KEY()}/${sport}/${endpoint}`)
  url.searchParams.set('json', '1')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) {
        if (attempt < retries && res.status >= 500) {
          await sleep(500 * (attempt + 1))
          continue
        }

        const dateSuffix = params.date ? ` on ${params.date}` : ''
        if (tolerateMissing && params.date) {
          console.log(`[goalserve] No score payload for ${sport}/${endpoint}${dateSuffix} (HTTP ${res.status})`)
        } else {
          console.error(`[goalserve] HTTP ${res.status} for ${sport}/${endpoint}`)
        }
        return null
      }
      return await res.json()
    } catch (err) {
      if (attempt < retries) {
        await sleep(500 * (attempt + 1))
        continue
      }

      if (tolerateMissing && params.date) {
        console.log(`[goalserve] No score payload for ${sport}/${endpoint} on ${params.date}: ${err.message}`)
      } else {
        console.error(`[goalserve] Fetch failed for ${sport}/${endpoint}:`, err.message)
      }
      return null
    }
  }
}

// --- Generic endpoints (accept sport config from src/config/sports.js) ---

export function fetchScores(config, date, options = {}) {
  const params = date ? { date } : {}
  const endpoint = config.goalserve.scoreEndpoint || `${config.goalserve.leaguePrefix}-scores`
  return fetchJSON(config.goalserve.sportCode, endpoint, params, options)
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
