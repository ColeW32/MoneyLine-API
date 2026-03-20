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
        supported leagues.
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
        description="Get aggregated player stats for a team."
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
        description="Get stats for a single player."
        params={[
          { name: 'playerId', type: 'string', required: true, description: 'The unique identifier of the player.' },
          { name: 'type', type: 'string', required: false, description: 'Stat type (e.g. "season", "game", "career"). Defaults to season averages.' },
          { name: 'season', type: 'string', required: false, description: 'Season identifier (e.g. "2025"). Defaults to the current season.' },
        ]}
      />
    </div>
  )
}
