import { EndpointCard } from '@/components/docs/EndpointCard'

export default function OddsEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Odds</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Access real-time betting odds from US sportsbooks plus supported
        exchanges and prediction-market venues, normalized into one consistent
        format. The number of bookmakers returned depends on your tier: Free
        (0), Hobbyist (1), Pro (all).
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Browse Odds</h2>
      <EndpointCard
        method="GET"
        path="/v1/odds"
        description="Browse all odds with filtering by league, market, and bookmaker."
        tier="starter"
        params={[
          {
            name: 'league',
            type: 'string',
            required: false,
            description: 'Filter by league identifier',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'all, sportsbook, exchange',
          },
          {
            name: 'market',
            type: 'string',
            required: false,
            description: 'moneyline, spreads, totals',
          },
          {
            name: 'bookmaker',
            type: 'string',
            required: false,
            description: 'Filter by bookmaker key',
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Max 50, default 25',
          },
          {
            name: 'page',
            type: 'number',
            required: false,
            description: 'Page number for pagination',
          },
        ]}
        response={`{
  "success": true,
  "data": {
    "total": 86,
    "page": 1,
    "pages": 4,
    "odds": [
      {
        "eventId": "nba-ev-311286",
        "homeTeam": "Boston Celtics",
        "awayTeam": "Los Angeles Lakers",
        "market": "moneyline",
        "bookmakers": [
          { "key": "draftkings", "name": "DraftKings", "home": -180, "away": 155 },
          { "key": "fanduel", "name": "FanDuel", "home": -175, "away": 150 }
        ]
      }
    ]
  }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Event Odds</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId/odds"
        description="Get odds for a specific event. The number of bookmakers returned depends on your tier."
        tier="starter"
        params={[
          {
            name: 'eventId',
            type: 'string',
            required: true,
            description: 'The event identifier',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'all, sportsbook, exchange',
          },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Bookmakers</h2>
      <EndpointCard
        method="GET"
        path="/v1/odds/bookmakers"
        description="List all tracked bookmakers and exchanges."
        tier="starter"
        params={[
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'all, sportsbook, exchange',
          },
        ]}
        response={`{
  "success": true,
  "data": {
    "count": 3,
    "bookmakers": [
      { "bookmakerId": "draftkings", "name": "DraftKings", "sourceType": "sportsbook", "sourceRegion": "us" },
      { "bookmakerId": "espnbet", "name": "ESPN BET", "sourceType": "sportsbook", "sourceRegion": "us2" },
      { "bookmakerId": "kalshi", "name": "Kalshi", "sourceType": "exchange", "sourceRegion": "us_ex" }
    ]
  }
}`}
      />
    </div>
  )
}
