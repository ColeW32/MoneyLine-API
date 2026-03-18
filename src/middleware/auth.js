import { getRedis } from '../redis.js'
import { getCollection } from '../db.js'
import { getTierConfig } from '../config/tiers.js'
import { sha256 } from '../utils/hash.js'
import { error } from '../utils/response.js'

const KEY_CACHE_TTL = 300 // 5 minutes

export async function validateApiKey(request, reply) {
  const key = request.headers['x-api-key']
  if (!key) {
    return reply.code(401).send(error('API key required. Pass it via the x-api-key header.', 401))
  }

  const hashed = sha256(key)
  const redis = getRedis()

  // Fast path: check Redis cache
  const cached = await redis.get(`apikey:${hashed}`)
  if (cached) {
    const record = typeof cached === 'string' ? JSON.parse(cached) : cached
    request.apiKey = record
    request.tierConfig = getTierConfig(record.tier)
    return
  }

  // Slow path: check MongoDB
  const record = await getCollection('api_keys').findOne({
    key: hashed,
    status: 'active',
  })

  if (!record) {
    return reply.code(401).send(error('Invalid or revoked API key.', 401))
  }

  // Cache in Redis
  const cachePayload = {
    _id: record._id.toString(),
    userId: record.userId,
    tier: record.tier,
    keyPrefix: record.keyPrefix,
    status: record.status,
    requestsPerMonth: record.monthlyRequests,
  }
  await redis.set(`apikey:${hashed}`, JSON.stringify(cachePayload), { ex: KEY_CACHE_TTL })

  // Update lastUsedAt (fire-and-forget)
  getCollection('api_keys').updateOne(
    { _id: record._id },
    { $set: { lastUsedAt: new Date() } }
  ).catch(() => {})

  request.apiKey = cachePayload
  request.tierConfig = getTierConfig(record.tier)
}
