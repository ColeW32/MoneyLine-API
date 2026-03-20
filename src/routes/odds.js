import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function oddsRoutes(fastify) {
  // GET /v1/events/:eventId/odds (starter+)
  fastify.get('/v1/events/:eventId/odds', async (request, reply) => {
    const { eventId } = request.params
    const odds = await getCollection('odds').findOne(
      { eventId },
      { projection: { _id: 0 }, sort: { fetchedAt: -1 } }
    )

    if (!odds) {
      return reply.code(404).send(error(`Odds for event '${eventId}' not found.`, 404))
    }

    // Filter bookmakers by tier
    const booksAllowed = request.tierConfig.booksPerRequest
    if (booksAllowed !== Infinity && odds.bookmakers) {
      odds.bookmakers = odds.bookmakers.slice(0, booksAllowed)
    }

    return success(odds, { league: odds.leagueId, event: eventId })
  })

  // GET /v1/odds — bulk odds feed (starter+)
  fastify.get('/v1/odds', async (request, reply) => {
    const { league, market, bookmaker, limit, page } = request.query

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

    // Filter bookmakers by tier
    const booksAllowed = request.tierConfig.booksPerRequest
    if (booksAllowed !== Infinity) {
      for (const o of odds) {
        if (o.bookmakers) o.bookmakers = o.bookmakers.slice(0, booksAllowed)
      }
    }

    // Filter by market type if specified
    if (market) {
      for (const o of odds) {
        if (o.bookmakers) {
          for (const bk of o.bookmakers) {
            if (bk.markets) {
              bk.markets = bk.markets.filter((m) => m.marketType === market)
            }
          }
        }
      }
    }

    // Filter by specific bookmaker if specified
    if (bookmaker) {
      for (const o of odds) {
        if (o.bookmakers) {
          o.bookmakers = o.bookmakers.filter(
            (b) => b.bookmakerName.toLowerCase() === bookmaker.toLowerCase()
          )
        }
      }
    }

    return success(odds, { count: odds.length, page: pageNum })
  })

  // GET /v1/odds/bookmakers — list available sportsbooks (starter+)
  fastify.get('/v1/odds/bookmakers', async (request, reply) => {
    const pipeline = [
      { $unwind: '$bookmakers' },
      { $group: { _id: '$bookmakers.bookmakerName', bookmakerId: { $first: '$bookmakers.bookmakerId' } } },
      { $project: { _id: 0, bookmakerId: 1, name: '$_id' } },
      { $sort: { name: 1 } },
    ]

    const bookmakers = await getCollection('odds').aggregate(pipeline).toArray()
    return success(bookmakers, { count: bookmakers.length })
  })
}
