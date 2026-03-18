import { getCollection } from '../db.js'
import { sha256 } from '../utils/hash.js'

/**
 * Fastify onResponse hook — logs every API request asynchronously.
 */
export async function logUsage(request, reply) {
  // Skip health checks and non-API routes
  if (!request.url.startsWith('/v1')) return
  if (!request.apiKey) return

  const log = {
    apiKeyId: request.apiKey._id,
    userId: request.apiKey.userId,
    tier: request.apiKey.tier,
    endpoint: request.url,
    method: request.method,
    statusCode: reply.statusCode,
    responseTimeMs: Math.round(reply.elapsedTime),
    timestamp: new Date(),
    ip: sha256(request.ip || 'unknown'),
  }

  // Fire-and-forget — don't block response
  getCollection('usage_logs').insertOne(log).catch((err) => {
    console.error('[logUsage] Failed to write usage log:', err.message)
  })
}
