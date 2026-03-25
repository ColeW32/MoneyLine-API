import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPlayerPropsMarketCatalog } from '../src/routes/playerProps.js'
import { buildPlayerPropsDocFromOddsDoc, filterPlayerPropsDoc } from '../src/utils/playerProps.js'

function makeOddsDoc({ eventId = 'nba-ev-311286', leagueId = 'nba', sport = 'basketball', bookmakers = [] } = {}) {
  return {
    eventId,
    leagueId,
    sport,
    fetchedAt: new Date('2026-03-25T00:10:00.000Z'),
    bookmakers,
  }
}

test('buildPlayerPropsDocFromOddsDoc preserves the same canonical eventId as odds', () => {
  const oddsDoc = makeOddsDoc({
    eventId: 'nba-ev-canonical-123',
    bookmakers: [
      {
        bookmakerId: 'fanduel',
        bookmakerName: 'FanDuel',
        sourceType: 'sportsbook',
        sourceRegion: 'us',
        markets: [
          {
            marketType: 'player_points',
            lastUpdate: new Date('2026-03-25T00:09:00.000Z'),
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: 120, impliedProbability: 0.455 },
              { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -145, impliedProbability: 0.592 },
            ],
          },
        ],
      },
    ],
  })

  const doc = buildPlayerPropsDocFromOddsDoc(oddsDoc)

  assert.ok(doc)
  assert.equal(doc.eventId, oddsDoc.eventId)
  assert.equal(doc.players[0].playerName, 'Jayson Tatum')
  assert.deepEqual(doc.marketTypes, ['player_points'])
  assert.deepEqual(doc.playerNames, ['Jayson Tatum'])
})

test('buildPlayerPropsDocFromOddsDoc uses remapped canonical event ids without generating a second id', () => {
  const doc = buildPlayerPropsDocFromOddsDoc(makeOddsDoc({
    eventId: 'nba-20260317-bos-nyk',
    bookmakers: [
      {
        bookmakerId: 'draftkings',
        bookmakerName: 'DraftKings',
        sourceType: 'sportsbook',
        sourceRegion: 'us',
        markets: [
          {
            marketType: 'player_points',
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: -110, impliedProbability: 0.524 },
            ],
          },
        ],
      },
    ],
  }))

  assert.ok(doc)
  assert.equal(doc.eventId, 'nba-20260317-bos-nyk')
})

test('buildPlayerPropsDocFromOddsDoc groups offers by player, market, and point across bookmakers', () => {
  const doc = buildPlayerPropsDocFromOddsDoc(makeOddsDoc({
    bookmakers: [
      {
        bookmakerId: 'fanduel',
        bookmakerName: 'FanDuel',
        sourceType: 'sportsbook',
        sourceRegion: 'us',
        markets: [
          {
            marketType: 'player_points',
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: 120, impliedProbability: 0.455 },
              { name: 'Under', description: 'Jayson Tatum', point: 29.5, price: -145, impliedProbability: 0.592 },
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
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: 125, impliedProbability: 0.444 },
            ],
          },
        ],
      },
    ],
  }))

  assert.ok(doc)
  assert.equal(doc.players.length, 1)
  assert.equal(doc.players[0].markets.length, 1)
  assert.equal(doc.players[0].markets[0].lines.length, 1)
  assert.equal(doc.players[0].markets[0].lines[0].offers.length, 3)
})

test('filterPlayerPropsDoc supports market, player, bookmaker, and sourceType filtering', () => {
  const doc = buildPlayerPropsDocFromOddsDoc(makeOddsDoc({
    bookmakers: [
      {
        bookmakerId: 'fanduel',
        bookmakerName: 'FanDuel',
        sourceType: 'sportsbook',
        sourceRegion: 'us',
        markets: [
          {
            marketType: 'player_points',
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: 120, impliedProbability: 0.455 },
            ],
          },
          {
            marketType: 'player_assists',
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 6.5, price: 105, impliedProbability: 0.488 },
            ],
          },
        ],
      },
      {
        bookmakerId: 'kalshi',
        bookmakerName: 'Kalshi',
        sourceType: 'exchange',
        sourceRegion: 'us_ex',
        markets: [
          {
            marketType: 'player_points',
            outcomes: [
              { name: 'Over', description: 'Jayson Tatum', point: 29.5, price: 118, impliedProbability: 0.459 },
            ],
          },
        ],
      },
    ],
  }))

  const filtered = filterPlayerPropsDoc(doc, {
    market: 'player_points',
    player: 'tatum',
    bookmaker: 'kalshi',
    sourceType: 'exchange',
  })

  assert.ok(filtered)
  assert.equal(filtered.players.length, 1)
  assert.equal(filtered.players[0].markets.length, 1)
  assert.equal(filtered.players[0].markets[0].marketType, 'player_points')
  assert.equal(filtered.players[0].markets[0].lines[0].offers.length, 1)
  assert.equal(filtered.players[0].markets[0].lines[0].offers[0].bookmakerId, 'kalshi')
})

test('buildPlayerPropsMarketCatalog returns structured market metadata by league', () => {
  const [nba] = buildPlayerPropsMarketCatalog('nba')

  assert.equal(nba.leagueId, 'nba')
  assert.ok(nba.markets.some((market) => market.marketType === 'player_points'))
  assert.ok(nba.markets.some((market) => market.marketType === 'player_points_alternate' && market.isAlternate))
})

test('buildPlayerPropsDocFromOddsDoc returns null when an event has no supported player props', () => {
  const doc = buildPlayerPropsDocFromOddsDoc(makeOddsDoc({
    bookmakers: [
      {
        bookmakerId: 'fanduel',
        bookmakerName: 'FanDuel',
        sourceType: 'sportsbook',
        sourceRegion: 'us',
        markets: [
          {
            marketType: 'moneyline',
            outcomes: [
              { name: 'Boston Celtics', price: -180, impliedProbability: 0.643 },
              { name: 'New York Knicks', price: 155, impliedProbability: 0.392 },
            ],
          },
        ],
      },
    ],
  }))

  assert.equal(doc, null)
})
