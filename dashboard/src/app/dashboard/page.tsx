'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getUsage, listKeys, type UsageData, type ApiKey } from '@/lib/api'
import { TIER_LABELS, TIER_CREDITS } from '@/lib/constants'
import Link from 'next/link'

export default function DashboardOverview() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])

  useEffect(() => {
    getUsage(30).then((r) => setUsage(r.data)).catch(() => {})
    listKeys().then((r) => setKeys(r.data)).catch(() => {})
  }, [])

  const creditsUsed = usage?.creditsUsed ?? 0
  const creditsLimit = usage?.creditsLimit ?? 0
  const isUnlimited = creditsLimit === Infinity || creditsLimit === null
  const usagePct = isUnlimited ? 0 : creditsLimit === 0 ? 0 : Math.min(100, (creditsUsed / creditsLimit) * 100)

  const activeKeys = keys.filter((k) => k.status === 'active')
  const firstKey = activeKeys[0]

  // Color transitions: green (<70%), yellow (70-90%), red (>90%)
  const barColor = usagePct > 90 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-[#e8ff47]'

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
              Resets {new Date(usage.billingCycleEnd).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Tier card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Current Plan</p>
          <span className="inline-block bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold px-3 py-1 rounded-full">
            {TIER_LABELS[user?.tier || 'free']}
          </span>
          <p className="text-xs text-zinc-400 mt-2">
            {TIER_CREDITS[user?.tier || 'free']} credits/month
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {user?.tier === 'free'
              ? 'Upgrade for odds, injuries, and edge data'
              : user?.tier === 'starter'
              ? 'Upgrade for edge data and play-by-play'
              : 'Full access to all endpoints'}
          </p>
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
    </div>
  )
}
