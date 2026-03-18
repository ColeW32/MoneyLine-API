/**
 * The Odds API fetcher.
 * All upstream provider details are internal-only.
 * Docs: https://the-odds-api.com/liveapi/guides/v4/
 */

const BASE_URL = () => process.env.DATA_SOURCE_B_BASE_URL || 'https://api.the-odds-api.com'
const API_KEY = () => process.env.DATA_SOURCE_B_KEY

async function fetchJSON(path, params = {}) {
  const url = new URL(`${BASE_URL()}${path}`)
  url.searchParams.set('apiKey', API_KEY())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      console.error(`[oddsApi] HTTP ${res.status} for ${path}`)
      return null
    }

    // Log remaining API usage from headers
    const remaining = res.headers.get('x-requests-remaining')
    const used = res.headers.get('x-requests-used')
    if (remaining) {
      console.log(`[oddsApi] API usage: ${used} used, ${remaining} remaining`)
    }

    return await res.json()
  } catch (err) {
    console.error(`[oddsApi] Fetch failed for ${path}:`, err.message)
    return null
  }
}

export function fetchOdds(config, markets = 'h2h,spreads,totals') {
  return fetchJSON(`/v4/sports/${config.oddsApi.sportKey}/odds`, {
    regions: 'us',
    markets,
    oddsFormat: 'american',
  })
}

export function fetchSports() {
  return fetchJSON('/v4/sports')
}
