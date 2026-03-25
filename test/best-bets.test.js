import test from 'node:test'
import assert from 'node:assert/strict'

import { findBestOdds } from '../src/ingestion/bestBetsCalculator.js'
import { filterPlayerPropsDoc } from '../src/utils/playerProps.js'

function makeBook(bookmakerId, bookmakerName, sourceType, sourceRegion, outcomes) {
  return {
    bookmakerId,
    bookmakerName,
    sourceType,
    sourceRegion,
    markets: [
      {
        marketType: 'h2h',
        outcomes: outcomes.map(([name, price]) => ({ name, price })),
      },
    ],
  }
}

// --- findBestOdds ---

test('findBestOdds selects highest American odds per outcome', () => {
  const bookmakers = [
    makeBook('draftkings', 'DraftKings', 'sportsbook', 'us', [['Home', -110], ['Away', +100]]),
    makeBook('fanduel',    'FanDuel',    'sportsbook', 'us', [['Home', -115], ['Away', +105]]),
    makeBook('betmgm',     'BetMGM',     'sportsbook', 'us', [['Home', -108], ['Away', +98]]),
  ]

  const markets = findBestOdds(bookmakers)
  assert.equal(markets.length, 1)

  const h2h = markets[0]
  assert.equal(h2h.marketType, 'h2h')

  const home = h2h.outcomes.find((o) => o.name === 'Home')
  const away = h2h.outcomes.find((o) => o.name === 'Away')

  // -108 > -110 > -115 — BetMGM has best home price
  assert.equal(home.bestOdds, -108)
  assert.equal(home.bookmakerId, 'betmgm')

  // +105 > +100 > +98 — FanDuel has best away price
  assert.equal(away.bestOdds, 105)
  assert.equal(away.bookmakerId, 'fanduel')
})

test('findBestOdds: positive beats negative (higher number always better)', () => {
  const bookmakers = [
    makeBook('fanduel',    'FanDuel',    'sportsbook', 'us', [['Home', -105], ['Away', -120]]),
    makeBook('draftkings', 'DraftKings', 'sportsbook', 'us', [['Home', +100], ['Away', -110]]),
  ]

  const markets = findBestOdds(bookmakers)
  const home = markets[0].outcomes.find((o) => o.name === 'Home')
  const away = markets[0].outcomes.find((o) => o.name === 'Away')

  // +100 > -105
  assert.equal(home.bestOdds, 100)
  assert.equal(home.bookmakerId, 'draftkings')

  // -110 > -120
  assert.equal(away.bestOdds, -110)
  assert.equal(away.bookmakerId, 'draftkings')
})

test('findBestOdds with bookmaker filter returns best within that book only', () => {
  const bookmakers = [
    makeBook('draftkings', 'DraftKings', 'sportsbook', 'us', [['Home', -110], ['Away', +100]]),
    makeBook('fanduel',    'FanDuel',    'sportsbook', 'us', [['Home', -108], ['Away', +105]]),
  ]

  const markets = findBestOdds(bookmakers, { bookmaker: 'draftkings' })
  assert.equal(markets.length, 1)

  const home = markets[0].outcomes.find((o) => o.name === 'Home')
  // FanDuel has better odds but we filtered to DraftKings only
  assert.equal(home.bestOdds, -110)
  assert.equal(home.bookmakerId, 'draftkings')
})

test('findBestOdds with sourceType filter excludes other venue types', () => {
  const bookmakers = [
    makeBook('fanduel',   'FanDuel',   'sportsbook', 'us',    [['Home', -115], ['Away', +100]]),
    makeBook('kalshi',    'Kalshi',    'exchange',   'us_ex', [['Home', -108], ['Away', +110]]),
  ]

  const sbOnly = findBestOdds(bookmakers, { sourceType: 'sportsbook' })
  const home = sbOnly[0].outcomes.find((o) => o.name === 'Home')

  // Kalshi has better odds but is excluded by sourceType filter
  assert.equal(home.bestOdds, -115)
  assert.equal(home.bookmakerId, 'fanduel')
})

