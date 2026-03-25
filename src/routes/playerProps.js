import { getCollection } from '../db.js'
import { SPORTS, getPlayerPropMarkets } from '../config/sports.js'
import { success, error } from '../utils/response.js'
import { filterPlayerPropsDoc } from '../utils/playerProps.js'

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildPlayerPropsMarketCatalog(league = null) {
  const leagueIds = league ? [league] : Object.keys(SPORTS)

  return leagueIds.map((leagueId) => ({
    leagueId,
    sport: SPORTS[leagueId].sport,
    markets: getPlayerPropMarkets(leagueId).map((market) => ({
      marketType: market.key,
      marketName: market.marketName,
      format: market.format,
      isAlternate: market.isAlternate,
      supportsPoint: market.supportsPoint,
    })),
  }))
}

export default async function playerPropsRoutes(fastify) {
  fastify.get('/v1/player-props', async (request, reply) => {
    const {
      league,
      market,
      player,
      bookmaker,
      sourceType,
      limit,
      page,
    } = request.query

    if (league && !SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }

    const filter = {}
    if (league) filter.leagueId = league
    if (market) filter.marketTypes = market
    if (player) filter.playerNames = { $regex: escapeRegex(player), $options: 'i' }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    const docs = await getCollection('player_props')
      .find(filter, { projection: { _id: 0, marketTypes: 0, playerNames: 0 } })
      .sort({ fetchedAt: -1, eventId: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray()

    const results = docs
      .map((doc) => filterPlayerPropsDoc(doc, { market, player, bookmaker, sourceType }))
      .filter(Boolean)

    return success(results, { count: results.length, page: pageNum })
  })

  fastify.get('/v1/events/:eventId/player-props', async (request, reply) => {
    const { eventId } = request.params
    const { market, player, bookmaker, sourceType } = request.query

    const doc = await getCollection('player_props').findOne(
      { eventId },
      { projection: { _id: 0, marketTypes: 0, playerNames: 0 } }
    )

    if (!doc) {
      return reply.code(404).send(error(`Player props for event '${eventId}' not found.`, 404))
    }

    const filtered = filterPlayerPropsDoc(doc, { market, player, bookmaker, sourceType })
    if (!filtered) {
      return reply.code(404).send(error(`Player props for event '${eventId}' not found.`, 404))
    }

    return success(filtered, { league: filtered.leagueId, event: eventId })
  })

  fastify.get('/v1/player-props/markets', async (request, reply) => {
    const { league } = request.query
    if (league && !SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }

    const catalog = buildPlayerPropsMarketCatalog(league || null)
    return success(catalog, {
      count: catalog.length,
      ...(league && { league }),
    })
  })
}
