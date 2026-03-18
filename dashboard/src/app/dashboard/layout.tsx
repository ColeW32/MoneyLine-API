'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { useEffect, useState } from 'react'

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/keys',
    label: 'API Keys',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/usage',
    label: 'Usage',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/plan',
    label: 'Plan',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ml-page-bg text-[#6b7280]">
        Loading...
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="h-screen overflow-hidden ml-page-bg flex">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} shrink-0 flex flex-col transition-all duration-200`}>
        {/* Logo + collapse toggle */}
        <div className="h-14 flex items-center justify-between px-4">
          {!collapsed && (
            <Link href="/dashboard" className="text-base font-bold tracking-tight text-[#1a1a1a]">
              Money <span className="font-light">\</span> Line
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`text-[#6b7280] hover:text-[#1a1a1a] transition-colors ${collapsed ? 'mx-auto' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              )}
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-[#4a4a4a] hover:bg-[#e8e6e0] hover:text-[#1a1a1a]'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout at bottom */}
        <div className="p-2">
          <button
            onClick={logout}
            title={collapsed ? 'Log out' : undefined}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[#6b7280] hover:bg-[#e8e6e0] hover:text-[#1a1a1a] transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Top bar */}
        <div className="h-12 shrink-0 flex items-center justify-end gap-3 px-6">
          <span className="text-xs font-medium bg-[#1a1a1a] text-white px-2.5 py-1 rounded-full uppercase tracking-wide">
            {user.tier}
          </span>
          <span className="text-sm text-[#6b7280]">{user.email}</span>
        </div>

        {/* Content — fixed dark card, scrolls internally */}
        <main className="flex-1 min-h-0 pl-3 pr-6 pb-6">
          <div className="bg-[#0f1117] rounded-2xl p-6 sm:p-8 h-full overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
