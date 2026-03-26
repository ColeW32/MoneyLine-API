import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

/**
 * Filter edges by sourceType.
 *
 * - arbitrage edges carry `venueType`: 'sportsbook' | 'dfs' | 'exchange' | 'mixed'
 * - value / ev edges carry `sourceType`: 'sportsbook' | 'dfs' | 'exchange'
 *
 * sourceType param:
 *   'sportsbook'           — only sportsbook-only arbs + sportsbook value/ev
 *   'dfs'                  — only DFS-only arbs + DFS value/ev
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
    const { type, league, minProfit, minEdge, sourceType = 'all', limit, page } = request.query

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
    const { league, minEdge, limit: limitParam, sourceType = 'all' } = request.query
    // Match only on leagueId (non-multikey) so sort uses the index.
    // Edge type filtering is done server-side in $project instead.
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const docs = await getCollection('edge_data').aggregate([
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 3 },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1,
        edges: { $filter: { input: '$edges', as: 'e', cond: { $eq: ['$$e.type', 'value'] } } },
      }},
      { $match: { 'edges.0': { $exists: true } } },
      { $limit: queryLimit },
    ]).toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
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
    const { league, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const docs = await getCollection('edge_data').aggregate([
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 3 },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1,
        edges: { $filter: { input: '$edges', as: 'e', cond: { $eq: ['$$e.type', 'ev'] } } },
      }},
      { $match: { 'edges.0': { $exists: true } } },
      { $limit: queryLimit },
    ]).toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
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
    const { league, minProfit, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const docs = await getCollection('edge_data').aggregate([
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 3 },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1,
        edges: { $filter: { input: '$edges', as: 'e', cond: { $eq: ['$$e.type', 'arbitrage'] } } },
      }},
      { $match: { 'edges.0': { $exists: true } } },
      { $limit: queryLimit },
    ]).toArray()

    const results = docs.flatMap((doc) =>
      doc.edges
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
    const { sourceType = 'all' } = request.query

    const docs = await getCollection('edge_data').aggregate([
      { $match: { eventId } },
      { $sort: { calculatedAt: -1 } },
      { $limit: 1 },
      { $project: { _id: 0 } },
    ]).toArray()

    const doc = docs[0] || null

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
