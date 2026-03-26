import {
  getPlayerPropMarketDefinition,
  getPlayerPropMarkets,
} from '../config/sports.js'
import { bookmakerSortComparator } from '../ingestion/bookmakerCatalog.js'

function normalizePointKey(point) {
  if (point == null || Number.isNaN(point)) return 'null'
  return String(point)
}

function comparePoints(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return a - b
}

function isGenericSelectionName(name) {
  const normalized = String(name || '').trim().toLowerCase()
  return ['over', 'under', 'yes', 'no'].includes(normalized)
}

function getPlayerName(outcome, marketDefinition) {
  const description = String(outcome?.description || '').trim()
  if (description) return description

  const name = String(outcome?.name || '').trim()
  if (!name) return null

  if (marketDefinition?.format === 'over_under' && isGenericSelectionName(name)) {
    return null
  }

  return name
}

export function buildPlayerPropsDocFromOddsDoc(oddsDoc) {
  if (!oddsDoc?.eventId || !oddsDoc?.leagueId || !Array.isArray(oddsDoc.bookmakers)) return null

  const marketOrder = new Map(
    getPlayerPropMarkets(oddsDoc.leagueId).map((market, index) => [market.key, index])
  )
  const playersByName = new Map()

  for (const bookmaker of oddsDoc.bookmakers) {
    for (const market of bookmaker.markets || []) {
      const marketDefinition = getPlayerPropMarketDefinition(oddsDoc.leagueId, market.marketType)
      if (!marketDefinition) continue

      for (const outcome of market.outcomes || []) {
        const playerName = getPlayerName(outcome, marketDefinition)
        if (!playerName) continue

        const point = typeof outcome.point === 'number' && Number.isFinite(outcome.point)
          ? outcome.point
          : null

        if (!playersByName.has(playerName)) {
          playersByName.set(playerName, {
            playerName,
            markets: new Map(),
          })
        }

        const playerEntry = playersByName.get(playerName)
        if (!playerEntry.markets.has(market.marketType)) {
          playerEntry.markets.set(market.marketType, {
            marketType: market.marketType,
            marketName: marketDefinition.marketName,
            format: marketDefinition.format,
            isAlternate: marketDefinition.isAlternate,
            lines: new Map(),
          })
        }

        const marketEntry = playerEntry.markets.get(market.marketType)
        const pointKey = normalizePointKey(point)
        if (!marketEntry.lines.has(pointKey)) {
          marketEntry.lines.set(pointKey, {
            point,
            offers: [],
          })
        }

        marketEntry.lines.get(pointKey).offers.push({
          bookmakerId: bookmaker.bookmakerId,
          bookmakerName: bookmaker.bookmakerName,
          sourceType: bookmaker.sourceType,
          sourceRegion: bookmaker.sourceRegion,
          selection: outcome.name,
          price: outcome.price,
          impliedProbability: outcome.impliedProbability,
          ...(outcome.multiplier != null && { multiplier: outcome.multiplier }),
          ...(market.lastUpdate && { lastUpdate: market.lastUpdate }),
        })
      }
    }
  }

  const players = [...playersByName.values()]
    .map((playerEntry) => ({
      playerName: playerEntry.playerName,
      markets: [...playerEntry.markets.values()]
        .map((marketEntry) => ({
          marketType: marketEntry.marketType,
          marketName: marketEntry.marketName,
          format: marketEntry.format,
          isAlternate: marketEntry.isAlternate,
          lines: [...marketEntry.lines.values()]
            .map((line) => ({
              point: line.point,
              offers: [...line.offers].sort((a, b) => bookmakerSortComparator(a, b)),
            }))
            .sort((a, b) => comparePoints(a.point, b.point)),
        }))
        .sort((a, b) => {
          return (marketOrder.get(a.marketType) ?? Number.MAX_SAFE_INTEGER)
            - (marketOrder.get(b.marketType) ?? Number.MAX_SAFE_INTEGER)
        }),
    }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName))

  if (players.length === 0) return null

  return {
    eventId: oddsDoc.eventId,
    leagueId: oddsDoc.leagueId,
    sport: oddsDoc.sport,
    fetchedAt: oddsDoc.fetchedAt,
    playerNames: players.map((player) => player.playerName),
    marketTypes: [...new Set(players.flatMap((player) => player.markets.map((market) => market.marketType)))],
    players,
  }
}

/**
 * Annotate each offer with isBest: true for the highest-priced offer within
 * each (marketType, point, selectionName) group. Mutates offers in-place.
 * In American odds, numerically higher is always better for the bettor.
 */
function annotateBestOffers(players) {
  for (const playerEntry of players) {
    for (const marketEntry of playerEntry.markets || []) {
      for (const line of marketEntry.lines || []) {
        if (!line.offers?.length) continue
        const maxPrice = line.offers.reduce(
          (max, o) => (o.price > max ? o.price : max),
          -Infinity
        )
        for (const offer of line.offers) {
          offer.isBest = offer.price === maxPrice
        }
      }
    }
  }
}

export function filterPlayerPropsDoc(playerPropsDoc, {
  market,
  player,
  playerId,
  bookmaker,
  sourceType = 'all',
} = {}) {
  if (!playerPropsDoc) return null

  const normalizedBookmaker = bookmaker ? bookmaker.toLowerCase() : null
  const normalizedPlayer = player ? player.toLowerCase() : null

  const players = (playerPropsDoc.players || [])
    .filter((playerEntry) => {
      if (playerId && playerEntry.playerId !== playerId) return false
      if (!normalizedPlayer) return true
      return playerEntry.playerName.toLowerCase().includes(normalizedPlayer)
    })
    .map((playerEntry) => ({
      ...playerEntry,
      markets: (playerEntry.markets || [])
        .filter((marketEntry) => !market || marketEntry.marketType === market)
        .map((marketEntry) => ({
          ...marketEntry,
          lines: (marketEntry.lines || [])
            .map((line) => ({
              ...line,
              offers: (line.offers || []).filter((offer) => {
                if (sourceType && sourceType !== 'all' && offer.sourceType !== sourceType) return false
                if (!normalizedBookmaker) return true
                return offer.bookmakerId.toLowerCase() === normalizedBookmaker
                  || offer.bookmakerName.toLowerCase() === normalizedBookmaker
              }),
            }))
            .filter((line) => line.offers.length > 0),
        }))
        .filter((marketEntry) => marketEntry.lines.length > 0),
    }))
    .filter((playerEntry) => playerEntry.markets.length > 0)

  if (players.length === 0) return null

  annotateBestOffers(players)

  return {
    eventId: playerPropsDoc.eventId,
    leagueId: playerPropsDoc.leagueId,
    sport: playerPropsDoc.sport,
    fetchedAt: playerPropsDoc.fetchedAt,
    players,
  }
}
