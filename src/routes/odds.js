import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export function filterBookmakersForOddsResponse(bookmakers = [], {
  sourceType = 'all',
  bookmaker,
  market,
} = {}) {
  let filtered = bookmakers.map((bk) => ({
    ...bk,
    markets: Array.isArray(bk.markets) ? bk.markets.map((m) => ({
      ...m,
      outcomes: Array.isArray(m.outcomes) ? [...m.outcomes] : m.outcomes,
    })) : bk.markets,
  }))

  if (sourceType && sourceType !== 'all') {
    filtered = filtered.filter((bk) => bk.sourceType === sourceType)
  }

  if (bookmaker) {
    const normalized = bookmaker.toLowerCase()
    filtered = filtered.filter(
      (bk) => bk.bookmakerName.toLowerCase() === normalized || bk.bookmakerId.toLowerCase() === normalized
    )
  }

  if (market) {
    filtered = filtered.map((bk) => ({
      ...bk,
      markets: Array.isArray(bk.markets)
        ? bk.markets.filter((m) => m.marketType === market)
        : bk.markets,
    }))
  }

  return filtered
}

export function applyBooksPerRequestLimit(bookmakers = [], booksAllowed = Infinity) {
  if (booksAllowed === Infinity) return bookmakers
  return bookmakers.slice(0, booksAllowed)
}

export default async function oddsRoutes(fastify) {
  // GET /v1/events/:eventId/odds (starter+)
  fastify.get('/v1/events/:eventId/odds', async (request, reply) => {
    const { eventId } = request.params
    const { sourceType } = request.query

    const odds = await getCollection('odds').findOne(
      { eventId },
      { projection: { _id: 0 }, sort: { fetchedAt: -1 } }
    )

    if (!odds) {
      return reply.code(404).send(error(`Odds for event '${eventId}' not found.`, 404))
    }

    odds.bookmakers = filterBookmakersForOddsResponse(odds.bookmakers, { sourceType })
    odds.bookmakers = applyBooksPerRequestLimit(odds.bookmakers, request.tierConfig.booksPerRequest)

    return success(odds, { league: odds.leagueId, event: eventId })
  })

  // GET /v1/odds — bulk odds feed (starter+)
  fastify.get('/v1/odds', async (request, reply) => {
    const { league, market, bookmaker, sourceType, limit, page } = request.query

    const filter = {}
    if (league) filter.leagueId = league

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    const odds = await getCollection('odds')
      .find(filter, { projection: { _id: 0 } })
      .sort({ fetchedAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray()

    for (const o of odds) {
      o.bookmakers = filterBookmakersForOddsResponse(o.bookmakers, { sourceType, bookmaker, market })
    }

    for (const o of odds) {
      o.bookmakers = applyBooksPerRequestLimit(o.bookmakers, request.tierConfig.booksPerRequest)
    }

    return success(odds, { count: odds.length, page: pageNum })
  })

  // GET /v1/odds/bookmakers — list available bookmakers and exchanges (starter+)
  fastify.get('/v1/odds/bookmakers', async (request, reply) => {
    const { sourceType } = request.query

    const pipeline = [
      { $unwind: '$bookmakers' },
      {
        $group: {
          _id: '$bookmakers.bookmakerId',
          name: { $first: '$bookmakers.bookmakerName' },
          sourceType: { $first: '$bookmakers.sourceType' },
          sourceRegion: { $first: '$bookmakers.sourceRegion' },
        },
      },
      {
        $project: {
          _id: 0,
          bookmakerId: '$_id',
          name: 1,
          sourceType: 1,
          sourceRegion: 1,
        },
      },
      { $sort: { name: 1 } },
    ]

    let bookmakers = await getCollection('odds').aggregate(pipeline).toArray()

    if (sourceType && sourceType !== 'all') {
      bookmakers = bookmakers.filter((b) => b.sourceType === sourceType)
    }

    return success(bookmakers, { count: bookmakers.length })
  })
}
