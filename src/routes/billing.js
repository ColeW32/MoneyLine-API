import { getCollection } from '../db.js'
import { getRedis } from '../redis.js'
import { verifyJwt } from '../middleware/jwtAuth.js'
import { success, error } from '../utils/response.js'
import { TIERS, getTierConfig, getNextTier, getUpgradePriceDifference } from '../config/tiers.js'

export default async function billingRoutes(fastify) {
  // ──────────────── Auto-Upgrade Toggle ──────────────────

  fastify.patch('/manage/billing/auto-upgrade', { preHandler: verifyJwt }, async (request, reply) => {
    const { enabled } = request.body || {}

    if (typeof enabled !== 'boolean') {
      return reply.code(400).send(error('Field "enabled" (boolean) is required.', 400))
    }

    await getCollection('users').updateOne(
      { supabaseId: request.user.supabaseId },
      { $set: { autoUpgrade: enabled, updatedAt: new Date() } }
    )

    // Invalidate cached user billing state
    const redis = getRedis()
    await redis.del(`user:${request.user.supabaseId}`)

    return success({
      autoUpgrade: enabled,
      message: enabled
        ? 'Auto-upgrade enabled. Your plan will automatically upgrade if you exceed your credit limit.'
        : 'Auto-upgrade disabled. Your API access will be suspended if you exceed your credit limit.',
    })
  })

  // ──────────────── Billing Status ──────────────────

  fastify.get('/manage/billing/status', { preHandler: verifyJwt }, async (request) => {
    const userId = request.user.supabaseId
    const user = await getCollection('users').findOne({ supabaseId: userId })

    if (!user) {
      return success({
        tier: 'free',
        tierConfig: getTierConfig('free'),
        autoUpgrade: true,
        cardOnFile: false,
        creditsUsed: 0,
        creditsLimit: 1_000,
        overageCredits: 0,
        overageCost: 0,
        billingCycleEnd: null,
      })
    }

    const tier = user.tier || 'free'
    const tierConfig = getTierConfig(tier)

    // Read real-time credit usage from Redis
    const redis = getRedis()
    const redisCredits = await redis.get(`credits:${userId}`)
    const creditsUsed = parseInt(redisCredits) || user.creditsUsedThisPeriod || 0

    const overageCredits = tier === 'business' && creditsUsed > tierConfig.creditsPerMonth
      ? creditsUsed - tierConfig.creditsPerMonth
      : user.overageCredits || 0
    const overageCost = tierConfig.overageRate
      ? overageCredits * tierConfig.overageRate
      : 0

    // Calculate billing cycle end (calendar month for now)
    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
    endOfMonth.setHours(0, 0, 0, 0)

    return success({
      tier,
      tierConfig,
      autoUpgrade: user.autoUpgrade !== false,
      cardOnFile: user.cardOnFile || false,
      creditsUsed,
      creditsLimit: tierConfig.creditsPerMonth,
      overageCredits,
      overageCost: Math.round(overageCost * 100) / 100,
      billingCycleEnd: user.currentPeriodEnd || endOfMonth.toISOString(),
      stripeCustomerId: user.stripeCustomerId || null,
      nextTier: getNextTier(tier),
      upgradeCost: getNextTier(tier) ? getUpgradePriceDifference(tier, getNextTier(tier)) : null,
    })
  })

  // ──────────────── Checkout (Stripe Stub) ──────────────────

  fastify.post('/manage/billing/checkout', { preHandler: verifyJwt }, async (request, reply) => {
    const { tier: targetTier } = request.body || {}

    if (!targetTier || !TIERS[targetTier]) {
      return reply.code(400).send(error('Invalid target tier.', 400))
    }

    if (targetTier === 'enterprise') {
      return reply.code(400).send(error('Enterprise plans require a sales consultation. Contact us at enterprise@moneylineapp.com.', 400))
    }

    // Stub: Stripe integration will go here
    return success({
      message: 'Stripe integration not yet configured. Manual upgrade available via /manage/billing/upgrade for testing.',
      targetTier,
      price: TIERS[targetTier].priceMonthly,
    })
  })

  // ──────────────── Customer Portal (Stripe Stub) ──────────────────

  fastify.post('/manage/billing/portal', { preHandler: verifyJwt }, async () => {
    return success({
      message: 'Stripe customer portal not yet configured.',
      url: null,
    })
  })

  // ──────────────── Manual Upgrade (Testing) ──────────────────

  fastify.post('/manage/billing/upgrade', { preHandler: verifyJwt }, async (request, reply) => {
    const { tier: targetTier } = request.body || {}
    const userId = request.user.supabaseId

    if (!targetTier || !TIERS[targetTier]) {
      return reply.code(400).send(error('Invalid target tier.', 400))
    }

    const currentTier = request.user.tier || 'free'
    const currentRank = TIERS[currentTier]?.rank || 0
    const targetRank = TIERS[targetTier].rank

    if (targetRank <= currentRank) {
      return reply.code(400).send(error(`Cannot downgrade from ${currentTier} to ${targetTier}. Contact support for downgrades.`, 400))
    }

    // Update user tier
    await getCollection('users').updateOne(
      { supabaseId: userId },
      {
        $set: {
          tier: targetTier,
          updatedAt: new Date(),
        },
      }
    )

    // Update all active API keys to new tier
    await getCollection('api_keys').updateMany(
      { userId, status: 'active' },
      { $set: { tier: targetTier } }
    )

    // Invalidate cached user billing state
    const redis = getRedis()
    await redis.del(`user:${userId}`)

    return success({
      previousTier: currentTier,
      newTier: targetTier,
      tierConfig: getTierConfig(targetTier),
      message: `Upgraded from ${TIERS[currentTier].label} to ${TIERS[targetTier].label}.`,
    })
  })
}
