import { getCollection } from '../db.js'

/**
 * Maps external source IDs to stable MoneyLine internal IDs.
 * Creates new mappings on first encounter.
 */

export async function getMoneylineId(source, sourceId, entityType, sport, fallbackName) {
  const col = getCollection('source_id_map')

  // Check existing mapping
  const existing = await col.findOne({ source, sourceId: String(sourceId) })
  if (existing) return existing.moneylineId

  // Generate new MoneyLine ID
  const moneylineId = generateId(entityType, sport, sourceId, fallbackName)

  await col.updateOne(
    { source, sourceId: String(sourceId) },
    {
      $set: {
        source,
        sourceId: String(sourceId),
        moneylineId,
        entityType,
        sport,
      },
    },
    { upsert: true }
  )

  return moneylineId
}

function generateId(entityType, sport, sourceId, name) {
  // Create readable, stable IDs like "nba-bos" or "nba-ev-311286"
  const SPORT_TO_PREFIX = { basketball: 'nba', football: 'nfl', baseball: 'mlb', hockey: 'nhl' }
  const prefix = SPORT_TO_PREFIX[sport] || sport
  const slug = name
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').substring(0, 30)
    : sourceId

  switch (entityType) {
    case 'team': return `${prefix}-${slug}`
    case 'player': return `${prefix}-p-${sourceId}`
    case 'event': return `${prefix}-ev-${sourceId}`
    case 'league': return prefix
    default: return `${prefix}-${entityType}-${sourceId}`
  }
}

/**
 * Batch lookup: returns a Map of sourceId → moneylineId.
 */
export async function batchGetMoneylineIds(source, sourceIds, entityType, sport) {
  const col = getCollection('source_id_map')
  const existing = await col
    .find({ source, sourceId: { $in: sourceIds.map(String) }, entityType })
    .toArray()

  const map = new Map()
  for (const doc of existing) {
    map.set(doc.sourceId, doc.moneylineId)
  }
  return map
}
