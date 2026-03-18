import { getCollection } from '../db.js'
import { americanToImplied, americanToDecimal, kellyFraction } from '../utils/odds.js'

const VALUE_BET_THRESHOLD = 0.03  // 3% edge minimum
const EV_THRESHOLD = 0.01         // 1% EV minimum

/**
 * Run edge detection on all odds for upcoming events in a league.
 * Writes results to edge_data collection.
 */
export async function calculateEdges(leagueId, sport) {
  console.log(`[edge] Calculating edges for ${leagueId}...`)

  // Get odds for upcoming events
  const odds = await getCollection('odds')
    .find({ leagueId })
    .sort({ fetchedAt: -1 })
    .toArray()

  let edgesFound = 0

  for (const oddDoc of odds) {
    if (!oddDoc.bookmakers?.length) continue

    const edges = []

    // --- Arbitrage detection ---
    const arbEdges = detectArbitrage(oddDoc.bookmakers)
    edges.push(...arbEdges)

    // --- EV detection (using market consensus as proxy for true probability) ---
    const evEdges = detectEV(oddDoc.bookmakers)
    edges.push(...evEdges)

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
    }
  }

  console.log(`[edge] Found ${edgesFound} edges for ${leagueId}`)
}

/**
 * Detect arbitrage opportunities across bookmakers.
 */
function detectArbitrage(bookmakers) {
  const edges = []
  // Group all moneyline markets
  const moneylineOutcomes = new Map() // outcomeName → [{bookmaker, price}]

  for (const bk of bookmakers) {
    for (const market of bk.markets || []) {
      if (market.marketType !== 'moneyline') continue
      for (const outcome of market.outcomes || []) {
        if (!moneylineOutcomes.has(outcome.name)) {
          moneylineOutcomes.set(outcome.name, [])
        }
        moneylineOutcomes.get(outcome.name).push({
          bookmaker: bk.bookmakerName,
          bookmakerId: bk.bookmakerId,
          price: outcome.price,
        })
      }
    }
  }

  // Need exactly 2 outcomes for moneyline arb
  const outcomeNames = [...moneylineOutcomes.keys()]
  if (outcomeNames.length !== 2) return edges

  // Find best price for each outcome
  const best = outcomeNames.map((name) => {
    const offers = moneylineOutcomes.get(name)
    const bestOffer = offers.reduce((a, b) => (a.price > b.price ? a : b))
    return { name, ...bestOffer }
  })

  const impliedSum = best.reduce((sum, o) => sum + americanToImplied(o.price), 0)

  if (impliedSum < 1) {
    const profitPct = ((1 / impliedSum) - 1) * 100
    const totalStake = 1000
    const stakes = best.map((o) => ({
      bookmaker: o.bookmaker,
      outcome: o.name,
      odds: o.price,
      stake: Math.round((totalStake * americanToImplied(o.price) / impliedSum) * 100) / 100,
    }))

    edges.push({
      edgeId: `arb-${Date.now()}`,
      type: 'arbitrage',
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
 * Detect +EV bets using the consensus implied probability
 * (average across all books) as a proxy for true probability.
 */
function detectEV(bookmakers) {
  const edges = []
  // For each market type, compute consensus probability
  const outcomeData = new Map() // outcomeName → [prices]

  for (const bk of bookmakers) {
    for (const market of bk.markets || []) {
      if (market.marketType !== 'moneyline') continue
      for (const outcome of market.outcomes || []) {
        const key = `${market.marketType}:${outcome.name}`
        if (!outcomeData.has(key)) outcomeData.set(key, [])
        outcomeData.get(key).push({
          bookmaker: bk.bookmakerName,
          bookmakerId: bk.bookmakerId,
          price: outcome.price,
          marketType: market.marketType,
          outcomeName: outcome.name,
        })
      }
    }
  }

  for (const [key, offers] of outcomeData) {
    if (offers.length < 2) continue

    // Consensus probability = average implied probability (de-vigged)
    const impliedProbs = offers.map((o) => americanToImplied(o.price))
    const consensusProb = impliedProbs.reduce((a, b) => a + b, 0) / impliedProbs.length

    // Check each book for edge vs consensus
    for (const offer of offers) {
      const impliedProb = americanToImplied(offer.price)
      const edgePct = (consensusProb - impliedProb) * 100

      if (edgePct > VALUE_BET_THRESHOLD * 100) {
        const decimalOdds = americanToDecimal(offer.price)
        const ev = (consensusProb * (decimalOdds - 1)) - (1 - consensusProb)
        const evPct = ev * 100

        if (evPct > EV_THRESHOLD * 100) {
          edges.push({
            edgeId: `ev-${Date.now()}-${offer.bookmakerId}`,
            type: 'ev',
            market: offer.marketType,
            outcome: offer.outcomeName,
            bookmakers: [offer.bookmaker],
            evBet: {
              bookmaker: offer.bookmaker,
              odds: offer.price,
              ev: Math.round(ev * 10000) / 10000,
              evPct: Math.round(evPct * 100) / 100,
            },
            valueBet: {
              bookmaker: offer.bookmaker,
              odds: offer.price,
              impliedProb: Math.round(impliedProb * 1000) / 1000,
              modelProb: Math.round(consensusProb * 1000) / 1000,
              edgePct: Math.round(edgePct * 100) / 100,
              kellyCriterion: Math.round(kellyFraction(consensusProb, offer.price) * 10000) / 10000,
            },
          })
        }
      }
    }
  }

  return edges
}
