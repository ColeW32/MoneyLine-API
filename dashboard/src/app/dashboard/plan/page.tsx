'use client'

import { useEffect, useState } from 'react'
import { getPlan, updateAutoUpgrade, type PlanData } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { TIER_PRICES, TIER_CREDITS, TIER_LABELS, TIER_ORDER } from '@/lib/constants'

/** Format a date as "March 31, 2026" */
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Animated shimmer bar for skeleton loading */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white/5 rounded animate-pulse ${className}`} />
  )
}

export default function PlanPage() {
  const { user, refreshUser } = useAuth()
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [autoUpgrade, setAutoUpgrade] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getPlan()
      .then((r) => {
        setPlan(r.data)
        setAutoUpgrade(r.data.autoUpgrade)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function handleAutoUpgradeToggle() {
    setToggling(true)
    try {
      const newValue = !autoUpgrade
      await updateAutoUpgrade(newValue)
      setAutoUpgrade(newValue)
      refreshUser()
    } catch {
      // Revert on error
    }
    setToggling(false)
  }

  // Note: Infinity becomes null after JSON serialization from the API
  const features = [
    { key: 'creditsPerMonth', label: 'Credits / month', format: (v: number | null) => v == null || v === Infinity ? 'Unlimited' : v.toLocaleString() },
    { key: 'requestsPerMinute', label: 'Rate limit / min', format: (v: number | null) => v == null || v === Infinity ? 'Unlimited' : String(v) },
    { key: 'sports', label: 'Sports access', format: (v: string | string[] | null) => v === 'all' ? 'All sports' : Array.isArray(v) ? v.join(', ').toUpperCase() : v ? String(v) : '—' },
    { key: 'edgeAccess', label: 'Edge data (arb, EV)', format: (v: boolean | null) => v ? 'Yes' : '—' },
    { key: 'playByPlay', label: 'Play-by-play', format: (v: boolean | null) => v ? 'Yes' : '—' },
    { key: 'injuryAccess', label: 'Injury reports', format: (v: boolean | null) => v ? 'Yes' : '—' },
    { key: 'booksPerRequest', label: 'Sportsbooks per request', format: (v: number | null) => v === 0 ? '—' : v == null || v === Infinity ? 'All' : String(v) },
    { key: 'historicalDays', label: 'Historical data', format: (v: number | null) => v == null || v === Infinity ? 'Unlimited' : `${v} days` },
  ]

  const currentTier = user?.tier || 'free'
  const currentRank = plan?.allTiers.find((t) => t.id === currentTier)?.rank ?? 0

  // Credit usage for the header
  const creditsUsed = plan?.creditsUsed ?? 0
  const creditsLimit = (plan?.tierConfig as Record<string, unknown>)?.creditsPerMonth as number ?? 0
  const isUnlimited = creditsLimit === Infinity || creditsLimit === null
  const usagePct = isUnlimited ? 0 : creditsLimit === 0 ? 0 : Math.min(100, (creditsUsed / creditsLimit) * 100)

  // Split tiers into two rows for responsive layout
  const topRow = plan?.allTiers.filter((t) => ['free', 'starter', 'pro'].includes(t.id)) ?? []
  const bottomRow = plan?.allTiers.filter((t) => ['business', 'enterprise'].includes(t.id)) ?? []

  const hasCard = plan?.cardOnFile ?? false

  function renderTierCard(tier: PlanData['allTiers'][number]) {
    const isCurrent = tier.id === currentTier
    const isPopular = tier.id === 'pro'
    const tierRank = (tier as Record<string, unknown>).rank as number ?? 0
    const canUpgrade = tierRank > (currentRank as number) && tier.id !== 'enterprise'

    return (
      <div
        key={tier.id}
        className={`rounded-xl border p-5 relative ${
          isCurrent
            ? 'bg-[#e8ff47]/5 border-[#e8ff47]/30'
            : isPopular
            ? 'bg-[#1a1d27] border-[#e8ff47]/20'
            : 'bg-[#1a1d27] border-white/5'
        }`}
      >
        {isPopular && (
          <span className="absolute -top-2.5 left-4 bg-[#e8ff47] text-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Most Popular
          </span>
        )}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-semibold">{tier.label}</h3>
          {isCurrent && (
            <span className="text-xs bg-[#e8ff47] text-[#1a1a1a] px-2 py-0.5 rounded-full font-medium">
              Current
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-white mt-1 mb-1">
          {TIER_PRICES[tier.id]}
          {tier.priceMonthly !== null && tier.priceMonthly > 0 && (
            <span className="text-sm text-zinc-500 font-normal">/mo</span>
          )}
        </p>
        <p className="text-xs text-zinc-400 mb-4">
          {TIER_CREDITS[tier.id]} credits/mo
        </p>
        <ul className="space-y-2 text-sm">
          {features.map((f) => {
            const val = tier[f.key]
            const display = f.format(val as never)
            return (
              <li key={f.key} className="flex justify-between">
                <span className="text-zinc-400 text-xs">{f.label}</span>
                <span className={`text-xs ${display === '—' ? 'text-zinc-600' : 'text-zinc-200'}`}>
                  {display}
                </span>
              </li>
            )
          })}
          {tier.id === 'business' && tier.overageRate && (
            <li className="flex justify-between">
              <span className="text-zinc-400 text-xs">Overage billing</span>
              <span className="text-xs text-zinc-200">${tier.overageRate}/credit</span>
            </li>
          )}
        </ul>
        {canUpgrade && (
          <button className="w-full mt-4 h-9 rounded-lg bg-[#e8ff47] text-[#1a1a1a] text-sm font-medium hover:bg-[#d4eb3f] transition-colors">
            Upgrade
          </button>
        )}
        {tier.id === 'enterprise' && !isCurrent && (
          <a
            href="mailto:enterprise@moneylineapp.com"
            className="w-full mt-4 h-9 rounded-lg border border-[#e8ff47]/30 text-[#e8ff47] text-sm font-medium hover:bg-[#e8ff47]/10 transition-colors flex items-center justify-center"
          >
            Contact Sales
          </a>
        )}
      </div>
    )
  }

  /** Skeleton version of a tier card — matches real card dimensions */
  function renderTierSkeleton(id: string) {
    return (
      <div key={id} className="rounded-xl border border-white/5 bg-[#1a1d27] p-5">
        <Shimmer className="h-4 w-16 mb-2" />
        <Shimmer className="h-7 w-20 mb-1" />
        <Shimmer className="h-3 w-24 mb-4" />
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.key} className="flex justify-between">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-3 w-12" />
            </div>
          ))}
        </div>
        <Shimmer className="h-9 w-full mt-4 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Plan & Billing</h1>

      {/* Credit usage summary — skeleton when loading */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-zinc-400 font-medium">Credit Usage This Period</p>
          {plan?.billingCycleEnd ? (
            <p className="text-xs text-zinc-500">Resets {formatDate(plan.billingCycleEnd)}</p>
          ) : (
            <Shimmer className="h-3 w-32" />
          )}
        </div>
        {plan ? (
          <>
            <div className="text-2xl font-bold text-white">
              {creditsUsed.toLocaleString()}
              <span className="text-sm text-zinc-500 font-normal ml-1">
                / {isUnlimited ? '∞' : creditsLimit.toLocaleString()} credits
              </span>
            </div>
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct > 90 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-[#e8ff47]'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            {plan.overageCredits > 0 && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-yellow-400">
                  {plan.overageCredits.toLocaleString()} overage credits
                </p>
                <p className="text-xs text-yellow-400">
                  Overage cost: ${plan.overageCost.toFixed(2)}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <Shimmer className="h-7 w-48 mb-3" />
            <div className="h-1.5 bg-white/5 rounded-full" />
          </>
        )}
      </div>

      {/* Auto-upgrade + payment method section */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">Auto-Upgrade</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Automatically upgrade your plan if you exceed your credit limit.
            </p>
          </div>
          <button
            onClick={handleAutoUpgradeToggle}
            disabled={toggling}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
              autoUpgrade ? 'bg-[#e8ff47]' : 'bg-zinc-600'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                autoUpgrade ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Payment method CTA — shown when auto-upgrade is on but no card */}
        {autoUpgrade && !hasCard && loaded && (
          <div className="mt-4 bg-gradient-to-r from-[#e8ff47]/[0.06] to-[#e8ff47]/[0.02] border border-[#e8ff47]/15 rounded-xl p-5">
            <div className="flex items-start gap-4">
              {/* Card icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#e8ff47]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#e8ff47]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-white font-semibold text-sm">Add a payment method</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8ff47] bg-[#e8ff47]/10 px-2 py-0.5 rounded-full">
                    $0.00 due today
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You won&apos;t be charged until you upgrade or exceed your credit limit.
                  Adding a card now ensures auto-upgrade can activate seamlessly — no interruptions to your API access.
                </p>
                <button className="mt-3 inline-flex items-center gap-2 bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#d4eb3f] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add payment method
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Warning when auto-upgrade is off */}
        {!autoUpgrade && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <p className="text-sm text-red-400">
              <span className="font-medium">Warning:</span> Your API access will be suspended if you exceed your credit limit. We recommend keeping auto-upgrade enabled to avoid service interruption.
            </p>
          </div>
        )}
      </div>

      {/* Tier card grid — 3 on top, 2 on bottom, stacks responsively */}
      <div className="space-y-4">
        {/* Row 1: Free, Starter, Pro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plan
            ? topRow.map(renderTierCard)
            : ['free', 'starter', 'pro'].map(renderTierSkeleton)
          }
        </div>
        {/* Row 2: Business, Enterprise */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plan
            ? bottomRow.map(renderTierCard)
            : ['business', 'enterprise'].map(renderTierSkeleton)
          }
        </div>
      </div>

      {/* Enterprise CTA for Business tier users */}
      {currentTier === 'business' && (
        <div className="bg-gradient-to-r from-[#1a1d27] to-[#1e2133] rounded-xl border border-[#e8ff47]/20 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">Need more?</h3>
              <p className="text-zinc-400 text-sm mt-1">
                Get unlimited credits, webhooks, dedicated support, and custom SLAs with Enterprise.
              </p>
              {plan && plan.overageCredits > 0 && (
                <p className="text-yellow-400 text-sm mt-2">
                  You have {plan.overageCredits.toLocaleString()} overage credits this period (${plan.overageCost.toFixed(2)}). Enterprise eliminates overage costs.
                </p>
              )}
            </div>
            <a
              href="mailto:enterprise@moneylineapp.com"
              className="flex-shrink-0 bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-[#d4eb3f] transition-colors"
            >
              Let&apos;s talk Enterprise
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
