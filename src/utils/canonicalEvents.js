import { getCollection } from '../db.js'

export const ACTIVE_BULK_EVENT_STATUSES = ['scheduled', 'in_progress']
export const STANDARD_EVENT_ID_PATTERN = /^[a-z0-9]+-ev-[a-z0-9]+$/i

export function isStandardEventId(eventId, leagueId = null) {
  if (!eventId) return false

  const normalized = String(eventId).trim()
  if (!normalized) return false
  if (!STANDARD_EVENT_ID_PATTERN.test(normalized)) return false

  return leagueId ? normalized.startsWith(`${leagueId}-ev-`) : true
}

export async function hasCanonicalEvent(eventId) {
  if (!isStandardEventId(eventId)) return false

  if (!eventId) return false
  const event = await getCollection('events').findOne(
    { eventId },
    { projection: { _id: 1 } }
  )
  return Boolean(event)
}

export async function findValidEventIdsByCollection(collectionName, {
  league,
  pageNum = 1,
  pageSize = 25,
  sortField = 'fetchedAt',
  activeOnly = true,
} = {}) {
  const pipeline = []

  if (league) {
    pipeline.push({ $match: { leagueId: league } })
  }

  pipeline.push(
    { $sort: { [sortField]: -1 } },
    {
      $lookup: {
        from: 'events',
        let: { localEventId: '$eventId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$eventId', '$$localEventId'] },
              ...(league ? { leagueId: league } : {}),
              ...(activeOnly ? { status: { $in: ACTIVE_BULK_EVENT_STATUSES } } : {}),
            },
          },
          {
            $match: {
              eventId: league
                ? new RegExp(`^${league}-ev-[a-z0-9]+$`, 'i')
                : STANDARD_EVENT_ID_PATTERN,
            },
          },
          { $project: { _id: 0, eventId: 1, startTime: 1, status: 1 } },
        ],
        as: 'event',
      },
    },
    { $unwind: '$event' },
    { $sort: { 'event.startTime': 1, [sortField]: -1 } },
    { $skip: (pageNum - 1) * pageSize },
    { $limit: pageSize },
    { $project: { _id: 0, eventId: 1 } }
  )

  const rows = await getCollection(collectionName).aggregate(pipeline).toArray()
  return rows.map((row) => row.eventId).filter(Boolean)
}
