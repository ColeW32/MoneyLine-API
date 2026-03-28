# Stats API Reference

Base URL: `http://www.goalserve.com/getfeed/ce2721a47001465b850508dbc370ae49`
Append `?json=1` for JSON output. Default is XML.

> **Finding team IDs**: Use the standings endpoint for each league. The numeric team ID from standings can be used for roster/stats endpoints that require IDs (e.g., NFL uses `{teamId}_rosters`).

---

## NFL (football/)

```
football/nfl-scores                          NFL livescore
football/nfl-scores?date=dd.MM.yyyy          Past boxscores since 2010
football/nfl-playbyplay-scores               NFL live play-by-play
football/nfl-shedule                         NFL schedule
football/nfl-standings                       NFL standings  ← use to find team IDs
football/nfl-shedule?date1=...&date2=...&showodds=1  Bookmaker odds by date range

football/1691_rosters                        Roster by numeric team ID (1691 = example)
football/1691_injuries                       Injuries by numeric team ID
football/1691_player_stats                   Player stats by numeric team ID
football/usa?playerimage=15826               Player image by player ID
```

> **NFL uses numeric team IDs**, not abbreviations. Get IDs from `nfl-standings`.

### NCAA Football (football/)
```
football/fbs-scores                          NCAA FBS livescore
football/fbs-scores?date=dd.MM.yyyy          Past FBS boxscores
football/fbs-playbyplay-scores               NCAA live play-by-play
football/fbs-shedule                         FBS schedule
football/fbs-standings                       FBS standings
football/fbs-shedule?date1=...&date2=...&showodds=1  Bookmaker odds by date
football/1153_rosters                        NCAA team roster by team ID
football/1153_stats                          NCAA team stats by team ID
football/1153_player_stats                   NCAA player stats by team ID
football/div3-scores / div3-shedule / div3-standings
football/fcs-scores / fcs-shedule / fcs-stand
```

---

## MLB (baseball/)

```
baseball/mlb_shedule                         MLB schedule
baseball/mlb_shedule?date1=...&date2=...&showodds=1  Bookmaker odds by date
baseball/usa                                 MLB livescore
baseball/usa?date=dd.MM.yyyy                 Past boxscores since 2010
baseball/mlb_standings                       MLB standings

baseball/mlb_player_batting                  All MLB player batting stats
baseball/mlb_player_fielding                 All MLB player fielding stats
baseball/mlb_player_pitching                 All MLB player pitching stats
baseball/mlb_team_batting                    Team batting stats
baseball/mlb_team_fielding                   Team fielding stats
baseball/mlb_team_pitching                   Team pitching stats
baseball/al_player_batting                   AL player batting stats
baseball/al_player_fielding                  AL player fielding stats
baseball/al_player_pitching                  AL player pitching stats
baseball/nl_player_batting                   NL player batting stats
baseball/nl_player_fielding                  NL player fielding stats
baseball/nl_player_pitching                  NL player pitching stats
baseball/career_leader_batting               Career batting leaders
baseball/career_leader_pitching              Career pitching leaders

baseball/{abbr}_rosters                      Team roster
baseball/{abbr}_stats                        Team stats
baseball/{abbr}_injuries                     Team injuries
baseball/usa?playerimage=15826               Player image by player ID
```

### MLB Provider Team Abbreviations
Several differ from standard team codes:

| Standard | Provider | Team |
|----------|----------|------|
| cws | **chw** | Chicago White Sox |
| kc  | **kan** | Kansas City Royals |
| mia | **fla** | Miami Marlins (was Florida Marlins) |
| sd  | **sdg** | San Diego Padres |
| sf  | **sfo** | San Francisco Giants |
| tb  | **tam** | Tampa Bay Rays |
| wsh | **was** | Washington Nationals |

Matching standard: `ari`, `atl`, `bal`, `bos`, `chc`, `cin`, `cle`, `col`, `det`, `hou`, `laa`, `lad`, `mil`, `min`, `nym`, `nyy`, `oak`, `phi`, `pit`, `sea`, `stl`, `tex`, `tor`.

> **MLB JSON note**: All XML attributes use `@` prefix in JSON output (`@name`, `@id`, `@position`, etc.). MLB also nests players under `team.position[].player`.

---

## NBA (bsktbl/)

```
bsktbl/nba-scores                            NBA livescore
bsktbl/nba-scores?date=dd.MM.yyyy            Past boxscores since 2010
bsktbl/nba-standings                         NBA standings
bsktbl/nba-shedule                           NBA schedule
bsktbl/nba-shedule?date1=...&date2=...&showodds=1  Bookmaker odds by date
bsktbl/nba-playbyplay                        NBA live commentaries
bsktbl/ap-rankings                           AP rankings
bsktbl/coaches-rankings                      Coaches poll rankings

bsktbl/{abbr}_rosters                        Team roster
bsktbl/{abbr}_stats                          Team stats
bsktbl/{abbr}_injuries                       Team injuries
bsktbl/1985_rosters                          NCAA team roster by team ID
bsktbl/1985_stats                            NCAA team stats by team ID
bsktbl/usa?playerimage=2011                  Player image by player ID
```

