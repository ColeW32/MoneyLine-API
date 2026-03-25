import Link from 'next/link'
import { EndpointCard } from '@/components/docs/EndpointCard'

export default function PlayerPropsEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Player Props</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Access normalized player prop markets for NBA, NFL, MLB, and NHL using
        the same canonical event IDs as the Events, Odds, and Edge endpoints.
        If you already have an <code className="text-[13px] bg-[#eae8e3] px-1 py-0.5 rounded">eventId</code>,
        you can use it directly against both{' '}
        <code className="text-[13px] bg-[#eae8e3] px-1 py-0.5 rounded">/v1/events/:eventId/odds</code>{' '}
        and{' '}
        <code className="text-[13px] bg-[#eae8e3] px-1 py-0.5 rounded">/v1/events/:eventId/player-props</code>.
      </p>
      <p className="text-[14px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Need game lines too? See the{' '}
        <Link href="/docs/endpoints/odds" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">
          Odds docs
        </Link>
        .
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Browse Player Props</h2>
      <EndpointCard
        method="GET"
        path="/v1/player-props"
        description="Browse player props grouped by event, then player, market, and line."
        tier="starter"
        params={[
          { name: 'league', type: 'string', required: false, description: 'Filter by league identifier' },
          { name: 'market', type: 'string', required: false, description: 'Filter by prop market key such as player_points or player_pass_yds' },
          { name: 'player', type: 'string', required: false, description: 'Case-insensitive player-name filter' },
          { name: 'bookmaker', type: 'string', required: false, description: 'Filter by bookmaker key or display name' },
          { name: 'sourceType', type: 'string', required: false, description: 'all, sportsbook, dfs, exchange' },
          { name: 'limit', type: 'number', required: false, description: 'Max 50, default 25' },
          { name: 'page', type: 'number', required: false, description: 'Page number for pagination' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "sport": "basketball",
      "fetchedAt": "2026-03-25T00:10:00.000Z",
      "players": [
        {
          "playerName": "Jayson Tatum",
          "markets": [
            {
              "marketType": "player_points",
              "marketName": "Points",
              "format": "over_under",
              "isAlternate": false,
              "lines": [
                {
                  "point": 29.5,
                  "offers": [
                    { "bookmakerId": "fanduel", "bookmakerName": "FanDuel", "sourceType": "sportsbook", "sourceRegion": "us", "selection": "Over", "price": 120, "impliedProbability": 0.455 },
                    { "bookmakerId": "prizepicks", "bookmakerName": "PrizePicks", "sourceType": "dfs", "sourceRegion": "us_dfs", "selection": "Over", "price": 125, "impliedProbability": 0.444 }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "meta": { "count": 1, "page": 1 }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Event Player Props</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId/player-props"
        description="Get player props for one event using the same eventId returned by Events and Odds."
        tier="starter"
        params={[
          { name: 'eventId', type: 'string', required: true, description: 'Canonical MoneyLine event identifier' },
          { name: 'market', type: 'string', required: false, description: 'Optional exact prop market key filter' },
          { name: 'player', type: 'string', required: false, description: 'Optional case-insensitive player-name filter' },
          { name: 'bookmaker', type: 'string', required: false, description: 'Optional bookmaker key or display-name filter' },
          { name: 'sourceType', type: 'string', required: false, description: 'all, sportsbook, dfs, exchange' },
        ]}
        response={`{
  "success": true,
  "data": {
    "eventId": "nba-ev-311286",
    "leagueId": "nba",
    "sport": "basketball",
    "fetchedAt": "2026-03-25T00:10:00.000Z",
    "players": [
      {
        "playerName": "Jayson Tatum",
        "markets": [
          {
            "marketType": "player_points",
            "marketName": "Points",
            "format": "over_under",
            "isAlternate": false,
            "lines": [
              {
                "point": 29.5,
                "offers": [
                  { "bookmakerId": "fanduel", "bookmakerName": "FanDuel", "sourceType": "sportsbook", "sourceRegion": "us", "selection": "Over", "price": 120, "impliedProbability": 0.455 },
                  { "bookmakerId": "kalshi", "bookmakerName": "Kalshi", "sourceType": "exchange", "sourceRegion": "us_ex", "selection": "Over", "price": 118, "impliedProbability": 0.459 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "meta": { "league": "nba", "event": "nba-ev-311286" }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Supported Markets</h2>
      <EndpointCard
        method="GET"
        path="/v1/player-props/markets"
        description="List all supported player prop markets by league."
        tier="starter"
        params={[
          { name: 'league', type: 'string', required: false, description: 'Optional league identifier to return one league only' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "leagueId": "nba",
      "sport": "basketball",
      "markets": [
        { "marketType": "player_points", "marketName": "Points", "format": "over_under", "isAlternate": false, "supportsPoint": true },
        { "marketType": "player_points_alternate", "marketName": "Alternate Points", "format": "over_under", "isAlternate": true, "supportsPoint": true }
      ]
    }
  ],
  "meta": { "count": 1, "league": "nba" }
}`}
      />
    </div>
  )
}
