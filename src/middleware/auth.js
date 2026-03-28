import { getRedis } from '../redis.js'
import { getCollection } from '../db.js'
import { getTierConfig } from '../config/tiers.js'
import { sha256 } from '../utils/hash.js'
import { error } from '../utils/response.js'

const KEY_CACHE_TTL = 300 // 5 minutes
const USER_CACHE_TTL = 600 // 10 minutes

// In-memory cache for API key lookups (immutable between creation and revocation)
const apiKeyMemCache = new Map() // hash -> { record, expiresAt }
const API_KEY_MEM_TTL = 5 * 60 * 1000 // 5 minutes in ms

export async function validateApiKey(request, reply) {
  const key = request.headers['x-api-key']
  if (!key) {
    return reply.code(401).send(error('API key required. Pass it via the x-api-key header.', 401))
  }

  const hashed = sha256(key)
  const redis = getRedis()

  // Fast path: check in-memory cache first (eliminates Redis call on warm hits)
  let apiKeyRecord
  const memEntry = apiKeyMemCache.get(hashed)
  if (memEntry && memEntry.expiresAt > Date.now()) {
    apiKeyRecord = memEntry.record
  } else {
    // Second path: check Redis cache for API key
    const cached = await redis.get(`apikey:${hashed}`)
    if (cached) {
      apiKeyRecord = typeof cached === 'string' ? JSON.parse(cached) : cached
      apiKeyMemCache.set(hashed, { record: apiKeyRecord, expiresAt: Date.now() + API_KEY_MEM_TTL })
    } else {
      // Slow path: check MongoDB
      const record = await getCollection('api_keys').findOne({
        key: hashed,
        status: 'active',
      })

      if (!record) {
        return reply.code(401).send(error('Invalid or revoked API key.', 401))
      }

      apiKeyRecord = {
        _id: record._id.toString(),
        userId: record.userId,
        tier: record.tier,
        keyPrefix: record.keyPrefix,
        status: record.status,
      }
      await redis.set(`apikey:${hashed}`, JSON.stringify(apiKeyRecord), { ex: KEY_CACHE_TTL })
      apiKeyMemCache.set(hashed, { record: apiKeyRecord, expiresAt: Date.now() + API_KEY_MEM_TTL })

      // Update lastUsedAt (fire-and-forget)
      getCollection('api_keys').updateOne(
        { _id: record._id },
        { $set: { lastUsedAt: new Date() } }
      ).catch(() => {})
    }
  }

  request.apiKey = apiKeyRecord

  // --- Fetch user billing state (source of truth for tier) ---
  const userId = apiKeyRecord.userId
  const userCacheKey = `user:${userId}`

  let userBilling
  const cachedUser = await redis.get(userCacheKey)
  if (cachedUser) {
    userBilling = typeof cachedUser === 'string' ? JSON.parse(cachedUser) : cachedUser
  } else {
    const user = await getCollection('users').findOne({ supabaseId: userId })
    if (user) {
      userBilling = {
        userId: user.supabaseId,
        tier: user.tier || 'free',
        autoUpgrade: user.autoUpgrade !== false, // default true
        creditsPerMonth: getTierConfig(user.tier || 'free').creditsPerMonth,
        billingCycleEnd: user.currentPeriodEnd || null,
        overageCredits: user.overageCredits || 0,
        cardOnFile: user.cardOnFile || false,
      }
      await redis.set(userCacheKey, JSON.stringify(userBilling), { ex: USER_CACHE_TTL })
    } else {
      // Fallback: use API key's tier
      userBilling = {
        userId,
        tier: apiKeyRecord.tier || 'free',
        autoUpgrade: true,
        creditsPerMonth: getTierConfig(apiKeyRecord.tier || 'free').creditsPerMonth,
        billingCycleEnd: null,
        overageCredits: 0,
        cardOnFile: false,
      }
    }
  }

  request.userBilling = userBilling
  // Tier config comes from user's tier (source of truth), not key's tier
  request.tierConfig = getTierConfig(userBilling.tier)
}
