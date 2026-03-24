import { getCollection } from '../db.js'

/**
 * Maps external source IDs to stable MoneyLine internal IDs.
 * Creates new mappings on first encounter.
 */

const ID_MAP_COLLECTION = 'source_id_map_v2'

export function isValidSourceId(sourceId) {
  if (sourceId == null) return false
  const normalized = String(sourceId).trim().toLowerCase()
  return normalized !== '' && normalized !== 'undefined' && normalized !== 'null' && normalized !== 'nan'
}

export async function getMoneylineId(source, sourceId, entityType, sport, fallbackName) {
  if (!isValidSourceId(sourceId)) return null

  const col = getCollection(ID_MAP_COLLECTION)
  const sourceIdString = String(sourceId)
  const mappingKey = { source, sourceId: sourceIdString, entityType, sport }

  // Check existing mapping
  const existing = await col.findOne(mappingKey)
  if (existing) return existing.moneylineId

  // Generate new MoneyLine ID
  const moneylineId = generateId(entityType, sport, sourceId, fallbackName)

  await col.updateOne(
    mappingKey,
    {
      $set: {
        source,
        sourceId: sourceIdString,
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
  const col = getCollection(ID_MAP_COLLECTION)
  const validSourceIds = sourceIds.filter(isValidSourceId).map(String)
  if (validSourceIds.length === 0) return new Map()

  const existing = await col
    .find({ source, sourceId: { $in: validSourceIds }, entityType, sport })
    .toArray()

  const map = new Map()
  for (const doc of existing) {
    map.set(doc.sourceId, doc.moneylineId)
  }
  return map
}
