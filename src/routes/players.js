import { getCollection } from '../db.js'
import { getCurrentSeason } from '../config/sports.js'
import { success, error } from '../utils/response.js'

function parseDateBoundary(value, endOfDay = false) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

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
    const { type, season, date, from, to, eventId } = request.query
    const player = await getCollection('players').findOne(
      { playerId },
      { projection: { _id: 0, playerId: 1, leagueId: 1 } }
    )

    if (!player) {
      return reply.code(404).send(error(`Player '${playerId}' not found.`, 404))
    }

    const statType = type || 'season'
    if (statType === 'career') {
      return reply.code(400).send(error('type=career is not supported yet. Use type=season or type=game.', 400))
    }

    if (!['season', 'game'].includes(statType)) {
      return reply.code(400).send(error('Invalid type. Use "season" or "game".', 400))
    }

    if (date && (from || to)) {
      return reply.code(400).send(error('Query param "date" cannot be combined with "from" or "to".', 400))
    }

    if (statType === 'season' && (date || from || to)) {
      return reply.code(400).send(error('Date filters are only supported when type=game.', 400))
    }

    if (statType === 'season' && eventId) {
      return reply.code(400).send(error('eventId is only supported when type=game.', 400))
    }

    const filter = { playerId, statType }
    const currentSeason = getCurrentSeason(player.leagueId)

    if (statType === 'season') {
      filter.season = season || currentSeason
    } else {
      if (season) {
        filter.season = season
      } else if (!eventId && !date && !from && !to) {
        filter.season = currentSeason
      }

      if (eventId) {
        filter.eventId = eventId
      }

      if (date) {
        const dayStart = parseDateBoundary(date)
        const dayEnd = parseDateBoundary(date, true)
        if (!dayStart || !dayEnd) {
          return reply.code(400).send(error('Invalid date. Use YYYY-MM-DD.', 400))
        }
        filter.gameDate = { $gte: dayStart, $lte: dayEnd }
      } else if (from || to) {
        const range = {}
        if (from) {
          const fromDate = parseDateBoundary(from)
          if (!fromDate) {
            return reply.code(400).send(error('Invalid "from" date. Use YYYY-MM-DD or ISO 8601.', 400))
          }
          range.$gte = fromDate
        }
        if (to) {
          const toDate = parseDateBoundary(to, /^\d{4}-\d{2}-\d{2}$/.test(to))
          if (!toDate) {
            return reply.code(400).send(error('Invalid "to" date. Use YYYY-MM-DD or ISO 8601.', 400))
          }
          range.$lte = toDate
        }
        if (range.$gte && range.$lte && range.$gte > range.$lte) {
          return reply.code(400).send(error('"from" must be earlier than or equal to "to".', 400))
        }
        filter.gameDate = range
      }
    }

    const stats = await getCollection('player_stats')
      .find(filter, { projection: { _id: 0 } })
      .sort(statType === 'game' ? { gameDate: -1, updatedAt: -1 } : { season: -1, updatedAt: -1 })
      .toArray()

    return success(stats, {
      player: playerId,
      type: statType,
      count: stats.length,
      ...(filter.season && { season: filter.season }),
      ...(filter.eventId && { eventId: filter.eventId }),
    })
  })
}
