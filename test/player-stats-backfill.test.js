import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPreviousSeason,
  getSeasonEndDate,
  getSeasonStartDate,
} from '../src/config/sports.js'
import { buildPlayerStatsBackfillWindows } from '../src/ingestion/scheduler.js'

test('season helpers derive previous seasons correctly for split and year formats', () => {
  assert.equal(getPreviousSeason('nba', '2025-26'), '2024-25')
  assert.equal(getPreviousSeason('nfl', '2025-26'), '2024-25')
  assert.equal(getPreviousSeason('nhl', '2025-26'), '2024-25')
  assert.equal(getPreviousSeason('mlb', '2026'), '2025')
})

test('season date helpers return full prior-season windows for each league', () => {
  assert.equal(getSeasonStartDate('nba', '2024-25').toISOString(), '2024-10-01T00:00:00.000Z')
  assert.equal(getSeasonEndDate('nba', '2024-25').toISOString(), '2025-06-30T00:00:00.000Z')

  assert.equal(getSeasonStartDate('nfl', '2024-25').toISOString(), '2024-09-01T00:00:00.000Z')
  assert.equal(getSeasonEndDate('nfl', '2024-25').toISOString(), '2025-02-28T00:00:00.000Z')

  assert.equal(getSeasonStartDate('mlb', '2025').toISOString(), '2025-03-01T00:00:00.000Z')
  assert.equal(getSeasonEndDate('mlb', '2025').toISOString(), '2025-10-31T00:00:00.000Z')
})

test('player-stats backfill windows include historical seasons without extending past season end', () => {
  const nbaWindows = buildPlayerStatsBackfillWindows('nba', ['2024-25'])
  assert.equal(nbaWindows.length, 1)
  assert.equal(nbaWindows[0].season, '2024-25')
  assert.equal(nbaWindows[0].startDate.toISOString(), '2024-10-01T00:00:00.000Z')
  assert.equal(nbaWindows[0].endDate.toISOString(), '2025-06-30T00:00:00.000Z')

  const mlbWindows = buildPlayerStatsBackfillWindows('mlb', ['2025'])
  assert.equal(mlbWindows.length, 1)
  assert.equal(mlbWindows[0].startDate.toISOString(), '2025-03-01T00:00:00.000Z')
  assert.equal(mlbWindows[0].endDate.toISOString(), '2025-10-31T00:00:00.000Z')
})
