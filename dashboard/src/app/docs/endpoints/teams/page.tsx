import { EndpointCard } from '@/components/docs/EndpointCard'

export const metadata = {
  title: 'Teams & Players — MoneyLine API Docs',
  description: 'Retrieve team rosters, player details, injury reports, stats, and schedules from the MoneyLine API.',
}

export default function TeamsPlayersPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Teams & Players</h1>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-4">
        Access team information, rosters, injury reports, player stats, and schedules across all
        supported leagues. Player stats are refreshed daily and support both season-level
        summaries and per-game logs.
      </p>

      {/* ---- Teams ---- */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Teams</h2>

      <EndpointCard
        method="GET"
        path="/v1/leagues/:leagueId/teams"
        description="List all teams in a league."
        params={[
          { name: 'leagueId', type: 'string', required: true, description: 'The unique identifier of the league.' },
        ]}
        response={`{
  "success": true,
  "data": {
    "teams": [
      {
        "teamId": "team_nba_lal",
        "name": "Los Angeles Lakers",
        "abbreviation": "LAL"
      },
      {
        "teamId": "team_nba_bos",
        "name": "Boston Celtics",
        "abbreviation": "BOS"
      }
    ]
  }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/teams/:teamId"
        description="Get detailed information for a single team."
        params={[
          { name: 'teamId', type: 'string', required: true, description: 'The unique identifier of the team.' },
        ]}
      />

      <EndpointCard
        method="GET"
        path="/v1/teams/:teamId/roster"
        description="Get the current roster for a team."
        params={[
          { name: 'teamId', type: 'string', required: true, description: 'The unique identifier of the team.' },
        ]}
        response={`{
  "success": true,
  "data": {
    "players": [
      {
        "playerId": "player_lj23",
        "name": "LeBron James",
        "position": "SF",
        "number": 23
      },
      {
        "playerId": "player_ad3",
        "name": "Anthony Davis",
        "position": "PF",
        "number": 3
      }
    ]
  }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/teams/:teamId/injuries"
        description="Get the latest injury report for a team."
        tier="starter"
        params={[
          { name: 'teamId', type: 'string', required: true, description: 'The unique identifier of the team.' },
        ]}
        response={`{
  "success": true,
  "data": {
    "players": [
      {
        "name": "Anthony Davis",
        "status": "Questionable",
        "injury": "Right knee soreness"
      },
      {
        "name": "Jarred Vanderbilt",
        "status": "Out",
        "injury": "Left foot surgery recovery"
      },
      {
        "name": "Gabe Vincent",
        "status": "Day-to-Day",
        "injury": "Left ankle sprain"
      }
    ]
  }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/teams/:teamId/stats"
        description="Get current-season player stat summaries for a team."
        params={[
          { name: 'teamId', type: 'string', required: true, description: 'The unique identifier of the team.' },
          { name: 'season', type: 'string', required: false, description: 'Season identifier (e.g. "2025"). Defaults to the current season.' },
        ]}
      />

      <EndpointCard
        method="GET"
        path="/v1/teams/:teamId/schedule"
        description="Get the upcoming and past schedule for a team."
        params={[
          { name: 'teamId', type: 'string', required: true, description: 'The unique identifier of the team.' },
        ]}
      />

      {/* ---- Players ---- */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Players</h2>

      <EndpointCard
        method="GET"
        path="/v1/players/:playerId"
        description="Get detailed information for a single player."
        params={[
          { name: 'playerId', type: 'string', required: true, description: 'The unique identifier of the player.' },
        ]}
      />

      <EndpointCard
        method="GET"
        path="/v1/players/:playerId/stats"
        description="Get season summaries or per-game logs for a single player."
        params={[
          { name: 'playerId', type: 'string', required: true, description: 'The unique identifier of the player.' },
          { name: 'type', type: 'string', required: false, description: 'Stat type: "season" or "game". Defaults to season.' },
          { name: 'season', type: 'string', required: false, description: 'Season identifier (e.g. "2025"). Defaults to the current season.' },
          { name: 'date', type: 'string', required: false, description: 'For type=game only. Exact date in YYYY-MM-DD.' },
          { name: 'from', type: 'string', required: false, description: 'For type=game only. Inclusive start date/time in YYYY-MM-DD or ISO 8601.' },
          { name: 'to', type: 'string', required: false, description: 'For type=game only. Inclusive end date/time in YYYY-MM-DD or ISO 8601.' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "playerId": "nba-p-12345",
      "playerName": "Jayson Tatum",
      "teamId": "nba-bos",
      "leagueId": "nba",
      "sport": "basketball",
      "season": "2025-26",
      "statType": "game",
      "eventId": "nba-ev-311286",
      "gameDate": "2026-03-09T00:00:00.000Z",
      "stats": {
        "points": 32,
        "rebounds": 8,
        "assists": 5
      }
    }
  ],
  "meta": {
    "player": "nba-p-12345",
    "type": "game",
    "season": "2025-26",
    "count": 1
  }
}`}
      />

      <div className="mt-5 rounded-lg border border-[#e0e0e0] bg-[#f5f2eb]/50 px-4 py-3">
        <p className="text-[13px] font-semibold text-[#1a1a1a]">Player stats query rules</p>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-[13px] leading-relaxed text-[#4a4a4a]">
          <li>If you omit <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type</code>, the API returns season summaries.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type=season</code> supports <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">season</code> only.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type=game</code> supports <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">season</code>, <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">date</code>, <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">from</code>, and <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">to</code>.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">date</code> cannot be combined with <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">from</code> or <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">to</code>.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type=career</code> is not supported in this version.</li>
        </ul>
      </div>
    </div>
  )
}
