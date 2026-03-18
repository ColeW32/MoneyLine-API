import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function eventRoutes(fastify) {
  // GET /v1/events — filter by league, date, status
  fastify.get('/v1/events', async (request, reply) => {
    const { league, sport, date, from, to, status, limit, page } = request.query
    const filter = {}

    if (league) filter.leagueId = league
    if (sport) filter.sport = sport
    if (status) filter.status = status

    // Date filtering
    if (date) {
      const dayStart = new Date(`${date}T00:00:00Z`)
      const dayEnd = new Date(`${date}T23:59:59Z`)
      filter.startTime = { $gte: dayStart, $lte: dayEnd }
    } else if (from || to) {
      filter.startTime = {}
      if (from) filter.startTime.$gte = new Date(from)
      if (to) filter.startTime.$lte = new Date(`${to}T23:59:59Z`)
    }

    // Enforce sport restriction for free tier
    const tierConfig = request.tierConfig
    if (tierConfig && Array.isArray(tierConfig.sports)) {
      filter.leagueId = filter.leagueId
        ? (tierConfig.sports.includes(filter.leagueId) ? filter.leagueId : '__none__')
        : { $in: tierConfig.sports }
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 25))

    const [events, total] = await Promise.all([
      getCollection('events')
        .find(filter, { projection: { _id: 0 } })
        .sort({ startTime: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      getCollection('events').countDocuments(filter),
    ])

    return success(events, {
      count: events.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
    })
  })

  // GET /v1/events/live — currently in-progress games
  fastify.get('/v1/events/live', async (request, reply) => {
    const { league } = request.query
    const filter = { status: 'in_progress' }
    if (league) filter.leagueId = league

    const events = await getCollection('events')
      .find(filter, { projection: { _id: 0 } })
      .sort({ startTime: -1 })
      .toArray()

    return success(events, { count: events.length })
  })

  // GET /v1/events/today — today's games
  fastify.get('/v1/events/today', async (request, reply) => {
    const { league } = request.query
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const filter = { startTime: { $gte: dayStart, $lt: dayEnd } }
    if (league) filter.leagueId = league

    const events = await getCollection('events')
      .find(filter, { projection: { _id: 0 } })
      .sort({ startTime: 1 })
      .toArray()

    return success(events, { count: events.length, date: dayStart.toISOString().split('T')[0] })
  })

  // GET /v1/events/:eventId — single event
  fastify.get('/v1/events/:eventId', async (request, reply) => {
    const { eventId } = request.params
    const event = await getCollection('events').findOne(
      { eventId },
      { projection: { _id: 0 } }
    )

    if (!event) {
      return reply.code(404).send(error(`Event '${eventId}' not found.`, 404))
    }

    return success(event, { league: event.leagueId })
  })

  // GET /v1/events/:eventId/play-by-play (pro+)
  fastify.get('/v1/events/:eventId/play-by-play', async (request, reply) => {
    const { eventId } = request.params
    const pbp = await getCollection('play_by_play').findOne(
      { eventId },
      { projection: { _id: 0 } }
    )

    if (!pbp) {
      return reply.code(404).send(error(`Play-by-play for event '${eventId}' not found.`, 404))
    }

    return success(pbp, { league: pbp.leagueId, event: eventId })
  })

  // GET /v1/leagues/:leagueId/scores — today's scores (or ?date=)
  fastify.get('/v1/leagues/:leagueId/scores', async (request, reply) => {
    const { leagueId } = request.params
    const { date } = request.query

    const targetDate = date ? new Date(`${date}T00:00:00Z`) : new Date()
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const events = await getCollection('events')
      .find(
        { leagueId, startTime: { $gte: dayStart, $lt: dayEnd } },
        { projection: { _id: 0 } }
      )
      .sort({ startTime: 1 })
      .toArray()

    return success(events, {
      league: leagueId,
      date: dayStart.toISOString().split('T')[0],
      count: events.length,
    })
  })

  // GET /v1/leagues/:leagueId/standings
  fastify.get('/v1/leagues/:leagueId/standings', async (request, reply) => {
    const { leagueId } = request.params
    const { conference, division } = request.query

    const filter = { leagueId }
    if (conference) filter.conference = conference
    if (division) filter.division = division

    const standings = await getCollection('standings')
      .find(filter, { projection: { _id: 0 } })
      .toArray()

    return success(standings, { league: leagueId, count: standings.length })
  })
}
