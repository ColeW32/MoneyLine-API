import { CodeBlock } from '@/components/docs/CodeBlock'

export default function DocsPage() {
  return (
    <div>
      {/* Hero */}
      <h1 className="text-3xl font-bold ml-text">MoneyLine API Documentation</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Unified sports data API for scores, odds, and edge analysis across NFL,
        NBA, MLB, and NHL.
      </p>

      {/* Quick Start */}
      <h2 className="text-xl font-semibold ml-text mt-10 mb-3">Quick Start</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        All requests go through a single base URL:
      </p>
      <CodeBlock code="https://mlapi.bet/v1" />

      <h2 className="text-xl font-semibold ml-text mt-10 mb-3">Get Your API Key</h2>
      <ol className="list-decimal list-inside space-y-1.5 text-[15px] text-[#4a4a4a] leading-relaxed">
        <li>
          <a href="/signup" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">
            Sign up
          </a>{' '}
          for a MoneyLine account.
        </li>
        <li>
          Navigate to the{' '}
          <a href="/dashboard" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">
            Dashboard
          </a>.
        </li>
        <li>Create an API key from the <strong className="font-medium text-[#1a1a1a]">API Keys</strong> section.</li>
      </ol>

      <h2 className="text-xl font-semibold ml-text mt-10 mb-3">Your First Request</h2>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        Pass your key via the <code className="text-[13px] bg-[#0f0f0f] text-[#fb923c] px-1.5 py-0.5 rounded">x-api-key</code> header.
        Here is an example that fetches today&apos;s events:
      </p>
      <CodeBlock
        title="Get today's events"
        code={{
          curl: 'curl -H "x-api-key: YOUR_API_KEY" https://mlapi.bet/v1/events/today',
          javascript:
            'const res = await fetch("https://mlapi.bet/v1/events/today", {\n  headers: { "x-api-key": "YOUR_API_KEY" }\n})\nconst data = await res.json()',
          python:
            'import requests\n\nres = requests.get("https://mlapi.bet/v1/events/today",\n  headers={"x-api-key": "YOUR_API_KEY"})\ndata = res.json()',
        }}
      />

      {/* What's Available */}
      <h2 className="text-xl font-semibold ml-text mt-10 mb-3">What&apos;s Available</h2>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-4">
        MoneyLine provides a comprehensive sports data platform covering four
        major leagues. Here is what you can access, including daily player stat
        updates for season summaries and event-linked game logs:
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            label: '4 Major Sports',
            detail: 'NFL, NBA, MLB, and NHL with full season coverage.',
          },
          {
            label: 'Real-Time Scores',
            detail: 'Live game scores, statuses, and box score data.',
          },
          {
            label: 'Odds from 9+ Books',
            detail: 'Spreads, totals, and moneylines from major sportsbooks.',
          },
          {
            label: 'Edge Analysis',
            detail: 'Arbitrage opportunities, expected value, and value bets.',
          },
          {
            label: 'Team Rosters',
            detail: 'Current rosters with player info for every team.',
          },
          {
            label: 'Player Game Logs',
            detail: 'Daily-refreshed player stats by season, exact event, exact date, or date range.',
          },
          {
            label: 'Injury Reports',
            detail: 'Up-to-date injury designations and return timelines.',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-[#e0e0e0] rounded-lg px-4 py-3 bg-[#f5f2eb]/50"
          >
            <p className="text-[14px] font-semibold text-[#1a1a1a]">{item.label}</p>
            <p className="text-[13px] text-[#6b7280] mt-0.5 leading-snug">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Navigation Hints */}
      <h2 className="text-xl font-semibold ml-text mt-10 mb-3">Explore the Docs</h2>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed">
        Use the sidebar to navigate through the available sections. You will find
        detailed endpoint references, request and response schemas, and code
        examples for every resource. Start with{' '}
        <strong className="font-medium text-[#1a1a1a]">Authentication</strong> to
        learn how keys work, then explore the{' '}
        <strong className="font-medium text-[#1a1a1a]">Events</strong>,{' '}
        <strong className="font-medium text-[#1a1a1a]">Odds</strong>, and{' '}
        <strong className="font-medium text-[#1a1a1a]">Edge</strong> sections for
        the core data endpoints.
      </p>
    </div>
  )
}
