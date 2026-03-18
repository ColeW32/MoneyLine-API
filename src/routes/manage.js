import { randomBytes } from 'crypto'
import { ObjectId } from 'mongodb'
import { getCollection } from '../db.js'
import { verifyJwt } from '../middleware/jwtAuth.js'
import { sha256 } from '../utils/hash.js'
import { success, error } from '../utils/response.js'
import { TIERS } from '../config/tiers.js'

export default async function manageRoutes(fastify) {
  // ──────────────────────────── Auth ────────────────────────────

  fastify.get('/auth/me', { preHandler: verifyJwt }, async (request) => {
    const { supabaseId, email, tier, createdAt } = request.user
    return success({ id: supabaseId, email, tier, createdAt })
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

    let objectId
    try {
      objectId = new ObjectId(keyId)
    } catch {
      return reply.code(400).send(error('Invalid key ID.', 400))
    }

    const result = await getCollection('api_keys').updateOne(
      { _id: objectId, userId: request.user.supabaseId },
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

    // Daily request counts for chart
    const dailyCounts = await getCollection('usage_logs')
      .aggregate([
        { $match: { userId, timestamp: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
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

    // Monthly total
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthlyTotal = await getCollection('usage_logs').countDocuments({
      userId,
      timestamp: { $gte: monthStart },
    })

    const tierConfig = TIERS[request.user.tier] || TIERS.free

    return success({
      monthlyTotal,
      monthlyLimit: tierConfig.requestsPerMonth,
      dailyCounts: dailyCounts.map((d) => ({ date: d._id, count: d.count })),
      recentRequests: recent,
    })
  })

  // ──────────────────────── Plan ───────────────────────────────

  fastify.get('/manage/plan', { preHandler: verifyJwt }, async (request) => {
    const tier = request.user.tier || 'free'
    const tierConfig = TIERS[tier]

    return success({
      currentTier: tier,
      tierConfig,
      allTiers: Object.entries(TIERS).map(([key, config]) => ({
        id: key,
        ...config,
      })),
    })
  })
}
