import { getCollection } from '../db.js'
import { ACTIVE_BULK_EVENT_STATUSES, isStandardEventId } from '../utils/canonicalEvents.js'
import { americanToImplied, americanToDecimal, kellyFraction } from '../utils/odds.js'

const VALUE_BET_THRESHOLD = 0.03  // 3% edge minimum for value classification
const EV_THRESHOLD = 0.01         // 1% EV minimum

function isBinaryOutcomeName(name) {
  const normalized = String(name || '').trim().toLowerCase()
  return normalized === 'over'
    || normalized === 'under'
    || normalized === 'yes'
    || normalized === 'no'
}

function canonicalPointValue(marketType, outcome) {
  if (outcome?.point == null) return null

  const numericPoint = Number(outcome.point)
  if (!Number.isFinite(numericPoint)) return outcome.point

  if (String(marketType || '').includes('spread') && !isBinaryOutcomeName(outcome.name)) {
    return Math.abs(numericPoint)
  }

  return numericPoint
}

function formatPoint(point, outcomeName) {
  if (point == null) return null

  const numericPoint = Number(point)
  if (!Number.isFinite(numericPoint)) return String(point)

  if (!isBinaryOutcomeName(outcomeName) && numericPoint > 0) {
    return `+${numericPoint}`
  }

  return String(numericPoint)
}

function buildOutcomeLabel({ outcomeName, description, point }) {
  const parts = []
  if (description) parts.push(description)
  if (outcomeName) parts.push(outcomeName)
  const formattedPoint = formatPoint(point, outcomeName)
  if (formattedPoint != null) parts.push(formattedPoint)
  return parts.join(' ').trim() || String(outcomeName || description || '')
}

function buildPropositionKey(marketType, outcome) {
  return [
    marketType,
    outcome.description || '',
    canonicalPointValue(marketType, outcome) ?? '',
  ].join(':')
}

function collectPropositions(bookmakers) {
  const propositions = new Map()

  for (const bk of bookmakers) {
    if (bk.sourceType === 'unknown') continue

    for (const market of bk.markets || []) {
      for (const outcome of market.outcomes || []) {
        const propositionKey = buildPropositionKey(market.marketType, outcome)
        if (!propositions.has(propositionKey)) {
          propositions.set(propositionKey, {
            marketType: market.marketType,
            description: outcome.description || null,
            point: canonicalPointValue(market.marketType, outcome),
            selections: new Map(),
          })
        }

        const selectionKey = String(outcome.name || '').trim().toLowerCase()
        const proposition = propositions.get(propositionKey)

        if (!proposition.selections.has(selectionKey)) {
          proposition.selections.set(selectionKey, [])
        }

        proposition.selections.get(selectionKey).push({
          bookmaker: bk.bookmakerName,
          bookmakerId: bk.bookmakerId,
          sourceType: bk.sourceType,
          sourceRegion: bk.sourceRegion,
          price: outcome.price,
          marketType: market.marketType,
          outcomeName: outcome.name,
          description: outcome.description || null,
          point: outcome.point ?? null,
          propositionPoint: proposition.point,
          outcomeLabel: buildOutcomeLabel({
            outcomeName: outcome.name,
            description: outcome.description,
            point: outcome.point,
          }),
        })
      }
    }
  }

  return propositions
}

function isArbitrageEligibleBookmaker(bookmaker) {
  return bookmaker?.sourceType
    && bookmaker.sourceType !== 'unknown'
    && bookmaker.sourceType !== 'exchange'
}

/**
 * Determine the venueType of an arb edge from its participating legs.
 * Returns 'sportsbook', 'dfs', or 'mixed'.
 */
function arbVenueType(legs) {
  const types = new Set(legs.map((l) => l.sourceType).filter((t) => t && t !== 'unknown'))
  if (types.size === 0) return 'unknown'
  if (types.size === 1) return [...types][0]
  return 'mixed'
}

