import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'
import { findBestOdds } from '../ingestion/bestBetsCalculator.js'
import { findValidEventIdsByCollection, hasCanonicalEvent } from '../utils/canonicalEvents.js'

function applyMarketFilter(markets, market) {
  if (!market) return markets
  return markets.filter((m) => m.marketType === market)
}

export default async function bestBetsRoutes(fastify) {
  // GET /v1/best-bets — bulk best bets feed (pro+)
  fastify.get('/v1/best-bets', async (request, reply) => {
    const { league, market, bookmaker, sourceType, limit, page } = request.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    // When a bookmaker filter is requested, compute on-demand from odds collection
    // so results reflect that book's best lines rather than the precomputed aggregate.
    if (bookmaker || (sourceType && sourceType !== 'all')) {
      const validEventIds = await findValidEventIdsByCollection('odds', {
        league,
        pageNum,
        pageSize,
        sortField: 'fetchedAt',
      })

      if (validEventIds.length === 0) {
        return success([], { count: 0, page: pageNum })
      }

      const oddsDocs = await getCollection('odds')
        .find({ eventId: { $in: validEventIds } }, { projection: { _id: 0 } })
        .sort({ fetchedAt: -1 })
        .toArray()

      const results = oddsDocs
        .map((doc) => {
          const markets = applyMarketFilter(
            findBestOdds(doc.bookmakers, { bookmaker, sourceType }),
            market
          )
          if (markets.length === 0) return null
          return {
            eventId: doc.eventId,
            leagueId: doc.leagueId,
            sport: doc.sport,
            calculatedAt: doc.fetchedAt,
            markets,
          }
        })
        .filter(Boolean)

      return success(results, { count: results.length, page: pageNum })
    }

    // Default: serve from precomputed best_bets collection
    const validEventIds = await findValidEventIdsByCollection('best_bets', {
      league,
      pageNum,
      pageSize,
      sortField: 'calculatedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0, page: pageNum })
    }

    const docs = await getCollection('best_bets')
      .find({ eventId: { $in: validEventIds } }, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .toArray()

    const results = docs
      .map((doc) => {
        const markets = applyMarketFilter(doc.markets, market)
        if (markets.length === 0) return null
        return { ...doc, markets }
      })
      .filter(Boolean)

    return success(results, { count: results.length, page: pageNum })
  })

  // GET /v1/events/:eventId/best-bets — best bets for specific event (pro+)
  fastify.get('/v1/events/:eventId/best-bets', async (request, reply) => {
    const { eventId } = request.params
    const { market, bookmaker, sourceType } = request.query
    if (!(await hasCanonicalEvent(eventId))) {
      return reply.code(404).send(error(`Best bets for event '${eventId}' not found.`, 404))
    }

    // On-demand computation when bookmaker or sourceType filter is applied
    if (bookmaker || (sourceType && sourceType !== 'all')) {
      const oddsDoc = await getCollection('odds').findOne(
        { eventId },
        { projection: { _id: 0 }, sort: { fetchedAt: -1 } }
      )

      if (!oddsDoc) {
        return reply.code(404).send(error(`Best bets for event '${eventId}' not found.`, 404))
      }

      const markets = applyMarketFilter(
        findBestOdds(oddsDoc.bookmakers, { bookmaker, sourceType }),
        market
      )

      if (markets.length === 0) {
        return reply.code(404).send(error(`Best bets for event '${eventId}' not found.`, 404))
      }

      return success(
        { eventId, leagueId: oddsDoc.leagueId, sport: oddsDoc.sport, calculatedAt: oddsDoc.fetchedAt, markets },
        { league: oddsDoc.leagueId, event: eventId }
      )
    }

    // Default: serve from precomputed collection
    const doc = await getCollection('best_bets').findOne(
      { eventId },
      { projection: { _id: 0 }, sort: { calculatedAt: -1 } }
    )

    if (!doc) {
      return reply.code(404).send(error(`Best bets for event '${eventId}' not found.`, 404))
    }

    const markets = applyMarketFilter(doc.markets, market)
    if (markets.length === 0) {
      return reply.code(404).send(error(`Best bets for event '${eventId}' not found.`, 404))
    }

    return success({ ...doc, markets }, { league: doc.leagueId, event: eventId })
  })
}
