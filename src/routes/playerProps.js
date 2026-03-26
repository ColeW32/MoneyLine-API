import { getCollection } from '../db.js'
import { SPORTS, getPlayerPropMarkets } from '../config/sports.js'
import { success, error } from '../utils/response.js'
import { filterPlayerPropsDoc } from '../utils/playerProps.js'
import { americanToImplied } from '../utils/odds.js'

/**
 * Convert implied probability back to American odds.
 */
function impliedToAmerican(prob) {
  if (prob <= 0 || prob >= 1) return null
  const american = prob >= 0.5
    ? -(prob / (1 - prob)) * 100
    : ((1 - prob) / prob) * 100
  return Math.round(american * 10) / 10
}

/**
 * Annotate each line entry within a player's markets with a summary object:
 * { fairOdds, bestOdds, avgOdds } per selection (over/under).
 * Mutates lines in-place and returns the modified players array.
 */
function annotateLinesSummary(players) {
  for (const playerEntry of players) {
    for (const marketEntry of playerEntry.markets || []) {
      for (const line of marketEntry.lines || []) {
        if (!line.offers?.length) continue

        // Group offers by selection name (over / under / yes / no)
        const bySelection = new Map()
        for (const offer of line.offers) {
          if (offer.price == null || !Number.isFinite(offer.price)) continue
          const sel = String(offer.selection || '').trim().toLowerCase()
          if (!bySelection.has(sel)) bySelection.set(sel, [])
          bySelection.get(sel).push(offer.price)
        }

        if (bySelection.size === 0) continue

        // Compute avg implied per selection for vig removal
        const selections = [...bySelection.keys()]
        const avgImplieds = selections.map((sel) => {
          const prices = bySelection.get(sel)
          return prices.reduce((s, p) => s + americanToImplied(p), 0) / prices.length
        })

        // Remove vig for binary markets (over/under, yes/no)
        const fairOddsPerSel = {}
        if (selections.length === 2) {
          const total = avgImplieds.reduce((s, v) => s + v, 0)
          if (total > 0) {
            selections.forEach((sel, i) => {
              fairOddsPerSel[sel] = impliedToAmerican(avgImplieds[i] / total)
            })
          }
        } else {
          selections.forEach((sel, i) => {
            fairOddsPerSel[sel] = impliedToAmerican(avgImplieds[i])
          })
        }

        const summary = {}
        for (const sel of selections) {
          const prices = bySelection.get(sel)
          const bestOdds = prices.reduce((best, p) => (p > best ? p : best), -Infinity)
          const avgImplied = avgImplieds[selections.indexOf(sel)]

          summary[sel] = {
            fairOdds: fairOddsPerSel[sel] ?? null,
            bestOdds,
            avgOdds: impliedToAmerican(avgImplied),
          }
        }

        line.summary = summary
      }
    }
  }
  return players
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildPlayerPropsMarketCatalog(league = null) {
  const leagueIds = league ? [league] : Object.keys(SPORTS)

  return leagueIds.map((leagueId) => ({
    leagueId,
    sport: SPORTS[leagueId].sport,
    markets: getPlayerPropMarkets(leagueId).map((market) => ({
      marketType: market.key,
      marketName: market.marketName,
      format: market.format,
      isAlternate: market.isAlternate,
      supportsPoint: market.supportsPoint,
    })),
  }))
}

export default async function playerPropsRoutes(fastify) {
  fastify.get('/v1/player-props', async (request, reply) => {
    const {
      league,
      market,
      player,
      playerId,
      bookmaker,
      sourceType,
      limit,
      page,
    } = request.query

    if (league && !SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }

    const filter = {}
    if (league) filter.leagueId = league
    if (market) filter.marketTypes = market
    if (player) filter.playerNames = { $regex: escapeRegex(player), $options: 'i' }
    if (playerId) filter.playerIds = playerId

    const pageNum = Math.max(1, parseInt(page) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 25))

    const docs = await getCollection('player_props')
      .find(filter, { projection: { _id: 0, marketTypes: 0, playerNames: 0 } })
      .sort({ fetchedAt: -1, eventId: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .toArray()

    const results = docs
      .map((doc) => filterPlayerPropsDoc(doc, { market, player, playerId, bookmaker, sourceType }))
      .filter(Boolean)

    return success(results, { count: results.length, page: pageNum })
  })

  fastify.get('/v1/events/:eventId/player-props', async (request, reply) => {
    const { eventId } = request.params
    const { market, player, playerId, bookmaker, sourceType } = request.query

    const doc = await getCollection('player_props').findOne(
      { eventId },
      { projection: { _id: 0, marketTypes: 0, playerNames: 0 } }
    )

    if (!doc) {
      return reply.code(404).send(error(`Player props for event '${eventId}' not found.`, 404))
    }

    const filtered = filterPlayerPropsDoc(doc, { market, player, playerId, bookmaker, sourceType })
    if (!filtered) {
      return reply.code(404).send(error(`Player props for event '${eventId}' not found.`, 404))
    }

    annotateLinesSummary(filtered.players)

    return success(filtered, { league: filtered.leagueId, event: eventId })
  })

  fastify.get('/v1/player-props/markets', async (request, reply) => {
    const { league } = request.query
    if (league && !SPORTS[league]) {
      return reply.code(400).send(error(`Unknown league '${league}'.`, 400))
    }

    const catalog = buildPlayerPropsMarketCatalog(league || null)
    return success(catalog, {
      count: catalog.length,
      ...(league && { league }),
    })
  })
}