/**
 * Detect arbitrage opportunities across bookmakers.
 * Only considers non-exchange bookmakers with a known sourceType.
 * Each edge is tagged with venueType for downstream filtering.
 *
 * Exported for testing.
 */
export function detectArbitrage(bookmakers) {
  const edges = []
  const propositions = collectPropositions(bookmakers.filter(isArbitrageEligibleBookmaker))

  for (const proposition of propositions.values()) {
    if (proposition.selections.size !== 2) continue

    const best = [...proposition.selections.values()].map((offers) =>
      offers.reduce((a, b) => (a.price > b.price ? a : b))
    )

    if (best.length !== 2) continue

    const impliedSum = best.reduce((sum, offer) => sum + americanToImplied(offer.price), 0)
    if (impliedSum >= 1) continue

    const profitPct = ((1 / impliedSum) - 1) * 100
    const totalStake = 1000
    const stakes = best.map((offer) => ({
      bookmaker: offer.bookmaker,
      bookmakerId: offer.bookmakerId,
      sourceType: offer.sourceType,
      sourceRegion: offer.sourceRegion,
      outcome: offer.outcomeName,
      selection: offer.outcomeLabel,
      ...(offer.description && { description: offer.description }),
      ...(offer.point != null && { point: offer.point }),
      odds: offer.price,
      stake: Math.round((totalStake * americanToImplied(offer.price) / impliedSum) * 100) / 100,
    }))

    edges.push({
      edgeId: `arb-${Date.now()}`,
      type: 'arbitrage',
      venueType: arbVenueType(best),
      market: proposition.marketType,
      outcome: best.map((offer) => offer.outcomeLabel).join(' vs '),
      ...(proposition.description && { description: proposition.description }),
      ...(proposition.point != null && { point: proposition.point }),
      bookmakers: best.map((offer) => offer.bookmaker),
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
  const propositions = collectPropositions(bookmakers)

  for (const proposition of propositions.values()) {
    for (const offers of proposition.selections.values()) {
      if (offers.length < 2) continue

      const impliedProbs = offers.map((offer) => americanToImplied(offer.price))
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
            outcome: offer.outcomeLabel,
            ...(offer.description && { description: offer.description }),
            ...(offer.propositionPoint != null && { point: offer.propositionPoint }),
            bookmakers: [offer.bookmaker],
            valueBet: {
              bookmaker: offer.bookmaker,
              bookmakerId: offer.bookmakerId,
              sourceType: offer.sourceType,
              sourceRegion: offer.sourceRegion,
              outcome: offer.outcomeName,
              selection: offer.outcomeLabel,
              ...(offer.description && { description: offer.description }),
              ...(offer.point != null && { point: offer.point }),
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
                outcome: offer.outcomeName,
                selection: offer.outcomeLabel,
                ...(offer.description && { description: offer.description }),
                ...(offer.point != null && { point: offer.point }),
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
            outcome: offer.outcomeLabel,
            ...(offer.description && { description: offer.description }),
            ...(offer.propositionPoint != null && { point: offer.propositionPoint }),
            bookmakers: [offer.bookmaker],
            evBet: {
              bookmaker: offer.bookmaker,
              bookmakerId: offer.bookmakerId,
              sourceType: offer.sourceType,
              sourceRegion: offer.sourceRegion,
              outcome: offer.outcomeName,
              selection: offer.outcomeLabel,
              ...(offer.description && { description: offer.description }),
              ...(offer.point != null && { point: offer.point }),
              odds: offer.price,
              ev: Math.round(ev * 10000) / 10000,
              evPct: Math.round(evPct * 100) / 100,
            },
          })
        }
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

  const eventIds = await getCollection('events')
    .find(
      {
        leagueId,
        status: { $in: ACTIVE_BULK_EVENT_STATUSES },
      },
      { projection: { _id: 0, eventId: 1 } }
    )
    .toArray()
  const validEventIds = eventIds
    .map((event) => event.eventId)
    .filter((eventId) => isStandardEventId(eventId, leagueId))

  await getCollection('edge_data').deleteMany(
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
