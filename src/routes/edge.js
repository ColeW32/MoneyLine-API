import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'
import { findValidEventIdsByCollection, hasCanonicalEvent } from '../utils/canonicalEvents.js'

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

function buildMarketMatch(market) {
  if (!market) return null
  return { 'edge.market': market }
}

export default async function edgeRoutes(fastify) {
  // GET /v1/edge — all current edges (pro+)
  fastify.get('/v1/edge', async (request, reply) => {
    const { type, league, market, minProfit, minEdge, sourceType = 'all', limit, page } = request.query

    const filter = {}

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))
    const validEventIds = await findValidEventIdsByCollection('edge_data', {
      league,
      pageNum,
      pageSize,
      sortField: 'calculatedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0, page: pageNum })
    }

    // Build a $filter condition for edges based on query params
    const conditions = []
    if (type) conditions.push({ $eq: ['$$e.type', type] })
    if (market) conditions.push({ $eq: ['$$e.market', market] })
    if (sourceType && sourceType !== 'all') {
      conditions.push({
        $or: [
          { $and: [{ $eq: ['$$e.type', 'arbitrage'] }, { $eq: ['$$e.venueType', sourceType] }] },
          { $and: [{ $ne: ['$$e.type', 'arbitrage'] }, { $eq: ['$$e.sourceType', sourceType] }] },
        ],
      })
    }
    if (minProfit) {
      const min = parseFloat(minProfit)
      conditions.push({
        $or: [
          { $ne: ['$$e.type', 'arbitrage'] },
          { $gte: ['$$e.arbitrage.profitPct', min] },
        ],
      })
    }
    if (minEdge) {
      const min = parseFloat(minEdge)
      conditions.push({
        $or: [
          { $ne: ['$$e.type', 'value'] },
          { $gte: ['$$e.valueBet.edgePct', min] },
        ],
      })
    }

    const edgeFilter = conditions.length > 0
      ? { $and: conditions }
      : true // no filtering, keep all edges

    const pipeline = [
      { $match: { eventId: { $in: validEventIds } } },
      { $sort: { calculatedAt: -1 } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1,
        edges: {
          $slice: [
            { $filter: { input: '$edges', as: 'e', cond: edgeFilter } },
            50,
          ],
        },
      }},
      { $match: { 'edges.0': { $exists: true } } },
    ]

    const docs = await getCollection('edge_data').aggregate(pipeline).toArray()

    return success(docs, { count: docs.length, page: pageNum })
  })

  // GET /v1/edge/value — value bets only (pro+)
  fastify.get('/v1/edge/value', async (request, reply) => {
    const { league, market, minEdge, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const validEventIds = await findValidEventIdsByCollection('edge_data', {
      league,
      pageNum: 1,
      pageSize: queryLimit * 5,
      sortField: 'calculatedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0 })
    }

    // Unwind + filter at the edge level for precise limiting
    const pipeline = [
      { $match: { eventId: { $in: validEventIds } } },
      { $sort: { calculatedAt: -1 } },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'value' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    const marketMatch = buildMarketMatch(market)
    if (marketMatch) pipeline.push({ $match: marketMatch })

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
    const { league, market, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const validEventIds = await findValidEventIdsByCollection('edge_data', {
      league,
      pageNum: 1,
      pageSize: queryLimit * 5,
      sortField: 'calculatedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0 })
    }

    const pipeline = [
      { $match: { eventId: { $in: validEventIds } } },
      { $sort: { calculatedAt: -1 } },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'ev' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    const marketMatch = buildMarketMatch(market)
    if (marketMatch) pipeline.push({ $match: marketMatch })

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
    const { league, market, minProfit, limit: limitParam, sourceType = 'all' } = request.query
    const filter = {}

    const queryLimit = Math.min(50, Math.max(1, parseInt(limitParam) || 25))
    const validEventIds = await findValidEventIdsByCollection('edge_data', {
      league,
      pageNum: 1,
      pageSize: queryLimit * 5,
      sortField: 'calculatedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0 })
    }

    const pipeline = [
      { $match: { eventId: { $in: validEventIds } } },
      { $sort: { calculatedAt: -1 } },
      { $unwind: '$edges' },
      { $match: { 'edges.type': 'arbitrage' } },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1, edge: '$edges',
      }},
    ]

    const stMatch = buildSourceTypeMatch(sourceType)
    if (stMatch) pipeline.push({ $match: stMatch })

    const marketMatch = buildMarketMatch(market)
    if (marketMatch) pipeline.push({ $match: marketMatch })

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
    const { sourceType = 'all', market } = request.query

    if (!(await hasCanonicalEvent(eventId))) {
      return reply.code(404).send(error(`Edge data for event '${eventId}' not found.`, 404))
    }

    // Build sourceType filter condition for $filter
    const conditions = []
    if (market) conditions.push({ $eq: ['$$e.market', market] })
    if (sourceType && sourceType !== 'all') {
      conditions.push({
        $or: [
          { $and: [{ $eq: ['$$e.type', 'arbitrage'] }, { $eq: ['$$e.venueType', sourceType] }] },
          { $and: [{ $ne: ['$$e.type', 'arbitrage'] }, { $eq: ['$$e.sourceType', sourceType] }] },
        ],
      })
    }
    const edgeFilter = conditions.length > 0 ? { $and: conditions } : true

    const docs = await getCollection('edge_data').aggregate([
      { $match: { eventId } },
      { $sort: { calculatedAt: -1 } },
      { $limit: 1 },
      { $project: {
        _id: 0, eventId: 1, leagueId: 1, sport: 1, calculatedAt: 1,
        edges: {
          $slice: [
            { $filter: { input: '$edges', as: 'e', cond: edgeFilter } },
            100,
          ],
        },
      }},
    ]).toArray()

    const doc = docs[0] || null

    if (!doc) {
      return reply.code(404).send(error(`Edge data for event '${eventId}' not found.`, 404))
    }

    return success(doc, { league: doc.leagueId, event: eventId })
  })
}
