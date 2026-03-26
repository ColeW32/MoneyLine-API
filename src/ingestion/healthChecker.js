import { getCollection } from '../db.js'
import { API_ENDPOINTS } from '../config/endpoints.js'

const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.API_PORT || 3000}`
const HEALTH_API_KEY = process.env.ML_LIVE_API_KEY

/**
 * Resolve dynamic IDs for health checks by querying real data.
 * Cached per health check run to avoid repeated DB lookups.
 */
let _cachedPlayerId = null
let _cachedEventId = null

async function resolveSamplePlayerId() {
  if (_cachedPlayerId) return _cachedPlayerId

  const hitRate = await getCollection('hit_rates').findOne(
    {},
    { projection: { playerId: 1 } }
  )
  if (hitRate?.playerId) {
    _cachedPlayerId = hitRate.playerId
    return _cachedPlayerId
  }

  const stat = await getCollection('player_stats').findOne(
    { type: 'game' },
    { projection: { playerId: 1 } }
  )
  if (stat?.playerId) {
    _cachedPlayerId = stat.playerId
    return _cachedPlayerId
  }

  return null
}

async function resolveSampleEventId() {
  if (_cachedEventId) return _cachedEventId

  // Find a recent NBA event that has odds data (most representative)
  const odds = await getCollection('odds').findOne(
    { leagueId: 'nba' },
    { projection: { eventId: 1 }, sort: { fetchedAt: -1 } }
  )
  if (odds?.eventId) {
    _cachedEventId = odds.eventId
    return _cachedEventId
  }

  // Fallback to any event
  const event = await getCollection('events').findOne(
    {},
    { projection: { eventId: 1 }, sort: { startTime: -1 } }
  )
  if (event?.eventId) {
    _cachedEventId = event.eventId
    return _cachedEventId
  }

  return null
}

/**
 * Resolve the health path for an endpoint, handling dynamic {playerId} and {eventId} substitution.
 */
async function resolveHealthPath(endpoint) {
  if (endpoint.healthPath) return endpoint.healthPath
  if (!endpoint.healthPathTemplate) return null

  let path = endpoint.healthPathTemplate

  if (path.includes('{playerId}')) {
    const playerId = await resolveSamplePlayerId()
    if (!playerId) return null
    path = path.replace('{playerId}', playerId)
  }

  if (path.includes('{eventId}')) {
    const eventId = await resolveSampleEventId()
    if (!eventId) return null
    path = path.replace('{eventId}', eventId)
  }

  return path
}

/**
 * Check a single endpoint and return a result object.
 */
async function checkEndpoint(endpoint) {
  if (!HEALTH_API_KEY) {
    return {
      endpointId: endpoint.id,
      status: 'skip',
      statusCode: null,
      responseTimeMs: 0,
      error: 'ML_LIVE_API_KEY not configured',
      checkedAt: new Date(),
    }
  }

  const healthPath = await resolveHealthPath(endpoint)
  if (!healthPath) {
    return {
      endpointId: endpoint.id,
      status: 'skip',
      statusCode: null,
      responseTimeMs: 0,
      error: 'No healthPath configured and no sample playerId found',
      checkedAt: new Date(),
    }
  }

  const url = `${API_BASE}${healthPath}`
  const start = Date.now()

  try {
    const res = await fetch(url, {
      method: endpoint.method,
      headers: { 'x-api-key': HEALTH_API_KEY },
      signal: AbortSignal.timeout(15_000),
    })

    const ms = Date.now() - start
    const text = await res.text()

    let parsed = null
    try { parsed = JSON.parse(text) } catch { /* non-JSON */ }

    if (!res.ok) {
      const apiMsg = parsed?.error?.message || parsed?.message || null
      return {
        endpointId: endpoint.id,
        status: 'fail',
        statusCode: res.status,
        responseTimeMs: ms,
        error: `HTTP ${res.status}${apiMsg ? ': ' + apiMsg : ''}`,
        errorDetail: text.slice(0, 500),
        checkedAt: new Date(),
      }
    }

    // Validate response structure
    const data = parsed?.data
    const isEmpty = data === null || data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)

    // Include data count for debugging
    const dataCount = Array.isArray(data) ? data.length
      : (data?.odds?.length ?? data?.players?.length ?? data?.teams?.length ?? null)

    return {
      endpointId: endpoint.id,
      status: isEmpty ? 'empty' : 'ok',
      statusCode: res.status,
      responseTimeMs: ms,
      error: isEmpty ? 'Response returned empty data' : null,
      dataCount,
      checkedAt: new Date(),
    }
  } catch (err) {
    const ms = Date.now() - start
    let errorMsg = String(err.message)
    if (err.name === 'TimeoutError') {
      errorMsg = `Request timed out after ${Math.round(ms / 1000)}s — endpoint too slow`
    } else if (err.code === 'ECONNREFUSED') {
      errorMsg = `Connection refused at ${url} — is the server running?`
    } else if (err.code === 'ECONNRESET') {
      errorMsg = `Connection reset — server may have crashed during request`
    }

    return {
      endpointId: endpoint.id,
      status: 'fail',
      statusCode: null,
      responseTimeMs: ms,
      error: errorMsg,
      checkedAt: new Date(),
    }
  }
}

/**
 * Run health checks in small batches to avoid overwhelming the server.
 */
export async function runHealthChecks() {
  // Clear cached IDs so each run resolves fresh data
  _cachedPlayerId = null
  _cachedEventId = null

  const BATCH_SIZE = 4
  const results = []
  for (let i = 0; i < API_ENDPOINTS.length; i += BATCH_SIZE) {
    const batch = API_ENDPOINTS.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(batch.map(checkEndpoint))
    results.push(...batchResults)
  }

  const col = getCollection('health_checks')
  await Promise.all(
    results.map((r) =>
      col.updateOne(
        { endpointId: r.endpointId },
        { $set: r },
        { upsert: true }
      )
    )
  )

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  // Log details for failures
  const failures = results.filter((r) => r.status === 'fail')
  if (failures.length > 0) {
    console.log(`[health] Failures:`)
    for (const f of failures) {
      console.log(`  ${f.endpointId}: ${f.error} (${f.responseTimeMs}ms)`)
    }
  }

  console.log(`[health] Checks complete — ok:${counts.ok || 0} empty:${counts.empty || 0} fail:${counts.fail || 0} skip:${counts.skip || 0}`)
  return results
}
