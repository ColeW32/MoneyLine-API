import { getCollection } from '../db.js'
import { americanToImplied, americanToDecimal, kellyFraction } from '../utils/odds.js'

const VALUE_BET_THRESHOLD = 0.03  // 3% edge minimum for value classification
const EV_THRESHOLD = 0.01         // 1% EV minimum

/**
 * Determine the venueType of an arb edge from its participating legs.
 * Returns 'sportsbook', 'exchange', or 'mixed'.
 */
function arbVenueType(legs) {
  const types = new Set(legs.map((l) => l.sourceType).filter((t) => t && t !== 'unknown'))
  if (types.size === 0) return 'unknown'
  if (types.size === 1) return [...types][0] === 'exchange' ? 'exchange' : 'sportsbook'
  return 'mixed'
}

/**
 * Detect arbitrage opportunities across bookmakers.
 * Only considers bookmakers with a known sourceType (excludes 'unknown').
 * Each edge is tagged with venueType for downstream filtering.
 *
 * Exported for testing.
 */
export function detectArbitrage(bookmakers) {
  const edges = []
  const moneylineOutcomes = new Map() // outcomeName → [{bookmaker, bookmakerId, sourceType, sourceRegion, price}]

  for (const bk of bookmakers) {
    if (bk.sourceType === 'unknown') continue
    for (const market of bk.markets || []) {
      if (market.marketType !== 'moneyline') continue
      for (const outcome of market.outcomes || []) {
        if (!moneylineOutcomes.has(outcome.name)) {
          moneylineOutcomes.set(outcome.name, [])
        }
        moneylineOutcomes.get(outcome.name).push({
          bookmaker: bk.bookmakerName,
          bookmakerId: bk.bookmakerId,
          sourceType: bk.sourceType,
          sourceRegion: bk.sourceRegion,
          price: outcome.price,
        })
      }
    }
  }

  const outcomeNames = [...moneylineOutcomes.keys()]
  if (outcomeNames.length !== 2) return edges

  // Best price for each outcome
  const best = outcomeNames.map((name) => {
    const offers = moneylineOutcomes.get(name)
    return { name, ...offers.reduce((a, b) => (a.price > b.price ? a : b)) }
  })

  const impliedSum = best.reduce((sum, o) => sum + americanToImplied(o.price), 0)

  if (impliedSum < 1) {
    const profitPct = ((1 / impliedSum) - 1) * 100
    const totalStake = 1000
    const stakes = best.map((o) => ({
      bookmaker: o.bookmaker,
      bookmakerId: o.bookmakerId,
      sourceType: o.sourceType,
      sourceRegion: o.sourceRegion,
      outcome: o.name,
      odds: o.price,
      stake: Math.round((totalStake * americanToImplied(o.price) / impliedSum) * 100) / 100,
    }))

    edges.push({
      edgeId: `arb-${Date.now()}`,
      type: 'arbitrage',
      venueType: arbVenueType(best),
      market: 'moneyline',
      outcome: best.map((b) => b.name).join(' vs '),
      bookmakers: best.map((b) => b.bookmaker),
      arbitrage: {
        books: stakes,
        totalStake,
        guaranteedProfit: Math.round(totalStake * (profitPct / 100) * 100) / 100,
        profitPct: Math.round(profitPct * 100) / 100,
      },
    })
  }

  return edges
}

/**
 * Detect value bets and positive-EV bets using consensus implied probability
 * as a proxy for true probability.
 *
 * - type:'value'  — edgePct > VALUE_BET_THRESHOLD (consensus minus implied > 3%)
 * - type:'ev'     — evPct > EV_THRESHOLD
 *
 * Only considers bookmakers with a known sourceType (excludes 'unknown').
 * Each edge carries sourceType/sourceRegion for downstream filtering.
 *
 * Exported for testing.
 */
