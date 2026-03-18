'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Introduction', href: '/docs' },
      { label: 'Authentication', href: '/docs/authentication' },
    ],
  },
  {
    title: 'Endpoints',
    items: [
      { label: 'Sports & Leagues', href: '/docs/endpoints/leagues' },
      { label: 'Events & Scores', href: '/docs/endpoints/events' },
      { label: 'Teams & Players', href: '/docs/endpoints/teams' },
      { label: 'Odds', href: '/docs/endpoints/odds', tier: 'Hobbyist+' },
      { label: 'Edge Data', href: '/docs/endpoints/edge', tier: 'Pro+' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Rate Limits', href: '/docs/rate-limits' },
      { label: 'Error Codes', href: '/docs/errors' },
    ],
  },
]

export function DocsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="space-y-6">
      {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-md transition-colors ${
                        active
                          ? 'bg-[#1a1a1a] text-white font-medium'
                          : 'text-[#4a4a4a] hover:bg-[#eae8e3] hover:text-[#1a1a1a]'
                      }`}
                    >
                      {item.label}
                      {item.tier && (
                        <span className="text-[9px] font-bold text-[#6b7280] uppercase">{item.tier}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
    </nav>
  )
}
