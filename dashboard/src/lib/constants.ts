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
