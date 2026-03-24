import { getMoneylineId } from '../idMapper.js'
import {
  parseDateTime,
  toEasternDate,
  toArray,
  normalizeFlatStats,
  getGameResult,
  normalizeOdds as sharedNormalizeOdds,
  normalizePlayerStats as sharedNormalizePlayerStats,
} from './shared.js'
import { getCurrentSeason, getSeasonForDate } from '../../config/sports.js'

const SOURCE = 'goalserve'
const SPORT = 'baseball'
const LEAGUE = 'mlb'

const TEAM_ABBR_MAP = {
  'ari': 'ARI', 'atl': 'ATL', 'bal': 'BAL', 'bos': 'BOS', 'chc': 'CHC',
  'cws': 'CWS', 'cin': 'CIN', 'cle': 'CLE', 'col': 'COL', 'det': 'DET',
  'hou': 'HOU', 'kc': 'KC', 'laa': 'LAA', 'lad': 'LAD', 'mia': 'MIA',
  'mil': 'MIL', 'min': 'MIN', 'nym': 'NYM', 'nyy': 'NYY', 'oak': 'OAK',
  'phi': 'PHI', 'pit': 'PIT', 'sd': 'SD', 'sf': 'SF', 'sea': 'SEA',
  'stl': 'STL', 'tb': 'TB', 'tex': 'TEX', 'tor': 'TOR', 'wsh': 'WAS',
}

function normalizeStatus(gsStatus) {
  if (!gsStatus) return 'scheduled'
  const s = gsStatus.toLowerCase()
  if (s === 'not started') return 'scheduled'
  if (s === 'final' || s.startsWith('final')) return 'final'
  if (s === 'postponed') return 'postponed'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  if (s === 'rain delay' || s.includes('rain delay')) return 'delayed'
  return 'in_progress'
}

function normalizePeriod(gsStatus) {
  if (!gsStatus) return null
  const s = gsStatus.toLowerCase()

  // Match patterns like "Top 5th", "Bot 3rd", "Middle 5th"
  const topMatch = s.match(/top\s+(\d+)/)
  if (topMatch) return `T${topMatch[1]}`

  const botMatch = s.match(/bot(?:tom)?\s+(\d+)/)
  if (botMatch) return `B${botMatch[1]}`

  const midMatch = s.match(/mid(?:dle)?\s+(\d+)/)
  if (midMatch) return `M${midMatch[1]}`

  // Return raw inning text if no known pattern matched
  return gsStatus
}

function getConference(divisionName) {
  const al = ['AL East', 'AL Central', 'AL West']
  const nl = ['NL East', 'NL Central', 'NL West']
  if (al.includes(divisionName)) return 'American'
  if (nl.includes(divisionName)) return 'National'
  return divisionName
}

