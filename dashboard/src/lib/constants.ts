export const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
}

export const TIER_PRICES: Record<string, string> = {
  free: '$0',
  starter: '$29',
  pro: '$149',
  business: '$299',
  enterprise: 'Custom',
}

export const TIER_CREDITS: Record<string, string> = {
  free: '1K',
  starter: '150K',
  pro: '1.5M',
  business: '5M',
  enterprise: 'Unlimited',
}

export const TIER_ORDER = ['free', 'starter', 'pro', 'business', 'enterprise'] as const

/** Monthly price in dollars (null = custom/contact sales) */
export const TIER_MONTHLY_COST: Record<string, number | null> = {
  free: 0,
  starter: 29,
  pro: 149,
  business: 299,
  enterprise: null,
}

/** Credits per month as a number (null = unlimited) */
export const TIER_CREDITS_NUM: Record<string, number | null> = {
  free: 1_000,
  starter: 150_000,
  pro: 1_500_000,
  business: 5_000_000,
  enterprise: null,
}

/** Get the next tier up from the given tier, or null if at top */
export function getNextTier(tier: string): string | null {
  const idx = TIER_ORDER.indexOf(tier as typeof TIER_ORDER[number])
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1]
}

/** Calculate prorated upgrade cost based on how far into the billing cycle */
export function getProratedUpgradeCost(
  currentTier: string,
  targetTier: string,
  billingCycleEnd?: string | null
): number {
  const currentCost = TIER_MONTHLY_COST[currentTier] ?? 0
  const targetCost = TIER_MONTHLY_COST[targetTier]
  if (targetCost == null) return 0 // Enterprise = contact sales

  const diff = targetCost - currentCost
  if (diff <= 0) return 0

  // If no billing cycle info, assume full month
  if (!billingCycleEnd) return diff

  const now = new Date()
  const end = new Date(billingCycleEnd)
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)

  const totalDays = (end.getTime() - start.getTime()) / 86_400_000
  const remainingDays = Math.max(0, (end.getTime() - now.getTime()) / 86_400_000)
  const fraction = totalDays > 0 ? remainingDays / totalDays : 1

  return Math.round(diff * fraction * 100) / 100
}
