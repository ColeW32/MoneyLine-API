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
    const pipe = redis.pipeline()
    for (const u of topUsers) {
      pipe.get(`credits:${u.supabaseId}`)
    }
    const creditResults = await pipe.exec()
    const enriched = topUsers.map((u, i) => {
      const creditsUsed = parseInt(creditResults[i]) || u.creditsUsedThisPeriod || 0
      const tierConfig = getTierConfig(u.tier || 'free')
      return {
        id: u.supabaseId,
        email: u.email,
        tier: u.tier || 'free',
        creditsUsed,
        creditsLimit: tierConfig.creditsPerMonth,
      }
    })

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

  // ── Name mapping stats ─────────────────────────────────────
  fastify.get('/admin/name-mapping', { preHandler: [verifyJwt, requireAdmin] }, async () => {
    const SPORT_TO_LEAGUE = {
      basketball: 'nba',
      football: 'nfl',
      baseball: 'mlb',
      hockey: 'nhl',
    }

    const [strategyRows, unresolvedDocs] = await Promise.all([
      getCollection('source_id_map_v2').aggregate([
        { $match: { source: 'oddsapi', entityType: 'player' } },
        {
          $group: {
            _id: { sport: '$sport', strategy: '$resolutionStrategy' },
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
      getCollection('player_name_review')
        .find({})
        .sort({ firstSeenAt: -1 })
        .limit(200)
        .toArray(),
    ])

    // Build per-sport stats
    const sportStats = {}
    for (const row of strategyRows) {
      const { sport, strategy } = row._id
      if (!sportStats[sport]) {
        sportStats[sport] = {
          sport,
          leagueId: SPORT_TO_LEAGUE[sport] || sport,
          total: 0,
          resolved: 0,
          unresolved: 0,
          byStrategy: {},
        }
      }
      const s = sportStats[sport]
      s.total += row.count
      s.byStrategy[strategy] = (s.byStrategy[strategy] || 0) + row.count
      if (strategy === 'unresolved') {
        s.unresolved += row.count
      } else {
        s.resolved += row.count
      }
    }

    const leagues = Object.values(sportStats).map((s) => ({
      ...s,
      resolutionRate: s.total > 0 ? Math.round((s.resolved / s.total) * 1000) / 10 : 0,
    }))

    const unresolved = unresolvedDocs.map((d) => ({
      playerName: d.playerName,
      normalizedName: d.normalizedName,
      leagueId: d.leagueId,
      sport: d.sport,
      eventId: d.eventId,
      firstSeenAt: d.firstSeenAt,
      retryAfter: d.retryAfter,
    }))

    return success({ leagues, unresolved })
  })
}
