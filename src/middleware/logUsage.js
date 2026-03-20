import { getCollection } from '../db.js'
import { sha256 } from '../utils/hash.js'

/**
 * Fastify onResponse hook — logs every API request asynchronously.
 * Also syncs credit usage to MongoDB for dashboard display.
 */
export async function logUsage(request, reply) {
  // Skip health checks and non-API routes
  if (!request.url.startsWith('/v1')) return
  if (!request.apiKey) return

  const userId = request.apiKey.userId
  const tier = request.userBilling?.tier || request.apiKey.tier

  const log = {
    apiKeyId: request.apiKey._id,
    userId,
    tier,
    endpoint: request.url,
    method: request.method,
    statusCode: reply.statusCode,
    responseTimeMs: Math.round(reply.elapsedTime),
    creditsConsumed: 1,
    timestamp: new Date(),
    ip: sha256(request.ip || 'unknown'),
  }

  // Fire-and-forget — don't block response
  getCollection('usage_logs').insertOne(log).catch((err) => {
    console.error('[logUsage] Failed to write usage log:', err.message)
  })

  // Sync credit count to user doc for dashboard display (fire-and-forget)
  getCollection('users').updateOne(
    { supabaseId: userId },
    { $inc: { creditsUsedThisPeriod: 1 } }
  ).catch(() => {})
}
