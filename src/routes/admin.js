import { getCollection } from '../db.js'
import { getRedis } from '../redis.js'
import { verifyJwt } from '../middleware/jwtAuth.js'
import { success, error } from '../utils/response.js'
import { getTierConfig } from '../config/tiers.js'
import { API_ENDPOINTS, ENDPOINT_CATEGORIES } from '../config/endpoints.js'
import { runHealthChecks } from '../ingestion/healthChecker.js'

async function requireAdmin(request, reply) {
  if (!request.user?.isAdmin) {
    return reply.code(403).send(error('Admin access required.', 403))
  }
}

export default async function adminRoutes(fastify) {
  fastify.get('/admin/stats', { preHandler: [verifyJwt, requireAdmin] }, async () => {
    const usersCol = getCollection('users')
    const keysCol = getCollection('api_keys')

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [totalUsers, newUsersThisMonth, activeKeys] = await Promise.all([
      usersCol.countDocuments(),
      usersCol.countDocuments({ createdAt: { $gte: startOfMonth } }),
      keysCol.countDocuments({ status: 'active' }),
    ])

    // Top 50 users by credits used this period
    const topUsers = await usersCol
      .find(
        {},
        { projection: { supabaseId: 1, email: 1, tier: 1, creditsUsedThisPeriod: 1 } }
      )
      .sort({ creditsUsedThisPeriod: -1 })
      .limit(50)
      .toArray()

    // Supplement with real-time Redis credit counts where available
    const redis = getRedis()
    const enriched = await Promise.all(
      topUsers.map(async (u) => {
        const redisCredits = await redis.get(`credits:${u.supabaseId}`)
        const creditsUsed = parseInt(redisCredits) || u.creditsUsedThisPeriod || 0
        const tierConfig = getTierConfig(u.tier || 'free')
        return {
          id: u.supabaseId,
          email: u.email,
          tier: u.tier || 'free',
          creditsUsed,
          creditsLimit: tierConfig.creditsPerMonth,
        }
      })
    )

    // Sort by actual credits used after Redis enrichment
    enriched.sort((a, b) => b.creditsUsed - a.creditsUsed)

    // Platform-wide total credits this month
    const platformTotal = enriched.reduce((sum, u) => sum + u.creditsUsed, 0)

    return success({
      totalUsers,
      newUsersThisMonth,
      activeKeys,
      platformCreditsUsed: platformTotal,
      topUsers: enriched,
    })
  })

  // ── Endpoint registry ──────────────────────────────────────
  fastify.get('/admin/endpoints', { preHandler: [verifyJwt, requireAdmin] }, async () => {
    return success({ endpoints: API_ENDPOINTS, categories: ENDPOINT_CATEGORIES })
  })

  // ── Health checks ──────────────────────────────────────────
  fastify.get('/admin/health', { preHandler: [verifyJwt, requireAdmin] }, async () => {
    const stored = await getCollection('health_checks').find({}).toArray()

    // Merge stored results with the full endpoint list so new endpoints show as 'pending'
    const resultMap = Object.fromEntries(stored.map((r) => [r.endpointId, r]))
    const results = API_ENDPOINTS.map((ep) => {
      const r = resultMap[ep.id]
      return {
        endpointId: ep.id,
        category: ep.category,
        label: ep.label,
        path: ep.healthPath,
        tier: ep.tier,
        status: r?.status ?? 'pending',
        statusCode: r?.statusCode ?? null,
        responseTimeMs: r?.responseTimeMs ?? null,
        error: r?.error ?? null,
        checkedAt: r?.checkedAt ?? null,
      }
    })

    return success({ results })
  })

  // Manually trigger a health check run (useful for on-demand refresh)
  fastify.post('/admin/health/run', { preHandler: [verifyJwt, requireAdmin] }, async () => {
    // Run in background, return immediately
    runHealthChecks().catch((err) => console.error('[health] Manual run failed:', err))
    return success({ message: 'Health check started.' })
  })
}
