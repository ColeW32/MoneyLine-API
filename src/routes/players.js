import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function playerRoutes(fastify) {
  // GET /v1/players/:playerId
  fastify.get('/v1/players/:playerId', async (request, reply) => {
    const { playerId } = request.params
    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    return success(player, { league: player.leagueId })
  })

  // GET /v1/players/:playerId/stats
  fastify.get('/v1/players/:playerId/stats', async (request, reply) => {
    const { playerId } = request.params
    const { type, season } = request.query

    const filter = { playerId }
    if (type) filter.statType = type
    if (season) filter.season = season

    const stats = await getCollection('player_stats')
      .find(filter, { projection: { _id: 0 } })
      .sort({ season: -1 })
      .toArray()

    return success(stats, { player: playerId, count: stats.length })
  })
}
