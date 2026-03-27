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
        path="/v1/teams"
        description="List all teams, optionally filtered by league."
        params={[
          { name: 'league', type: 'string', required: false, description: 'Optional league filter such as nba or nfl' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "teamId": "nba-lal",
      "name": "Los Angeles Lakers",
      "abbreviation": "LAL",
      "leagueId": "nba"
    }
  ],
  "meta": { "count": 1, "league": "nba" }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/leagues/:leagueId/teams"
        description="List all teams in a league."
        params={[
          { name: 'leagueId', type: 'string', required: true, description: 'The unique identifier of the league.' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "teamId": "nba-lal",
      "name": "Los Angeles Lakers",
      "abbreviation": "LAL",
      "leagueId": "nba"
    },
    {
      "teamId": "nba-bos",
      "name": "Boston Celtics",
      "abbreviation": "BOS",
      "leagueId": "nba"
    }
  ],
  "meta": { "league": "nba", "count": 2 }
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
    "teamId": "nba-lal",
    "leagueId": "nba",
    "players": [
      {
        "playerId": "nba-p-2544",
        "name": "LeBron James",
        "position": "SF",
        "number": 23
      },
      {
        "playerId": "nba-p-203076",
        "name": "Anthony Davis",
        "position": "PF",
        "number": 3
      }
    ]
  },
  "meta": { "league": "nba", "team": "nba-lal" }
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
    "teamId": "nba-lal",
    "leagueId": "nba",
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
  },
  "meta": { "league": "nba", "team": "nba-lal" }
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
        path="/v1/players"
        description="List players, optionally filtered by league or team."
        params={[
          { name: 'league', type: 'string', required: false, description: 'Optional league filter such as nba or nfl' },
          { name: 'team', type: 'string', required: false, description: 'Optional teamId filter' },
          { name: 'limit', type: 'number', required: false, description: 'Max 100, default 50' },
          { name: 'page', type: 'number', required: false, description: 'Page number, default 1' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "playerId": "nba-p-2544",
      "playerName": "LeBron James",
      "teamId": "nba-lal",
      "leagueId": "nba",
      "position": "SF"
    }
  ],
  "meta": { "count": 1, "total": 1, "page": 1, "pages": 1, "league": "nba" }
}`}
      />

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
          { name: 'eventId', type: 'string', required: false, description: 'For type=game only. Filter to one exact event ID.' },
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
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type=game</code> supports <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">season</code>, <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">eventId</code>, <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">date</code>, <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">from</code>, and <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">to</code>.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">date</code> cannot be combined with <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">from</code> or <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">to</code>.</li>
          <li>Use <code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">eventId</code> when you want the stat line for one exact game.</li>
          <li><code className="text-[12px] bg-[#f0ede6] px-1 py-0.5 rounded font-mono">type=career</code> is not supported in this version.</li>
        </ul>
      </div>

      {/* ---- Player Analysis ---- */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-1">Player Analysis</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-2 mb-4 max-w-2xl">
        These endpoints combine historical game stats with live betting data to surface hit rates,
        trending players, and integrated player analysis views.
      </p>

      <EndpointCard
        method="GET"
        path="/v1/players/trending"
        description="Get players sorted by hit rate, paired with their best available prop line and odds. Designed for discovery surfaces."
        tier="pro"
        params={[
          { name: 'league', type: 'string', required: true, description: 'League ID (nba, nfl, mlb, nhl)' },
          { name: 'market', type: 'string', required: true, description: 'Prop market key (e.g. player_points)' },
          { name: 'sortBy', type: 'string', required: false, description: 'Hit-rate window to sort by: l5, l10, l25, season. Default l5' },
          { name: 'direction', type: 'string', required: false, description: 'over or under. Default over' },
          { name: 'limit', type: 'number', required: false, description: 'Max 50, default 25' },
          { name: 'page', type: 'number', required: false, description: 'Page number for pagination' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "playerId": "nba-p-4065648",
      "playerName": "Coby White",
      "teamId": "nba-cha",
      "position": "PG",
      "market": "player_points",
      "bestLine": 14.5,
      "bestOdds": -108,
      "bookmakerName": "DraftKings",
      "hitRates": {
        "L5":  { "games": 5, "hits": 4, "rate": 0.800 },
        "L10": { "games": 10, "hits": 6, "rate": 0.600 },
        "L25": { "games": 25, "hits": 15, "rate": 0.600 }
      }
    }
  ],
  "meta": { "count": 25, "total": 87, "page": 1, "league": "nba", "market": "player_points" }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/players/trends"
        description="Get each player's highest-profit active prop trend over a rolling game window, including matchup context and flat-stake profit."
        tier="pro"
        params={[
          { name: 'league', type: 'string', required: false, description: 'Optional league ID filter (nba, nfl, mlb, nhl)' },
          { name: 'window', type: 'number', required: false, description: 'Rolling game window size. Integer 1-100, default 25' },
          { name: 'bookmaker', type: 'string', required: false, description: 'Optional bookmaker key or display name filter' },
          { name: 'sourceType', type: 'string', required: false, description: 'all, sportsbook, dfs, exchange. Default all' },
          { name: 'limit', type: 'number', required: false, description: 'Max 50, default 25' },
          { name: 'page', type: 'number', required: false, description: 'Page number for pagination' },
        ]}
        response={`{
  "success": true,
  "data": [
    {
      "player": {
        "playerId": "nba-p-4065648",
        "name": "Coby White",
        "teamId": "nba-chi",
        "team": "CHI",
        "matchup": "CHI @ NYK"
      },
      "eventId": "nba-ev-311286",
      "leagueId": "nba",
      "bet": {
        "market": "player_points",
        "marketName": "Player Points",
        "direction": "under",
        "line": 24.5,
        "price": 125,
        "bookmakerId": "bovada",
        "bookmakerName": "Bovada",
        "sourceType": "sportsbook"
      },
      "sampleSize": 25,
      "performance": {
        "wins": 20,
        "losses": 5,
        "pushes": 0,
        "hitRate": 0.8,
        "stake": 100
      },
      "profit": 2000
    }
  ],
  "meta": { "count": 25, "total": 73, "page": 1, "pages": 3, "window": 25, "stake": 100, "league": "nba", "sourceType": "all" }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/players/:playerId/hit-rates"
        description="Get hit rates (L5, L10, L25, season) for a player against a specific prop line."
        tier="pro"
        params={[
          { name: 'playerId', type: 'string', required: true, description: 'The unique identifier of the player.' },
          { name: 'market', type: 'string', required: true, description: 'Prop market key (e.g. player_points)' },
          { name: 'line', type: 'number', required: true, description: 'The prop line threshold (e.g. 14.5)' },
        ]}
        response={`{
  "success": true,
  "data": {
    "playerId": "nba-p-4065648",
    "market": "player_points",
    "line": 14.5,
    "direction": "over",
    "hitRates": {
      "L5":     { "games": 5, "hits": 4, "rate": 0.800 },
      "L10":    { "games": 10, "hits": 6, "rate": 0.600 },
      "L25":    { "games": 25, "hits": 15, "rate": 0.600 },
      "season": { "games": 62, "hits": 37, "rate": 0.597 }
    }
  }
}`}
      />

      <EndpointCard
        method="GET"
        path="/v1/players/:playerId/analysis"
        description="Integrated player analysis: current best bet, game-by-game chart data, and hit rates in one response."
        tier="pro"
        params={[
          { name: 'playerId', type: 'string', required: true, description: 'The unique identifier of the player.' },
          { name: 'market', type: 'string', required: true, description: 'Prop market key (e.g. player_points)' },
          { name: 'window', type: 'string', required: false, description: 'Time window for chart data: l5, l10, l25, season. Default l5' },
        ]}
        response={`{
  "success": true,
  "data": {
    "player": { "playerId": "nba-p-4065648", "playerName": "Coby White", "teamId": "nba-cha" },
    "currentEvent": { "eventId": "nba-ev-311286", "startTime": "2026-03-26T23:10:00Z" },
    "bestBet": { "market": "player_points", "line": 14.5, "odds": -108, "bookmakerName": "DraftKings" },
    "hitRates": {
      "L5": { "games": 5, "hits": 4, "rate": 0.800 },
      "L10": { "games": 10, "hits": 6, "rate": 0.600 }
    },
    "chart": {
      "window": "l5",
      "line": 14.5,
      "games": [
        { "gameDate": "2026-03-14T00:00:00Z", "opponent": "SAS", "value": 18, "hit": true },
        { "gameDate": "2026-03-17T00:00:00Z", "opponent": "MIA", "value": 24, "hit": true },
        { "gameDate": "2026-03-21T00:00:00Z", "opponent": "MEM", "value": 12, "hit": false }
      ]
    }
  }
}`}
      />
    </div>
  )
}
