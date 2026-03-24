import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPreviousSeason,
  getSeasonEndDate,
  getSeasonStartDate,
} from '../src/config/sports.js'
import { buildPlayerStatsBackfillWindows, selectPendingBackfillSeasons } from '../src/ingestion/scheduler.js'
import { isValidSourceId } from '../src/ingestion/idMapper.js'
import { buildSyntheticScoreEventId } from '../src/ingestion/normalizers/shared.js'

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

test('source IDs treat undefined-like values as invalid', () => {
  assert.equal(isValidSourceId(undefined), false)
  assert.equal(isValidSourceId(null), false)
  assert.equal(isValidSourceId(''), false)
  assert.equal(isValidSourceId('undefined'), false)
  assert.equal(isValidSourceId('null'), false)
  assert.equal(isValidSourceId('311286'), true)
})

test('synthetic score event IDs stay league-correct when upstream event ids are missing', () => {
  const eventId = buildSyntheticScoreEventId('nfl', {
    hometeam: { name: 'Philadelphia Eagles' },
    awayteam: { name: 'Green Bay Packers' },
  }, new Date('2024-09-07T00:15:00.000Z'))

  assert.equal(eventId.startsWith('nfl-ev-'), true)
  assert.equal(eventId.includes('undefined'), false)
  assert.equal(eventId.includes('philadelphia-eagles'), true)
  assert.equal(eventId.includes('green-bay-packers'), true)
})

test('selectPendingBackfillSeasons skips completed seasons unless forced', () => {
  assert.deepEqual(
    selectPendingBackfillSeasons(['2024-25', '2025-26'], ['2024-25']),
    ['2025-26']
  )

  assert.deepEqual(
    selectPendingBackfillSeasons(['2024-25', '2025-26'], ['2024-25'], { force: true }),
    ['2024-25', '2025-26']
  )
})
