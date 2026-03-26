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

/**
 * Build a sourceType match condition for use inside aggregation pipelines.
 */
function buildSourceTypeMatch(sourceType) {
  if (!sourceType || sourceType === 'all') return null

  return {
    $or: [
      { 'edge.venueType': sourceType, 'edge.type': 'arbitrage' },
      { 'edge.sourceType': sourceType, 'edge.type': { $ne: 'arbitrage' } },
    ],
  }
}

export default async function edgeRoutes(fastify) {
  // GET /v1/edge — all current edges (pro+)
  fastify.get('/v1/edge', async (request, reply) => {
    const { type, league, minProfit, minEdge, sourceType = 'all', limit, page } = request.query

    const filter = {}
    if (league) filter.leagueId = league

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    // Use aggregation: unwind edges, filter, then re-group per event
    const pipeline = [
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $skip: (pageNum - 1) * pageSize },
      { $limit: pageSize },
      { $unwind: '$edges' },
      { $project: { _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges' } },
    ]

    // Filter by edge type
    if (type) {
      pipeline.push({ $match: { 'edge.type': type } })
    }

    // Filter by sourceType
    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    // Filter by minProfit (arbitrage)
    if (minProfit) {
      const min = parseFloat(minProfit)
      pipeline.push({
        $match: {
          $or: [
            { 'edge.type': { $ne: 'arbitrage' } },
            { 'edge.arbitrage.profitPct': { $gte: min } },
          ],
        },
      })
    }

    // Filter by minEdge (value)
    if (minEdge) {
      const min = parseFloat(minEdge)
      pipeline.push({
        $match: {
          $or: [
            { 'edge.type': { $ne: 'value' } },
            { 'edge.valueBet.edgePct': { $gte: min } },
          ],
        },
      })
    }

    // Re-group back into event documents
    pipeline.push({
      $group: {
        _id: '$eventId',
        eventId: { $first: '$eventId' },
        leagueId: { $first: '$leagueId' },
        sport: { $first: '$sport' },
        calculatedAt: { $first: '$calculatedAt' },
        edges: { $push: '$edge' },
      },
    })
    pipeline.push({ $project: { _id: 0 } })
    pipeline.push({ $sort: { calculatedAt: -1 } })

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()

    return success(docs, { count: docs.length, page: pageNum })
  })

  // GET /v1/edge/value — value bets only (pro+)
  fastify.get('/v1/edge/value', async (request, reply) => {
    const { league, minEdge, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))

    // Unwind + filter at the edge level for precise limiting
    const pipeline = [
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 5 },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'value' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    if (minEdge) {
      pipeline.push({ $match: { 'edge.valueBet.edgePct': { $gte: parseFloat(minEdge) } } })
    }

    pipeline.push({ $limit: queryLimit })

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()

    const results = docs.map((doc) => ({
      eventId: doc.eventId,
      leagueId: doc.leagueId,
      sport: doc.sport,
      calculatedAt: doc.calculatedAt,
      ...doc.edge,
    }))

    return success(results, { count: results.length })
  })

  // GET /v1/edge/ev — positive EV bets only (pro+)
  fastify.get('/v1/edge/ev', async (request, reply) => {
    const { league, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))

    const pipeline = [
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 5 },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'ev' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    pipeline.push({ $limit: queryLimit })

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()

    const results = docs.map((doc) => ({
      eventId: doc.eventId,
      leagueId: doc.leagueId,
      sport: doc.sport,
      calculatedAt: doc.calculatedAt,
      ...doc.edge,
    }))

    return success(results, { count: results.length })
  })

  // GET /v1/edge/arbitrage — arbitrage opportunities only (pro+)
  fastify.get('/v1/edge/arbitrage', async (request, reply) => {
    const { league, minProfit, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}
    if (league) filter.leagueId = league

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))

    const pipeline = [
      { $match: filter },
      { $sort: { calculatedAt: -1 } },
      { $limit: queryLimit * 5 },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'arbitrage' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    if (minProfit) {
      pipeline.push({ $match: { 'edge.arbitrage.profitPct': { $gte: parseFloat(minProfit) } } })
    }

    pipeline.push({ $limit: queryLimit })

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()

    const results = docs.map((doc) => ({
      eventId: doc.eventId,
      leagueId: doc.leagueId,
      sport: doc.sport,
      calculatedAt: doc.calculatedAt,
      ...doc.edge,
    }))

    return success(results, { count: results.length })
  })

  // GET /v1/events/:eventId/edge — edges for specific event (pro+)
  fastify.get('/v1/events/:eventId/edge', async (request, reply) => {
    const { eventId } = request.params
    const { sourceType = 'all' } = request.query

    // Use aggregation to limit transferred data. Unwind + regroup to
    // apply sourceType filter server-side.
    const pipeline = [
      { $match: { eventId } },
      { $sort: { calculatedAt: -1 } },
      { $limit: 1 },
      { $unwind: '$edges' },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    pipeline.push({
      $group: {
        _id: '$eventId',
        eventId: { $first: '$eventId' },
        leagueId: { $first: '$leagueId' },
        sport: { $first: '$sport' },
        calculatedAt: { $first: '$calculatedAt' },
        edges: { $push: '$edge' },
      },
    })
    pipeline.push({ $project: { _id: 0 } })

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()
    const doc = docs[0] || null

    if (!doc) {
      return reply.code(404).send(error(`Edge data for event '${eventId}' not found.`, 404))
    }

    return success(doc, { league: doc.leagueId, event: eventId })
  })
}
