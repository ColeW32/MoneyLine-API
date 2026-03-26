import { EndpointCard } from '@/components/docs/EndpointCard'
import Link from 'next/link'

export default function OddsEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Odds</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Access real-time betting odds and player props from US sportsbooks,
        supported DFS pick&apos;em platforms, and exchange/prediction-market
        venues, normalized into one consistent format. DFS prices are
        indicative and exposed in American odds for side-by-side comparison.
        The number of bookmakers returned depends on your tier: Free (0),
        Starter (1), Pro (all).
      </p>
      <p className="text-[14px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        For a player-grouped prop response using the same canonical event IDs,
        see the{' '}
        <Link href="/docs/endpoints/player-props" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">
          Player Props docs
        </Link>
        .
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
            description: 'all, sportsbook, dfs, exchange',
          },
          {
            name: 'market',
            type: 'string',
            required: false,
            description: 'moneyline, spread, total, player_points, player_pass_yds, etc.',
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
        description="Get odds for a specific event. Includes a summary object with fair (no-vig), best, and average odds computed across all bookmakers. The number of bookmakers returned depends on your tier."
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
            description: 'all, sportsbook, dfs, exchange',
          },
        ]}
        response={`{
  "success": true,
  "data": {
    "eventId": "nba-ev-311286",
    "summary": {
      "h2h": [
        { "name": "Boston Celtics", "fairOdds": -172, "bestOdds": -165, "avgOdds": -175 },
        { "name": "Los Angeles Lakers", "fairOdds": 148, "bestOdds": 155, "avgOdds": 145 }
      ],
      "spreads": [
        { "name": "Boston Celtics", "point": -4.5, "fairOdds": -108, "bestOdds": -105, "avgOdds": -110 },
        { "name": "Los Angeles Lakers", "point": 4.5, "fairOdds": -104, "bestOdds": -102, "avgOdds": -108 }
      ],
      "totals": [
        { "name": "Over", "point": 220.5, "fairOdds": -106, "bestOdds": -104, "avgOdds": -110 },
        { "name": "Under", "point": 220.5, "fairOdds": -106, "bestOdds": -105, "avgOdds": -108 }
      ]
    },
    "bookmakers": [
      {
        "key": "draftkings",
        "name": "DraftKings",
        "markets": [
          { "type": "h2h", "outcomes": [{ "name": "Boston Celtics", "price": -175 }, { "name": "Los Angeles Lakers", "price": 150 }] }
        ]
      }
    ]
  }
}`}
      />

      <div className="mt-5 rounded-lg border border-[#e0e0e0] bg-[#f5f2eb]/50 px-4 py-3">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">Summary field</p>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-[13px] leading-relaxed text-[#4a4a4a]">
          <li><strong>fairOdds</strong> — No-vig price: implied probabilities from all books are averaged, then normalized so the binary pair sums to 1.0, then converted back to American odds.</li>
          <li><strong>bestOdds</strong> — The highest American odds offered by any single bookmaker for that outcome.</li>
          <li><strong>avgOdds</strong> — Simple average of implied probabilities across all books, converted to American odds.</li>
          <li>Summary is computed from <em>all</em> bookmaker data before any tier-based bookmaker filtering is applied.</li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Bookmakers</h2>
      <EndpointCard
        method="GET"
        path="/v1/odds/bookmakers"
        description="List all tracked sportsbooks, DFS platforms, and exchanges."
        tier="starter"
        params={[
          {
            name: 'sourceType',
            type: 'string',
            required: false,
            description: 'all, sportsbook, dfs, exchange',
          },
        ]}
        response={`{
  "success": true,
  "data": {
    "count": 3,
    "bookmakers": [
      { "bookmakerId": "draftkings", "name": "DraftKings", "sourceType": "sportsbook", "sourceRegion": "us" },
      { "bookmakerId": "prizepicks", "name": "PrizePicks", "sourceType": "dfs", "sourceRegion": "us_dfs" },
      { "bookmakerId": "espnbet", "name": "ESPN BET", "sourceType": "sportsbook", "sourceRegion": "us2" },
      { "bookmakerId": "kalshi", "name": "Kalshi", "sourceType": "exchange", "sourceRegion": "us_ex" }
    ]
  }
}`}
      />
    </div>
  )
}