test('findBestOdds preserves point value on spread outcomes', () => {
  const bookmakers = [
    {
      bookmakerId: 'fanduel',
      bookmakerName: 'FanDuel',
      sourceType: 'sportsbook',
      sourceRegion: 'us',
      markets: [
        {
          marketType: 'spreads',
          outcomes: [
            { name: 'Home', price: -110, point: -3.5 },
            { name: 'Away', price: -110, point: 3.5 },
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
          marketType: 'spreads',
          outcomes: [
            { name: 'Home', price: -108, point: -3.5 },
            { name: 'Away', price: -112, point: 3.5 },
          ],
        },
      ],
    },
  ]

  const markets = findBestOdds(bookmakers)
  const spreads = markets.find((m) => m.marketType === 'spreads')
  assert.ok(spreads)

  const home = spreads.outcomes.find((o) => o.name === 'Home')
  assert.equal(home.bestOdds, -108)
  assert.equal(home.point, -3.5)
})

test('findBestOdds returns empty array when no bookmakers provided', () => {
  assert.deepEqual(findBestOdds([]), [])
})

test('findBestOdds skips outcomes with null/invalid prices', () => {
  const bookmakers = [
    {
      bookmakerId: 'fanduel',
      bookmakerName: 'FanDuel',
      sourceType: 'sportsbook',
      sourceRegion: 'us',
      markets: [
        {
          marketType: 'h2h',
          outcomes: [
            { name: 'Home', price: null },
            { name: 'Away', price: -110 },
          ],
        },
      ],
    },
  ]

  const markets = findBestOdds(bookmakers)
  const h2h = markets[0]
  assert.equal(h2h.outcomes.length, 1)
  assert.equal(h2h.outcomes[0].name, 'Away')
})

// --- isBest annotation in filterPlayerPropsDoc ---

function makePropsDoc({ bookmakers } = {}) {
  return {
    eventId: 'nba-ev-test',
    leagueId: 'nba',
    sport: 'basketball',
    fetchedAt: new Date(),
    players: [
      {
        playerName: 'Jayson Tatum',
        markets: [
          {
            marketType: 'player_points',
            marketName: 'Points',
            format: 'over_under',
            isAlternate: false,
            lines: [
              {
                point: 29.5,
                offers: bookmakers,
              },
            ],
          },
        ],
      },
    ],
  }
}

test('filterPlayerPropsDoc annotates the highest-priced offer as isBest', () => {
  const doc = makePropsDoc({
    bookmakers: [
      { bookmakerId: 'fanduel',    bookmakerName: 'FanDuel',    sourceType: 'sportsbook', sourceRegion: 'us', selection: 'Over', price: 120 },
      { bookmakerId: 'draftkings', bookmakerName: 'DraftKings', sourceType: 'sportsbook', sourceRegion: 'us', selection: 'Over', price: 110 },
      { bookmakerId: 'betmgm',     bookmakerName: 'BetMGM',     sourceType: 'sportsbook', sourceRegion: 'us', selection: 'Over', price: 115 },
    ],
  })

  const result = filterPlayerPropsDoc(doc)
  const offers = result.players[0].markets[0].lines[0].offers

  const best = offers.filter((o) => o.isBest)
  assert.equal(best.length, 1)
  assert.equal(best[0].bookmakerId, 'fanduel')     // 120 is best
  assert.equal(offers.find((o) => o.bookmakerId === 'draftkings').isBest, false)
  assert.equal(offers.find((o) => o.bookmakerId === 'betmgm').isBest, false)
})

test('filterPlayerPropsDoc marks all tied offers as isBest', () => {
  const doc = makePropsDoc({
    bookmakers: [
      { bookmakerId: 'fanduel',    bookmakerName: 'FanDuel',    sourceType: 'sportsbook', sourceRegion: 'us', selection: 'Over', price: 115 },
      { bookmakerId: 'draftkings', bookmakerName: 'DraftKings', sourceType: 'sportsbook', sourceRegion: 'us', selection: 'Over', price: 115 },
    ],
  })

  const result = filterPlayerPropsDoc(doc)
  const offers = result.players[0].markets[0].lines[0].offers

  assert.ok(offers.every((o) => o.isBest === true))
})

test('filterPlayerPropsDoc isBest reflects filtered set, not global best', () => {
  const doc = makePropsDoc({
    bookmakers: [
      { bookmakerId: 'fanduel',    bookmakerName: 'FanDuel',    sourceType: 'sportsbook', sourceRegion: 'us',    selection: 'Over', price: 120 },
      { bookmakerId: 'prizepicks', bookmakerName: 'PrizePicks', sourceType: 'dfs',        sourceRegion: 'us_dfs', selection: 'Over', price: 110 },
    ],
  })

  // Filter to DFS only — PrizePicks should be isBest within that filtered set
  const result = filterPlayerPropsDoc(doc, { sourceType: 'dfs' })
  const offers = result.players[0].markets[0].lines[0].offers

  assert.equal(offers.length, 1)
  assert.equal(offers[0].bookmakerId, 'prizepicks')
  assert.equal(offers[0].isBest, true)
})