### NBA Team Abbreviations
`atl`, `bos`, `cha`, `chi`, `cle`, `dal`, `den`, `det`, `gs`, `hou`, `ind`, `lac`, `lal`, `mem`, `mia`, `mil`, `min`, `nj`, `no`, `ny`, `okc`, `orl`, `phi`, `phx`, `por`, `sac`, `sa`, `tor`, `utah`, `wsh`

> **NBA JSON note**: Players sit directly under `team.player` (no position nesting). Each player has a `oddname` field (alternate name variant) in addition to `name`.

### NCAA Basketball
```
bsktbl/ncaa-scores / ncaa-shedule / ncaa-standings
bsktbl/ncaa-playbyplay
bsktbl/ncaa-scores?date=dd.MM.yyyy
bsktbl/ncaa-shedule?date1=...&date2=...&showodds=1
```

### WNBA (bsktbl/)
```
bsktbl/wnba-scores / wnba-shedule / wnba-standings
bsktbl/wnba-scores?date=dd.MM.yyyy
bsktbl/w_{abbr}_rosters / w_{abbr}_stats
```
WNBA team abbrs: `w_atl`, `w_chi`, `w_con`, `w_ind`, `w_nyl`, `w_was`, `w_dal`, `w_lva`, `w_las`, `w_min`, `w_pho`, `w_sea`

---

## NHL (hockey/)

```
hockey/nhl-scores                            NHL livescore
hockey/nhl-scores?date=dd.MM.yyyy            Past boxscores since 2010
hockey/nhl-standings                         NHL standings
hockey/nhl-shedule                           NHL schedule
hockey/nhl-shedule?date1=...&date2=...&showodds=1  Bookmaker odds by date

hockey/{abbr}_rosters                        Team roster
hockey/{abbr}_stats                          Team stats
hockey/{abbr}_injuries                       Team injuries
```

### NHL Provider Team Abbreviations
Relocated teams use old city names:

| Standard | Provider | Team |
|----------|----------|------|
| wpg | **atl** | Winnipeg Jets (was Atlanta Thrashers) |
| ari | **phx** | Utah Hockey Club (was Phoenix/Arizona Coyotes) |
| vgk | **vgs** | Vegas Golden Knights |

Matching standard: `ana`, `bos`, `buf`, `cgy`, `car`, `chi`, `col`, `cbj`, `dal`, `det`, `edm`, `fla`, `la`, `min`, `mtl`, `nsh`, `nj`, `nyi`, `nyr`, `ott`, `phi`, `pit`, `sj`, `sea`, `stl`, `tb`, `tor`, `van`, `wsh`

> **NHL JSON note**: Players nest under `team.position[].player`. Full names, no `@` prefix.

---

## Soccer

### MLS (soccerfixtures/usa/mls)
```
soccerfixtures/usa/mls                       MLS fixtures
commentaries/1440.xml                        MLS livescore
commentaries/1440?date=dd.MM.yyyy            Past MLS scores
standings/usa.xml                            MLS standings
getodds/soccer?cat=usa                       MLS bookmaker odds
soccerstats/team/17364                       Team profile by ID
soccerstats/player/77843                     Player profile by ID
```

### EPL
```
soccerfixtures/england/premierleague         EPL fixtures
commentaries/1204.xml                        EPL livescore
commentaries/1204?date=dd.MM.yyyy            Past EPL scores
standings/england                            EPL standings
getodds/soccer?cat=england                   EPL bookmaker odds
soccerstats/team/9260                        Team profile by ID
soccerstats/player/193                       Player profile by ID
```

---

## Other Sports

### NASCAR
```
nascar/nationwideseries-results
nascar/nationwideseries-live
nascar/nationwideseries-standings
nascar/sprintcup-results
nascar/sprintcup-live
nascar/sprintcup-standings
```

### Golf
```
golf/live
golf/live?date=dd.MM.yyyy
golf/pga_schedule
golf/pga_players
golf/pga_rankings
```

### Formula 1
```
f1/f1-results
f1/live
f1/drivers
f1/teams
```

### MMA / UFC
```
mma/schedule
mma/live
mma/live?date=dd.MM.yyyy                     Past fight stats
```

### Esports
```
esports/home
esports/d1
esports/d2
esports/home?date=dd.MM.yyyy
```

### Horse Racing
```
racing/usa                                   Today's entries/results
racing/usa_tomorrow                          Tomorrow's entries/results
```

### XFL
```
xfl/xfl-scores
xfl/xfl-shedule
xfl/xfl-shedule?showodds=1
xfl/106_roster                               Roster by team ID
```

---

## JSON Structure by Sport

| Sport | Player path | Attribute prefix | Player name field |
|-------|------------|-----------------|-------------------|
| NFL   | `team.position[].player` | none | `name` |
| MLB   | `team.position[].player` | `@` on all keys | `@name` |
| NBA   | `team.player` (flat) | none | `name` + `oddname` |
| NHL   | `team.position[].player` | none | `name` |

MLB is the **only** sport using XML `@`-prefixed attributes in JSON output.
