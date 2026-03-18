import * as nba from './nba.js'
import * as nfl from './nfl.js'
import * as mlb from './mlb.js'
import * as nhl from './nhl.js'

const NORMALIZERS = { nba, nfl, mlb, nhl }

export function getNormalizer(leagueId) {
  const normalizer = NORMALIZERS[leagueId]
  if (!normalizer) throw new Error(`No normalizer for league: ${leagueId}`)
  return normalizer
}
