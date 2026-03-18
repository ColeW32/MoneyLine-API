import { EndpointCard } from '@/components/docs/EndpointCard'

export default function EventsEndpointsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Events & Scores</h1>
      <p className="text-[15px] text-[#4a4a4a] mt-2 mb-6">
        Retrieve live and historical event data, scores, standings, and play-by-play across all supported leagues.
      </p>

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">List Events</h2>
      <EndpointCard
        method="GET"
        path="/v1/events"
        description="List events with filtering and pagination."
        params={[
          { name: 'league', type: 'string', description: 'Filter by league identifier' },
          { name: 'sport', type: 'string', description: 'Filter by sport' },
          { name: 'date', type: 'string', description: 'YYYY-MM-DD' },
          { name: 'status', type: 'string', description: 'scheduled, in_progress, final' },
          { name: 'limit', type: 'number', description: 'Max 100, default 25' },
          { name: 'page', type: 'number', description: 'Page number, default 1' },
        ]}
        response={`{
  "success": true,
  "data": {
    "total": 142,
    "page": 1,
    "pages": 6,
    "events": [
      {
        "eventId": "nba-ev-311286",
        "leagueId": "nba",
        "sport": "basketball",
        "homeTeamName": "Boston Celtics",
        "awayTeamName": "Los Angeles Lakers",
        "startTime": "2026-03-09T23:30:00.000Z",
        "status": "final",
        "scores": { "home": 112, "away": 105 }
      }
    ]
  }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Live Events</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/live"
        description="Get all in-progress events with live scores and game clock."
        params={[
          { name: 'league', type: 'string', description: 'Filter by league identifier' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "eventId": "nba-ev-311301",
      "leagueId": "nba",
      "sport": "basketball",
      "homeTeamName": "Golden State Warriors",
      "awayTeamName": "Milwaukee Bucks",
      "startTime": "2026-03-18T00:00:00.000Z",
      "status": "in_progress",
      "scores": { "home": 87, "away": 79 },
      "period": "Q3",
      "clock": "4:22"
    }
  ]
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Today's Events</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/today"
        description="Get today's scheduled events."
        params={[
          { name: 'league', type: 'string', description: 'Filter by league identifier' },
        ]}
        response={`{
  "success": true,
  "data": {
    "date": "2026-03-18",
    "count": 14,
    "events": [
      {
        "eventId": "nba-ev-311310",
        "leagueId": "nba",
        "sport": "basketball",
        "homeTeamName": "Miami Heat",
        "awayTeamName": "Chicago Bulls",
        "startTime": "2026-03-18T23:30:00.000Z",
        "status": "scheduled",
        "scores": null
      }
    ]
  }
}`}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Single Event</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId"
        description="Get full details for a single event by its ID."
        params={[
          { name: 'eventId', type: 'string', required: true, description: 'Event identifier' },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Play-by-Play</h2>
      <EndpointCard
        method="GET"
        path="/v1/events/:eventId/play-by-play"
        description="Get play-by-play data for a specific event."
        tier="pro"
        params={[
          { name: 'eventId', type: 'string', required: true, description: 'Event identifier' },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Scores by League</h2>
      <EndpointCard
        method="GET"
        path="/v1/leagues/:leagueId/scores"
        description="Get scores for all games in a league on a given date."
        params={[
          { name: 'leagueId', type: 'string', required: true, description: 'League identifier' },
          { name: 'date', type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        ]}
      />

      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Standings</h2>
      <EndpointCard
        method="GET"
        path="/v1/leagues/:leagueId/standings"
        description="Get current standings for a league."
        params={[
          { name: 'leagueId', type: 'string', required: true, description: 'League identifier' },
          { name: 'conference', type: 'string', description: 'Filter by conference' },
          { name: 'division', type: 'string', description: 'Filter by division' },
        ]}
      />
    </div>
  )
}
