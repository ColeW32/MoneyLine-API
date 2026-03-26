import { getCollection } from '../db.js'
import { API_ENDPOINTS } from '../config/endpoints.js'

const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.API_PORT || 3000}`
const HEALTH_API_KEY = process.env.ML_LIVE_API_KEY

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

  if (!endpoint.healthPath) {
    return {
      endpointId: endpoint.id,
      status: 'skip',
      statusCode: null,
      responseTimeMs: 0,
      error: 'No healthPath configured (requires dynamic ID)',
      checkedAt: new Date(),
    }
  }

  const url = `${API_BASE}${endpoint.healthPath}`
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
      return {
        endpointId: endpoint.id,
        status: 'fail',
        statusCode: res.status,
        responseTimeMs: ms,
        error: parsed?.error?.message || `HTTP ${res.status}`,
        checkedAt: new Date(),
      }
    }

    // Validate response structure
    const data = parsed?.data
    const isEmpty = data === null || data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)

    return {
      endpointId: endpoint.id,
      status: isEmpty ? 'empty' : 'ok',
      statusCode: res.status,
      responseTimeMs: ms,
      error: null,
      checkedAt: new Date(),
    }
  } catch (err) {
    return {
      endpointId: endpoint.id,
      status: 'fail',
      statusCode: null,
      responseTimeMs: Date.now() - start,
      error: err.name === 'TimeoutError' ? 'Request timed out (15s)' : String(err.message),
      checkedAt: new Date(),
    }
  }
}

/**
 * Run health checks for all endpoints and upsert results into MongoDB.
 */
export async function runHealthChecks() {
  const results = await Promise.all(API_ENDPOINTS.map(checkEndpoint))

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

  console.log(`[health] Checks complete — ok:${counts.ok || 0} empty:${counts.empty || 0} fail:${counts.fail || 0} skip:${counts.skip || 0}`)
  return results
}
