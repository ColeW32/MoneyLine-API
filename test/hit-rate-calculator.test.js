import test from 'node:test'
import assert from 'node:assert/strict'
import { computeHitRates, getStatFields, sumStatFieldsForGame } from '../src/ingestion/hitRateCalculator.js'

test('computeHitRates uses current NBA stat keys from stored game logs', () => {
  const games = [
    { season: '2025-26', stats: { points: 24, total_rebounds: 4, assists: 6 } },
    { season: '2025-26', stats: { points: 15, total_rebounds: 2, assists: 6 } },
    { season: '2025-26', stats: { points: 41, total_rebounds: 3, assists: 11 } },
    { season: '2025-26', stats: { points: 13, total_rebounds: 1, assists: 6 } },
    { season: '2025-26', stats: { points: 25, total_rebounds: 2, assists: 10 } },
  ]

  const rates = computeHitRates(games, getStatFields('nba', 'player_points'), 19.5, 'over', '2025-26')

  assert.deepEqual(rates.L5, { games: 5, hits: 3, rate: 0.6 })
  assert.deepEqual(rates.season, { games: 5, hits: 3, rate: 0.6 })
})

test('computeHitRates reads nested NFL stat paths', () => {
  const games = [
    { season: '2025-26', stats: { passing: { yards: 291 } } },
    { season: '2025-26', stats: { passing: { yards: 180 } } },
    { season: '2025-26', stats: { passing: { yards: 305 } } },
  ]

  const rates = computeHitRates(games, getStatFields('nfl', 'player_pass_yds'), 250.5, 'over', '2025-26')

  assert.deepEqual(rates.L5, { games: 3, hits: 2, rate: 0.667 })
})

test('computeHitRates supports derived MLB total bases and pitcher outs', () => {
  const hitterGames = [
    { season: '2026', stats: { hitting: { hits: 2, doubles: 1, triples: 0, home_runs: 0 } } },
    { season: '2026', stats: { hitting: { hits: 1, doubles: 0, triples: 0, home_runs: 1 } } },
  ]
  const pitcherGames = [
    { season: '2026', stats: { pitching: { innings_pitched: 5.2 } } },
    { season: '2026', stats: { pitching: { innings_pitched: 4.0 } } },
  ]

  const totalBasesRates = computeHitRates(hitterGames, getStatFields('mlb', 'batter_total_bases'), 1.5, 'over', '2026')
  const outsRates = computeHitRates(pitcherGames, getStatFields('mlb', 'pitcher_outs'), 14.5, 'over', '2026')

  assert.deepEqual(totalBasesRates.L5, { games: 2, hits: 2, rate: 1 })
  assert.deepEqual(outsRates.L5, { games: 2, hits: 1, rate: 0.5 })
})

test('sumStatFieldsForGame supports nested and derived stat fields', () => {
  const nhlTotal = sumStatFieldsForGame(
    { skater: { goals: 1, assists: 2, shots_on_goal: 6 } },
    getStatFields('nhl', 'player_points')
  )

  const mlbSingles = sumStatFieldsForGame(
    { hitting: { hits: 3, doubles: 1, triples: 0, home_runs: 1 } },
    getStatFields('mlb', 'batter_singles')
  )

  assert.equal(nhlTotal, 3)
  assert.equal(mlbSingles, 1)
})

test('getStatFields returns mapping for NHL player_goal_scorer_anytime yes/no market', () => {
  const fields = getStatFields('nhl', 'player_goal_scorer_anytime')
  assert.deepEqual(fields, ['skater.goals'])
})

test('computeHitRates works for NHL yes/no anytime goal scorer using line=0', () => {
  // Simulates the hit rate calculation for "Anytime Goal Scorer" prop.
  // A player "hits" the prop if they scored at least 1 goal (goals > 0).
  const games = [
    { season: '2025-26', stats: { skater: { goals: 1, assists: 0 } } }, // scored
    { season: '2025-26', stats: { skater: { goals: 0, assists: 1 } } }, // did not score
    { season: '2025-26', stats: { skater: { goals: 2, assists: 0 } } }, // scored
    { season: '2025-26', stats: { skater: { goals: 0, assists: 0 } } }, // did not score
    { season: '2025-26', stats: { skater: { goals: 1, assists: 1 } } }, // scored
  ]

  const fields = getStatFields('nhl', 'player_goal_scorer_anytime')
  const rates = computeHitRates(games, fields, 0, 'over', '2025-26')

  assert.deepEqual(rates.L5, { games: 5, hits: 3, rate: 0.6 })
  assert.deepEqual(rates.season, { games: 5, hits: 3, rate: 0.6 })
})

test('getStatFields returns mapping for NFL player_anytime_td yes/no market', () => {
  const fields = getStatFields('nfl', 'player_anytime_td')
  assert.deepEqual(fields, ['rushing.rushing_touch_downs', 'receiving.receiving_touch_downs', 'passing.passing_touch_downs'])
})

test('computeHitRates works for NFL anytime TD using line=0', () => {
  const games = [
    { season: '2025-26', stats: { rushing: { rushing_touch_downs: 1 }, receiving: { receiving_touch_downs: 0 }, passing: { passing_touch_downs: 0 } } },
    { season: '2025-26', stats: { rushing: { rushing_touch_downs: 0 }, receiving: { receiving_touch_downs: 0 }, passing: { passing_touch_downs: 0 } } },
    { season: '2025-26', stats: { rushing: { rushing_touch_downs: 0 }, receiving: { receiving_touch_downs: 1 }, passing: { passing_touch_downs: 0 } } },
  ]

  const fields = getStatFields('nfl', 'player_anytime_td')
  const rates = computeHitRates(games, fields, 0, 'over', '2025-26')

  assert.deepEqual(rates.L5, { games: 3, hits: 2, rate: 0.667 })
})

test('computeHitRates supports under direction', () => {
  const games = [
    { season: '2025-26', stats: { points: 18 } },
    { season: '2025-26', stats: { points: 21 } },
    { season: '2025-26', stats: { points: 12 } },
    { season: '2025-26', stats: { points: 19 } },
  ]

  const rates = computeHitRates(games, getStatFields('nba', 'player_points'), 19.5, 'under', '2025-26')

  assert.deepEqual(rates.L5, { games: 4, hits: 3, rate: 0.75 })
})
