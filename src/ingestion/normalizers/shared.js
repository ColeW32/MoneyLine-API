/**
 * Shared normalization utilities used across all sports.
 */

/**
 * Parse GoalServe datetime_utc "dd.MM.yyyy HH:mm" to Date.
 */
export function parseDateTime(dtStr) {
  if (!dtStr) return null
  const [datePart, timePart] = dtStr.split(' ')
  const [dd, mm, yyyy] = datePart.split('.')
  if (!timePart) return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
  const [hh, min] = timePart.split(':')
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`)
}

/**
 * Normalize odds from The Odds API to MoneyLine schema.
 * Parameterized by leagueId and sport.
 */
export function normalizeOdds(oddsApiData, leagueId, sport) {
  if (!Array.isArray(oddsApiData)) return []

  return oddsApiData.map((event) => {
    const bookmakers = (event.bookmakers || []).map((bk) => ({
      bookmakerId: bk.key,
      bookmakerName: bk.title,
      lastUpdate: new Date(bk.last_update),
      markets: (bk.markets || []).map((market) => ({
        marketType: normalizeMarketKey(market.key),
        outcomes: (market.outcomes || []).map((o) => ({
          name: o.name,
          price: o.price,
          impliedProbability: americanToImplied(o.price),
          ...(o.point != null && { point: o.point }),
        })),
      })),
    }))

    return {
      eventId: `${leagueId}-odds-${event.id}`,
      leagueId,
      sport,
      fetchedAt: new Date(),
      _sourceHomeTeam: event.home_team,
      _sourceAwayTeam: event.away_team,
      _sourceCommenceTime: new Date(event.commence_time),
      bookmakers,
    }
  })
}

export function normalizeMarketKey(key) {
  const map = { h2h: 'moneyline', spreads: 'spread', totals: 'total' }
  return map[key] || key
}

export function americanToImplied(american) {
  if (american > 0) return Math.round((100 / (american + 100)) * 1000) / 1000
  return Math.round((Math.abs(american) / (Math.abs(american) + 100)) * 1000) / 1000
}
