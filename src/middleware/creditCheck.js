import { getRedis } from '../redis.js'
import { getCollection } from '../db.js'
import { getTierConfig, getNextTier } from '../config/tiers.js'
import { error } from '../utils/response.js'

// In-memory credit buffer: batches INCR calls and flushes via INCRBY every 5s
const creditBuffer = new Map() // userId -> { pending, lastFlushed }
const CREDIT_FLUSH_INTERVAL_MS = 5_000

function scheduleFlush(userId, creditKey) {
  const entry = creditBuffer.get(userId)
  if (entry.flushTimer) return
  entry.flushTimer = setTimeout(async () => {
    const toFlush = entry.pending
    entry.pending = 0
    entry.flushTimer = null
    if (toFlush <= 0) return
    try {
      const redis = getRedis()
      const newCount = await redis.incrby(creditKey, toFlush)
      // Set TTL if this is the first credit of the period
      if (newCount <= toFlush) {
        const endOfMonth = new Date()
        endOfMonth.setMonth(endOfMonth.getMonth() + 1, 1)
        endOfMonth.setHours(0, 0, 0, 0)
        const ttl = Math.ceil((endOfMonth.getTime() - Date.now()) / 1000)
        await redis.expire(creditKey, ttl)
      }
    } catch (err) {
      console.error('[creditCheck] Flush error:', err)
    }
  }, CREDIT_FLUSH_INTERVAL_MS)
}

/**
 * Account-level credit check middleware.
 * Tracks credits per userId (not per API key) using a batched Redis INCRBY.
 * Handles: credit enforcement, overage tracking, auto-upgrade stub.
 */
export async function creditCheck(request, reply) {
  const userBilling = request.userBilling
  if (!userBilling) return

  const { userId, tier, creditsPerMonth, autoUpgrade } = userBilling
  const tierConfig = getTierConfig(tier)

  // Enterprise has unlimited credits
  if (creditsPerMonth === Infinity) return

  const redis = getRedis()
  const creditKey = `credits:${userId}`

  // Buffer the increment locally and get a local estimate of count
  if (!creditBuffer.has(userId)) {
    creditBuffer.set(userId, { pending: 0, flushTimer: null })
  }
  const entry = creditBuffer.get(userId)
  entry.pending += 1
  scheduleFlush(userId, creditKey)

  // Read current Redis count + local pending for enforcement decision
  const redisVal = await redis.get(creditKey)
  const redisCount = parseInt(redisVal) || 0
  const count = redisCount + entry.pending

  // Attach credit info to request for logging/response headers
  request.creditInfo = { used: count, limit: creditsPerMonth }

  // Within limits — fast path (99% of requests)
  if (count <= creditsPerMonth) return

  // --- Over limit ---

  // Business tier: allow with overage tracking
  if (tier === 'business' && tierConfig.overageRate) {
    const overageCount = count - creditsPerMonth
    // Track overage in MongoDB (fire-and-forget)
    getCollection('users').updateOne(
      { supabaseId: userId },
      { $set: { overageCredits: overageCount, updatedAt: new Date() } }
    ).catch(() => {})
    return // Allow the request
  }

  // Auto-upgrade enabled: stub for now (will integrate Stripe later)
  if (autoUpgrade) {
    const nextTier = getNextTier(tier)
    if (nextTier) {
      console.log(`[creditCheck] User ${userId} exceeded ${creditsPerMonth} credits on ${tier} tier. Auto-upgrade to ${nextTier} would trigger here.`)
      // TODO: When Stripe is integrated:
      // 1. Acquire Redis lock
      // 2. Calculate pro-rated charge
      // 3. Update Stripe subscription
      // 4. Update user tier in MongoDB
      // 5. Update Redis credit limit
      // For now, allow the request (grace period)
      return
    }
  }

  // Auto-upgrade disabled or no next tier: reject
  return reply.code(429).send(
    error(
      `Credit limit exceeded. ${creditsPerMonth.toLocaleString()} credits/month allowed on ${tierConfig.label} tier. ${autoUpgrade ? 'Contact support for assistance.' : 'Enable auto-upgrade in your dashboard to avoid service interruption.'}`,
      429
    )
  )
}
