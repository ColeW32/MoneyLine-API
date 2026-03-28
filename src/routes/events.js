import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'
import { isStandardEventId } from '../utils/canonicalEvents.js'

function addStubFlag(event) {
  return { ...event, isStub: !isStandardEventId(event.eventId) }
}

const EVENT_TIMEZONE = 'America/New_York'
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  }).formatToParts(date)

  const tzName = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT'
  const match = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) return 0

  const [, sign, hours, minutes = '00'] = match
  const totalMinutes = (parseInt(hours, 10) * 60) + parseInt(minutes, 10)
  return (sign === '+' ? 1 : -1) * totalMinutes * 60 * 1000
}

function zonedDateTimeToUtc(dateString, timeZone, hour = 0, minute = 0, second = 0) {
  const [year, month, day] = dateString.split('-').map(Number)
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, second)

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMillis), timeZone)
    utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs
  }

  return new Date(utcMillis)
}

function formatDateInTimeZone(date, timeZone = EVENT_TIMEZONE) {
  return date.toLocaleDateString('en-CA', { timeZone })
}

function addDaysToDateString(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function getTimeZoneDayRange(dateString, timeZone = EVENT_TIMEZONE) {
  const start = zonedDateTimeToUtc(dateString, timeZone, 0, 0, 0)
  const end = zonedDateTimeToUtc(addDaysToDateString(dateString, 1), timeZone, 0, 0, 0)
  return { start, end, date: dateString }
}

function getTodayRange(timeZone = EVENT_TIMEZONE, now = new Date()) {
  return getTimeZoneDayRange(formatDateInTimeZone(now, timeZone), timeZone)
}

function buildDateFilter({ date, from, to } = {}) {
  if (date) {
    const { start, end } = getTimeZoneDayRange(date)
    return { startTime: { $gte: start, $lt: end } }
  }

  if (!from && !to) return {}

  const startTime = {}

  if (from) {
    startTime.$gte = DATE_ONLY_RE.test(from)
      ? getTimeZoneDayRange(from).start
      : new Date(from)
  }

  if (to) {
    startTime[DATE_ONLY_RE.test(to) ? '$lt' : '$lte'] = DATE_ONLY_RE.test(to)
      ? getTimeZoneDayRange(to).end
      : new Date(to)
  }

  return { startTime }
}

export default async function eventRoutes(fastify) {
  // GET /v1/events — filter by league, date, status
  fastify.get('/v1/events', async (request, reply) => {
    const { league, sport, date, from, to, status, limit, page } = request.query
    const filter = {}

    if (league) filter.leagueId = league
    if (sport) filter.sport = sport
    if (status) filter.status = status

    Object.assign(filter, buildDateFilter({ date, from, to }))

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

    return success(events.map(addStubFlag), {
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

    return success(events.map(addStubFlag), { count: events.length })
  })

  // GET /v1/events/today — today's games
  fastify.get('/v1/events/today', async (request, reply) => {
    const { league } = request.query
    const { start, end, date } = getTodayRange()

    const filter = { startTime: { $gte: start, $lt: end } }
    if (league) filter.leagueId = league

    const events = await getCollection('events')
      .find(filter, { projection: { _id: 0 } })
      .sort({ startTime: 1 })
      .toArray()

    return success(events.map(addStubFlag), { count: events.length, date, timeZone: EVENT_TIMEZONE })
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

    return success(addStubFlag(event), { league: event.leagueId })
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

    const range = date ? getTimeZoneDayRange(date) : getTodayRange()

    const events = await getCollection('events')
      .find(
        { leagueId, startTime: { $gte: range.start, $lt: range.end } },
        { projection: { _id: 0 } }
      )
      .sort({ startTime: 1 })
      .toArray()

    return success(events.map(addStubFlag), {
      league: leagueId,
      date: range.date,
      timeZone: EVENT_TIMEZONE,
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
