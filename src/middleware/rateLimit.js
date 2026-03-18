import { getRedis } from '../redis.js'
import { error } from '../utils/response.js'

/**
 * Sliding-window rate limiter using Upstash Redis.
 * Checks both per-minute and per-month limits based on tier.
 */
export async function rateLimit(request, reply) {
  const { tierConfig, apiKey } = request
  if (!tierConfig || !apiKey) return

  const redis = getRedis()
  const keyId = apiKey._id
  const now = Date.now()

  // --- Per-minute rate limit (sliding window) ---
  if (tierConfig.requestsPerMinute !== Infinity) {
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

  // --- Monthly quota ---
  if (tierConfig.requestsPerMonth !== Infinity) {
    const monthKey = `rl:month:${keyId}`
    const monthCount = await redis.incr(monthKey)

    // Set TTL to end of current month on first request
    if (monthCount === 1) {
      const endOfMonth = new Date()
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
      endOfMonth.setHours(0, 0, 0, 0)
      const ttl = Math.ceil((endOfMonth.getTime() - now) / 1000)
      await redis.expire(monthKey, ttl)
    }

    if (monthCount > tierConfig.requestsPerMonth) {
      return reply.code(429).send(
        error(`Monthly quota exceeded. ${tierConfig.requestsPerMonth.toLocaleString()} requests/month allowed on ${tierConfig.label} tier.`, 429)
      )
    }
  }
}
