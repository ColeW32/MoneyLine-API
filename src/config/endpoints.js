/**
 * Canonical registry of all public API endpoints.
 * Used by the admin API tester dropdown and the health checker.
 * Add new endpoints here to have them automatically appear in both.
 */

export const API_ENDPOINTS = [
  // ── Reference ──────────────────────────────────────────────
  {
    id: 'leagues',
    category: 'Reference',
    label: 'List Leagues',
    method: 'GET',
    path: '/v1/leagues',
    healthPath: '/v1/leagues',
    tier: 'free',
  },
  {
    id: 'teams',
    category: 'Reference',
    label: 'List Teams',
    method: 'GET',
    path: '/v1/teams?league=nba',
    healthPath: '/v1/teams?league=nba',
    tier: 'free',
  },
  {
    id: 'players',
    category: 'Reference',
    label: 'List Players',
    method: 'GET',
    path: '/v1/players?league=nba',
    healthPath: '/v1/players?league=nba',
    tier: 'free',
  },

  // ── Events ─────────────────────────────────────────────────
  {
    id: 'events',
    category: 'Events',
    label: 'List Events',
    method: 'GET',
    path: '/v1/events?league=nfl',
    healthPath: '/v1/events?league=nfl',
    tier: 'free',
  },
  {
    id: 'events_nba',
    category: 'Events',
    label: 'List Events (NBA)',
    method: 'GET',
    path: '/v1/events?league=nba',
    healthPath: '/v1/events?league=nba',
    tier: 'free',
  },

  // ── Odds ───────────────────────────────────────────────────
  {
    id: 'odds_bookmakers',
    category: 'Odds',
    label: 'List Bookmakers',
    method: 'GET',
    path: '/v1/odds/bookmakers',
    healthPath: '/v1/odds/bookmakers',
    tier: 'starter',
  },
  {
    id: 'odds',
    category: 'Odds',
    label: 'List Odds',
    method: 'GET',
    path: '/v1/odds?league=nfl&sourceType=all',
    healthPath: '/v1/odds?league=nfl&sourceType=all',
    tier: 'starter',
  },
  {
    id: 'odds_dfs',
    category: 'Odds',
    label: 'List Odds (DFS)',
    method: 'GET',
    path: '/v1/odds?league=nfl&sourceType=dfs',
    healthPath: '/v1/odds?league=nfl&sourceType=dfs',
    tier: 'starter',
  },

  // ── Player Props ────────────────────────────────────────────
  {
    id: 'player_props_markets',
    category: 'Player Props',
    label: 'List Markets',
    method: 'GET',
    path: '/v1/player-props/markets',
    healthPath: '/v1/player-props/markets',
    tier: 'starter',
  },
  {
    id: 'player_props',
    category: 'Player Props',
    label: 'List Player Props',
    method: 'GET',
    path: '/v1/player-props?league=nba&market=player_points&sourceType=all&limit=5',
    healthPath: '/v1/player-props?league=nba&market=player_points&sourceType=all&limit=5',
    tier: 'starter',
  },

  // ── Edge ───────────────────────────────────────────────────
  {
    id: 'edge',
    category: 'Edge',
    label: 'Edge Analysis',
    method: 'GET',
    path: '/v1/edge?league=nfl&sourceType=all',
    healthPath: '/v1/edge?league=nfl&sourceType=all',
    tier: 'pro',
  },
  {
    id: 'edge_value',
    category: 'Edge',
    label: 'Value Bets',
    method: 'GET',
    path: '/v1/edge/value?league=nba&sourceType=all',
    healthPath: '/v1/edge/value?league=nba&sourceType=all',
    tier: 'pro',
  },
  {
    id: 'edge_ev',
    category: 'Edge',
    label: 'Expected Value',
    method: 'GET',
    path: '/v1/edge/ev?league=nba&sourceType=all',
    healthPath: '/v1/edge/ev?league=nba&sourceType=all',
    tier: 'pro',
  },
  {
    id: 'edge_arbitrage',
    category: 'Edge',
    label: 'Arbitrage',
    method: 'GET',
    path: '/v1/edge/arbitrage?league=nba&sourceType=all',
    healthPath: '/v1/edge/arbitrage?league=nba&sourceType=all',
    tier: 'pro',
  },

  // ── Player Analysis ────────────────────────────────────────
  {
    id: 'players_trending',
    category: 'Player Analysis',
    label: 'Trending Players',
    method: 'GET',
    path: '/v1/players/trending?league=nba&market=player_points&sortBy=l5',
    healthPath: '/v1/players/trending?league=nba&market=player_points&sortBy=l5',
    tier: 'pro',
  },
  {
    id: 'players_trending_nhl',
    category: 'Player Analysis',
    label: 'Trending Players (NHL)',
    method: 'GET',
    path: '/v1/players/trending?league=nhl&market=player_shots_on_goal&sortBy=l5',
    healthPath: '/v1/players/trending?league=nhl&market=player_shots_on_goal&sortBy=l5',
    tier: 'pro',
  },
  {
    id: 'players_hit_rates',
    category: 'Player Analysis',
    label: 'Player Hit Rates',
    method: 'GET',
    path: '/v1/players/{playerId}/hit-rates?market=player_points&line=14.5',
    healthPath: null,
    tier: 'pro',
  },
  {
    id: 'players_analysis',
    category: 'Player Analysis',
    label: 'Player Analysis',
    method: 'GET',
    path: '/v1/players/{playerId}/analysis?market=player_points&window=l5',
    healthPath: null,
    tier: 'pro',
  },

  // ── Best Bets ──────────────────────────────────────────────
  {
    id: 'best_bets',
    category: 'Best Bets',
    label: 'Best Bets',
    method: 'GET',
    path: '/v1/best-bets?league=nfl',
    healthPath: '/v1/best-bets?league=nfl',
    tier: 'pro',
  },
  {
    id: 'best_bets_nba',
    category: 'Best Bets',
    label: 'Best Bets (NBA)',
    method: 'GET',
    path: '/v1/best-bets?league=nba',
    healthPath: '/v1/best-bets?league=nba',
    tier: 'pro',
  },
]

export const ENDPOINT_CATEGORIES = [...new Set(API_ENDPOINTS.map((e) => e.category))]
