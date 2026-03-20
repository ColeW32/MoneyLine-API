'use client'

import { useEffect, useState } from 'react'
import { getUsage, type UsageData } from '@/lib/api'

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    getUsage(30).then((r) => setUsage(r.data)).catch(() => {})
  }, [])

  const maxDaily = usage
    ? Math.max(...usage.dailyCounts.map((d) => d.count), 1)
    : 1

  const creditsUsed = usage?.creditsUsed ?? 0
  const creditsLimit = usage?.creditsLimit ?? 0
  const isUnlimited = creditsLimit === Infinity || creditsLimit === null
  const usagePct = isUnlimited ? 0 : creditsLimit === 0 ? 0 : Math.min(100, (creditsUsed / creditsLimit) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usage</h1>
        {usage?.billingCycleStart && usage?.billingCycleEnd && (
          <p className="text-zinc-400 text-sm mt-1">
            Billing period: {new Date(usage.billingCycleStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &mdash; {new Date(usage.billingCycleEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Credit progress bar */}
      {usage && (
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400 font-medium">Credits Used</p>
            <p className="text-xs text-zinc-500">
              {isUnlimited ? '' : `${Math.round(usagePct)}% of limit`}
            </p>
          </div>
          <div className="text-2xl font-bold text-white">
            {creditsUsed.toLocaleString()}
            <span className="text-sm text-zinc-500 font-normal ml-1">
              / {isUnlimited ? '∞' : creditsLimit.toLocaleString()} credits
            </span>
          </div>
          <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePct > 90 ? 'bg-red-400' : usagePct > 70 ? 'bg-yellow-400' : 'bg-[#e8ff47]'
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usage.overageCredits > 0 && (
            <p className="text-xs text-yellow-400 mt-2">
              {usage.overageCredits.toLocaleString()} overage credits this period
            </p>
          )}
        </div>
      )}

      {/* Usage summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Credits This Month</p>
          <div className="text-2xl font-bold text-white">
            {creditsUsed.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
          <p className="text-xs text-zinc-400 font-medium mb-3">Avg Response Time</p>
          <div className="text-2xl font-bold text-white">
            {usage?.recentRequests?.length
              ? Math.round(
                  usage.recentRequests.reduce((s, r) => s + r.responseTimeMs, 0) /
                    usage.recentRequests.length
                ) + 'ms'
              : '—'}
          </div>
        </div>
      </div>

      {/* Daily chart */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Credits (Last 30 Days)</h2>
        {usage?.dailyCounts.length ? (
          <div className="flex items-end gap-1 h-40">
            {usage.dailyCounts.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full bg-[#e8ff47]/70 rounded-sm min-h-[2px] transition-all hover:bg-[#e8ff47]"
                  style={{ height: `${(d.count / maxDaily) * 100}%` }}
                />
                <div className="absolute -top-8 bg-[#1a1d27] text-white text-xs px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {d.date}: {d.count.toLocaleString()} credits
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-8">No usage data yet. Start making API requests!</p>
        )}
      </div>

      {/* Recent requests table */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Recent Requests</h2>
        {usage?.recentRequests?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-zinc-400 text-left">
                  <th className="pb-2 font-medium">Endpoint</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {usage.recentRequests.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 text-zinc-300 font-mono text-xs">{r.endpoint}</td>
                    <td className="py-2 text-zinc-400">{r.method}</td>
                    <td className="py-2">
                      <span className={r.statusCode < 400 ? 'text-[#e8ff47]' : 'text-red-400'}>
                        {r.statusCode}
                      </span>
                    </td>
                    <td className="py-2 text-zinc-400">{r.responseTimeMs}ms</td>
                    <td className="py-2 text-zinc-500 text-xs">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-4">No requests logged yet.</p>
        )}
      </div>
    </div>
  )
}
