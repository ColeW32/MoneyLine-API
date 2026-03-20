'use client'

import Link from 'next/link'
import { useState } from 'react'

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/v1/arbitrage',
    label: 'Live arb opportunities',
    example: `GET  /v1/arbitrage?sport=nba

// Response
{
  "meta": { "arbs_returned": 3, "live_arbs": 1,
    "pregame_arbs": 2, "generated_at": "2026-03-09T19:45:32Z",
    "latency_ms": 28, "stale_warning": false },
  "arbs": [
    {
      "arb_id": "arb_nba_lal_bos_ml_dk_fd_20260309_194532",
      "arb_type": "two_way",
      "game": { "game_id": "nba_lal_bos_20260309", "sport": "nba",
        "home_team": "Boston Celtics", "away_team": "Los Angeles Lakers",
        "start_time": "2026-03-09T23:30:00Z", "status": "pregame" },
      "market": "moneyline",
      "legs": [
        { "book": "DraftKings", "side": "Boston Celtics",
          "odds": -175, "implied_prob": 0.636 },
        { "book": "FanDuel", "side": "Los Angeles Lakers",
          "odds": +185, "implied_prob": 0.351 }
      ],
      "combined_implied": 0.987,
      "edge_pct": 1.32,
      "recommended_stakes": { "leg_1": 64.4, "leg_2": 35.6 }
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/v1/ev/{sport}',
    label: 'Pre-computed EV by market',
    example: `GET  /v1/ev/nba?min_ev=3

