import { getCollection } from '../db.js'

export async function hasCanonicalEvent(eventId) {
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
        localField: 'eventId',
        foreignField: 'eventId',
        as: 'event',
      },
    },
    { $match: { event: { $ne: [] } } },
    { $skip: (pageNum - 1) * pageSize },
    { $limit: pageSize },
    { $project: { _id: 0, eventId: 1 } }
  )

  const rows = await getCollection(collectionName).aggregate(pipeline).toArray()
  return rows.map((row) => row.eventId).filter(Boolean)
}
