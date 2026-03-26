import { getCollection } from '../db.js'
import { getCurrentSeason, SPORTS } from '../config/sports.js'
import { success, error } from '../utils/response.js'
import { computeHitRates, getStatFields } from '../ingestion/hitRateCalculator.js'

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
    { projection: { _id: 0, L5: 1, L10: 1, L25: 1, season: 1, calculatedAt: 1 } }
  )

  if (cached && cached.calculatedAt > ONE_HOUR_AGO) {
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
        calculatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  return rates
}

export default async function playerRoutes(fastify) {
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

    return success(player, { league: player.leagueId })
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

    return success(stats, {
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
    if (line == null || line === '') {
      return reply.code(400).send(error('Query param "line" is required (e.g. 14.5).', 400))
    }

    const lineNum = parseFloat(line)
    if (!Number.isFinite(lineNum)) {
      return reply.code(400).send(error('Query param "line" must be a number.', 400))
    }

    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0, playerId: 1, leagueId: 1 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    const fields = getStatFields(player.leagueId, market)
    if (!fields) {
      return reply.code(400).send(
        error(`Market '${market}' is not supported for hit-rate calculation in ${player.leagueId}.`, 400)
      )
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

    const propDocs = await getCollection('player_props')
      .find(
        { eventId: { $in: eventIds }, marketTypes: market },
        { projection: { _id: 0, eventId: 1, players: 1 } }
      )
      .toArray()

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

        // Find the best line + best odds (highest price) for the direction
        let bestEntry = null
        for (const lineEntry of marketEntry.lines) {
          if (lineEntry.point == null) continue
          const selectionName = direction === 'over' ? 'over' : 'under'
          const matchingOffers = (lineEntry.offers || []).filter(
            (o) => String(o.selection || '').toLowerCase() === selectionName
          )
          if (matchingOffers.length === 0) continue

          const bestOffer = matchingOffers.reduce((a, b) => (b.price > a.price ? b : a))
          if (!bestEntry || bestOffer.price > bestEntry.bestOdds) {
            bestEntry = {
              line: lineEntry.point,
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

    // Assemble results
    const sortKey = sortBy.toUpperCase()
    const results = []

    for (const [pid, entry] of playerMap) {
      const meta = playerMeta.get(pid) || {}
      const hrKey = `${pid}:${entry.bestLine}`
      const hr = hitRateMap.get(hrKey)

      const sortRate = hr?.[sortKey]?.rate ?? null

      results.push({
        playerId: pid,
        playerName: entry.playerName || meta.playerName,
        teamId: meta.teamId || null,
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
      // Player props — query by playerId directly instead of fetching all event IDs first
      getCollection('player_props')
        .find(
          { playerIds: playerId },
          { projection: { _id: 0, players: 1 } }
        )
        .sort({ fetchedAt: -1 })
        .limit(5)
        .toArray(),
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
        const val = fields ? sumStatFieldsForChart(g.stats, fields) : null
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

// Inline helper so the analysis handler can compute stat values for chart display
function sumStatFieldsForChart(stats, fields) {
  if (!stats || !fields?.length) return null
  let total = 0
  let found = false
  for (const field of fields) {
    const val = stats[field]
    if (typeof val === 'number' && Number.isFinite(val)) {
      total += val
      found = true
    }
  }
  return found ? total : null
}