export function detectEdges(bookmakers) {
  const edges = []
  const outcomeData = new Map() // key → [{bookmaker, bookmakerId, sourceType, sourceRegion, price, marketType, outcomeName}]

  for (const bk of bookmakers) {
    if (bk.sourceType === 'unknown') continue
    for (const market of bk.markets || []) {
      if (market.marketType !== 'moneyline') continue
      for (const outcome of market.outcomes || []) {
        const key = `${market.marketType}:${outcome.name}`
        if (!outcomeData.has(key)) outcomeData.set(key, [])
        outcomeData.get(key).push({
          bookmaker: bk.bookmakerName,
          bookmakerId: bk.bookmakerId,
          sourceType: bk.sourceType,
          sourceRegion: bk.sourceRegion,
          price: outcome.price,
          marketType: market.marketType,
          outcomeName: outcome.name,
        })
      }
    }
  }

  for (const [, offers] of outcomeData) {
    if (offers.length < 2) continue

    const impliedProbs = offers.map((o) => americanToImplied(o.price))
    const consensusProb = impliedProbs.reduce((a, b) => a + b, 0) / impliedProbs.length

    for (const offer of offers) {
      const impliedProb = americanToImplied(offer.price)
      const edgePct = (consensusProb - impliedProb) * 100
      const decimalOdds = americanToDecimal(offer.price)
      const ev = (consensusProb * (decimalOdds - 1)) - (1 - consensusProb)
      const evPct = ev * 100

      if (edgePct > VALUE_BET_THRESHOLD * 100) {
        edges.push({
          edgeId: `value-${Date.now()}-${offer.bookmakerId}`,
          type: 'value',
          sourceType: offer.sourceType,
          sourceRegion: offer.sourceRegion,
          market: offer.marketType,
          outcome: offer.outcomeName,
          bookmakers: [offer.bookmaker],
          valueBet: {
            bookmaker: offer.bookmaker,
            bookmakerId: offer.bookmakerId,
            sourceType: offer.sourceType,
            sourceRegion: offer.sourceRegion,
            odds: offer.price,
            impliedProb: Math.round(impliedProb * 1000) / 1000,
            modelProb: Math.round(consensusProb * 1000) / 1000,
            edgePct: Math.round(edgePct * 100) / 100,
            kellyCriterion: Math.round(kellyFraction(consensusProb, offer.price) * 10000) / 10000,
          },
          ...(evPct > 0 && {
            evBet: {
              bookmaker: offer.bookmaker,
              bookmakerId: offer.bookmakerId,
              odds: offer.price,
              ev: Math.round(ev * 10000) / 10000,
              evPct: Math.round(evPct * 100) / 100,
            },
          }),
        })
      }

      if (evPct > EV_THRESHOLD * 100) {
        edges.push({
          edgeId: `ev-${Date.now()}-${offer.bookmakerId}`,
          type: 'ev',
          sourceType: offer.sourceType,
          sourceRegion: offer.sourceRegion,
          market: offer.marketType,
          outcome: offer.outcomeName,
          bookmakers: [offer.bookmaker],
          evBet: {
            bookmaker: offer.bookmaker,
            bookmakerId: offer.bookmakerId,
            sourceType: offer.sourceType,
            sourceRegion: offer.sourceRegion,
            odds: offer.price,
            ev: Math.round(ev * 10000) / 10000,
            evPct: Math.round(evPct * 100) / 100,
          },
        })
      }
    }
  }

  return edges
}

/**
 * Run edge detection on all odds for a league.
 * Writes results to edge_data collection.
 * Deletes stale edge_data documents when no edges remain for an event.
 */
export async function calculateEdges(leagueId, sport) {
  console.log(`[edge] Calculating edges for ${leagueId}...`)

  const odds = await getCollection('odds')
    .find({ leagueId })
    .sort({ fetchedAt: -1 })
    .toArray()

  let edgesFound = 0

  for (const oddDoc of odds) {
    if (!oddDoc.bookmakers?.length) continue

    const edges = [
      ...detectArbitrage(oddDoc.bookmakers),
      ...detectEdges(oddDoc.bookmakers),
    ]

    if (edges.length > 0) {
      edgesFound += edges.length
      await getCollection('edge_data').updateOne(
        { eventId: oddDoc.eventId },
        {
          $set: {
            eventId: oddDoc.eventId,
            leagueId,
            sport,
            calculatedAt: new Date(),
            edges,
          },
        },
        { upsert: true }
      )
    } else {
      // Remove stale document when no edges remain
      await getCollection('edge_data').deleteOne({ eventId: oddDoc.eventId })
    }
  }

  console.log(`[edge] Found ${edgesFound} edges for ${leagueId}`)
}