export async function normalizeScores(raw) {
  if (!raw?.scores?.category?.match) return []

  const matches = Array.isArray(raw.scores.category.match)
    ? raw.scores.category.match
    : [raw.scores.category.match]

  const events = []
  for (const m of matches) {
    try {
      const homeId = await getMoneylineId(SOURCE, m.hometeam.id, 'team', SPORT, m.hometeam.name)
      const awayId = await getMoneylineId(SOURCE, m.awayteam.id, 'team', SPORT, m.awayteam.name)
      const eventId = await getMoneylineId(SOURCE, m.id, 'event', SPORT)

      const periods = []
      // Standard 9 innings
      for (let i = 1; i <= 9; i++) {
        const key = `inning${i}`
        const hScore = parseInt(m.hometeam[key])
        const aScore = parseInt(m.awayteam[key])
        if (!isNaN(hScore) || !isNaN(aScore)) {
          periods.push({ period: String(i), home: hScore || 0, away: aScore || 0 })
        }
      }
      // Extra innings (inning10, inning11, etc.)
      let extra = 10
      while (m.hometeam[`inning${extra}`] != null || m.awayteam[`inning${extra}`] != null) {
        const hScore = parseInt(m.hometeam[`inning${extra}`])
        const aScore = parseInt(m.awayteam[`inning${extra}`])
        if (!isNaN(hScore) || !isNaN(aScore)) {
          periods.push({ period: String(extra), home: hScore || 0, away: aScore || 0 })
        }
        extra++
      }

      events.push({
        eventId,
        leagueId: LEAGUE,
        sport: SPORT,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeTeamName: m.hometeam.name,
        awayTeamName: m.awayteam.name,
        startTime: parseDateTime(m.datetime_utc),
        status: normalizeStatus(m.status),
        period: normalizePeriod(m.status),
        clock: m.timer || null,
        venue: m.venue_name || null,
        scores: {
          home: parseInt(m.hometeam.totalscore) || 0,
          away: parseInt(m.awayteam.totalscore) || 0,
          periods,
        },
        sourceUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (err) {
      console.error(`[mlb-normalizer] Failed to normalize match ${m.id}:`, err.message)
    }
  }
  return events
}

export async function normalizeStandings(raw) {
  if (!raw?.standings?.category?.league) return []

  const leagues = Array.isArray(raw.standings.category.league)
    ? raw.standings.category.league
    : [raw.standings.category.league]

  const results = []
  for (const league of leagues) {
    const divisions = Array.isArray(league.division) ? league.division : [league.division]

    for (const div of divisions) {
      const teams = Array.isArray(div.team) ? div.team : [div.team]
      const normalized = []

      for (const t of teams) {
        const teamId = await getMoneylineId(SOURCE, t.id, 'team', SPORT, t.name)
        normalized.push({
          teamId,
          teamName: t.name,
          rank: parseInt(t.position) || 0,
          wins: parseInt(t.won) || 0,
          losses: parseInt(t.lost) || 0,
          pct: parseFloat(t.percentage) || 0,
          streak: t.streak || '',
          extra: {
            gb: t.gb,
            homeRecord: t.home_record,
            roadRecord: t.road_record,
            last10: t.last_10,
            avgPointsFor: parseFloat(t.average_points_for) || 0,
            avgPointsAgainst: parseFloat(t.average_points_agains) || 0,
            diff: t.difference,
          },
        })
      }

      results.push({
        leagueId: LEAGUE,
        season: getCurrentSeason(LEAGUE),
        conference: getConference(div.name),
        division: div.name,
        teams: normalized,
        updatedAt: new Date(),
      })
    }
  }
  return results
}

export async function normalizeRoster(raw, gsTeamAbbr) {
  if (!raw?.team?.player) return null

  const team = raw.team
  const teamId = await getMoneylineId(SOURCE, team.id, 'team', SPORT, team.name)
  const players = Array.isArray(team.player) ? team.player : [team.player]

  const normalized = []
  for (const p of players) {
    const playerId = await getMoneylineId(SOURCE, p.id, 'player', SPORT, p.name)
    normalized.push({
      playerId, name: p.name, position: p.position || '', number: p.number || '',
      age: parseInt(p.age) || null, height: p.heigth || '', weight: p.weigth || '',
      college: p.college !== '--' ? p.college : '', experience: null,
    })
  }

  const playerDocs = []
  for (const p of players) {
    const playerId = await getMoneylineId(SOURCE, p.id, 'player', SPORT, p.name)
    playerDocs.push({
      playerId, teamId, leagueId: LEAGUE, name: p.name,
      position: p.position || '', number: p.number || '',
      status: 'active', updatedAt: new Date(),
    })
  }

  return {
    roster: { teamId, leagueId: LEAGUE, season: getCurrentSeason(LEAGUE), players: normalized, updatedAt: new Date() },
    team: { teamId, leagueId: LEAGUE, name: team.name, abbreviation: TEAM_ABBR_MAP[gsTeamAbbr] || gsTeamAbbr.toUpperCase(), updatedAt: new Date() },
    players: playerDocs,
  }
}

export async function normalizeInjuries(raw, gsTeamAbbr) {
  if (!raw?.team) return null

  const team = raw.team
  const teamId = await getMoneylineId(SOURCE, team.id, 'team', SPORT, team.name)

  let reports = []
  if (team.report) {
    reports = Array.isArray(team.report) ? team.report : [team.report]
  }

  const players = []
  for (const r of reports) {
    if (!r.player_name) continue
    const playerId = await getMoneylineId(SOURCE, r.player_id, 'player', SPORT, r.player_name)

    const injury = r.description || ''
    const statusStr = r.status || ''
    let status = 'Day-to-Day'
    if (statusStr.toLowerCase().includes('out') || statusStr.toLowerCase().includes('sidelined')) status = 'Out'
    else if (statusStr.toLowerCase().includes('60-day')) status = '60-Day IL'
    else if (statusStr.toLowerCase().includes('10-day')) status = '10-Day IL'
    else if (statusStr.toLowerCase().includes('paternity')) status = 'Paternity'

    players.push({ playerId, name: r.player_name, position: '', status, injury, returnDate: '' })
  }

  return { teamId, leagueId: LEAGUE, updatedAt: new Date(), players }
}

function mergePlayerGameEntry(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue
    if (typeof value === 'object' && !Array.isArray(value)) {
      target[key] = { ...(target[key] || {}), ...value }
    } else if (target[key] == null) {
      target[key] = value
    }
  }
}

export async function normalizePlayerStatsFromScores(raw) {
  if (!raw?.scores?.category?.match) return { games: [] }

  const matches = toArray(raw.scores.category.match)
  const games = []

  for (const match of matches) {
    const hitters = match?.stats?.hitters
    const pitchers = match?.stats?.pitchers
    if (!hitters && !pitchers) continue

    const eventId = await getMoneylineId(SOURCE, match.id, 'event', SPORT)
    const gameStartTime = parseDateTime(match.datetime_utc)
    const gameDate = toEasternDate(gameStartTime)
    const season = getSeasonForDate(LEAGUE, gameDate)
    const sourceUpdatedAt = new Date()

    for (const side of ['hometeam', 'awayteam']) {
      const opponentSide = side === 'hometeam' ? 'awayteam' : 'hometeam'
      const teamNode = match[side]
      if (!teamNode?.id) continue

      const teamId = await getMoneylineId(SOURCE, teamNode.id, 'team', SPORT, teamNode.name)
      const byPlayer = new Map()

      for (const row of toArray(hitters?.[side]?.player)) {
        if (!row?.id || !row?.name) continue
        const hittingStats = normalizeFlatStats(row, {
          excludeKeys: ['id', 'name', 'pos'],
        })
        if (!hittingStats) continue

        const playerId = await getMoneylineId(SOURCE, row.id, 'player', SPORT, row.name)
        if (!byPlayer.has(playerId)) {
          byPlayer.set(playerId, {
            playerId,
            playerName: row.name,
            position: row.pos || null,
            stats: {},
          })
        }
        mergePlayerGameEntry(byPlayer.get(playerId), {
          position: row.pos || byPlayer.get(playerId).position,
          stats: {
            hitting: hittingStats,
          },
        })
      }

      for (const row of toArray(pitchers?.[side]?.player)) {
        if (!row?.id || !row?.name) continue
        const pitchingStats = normalizeFlatStats(row, {
          excludeKeys: ['id', 'name', 'win', 'loss', 'pc-st'],
        })
        if (!pitchingStats) continue

        const playerId = await getMoneylineId(SOURCE, row.id, 'player', SPORT, row.name)
        if (!byPlayer.has(playerId)) {
          byPlayer.set(playerId, {
            playerId,
            playerName: row.name,
            position: null,
            stats: {},
          })
        }
        mergePlayerGameEntry(byPlayer.get(playerId), {
          stats: {
            pitching: pitchingStats,
          },
        })
      }

      for (const player of byPlayer.values()) {
        if (!player.stats?.hitting && !player.stats?.pitching) continue

        games.push({
          playerId: player.playerId,
          playerName: player.playerName,
          teamId,
          leagueId: LEAGUE,
          sport: SPORT,
          season,
          statType: 'game',
          eventId,
          gameStartTime,
          gameDate,
          opponent: match[opponentSide]?.name || null,
          homeAway: side === 'hometeam' ? 'home' : 'away',
          result: getGameResult(match.hometeam?.totalscore, match.awayteam?.totalscore, side),
          position: player.position,
          stats: player.stats,
          sourceUpdatedAt,
          updatedAt: new Date(),
        })
      }
    }
  }

  return { games }
}

export function normalizePlayerStats(raw, gsTeamAbbr) {
  return sharedNormalizePlayerStats(raw, {
    source: SOURCE,
    sport: SPORT,
    leagueId: LEAGUE,
    defaultSeason: getCurrentSeason(LEAGUE),
    fallbackAbbr: TEAM_ABBR_MAP[gsTeamAbbr] || gsTeamAbbr?.toUpperCase?.() || null,
  })
}

export function normalizeOdds(raw) {
  return sharedNormalizeOdds(raw, LEAGUE, SPORT)
}
