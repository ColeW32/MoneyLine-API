import { getCollection } from '../db.js'

/**
 * In American odds, a numerically higher number is always better for the bettor.
 * e.g. -100 > -110, +150 > +120, +100 > -105
 */
function isBetterOdds(candidate, current) {
  return candidate > current
}

/**
 * Group outcomes across all bookmakers by a canonical key:
 * (marketType, outcomeName, point)
 *
 * Returns a Map: key → { marketType, outcomeName, point, offers[] }
 */
function collectOutcomeOffers(bookmakers, { bookmaker, sourceType } = {}) {
  const groups = new Map()

  for (const bk of bookmakers) {
    if (bookmaker) {
      const normalized = bookmaker.toLowerCase()
      if (
        bk.bookmakerId.toLowerCase() !== normalized &&
        bk.bookmakerName.toLowerCase() !== normalized
      ) continue
    }

    if (sourceType && sourceType !== 'all' && bk.sourceType !== sourceType) continue

    for (const market of bk.markets || []) {
      for (const outcome of market.outcomes || []) {
        if (outcome.price == null || !Number.isFinite(outcome.price)) continue

        const point = (outcome.point != null && Number.isFinite(Number(outcome.point)))
          ? Number(outcome.point)
          : null

        const key = `${market.marketType}:${String(outcome.name || '').trim().toLowerCase()}:${point ?? ''}`

        if (!groups.has(key)) {
          groups.set(key, {
            marketType: market.marketType,
            outcomeName: outcome.name,
            point,
            offers: [],
          })
        }

        groups.get(key).offers.push({
          bookmakerId: bk.bookmakerId,
          bookmakerName: bk.bookmakerName,
          sourceType: bk.sourceType,
          sourceRegion: bk.sourceRegion,
          price: outcome.price,
        })
      }
    }
  }

  return groups
}

/**
 * For each market outcome, find the best price across all bookmakers.
 * Supports optional bookmaker and sourceType filters.
 *
 * Returns an array grouped by marketType:
 * [{ marketType, outcomes: [{ name, point?, bestOdds, bookmakerId, bookmakerName, sourceType, sourceRegion }] }]
 *
 * Exported for testing.
 */
export function findBestOdds(bookmakers, { bookmaker, sourceType } = {}) {
  const groups = collectOutcomeOffers(bookmakers, { bookmaker, sourceType })
  const byMarket = new Map()

  for (const group of groups.values()) {
    if (group.offers.length === 0) continue

    const best = group.offers.reduce((a, b) => isBetterOdds(b.price, a.price) ? b : a)

    if (!byMarket.has(group.marketType)) {
      byMarket.set(group.marketType, [])
    }

    const outcome = {
      name: group.outcomeName,
      ...(group.point != null && { point: group.point }),
      bestOdds: best.price,
      bookmakerId: best.bookmakerId,
      bookmakerName: best.bookmakerName,
      sourceType: best.sourceType,
      sourceRegion: best.sourceRegion,
    }

    byMarket.get(group.marketType).push(outcome)
  }

  return [...byMarket.entries()].map(([marketType, outcomes]) => ({
    marketType,
    outcomes,
  }))
}

/**
 * Run best odds calculation on all odds for a league.
 * Writes results to best_bets collection.
 * Deletes stale best_bets documents when no markets remain for an event.
 */
export async function calculateBestBets(leagueId, sport) {
  console.log(`[best-bets] Calculating best bets for ${leagueId}...`)

  const eventIds = await getCollection('events')
    .find({ leagueId }, { projection: { _id: 0, eventId: 1 } })
    .toArray()
  const validEventIds = eventIds.map((event) => event.eventId).filter(Boolean)

  await getCollection('best_bets').deleteMany(
    validEventIds.length > 0
      ? { leagueId, eventId: { $nin: validEventIds } }
      : { leagueId }
  )

  const odds = await getCollection('odds')
    .find(
      validEventIds.length > 0
        ? { leagueId, eventId: { $in: validEventIds } }
        : { leagueId, eventId: '__none__' }
    )
    .sort({ fetchedAt: -1 })
    .toArray()

  let eventsProcessed = 0

  for (const oddsDoc of odds) {
    if (!oddsDoc.bookmakers?.length) continue

    const markets = findBestOdds(oddsDoc.bookmakers)

    if (markets.length > 0) {
      eventsProcessed++
      await getCollection('best_bets').updateOne(
        { eventId: oddsDoc.eventId },
        {
          $set: {
            eventId: oddsDoc.eventId,
            leagueId,
            sport,
            calculatedAt: new Date(),
            markets,
          },
        },
        { upsert: true }
      )
    } else {
      await getCollection('best_bets').deleteOne({ eventId: oddsDoc.eventId })
    }
  }

  console.log(`[best-bets] Processed ${eventsProcessed} events for ${leagueId}`)
}
