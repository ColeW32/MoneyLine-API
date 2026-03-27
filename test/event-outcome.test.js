import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveEventOutcome } from '../src/ingestion/normalizers/shared.js'

test('deriveEventOutcome returns winner and loser fields for final home wins', () => {
  const result = deriveEventOutcome({
    status: 'final',
    homeTeamId: 'nba-nyk',
    awayTeamId: 'nba-bos',
    homeTeamName: 'New York Knicks',
    awayTeamName: 'Boston Celtics',
    homeScore: 110,
    awayScore: 102,
  })

  assert.deepEqual(result, {
    outcome: 'home_win',
    winnerTeamId: 'nba-nyk',
    winnerTeamName: 'New York Knicks',
    loserTeamId: 'nba-bos',
    loserTeamName: 'Boston Celtics',
  })
})

test('deriveEventOutcome returns draw for final tied games', () => {
  const result = deriveEventOutcome({
    status: 'final',
    homeTeamId: 'nfl-buf',
    awayTeamId: 'nfl-kc',
    homeTeamName: 'Buffalo Bills',
    awayTeamName: 'Kansas City Chiefs',
    homeScore: 24,
    awayScore: 24,
  })

  assert.deepEqual(result, {
    outcome: 'draw',
    winnerTeamId: null,
    winnerTeamName: null,
    loserTeamId: null,
    loserTeamName: null,
  })
})

test('deriveEventOutcome ignores non-final events', () => {
  const result = deriveEventOutcome({
    status: 'in_progress',
    homeTeamId: 'mlb-nyy',
    awayTeamId: 'mlb-bos',
    homeTeamName: 'New York Yankees',
    awayTeamName: 'Boston Red Sox',
    homeScore: 5,
    awayScore: 2,
  })

  assert.deepEqual(result, {})
})
