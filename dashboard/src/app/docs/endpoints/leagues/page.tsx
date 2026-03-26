import { EndpointCard } from '@/components/docs/EndpointCard'

export default function LeaguesEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Sports & Leagues</h1>
      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-3 max-w-2xl">
        Retrieve the sports and leagues supported by the MoneyLine API. Use these
        endpoints to discover available leagues, filter by sport, or fetch details
        for a specific league.
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">List Sports</h2>
      <EndpointCard
        method="GET"
        path="/v1/sports"
        description="List all available sports and their leagues."
        tier="free"
        response={`{
  "success": true,
  "data": [
    { "sport": "basketball", "leagues": [{ "leagueId": "nba", "name": "NBA" }] },
    { "sport": "football", "leagues": [{ "leagueId": "nfl", "name": "NFL" }] },
    { "sport": "baseball", "leagues": [{ "leagueId": "mlb", "name": "MLB" }] },
    { "sport": "hockey", "leagues": [{ "leagueId": "nhl", "name": "NHL" }] }
  ]
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">List Leagues</h2>
      <EndpointCard
        method="GET"
        path="/v1/leagues"
        description="List all leagues, optionally filtered by sport."
        tier="free"
        params={[
          {
            name: 'sport',
            type: 'string',
            required: false,
            description: 'Filter by sport: basketball, football, baseball, hockey',
          },
        ]}
        response={`{
  "success": true,
  "data": [
    { "leagueId": "nba", "name": "NBA", "sport": "basketball" },
    { "leagueId": "nfl", "name": "NFL", "sport": "football" }
  ],
  "meta": { "count": 2 }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Get League</h2>
      <EndpointCard
        method="GET"
        path="/v1/leagues/:leagueId"
        description="Get details for a specific league."
        tier="free"
        params={[
          {
            name: 'leagueId',
            type: 'string',
            required: true,
            description: 'League identifier (nba, nfl, mlb, nhl)',
          },
        ]}
        response={`{
  "success": true,
  "data": {
    "leagueId": "nba",
    "name": "NBA",
    "sport": "basketball"
  }
}`}
      />
    </div>
  )
}
