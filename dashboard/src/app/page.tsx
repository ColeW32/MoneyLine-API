'use client'

import Link from 'next/link'
import { useState } from 'react'

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/v1/edge/arbitrage',
    label: 'Live arb opportunities',
    example: `GET  /v1/edge/arbitrage?league=nba&sourceType=all

// Response
{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "sport": "basketball",
      "type": "arbitrage",
      "venueType": "mixed",
      "market": "moneyline",
      "outcome": "Boston Celtics vs Los Angeles Lakers",
      "arbitrage": {
        "books": [
          { "bookmaker": "DraftKings", "sourceType": "sportsbook", "outcome": "Boston Celtics", "odds": -175, "stake": 514.71 },
          { "bookmaker": "Kalshi", "sourceType": "exchange", "outcome": "Los Angeles Lakers", "odds": 185, "stake": 485.29 }
        ],
        "profitPct": 1.32,
        "guaranteedProfit": 13.2,
        "totalStake": 1000
      }
    }
  ],
  "meta": { "count": 1 }
}`,
  },
  {
    method: 'GET',
    path: '/v1/edge/ev',
    label: 'Pre-computed EV by market',
    example: `GET  /v1/edge/ev?league=nba&sourceType=all

// Response
{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "type": "ev",
      "sourceType": "dfs",
      "market": "player_points",
      "outcome": "Jayson Tatum Over 29.5",
      "evBet": {
        "bookmaker": "PrizePicks",
        "odds": 125,
        "ev": 0.0463,
        "evPct": 4.63
      }
    }
  ],
  "meta": { "count": 1 }
}`,
  },
  {
    method: 'GET',
    path: '/v1/odds',
    label: 'Live odds across all books',
    example: `GET  /v1/odds?league=nba&market=player_points&sourceType=all

// Response
{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "bookmakers": [
        {
          "bookmakerId": "fanduel",
          "sourceType": "sportsbook",
          "markets": [{ "marketType": "player_points", "outcomes": [{ "name": "Over", "description": "Jayson Tatum", "point": 29.5, "price": 120 }] }]
        },
        {
          "bookmakerId": "prizepicks",
          "sourceType": "dfs",
          "markets": [{ "marketType": "player_points", "outcomes": [{ "name": "Over", "description": "Jayson Tatum", "point": 29.5, "price": 125 }] }]
        },
        {
          "bookmakerId": "kalshi",
          "sourceType": "exchange",
          "markets": [{ "marketType": "player_points", "outcomes": [{ "name": "Over", "description": "Jayson Tatum", "point": 29.5, "price": 118 }] }]
        }
      ]
    }
  ],
  "meta": { "count": 1, "page": 1 }
}`,
  },
  {
    method: 'GET',
    path: '/v1/events/{eventId}/player-props',
    label: 'Player props on the same event ID',
    example: `GET  /v1/events/nba-ev-311286/player-props?market=player_points&sourceType=all

// Response
{
  "success": true,
  "data": {
    "eventId": "nba-ev-311286",
    "leagueId": "nba",
    "sport": "basketball",
    "players": [
      {
        "playerName": "Jayson Tatum",
        "markets": [
          {
            "marketType": "player_points",
            "marketName": "Points",
            "format": "over_under",
            "isAlternate": false,
            "lines": [
              {
                "point": 29.5,
                "offers": [
                  { "bookmakerId": "fanduel", "sourceType": "sportsbook", "selection": "Over", "price": 120 },
                  { "bookmakerId": "prizepicks", "sourceType": "dfs", "selection": "Over", "price": 125 },
                  { "bookmakerId": "kalshi", "sourceType": "exchange", "selection": "Over", "price": 118 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "meta": { "league": "nba", "event": "nba-ev-311286" }
}`,
  },
  {
    method: 'GET',
    path: '/v1/players/{playerId}/stats',
    label: 'Season summaries and game logs',
    example: `GET  /v1/players/nba-p-12345/stats?type=game&eventId=nba-ev-311286

// Response
{
  "success": true,
  "data": [
    {
      "playerId": "nba-p-12345",
      "playerName": "Jayson Tatum",
      "teamId": "nba-bos",
      "leagueId": "nba",
      "sport": "basketball",
      "season": "2025-26",
      "statType": "game",
      "eventId": "nba-ev-311286",
      "gameDate": "2026-03-09T00:00:00.000Z",
      "stats": {
        "points": 32,
        "rebounds": 8,
        "assists": 5
      }
    }
  ],
  "meta": {
    "player": "nba-p-12345",
    "type": "game",
    "season": "2025-26",
    "count": 1
  }
}`,
  },
  {
    method: 'GET',
    path: '/v1/best-bets',
    label: 'Best available prices by market',
    example: `GET  /v1/best-bets?league=nba&market=moneyline

// Response
{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "sport": "basketball",
      "calculatedAt": "2026-03-26T14:05:00.000Z",
      "markets": [
        {
          "marketType": "moneyline",
          "outcomes": [
            { "name": "Boston Celtics", "price": -165, "bookmakerName": "FanDuel", "sourceType": "sportsbook" },
            { "name": "Los Angeles Lakers", "price": 155, "bookmakerName": "DraftKings", "sourceType": "sportsbook" }
          ]
        }
      ]
    }
  ],
  "meta": { "count": 1, "page": 1 }
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
              MoneyLine Sports data delivers normalized odds, dedicated player props, EV and arbitrage signals, plus DFS and prediction-market feeds in one API &mdash; for founders, developers, and traders building sports analytics and betting products.
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
            { num: '36', label: 'Public API endpoints' },
            { num: '4', label: 'Major leagues covered' },
            { num: '3', label: 'Venue types normalized' },
            { num: '1', label: 'Canonical event ID across feeds' },
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
              { title: 'Normalized Odds', desc: 'Moneyline, spread, total, and player-prop markets from US sportsbooks, DFS platforms, and supported exchanges in one clean format.' },
              { title: 'Dedicated Player Props', desc: 'Browse player props by event, player, market, and line using the same event IDs returned by events and odds.' },
              { title: 'Arbitrage Detection', desc: 'Real-time arb scanning across all books. We find the edges so you don\u2019t have to.' },
              { title: 'Expected Value', desc: 'Pre-computed +EV signals using consensus probability models across the full market.' },
              { title: 'Best Bets Feed', desc: 'Pre-ranked best prices by event and market for recommendation rails, game cards, and Juiced-style surfaced picks.' },
              { title: 'Live Scores', desc: 'Real-time scores with period breakdowns, game clocks, and play-by-play data.' },
              { title: 'Rosters & Injuries', desc: 'Full team rosters with active injury reports updated throughout the day.' },
              { title: 'Player Discovery APIs', desc: 'Trending players, hit rates, and integrated player analysis endpoints for B2C discovery and detail pages.' },
              { title: 'Standings & Stats', desc: 'Complete standings, player stats, and team stats for every supported league.' },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-[#e0e0e0] rounded-[10px] p-5">
                <h3 className="text-[15px] font-bold ml-text">{f.title}</h3>
                <p className="text-sm ml-text-muted mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-16 lg:py-20 border-t border-[#e0e0e0] bg-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
            <div>
              <p className="text-[11px] font-medium ml-text-gray uppercase tracking-[0.2em]">Juiced B2C Readiness</p>
              <h2 className="text-2xl min-[480px]:text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] ml-text mt-3">
                Built for consumer betting surfaces, not just raw data exports.
              </h2>
              <p className="text-[15px] sm:text-base ml-text-muted mt-4 max-w-2xl">
                Use canonical event IDs to connect event listings, game odds, dedicated player props, edge signals,
                best bets, and player analysis in one UI flow without stitching providers together yourself.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                'Events -> Odds -> Player Props all share the same MoneyLine eventId.',
                'Best Bets and Edge feeds are ready for featured cards, rails, and alerts.',
                'Trending players, hit rates, and player analysis support discovery and detail pages.',
                'Teams, rosters, injuries, schedules, and standings cover the supporting content layer.',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-[#e0e0e0] bg-[#f5f2eb]/70 px-4 py-3 text-sm leading-relaxed ml-text-muted">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dark section — One API */}
      <section className="ml-dark-bg py-10 sm:py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl min-[480px]:text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            One API. Every venue.
          </h2>
          <p className="text-base text-white/70 mt-4 max-w-xl mx-auto">
            We aggregate and normalize pricing from major US sportsbooks, DFS pick&apos;em platforms, and exchanges into a single, consistent feed.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {[
              'DraftKings',
              'FanDuel',
              'BetMGM',
              'Caesars',
              'PointsBet (US)',
              'William Hill (US)',
              'BetRivers',
              'Unibet (US)',
              'Bovada',
              'BetOnline.ag',
              'MyBookie.ag',
              'LowVig.ag',
              'Barstool Sportsbook',
              'BetUS',
              'WynnBET',
              'SuperBook',
              'bet365 (US)',
              'ESPN BET',
              'Fanatics',
              'Fliff',
              'Hard Rock Bet',
              'Hard Rock Bet (AZ)',
              'Tipico (US)',
              'BetAnySports',
              'Betr (US)',
              'Pinnacle',
              'betParx',
              'Bally Bet',
              'Rebet',
              'PrizePicks',
              'Underdog Fantasy',
              'DraftKings Pick6',
              'Betr Picks',
              'Betfair Exchange (US)',
              'Sporttrade',
              'Kalshi',
              'Novig',
              'Polymarket',
              'ProphetX',
              'BetOpenly',
            ].map((book) => (
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
                {['Everything in Starter', 'Edge data (arb, EV)', 'Play-by-play', 'All sportsbooks + DFS + exchanges', '200 req/min', '1-year history'].map((f) => (
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
                {['Everything in Pro', '1,000 req/min', 'Overage billing', 'Unlimited history', 'Priority support'].map((f) => (
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
