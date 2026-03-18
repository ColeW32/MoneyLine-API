import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function edgeRoutes(fastify) {
  // GET /v1/edge — all current edges (pro+)
  fastify.get('/v1/edge', async (request, reply) => {
    const { type, league, minProfit, minEdge, limit, page } = request.query

    const filter = {}
    if (league) filter.leagueId = league
    if (type) filter['edges.type'] = type

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    let edges = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray()

    // Post-filter by minProfit (arbitrage) or minEdge (value)
    if (minProfit) {
      const min = parseFloat(minProfit)
      edges = edges.map((doc) => ({
        ...doc,
        edges: doc.edges.filter(
          (e) => e.type === 'arbitrage' && e.arbitrage?.profitPct >= min
        ),
      })).filter((doc) => doc.edges.length > 0)
    }

    if (minEdge) {
      const min = parseFloat(minEdge)
      edges = edges.map((doc) => ({
        ...doc,
        edges: doc.edges.filter(
          (e) => e.type === 'value' && e.valueBet?.edgePct >= min
        ),
      })).filter((doc) => doc.edges.length > 0)
    }

    return success(edges, { count: edges.length, page: pageNum })
  })

  // GET /v1/edge/value — value bets only (pro+)
  fastify.get('/v1/edge/value', async (request, reply) => {
    const { league, minEdge } = request.query
    const filter = { 'edges.type': 'value' }
    if (league) filter.leagueId = league

    let docs = await getCollection('edge_data')
      .find(filter, { projection: { _id: 0 } })
      .sort({ calculatedAt: -1 })
      .limit(50)
      .toArray()

    // Extract only value edges
    const results = docs.flatMap((doc) =>
      doc.edges
        .filter((e) => e.type === 'value')
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
    const { league } = request.query
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
    const { league, minProfit } = request.query
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
    const doc = await getCollection('edge_data').findOne(
      { eventId },
      { projection: { _id: 0 }, sort: { calculatedAt: -1 } }
    )

    if (!doc) {
      return reply.code(404).send(error(`Edge data for event '${eventId}' not found.`, 404))
    }

    return success(doc, { league: doc.leagueId, event: eventId })
  })
}
