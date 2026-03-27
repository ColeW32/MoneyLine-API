import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeOdds } from '../src/ingestion/normalizers/shared.js'
import { detectArbitrage, detectEdges } from '../src/ingestion/edgeCalculator.js'
import { filterBookmakersForOddsResponse, applyBooksPerRequestLimit } from '../src/routes/odds.js'
import { filterEdgesBySourceType } from '../src/routes/edge.js'
import { isStandardEventId } from '../src/utils/canonicalEvents.js'

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
          { key: 'prizepicks', title: 'PrizePicks', last_update: '2026-03-24T00:00:00Z', markets: [] },
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
        ['prizepicks', 'us_dfs', 'dfs'],
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

test('detectArbitrage excludes non-allowlisted exchange arbs and still allows sane mixed arbs', () => {
  const exchangeArbitrageEdges = detectArbitrage([
    makeMoneylineBook('fanduel', 'FanDuel', 'sportsbook', 'us', +105, -120),
    makeMoneylineBook('kalshi', 'Kalshi', 'exchange', 'us_ex', -120, +105),
  ])

  assert.equal(exchangeArbitrageEdges.length, 0)

  const arbitrageEdges = detectArbitrage([
    makeMoneylineBook('fanduel', 'FanDuel', 'sportsbook', 'us', +105, -120),
    makeMoneylineBook('prophetx', 'ProphetX', 'exchange', 'us_ex', -120, +105),
    makeMoneylineBook('draftkings', 'DraftKings', 'sportsbook', 'us', +100, -118),
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

test('detectEdges supports DFS player props with player metadata preserved', () => {
  const bookmakers = [
    {
      bookmakerId: 'fanduel',
      bookmakerName: 'FanDuel',
      sourceType: 'sportsbook',
      sourceRegion: 'us',
      markets: [
        {
          marketType: 'player_points',
          outcomes: [
            { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: +125 },
            { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -150 },
          ],
        },
      ],
    },
    {
      bookmakerId: 'prizepicks',
      bookmakerName: 'PrizePicks',
      sourceType: 'dfs',
      sourceRegion: 'us_dfs',
      markets: [
        {
          marketType: 'player_points',
          outcomes: [
            { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: -105 },
            { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -125 },
          ],
        },
      ],
    },
    {
      bookmakerId: 'underdog',
      bookmakerName: 'Underdog Fantasy',
      sourceType: 'dfs',
      sourceRegion: 'us_dfs',
      markets: [
        {
          marketType: 'player_points',
          outcomes: [
            { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: -110 },
            { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -120 },
          ],
        },
      ],
    },
  ]

  const edges = detectEdges(bookmakers)
  const propEdges = edges.filter((edge) => edge.market === 'player_points' && edge.outcome.includes('Jayson Tatum Over'))

  assert.ok(propEdges.some((edge) => edge.type === 'value'))
  assert.ok(propEdges.some((edge) => edge.type === 'ev'))
  assert.ok(propEdges.every((edge) => edge.description === 'Jayson Tatum'))
  assert.ok(propEdges.every((edge) => edge.point === 29.5))
  assert.ok(propEdges.some((edge) => edge.sourceType === 'sportsbook'))
})

test('filterEdgesBySourceType supports DFS edges explicitly', () => {
  const edges = [
    { type: 'value', sourceType: 'sportsbook' },
    { type: 'value', sourceType: 'dfs' },
    { type: 'ev', sourceType: 'exchange' },
  ]

  const filtered = filterEdgesBySourceType(edges, 'dfs')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].sourceType, 'dfs')
})

test('isStandardEventId accepts canonical ids and rejects legacy synthetic ids', () => {
  assert.equal(isStandardEventId('nba-ev-311361', 'nba'), true)
  assert.equal(isStandardEventId('nba-20260318-cle-mil', 'nba'), false)
  assert.equal(isStandardEventId('nba-ev-cle-mil-20260318-1930', 'nba'), false)
  assert.equal(isStandardEventId('nhl-ev-998877', 'nba'), false)
})

test('player prop edges are identifiable by player_* market for API market filtering', () => {
  const bookmakers = [
    {
      bookmakerId: 'fanduel',
      bookmakerName: 'FanDuel',
      sourceType: 'sportsbook',
      sourceRegion: 'us',
      markets: [
        {
          marketType: 'player_points',
          outcomes: [
            { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: +125 },
            { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -150 },
          ],
        },
      ],
    },
    {
      bookmakerId: 'draftkings',
      bookmakerName: 'DraftKings',
      sourceType: 'sportsbook',
      sourceRegion: 'us',
      markets: [
        {
          marketType: 'player_points',
          outcomes: [
            { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: -105 },
            { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -125 },
          ],
        },
        {
          marketType: 'moneyline',
          outcomes: [
            { name: 'Home Team', price: -130 },
            { name: 'Away Team', price: +110 },
          ],
        },
      ],
    },
  ]

  const edges = detectEdges(bookmakers)
  const playerPointsEdges = edges.filter((edge) => edge.market === 'player_points')

  assert.ok(playerPointsEdges.length > 0)
  assert.ok(playerPointsEdges.every((edge) => edge.description === 'Jayson Tatum'))
  assert.ok(playerPointsEdges.every((edge) => edge.outcome.includes('Jayson Tatum')))
})
