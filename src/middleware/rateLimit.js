import { getRedis } from '../redis.js'
import { error } from '../utils/response.js'

/**
 * Per-minute sliding-window rate limiter using Upstash Redis.
 * Protects against burst abuse. Credit-based monthly limits are
 * handled separately by creditCheck middleware.
 */
export async function perMinuteRateLimit(request, reply) {
  const { tierConfig, apiKey } = request
  if (!tierConfig || !apiKey) return

  // Enterprise and unlimited tiers skip per-minute checks
  if (tierConfig.requestsPerMinute === Infinity) return

  const redis = getRedis()
  const keyId = apiKey._id
  const now = Date.now()

  const minuteKey = `rl:min:${keyId}`
  const windowStart = now - 60_000

  // Use a pipeline: remove old entries, add current, count, set expiry
  const pipe = redis.pipeline()
  pipe.zremrangebyscore(minuteKey, 0, windowStart)
  pipe.zadd(minuteKey, { score: now, member: `${now}:${Math.random()}` })
  pipe.zcard(minuteKey)
  pipe.expire(minuteKey, 120)
  const results = await pipe.exec()

  const minuteCount = results[2]
  if (minuteCount > tierConfig.requestsPerMinute) {
    reply.header('Retry-After', '60')
    return reply.code(429).send(
      error(`Rate limit exceeded. ${tierConfig.requestsPerMinute} requests/minute allowed on ${tierConfig.label} tier.`, 429)
    )
  }
}
