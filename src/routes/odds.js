import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

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

    // Apply sourceType filter before tier slicing
    if (sourceType && sourceType !== 'all' && odds.bookmakers) {
      odds.bookmakers = odds.bookmakers.filter((b) => b.sourceType === sourceType)
    }

    // Apply tier slicing after filtering
    const booksAllowed = request.tierConfig.booksPerRequest
    if (booksAllowed !== Infinity && odds.bookmakers) {
      odds.bookmakers = odds.bookmakers.slice(0, booksAllowed)
    }

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

    // Apply sourceType, market, and bookmaker filters BEFORE tier slicing
    for (const o of odds) {
      if (!o.bookmakers) continue

      if (sourceType && sourceType !== 'all') {
        o.bookmakers = o.bookmakers.filter((b) => b.sourceType === sourceType)
      }

      if (bookmaker) {
        o.bookmakers = o.bookmakers.filter(
          (b) => b.bookmakerName.toLowerCase() === bookmaker.toLowerCase() ||
                 b.bookmakerId.toLowerCase() === bookmaker.toLowerCase()
        )
      }

      if (market) {
        for (const bk of o.bookmakers) {
          if (bk.markets) {
            bk.markets = bk.markets.filter((m) => m.marketType === market)
          }
        }
      }
    }

    // Apply tier slicing after filtering
    const booksAllowed = request.tierConfig.booksPerRequest
    if (booksAllowed !== Infinity) {
      for (const o of odds) {
        if (o.bookmakers) o.bookmakers = o.bookmakers.slice(0, booksAllowed)
      }
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
