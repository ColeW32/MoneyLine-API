/**
 * MoneyLine API — odds and edge pipeline tests.
 * Uses Node's built-in test runner (node:test). No external dependencies required.
 * Run with: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  lookupBookmaker,
  getSourceType,
  getSourceRegion,
  bookmakerSortComparator,
} from '../src/ingestion/bookmakerCatalog.js'

import { normalizeOdds } from '../src/ingestion/normalizers/shared.js'
import { detectArbitrage, detectEdges } from '../src/ingestion/edgeCalculator.js'
import { canonicalizeTeamNameForMatching, matchExistingEventForOddsDoc } from '../src/ingestion/scheduler.js'

// ---------------------------------------------------------------------------
// 1. bookmakerCatalog — lookup and classification
// ---------------------------------------------------------------------------

test('us bookmaker key returns sourceRegion=us and sourceType=sportsbook', () => {
  const entry = lookupBookmaker('draftkings')
  assert.equal(entry.sourceRegion, 'us')
  assert.equal(entry.sourceType, 'sportsbook')
})

test('us2 bookmaker key returns sourceRegion=us2 and sourceType=sportsbook', () => {
  const entry = lookupBookmaker('espnbet')
  assert.equal(entry.sourceRegion, 'us2')
  assert.equal(entry.sourceType, 'sportsbook')
})

test('us_ex bookmaker key returns sourceRegion=us_ex and sourceType=exchange', () => {
  const entry = lookupBookmaker('sporttrade')
  assert.equal(entry.sourceRegion, 'us_ex')
  assert.equal(entry.sourceType, 'exchange')
})

test('us_dfs bookmaker key returns sourceRegion=us_dfs and sourceType=dfs', () => {
  const entry = lookupBookmaker('prizepicks')
  assert.equal(entry.sourceRegion, 'us_dfs')
  assert.equal(entry.sourceType, 'dfs')
})

test('unknown bookmaker key returns null from lookupBookmaker', () => {
  assert.equal(lookupBookmaker('totally_made_up_book'), null)
})

test('getSourceType returns "unknown" for unmapped key', () => {
  assert.equal(getSourceType('totally_made_up_book'), 'unknown')
})

test('getSourceRegion returns "unknown" for unmapped key', () => {
  assert.equal(getSourceRegion('totally_made_up_book'), 'unknown')
})

// ---------------------------------------------------------------------------
// 2. normalizeOdds — annotation and sorting
// ---------------------------------------------------------------------------

function makeOddsApiEvent(bookmakerKeys) {
  return {
    id: 'test-event-1',
    home_team: 'Team A',
    away_team: 'Team B',
    commence_time: new Date().toISOString(),
    bookmakers: bookmakerKeys.map((key) => ({
      key,
      title: key.toUpperCase(),
      last_update: new Date().toISOString(),
      markets: [
        {
          key: 'h2h',
          outcomes: [
            { name: 'Team A', price: -150 },
            { name: 'Team B', price: +130 },
          ],
        },
      ],
    })),
  }
}

test('normalizeOdds annotates us bookmakers with correct sourceRegion and sourceType', () => {
  const raw = [makeOddsApiEvent(['draftkings', 'fanduel'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  assert.equal(result.length, 1)
  const bk = result[0].bookmakers.find((b) => b.bookmakerId === 'draftkings')
  assert.ok(bk, 'draftkings bookmaker should be present')
  assert.equal(bk.sourceRegion, 'us')
  assert.equal(bk.sourceType, 'sportsbook')
})

test('normalizeOdds annotates us2 bookmakers with correct sourceRegion and sourceType', () => {
  const raw = [makeOddsApiEvent(['espnbet', 'fanatics'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  const bk = result[0].bookmakers.find((b) => b.bookmakerId === 'espnbet')
  assert.ok(bk)
  assert.equal(bk.sourceRegion, 'us2')
  assert.equal(bk.sourceType, 'sportsbook')
})

test('normalizeOdds annotates us_ex bookmakers as exchange', () => {
  const raw = [makeOddsApiEvent(['sporttrade', 'kalshi'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  const bk = result[0].bookmakers.find((b) => b.bookmakerId === 'sporttrade')
  assert.ok(bk)
  assert.equal(bk.sourceRegion, 'us_ex')
  assert.equal(bk.sourceType, 'exchange')
})

test('normalizeOdds annotates us_dfs bookmakers as dfs', () => {
  const raw = [makeOddsApiEvent(['prizepicks', 'underdog'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  const bk = result[0].bookmakers.find((b) => b.bookmakerId === 'prizepicks')
  assert.ok(bk)
  assert.equal(bk.sourceRegion, 'us_dfs')
  assert.equal(bk.sourceType, 'dfs')
})

test('normalizeOdds marks unknown bookmaker keys as sourceType:unknown', () => {
  const raw = [makeOddsApiEvent(['totally_made_up_book'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  const bk = result[0].bookmakers[0]
  assert.equal(bk.sourceType, 'unknown')
  assert.equal(bk.sourceRegion, 'unknown')
})

test('normalizeOdds sorts sportsbooks before dfs before exchanges', () => {
  const raw = [makeOddsApiEvent(['sporttrade', 'draftkings', 'prizepicks', 'kalshi', 'fanduel'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  assert.deepEqual(
    result[0].bookmakers.map((b) => b.sourceType),
    ['sportsbook', 'sportsbook', 'dfs', 'exchange', 'exchange']
  )
})

test('normalizeOdds Starter-tier slice returns a sportsbook first when exchanges are present', () => {
  const raw = [makeOddsApiEvent(['sporttrade', 'draftkings'])]
  const result = normalizeOdds(raw, 'nba', 'basketball')
  // Simulating Starter tier slicing (booksPerRequest = 1)
  const starterView = result[0].bookmakers.slice(0, 1)
  assert.equal(starterView[0].sourceType, 'sportsbook')
})

// ---------------------------------------------------------------------------
// 3. bookmakerSortComparator
// ---------------------------------------------------------------------------

test('bookmakerSortComparator puts sportsbook before dfs before exchange', () => {
  const exchange = { sourceType: 'exchange', bookmakerName: 'Aaaa Exchange' }
  const dfs = { sourceType: 'dfs', bookmakerName: 'Middling DFS' }
  const sportsbook = { sourceType: 'sportsbook', bookmakerName: 'Zzzz Book' }
  assert.ok(bookmakerSortComparator(sportsbook, dfs) < 0, 'sportsbook should sort before dfs')
  assert.ok(bookmakerSortComparator(dfs, exchange) < 0, 'dfs should sort before exchange')
  assert.ok(bookmakerSortComparator(exchange, sportsbook) > 0, 'exchange should sort after sportsbook')
})

test('bookmakerSortComparator sorts alphabetically within same type', () => {
  const a = { sourceType: 'sportsbook', bookmakerName: 'BetMGM' }
  const b = { sourceType: 'sportsbook', bookmakerName: 'FanDuel' }
  assert.ok(bookmakerSortComparator(a, b) < 0, 'BetMGM should sort before FanDuel')
})

// ---------------------------------------------------------------------------
// 4. sourceType filter — helpers mirrored from edge route logic
// ---------------------------------------------------------------------------

function filterEdgesBySourceType(edges, sourceType) {
  if (!sourceType || sourceType === 'all') return edges
  return edges.filter((e) => {
    if (e.type === 'arbitrage') return e.venueType === sourceType
    return e.sourceType === sourceType
  })
}

test('sourceType=exchange filter keeps only exchange value edges', () => {
  const edges = [
    { type: 'value', sourceType: 'sportsbook' },
    { type: 'value', sourceType: 'dfs' },
    { type: 'value', sourceType: 'exchange' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'exchange')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].sourceType, 'exchange')
})

test('sourceType=dfs filter keeps only dfs value edges', () => {
  const edges = [
    { type: 'value', sourceType: 'sportsbook' },
    { type: 'value', sourceType: 'dfs' },
    { type: 'value', sourceType: 'exchange' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'dfs')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].sourceType, 'dfs')
})

test('sourceType=sportsbook (default) excludes exchange and mixed arbs', () => {
  const edges = [
    { type: 'arbitrage', venueType: 'sportsbook' },
    { type: 'arbitrage', venueType: 'exchange' },
    { type: 'arbitrage', venueType: 'mixed' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'sportsbook')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].venueType, 'sportsbook')
})

test('sourceType=all returns all edges including mixed arbs', () => {
  const edges = [
    { type: 'arbitrage', venueType: 'sportsbook' },
    { type: 'arbitrage', venueType: 'mixed' },
    { type: 'value', sourceType: 'exchange' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'all')
  assert.equal(filtered.length, 3)
})

test('canonicalizeTeamNameForMatching normalizes city aliases consistently', () => {
  assert.equal(canonicalizeTeamNameForMatching('LA Clippers'), 'laclippers')
  assert.equal(canonicalizeTeamNameForMatching('Los Angeles Clippers'), 'laclippers')
  assert.equal(canonicalizeTeamNameForMatching('New York Knicks'), 'nyknicks')
  assert.equal(canonicalizeTeamNameForMatching('New Jersey Devils'), 'njdevils')
})

test('matchExistingEventForOddsDoc matches canonical events when team names use different city forms', () => {
  const matched = matchExistingEventForOddsDoc(
    {
      _sourceHomeTeam: 'Los Angeles Clippers',
      _sourceAwayTeam: 'Toronto Raptors',
      _sourceCommenceTime: new Date('2026-03-26T02:30:00.000Z'),
    },
    [
      {
        eventId: 'nba-ev-311357',
        homeTeamName: 'LA Clippers',
        awayTeamName: 'Toronto Raptors',
        startTime: new Date('2026-03-26T02:30:00.000Z'),
      },
    ]
  )

  assert.ok(matched)
  assert.equal(matched.eventId, 'nba-ev-311357')
})

// ---------------------------------------------------------------------------
// 5. detectArbitrage — venueType tagging and unknown exclusion
// ---------------------------------------------------------------------------

function makeBookmakers(entries) {
  return entries.map(({ key, sourceType, sourceRegion, prices }) => ({
    bookmakerId: key,
    bookmakerName: key,
    sourceType,
    sourceRegion: sourceRegion || 'us',
    markets: [
      {
        marketType: 'moneyline',
        outcomes: [
          { name: 'Team A', price: prices[0] },
          { name: 'Team B', price: prices[1] },
        ],
      },
    ],
  }))
}

test('detectArbitrage returns empty when no arb exists', () => {
  const bookmakers = makeBookmakers([
    { key: 'draftkings', sourceType: 'sportsbook', prices: [-150, +120] },
    { key: 'fanduel',    sourceType: 'sportsbook', prices: [-160, +130] },
  ])
  const edges = detectArbitrage(bookmakers)
  assert.equal(edges.length, 0)
})

test('detectArbitrage tags sportsbook-only arb with venueType=sportsbook', () => {
  // Best prices: Team A +200, Team B +200 → implied sum = 0.333+0.333 = 0.666 < 1 → arb
  const bookmakers = makeBookmakers([
    { key: 'draftkings', sourceType: 'sportsbook', prices: [+200, -250] },
    { key: 'fanduel',    sourceType: 'sportsbook', prices: [-250, +200] },
  ])
  const edges = detectArbitrage(bookmakers)
  assert.equal(edges.length, 1)
  assert.equal(edges[0].type, 'arbitrage')
  assert.equal(edges[0].venueType, 'sportsbook')
})

test('detectArbitrage tags mixed arb with venueType=mixed', () => {
  const bookmakers = makeBookmakers([
    { key: 'draftkings', sourceType: 'sportsbook',         sourceRegion: 'us',    prices: [+200, -250] },
    { key: 'sporttrade', sourceType: 'exchange',            sourceRegion: 'us_ex', prices: [-250, +200] },
  ])
  const edges = detectArbitrage(bookmakers)
  assert.equal(edges.length, 1)
  assert.equal(edges[0].venueType, 'mixed')
})

test('detectArbitrage excludes unknown sourceType bookmakers', () => {
  // unknown book has the best price — should be excluded, leaving no arb
  const bookmakers = makeBookmakers([
    { key: 'draftkings',    sourceType: 'sportsbook', prices: [-200, +160] },
    { key: 'mystery_book',  sourceType: 'unknown',    prices: [+300, -500] }, // would create arb if included
  ])
  const edges = detectArbitrage(bookmakers)
  assert.equal(edges.length, 0)
})

test('detectArbitrage arb legs carry bookmakerId, sourceType, and sourceRegion', () => {
  const bookmakers = makeBookmakers([
    { key: 'draftkings', sourceType: 'sportsbook', sourceRegion: 'us',    prices: [+200, -250] },
    { key: 'fanduel',    sourceType: 'sportsbook', sourceRegion: 'us',    prices: [-250, +200] },
  ])
  const edges = detectArbitrage(bookmakers)
  if (edges.length > 0) {
    const books = edges[0].arbitrage.books
    for (const book of books) {
      assert.ok(book.bookmakerId, 'leg should have bookmakerId')
      assert.ok(book.sourceType, 'leg should have sourceType')
      assert.ok(book.sourceRegion, 'leg should have sourceRegion')
    }
  }
})

// ---------------------------------------------------------------------------
// 6. detectEdges — value edge type fix and EV-only edges
// ---------------------------------------------------------------------------

test('detectEdges emits type=value when edgePct exceeds threshold', () => {
  // One book at +200 (implied 33.3%), rest at -200 (implied 66.7%)
  // Consensus for "Team A" ≈ (33.3 + 66.7 + 66.7) / 3 = 55.6%
  // Book offering +200 has implied 33.3% → edge ≈ 22.3% → well above 3% threshold
  const bookmakers = [
    {
      bookmakerId: 'draftkings', bookmakerName: 'DraftKings',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: +200 }, { name: 'Team B', price: -240 }] }],
    },
    {
      bookmakerId: 'fanduel', bookmakerName: 'FanDuel',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: -200 }, { name: 'Team B', price: +170 }] }],
    },
    {
      bookmakerId: 'betmgm', bookmakerName: 'BetMGM',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: -200 }, { name: 'Team B', price: +170 }] }],
    },
  ]
  const edges = detectEdges(bookmakers)
  const valueEdges = edges.filter((e) => e.type === 'value')
  assert.ok(valueEdges.length > 0, 'should emit at least one value edge')
  for (const e of valueEdges) {
    assert.ok(e.valueBet, 'value edge should have valueBet field')
    assert.ok(e.valueBet.edgePct, 'valueBet should have edgePct')
  }
})

test('detectEdges value edges carry sourceType and sourceRegion', () => {
  const bookmakers = [
    {
      bookmakerId: 'draftkings', bookmakerName: 'DraftKings',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: +200 }, { name: 'Team B', price: -240 }] }],
    },
    {
      bookmakerId: 'fanduel', bookmakerName: 'FanDuel',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: -200 }, { name: 'Team B', price: +170 }] }],
    },
    {
      bookmakerId: 'betmgm', bookmakerName: 'BetMGM',
      sourceType: 'sportsbook', sourceRegion: 'us',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: -200 }, { name: 'Team B', price: +170 }] }],
    },
  ]
  const edges = detectEdges(bookmakers)
  const valueEdges = edges.filter((e) => e.type === 'value')
  for (const e of valueEdges) {
    assert.ok(e.sourceType, 'edge should carry sourceType')
    assert.ok(e.sourceRegion, 'edge should carry sourceRegion')
  }
})

test('detectEdges excludes unknown sourceType bookmakers from calculations', () => {
  const bookmakers = [
    {
      bookmakerId: 'mystery_book', bookmakerName: 'Mystery',
      sourceType: 'unknown', sourceRegion: 'unknown',
      markets: [{ marketType: 'moneyline', outcomes: [{ name: 'Team A', price: +200 }, { name: 'Team B', price: -240 }] }],
    },
  ]
  // With only 1 offer per outcome (after unknown exclusion: 0), no edges can be computed
  const edges = detectEdges(bookmakers)
  assert.equal(edges.length, 0)
})

test('default edge filter (sportsbook) excludes exchange-only and mixed arbs', () => {
  const edges = [
    { type: 'arbitrage', venueType: 'sportsbook' },
    { type: 'arbitrage', venueType: 'exchange' },
    { type: 'arbitrage', venueType: 'mixed' },
    { type: 'value',     sourceType: 'sportsbook' },
    { type: 'value',     sourceType: 'exchange' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'sportsbook')
  assert.equal(filtered.length, 2)
  assert.ok(filtered.every((e) => e.venueType === 'sportsbook' || e.sourceType === 'sportsbook'))
})

test('sourceType=all includes mixed sportsbook/exchange arbs', () => {
  const edges = [
    { type: 'arbitrage', venueType: 'mixed' },
    { type: 'arbitrage', venueType: 'sportsbook' },
    { type: 'arbitrage', venueType: 'exchange' },
  ]
  const filtered = filterEdgesBySourceType(edges, 'all')
  assert.equal(filtered.length, 3)
  assert.ok(filtered.some((e) => e.venueType === 'mixed'))
})
