import { getMoneylineId } from '../idMapper.js'
import {
  parseDateTime,
  normalizeOdds as sharedNormalizeOdds,
  normalizePlayerStats as sharedNormalizePlayerStats,
} from './shared.js'
import { getCurrentSeason } from '../../config/sports.js'

const SOURCE = 'goalserve'
const SPORT = 'hockey'
const LEAGUE = 'nhl'

const TEAM_ABBR_MAP = {
  'ana': 'ANA', 'ari': 'ARI', 'bos': 'BOS', 'buf': 'BUF', 'cgy': 'CGY',
  'car': 'CAR', 'chi': 'CHI', 'col': 'COL', 'cbj': 'CBJ', 'dal': 'DAL',
  'det': 'DET', 'edm': 'EDM', 'fla': 'FLA', 'la': 'LAK', 'min': 'MIN',
  'mtl': 'MTL', 'nsh': 'NSH', 'nj': 'NJD', 'nyi': 'NYI', 'nyr': 'NYR',
  'ott': 'OTT', 'phi': 'PHI', 'pit': 'PIT', 'sj': 'SJS', 'sea': 'SEA',
  'stl': 'STL', 'tb': 'TBL', 'tor': 'TOR', 'van': 'VAN', 'vgk': 'VGK',
  'wpg': 'WPG', 'wsh': 'WSH',
}

function normalizeStatus(gsStatus) {
  if (!gsStatus) return 'scheduled'
  const s = gsStatus.toLowerCase()
  if (s === 'not started') return 'scheduled'
  if (s === 'final' || s.startsWith('final') || s === 'shootout') return 'final'
  if (s === 'postponed') return 'postponed'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  return 'in_progress'
}

function normalizePeriod(gsStatus) {
  if (!gsStatus) return null
  const s = gsStatus.toLowerCase()
  if (s.includes('period 1') || s === 'p1') return 'P1'
  if (s.includes('period 2') || s === 'p2') return 'P2'
  if (s.includes('period 3') || s === 'p3') return 'P3'
  if (s.includes('overtime') || s.startsWith('ot')) return 'OT'
  if (s.includes('shootout') || s === 'so') return 'SO'
  return gsStatus
}

function getConference(divisionName) {
  const eastern = ['Metropolitan', 'Atlantic']
  const western = ['Central', 'Pacific']
  if (eastern.includes(divisionName)) return 'Eastern'
  if (western.includes(divisionName)) return 'Western'
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
      for (const p of ['p1', 'p2', 'p3']) {
        const hScore = parseInt(m.hometeam[p])
        const aScore = parseInt(m.awayteam[p])
        if (!isNaN(hScore) || !isNaN(aScore)) {
          periods.push({ period: p.toUpperCase(), home: hScore || 0, away: aScore || 0 })
        }
      }
      if (m.hometeam.ot && m.awayteam.ot) {
        const hotScore = parseInt(m.hometeam.ot)
        const aotScore = parseInt(m.awayteam.ot)
        if (!isNaN(hotScore) || !isNaN(aotScore)) {
          periods.push({ period: 'OT', home: hotScore || 0, away: aotScore || 0 })
        }
      }
      if (m.hometeam.so && m.awayteam.so) {
        const hsoScore = parseInt(m.hometeam.so)
        const asoScore = parseInt(m.awayteam.so)
        if (!isNaN(hsoScore) || !isNaN(asoScore)) {
          periods.push({ period: 'SO', home: hsoScore || 0, away: asoScore || 0 })
        }
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
      console.error(`[nhl-normalizer] Failed to normalize match ${m.id}:`, err.message)
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
          otLosses: parseInt(t.otl) || 0,
          points: parseInt(t.points) || 0,
          streak: t.streak || '',
          extra: {
            gb: t.gb,
            homeRecord: t.home_record,
            roadRecord: t.road_record,
            last10: t.last_10,
            goalsFor: parseInt(t.goals_for) || 0,
            goalsAgainst: parseInt(t.goals_against) || 0,
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
    else if (statusStr.toLowerCase().includes('questionable')) status = 'Questionable'
    else if (statusStr.toLowerCase().includes('doubtful')) status = 'Doubtful'
    else if (statusStr.toLowerCase().includes('ir')) status = 'IR'

    players.push({ playerId, name: r.player_name, position: '', status, injury, returnDate: '' })
  }

  return { teamId, leagueId: LEAGUE, updatedAt: new Date(), players }
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
