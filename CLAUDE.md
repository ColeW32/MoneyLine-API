# MoneyLine API — Developer Reference

Node.js/Express REST API serving sports odds, player props, hit rates, edge data, and live scores. Data is sourced from our stats provider (canonical events, scores, rosters, stats) and our odds provider (odds, player props, future game seeding).

## Key directories

```
src/
  server.js              — Express app, middleware wiring
  redis.js               — Redis client + in-memory API key/user cache
  db.js                  — Postgres client (pg)
  routes/                — Route handlers (events, odds, players, etc.)
  ingestion/
    scheduler.js         — All cron jobs (odds fetch, stats sync, stub cleanup, enrichment)
    fetchers/            — Stats and odds data fetch logic
    normalizers/         — Transform raw data into canonical DB schema
    hitRateCalculator.js — Computes L5/L10/L25/season hit rates from game logs
    bookmakerCatalog.js  — Canonical bookmaker list + alias map
    idMapper.js          — External ↔ internal ID mapping
    playerIdentityResolver.js — Fuzzy player name → canonical playerId
  middleware/            — Auth, rate limiting, tier enforcement
  utils/                 — Shared helpers (response, hash, canonical events, etc.)
```

## Architecture notes

- **Auth**: API keys stored in Postgres, cached in-memory (TTL 600s) to avoid Redis/DB round-trips on every request.
- **Rate limiting**: Fixed-window (per minute) using Redis INCR. Previously sliding window.
- **Credit tracking**: Credit INCRs are batched and flushed to Redis every 5 seconds rather than on every request.
- **Caching**: User/key cache TTL 600s; player trends cache TTL 1800s; admin stats endpoint uses Redis pipeline (not N+1 queries).

## Event ingestion & stub events

Stats data is the canonical source for events. However, odds data often arrives for games before stats data picks them up. To avoid returning 404s for valid event IDs in odds responses, a **stub event** is created from odds data:

- Stubs have `isStub: true` in all event responses.
- Stubs are enriched with team IDs at creation time via `idMapper.js`.
- A periodic enrichment job runs every 30 minutes to backfill team IDs on any stubs that were created without them.
- A daily schedule sync runs every 6 hours.
- When a canonical stats event arrives for the same game, the stub is deleted and all references (odds, props) are migrated to the canonical event ID.

Stub cleanup logic lives in `ingestion/scheduler.js`. The deduplication key is (league, homeTeam, awayTeam, date).

## Hit rate calculator

`ingestion/hitRateCalculator.js` computes hit rates from boxscore game logs.

- **Binary markets** (e.g. `player_anytime_td`, `player_anytime_goal_scorer`): use `line=0`. The calculator detects `line === 0` and maps to the correct stat field (touchdowns, goals) instead of a numeric threshold comparison.
- **UNCOMPUTABLE_MARKETS**: a constant set of market keys that cannot be derived from boxscore data (e.g. first-scorer markets). The `/hit-rates` endpoint returns `hitRateSupported: false` for these. Use `isHitRateComputable(market)` (exported from `hitRateCalculator.js`) to check before calling the calculator.
- Windows: L5, L10, L25, season.

## Bookmaker catalog

`ingestion/bookmakerCatalog.js` maps raw bookmaker keys to canonical `bookmakerId` values. Aliases are supported — e.g. `hardrockbet` maps to `hardrock_bet`. When filtering by bookmaker in any endpoint, both the canonical key and any alias are accepted.

## Edge calculator

`ingestion/edgeCalculator.js` computes arbitrage, value, and EV edges.

- **DFS excluded from arbitrage**: DFS operators (`sourceType: 'dfs'` — PrizePicks, Underdog, DraftKings Pick6, Betr Picks) are excluded from arbitrage calculations. Their prices are normalized into American odds but are indicative, not tradeable lines, so including them produces false arbitrage signals. DFS is still included in value and EV calculations.
- Exchange participation in arbitrage is limited to the `ARBITRAGE_EXCHANGE_ALLOWLIST` (ProphetX, Novig), and all exchange offers are sanity-checked against a sportsbook-only consensus before they can form arb legs.

## Team fields on player responses

The following endpoints enrich player entries with `teamAbbr` and `teamName` looked up from the `teams` collection via the player's `teamId`:

- `/v1/players/:playerId` — top-level `teamAbbr` and `teamName` fields on the player object
- `/v1/players/trending` — `teamAbbr` and `teamName` per result entry
- `/v1/players/trends` — `teamAbbr` and `teamName` on the nested `player` object (alongside the legacy `team` field which is kept for backward compat)
- `/v1/player-props` and `/v1/events/:eventId/player-props` — `teamAbbr` and `teamName` on each player entry within the `players` array

## Game log fields

When returning `type=game` player stats, each game log entry includes:
- `gameDateDisplay` — formatted date string (e.g. `"Mar 14"`) for display
- `opponentAbbr` — opponent team abbreviation (e.g. `"LAL"`)

## External API reference

See `src/config/stats-api.md` for stats provider endpoint documentation including sport-specific quirks (attribute prefixes, team abbreviation mappings for relocated franchises, etc.).

## User-facing API reference

`src/llms.txt` is served at `https://mlapi.bet/llms.txt` and is the canonical LLM-readable API reference. Keep it in sync when endpoints, response shapes, or behavior change.
