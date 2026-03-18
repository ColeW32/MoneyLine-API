import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function leagueRoutes(fastify) {
  // GET /v1/sports — list all sports
  fastify.get('/v1/sports', async (request, reply) => {
    const leagues = await getCollection('leagues').find({ active: true }).toArray()

    const sports = [...new Set(leagues.map((l) => l.sport))].map((sport) => ({
      sport,
      leagues: leagues
        .filter((l) => l.sport === sport)
        .map((l) => ({ leagueId: l.leagueId, name: l.name })),
    }))

    return success(sports, { updatedAt: new Date().toISOString() })
  })

  // GET /v1/leagues — list all leagues
  fastify.get('/v1/leagues', async (request, reply) => {
    const { sport } = request.query
    const filter = { active: true }
    if (sport) filter.sport = sport

    // Enforce sport restriction for free tier
    const tierConfig = request.tierConfig
    if (tierConfig && Array.isArray(tierConfig.sports)) {
      filter.leagueId = { $in: tierConfig.sports }
    }

    const leagues = await getCollection('leagues')
      .find(filter, { projection: { _id: 0 } })
      .toArray()

    return success(leagues, { count: leagues.length })
  })

  // GET /v1/leagues/:leagueId — single league
  fastify.get('/v1/leagues/:leagueId', async (request, reply) => {
    const { leagueId } = request.params
    const league = await getCollection('leagues').findOne(
      { leagueId },
      { projection: { _id: 0 } }
    )

    if (!league) {
      return reply.code(404).send(error(`League '${leagueId}' not found.`, 404))
    }

    return success(league, { league: leagueId })
  })
}
