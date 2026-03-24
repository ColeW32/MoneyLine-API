import { EndpointCard } from '@/components/docs/EndpointCard'

export default function EdgeEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Edge Data</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Edge endpoints provide pre-computed arbitrage, expected value, and value
        bet signals across supported bookmakers. They default to sportsbook-only
        signals; exchanges and prediction-market venues are opt-in via{' '}
        <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">sourceType</code>.
        These are Pro+ features and require a Pro or Enterprise tier API key.
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Browse Edge</h2>
      <EndpointCard
        method="GET"
        path="/v1/edge"
        description="Browse all edge opportunities including arbitrage, value bets, and positive EV plays."
        tier="pro"
        params={[
          {
            name: 'type',
            type: 'string',
            required: false,
            description: 'arbitrage, value, ev',
          },
          {
            name: 'league',
            type: 'string',
            required: false,
            description: 'Filter by league',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'sportsbook, exchange, all (default sportsbook)',
          },
          {
            name: 'minProfit',
            type: 'number',
            required: false,
            description: 'Minimum profit % for arb',
          },
          {
            name: 'minEdge',
            type: 'number',
            required: false,
            description: 'Minimum edge % for value',
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
    "total": 12,
    "page": 1,
    "pages": 1,
    "edges": [
      {
        "type": "arbitrage",
        "eventId": "nba-ev-311286",
        "market": "moneyline",
        "profitPct": 1.32,
        "legs": [
          { "bookmaker": "DraftKings", "side": "home", "odds": -175 },
          { "bookmaker": "FanDuel", "side": "away", "odds": 185 }
        ]
      }
    ]
  }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Arbitrage</h2>
      <EndpointCard
        method="GET"
        path="/v1/edge/arbitrage"
        description="Get arbitrage opportunities across sportsbooks."
        tier="pro"
        params={[
          {
            name: 'league',
            type: 'string',
            required: false,
            description: 'Filter by league',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'sportsbook, exchange, all',
          },
          {
            name: 'minProfit',
            type: 'number',
            required: false,
            description: 'Minimum profit percentage',
          },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Value Bets</h2>
      <EndpointCard
        method="GET"
        path="/v1/edge/value"
        description="Get value bets where the odds exceed the estimated fair probability."
        tier="pro"
        params={[
          {
            name: 'league',
            type: 'string',
            required: false,
            description: 'Filter by league',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'sportsbook, exchange, all',
          },
          {
            name: 'minEdge',
            type: 'number',
            required: false,
            description: 'Minimum edge percentage',
          },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Expected Value</h2>
      <EndpointCard
        method="GET"
        path="/v1/edge/ev"
        description="Get positive expected value bets."
        tier="pro"
        params={[
          {
            name: 'league',
            type: 'string',
            required: false,
            description: 'Filter by league',
          },
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'sportsbook, exchange, all',
          },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Event Edge</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId/edge"
        description="Get edge data for a specific event."
        tier="pro"
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
            description: 'sportsbook, exchange, all',
          },
        ]}
      />
    </div>
  )
}
