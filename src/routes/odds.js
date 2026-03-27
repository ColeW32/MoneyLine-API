import { getCollection } from '../db.js'
import { success, error } from '../utils/response.js'
import { findValidEventIdsByCollection, hasCanonicalEvent } from '../utils/canonicalEvents.js'
import { americanToImplied } from '../utils/odds.js'

/**
 * Convert an implied probability back to American odds.
 * Rounded to 1 decimal place.
 */
function impliedToAmerican(prob) {
  if (prob <= 0 || prob >= 1) return null
  const american = prob >= 0.5
    ? -(prob / (1 - prob)) * 100
    : ((1 - prob) / prob) * 100
  return Math.round(american * 10) / 10
}

/**
 * Compute fair odds (no-vig), best odds, and average odds for each outcome
 * within each market type across all bookmakers.
 *
 * Returns: Map<marketType, Map<outcomeName+point, { fairOdds, bestOdds, avgOdds }>>
 */
function computeOddsSummary(bookmakers) {
  // Group all offers by (marketType, outcomeName, point)
  const groups = new Map()

  for (const bk of bookmakers) {
    if (bk.sourceType === 'unknown') continue
    for (const market of bk.markets || []) {
      for (const outcome of market.outcomes || []) {
        if (outcome.price == null || !Number.isFinite(outcome.price)) continue
        const point = (outcome.point != null && Number.isFinite(Number(outcome.point)))
          ? Number(outcome.point)
          : null
        const key = `${market.marketType}|${String(outcome.name || '').trim().toLowerCase()}|${point ?? ''}`
        if (!groups.has(key)) {
          groups.set(key, { marketType: market.marketType, name: outcome.name, point, prices: [] })
        }
        groups.get(key).prices.push(outcome.price)
      }
    }
  }

  // For each group, compute best, avg, fair
  // "Fair" = convert all to implied prob, remove vig by normalizing within each market+point line
  // For binary markets (over/under, home/away), normalize paired outcomes to sum to 1
  const byMarket = new Map()
  const groupArr = [...groups.values()]

  // Pair up over/under and home/away outcomes within same (marketType, point)
  const pairKey = (g) => `${g.marketType}|${g.point ?? ''}`
  const pairGroups = new Map()
  for (const g of groupArr) {
    const pk = pairKey(g)
    if (!pairGroups.has(pk)) pairGroups.set(pk, [])
    pairGroups.get(pk).push(g)
  }

  // Compute fair odds via vig removal for each paired group
  const fairOddsMap = new Map() // key → fair american odds
  for (const [, pair] of pairGroups) {
    if (pair.length !== 2) {
      // Non-binary — fair = avg implied converted back
      for (const g of pair) {
        const avgImplied = g.prices.reduce((s, p) => s + americanToImplied(p), 0) / g.prices.length
        fairOddsMap.set(groupArr.indexOf(g), impliedToAmerican(avgImplied))
      }
      continue
    }
    // Binary pair: remove vig by normalizing implied probs
    const avgImplieds = pair.map((g) =>
      g.prices.reduce((s, p) => s + americanToImplied(p), 0) / g.prices.length
    )
    const total = avgImplieds.reduce((s, v) => s + v, 0)
    if (total <= 0) continue
    pair.forEach((g, i) => {
      const noVigProb = avgImplieds[i] / total
      fairOddsMap.set(groupArr.indexOf(g), impliedToAmerican(noVigProb))
    })
  }

  // Build summary structure
  for (let i = 0; i < groupArr.length; i++) {
    const g = groupArr[i]
    if (!byMarket.has(g.marketType)) byMarket.set(g.marketType, [])

    const bestOdds = g.prices.reduce((best, p) => (p > best ? p : best), -Infinity)
    const avgImplied = g.prices.reduce((s, p) => s + americanToImplied(p), 0) / g.prices.length
    const avgOdds = impliedToAmerican(avgImplied)

    byMarket.get(g.marketType).push({
      name: g.name,
      ...(g.point != null && { point: g.point }),
      fairOdds: fairOddsMap.get(i) ?? null,
      bestOdds,
      avgOdds,
    })
  }

  const result = {}
  for (const [marketType, outcomes] of byMarket) {
    result[marketType] = outcomes
  }
  return result
}

export function filterBookmakersForOddsResponse(bookmakers = [], {
  sourceType = 'all',
  bookmaker,
  market,
} = {}) {
  let filtered = bookmakers.map((bk) => ({
    ...bk,
    markets: Array.isArray(bk.markets) ? bk.markets.map((m) => ({
      ...m,
      outcomes: Array.isArray(m.outcomes) ? [...m.outcomes] : m.outcomes,
    })) : bk.markets,
  }))

  if (sourceType && sourceType !== 'all') {
    filtered = filtered.filter((bk) => bk.sourceType === sourceType)
  }

  if (bookmaker) {
    const normalized = bookmaker.toLowerCase()
    filtered = filtered.filter(
      (bk) => bk.bookmakerName.toLowerCase() === normalized || bk.bookmakerId.toLowerCase() === normalized
    )
  }

  if (market) {
    filtered = filtered.map((bk) => ({
      ...bk,
      markets: Array.isArray(bk.markets)
        ? bk.markets.filter((m) => m.marketType === market)
        : bk.markets,
    }))
  }

  return filtered
}

export function applyBooksPerRequestLimit(bookmakers = [], booksAllowed = Infinity) {
  if (booksAllowed === Infinity) return bookmakers
  return bookmakers.slice(0, booksAllowed)
}