// Response
{
  "meta": { "bets_returned": 5, "sport": "nba",
    "generated_at": "2026-03-09T19:45:32Z" },
  "ev_bets": [
    {
      "game": "Boston Celtics vs Los Angeles Lakers",
      "market": "moneyline",
      "book": "Bovada",
      "side": "Los Angeles Lakers",
      "odds": +195,
      "model_prob": 0.388,
      "implied_prob": 0.339,
      "ev_pct": 4.63,
      "kelly": 0.078
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/v1/odds/{sport}',
    label: 'Live odds across all books',
    example: `GET  /v1/odds/nba?market=moneyline

// Response
{
  "meta": { "events": 8, "books": 9,
    "generated_at": "2026-03-09T19:45:32Z" },
  "odds": [
    {
      "game_id": "nba_bos_lal_20260309",
      "home": "Boston Celtics",
      "away": "Los Angeles Lakers",
      "start_time": "2026-03-09T23:30:00Z",
      "books": {
        "DraftKings": { "home": -180, "away": +155 },
        "FanDuel":    { "home": -175, "away": +150 },
        "BetMGM":     { "home": -185, "away": +160 },
        "Bovada":     { "home": -170, "away": +145 }
      }
    }
  ]
}`,
  },
]

const TICKER_ITEMS = [
  'Arb +2.1% DK/FD',
  'LAC/PHX \u00b7 Total 224.5',
  'KALSHI \u00b7 Fed Rate Cut 42%',
  'LAL/BOS \u00b7 ML \u2212108',
  'KC/PHI \u00b7 Spread \u22123.5',
  'NYY/BOS \u00b7 ML \u2212122',
  'GSW/MIA \u00b7 EV +5.2',
  'POR/DEN \u00b7 Total 219.5',
  'CHI/MIL \u00b7 ML +145',
  'ATL/CLE \u00b7 Spread +6.5',
]

export default function LandingPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(0)

  return (
    <div className="min-h-screen ml-page-bg" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}>
      {/* Nav */}
      <nav className="border-b border-[#e0e0e0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold ml-text tracking-tight">
            Money <span className="text-[#6b7280] font-light">\</span> Line
          </span>
          <div className="flex items-center gap-8">
            <Link href="/docs/endpoints/events" className="text-sm font-medium ml-text hidden sm:block">API</Link>
            <Link href="/docs" className="text-sm font-medium ml-text hidden sm:block">Docs</Link>
            <Link href="#pricing" className="text-sm font-medium ml-text hidden sm:block">Pricing</Link>
            <Link href="/signup" className="bg-[#1a1a1a] text-white text-sm font-medium px-5 py-2 rounded-full hover:border-[#e8ff47] hover:border transition-colors">
              Try API &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-12 sm:pt-16 lg:pt-24 pb-10 lg:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left — headline */}
          <div>
            <h1 className="text-2xl min-[480px]:text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight leading-[1.2] ml-text">
              Sports betting data that puts{' '}
              <span className="underline decoration-[#e8ff47] decoration-[3px] underline-offset-4">edges</span>{' '}
              at the frontier.
            </h1>
            <div className="flex items-center gap-3 mt-8">
              <Link href="/signup" className="bg-[#1a1a1a] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:shadow-lg transition-shadow">
                Get API Key
              </Link>
              <Link href="/docs" className="border-2 border-[#1a1a1a] text-[#1a1a1a] text-sm font-medium px-5 py-2.5 rounded-full bg-transparent hover:bg-[#1a1a1a] hover:text-white transition-colors">
                Explore Docs
              </Link>
            </div>
            <p className="text-sm ml-text-gray mt-6">
              Trusted by DFS operators, sportsbooks, sports analytics platforms, and trading firms.
            </p>
          </div>

          {/* Right — API demo */}
          <div>
            <p className="text-[15px] ml-text-muted mb-6 leading-relaxed">
              MoneyLine Sports data delivers normalized odds, props, EV and arbitrage signals, and prediction market feeds in one API &mdash; for founders, developers, and traders building sports analytics and betting products.
            </p>

            {/* Endpoint selector */}
            <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.22em] mb-3">
              Select endpoint &mdash; response shown below
            </p>
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {ENDPOINTS.map((ep, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedEndpoint(i)}
                  className={`flex-shrink-0 border rounded-[10px] px-4 py-3 text-left transition-colors ${
                    i === selectedEndpoint
                      ? 'bg-[#1a1a1a] border-[#2a2a2a] text-white'
                      : 'bg-white border-[#e0e0e0] hover:border-[#bbb]'
                  }`}
                >
                  <span className={`font-mono text-[10px] font-bold uppercase ${i === selectedEndpoint ? 'text-[#86efac]' : 'text-[#86efac]'}`}>
                    {ep.method}
                  </span>
                  <p className={`font-mono text-[13px] font-medium ${i === selectedEndpoint ? 'text-white' : 'ml-text'}`}>
                    {ep.path}
                  </p>
                  <p className={`text-[12px] mt-0.5 ${i === selectedEndpoint ? 'text-[#888]' : 'ml-text-gray'}`}>
                    {ep.label}
                  </p>
                </button>
              ))}
            </div>

            {/* Code block */}
            <p className="text-[12px] ml-text-gray mb-2">
              Example: <span className="font-mono text-[#86efac]">GET</span>{' '}
              <span className="font-mono">{ENDPOINTS[selectedEndpoint].path}</span>
            </p>
            <div className="bg-[#0f0f0f] border border-[#222] rounded-xl overflow-hidden relative">
              <button
                onClick={() => navigator.clipboard.writeText(ENDPOINTS[selectedEndpoint].example)}
                className="absolute top-3 right-3 text-[#888] hover:text-white transition-colors"
                title="Copy"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
              <pre className="p-4 text-[12px] sm:text-[13px] font-mono overflow-x-auto max-h-[340px] overflow-y-auto leading-relaxed">
                <code>
                  {ENDPOINTS[selectedEndpoint].example.split('\n').map((line, i) => (
                    <span key={i}>
                      {colorize(line)}
                      {'\n'}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="ml-ticker-bg border-y border-[#dedcd5] py-2.5 overflow-hidden">
        <div className="animate-ticker flex whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center mx-6 text-sm font-medium ml-text-muted">
              {item}
              <span className="ml-6 text-[#ccc]">&bull;</span>
            </span>
          ))}
        </div>
      </div>

      {/* Stats / Social proof */}
      <section className="py-10 sm:py-16 border-b border-[#e0e0e0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '9+', label: 'Sportsbooks' },
            { num: '12', label: 'Leagues covered' },
            { num: '<50', label: 'ms latency' },
            { num: '99.9%', label: 'Uptime' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[40px] sm:text-[56px] font-extrabold ml-text tabular-nums">{s.num}</p>
              <p className="text-sm ml-text-gray font-medium uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-10 sm:py-16 lg:py-24 ml-section-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl min-[480px]:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] ml-text max-w-3xl">
            The API, at a glance.
          </h2>
          <p className="text-[15px] sm:text-base lg:text-lg ml-text-muted mt-4 max-w-2xl">
            Everything you need to build sports analytics platforms, betting tools, and DFS applications.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {[
              { title: 'Normalized Odds', desc: 'Moneyline, spread, and totals from 9+ sportsbooks, normalized into a single clean format.' },
              { title: 'Arbitrage Detection', desc: 'Real-time arb scanning across all books. We find the edges so you don\u2019t have to.' },
              { title: 'Expected Value', desc: 'Pre-computed +EV signals using consensus probability models across the full market.' },
              { title: 'Live Scores', desc: 'Real-time scores with period breakdowns, game clocks, and play-by-play data.' },
              { title: 'Rosters & Injuries', desc: 'Full team rosters with active injury reports updated throughout the day.' },
              { title: 'Standings & Stats', desc: 'Complete standings, player stats, and team stats for every league we cover.' },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-[#e0e0e0] rounded-[10px] p-5">
                <h3 className="text-[15px] font-bold ml-text">{f.title}</h3>
                <p className="text-sm ml-text-muted mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark section — One API */}
      <section className="ml-dark-bg py-10 sm:py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl min-[480px]:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            One API. Every book.
          </h2>
          <p className="text-base text-white/70 mt-4 max-w-xl mx-auto">
            We aggregate and normalize odds from every major US sportsbook into a single, consistent feed.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'Bovada', 'LowVig', 'Pinnacle'].map((book) => (
              <span key={book} className="border border-[#2a2a2a] text-white/80 px-4 py-2 rounded-full text-sm font-medium">
                {book}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-10 sm:py-16 lg:py-24 ml-page-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl min-[480px]:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ml-text">
            Simple, credit-based pricing.
          </h2>
          <p className="text-[15px] sm:text-base ml-text-muted mt-3">
            Start building for free. Scale when you&apos;re ready.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-12">
            {/* Free */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 flex flex-col">
              <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.15em]">Free</p>
              <p className="mt-2">
                <span className="text-2xl font-bold ml-text">$0</span>
                <span className="text-xs ml-text-gray ml-1">/ month</span>
              </p>
              <p className="text-xs ml-text-gray mt-1 mb-4">1,000 credits/mo</p>
              <ul className="space-y-2 flex-1">
                {['Scores & standings', '10 req/min', '4 major leagues', '7-day history'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs ml-text-muted">
                    <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-5 block text-center bg-[#1a1a1a] text-white text-xs font-medium py-2 rounded-full hover:shadow-lg transition-shadow">
                Start free &rarr;
              </Link>
            </div>

            {/* Starter */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 flex flex-col">
              <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.15em]">Starter</p>
              <p className="mt-2">
                <span className="text-2xl font-bold ml-text">$29</span>
                <span className="text-xs ml-text-gray ml-1">/ month</span>
              </p>
              <p className="text-xs ml-text-gray mt-1 mb-4">150K credits/mo</p>
              <ul className="space-y-2 flex-1">
                {['Everything in Free', 'Odds + injuries', '60 req/min', 'All sports', '90-day history'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs ml-text-muted">
                    <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-5 block text-center bg-[#1a1a1a] text-white text-xs font-medium py-2 rounded-full hover:shadow-lg transition-shadow">
                Get started &rarr;
              </Link>
            </div>

            {/* Pro — Most Popular */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 flex flex-col relative">
              <span className="absolute -top-2.5 left-4 bg-[#e8ff47] text-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                Most Popular
              </span>
              <p className="text-[11px] font-medium text-[#888] uppercase tracking-[0.15em]">Pro</p>
              <p className="mt-2">
                <span className="text-2xl font-bold text-white">$149</span>
                <span className="text-xs text-[#888] ml-1">/ month</span>
              </p>
              <p className="text-xs text-[#888] mt-1 mb-4">1.5M credits/mo</p>
              <ul className="space-y-2 flex-1">
                {['Everything in Starter', 'Edge data (arb, EV)', 'Play-by-play', 'All bookmakers', '200 req/min', '1-year history'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-white/70">
                    <span className="text-green-400 mt-0.5">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-5 block text-center bg-[#e8ff47] text-[#1a1a1a] text-xs font-bold py-2 rounded-full hover:brightness-110 transition-all">
                Start with Pro &rarr;
              </Link>
            </div>

            {/* Business */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 flex flex-col">
              <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.15em]">Business</p>
              <p className="mt-2">
                <span className="text-2xl font-bold ml-text">$299</span>
                <span className="text-xs ml-text-gray ml-1">/ month</span>
              </p>
              <p className="text-xs ml-text-gray mt-1 mb-4">5M credits/mo</p>
              <ul className="space-y-2 flex-1">
                {['Everything in Pro', '500 req/min', 'Overage billing', 'Unlimited history', 'Priority support'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs ml-text-muted">
                    <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-5 block text-center bg-[#1a1a1a] text-white text-xs font-medium py-2 rounded-full hover:shadow-lg transition-shadow">
                Get started &rarr;
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-5 flex flex-col">
              <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.15em]">Enterprise</p>
              <p className="mt-2">
                <span className="text-2xl font-bold ml-text">Custom</span>
              </p>
              <p className="text-xs ml-text-gray mt-1 mb-4">Unlimited credits</p>
              <ul className="space-y-2 flex-1">
                {['Everything in Business', 'Unlimited rate', 'Webhooks', 'Dedicated support', 'SLA guarantee', 'Custom data feeds'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs ml-text-muted">
                    <span className="text-green-500 mt-0.5">&#10003;</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="mailto:enterprise@moneylineapp.com" className="mt-5 block text-center bg-[#1a1a1a] text-white text-xs font-medium py-2 rounded-full hover:shadow-lg transition-shadow">
                Contact us &rarr;
              </Link>
            </div>
          </div>

          <p className="text-center text-sm ml-text-gray mt-8">
            All plans include auto-upgrade protection. Cancel anytime. No hidden fees.
          </p>
          <p className="text-center mt-2">
            <Link href="/docs/rate-limits" className="text-sm text-[#b5c400] hover:underline">See full pricing details &rarr;</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e0e0e0] py-8 ml-page-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm ml-text-gray">
          <span className="font-bold ml-text">Money<span className="text-[#6b7280] font-light">\</span>Line</span>
          {' '}&mdash; Unified Sports Data API
        </div>
      </footer>
    </div>
  )
}

/** Simple syntax colorizer for the code block */
function colorize(line: string) {
  if (line.startsWith('//')) return <span className="text-[#666]">{line}</span>
  if (line.startsWith('GET')) return <span><span className="text-[#7dd3fc]">GET</span><span className="text-[#86efac]">{line.slice(3)}</span></span>

  // Colorize JSON-like content
  return line.split(/("(?:[^"\\]|\\.)*")/g).map((part, i) => {
    if (i % 2 === 1) {
      // It's a quoted string
      if (part.includes(':') === false && (part.includes('arb') || part.includes('nba') || part.includes('/') || part.includes('_') || part.includes('20'))) {
        return <span key={i} className="text-[#86efac]">{part}</span>
      }
      if (part.match(/^\d|true|false|null/)) {
        return <span key={i} className="text-[#fbbf24]">{part}</span>
      }
      return <span key={i} className="text-[#fb923c]">{part}</span>
    }
    // Numbers and booleans outside strings
    return <span key={i} className="text-[#9ca3af]">{part.replace(/(true|false|null)/g, '\x01$1\x02').split(/(\x01.*?\x02)/).map((s, j) =>
      s.startsWith('\x01') ? <span key={j} className="text-[#7dd3fc]">{s.slice(1, -1)}</span> : s
    )}</span>
  })
}
