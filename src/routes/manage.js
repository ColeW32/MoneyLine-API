import { randomBytes } from 'crypto'
import { ObjectId } from 'mongodb'
import { getCollection } from '../db.js'
import { getRedis } from '../redis.js'
import { verifyJwt } from '../middleware/jwtAuth.js'
import { sha256 } from '../utils/hash.js'
import { success, error } from '../utils/response.js'
import { TIERS, getTierConfig } from '../config/tiers.js'

function buildApiKeyIdFilter(keyId) {
  const idFilters = [{ _id: keyId }]

  if (ObjectId.isValid(keyId)) {
    idFilters.unshift({ _id: new ObjectId(keyId) })
  }

  return idFilters.length === 1 ? idFilters[0] : { $or: idFilters }
}

export default async function manageRoutes(fastify) {
  // ──────────────────────────── Auth ────────────────────────────

  fastify.get('/auth/me', { preHandler: verifyJwt }, async (request) => {
    const { supabaseId, email, tier, createdAt } = request.user
    // Fetch billing fields from user doc
    const userDoc = await getCollection('users').findOne({ supabaseId })
    return success({
      id: supabaseId,
      email,
      tier,
      createdAt,
      autoUpgrade: userDoc?.autoUpgrade !== false,
      cardOnFile: userDoc?.cardOnFile || false,
    })
  })

  // ──────────────────────── API Key Management ──────────────────────

  fastify.get('/manage/keys', { preHandler: verifyJwt }, async (request) => {
    const keys = await getCollection('api_keys')
      .find(
        { userId: request.user.supabaseId },
        { projection: { key: 0 } }
      )
      .sort({ createdAt: -1 })
      .toArray()

    const formatted = keys.map((k) => ({
      id: k._id.toString(),
      keyPrefix: k.keyPrefix,
      name: k.name,
      tier: k.tier,
      status: k.status,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }))

    return success(formatted, { count: formatted.length })
  })

  fastify.post('/manage/keys', { preHandler: verifyJwt }, async (request, reply) => {
    const { name } = request.body || {}
    const user = request.user

    // Count existing active keys
    const activeCount = await getCollection('api_keys').countDocuments({
      userId: user.supabaseId,
      status: 'active',
    })
    if (activeCount >= 5) {
      return reply.code(400).send(error('Maximum of 5 active API keys allowed.', 400))
    }

    // Generate key
    const rawKey = `ml_live_${randomBytes(16).toString('hex')}`
    const hashed = sha256(rawKey)

    const doc = {
      key: hashed,
      keyPrefix: rawKey.substring(0, 16),
      userId: user.supabaseId,
      tier: user.tier,
      name: name || 'Default',
      requestCount: 0,
      monthlyRequests: 0,
      status: 'active',
      createdAt: new Date(),
      lastUsedAt: null,
    }

    await getCollection('api_keys').insertOne(doc)

    return success({
      id: doc._id?.toString(),
      rawKey,
      keyPrefix: doc.keyPrefix,
      name: doc.name,
      tier: doc.tier,
      status: doc.status,
      createdAt: doc.createdAt,
    })
  })

  fastify.delete('/manage/keys/:keyId', { preHandler: verifyJwt }, async (request, reply) => {
    const { keyId } = request.params

    if (typeof keyId !== 'string' || keyId.trim().length === 0) {
      return reply.code(400).send(error('Invalid key ID.', 400))
    }

    const result = await getCollection('api_keys').updateOne(
      {
        userId: request.user.supabaseId,
        ...buildApiKeyIdFilter(keyId),
      },
      { $set: { status: 'revoked' } }
    )

    if (result.matchedCount === 0) {
      return reply.code(404).send(error('API key not found.', 404))
    }

    return success({ message: 'API key revoked.' })
  })

  // ──────────────────────── Usage ──────────────────────────────

  fastify.get('/manage/usage', { preHandler: verifyJwt }, async (request) => {
    const userId = request.user.supabaseId
    const { days } = request.query
    const lookbackDays = Math.min(90, parseInt(days) || 30)
    const since = new Date(Date.now() - lookbackDays * 86_400_000)

    // Daily credit counts for chart
    const dailyCounts = await getCollection('usage_logs')
      .aggregate([
        { $match: { userId, timestamp: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: { $ifNull: ['$creditsConsumed', 1] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray()

    // Recent requests
    const recent = await getCollection('usage_logs')
      .find({ userId }, { projection: { _id: 0, ip: 0 } })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray()

    // Real-time credit usage from Redis (primary) or MongoDB (fallback)
    const redis = getRedis()
    const redisCredits = await redis.get(`credits:${userId}`)
    const user = await getCollection('users').findOne({ supabaseId: userId })
    const creditsUsed = parseInt(redisCredits) || user?.creditsUsedThisPeriod || 0

    const tier = request.user.tier || 'free'
    const tierConfig = getTierConfig(tier)

    // Billing cycle dates (calendar month for now, Stripe billing cycle later)
    const billingCycleStart = new Date()
    billingCycleStart.setDate(1)
    billingCycleStart.setHours(0, 0, 0, 0)
    const billingCycleEnd = new Date(billingCycleStart)
    billingCycleEnd.setMonth(billingCycleEnd.getMonth() + 1)

    const overageCredits = tier === 'business' && creditsUsed > tierConfig.creditsPerMonth
      ? creditsUsed - tierConfig.creditsPerMonth
      : user?.overageCredits || 0

    return success({
      creditsUsed,
      creditsLimit: tierConfig.creditsPerMonth,
      overageCredits,
      billingCycleStart: billingCycleStart.toISOString(),
      billingCycleEnd: user?.currentPeriodEnd || billingCycleEnd.toISOString(),
      dailyCounts: dailyCounts.map((d) => ({ date: d._id, count: d.count })),
      recentRequests: recent,
    })
  })

  // ──────────────────────── Plan ───────────────────────────────

  fastify.get('/manage/plan', { preHandler: verifyJwt }, async (request) => {
    const userId = request.user.supabaseId
    const tier = request.user.tier || 'free'
    const tierConfig = getTierConfig(tier)

    // Read real-time credit usage from Redis
    const redis = getRedis()
    const redisCredits = await redis.get(`credits:${userId}`)
    const user = await getCollection('users').findOne({ supabaseId: userId })
    const creditsUsed = parseInt(redisCredits) || user?.creditsUsedThisPeriod || 0

    const overageCredits = tier === 'business' && creditsUsed > tierConfig.creditsPerMonth
      ? creditsUsed - tierConfig.creditsPerMonth
      : user?.overageCredits || 0
    const overageCost = tierConfig.overageRate
      ? overageCredits * tierConfig.overageRate
      : 0

    // Billing cycle end
    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
    endOfMonth.setHours(0, 0, 0, 0)

    return success({
      currentTier: tier,
      tierConfig,
      creditsUsed,
      creditsRemaining: tierConfig.creditsPerMonth === Infinity
        ? Infinity
        : Math.max(0, tierConfig.creditsPerMonth - creditsUsed),
      overageCredits,
      overageCost: Math.round(overageCost * 100) / 100,
      autoUpgrade: user?.autoUpgrade !== false,
      cardOnFile: user?.cardOnFile || false,
      billingCycleEnd: user?.currentPeriodEnd || endOfMonth.toISOString(),
      allTiers: Object.entries(TIERS).map(([key, config]) => ({
        id: key,
        ...config,
      })),
    })
  })
}
