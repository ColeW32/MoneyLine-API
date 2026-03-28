import { getRedis } from '../redis.js'
import { error } from '../utils/response.js'

/**
 * Per-minute fixed-window rate limiter using Upstash Redis.
 * Uses INCR + conditional EXPIRE (2 commands) instead of the sliding-window
 * approach (4 commands). Burst at window boundaries is acceptable given
 * the permissive per-minute limits.
 * Credit-based monthly limits are handled separately by creditCheck middleware.
 */
export async function perMinuteRateLimit(request, reply) {
  const { tierConfig, apiKey } = request
  if (!tierConfig || !apiKey) return

  // Enterprise and unlimited tiers skip per-minute checks
  if (tierConfig.requestsPerMinute === Infinity) return

  const redis = getRedis()
  const keyId = apiKey._id
  const windowMinute = Math.floor(Date.now() / 60_000)
  const minuteKey = `rl:min:${keyId}:${windowMinute}`

  const count = await redis.incr(minuteKey)
  if (count === 1) {
    // Set TTL on first request of this window (fire-and-forget)
    redis.expire(minuteKey, 120).catch(() => {})
  }

  if (count > tierConfig.requestsPerMinute) {
    reply.header('Retry-After', '60')
    return reply.code(429).send(
      error(`Rate limit exceeded. ${tierConfig.requestsPerMinute} requests/minute allowed on ${tierConfig.label} tier.`, 429)
    )
  }
}
