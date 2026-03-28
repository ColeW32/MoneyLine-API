import { getCollection } from '../db.js'
import { getRedis } from '../redis.js'
import { getCurrentSeason, SPORTS, getPlayerPropMarketDefinition } from '../config/sports.js'
import { success, error } from '../utils/response.js'
import {
  computeHitRates,
  getHitRateSchemaVersion,
  getStatFields,
  isHitRateComputable,
  sumStatFieldsForGame,
} from '../ingestion/hitRateCalculator.js'
import { americanToDecimal } from '../utils/odds.js'

const PLAYER_TRENDS_CACHE_TTL_SECONDS = 1800
const PLAYER_TRENDS_CACHE_VERSION = 2

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Compute hit rates for a player against a line.
 * First checks the hit_rates cache (valid for 1 hour), falls back to live computation.
 */
async function resolveHitRates(playerId, leagueId, market, line) {
  const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000)

  // Check cache
  const cached = await getCollection('hit_rates').findOne(
    { playerId, leagueId, market, line },
    { projection: { _id: 0, L5: 1, L10: 1, L25: 1, season: 1, calculatedAt: 1, schemaVersion: 1 } }
  )

  if (
    cached &&
    cached.calculatedAt > ONE_HOUR_AGO &&
    cached.schemaVersion === getHitRateSchemaVersion()
  ) {
    return { L5: cached.L5, L10: cached.L10, L25: cached.L25, season: cached.season }
  }

  // Compute on the fly
  const fields = getStatFields(leagueId, market)
  if (!fields) return null

  const currentSeason = getCurrentSeason(leagueId)
  const games = await getCollection('player_stats')
    .find(
      { playerId, statType: 'game' },
      { projection: { _id: 0, season: 1, gameDate: 1, stats: 1 } }
    )
    .sort({ gameDate: -1 })
    .limit(200)
    .toArray()

  if (games.length === 0) return null

  const rates = computeHitRates(games, fields, line, 'over', currentSeason)

  // Cache the result
  await getCollection('hit_rates').updateOne(
    { playerId, leagueId, market, line },
    {
      $set: {
        playerId, leagueId, market, line, direction: 'over',
        L5: rates.L5, L10: rates.L10, L25: rates.L25, season: rates.season,
        schemaVersion: getHitRateSchemaVersion(),
        calculatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  return rates
}

function normalizeSelection(selection) {
  const normalized = String(selection || '').trim().toLowerCase()
  return ['over', 'under'].includes(normalized) ? normalized : null
}

function roundToCents(value) {
  return Math.round(value * 100) / 100
}

function computeFlatBetTrend(games, fields, line, direction, price, windowSize, stake = 100) {
  if (!Number.isFinite(price) || price === 0) return null

  const recentGames = games.slice(0, windowSize)
  if (recentGames.length === 0) return null

  const winProfit = stake * (americanToDecimal(price) - 1)
  let sampleSize = 0
  let wins = 0
  let losses = 0
  let pushes = 0
  let profit = 0

  for (const game of recentGames) {
    const value = sumStatFieldsForGame(game.stats, fields)
    if (value == null) continue

    sampleSize += 1

    if (value === line) {
      pushes += 1
      continue
    }

    const won = direction === 'over' ? value > line : value < line
    if (won) {
      wins += 1
      profit += winProfit
    } else {
      losses += 1
      profit -= stake
    }
  }

  if (sampleSize === 0) return null

  return {
    sampleSize,
    wins,
    losses,
    pushes,
    hitRate: Math.round((wins / sampleSize) * 1000) / 1000,
    profit: roundToCents(profit),
    stake,
  }
}

function buildMatchup(event, teamsById) {
  if (!event) return null

  const awayTeam = teamsById.get(event.awayTeamId)
  const homeTeam = teamsById.get(event.homeTeamId)
  const away = awayTeam?.abbreviation || event.awayTeamName || event.awayTeamId
  const home = homeTeam?.abbreviation || event.homeTeamName || event.homeTeamId

  if (!away || !home) return null
  return `${away} @ ${home}`
}

function buildPlayerTrendsCacheKey({ league, windowSize, bookmaker, sourceType }) {
  return [
    'player-trends',
    `v${PLAYER_TRENDS_CACHE_VERSION}`,
    league || 'all',
    `w${windowSize}`,
    `b:${bookmaker || 'all'}`,
    `s:${sourceType}`,
  ].join(':')
}

export default async function playerRoutes(fastify) {
  // GET /v1/players — list players, optionally filtered by league or team
  fastify.get('/v1/players', async (request, reply) => {
    const { league, team, limit, page } = request.query
    const filter = {}
    if (league) filter.leagueId = league
    if (team) filter.teamId = team

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50))

    const [players, total] = await Promise.all([
      getCollection('players')
        .find(filter, { projection: { _id: 0 } })
        .sort({ playerName: 1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      getCollection('players').countDocuments(filter),
    ])

    return success(players, {
      count: players.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      ...(league && { league }),
      ...(team && { team }),
    })
  })

  // GET /v1/players/:playerId
  fastify.get('/v1/players/:playerId', async (request, reply) => {
    const { playerId } = request.params
    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    let teamAbbr = null
    let teamName = null
    if (player.teamId) {
      const teamDoc = await getCollection('teams').findOne(
        { teamId: player.teamId },
        { projection: { _id: 0, abbreviation: 1, name: 1 } }
      )
      teamAbbr = teamDoc?.abbreviation || null
      teamName = teamDoc?.name || null
    }

    return success({ ...player, teamAbbr, teamName }, { league: player.leagueId })
  })

  // GET /v1/players/:playerId/stats
  fastify.get('/v1/players/:playerId/stats', async (request, reply) => {
    const { playerId } = request.params
    const { type, season, date, from, to, eventId } = request.query
    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0, playerId: 1, leagueId: 1 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    const statType = type || 'season'
    if (statType === 'career') {
      return reply.code(400).send(error('type=career is not supported yet. Use type=season or type=game.', 400))
    }

    if (!['season', 'game'].includes(statType)) {
      return reply.code(400).send(error('Invalid type. Use "season" or "game".', 400))
    }

    if (date && (from || to)) {
      return reply.code(400).send(error('Query param "date" cannot be combined with "from" or "to".', 400))
    }

    if (statType === 'season' && (date || from || to)) {
      return reply.code(400).send(error('Date filters are only supported when type=game.', 400))
    }

    if (statType === 'season' && eventId) {
      return reply.code(400).send(error('eventId is only supported when type=game.', 400))
    }

    const filter = { playerId, statType }
    const currentSeason = getCurrentSeason(player.leagueId)

    if (statType === 'season') {
      filter.season = season || currentSeason
    } else {
      if (season) {
        filter.season = season
      } else if (!eventId && !date && !from && !to) {
        filter.season = currentSeason
      }

      if (eventId) {
        filter.eventId = eventId
      }

      if (date) {
        const dayStart = parseDateBoundary(date)
        const dayEnd = parseDateBoundary(date, true)
        if (!dayStart || !dayEnd) {
          return reply.code(400).send(error('Invalid date. Use YYYY-MM-DD.', 400))
        }
        filter.gameDate = { $gte: dayStart, $lte: dayEnd }
      } else if (from || to) {
        const range = {}
        if (from) {
          const fromDate = parseDateBoundary(from)
          if (!fromDate) {
            return reply.code(400).send(error('Invalid "from" date. Use YYYY-MM-DD or ISO 8601.', 400))
          }
          range.$gte = fromDate
        }
        if (to) {
          const toDate = parseDateBoundary(to, /^\d{4}-\d{2}-\d{2}$/.test(to))
          if (!toDate) {
            return reply.code(400).send(error('Invalid "to" date. Use YYYY-MM-DD or ISO 8601.', 400))
          }
          range.$lte = toDate
        }
        if (range.$gte && range.$lte && range.$gte > range.$lte) {
          return reply.code(400).send(error('"from" must be earlier than or equal to "to".', 400))
        }
        filter.gameDate = range
      }
    }

    const stats = await getCollection('player_stats')
      .find(filter, { projection: { _id: 0 } })
      .sort(statType === 'game' ? { gameDate: -1, updatedAt: -1 } : { season: -1, updatedAt: -1 })
      .toArray()

    let enrichedStats = stats
    if (statType === 'game' && stats.length > 0) {
      // Build opponent name → abbreviation map with a single teams query
      const opponentNames = [...new Set(stats.map((s) => s.opponent).filter(Boolean))]
      const teamDocs = opponentNames.length > 0
        ? await getCollection('teams')
            .find(
              { leagueId: player.leagueId, name: { $in: opponentNames } },
              { projection: { _id: 0, name: 1, abbreviation: 1 } }
            )
            .toArray()
        : []
      const abbrByName = new Map(teamDocs.map((t) => [t.name, t.abbreviation]))

      enrichedStats = stats.map((s) => ({
        ...s,
        gameDateDisplay: s.gameDate
          ? s.gameDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
          : null,
        opponentAbbr: s.opponent ? (abbrByName.get(s.opponent) ?? null) : null,
      }))
    }

    return success(enrichedStats, {
      player: playerId,
      type: statType,
      count: stats.length,
      ...(filter.season && { season: filter.season }),
      ...(filter.eventId && { eventId: filter.eventId }),
    })
  })

  // GET /v1/players/:playerId/hit-rates
  // Returns hit rates (L5/L10/L25/season) for a player against a specific prop line.
  // Query params: market (required), line (required)
  fastify.get('/v1/players/:playerId/hit-rates', async (request, reply) => {
    const { playerId } = request.params
    const { market, line } = request.query

    if (!market) {
      return reply.code(400).send(error('Query param "market" is required (e.g. player_points).', 400))
    }

    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0, playerId: 1, leagueId: 1 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    if (!isHitRateComputable(player.leagueId, market)) {
      return success(
        { playerId, market, hitRateSupported: false, reason: 'Market depends on in-game ordering or proprietary formulas — not computable from boxscore totals.' },
        { league: player.leagueId }
      )
    }

    const fields = getStatFields(player.leagueId, market)
    if (!fields) {
      return reply.code(400).send(
        error(`Market '${market}' is not supported for hit-rate calculation in ${player.leagueId}.`, 400)
      )
    }

    // Yes/no markets (e.g. player_goal_scorer_anytime) have no line — default to 0.
    // For all other markets, line is required.
    const marketDef = getPlayerPropMarketDefinition(player.leagueId, market)
    const isYesNoOrOverOnly = marketDef?.format === 'yes_no' || marketDef?.format === 'over_only'
    let lineNum
    if (line == null || line === '') {
      if (!isYesNoOrOverOnly) {
        return reply.code(400).send(error('Query param "line" is required (e.g. 14.5).', 400))
      }
      lineNum = 0
    } else {
      lineNum = parseFloat(line)
      if (!Number.isFinite(lineNum)) {
        return reply.code(400).send(error('Query param "line" must be a number.', 400))
      }
    }

    const rates = await resolveHitRates(playerId, player.leagueId, market, lineNum)

    if (!rates) {
      return reply.code(404).send(
        error(`No game stats found for player '${playerId}'. Cannot compute hit rates.`, 404)
      )
    }

    return success(
      { playerId, market, line: lineNum, direction: 'over', hitRates: rates },
      { league: player.leagueId }
    )
  })

  // GET /v1/players/trending
  // Returns players sorted by hit rate for a given league + market.
  // Query params: league (required), market (required), sortBy (l5|l10|l25|season, default l5),
  //               direction (over|under, default over), limit, page
  fastify.get('/v1/players/trending', async (request, reply) => {
    const { league, market, sortBy = 'l5', direction = 'over', limit, page } = request.query

    if (!league) {
      return reply.code(400).send(error('Query param "league" is required.', 400))
    }
    if (!SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }
    if (!market) {
      return reply.code(400).send(error('Query param "market" is required (e.g. player_points).', 400))
    }
    if (!['l5', 'l10', 'l25', 'season'].includes(sortBy.toLowerCase())) {
      return reply.code(400).send(error('sortBy must be one of: l5, l10, l25, season.', 400))
    }

    const fields = getStatFields(league, market)
    if (!fields) {
      return reply.code(400).send(
        error(`Market '${market}' is not supported for hit-rate calculation in ${league}.`, 400)
      )
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    // Get today's player props for this league + market
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const events = await getCollection('events')
      .find(
        { leagueId: league, startTime: { $gte: dayStart, $lt: dayEnd } },
        { projection: { _id: 0, eventId: 1 } }
      )
      .toArray()

    if (events.length === 0) {
      return success([], { count: 0, page: pageNum, league, market })
    }

    const eventIds = events.map((e) => e.eventId)

    // Use aggregation to filter markets server-side — player_props docs are massive
    const propDocs = await getCollection('player_props').aggregate([
      { $match: { eventId: { $in: eventIds }, marketTypes: market } },
      { $project: {
        _id: 0, eventId: 1,
        players: {
          $map: {
            input: '$players',
            as: 'p',
            in: {
              playerId: '$$p.playerId',
              playerName: '$$p.playerName',
              markets: { $filter: { input: '$$p.markets', as: 'm', cond: { $eq: ['$$m.marketType', market] } } },
            },
          },
        },
      }},
    ]).toArray()

    if (propDocs.length === 0) {
      return success([], { count: 0, page: pageNum, league, market })
    }

    // Build a flat list of players with their best offer for this market
    // Key by playerId to deduplicate across events
    const playerMap = new Map()

    for (const doc of propDocs) {
      for (const player of doc.players || []) {
        if (!player.playerId) continue

        const marketEntry = (player.markets || []).find((m) => m.marketType === market)
        if (!marketEntry?.lines?.length) continue

        // Find the best line + best odds (highest price) for the direction.
        // Yes/no markets (e.g. player_goal_scorer_anytime) have point=null — treat as line=0.
        let bestEntry = null
        for (const lineEntry of marketEntry.lines) {
          const effectiveLine = lineEntry.point ?? 0
          let matchingOffers
          if (lineEntry.point == null) {
            // Yes/no market: any offer with a finite price counts (player name is the selection)
            matchingOffers = (lineEntry.offers || []).filter(
              (o) => o.price != null && Number.isFinite(o.price)
            )
          } else {
            const selectionName = direction === 'over' ? 'over' : 'under'
            matchingOffers = (lineEntry.offers || []).filter(
              (o) => String(o.selection || '').toLowerCase() === selectionName
            )
          }
          if (matchingOffers.length === 0) continue

          const bestOffer = matchingOffers.reduce((a, b) => (b.price > a.price ? b : a))
          if (!bestEntry || bestOffer.price > bestEntry.bestOdds) {
            bestEntry = {
              line: effectiveLine,
              bestOdds: bestOffer.price,
              bookmakerId: bestOffer.bookmakerId,
              bookmakerName: bestOffer.bookmakerName,
              sourceType: bestOffer.sourceType,
            }
          }
        }

        if (!bestEntry) continue

        if (!playerMap.has(player.playerId)) {
          playerMap.set(player.playerId, {
            playerId: player.playerId,
            playerName: player.playerName,
            eventId: doc.eventId,
            bestLine: bestEntry.line,
            bestOdds: bestEntry.bestOdds,
            bookmakerId: bestEntry.bookmakerId,
            bookmakerName: bestEntry.bookmakerName,
            sourceType: bestEntry.sourceType,
          })
        }
      }
    }

    if (playerMap.size === 0) {
      return success([], { count: 0, page: pageNum, league, market })
    }

    // Fetch player metadata + hit rates in parallel
    const playerIds = [...playerMap.keys()]

    const [playerDocs, hitRateDocs] = await Promise.all([
      getCollection('players')
        .find(
          { playerId: { $in: playerIds } },
          { projection: { _id: 0, playerId: 1, playerName: 1, teamId: 1, position: 1 } }
        )
        .toArray(),
      getCollection('hit_rates')
        .find(
          { playerId: { $in: playerIds }, market, leagueId: league },
          { projection: { _id: 0, playerId: 1, line: 1, L5: 1, L10: 1, L25: 1, season: 1 } }
        )
        .toArray(),
    ])

    const playerMeta = new Map(playerDocs.map((p) => [p.playerId, p]))
    const hitRateMap = new Map(
      hitRateDocs.map((h) => [`${h.playerId}:${h.line}`, h])
    )

    const trendingTeamIds = new Set(playerDocs.map((p) => p.teamId).filter(Boolean))
    const trendingTeamDocs = trendingTeamIds.size > 0
      ? await getCollection('teams')
          .find(
            { teamId: { $in: [...trendingTeamIds] } },
            { projection: { _id: 0, teamId: 1, abbreviation: 1, name: 1 } }
          )
          .toArray()
      : []
    const trendingTeamsById = new Map(trendingTeamDocs.map((t) => [t.teamId, t]))

    // Assemble results
    const sortKey = sortBy.toUpperCase()
    const results = []

    for (const [pid, entry] of playerMap) {
      const meta = playerMeta.get(pid) || {}
      const hrKey = `${pid}:${entry.bestLine}`
      const hr = hitRateMap.get(hrKey)
      const team = trendingTeamsById.get(meta.teamId)

      const sortRate = hr?.[sortKey]?.rate ?? null

      results.push({
        playerId: pid,
        playerName: entry.playerName || meta.playerName,
        teamId: meta.teamId || null,
        teamAbbr: team?.abbreviation || null,
        teamName: team?.name || null,
        position: meta.position || null,
        eventId: entry.eventId,
        market,
        direction,
        bestLine: entry.bestLine,
        bestOdds: entry.bestOdds,
        bookmakerName: entry.bookmakerName,
        bookmakerId: entry.bookmakerId,
        sourceType: entry.sourceType,
        hitRates: hr
          ? {
              L5: hr.L5 ? { games: hr.L5.games, hits: hr.L5.hits, rate: hr.L5.rate } : null,
              L10: hr.L10 ? { games: hr.L10.games, hits: hr.L10.hits, rate: hr.L10.rate } : null,
              L25: hr.L25 ? { games: hr.L25.games, hits: hr.L25.hits, rate: hr.L25.rate } : null,
              season: hr.season ? { games: hr.season.games, hits: hr.season.hits, rate: hr.season.rate } : null,
            }
          : null,
        _sortRate: sortRate,
      })
    }

    // Sort by hit rate descending (nulls last)
    results.sort((a, b) => {
      if (a._sortRate === null && b._sortRate === null) return 0
      if (a._sortRate === null) return 1
      if (b._sortRate === null) return -1
      return b._sortRate - a._sortRate
    })

    // Paginate
    const total = results.length
    const paginated = results
      .slice((pageNum - 1) * pageSize, pageNum * pageSize)
      .map(({ _sortRate, ...rest }) => rest) // remove internal sort field

    return success(paginated, {
      count: paginated.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      league,
      market,
      sortBy,
      direction,
    })
  })

  // GET /v1/players/trends
  // Returns each player's highest-profit active prop trend over a rolling game window.
  // Query params: league (optional), window (default 25), limit, page, bookmaker, sourceType
  fastify.get('/v1/players/trends', async (request, reply) => {
    const {
      league,
      window = 25,
      limit,
      page,
      bookmaker,
      sourceType = 'all',
    } = request.query

    if (league && !SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }

    const windowSize = parseInt(window, 10)
    if (!Number.isInteger(windowSize) || windowSize < 1 || windowSize > 100) {
      return reply.code(400).send(error('window must be an integer between 1 and 100.', 400))
    }

    if (!['all', 'sportsbook', 'dfs', 'exchange'].includes(sourceType)) {
      return reply.code(400).send(error('sourceType must be one of: all, sportsbook, dfs, exchange.', 400))
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 25))
    const normalizedBookmaker = bookmaker ? String(bookmaker).trim().toLowerCase() : null
    const cacheKey = buildPlayerTrendsCacheKey({
      league,
      windowSize,
      bookmaker: normalizedBookmaker,
      sourceType,
    })

    const redis = getRedis()
    const cached = await redis.get(cacheKey)
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
      const results = Array.isArray(parsed?.results) ? parsed.results : []
      const total = results.length
      const paginated = results.slice((pageNum - 1) * pageSize, pageNum * pageSize)

      return success(paginated, {
        count: paginated.length,
        total,
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        window: windowSize,
        stake: 100,
        ...(league && { league }),
        ...(bookmaker && { bookmaker }),
        sourceType,
        cache: 'hit',
      })
    }

    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const eventFilter = { startTime: { $gte: dayStart, $lt: dayEnd } }
    if (league) eventFilter.leagueId = league

    const events = await getCollection('events')
      .find(
        eventFilter,
        {
          projection: {
            _id: 0,
            eventId: 1,
            leagueId: 1,
            homeTeamId: 1,
            awayTeamId: 1,
            homeTeamName: 1,
            awayTeamName: 1,
            startTime: 1,
          },
        }
      )
      .toArray()

    if (events.length === 0) {
      return success([], { count: 0, total: 0, page: pageNum, pages: 0, window: windowSize, ...(league && { league }) })
    }

    const eventMap = new Map(events.map((event) => [event.eventId, event]))
    const propDocs = await getCollection('player_props')
      .find(
        { eventId: { $in: [...eventMap.keys()] } },
        { projection: { _id: 0, eventId: 1, leagueId: 1, players: 1 } }
      )
      .toArray()

    if (propDocs.length === 0) {
      return success([], { count: 0, total: 0, page: pageNum, pages: 0, window: windowSize, ...(league && { league }) })
    }

    const playerIds = [...new Set(
      propDocs.flatMap((doc) => (doc.players || []).map((player) => player.playerId).filter(Boolean))
    )]

    if (playerIds.length === 0) {
      return success([], { count: 0, total: 0, page: pageNum, pages: 0, window: windowSize, ...(league && { league }) })
    }

    const [playerDocs, playerGameWindows] = await Promise.all([
      getCollection('players')
        .find(
          { playerId: { $in: playerIds } },
          { projection: { _id: 0, playerId: 1, playerName: 1, teamId: 1, leagueId: 1, position: 1 } }
        )
        .toArray(),
      getCollection('player_stats')
        .aggregate([
          { $match: { playerId: { $in: playerIds }, statType: 'game' } },
          { $sort: { playerId: 1, gameDate: -1 } },
          {
            $group: {
              _id: '$playerId',
              games: {
                $push: {
                  gameDate: '$gameDate',
                  stats: '$stats',
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              playerId: '$_id',
              games: { $slice: ['$games', windowSize] },
            },
          },
        ])
        .toArray(),
    ])

    const playerMeta = new Map(playerDocs.map((player) => [player.playerId, player]))
    const statsByPlayer = new Map(playerGameWindows.map((entry) => [entry.playerId, entry.games || []]))

    const teamIds = new Set()
    for (const player of playerDocs) {
      if (player.teamId) teamIds.add(player.teamId)
    }
    for (const event of events) {
      if (event.homeTeamId) teamIds.add(event.homeTeamId)
      if (event.awayTeamId) teamIds.add(event.awayTeamId)
    }

    const teamDocs = await getCollection('teams')
      .find(
        { teamId: { $in: [...teamIds] } },
        { projection: { _id: 0, teamId: 1, abbreviation: 1, name: 1 } }
      )
      .toArray()
    const teamsById = new Map(teamDocs.map((team) => [team.teamId, team]))

    const bestTrendByPlayer = new Map()

    for (const doc of propDocs) {
      const event = eventMap.get(doc.eventId)
      for (const player of doc.players || []) {
        if (!player.playerId) continue

        const meta = playerMeta.get(player.playerId)
        const games = statsByPlayer.get(player.playerId) || []
        if (!meta || games.length === 0) continue

        for (const marketEntry of player.markets || []) {
          const fields = getStatFields(doc.leagueId, marketEntry.marketType)
          if (!fields) continue

          for (const lineEntry of marketEntry.lines || []) {
            if (!Number.isFinite(lineEntry.point)) continue

            const bestOffersByDirection = new Map()
            for (const offer of lineEntry.offers || []) {
              const direction = normalizeSelection(offer.selection)
              if (!direction) continue
              if (sourceType !== 'all' && offer.sourceType !== sourceType) continue
              if (
                normalizedBookmaker
                && String(offer.bookmakerId || '').toLowerCase() !== normalizedBookmaker
                && String(offer.bookmakerName || '').toLowerCase() !== normalizedBookmaker
              ) {
                continue
              }

              const currentBestOffer = bestOffersByDirection.get(direction)
              if (!currentBestOffer || offer.price > currentBestOffer.price) {
                bestOffersByDirection.set(direction, offer)
              }
            }

            for (const [direction, offer] of bestOffersByDirection) {
              const trend = computeFlatBetTrend(
                games,
                fields,
                lineEntry.point,
                direction,
                offer.price,
                windowSize
              )

              if (!trend) continue

              const team = teamsById.get(meta.teamId)
              const candidate = {
                player: {
                  playerId: player.playerId,
                  name: player.playerName || meta.playerName,
                  teamId: meta.teamId || null,
                  teamAbbr: team?.abbreviation || null,
                  teamName: team?.name || null,
                  team: team?.abbreviation || team?.name || null,
                  matchup: buildMatchup(event, teamsById),
                },
                eventId: doc.eventId,
                leagueId: doc.leagueId,
                bet: {
                  market: marketEntry.marketType,
                  marketName: marketEntry.marketName,
                  direction,
                  line: lineEntry.point,
                  price: offer.price,
                  bookmakerId: offer.bookmakerId,
                  bookmakerName: offer.bookmakerName,
                  sourceType: offer.sourceType,
                },
                sampleSize: trend.sampleSize,
                performance: {
                  wins: trend.wins,
                  losses: trend.losses,
                  pushes: trend.pushes,
                  hitRate: trend.hitRate,
                  stake: trend.stake,
                },
                profit: trend.profit,
              }

              const currentBest = bestTrendByPlayer.get(player.playerId)
              if (
                !currentBest
                || candidate.profit > currentBest.profit
                || (candidate.profit === currentBest.profit && candidate.performance.hitRate > currentBest.performance.hitRate)
                || (candidate.profit === currentBest.profit
                  && candidate.performance.hitRate === currentBest.performance.hitRate
                  && candidate.sampleSize > currentBest.sampleSize)
              ) {
                bestTrendByPlayer.set(player.playerId, candidate)
              }
            }
          }
        }
      }
    }

    const results = [...bestTrendByPlayer.values()].sort((a, b) => {
      if (b.profit !== a.profit) return b.profit - a.profit
      if (b.performance.hitRate !== a.performance.hitRate) return b.performance.hitRate - a.performance.hitRate
      if (b.sampleSize !== a.sampleSize) return b.sampleSize - a.sampleSize
      return a.player.name.localeCompare(b.player.name)
    })

    const total = results.length
    const paginated = results.slice((pageNum - 1) * pageSize, pageNum * pageSize)

    await redis.set(
      cacheKey,
      JSON.stringify({ results }),
      { ex: PLAYER_TRENDS_CACHE_TTL_SECONDS }
    )

    return success(paginated, {
      count: paginated.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
      window: windowSize,
      stake: 100,
      ...(league && { league }),
      ...(bookmaker && { bookmaker }),
      sourceType,
      cache: 'miss',
    })
  })

  // GET /v1/players/:playerId/analysis
  // Returns integrated player data: best bet + game chart data + hit rates.
  // Query params: market (required), window (l5|l10|l25|season, default l5)
  fastify.get('/v1/players/:playerId/analysis', async (request, reply) => {
    const { playerId } = request.params
    const { market, window: windowParam = 'l5' } = request.query

    if (!market) {
      return reply.code(400).send(error('Query param "market" is required (e.g. player_points).', 400))
    }

    const validWindows = { l5: 5, l10: 10, l25: 25, season: null }
    const windowKey = windowParam.toLowerCase()
    if (!(windowKey in validWindows)) {
      return reply.code(400).send(error('window must be one of: l5, l10, l25, season.', 400))
    }

    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    const { leagueId } = player
    const fields = getStatFields(leagueId, market)
    const currentSeason = getCurrentSeason(leagueId)

    // Find today's event for this player's team (for context)
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    // Run all independent queries in parallel
    const [gameStats, currentEvent, propDocs] = await Promise.all([
      // Game stats for chart + hit rate computation
      getCollection('player_stats')
        .find(
          { playerId, statType: 'game' },
          { projection: { _id: 0, season: 1, gameDate: 1, opponent: 1, homeAway: 1, result: 1, stats: 1 } }
        )
        .sort({ gameDate: -1 })
        .limit(200)
        .toArray(),
      // Today's event for this player's team
      getCollection('events').findOne(
        {
          leagueId,
          startTime: { $gte: dayStart, $lt: dayEnd },
          $or: [{ homeTeamId: player.teamId }, { awayTeamId: player.teamId }],
        },
        { projection: { _id: 0, eventId: 1, homeTeamId: 1, awayTeamId: 1, homeTeamName: 1, awayTeamName: 1, startTime: 1 } }
      ),
      // Player props — use aggregation to only extract this player's matching market
      getCollection('player_props').aggregate([
        { $match: { playerIds: playerId } },
        { $sort: { fetchedAt: -1 } },
        { $limit: 5 },
        { $project: {
          _id: 0,
          players: {
            $filter: {
              input: {
                $map: {
                  input: '$players',
                  as: 'p',
                  in: {
                    playerId: '$$p.playerId',
                    playerName: '$$p.playerName',
                    markets: { $filter: { input: '$$p.markets', as: 'm', cond: { $eq: ['$$m.marketType', market] } } },
                  },
                },
              },
              as: 'p',
              cond: { $eq: ['$$p.playerId', playerId] },
            },
          },
        }},
      ]).toArray(),
    ])

    // Find best bet for this player + market across all today's prop docs
    let bestBet = null
    for (const doc of propDocs) {
      const playerEntry = (doc.players || []).find((p) => p.playerId === playerId)
      if (!playerEntry) continue

      const marketEntry = (playerEntry.markets || []).find((m) => m.marketType === market)
      if (!marketEntry?.lines?.length) continue

      for (const lineEntry of marketEntry.lines) {
        if (lineEntry.point == null) continue
        const overOffers = (lineEntry.offers || []).filter(
          (o) => String(o.selection || '').toLowerCase() === 'over'
        )
        if (overOffers.length === 0) continue
        const best = overOffers.reduce((a, b) => (b.price > a.price ? b : a))
        if (!bestBet || best.price > bestBet.odds) {
          bestBet = {
            market,
            line: lineEntry.point,
            odds: best.price,
            bookmakerId: best.bookmakerId,
            bookmakerName: best.bookmakerName,
            sourceType: best.sourceType,
          }
        }
      }
    }

    // Compute hit rates
    let hitRates = null
    if (fields && bestBet) {
      hitRates = await resolveHitRates(playerId, leagueId, market, bestBet.line)
    }

    // Build chart data (game-by-game values for the selected window)
    const windowSize = validWindows[windowKey]
    const chartGames = windowKey === 'season'
      ? gameStats.filter((g) => g.season === currentSeason)
      : gameStats.slice(0, windowSize)

    const chartData = chartGames
      .slice()
      .reverse() // chronological order for chart
      .map((g) => {
        const val = fields ? sumStatFieldsForGame(g.stats, fields) : null
        return {
          gameDate: g.gameDate,
          opponent: g.opponent,
          homeAway: g.homeAway,
          result: g.result,
          value: val,
          hit: bestBet && val !== null ? val > bestBet.line : null,
        }
      })

    return success(
      {
        player,
        currentEvent: currentEvent || null,
        bestBet,
        hitRates,
        chart: {
          window: windowKey,
          line: bestBet?.line ?? null,
          games: chartData,
        },
      },
      { league: leagueId, market }
    )
  })
}
