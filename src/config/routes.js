// Route permission config — maps route patterns to minimum tier required.
// Any route not listed here is accessible by all tiers (including free).

export const ROUTE_PERMISSIONS = {
  '/v1/edge': 'pro',
  '/v1/edge/value': 'pro',
  '/v1/edge/ev': 'pro',
  '/v1/edge/arbitrage': 'pro',
  '/v1/events/:eventId/edge': 'pro',
  '/v1/events/:eventId/play-by-play': 'pro',
  '/v1/odds': 'hobbyist',
  '/v1/odds/bookmakers': 'hobbyist',
  '/v1/events/:eventId/odds': 'hobbyist',
  '/v1/teams/:teamId/injuries': 'hobbyist',
}

export function getRequiredTier(routePattern) {
  return ROUTE_PERMISSIONS[routePattern] || null
}
