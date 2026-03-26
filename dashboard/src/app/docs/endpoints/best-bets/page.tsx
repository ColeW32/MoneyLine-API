import { EndpointCard } from '@/components/docs/EndpointCard'

export default function BestBetsEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Best Bets</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Best Bets endpoints expose the strongest available line per market after
        comparing supported sportsbooks, DFS platforms, and exchange venues.
        They are designed for quick integration into featured picks, matchup
        cards, and top-line recommendation surfaces.
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Browse Best Bets</h2>
      <EndpointCard
        method="GET"
        path="/v1/best-bets"
        description="List best available prices across events, with optional filtering by league, market, bookmaker, and source type."
        tier="pro"
        params={[
          { name: 'league', type: 'string', required: false, description: 'Optional league filter such as nba or nfl' },
          { name: 'market', type: 'string', required: false, description: 'Optional exact market filter such as moneyline or player_points' },
          { name: 'bookmaker', type: 'string', required: false, description: 'Optional bookmaker key or display name filter' },
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
      "calculatedAt": "2026-03-26T14:05:00.000Z",
      "markets": [
        {
          "marketType": "moneyline",
          "outcomes": [
            { "name": "Boston Celtics", "price": -165, "bookmakerId": "fanduel", "bookmakerName": "FanDuel", "sourceType": "sportsbook" },
            { "name": "Los Angeles Lakers", "price": 155, "bookmakerId": "draftkings", "bookmakerName": "DraftKings", "sourceType": "sportsbook" }
          ]
        }
      ]
    }
  ],
  "meta": { "count": 1, "page": 1 }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Event Best Bets</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId/best-bets"
        description="Get the best available lines for one canonical MoneyLine event."
        tier="pro"
        params={[
          { name: 'eventId', type: 'string', required: true, description: 'Canonical MoneyLine event identifier' },
          { name: 'market', type: 'string', required: false, description: 'Optional exact market filter' },
          { name: 'bookmaker', type: 'string', required: false, description: 'Optional bookmaker key or display name filter' },
          { name: 'sourceType', type: 'string', required: false, description: 'all, sportsbook, dfs, exchange' },
        ]}
        response={`{
  "success": true,
  "data": {
    "eventId": "nba-ev-311286",
    "leagueId": "nba",
    "sport": "basketball",
    "calculatedAt": "2026-03-26T14:05:00.000Z",
    "markets": [
      {
        "marketType": "player_points",
        "outcomes": [
          { "name": "Over", "description": "Jayson Tatum", "point": 29.5, "price": 120, "bookmakerId": "prizepicks", "bookmakerName": "PrizePicks", "sourceType": "dfs" },
          { "name": "Under", "description": "Jayson Tatum", "point": 29.5, "price": -105, "bookmakerId": "kalshi", "bookmakerName": "Kalshi", "sourceType": "exchange" }
        ]
      }
    ]
  },
  "meta": { "league": "nba", "event": "nba-ev-311286" }
}`}
      />
    </div>
  )
}
