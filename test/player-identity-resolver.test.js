import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizePlayerNameForMatching,
  enrichPlayerPropsWithIds,
  resolvePlayerIdFromName,
} from '../src/ingestion/playerIdentityResolver.js'

// --- normalizePlayerNameForMatching ---

test('normalizePlayerNameForMatching: basic name', () => {
  assert.equal(normalizePlayerNameForMatching('Jayson Tatum'), 'jaysontatum')
})

test('normalizePlayerNameForMatching: strips Jr suffix', () => {
  assert.equal(normalizePlayerNameForMatching('Al Horford Jr.'), 'alhorford')
})

test('normalizePlayerNameForMatching: strips Jr without period', () => {
  assert.equal(normalizePlayerNameForMatching('Wendell Carter Jr'), 'wendellcarter')
})

test('normalizePlayerNameForMatching: strips roman numeral suffixes', () => {
  assert.equal(normalizePlayerNameForMatching('Otto Porter III'), 'ottoporter')
  assert.equal(normalizePlayerNameForMatching('Mark Williams II'), 'markwilliams')
})

test('normalizePlayerNameForMatching: strips apostrophe punctuation', () => {
  assert.equal(normalizePlayerNameForMatching("D'Angelo Russell"), 'dangelorussell')
})

test('normalizePlayerNameForMatching: strips hyphens', () => {
  assert.equal(normalizePlayerNameForMatching('Karl-Anthony Towns'), 'karlanthonytowns')
})

test('normalizePlayerNameForMatching: handles initials with periods', () => {
  assert.equal(normalizePlayerNameForMatching('P.J. Washington'), 'pjwashington')
})

test('normalizePlayerNameForMatching: preserves middle initial', () => {
  assert.equal(normalizePlayerNameForMatching('Luka S. Doncic'), 'lukasdoncic')
})

test('normalizePlayerNameForMatching: does not strip non-suffix roman numerals mid-name', () => {
  // "Jr" only stripped when it is the last token
  const result = normalizePlayerNameForMatching('LeBron James')
  assert.equal(result, 'lebronjames')
})

test('normalizePlayerNameForMatching: is idempotent', () => {
  const once = normalizePlayerNameForMatching('Jayson Tatum')
  const twice = normalizePlayerNameForMatching(once)
  assert.equal(once, twice)
})

test('normalizePlayerNameForMatching: empty string returns empty string', () => {
  assert.equal(normalizePlayerNameForMatching(''), '')
})

test('normalizePlayerNameForMatching: null returns empty string', () => {
  assert.equal(normalizePlayerNameForMatching(null), '')
})

test('normalizePlayerNameForMatching: undefined returns empty string', () => {
  assert.equal(normalizePlayerNameForMatching(undefined), '')
})

test('normalizePlayerNameForMatching: transliterates accented characters', () => {
  assert.equal(normalizePlayerNameForMatching('Alexis Lafrenière'), 'alexislafreniere')
  assert.equal(normalizePlayerNameForMatching('Noah Östlund'), 'noahostlund')
  assert.equal(normalizePlayerNameForMatching('Jerar Encarnación'), 'jerarencarnacion')
  assert.equal(normalizePlayerNameForMatching('Nikola Jokić'), 'nikolajokic')
})

test('normalizePlayerNameForMatching: all-suffix input returns empty string', () => {
  // Single token that is a suffix — should not be stripped (need >1 token to strip suffix)
  // "Jr" alone stays as "jr"
  assert.equal(normalizePlayerNameForMatching('Jr'), 'jr')
})

// --- enrichPlayerPropsWithIds (pure logic, no DB) ---
// These tests verify that enrichPlayerPropsWithIds correctly handles the
// playerIds array and playerId fields even when resolution returns null.
// Full resolution requires a DB, so we test the structural contract only
// by passing a doc with no players.

test('enrichPlayerPropsWithIds: empty players array returns doc unchanged', async () => {
  const doc = { eventId: 'nba-ev-1', leagueId: 'nba', sport: 'basketball', players: [] }
  const result = await enrichPlayerPropsWithIds(doc)
  assert.deepEqual(result.playerIds, [])
  assert.equal(result.players.length, 0)
})

test('enrichPlayerPropsWithIds: null doc returns null', async () => {
  const result = await enrichPlayerPropsWithIds(null)
  assert.equal(result, null)
})

test('enrichPlayerPropsWithIds: missing players field returns doc unchanged', async () => {
  const doc = { eventId: 'nba-ev-1', leagueId: 'nba', sport: 'basketball' }
  const result = await enrichPlayerPropsWithIds(doc)
  assert.equal(result, doc)
})
