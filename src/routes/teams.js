import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'

export default async function teamRoutes(fastify) {
  // GET /v1/leagues/:leagueId/teams
  fastify.get('/v1/leagues/:leagueId/teams', async (request, reply) => {
    const { leagueId } = request.params
    const teams = await getCollection('teams')
      .find({ leagueId }, { projection: { _id: 0 } })
      .toArray()

    return success(teams, { league: leagueId, count: teams.length })
  })

  // GET /v1/teams/:teamId
  fastify.get('/v1/teams/:teamId', async (request, reply) => {
    const { teamId } = request.params
    const team = await getCollection('teams').findOne(
      { teamId },
      { projection: { _id: 0 } }
    )

    if (!team) {
      return reply.code(404).send(error(`Team '${teamId}' not found.`, 404))
    }

    return success(team, { league: team.leagueId })
  })

  // GET /v1/teams/:teamId/roster
  fastify.get('/v1/teams/:teamId/roster', async (request, reply) => {
    const { teamId } = request.params
    const roster = await getCollection('rosters').findOne(
      { teamId },
      { projection: { _id: 0 } }
    )

    if (!roster) {
      return reply.code(404).send(error(`Roster for team '${teamId}' not found.`, 404))
    }

    return success(roster, { league: roster.leagueId, team: teamId })
  })

  // GET /v1/teams/:teamId/injuries (hobbyist+)
  fastify.get('/v1/teams/:teamId/injuries', async (request, reply) => {
    const { teamId } = request.params
    const injuries = await getCollection('injuries').findOne(
      { teamId },
      { projection: { _id: 0 } }
    )

    if (!injuries) {
      return reply.code(404).send(error(`Injury report for team '${teamId}' not found.`, 404))
    }

    return success(injuries, { league: injuries.leagueId, team: teamId })
  })

  // GET /v1/teams/:teamId/stats
  fastify.get('/v1/teams/:teamId/stats', async (request, reply) => {
    const { teamId } = request.params
    const { season } = request.query

    const filter = { teamId, statType: 'season' }
    if (season) filter.season = season

    const stats = await getCollection('player_stats')
      .find(filter, { projection: { _id: 0 } })
      .toArray()

    return success(stats, { team: teamId, count: stats.length })
  })

  // GET /v1/teams/:teamId/schedule
  fastify.get('/v1/teams/:teamId/schedule', async (request, reply) => {
    const { teamId } = request.params

    const events = await getCollection('events')
      .find(
        { $or: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        { projection: { _id: 0 } }
      )
      .sort({ startTime: 1 })
      .toArray()

    return success(events, { team: teamId, count: events.length })
  })
}
