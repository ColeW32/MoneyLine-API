import 'dotenv/config'
import { randomBytes } from 'crypto'
import { connectDB, closeDB, getCollection } from '../src/db.js'
import { sha256 } from '../src/utils/hash.js'
import { calculateEdges } from '../src/ingestion/edgeCalculator.js'
import { buildPlayerPropsDocFromOddsDoc } from '../src/utils/playerProps.js'

async function seed() {
  await connectDB()

  console.log('[seed] Seeding database...')

  // --- Leagues ---
  const leagues = [
    { leagueId: 'nba', sport: 'basketball', name: 'NBA', country: 'USA', season: '2025-26', active: true, updatedAt: new Date() },
    { leagueId: 'nfl', sport: 'football', name: 'NFL', country: 'USA', season: '2025-26', active: true, updatedAt: new Date() },
    { leagueId: 'mlb', sport: 'baseball', name: 'MLB', country: 'USA', season: '2026', active: true, updatedAt: new Date() },
    { leagueId: 'nhl', sport: 'hockey', name: 'NHL', country: 'USA', season: '2025-26', active: true, updatedAt: new Date() },
  ]

  for (const league of leagues) {
    await getCollection('leagues').updateOne(
      { leagueId: league.leagueId },
      { $set: league },
      { upsert: true }
    )
  }
  console.log('  - Leagues seeded')

  // --- NBA teams ---
  const nbaTeams = [
    { teamId: 'nba-bos', leagueId: 'nba', name: 'Boston Celtics', abbreviation: 'BOS', city: 'Boston', conference: 'Eastern', division: 'Atlantic', updatedAt: new Date() },
    { teamId: 'nba-nyk', leagueId: 'nba', name: 'New York Knicks', abbreviation: 'NYK', city: 'New York', conference: 'Eastern', division: 'Atlantic', updatedAt: new Date() },
    { teamId: 'nba-okc', leagueId: 'nba', name: 'Oklahoma City Thunder', abbreviation: 'OKC', city: 'Oklahoma City', conference: 'Western', division: 'Northwest', updatedAt: new Date() },
    { teamId: 'nba-den', leagueId: 'nba', name: 'Denver Nuggets', abbreviation: 'DEN', city: 'Denver', conference: 'Western', division: 'Northwest', updatedAt: new Date() },
    { teamId: 'nba-lal', leagueId: 'nba', name: 'Los Angeles Lakers', abbreviation: 'LAL', city: 'Los Angeles', conference: 'Western', division: 'Pacific', updatedAt: new Date() },
    { teamId: 'nba-gsw', leagueId: 'nba', name: 'Golden State Warriors', abbreviation: 'GSW', city: 'San Francisco', conference: 'Western', division: 'Pacific', updatedAt: new Date() },
    { teamId: 'nba-mil', leagueId: 'nba', name: 'Milwaukee Bucks', abbreviation: 'MIL', city: 'Milwaukee', conference: 'Eastern', division: 'Central', updatedAt: new Date() },
    { teamId: 'nba-cle', leagueId: 'nba', name: 'Cleveland Cavaliers', abbreviation: 'CLE', city: 'Cleveland', conference: 'Eastern', division: 'Central', updatedAt: new Date() },
  ]

  for (const team of nbaTeams) {
    await getCollection('teams').updateOne(
      { teamId: team.teamId },
      { $set: team },
      { upsert: true }
    )
  }
  console.log('  - NBA teams seeded')

  // --- NFL teams ---
  const nflTeams = [
    { teamId: 'nfl-kansas-city-chiefs', leagueId: 'nfl', name: 'Kansas City Chiefs', abbreviation: 'KC', city: 'Kansas City', conference: 'AFC', division: 'AFC West', updatedAt: new Date() },
    { teamId: 'nfl-buffalo-bills', leagueId: 'nfl', name: 'Buffalo Bills', abbreviation: 'BUF', city: 'Buffalo', conference: 'AFC', division: 'AFC East', updatedAt: new Date() },
    { teamId: 'nfl-philadelphia-eagles', leagueId: 'nfl', name: 'Philadelphia Eagles', abbreviation: 'PHI', city: 'Philadelphia', conference: 'NFC', division: 'NFC East', updatedAt: new Date() },
    { teamId: 'nfl-dallas-cowboys', leagueId: 'nfl', name: 'Dallas Cowboys', abbreviation: 'DAL', city: 'Dallas', conference: 'NFC', division: 'NFC East', updatedAt: new Date() },
  ]
  for (const team of nflTeams) {
    await getCollection('teams').updateOne({ teamId: team.teamId }, { $set: team }, { upsert: true })
  }
  console.log('  - NFL teams seeded')

  // --- MLB teams ---
  const mlbTeams = [
    { teamId: 'mlb-los-angeles-dodgers', leagueId: 'mlb', name: 'Los Angeles Dodgers', abbreviation: 'LAD', city: 'Los Angeles', conference: 'National', division: 'NL West', updatedAt: new Date() },
    { teamId: 'mlb-new-york-yankees', leagueId: 'mlb', name: 'New York Yankees', abbreviation: 'NYY', city: 'New York', conference: 'American', division: 'AL East', updatedAt: new Date() },
    { teamId: 'mlb-houston-astros', leagueId: 'mlb', name: 'Houston Astros', abbreviation: 'HOU', city: 'Houston', conference: 'American', division: 'AL West', updatedAt: new Date() },
    { teamId: 'mlb-atlanta-braves', leagueId: 'mlb', name: 'Atlanta Braves', abbreviation: 'ATL', city: 'Atlanta', conference: 'National', division: 'NL East', updatedAt: new Date() },
  ]
  for (const team of mlbTeams) {
    await getCollection('teams').updateOne({ teamId: team.teamId }, { $set: team }, { upsert: true })
  }
  console.log('  - MLB teams seeded')

  // --- NHL teams ---
  const nhlTeams = [
    { teamId: 'nhl-edmonton-oilers', leagueId: 'nhl', name: 'Edmonton Oilers', abbreviation: 'EDM', city: 'Edmonton', conference: 'Western', division: 'Pacific', updatedAt: new Date() },
    { teamId: 'nhl-florida-panthers', leagueId: 'nhl', name: 'Florida Panthers', abbreviation: 'FLA', city: 'Sunrise', conference: 'Eastern', division: 'Atlantic', updatedAt: new Date() },
    { teamId: 'nhl-new-york-rangers', leagueId: 'nhl', name: 'New York Rangers', abbreviation: 'NYR', city: 'New York', conference: 'Eastern', division: 'Metropolitan', updatedAt: new Date() },
    { teamId: 'nhl-colorado-avalanche', leagueId: 'nhl', name: 'Colorado Avalanche', abbreviation: 'COL', city: 'Denver', conference: 'Western', division: 'Central', updatedAt: new Date() },
  ]
  for (const team of nhlTeams) {
    await getCollection('teams').updateOne({ teamId: team.teamId }, { $set: team }, { upsert: true })
  }
  console.log('  - NHL teams seeded')

  // --- Sample NBA events (today + upcoming) ---
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)

  const events = [
    {
      eventId: 'nba-20260317-bos-nyk',
      leagueId: 'nba',
      sport: 'basketball',
      homeTeamId: 'nba-nyk',
      awayTeamId: 'nba-bos',
      homeTeamName: 'New York Knicks',
      awayTeamName: 'Boston Celtics',
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 30),
      status: 'scheduled',
      venue: 'Madison Square Garden',
      scores: { home: 0, away: 0, periods: [] },
      updatedAt: new Date(),
    },
    {
      eventId: 'nba-20260317-okc-den',
      leagueId: 'nba',
      sport: 'basketball',
      homeTeamId: 'nba-den',
      awayTeamId: 'nba-okc',
      homeTeamName: 'Denver Nuggets',
      awayTeamName: 'Oklahoma City Thunder',
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0),
      status: 'scheduled',
      venue: 'Ball Arena',
      scores: { home: 0, away: 0, periods: [] },
      updatedAt: new Date(),
    },
    {
      eventId: 'nba-20260317-lal-gsw',
      leagueId: 'nba',
      sport: 'basketball',
      homeTeamId: 'nba-gsw',
      awayTeamId: 'nba-lal',
      homeTeamName: 'Golden State Warriors',
      awayTeamName: 'Los Angeles Lakers',
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 30),
      status: 'scheduled',
      venue: 'Chase Center',
      scores: { home: 0, away: 0, periods: [] },
      updatedAt: new Date(),
    },
    {
      eventId: 'nba-20260318-cle-mil',
      leagueId: 'nba',
      sport: 'basketball',
      homeTeamId: 'nba-mil',
      awayTeamId: 'nba-cle',
      homeTeamName: 'Milwaukee Bucks',
      awayTeamName: 'Cleveland Cavaliers',
      startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 20, 0),
      status: 'scheduled',
      venue: 'Fiserv Forum',
      scores: { home: 0, away: 0, periods: [] },
      updatedAt: new Date(),
    },
  ]

  for (const event of events) {
    await getCollection('events').updateOne(
      { eventId: event.eventId },
      { $set: event },
      { upsert: true }
    )
  }
  console.log('  - NBA events seeded')

  // --- Sample odds ---
  const odds = [
    {
      eventId: 'nba-20260317-bos-nyk',
      leagueId: 'nba',
      sport: 'basketball',
      fetchedAt: new Date(),
      bookmakers: [
        {
          bookmakerId: 'draftkings',
          bookmakerName: 'DraftKings',
          sourceRegion: 'us',
          sourceType: 'sportsbook',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'moneyline',
              outcomes: [
                { name: 'Boston Celtics', price: -180, impliedProbability: 0.643 },
                { name: 'New York Knicks', price: 155, impliedProbability: 0.392 },
              ],
            },
            {
              marketType: 'spread',
              outcomes: [
                { name: 'Boston Celtics', price: -110, point: -4.5 },
                { name: 'New York Knicks', price: -110, point: 4.5 },
              ],
            },
            {
              marketType: 'total',
              outcomes: [
                { name: 'Over', price: -110, point: 218.5 },
                { name: 'Under', price: -110, point: 218.5 },
              ],
            },
            {
              marketType: 'player_points',
              outcomes: [
                { name: 'Over', description: 'Jayson Tatum', price: -110, point: 29.5 },
                { name: 'Under', description: 'Jayson Tatum', price: -120, point: 29.5 },
              ],
            },
          ],
        },
        {
          bookmakerId: 'fanduel',
          bookmakerName: 'FanDuel',
          sourceRegion: 'us',
          sourceType: 'sportsbook',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'moneyline',
              outcomes: [
                { name: 'Boston Celtics', price: -175, impliedProbability: 0.636 },
                { name: 'New York Knicks', price: 150, impliedProbability: 0.4 },
              ],
            },
            {
              marketType: 'player_points',
              outcomes: [
                { name: 'Over', description: 'Jayson Tatum', price: 125, point: 29.5 },
                { name: 'Under', description: 'Jayson Tatum', price: -150, point: 29.5 },
              ],
            },
          ],
        },
        {
          bookmakerId: 'betmgm',
          bookmakerName: 'BetMGM',
          sourceRegion: 'us',
          sourceType: 'sportsbook',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'moneyline',
              outcomes: [
                { name: 'Boston Celtics', price: -185, impliedProbability: 0.649 },
                { name: 'New York Knicks', price: 160, impliedProbability: 0.385 },
              ],
            },
          ],
        },
        {
          bookmakerId: 'prizepicks',
          bookmakerName: 'PrizePicks',
          sourceRegion: 'us_dfs',
          sourceType: 'dfs',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'player_points',
              outcomes: [
                { name: 'Over', description: 'Jayson Tatum', price: -105, point: 29.5 },
                { name: 'Under', description: 'Jayson Tatum', price: -125, point: 29.5 },
              ],
            },
          ],
        },
        {
          bookmakerId: 'underdog',
          bookmakerName: 'Underdog Fantasy',
          sourceRegion: 'us_dfs',
          sourceType: 'dfs',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'player_points',
              outcomes: [
                { name: 'Over', description: 'Jayson Tatum', price: -102, point: 29.5 },
                { name: 'Under', description: 'Jayson Tatum', price: -128, point: 29.5 },
              ],
            },
          ],
        },
        {
          bookmakerId: 'kalshi',
          bookmakerName: 'Kalshi',
          sourceRegion: 'us_ex',
          sourceType: 'exchange',
          lastUpdate: new Date(),
          markets: [
            {
              marketType: 'moneyline',
              outcomes: [
                { name: 'Boston Celtics', price: -165, impliedProbability: 0.623 },
                { name: 'New York Knicks', price: 170, impliedProbability: 0.37 },
              ],
            },
            {
              marketType: 'player_points',
              outcomes: [
                { name: 'Over', description: 'Jayson Tatum', price: 118, point: 29.5 },
                { name: 'Under', description: 'Jayson Tatum', price: -142, point: 29.5 },
              ],
            },
          ],
        },
      ],
    },
    {
      eventId: 'nba-20260317-okc-den',
      leagueId: 'nba',
      sport: 'basketball',
      fetchedAt: new Date(),
      bookmakers: [
        {
          bookmakerId: 'draftkings',
          bookmakerName: 'DraftKings',
          sourceRegion: 'us',
          sourceType: 'sportsbook',
          lastUpdate: new Date(),
          markets: [{
            marketType: 'moneyline',
            outcomes: [
              { name: 'Oklahoma City Thunder', price: -140, impliedProbability: 0.583 },
              { name: 'Denver Nuggets', price: 120, impliedProbability: 0.455 },
            ],
          }],
        },
        {
          bookmakerId: 'fanduel',
          bookmakerName: 'FanDuel',
          sourceRegion: 'us',
          sourceType: 'sportsbook',
          lastUpdate: new Date(),
          markets: [{
            marketType: 'moneyline',
            outcomes: [
              { name: 'Oklahoma City Thunder', price: -135, impliedProbability: 0.574 },
              { name: 'Denver Nuggets', price: 115, impliedProbability: 0.465 },
            ],
          }],
        },
      ],
    },
  ]

  for (const odd of odds) {
    await getCollection('odds').updateOne(
      { eventId: odd.eventId },
      { $set: odd },
      { upsert: true }
    )

    const playerProps = buildPlayerPropsDocFromOddsDoc(odd)
    if (playerProps) {
      await getCollection('player_props').updateOne(
        { eventId: odd.eventId },
        { $set: playerProps },
        { upsert: true }
      )
    }
  }
  console.log('  - NBA odds seeded')

  await calculateEdges('nba', 'basketball')
  console.log('  - NBA edge data calculated')

  // --- Sample standings ---
  const standings = [
    {
      leagueId: 'nba',
      season: '2025-26',
      conference: 'Eastern',
      teams: [
        { teamId: 'nba-cle', teamName: 'Cleveland Cavaliers', rank: 1, wins: 52, losses: 14, pct: 0.788, streak: 'W4' },
        { teamId: 'nba-bos', teamName: 'Boston Celtics', rank: 2, wins: 48, losses: 18, pct: 0.727, streak: 'W2' },
        { teamId: 'nba-nyk', teamName: 'New York Knicks', rank: 3, wins: 44, losses: 22, pct: 0.667, streak: 'L1' },
        { teamId: 'nba-mil', teamName: 'Milwaukee Bucks', rank: 4, wins: 38, losses: 28, pct: 0.576, streak: 'W1' },
      ],
      updatedAt: new Date(),
    },
    {
      leagueId: 'nba',
      season: '2025-26',
      conference: 'Western',
      teams: [
        { teamId: 'nba-okc', teamName: 'Oklahoma City Thunder', rank: 1, wins: 50, losses: 16, pct: 0.758, streak: 'W6' },
        { teamId: 'nba-den', teamName: 'Denver Nuggets', rank: 2, wins: 42, losses: 24, pct: 0.636, streak: 'L2' },
        { teamId: 'nba-gsw', teamName: 'Golden State Warriors', rank: 5, wins: 34, losses: 32, pct: 0.515, streak: 'W1' },
        { teamId: 'nba-lal', teamName: 'Los Angeles Lakers', rank: 6, wins: 33, losses: 33, pct: 0.500, streak: 'L3' },
      ],
      updatedAt: new Date(),
    },
  ]

  for (const s of standings) {
    await getCollection('standings').updateOne(
      { leagueId: s.leagueId, season: s.season, conference: s.conference },
      { $set: s },
      { upsert: true }
    )
  }
  console.log('  - NBA standings seeded')

  // --- API Keys (one per tier for testing) ---
  const testKeys = [
    { raw: `ml_test_free_${randomBytes(16).toString('hex')}`, tier: 'free', name: 'Test Free Key' },
    { raw: `ml_test_starter_${randomBytes(16).toString('hex')}`, tier: 'starter', name: 'Test Starter Key' },
    { raw: `ml_test_pro_${randomBytes(16).toString('hex')}`, tier: 'pro', name: 'Test Pro Key' },
    { raw: `ml_test_biz_${randomBytes(16).toString('hex')}`, tier: 'business', name: 'Test Business Key' },
    { raw: `ml_test_ent_${randomBytes(16).toString('hex')}`, tier: 'enterprise', name: 'Test Enterprise Key' },
  ]

  console.log('\n  API Keys (save these — shown only once):')
  for (const { raw, tier, name } of testKeys) {
    const hashed = sha256(raw)
    await getCollection('api_keys').updateOne(
      { keyPrefix: raw.substring(0, 16) },
      {
        $set: {
          key: hashed,
          keyPrefix: raw.substring(0, 16),
          userId: `test-user-${tier}`,
          tier,
          name,
          requestCount: 0,
          monthlyRequests: 0,
          status: 'active',
          createdAt: new Date(),
          lastUsedAt: null,
        },
      },
      { upsert: true }
    )
    console.log(`    ${tier.padEnd(12)} → ${raw}`)
  }

  console.log('\n[seed] Done.')
  await closeDB()
}

seed().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
