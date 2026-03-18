'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getUsage, listKeys, type UsageData, type ApiKey } from '@/lib/api'
import { TIER_LABELS } from '@/lib/constants'
import Link from 'next/link'

export default function DashboardOverview() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])

  useEffect(() => {
    getUsage(30).then((r) => setUsage(r.data)).catch(() => {})
    listKeys().then((r) => setKeys(r.data)).catch(() => {})
  }, [])

  const usagePct = usage
    ? usage.monthlyLimit === 0 ? 0 : Math.min(100, (usage.monthlyTotal / usage.monthlyLimit) * 100)
    : 0

  const activeKeys = keys.filter((k) => k.status === 'active')
  const firstKey = activeKeys[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm">Welcome back, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Usage card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Monthly Requests</p>
          <div className="text-2xl font-bold text-white">
            {usage?.monthlyTotal.toLocaleString() ?? '—'}
            <span className="text-sm text-zinc-500 font-normal ml-1">
              / {usage?.monthlyLimit === Infinity ? '∞' : usage?.monthlyLimit?.toLocaleString() ?? '—'}
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct > 90 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-[#e8ff47]'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {/* Tier card */}
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Current Plan</p>
          <span className="inline-block bg-[#e8ff47] text-[#1a1a1a] text-sm font-semibold px-3 py-1 rounded-full">
            {TIER_LABELS[user?.tier || 'free']}
          </span>
          <p className="text-xs text-zinc-500 mt-3">
            {user?.tier === 'free' ? 'Upgrade for odds, injuries, and edge data' : 'Full access to all endpoints'}
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
{`curl https://api.moneylineapi.com/v1/events/today \\
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
