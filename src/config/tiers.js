export const TIERS = {
  free: {
    label: 'Free',
    rank: 0,
    creditsPerMonth: 1_000,
    requestsPerMinute: 10,
    priceMonthly: 0,
    overageRate: null,
    stripePriceId: null,
    booksPerRequest: 0,
    edgeAccess: false,
    playByPlay: false,
    injuryAccess: false,
    historicalDays: 7,
    sports: ['nfl', 'nba', 'mlb', 'nhl'],
  },
  starter: {
    label: 'Starter',
    rank: 1,
    creditsPerMonth: 150_000,
    requestsPerMinute: 60,
    priceMonthly: 29,
    overageRate: null,
    stripePriceId: null,
    booksPerRequest: 1,
    edgeAccess: false,
    playByPlay: false,
    injuryAccess: true,
    historicalDays: 90,
    sports: 'all',
  },
  pro: {
    label: 'Pro',
    rank: 2,
    creditsPerMonth: 1_500_000,
    requestsPerMinute: 200,
    priceMonthly: 149,
    overageRate: null,
    stripePriceId: null,
    booksPerRequest: Infinity,
    edgeAccess: true,
    playByPlay: true,
    injuryAccess: true,
    historicalDays: 365,
    sports: 'all',
  },
  business: {
    label: 'Business',
    rank: 3,
    creditsPerMonth: 5_000_000,
    requestsPerMinute: 1_000,
    priceMonthly: 299,
    overageRate: 0.00015,
    stripePriceId: null,
    booksPerRequest: Infinity,
    edgeAccess: true,
    playByPlay: true,
    injuryAccess: true,
    historicalDays: Infinity,
    sports: 'all',
  },
  enterprise: {
    label: 'Enterprise',
    rank: 4,
    creditsPerMonth: Infinity,
    requestsPerMinute: Infinity,
    priceMonthly: null,
    overageRate: null,
    stripePriceId: null,
    booksPerRequest: Infinity,
    edgeAccess: true,
    playByPlay: true,
    injuryAccess: true,
    historicalDays: Infinity,
    sports: 'all',
    webhooks: true,
  },
}

export function getTierConfig(tierName) {
  return TIERS[tierName] || TIERS.free
}

// Numeric rank for comparison: free=0, starter=1, pro=2, business=3, enterprise=4
export function tierMeetsMinimum(userTier, requiredTier) {
  const user = TIERS[userTier]
  const required = TIERS[requiredTier]
  if (!user || !required) return false
  return user.rank >= required.rank
}

// Returns the next tier up, or null if already at top paid tier (business) or enterprise
export function getNextTier(tierName) {
  const order = ['free', 'starter', 'pro', 'business']
  const idx = order.indexOf(tierName)
  if (idx === -1 || idx >= order.length - 1) return null
  return order[idx + 1]
}

// Price difference in dollars between two tiers
export function getUpgradePriceDifference(fromTier, toTier) {
  const from = TIERS[fromTier]
  const to = TIERS[toTier]
  if (!from || !to) return 0
  return (to.priceMonthly || 0) - (from.priceMonthly || 0)
}