export default async function oddsRoutes(fastify) {
  // Core game-level market types (player props have their own endpoint)
  const GAME_MARKETS = ['moneyline', 'spread', 'total']

  // GET /v1/events/:eventId/odds (starter+)
  fastify.get('/v1/events/:eventId/odds', async (request, reply) => {
    const { eventId } = request.params
    const { sourceType, market } = request.query

    if (!(await hasCanonicalEvent(eventId))) {
      return reply.code(404).send(error(`Odds for event '${eventId}' not found.`, 404))
    }

    // Use aggregation to filter markets server-side (odds docs embed player props too)
    const marketFilter = market
      ? { $eq: ['$$m.marketType', market] }
      : { $in: ['$$m.marketType', GAME_MARKETS] }

    const pipeline = [
      { $match: { eventId } },
      { $sort: { fetchedAt: -1 } },
      { $limit: 1 },
      {
        $set: {
          bookmakers: {
            $map: {
              input: '$bookmakers',
              as: 'bk',
              in: {
                $mergeObjects: [
                  '$$bk',
                  {
                    markets: {
                      $filter: {
                        input: '$$bk.markets',
                        as: 'm',
                        cond: marketFilter,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]

    const docs = await getCollection('odds').aggregate(pipeline).toArray()
    const odds = docs[0] || null

    if (!odds) {
      return reply.code(404).send(error(`Odds for event '${eventId}' not found.`, 404))
    }

    // Compute summary before applying per-request book limits
    const summary = computeOddsSummary(odds.bookmakers)

    odds.bookmakers = filterBookmakersForOddsResponse(odds.bookmakers, { sourceType })
    odds.bookmakers = applyBooksPerRequestLimit(odds.bookmakers, request.tierConfig.booksPerRequest)
    odds.summary = summary

    return success(odds, { league: odds.leagueId, event: eventId })
  })

  // GET /v1/odds — bulk odds feed (starter+)
  fastify.get('/v1/odds', async (request, reply) => {
    const { league, market, bookmaker, sourceType, limit, page } = request.query

    const filter = {}

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))
    const validEventIds = await findValidEventIdsByCollection('odds', {
      league,
      pageNum,
      pageSize,
      sortField: 'fetchedAt',
    })

    if (validEventIds.length === 0) {
      return success([], { count: 0, page: pageNum })
    }

    // Use aggregation pipeline to filter heavy nested data server-side.
    // Odds docs embed all markets including player props (50+ market types),
    // making raw documents 5-10MB. Default to game-level markets only.
    const pipeline = [
      { $match: { eventId: { $in: validEventIds } } },
      { $sort: { fetchedAt: -1 } },
    ]

    // Server-side sourceType filtering
    if (sourceType && sourceType !== 'all') {
      pipeline.push({
        $set: {
          bookmakers: {
            $filter: {
              input: '$bookmakers',
              as: 'bk',
              cond: { $eq: ['$$bk.sourceType', sourceType] },
            },
          },
        },
      })
    }

    // Server-side bookmaker name filtering
    if (bookmaker) {
      const normalized = bookmaker.toLowerCase()
      pipeline.push({
        $set: {
          bookmakers: {
            $filter: {
              input: '$bookmakers',
              as: 'bk',
              cond: {
                $or: [
                  { $eq: [{ $toLower: '$$bk.bookmakerName' }, normalized] },
                  { $eq: [{ $toLower: '$$bk.bookmakerId' }, normalized] },
                ],
              },
            },
          },
        },
      })
    }

    // Server-side market filtering — filter to specific market or default to game-level only.
    // Player prop markets are served via /v1/player-props which has its own optimized pipeline.
    const marketFilter = market
      ? { $eq: ['$$m.marketType', market] }
      : { $in: ['$$m.marketType', GAME_MARKETS] }

    pipeline.push({
      $set: {
        bookmakers: {
          $map: {
            input: '$bookmakers',
            as: 'bk',
            in: {
              $mergeObjects: [
                '$$bk',
                {
                  markets: {
                    $filter: {
                      input: '$$bk.markets',
                      as: 'm',
                      cond: marketFilter,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    })

    pipeline.push({ $project: { _id: 0 } })

    const odds = await getCollection('odds').aggregate(pipeline).toArray()

    for (const o of odds) {
      o.bookmakers = applyBooksPerRequestLimit(o.bookmakers, request.tierConfig.booksPerRequest)
    }

    return success(odds, { count: odds.length, page: pageNum })
  })

  // GET /v1/odds/bookmakers — list available sportsbooks, DFS platforms, and exchanges (starter+)
  fastify.get('/v1/odds/bookmakers', async (request, reply) => {
    const { sourceType } = request.query

    const pipeline = [
      { $unwind: '$bookmakers' },
      {
        $group: {
          _id: '$bookmakers.bookmakerId',
          name: { $first: '$bookmakers.bookmakerName' },
          sourceType: { $first: '$bookmakers.sourceType' },
          sourceRegion: { $first: '$bookmakers.sourceRegion' },
        },
      },
      {
        $project: {
          _id: 0,
          bookmakerId: '$_id',
          name: 1,
          sourceType: 1,
          sourceRegion: 1,
        },
      },
      { $sort: { name: 1 } },
    ]

    let bookmakers = await getCollection('odds').aggregate(pipeline).toArray()

    if (sourceType && sourceType !== 'all') {
      bookmakers = bookmakers.filter((b) => b.sourceType === sourceType)
    }

    return success(bookmakers, { count: bookmakers.length })
  })
}
