export const TIERS = {
  free: {
    label: 'Free',
    rank: 0,
    requestsPerMonth: 1_000,
    requestsPerMinute: 5,
    booksPerRequest: 0,
    edgeAccess: false,
    playByPlay: false,
    injuryAccess: false,
    historicalDays: 7,
    sports: ['nfl', 'nba', 'mlb', 'nhl'],
  },
  hobbyist: {
    label: 'Hobbyist',
    rank: 1,
    requestsPerMonth: 50_000,
    requestsPerMinute: 30,
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
    requestsPerMonth: 500_000,
    requestsPerMinute: 120,
    booksPerRequest: Infinity,
    edgeAccess: true,
    playByPlay: true,
    injuryAccess: true,
    historicalDays: 365,
    sports: 'all',
  },
  enterprise: {
    label: 'Enterprise',
    rank: 3,
    requestsPerMonth: Infinity,
    requestsPerMinute: Infinity,
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

// Numeric rank for comparison: free=0, hobbyist=1, pro=2, enterprise=3
export function tierMeetsMinimum(userTier, requiredTier) {
  const user = TIERS[userTier]
  const required = TIERS[requiredTier]
  if (!user || !required) return false
  return user.rank >= required.rank
}
