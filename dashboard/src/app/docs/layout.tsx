import Link from 'next/link'
import { DocsSidebar } from '@/components/docs/DocsSidebar'
import { TableOfContents } from '@/components/docs/TableOfContents'

export const metadata = {
  title: 'Documentation — MoneyLine API',
  description: 'API documentation for MoneyLine — scores, odds, player props, and edge data for NFL, NBA, MLB, and NHL.',
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen ml-page-bg" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 border-b border-[#e0e0e0] bg-[#f5f2eb]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold ml-text tracking-tight">
            Money <span className="text-[#6b7280] font-light">\</span> Line
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/docs" className="text-sm font-medium ml-text">Docs</Link>
            <Link href="/#pricing" className="text-sm font-medium ml-text hidden sm:block">Pricing</Link>
            <Link href="/dashboard" className="text-sm font-medium ml-text hidden sm:block">Dashboard</Link>
            <Link href="/signup" className="bg-[#1a1a1a] text-white text-sm font-medium px-5 py-2 rounded-full hover:border-[#e8ff47] hover:border transition-colors">
              Get API Key
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0">
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="fixed top-14 w-56 h-[calc(100vh-3.5rem)] overflow-y-auto pr-6 pt-10 pb-10">
            <DocsSidebar />
          </div>
        </aside>
        <main className="flex-1 min-w-0 max-w-3xl py-10">
          {children}
        </main>
        <div className="hidden xl:block">
          <TableOfContents />
        </div>
      </div>
    </div>
  )
}
