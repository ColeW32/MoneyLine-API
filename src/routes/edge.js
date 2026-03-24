import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

/**
 * Filter edges by sourceType.
 *
 * - arbitrage edges carry `venueType`: 'sportsbook' | 'exchange' | 'mixed'
 * - value / ev edges carry `sourceType`: 'sportsbook' | 'exchange'
 *
 * sourceType param:
 *   'sportsbook' (default) — only sportsbook-only arbs + sportsbook value/ev
 *   'exchange'             — only exchange-only arbs + exchange value/ev
 *   'all'                  — everything (includes mixed arbs)
 */
export function filterEdgesBySourceType(edges, sourceType) {
  if (!sourceType || sourceType === 'all') return edges

  return edges.filter((e) => {
    if (e.type === 'arbitrage') {
      return e.venueType === sourceType
    }
    // value and ev edges carry sourceType directly
    return e.sourceType === sourceType
  })
}

export default async function edgeRoutes(fastify) {
  // GET /v1/edge — all current edges (pro+)
  fastify.get('/v1/edge', async (request, reply) => {
    const { type, league, minProfit, minEdge, sourceType = 'sportsbook', limit, page } = request.query

    const filter = {}
    if (league) filter.leagueId = league
    if (type) filter['edges.type'] = type

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    let docs = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray()

    // Apply sourceType filter
    docs = docs.map((doc) => ({
      ...doc,
      edges: filterEdgesBySourceType(doc.edges, sourceType),
    })).filter((doc) => doc.edges.length > 0)

    // Post-filter by minProfit (arbitrage)
    if (minProfit) {
      const min = parseFloat(minProfit)
      docs = docs.map((doc) => ({
        ...doc,
        edges: doc.edges.filter(
          (e) => e.type !== 'arbitrage' || e.arbitrage?.profitPct >= min
        ),
      })).filter((doc) => doc.edges.length > 0)
    }

    // Post-filter by minEdge (value)
    if (minEdge) {
      const min = parseFloat(minEdge)
      docs = docs.map((doc) => ({
        ...doc,
        edges: doc.edges.filter(
          (e) => e.type !== 'value' || e.valueBet?.edgePct >= min
        ),
      })).filter((doc) => doc.edges.length > 0)
    }

    return success(docs, { count: docs.length, page: pageNum })
  })

  // GET /v1/edge/value — value bets only (pro+)
  fastify.get('/v1/edge/value', async (request, reply) => {
    const { league, minEdge, sourceType = 'sportsbook' } = request.query
    const filter = { 'edges.type': 'value' }
    if (league) filter.leagueId = league

    const docs = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .limit(50)
      .toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
        .filter((e) => e.type === 'value')
        .filter((e) => filterEdgesBySourceType([e], sourceType).length > 0)
        .filter((e) => !minEdge || e.valueBet?.edgePct >= parseFloat(minEdge))
        .map((e) => ({
          eventId: doc.eventId,
          leagueId: doc.leagueId,
          sport: doc.sport,
          calculatedAt: doc.calculatedAt,
          ...e,
        }))
    )

    return success(results, { count: results.length })
  })

  // GET /v1/edge/ev — positive EV bets only (pro+)
  fastify.get('/v1/edge/ev', async (request, reply) => {
    const { league, sourceType = 'sportsbook' } = request.query
    const filter = { 'edges.type': 'ev' }
    if (league) filter.leagueId = league

    const docs = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .limit(50)
      .toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
        .filter((e) => e.type === 'ev')
        .filter((e) => filterEdgesBySourceType([e], sourceType).length > 0)
        .map((e) => ({
          eventId: doc.eventId,
          leagueId: doc.leagueId,
          sport: doc.sport,
          calculatedAt: doc.calculatedAt,
          ...e,
        }))
    )

    return success(results, { count: results.length })
  })

  // GET /v1/edge/arbitrage — arbitrage opportunities only (pro+)
  fastify.get('/v1/edge/arbitrage', async (request, reply) => {
    const { league, minProfit, sourceType = 'sportsbook' } = request.query
    const filter = { 'edges.type': 'arbitrage' }
    if (league) filter.leagueId = league

    const docs = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .limit(50)
      .toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
        .filter((e) => e.type === 'arbitrage')
        .filter((e) => filterEdgesBySourceType([e], sourceType).length > 0)
        .filter((e) => !minProfit || e.arbitrage?.profitPct >= parseFloat(minProfit))
        .map((e) => ({
          eventId: doc.eventId,
          leagueId: doc.leagueId,
          sport: doc.sport,
          calculatedAt: doc.calculatedAt,
          ...e,
        }))
    )

    return success(results, { count: results.length })
  })

  // GET /v1/events/:eventId/edge — edges for specific event (pro+)
  fastify.get('/v1/events/:eventId/edge', async (request, reply) => {
    const { eventId } = request.params
    const { sourceType = 'sportsbook' } = request.query

    const doc = await getCollection('edge_data').findOne(
      { eventId },
      { projection: { _id: 0 }, sort: { calculatedAt: -1 } }
    )

    if (!doc) {
      return reply.code(404).send(error(`Edge data for event '${eventId}' not found.`, 404))
    }

    const filtered = {
      ...doc,
      edges: filterEdgesBySourceType(doc.edges, sourceType),
    }

    return success(filtered, { league: doc.leagueId, event: eventId })
  })
}
