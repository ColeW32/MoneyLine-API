import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeOdds } from '../src/ingestion/normalizers/shared.js'
import { detectArbitrage, detectEdges } from '../src/ingestion/edgeCalculator.js'
import { filterBookmakersForOddsResponse, applyBooksPerRequestLimit } from '../src/routes/odds.js'
import { filterEdgesBySourceType } from '../src/routes/edge.js'

function makeMoneylineBook(bookmakerId, bookmakerName, sourceType, sourceRegion, homePrice, awayPrice) {
  return {
    bookmakerId,
    bookmakerName,
    sourceType,
    sourceRegion,
    markets: [
      {
        marketType: 'moneyline',
        outcomes: [
          { name: 'Home Team', price: homePrice },
          { name: 'Away Team', price: awayPrice },
        ],
      },
    ],
  }
}

test('normalizeOdds classifies and sorts sportsbooks before exchanges and unknowns', () => {
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    const [event] = normalizeOdds([
      {
        id: 'game-1',
        home_team: 'Home Team',
        away_team: 'Away Team',
        commence_time: '2026-03-24T00:00:00Z',
        bookmakers: [
          { key: 'kalshi', title: 'Kalshi', last_update: '2026-03-24T00:00:00Z', markets: [] },
          { key: 'fanduel', title: 'FanDuel', last_update: '2026-03-24T00:00:00Z', markets: [] },
          { key: 'espnbet', title: 'ESPN BET', last_update: '2026-03-24T00:00:00Z', markets: [] },
          { key: 'mystery_book', title: 'Mystery Book', last_update: '2026-03-24T00:00:00Z', markets: [] },
        ],
      },
    ], 'nba', 'basketball')

    assert.deepEqual(
      event.bookmakers.map((bk) => [bk.bookmakerId, bk.sourceRegion, bk.sourceType]),
      [
        ['espnbet', 'us2', 'sportsbook'],
        ['fanduel', 'us', 'sportsbook'],
        ['kalshi', 'us_ex', 'exchange'],
        ['mystery_book', 'unknown', 'unknown'],
      ]
    )
  } finally {
    console.warn = originalWarn
  }
})

test('odds response filtering happens before Starter-tier slicing', () => {
  const bookmakers = [
    makeMoneylineBook('fanduel', 'FanDuel', 'sportsbook', 'us', -120, +100),
    makeMoneylineBook('kalshi', 'Kalshi', 'exchange', 'us_ex', -118, +102),
  ]

  const exchangeOnly = filterBookmakersForOddsResponse(bookmakers, { sourceType: 'exchange' })
  const limited = applyBooksPerRequestLimit(exchangeOnly, 1)

  assert.equal(limited.length, 1)
  assert.equal(limited[0].bookmakerId, 'kalshi')

  const defaultLimited = applyBooksPerRequestLimit(filterBookmakersForOddsResponse(bookmakers), 1)
  assert.equal(defaultLimited[0].sourceType, 'sportsbook')
  assert.equal(defaultLimited[0].bookmakerId, 'fanduel')
})

test('detectEdges emits both value and ev edges for strong positive-EV offers', () => {
  const bookmakers = [
    makeMoneylineBook('fanduel', 'FanDuel', 'sportsbook', 'us', +110, -130),
    makeMoneylineBook('draftkings', 'DraftKings', 'sportsbook', 'us', -120, +100),
    makeMoneylineBook('kalshi', 'Kalshi', 'exchange', 'us_ex', -125, +102),
  ]

  const edges = detectEdges(bookmakers)
  const targetEdges = edges.filter((edge) =>
    edge.outcome === 'Home Team' && edge.bookmakers.includes('FanDuel')
  )

  assert.ok(targetEdges.some((edge) => edge.type === 'value'))
  assert.ok(targetEdges.some((edge) => edge.type === 'ev'))
})

test('detectArbitrage tags mixed sportsbook/exchange arbs and source filtering respects defaults', () => {
  const arbitrageEdges = detectArbitrage([
    makeMoneylineBook('fanduel', 'FanDuel', 'sportsbook', 'us', +105, -120),
    makeMoneylineBook('kalshi', 'Kalshi', 'exchange', 'us_ex', -120, +105),
  ])

  assert.equal(arbitrageEdges.length, 1)
  assert.equal(arbitrageEdges[0].venueType, 'mixed')
  assert.deepEqual(
    arbitrageEdges[0].arbitrage.books.map((leg) => leg.sourceType).sort(),
    ['exchange', 'sportsbook']
  )

  assert.equal(filterEdgesBySourceType(arbitrageEdges, 'sportsbook').length, 0)
  assert.equal(filterEdgesBySourceType(arbitrageEdges, 'exchange').length, 0)
  assert.equal(filterEdgesBySourceType(arbitrageEdges, 'all').length, 1)
})
