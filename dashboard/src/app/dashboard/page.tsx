'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getUsage, getBillingStatus, listKeys, type UsageData, type BillingStatus, type ApiKey } from '@/lib/api'
import { TIER_LABELS, TIER_CREDITS, getNextTier, getProratedUpgradeCost, TIER_CREDITS_NUM } from '@/lib/constants'
import Link from 'next/link'

/** Format a date as "March 31, 2026" */
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Credit Card Modal (UI only — Stripe integration later) ────────

function CardModal({
  open,
  onClose,
  proratedCost,
  targetTier,
}: {
  open: boolean
  onClose: () => void
  proratedCost: number
  targetTier: string | null
}) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')

  if (!open) return null

  /** Format card number with spaces every 4 digits */
  function handleCardInput(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 16)
    setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '))
  }

  /** Format expiry as MM/YY */
  function handleExpiryInput(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) {
      setExpiry(digits.slice(0, 2) + '/' + digits.slice(2))
    } else {
      setExpiry(digits)
    }
  }

  const costLabel = proratedCost === 0
    ? '$0.00 due today'
    : `$${proratedCost.toFixed(2)} due today`

  const monthlyPrice = targetTier === 'starter' ? '$29' : targetTier === 'pro' ? '$149' : targetTier === 'business' ? '$299' : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#13151d] border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white">Add payment method</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-xs font-bold text-[#e8ff47] bg-[#e8ff47]/10 px-2.5 py-1 rounded-full">
              {costLabel}
            </span>
            {monthlyPrice && proratedCost > 0 && (
              <span className="text-xs text-zinc-500">
                then {monthlyPrice}/mo
              </span>
            )}
          </div>
          {targetTier && (
            <p className="text-xs text-zinc-400 mt-2">
              {proratedCost === 0
                ? "You won't be charged until you upgrade or exceed your credit limit."
                : `Unlocks ${TIER_CREDITS[targetTier]} credits/month on the ${TIER_LABELS[targetTier]} plan.`
              }
            </p>
          )}
        </div>

        {/* Card brand indicators */}
        <div className="px-6 pb-3 flex items-center gap-2">
          {['Visa', 'Mastercard', 'Amex'].map((brand) => (
            <span key={brand} className="text-[10px] font-medium text-zinc-500 border border-white/10 px-2 py-0.5 rounded">
              {brand}
            </span>
          ))}
        </div>

        {/* Form */}
        <div className="px-6 pb-6 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1 block">Cardholder name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name on card"
              className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#e8ff47]/40 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1 block">Card number</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => handleCardInput(e.target.value)}
              placeholder="1234 5678 9012 3456"
              className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#e8ff47]/40 focus:outline-none transition-colors font-mono tracking-wider"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1 block">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => handleExpiryInput(e.target.value)}
                placeholder="MM/YY"
                className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#e8ff47]/40 focus:outline-none transition-colors font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 font-medium mb-1 block">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#e8ff47]/40 focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <button className="w-full mt-2 bg-[#e8ff47] text-[#1a1a1a] text-sm font-bold py-3 rounded-lg hover:bg-[#d4eb3f] transition-colors">
            {proratedCost === 0 ? 'Save payment method' : `Pay $${proratedCost.toFixed(2)} & upgrade`}
          </button>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[11px] text-zinc-500">Secured with 256-bit encryption</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard Overview ───────────────────────────────────────

