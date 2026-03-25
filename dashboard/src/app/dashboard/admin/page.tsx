'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface AdminStats {
  totalUsers: number
  newUsersThisMonth: number
  activeKeys: number
  platformCreditsUsed: number
  topUsers: {
    id: string
    email: string
    tier: string
    creditsUsed: number
    creditsLimit: number
  }[]
}

async function fetchAdminStats(): Promise<AdminStats | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const res = await fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.success ? data.data : null
}

const TIER_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  starter: 'text-blue-400',
  pro: 'text-[#e8ff47]',
  business: 'text-purple-400',
  enterprise: 'text-orange-400',
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      fetchAdminStats()
        .then(setStats)
        .finally(() => setFetching(false))
    }
  }, [loading, user])

  if (loading || fetching) {
    return <div className="text-zinc-400 text-sm">Loading...</div>
  }

  if (!stats) {
    return <div className="text-zinc-400 text-sm">Failed to load admin stats.</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="text-zinc-400 text-sm mt-1">Platform overview and user metrics</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers.toLocaleString()} />
        <StatCard label="New This Month" value={stats.newUsersThisMonth.toLocaleString()} />
        <StatCard label="Active API Keys" value={stats.activeKeys.toLocaleString()} />
        <StatCard
          label="Platform Credits Used"
          value={stats.platformCreditsUsed >= 1_000_000
            ? `${(stats.platformCreditsUsed / 1_000_000).toFixed(2)}M`
            : stats.platformCreditsUsed >= 1_000
            ? `${(stats.platformCreditsUsed / 1_000).toFixed(1)}K`
            : stats.platformCreditsUsed.toLocaleString()}
        />
      </div>

      {/* Top users table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Top Users by Credits Used</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Current billing period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Tier</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Credits Used</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Limit</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">Usage %</th>
              </tr>
            </thead>
            <tbody>
              {stats.topUsers.map((u, i) => {
                const isUnlimited = u.creditsLimit === null || u.creditsLimit === Infinity || u.creditsLimit > 1e14
                const pct = isUnlimited ? 0 : u.creditsLimit === 0 ? 0 : Math.min(100, (u.creditsUsed / u.creditsLimit) * 100)
                return (
                  <tr key={u.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                    <td className="px-5 py-3 text-zinc-300 font-mono text-xs">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium uppercase ${TIER_COLORS[u.tier] || 'text-zinc-400'}`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-300">{u.creditsUsed.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-zinc-500">{isUnlimited ? '∞' : u.creditsLimit.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      {isUnlimited ? (
                        <span className="text-zinc-500">—</span>
                      ) : (
                        <span className={pct > 90 ? 'text-red-400' : pct > 70 ? 'text-yellow-400' : 'text-zinc-400'}>
                          {Math.round(pct)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {stats.topUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-zinc-500 text-sm">No users yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
      <p className="text-xs text-zinc-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}
