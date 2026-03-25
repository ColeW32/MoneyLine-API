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

interface HealthResult {
  endpointId: string
  category: string
  label: string
  path: string
  tier: string
  status: 'ok' | 'fail' | 'empty' | 'pending' | 'skip'
  statusCode: number | null
  responseTimeMs: number | null
  error: string | null
  checkedAt: string | null
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

async function fetchAdminStats(): Promise<AdminStats | null> {
  const session = await getSession()
  if (!session) return null
  const res = await fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.success ? data.data : null
}

async function fetchHealth(): Promise<HealthResult[] | null> {
  const session = await getSession()
  if (!session) return null
  const res = await fetch('/api/admin/health', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const data = await res.json()
  return data.success ? data.data.results : null
}

async function triggerHealthRun(): Promise<void> {
  const session = await getSession()
  if (!session) return
  await fetch('/api/admin/health/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

const TIER_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  starter: 'text-blue-400',
  pro: 'text-[#e8ff47]',
  business: 'text-purple-400',
  enterprise: 'text-orange-400',
}

const STATUS_CONFIG = {
  ok:      { dot: 'bg-green-400',  text: 'text-green-400',  label: 'OK' },
  empty:   { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Empty' },
  fail:    { dot: 'bg-red-400',    text: 'text-red-400',    label: 'Fail' },
  pending: { dot: 'bg-zinc-500',   text: 'text-zinc-500',   label: 'Pending' },
  skip:    { dot: 'bg-zinc-600',   text: 'text-zinc-500',   label: 'Skip' },
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [health, setHealth] = useState<HealthResult[] | null>(null)
  const [fetching, setFetching] = useState(true)
  const [runningChecks, setRunningChecks] = useState(false)

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      Promise.all([fetchAdminStats(), fetchHealth()])
        .then(([s, h]) => { setStats(s); setHealth(h) })
        .finally(() => setFetching(false))
    }
  }, [loading, user])

  async function handleRunChecks() {
    setRunningChecks(true)
    await triggerHealthRun()
    // Poll for results after a short delay to let checks complete
    setTimeout(async () => {
      const h = await fetchHealth()
      if (h) setHealth(h)
      setRunningChecks(false)
    }, 8_000)
  }

  if (loading || fetching) {
    return <div className="text-zinc-400 text-sm">Loading...</div>
  }

  if (!stats) {
    return <div className="text-zinc-400 text-sm">Failed to load admin stats.</div>
  }

  const healthByCategory = health
    ? health.reduce<Record<string, HealthResult[]>>((acc, r) => {
        ;(acc[r.category] ||= []).push(r)
        return acc
      }, {})
    : {}

  const healthSummary = health
    ? {
        ok: health.filter((r) => r.status === 'ok').length,
        empty: health.filter((r) => r.status === 'empty').length,
        fail: health.filter((r) => r.status === 'fail').length,
        pending: health.filter((r) => r.status === 'pending').length,
      }
    : null

  const lastChecked = health?.find((r) => r.checkedAt)?.checkedAt

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

      {/* Health monitoring */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">API Health</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {lastChecked
                ? `Last checked ${new Date(lastChecked).toLocaleString()}`
                : 'Checks run every hour and on server startup'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {healthSummary && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-400">{healthSummary.ok} ok</span>
                {healthSummary.empty > 0 && <span className="text-yellow-400">{healthSummary.empty} empty</span>}
                {healthSummary.fail > 0 && <span className="text-red-400">{healthSummary.fail} fail</span>}
                {healthSummary.pending > 0 && <span className="text-zinc-500">{healthSummary.pending} pending</span>}
              </div>
            )}
            <button
              onClick={handleRunChecks}
              disabled={runningChecks}
              className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {runningChecks ? 'Running...' : 'Run Now'}
            </button>
          </div>
        </div>

        {health && Object.entries(healthByCategory).map(([category, results]) => (
          <div key={category}>
            <div className="px-5 py-2 bg-white/[0.02] border-b border-white/5">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{category}</span>
            </div>
            {results.map((r) => {
              const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
              return (
                <div key={r.endpointId} className="flex items-center gap-4 px-5 py-3 border-b border-white/5 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-zinc-200">{r.label}</span>
                    <span className="ml-2 text-xs text-zinc-600 font-mono">{r.path}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs">
                    {r.responseTimeMs !== null && (
                      <span className="text-zinc-500">{r.responseTimeMs}ms</span>
                    )}
                    {r.statusCode !== null && (
                      <span className="text-zinc-500">HTTP {r.statusCode}</span>
                    )}
                    <span className={`font-medium w-12 text-right ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  {r.error && (
                    <div className="w-full pl-6 -mt-1 pb-2 text-xs text-red-400 font-mono truncate">
                      {r.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {!health && (
          <div className="px-5 py-8 text-center text-zinc-500 text-sm">No health data yet</div>
        )}
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
