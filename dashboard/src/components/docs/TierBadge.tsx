interface TierBadgeProps {
  tier: 'free' | 'hobbyist' | 'pro' | 'enterprise'
}

const TIER_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  free: { label: 'Free', bg: 'bg-[#e8e8e8]', text: 'text-[#555]' },
  hobbyist: { label: 'Hobbyist+', bg: 'bg-[#dbeafe]', text: 'text-[#1e40af]' },
  pro: { label: 'Pro+', bg: 'bg-[#e8ff47]/30', text: 'text-[#4a5500]' },
  enterprise: { label: 'Enterprise', bg: 'bg-[#f3e8ff]', text: 'text-[#6b21a8]' },
}

export function TierBadge({ tier }: TierBadgeProps) {
  const style = TIER_STYLES[tier] || TIER_STYLES.free
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
