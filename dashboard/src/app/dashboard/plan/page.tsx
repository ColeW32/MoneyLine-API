'use client'

import { useEffect, useState } from 'react'
import { getPlan, type PlanData } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { TIER_PRICES } from '@/lib/constants'

export default function PlanPage() {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PlanData | null>(null)

  useEffect(() => {
    getPlan().then((r) => setPlan(r.data)).catch(() => {})
  }, [])

  const features = [
    { key: 'requestsPerMonth', label: 'Requests / month', format: (v: number) => v === Infinity ? 'Unlimited' : v.toLocaleString() },
    { key: 'requestsPerMinute', label: 'Rate limit / min', format: (v: number) => v === Infinity ? 'Unlimited' : String(v) },
    { key: 'sports', label: 'Sports access', format: (v: string | string[]) => v === 'all' ? 'All sports' : Array.isArray(v) ? v.join(', ').toUpperCase() : String(v) },
    { key: 'edgeAccess', label: 'Edge data (arb, EV)', format: (v: boolean) => v ? 'Yes' : '—' },
    { key: 'playByPlay', label: 'Play-by-play', format: (v: boolean) => v ? 'Yes' : '—' },
    { key: 'injuryAccess', label: 'Injury reports', format: (v: boolean) => v ? 'Yes' : '—' },
    { key: 'booksPerRequest', label: 'Sportsbooks per request', format: (v: number) => v === 0 ? '—' : v === Infinity ? 'All' : String(v) },
    { key: 'historicalDays', label: 'Historical data', format: (v: number) => v === Infinity ? 'Unlimited' : `${v} days` },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Plan & Billing</h1>

      {plan && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {plan.allTiers.map((tier) => {
            const isCurrent = tier.id === user?.tier
            return (
              <div
                key={tier.id}
                className={`rounded-xl border p-5 ${
                  isCurrent
                    ? 'bg-[#e8ff47]/5 border-[#e8ff47]/30'
                    : 'bg-[#1a1d27] border-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-semibold">{tier.label}</h3>
                  {isCurrent && (
                    <span className="text-xs bg-[#e8ff47] text-[#1a1a1a] px-2 py-0.5 rounded-full font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-white mt-1 mb-4">
                  {TIER_PRICES[tier.id]}
                  {tier.id !== 'enterprise' && tier.id !== 'free' && (
                    <span className="text-sm text-zinc-500 font-normal">/mo</span>
                  )}
                </p>
                <ul className="space-y-2 text-sm">
                  {features.map((f) => {
                    const val = tier[f.key]
                    const display = f.format(val as never)
                    return (
                      <li key={f.key} className="flex justify-between">
                        <span className="text-zinc-400">{f.label}</span>
                        <span className={display === '—' ? 'text-zinc-600' : 'text-zinc-200'}>
                          {display}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {!isCurrent && tier.id !== 'free' && (
                  <button className="w-full mt-4 h-9 rounded-lg bg-[#e8ff47] text-[#1a1a1a] text-sm font-medium hover:bg-[#d4eb3f] transition-colors">
                    {tier.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