export default function DashboardOverview() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showCardModal, setShowCardModal] = useState(false)

  useEffect(() => {
    getUsage(30).then((r) => setUsage(r.data)).catch(() => {})
    getBillingStatus().then((r) => setBilling(r.data)).catch(() => {})
    listKeys().then((r) => setKeys(r.data)).catch(() => {})
  }, [])

  const tier = user?.tier || 'free'
  const isFree = tier === 'free'
  const autoUpgrade = user?.autoUpgrade ?? true
  const hasCard = user?.cardOnFile ?? false

  const creditsUsed = usage?.creditsUsed ?? 0
  const creditsLimit = usage?.creditsLimit ?? 0
  const isUnlimited = creditsLimit === Infinity || creditsLimit === null
  const usagePct = isUnlimited ? 0 : creditsLimit === 0 ? 0 : Math.min(100, (creditsUsed / creditsLimit) * 100)
  const barColor = usagePct > 90 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-[#e8ff47]'

  const activeKeys = keys.filter((k) => k.status === 'active')
  const firstKey = activeKeys[0]

  // Proration math for non-free users
  const nextTier = getNextTier(tier)
  const proratedCost = nextTier
    ? getProratedUpgradeCost(tier, nextTier, billing?.billingCycleEnd)
    : 0
  const nextTierCredits = nextTier ? TIER_CREDITS[nextTier] : null
  const currentCreditsNum = TIER_CREDITS_NUM[tier] ?? 0
  const nextCreditsNum = nextTier ? (TIER_CREDITS_NUM[nextTier] ?? 0) : 0
  const additionalCredits = nextCreditsNum && currentCreditsNum
    ? nextCreditsNum - currentCreditsNum
    : 0

  // Conditional logic for what to show:
  // Free + no card → "Enable auto-upgrade, $0 due today" CTA in Current Plan card
  // Free + card + auto-upgrade on → nothing extra
  // Paid + auto-upgrade off → upgrade prompt inside Credit Usage card with prorated cost
  // Paid + auto-upgrade on → nothing extra (billing is set up perfectly)
  const showFreeUpgradeCta = isFree && !hasCard
  const showPaidAutoUpgradeCta = !isFree && !autoUpgrade

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm">Welcome back, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Credit Usage card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Credit Usage</p>
          <div className="text-2xl font-bold text-white">
            {creditsUsed.toLocaleString()}
            <span className="text-sm text-zinc-500 font-normal ml-1">
              / {isUnlimited ? '∞' : creditsLimit.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usage?.overageCredits ? (
            <p className="text-xs text-yellow-400 mt-2">
              {usage.overageCredits.toLocaleString()} overage credits this period
            </p>
          ) : null}
          {usage?.billingCycleEnd && (
            <p className="text-xs text-zinc-500 mt-1">
              Resets {formatDate(usage.billingCycleEnd)}
            </p>
          )}

          {/* Paid user, auto-upgrade OFF → show upgrade prompt inside credit card */}
          {showPaidAutoUpgradeCta && nextTier && (
            <div className="mt-4 bg-[#e8ff47]/[0.06] border border-[#e8ff47]/15 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">Enable Auto-Upgrade</h4>
                <span className="text-[10px] font-bold text-[#e8ff47] bg-[#e8ff47]/10 px-2 py-0.5 rounded-full">
                  ${proratedCost.toFixed(2)} billed today
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-1">
                Upgrade to {TIER_LABELS[nextTier]} and unlock{' '}
                <span className="text-zinc-200 font-medium">
                  {additionalCredits > 0 ? `${additionalCredits.toLocaleString()} additional credits/mo` : `${nextTierCredits} credits/mo`}
                </span>
              </p>
              <p className="text-[11px] text-zinc-500 mb-3">
                Prorated for the remainder of your billing cycle. Then {TIER_LABELS[nextTier]} pricing applies.
              </p>
              <button
                onClick={() => setShowCardModal(true)}
                className="w-full bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold py-2 rounded-lg hover:bg-[#d4eb3f] transition-colors"
              >
                Upgrade to {TIER_LABELS[nextTier]}
              </button>
            </div>
          )}
        </div>

        {/* Current Plan card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Current Plan</p>
          <Link href="/dashboard/plan">
            <span className="inline-block bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold px-3 py-1 rounded-full hover:bg-[#d4eb3f] transition-colors cursor-pointer">
              {TIER_LABELS[tier]}
            </span>
          </Link>
          <p className="text-xs text-zinc-400 mt-2">
            {TIER_CREDITS[tier]} credits/month
          </p>

          {/* Free user, no card → enable auto-upgrade CTA */}
          {showFreeUpgradeCta ? (
            <div className="mt-3 bg-[#e8ff47]/[0.06] border border-[#e8ff47]/15 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <svg className="w-4 h-4 text-[#e8ff47] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-xs font-semibold text-white">Enable auto-upgrade</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2.5">
                Add a card now so your plan upgrades automatically if you hit your limit. No charge until you upgrade.
              </p>
              <button
                onClick={() => setShowCardModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-[#e8ff47] text-[#1a1a1a] text-xs font-bold py-2 rounded-lg hover:bg-[#d4eb3f] transition-colors"
              >
                $0.00 due today — Add card
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 mt-1">
              {isFree
                ? 'Upgrade for odds, injuries, and edge data'
                : tier === 'starter'
                ? 'Upgrade for edge data and play-by-play'
                : 'Full access to all endpoints'}
            </p>
          )}
        </div>

        {/* Keys card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Active API Keys</p>
          <div className="text-2xl font-bold text-white">{activeKeys.length}</div>
          <p className="text-xs text-zinc-500 mt-3">
            {activeKeys.length === 0 ? (
              <Link href="/dashboard/keys" className="text-[#e8ff47] hover:underline">Create your first key</Link>
            ) : `${5 - activeKeys.length} keys remaining`}
          </p>
        </div>
      </div>

      {/* Quick start */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Quick Start</h2>
        <pre className="bg-[#0a0b0f] border border-white/5 rounded-lg p-4 text-sm overflow-x-auto">
          <code className="text-zinc-300">
{`curl https://mlapi.bet/v1/events/today \\
  -H "x-api-key: ${firstKey?.keyPrefix || 'YOUR_API_KEY'}••••••••••••••••••••••••"`}
          </code>
        </pre>
        <p className="text-xs text-zinc-500 mt-3">
          Replace with your full API key. Go to{' '}
          <Link href="/dashboard/keys" className="text-[#e8ff47] hover:underline">API Keys</Link> to create one.
        </p>
      </div>

      {/* Credit card modal */}
      <CardModal
        open={showCardModal}
        onClose={() => setShowCardModal(false)}
        proratedCost={showFreeUpgradeCta ? 0 : proratedCost}
        targetTier={showFreeUpgradeCta ? 'starter' : nextTier}
      />
    </div>
  )
}
