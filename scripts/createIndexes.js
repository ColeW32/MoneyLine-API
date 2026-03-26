import 'dotenv/config'
import { connectDB, closeDB } from '../src/db.js'

async function createIndexes() {
  const db = await connectDB()

  console.log('[indexes] Creating indexes...')

  // events
  await db.collection('events').createIndex({ leagueId: 1, startTime: -1 })
  await db.collection('events').createIndex({ status: 1, startTime: 1 })
  await db.collection('events').createIndex({ eventId: 1 }, { unique: true })
  console.log('  - events indexes created')

  // odds
  await db.collection('odds').createIndex({ eventId: 1, fetchedAt: -1 })
  console.log('  - odds indexes created')

  // player_props
  await db.collection('player_props').createIndex({ eventId: 1 }, { unique: true })
  await db.collection('player_props').createIndex({ leagueId: 1, fetchedAt: -1 })
  await db.collection('player_props').createIndex({ leagueId: 1, marketTypes: 1 })
  await db.collection('player_props').createIndex({ leagueId: 1, playerNames: 1 })
  console.log('  - player_props indexes created')

  // edge_data
  await db.collection('edge_data').createIndex({ eventId: 1, calculatedAt: -1 })
  await db.collection('edge_data').createIndex({ 'edges.type': 1, leagueId: 1, calculatedAt: -1 })
  console.log('  - edge_data indexes created')

  // api_keys
  await db.collection('api_keys').createIndex({ key: 1 }, { unique: true })
  console.log('  - api_keys indexes created')

  // usage_logs
  await db.collection('usage_logs').createIndex({ userId: 1, timestamp: -1 })
  await db.collection('usage_logs').createIndex({ timestamp: -1 }, { expireAfterSeconds: 7_776_000 }) // 90 days
  console.log('  - usage_logs indexes created')

  // teams
  await db.collection('teams').createIndex({ teamId: 1 }, { unique: true })
  await db.collection('teams').createIndex({ leagueId: 1 })
  console.log('  - teams indexes created')

  // players
  await db.collection('players').createIndex({ playerId: 1 }, { unique: true })
  await db.collection('players').createIndex({ teamId: 1 })
  console.log('  - players indexes created')

  // player_stats
  try {
    await db.collection('player_stats').dropIndex('playerId_1_statType_1_eventId_1')
  } catch {}
  await db.collection('player_stats').createIndex(
    { playerId: 1, statType: 1, eventId: 1 },
    { unique: true, partialFilterExpression: { statType: 'game' } }
  )
  await db.collection('player_stats').createIndex(
    { playerId: 1, statType: 1, season: 1 },
    { unique: true, partialFilterExpression: { statType: 'season' } }
  )
  await db.collection('player_stats').createIndex({ playerId: 1, statType: 1, season: 1, gameDate: -1 })
  await db.collection('player_stats').createIndex({ teamId: 1, season: 1 })
  console.log('  - player_stats indexes created')

  // leagues
  await db.collection('leagues').createIndex({ leagueId: 1 }, { unique: true })
  console.log('  - leagues indexes created')

  // rosters
  await db.collection('rosters').createIndex({ teamId: 1 })
  console.log('  - rosters indexes created')

  // injuries
  await db.collection('injuries').createIndex({ teamId: 1 })
  console.log('  - injuries indexes created')

  // standings
  await db.collection('standings').createIndex({ leagueId: 1, season: 1 })
  console.log('  - standings indexes created')

  // source_id_map legacy
  await db.collection('source_id_map').createIndex({ source: 1, sourceId: 1 }, { unique: true })
  await db.collection('source_id_map').createIndex({ moneylineId: 1 })
  console.log('  - source_id_map indexes created')

  // source_id_map_v2
  await db.collection('source_id_map_v2').createIndex({ source: 1, sourceId: 1, entityType: 1, sport: 1 }, { unique: true })
  await db.collection('source_id_map_v2').createIndex({ moneylineId: 1 })
  console.log('  - source_id_map_v2 indexes created')

  // ingestion_state
  await db.collection('ingestion_state').createIndex({ jobType: 1, leagueId: 1, season: 1 }, { unique: true })
  await db.collection('ingestion_state').createIndex({ jobType: 1, status: 1, updatedAt: -1 })
  console.log('  - ingestion_state indexes created')

  // users
  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  console.log('  - users indexes created')

  // users — billing indexes
  await db.collection('users').createIndex({ supabaseId: 1 }, { unique: true })
  await db.collection('users').createIndex({ stripeCustomerId: 1 }, { sparse: true })
  console.log('  - users billing indexes created')

  // credit_ledger
  await db.collection('credit_ledger').createIndex({ userId: 1, timestamp: -1 })
  await db.collection('credit_ledger').createIndex({ userId: 1, periodStart: 1 })
  console.log('  - credit_ledger indexes created')

  // billing_events
  await db.collection('billing_events').createIndex({ stripeEventId: 1 }, { unique: true })
  await db.collection('billing_events').createIndex({ userId: 1, createdAt: -1 })
  console.log('  - billing_events indexes created')

  // hit_rates
  await db.collection('hit_rates').createIndex(
    { playerId: 1, leagueId: 1, market: 1, line: 1 },
    { unique: true }
  )
  await db.collection('hit_rates').createIndex({ playerId: 1, market: 1 })
  await db.collection('hit_rates').createIndex({ leagueId: 1, market: 1, calculatedAt: -1 })
  console.log('  - hit_rates indexes created')

  console.log('[indexes] All indexes created successfully.')
  await closeDB()
}

createIndexes().catch((err) => {
  console.error('[indexes] Failed:', err)
  process.exit(1)
})
