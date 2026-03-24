/**
 * Local bookmaker catalog keyed by The Odds API bookmaker key.
 * Used to enrich normalized odds with sourceRegion and sourceType.
 *
 * sourceRegion: us | us2 | us_ex
 * sourceType:   sportsbook | exchange
 *
 * Keys not present here are stored with sourceType: 'unknown' and are
 * excluded from edge calculations until mapped.
 */

const CATALOG = {
  // --- us region: established US sportsbooks ---
  draftkings:       { bookmakerName: 'DraftKings',             sourceRegion: 'us',    sourceType: 'sportsbook' },
  fanduel:          { bookmakerName: 'FanDuel',                sourceRegion: 'us',    sourceType: 'sportsbook' },
  betmgm:           { bookmakerName: 'BetMGM',                 sourceRegion: 'us',    sourceType: 'sportsbook' },
  caesars:          { bookmakerName: 'Caesars',                sourceRegion: 'us',    sourceType: 'sportsbook' },
  pointsbet_us:     { bookmakerName: 'PointsBet (US)',         sourceRegion: 'us',    sourceType: 'sportsbook' },
  williamhill_us:   { bookmakerName: 'William Hill (US)',      sourceRegion: 'us',    sourceType: 'sportsbook' },
  betrivers:        { bookmakerName: 'BetRivers',              sourceRegion: 'us',    sourceType: 'sportsbook' },
  unibet_us:        { bookmakerName: 'Unibet (US)',            sourceRegion: 'us',    sourceType: 'sportsbook' },
  bovada:           { bookmakerName: 'Bovada',                 sourceRegion: 'us',    sourceType: 'sportsbook' },
  betonlineag:      { bookmakerName: 'BetOnline.ag',           sourceRegion: 'us',    sourceType: 'sportsbook' },
  mybookieag:       { bookmakerName: 'MyBookie.ag',            sourceRegion: 'us',    sourceType: 'sportsbook' },
  lowvig:           { bookmakerName: 'LowVig.ag',              sourceRegion: 'us',    sourceType: 'sportsbook' },
  barstool:         { bookmakerName: 'Barstool Sportsbook',    sourceRegion: 'us',    sourceType: 'sportsbook' },
  betus:            { bookmakerName: 'BetUS',                  sourceRegion: 'us',    sourceType: 'sportsbook' },
  wynnbet:          { bookmakerName: 'WynnBET',                sourceRegion: 'us',    sourceType: 'sportsbook' },
  superbook:        { bookmakerName: 'SuperBook',              sourceRegion: 'us',    sourceType: 'sportsbook' },
  bet365_us:        { bookmakerName: 'bet365 (US)',            sourceRegion: 'us',    sourceType: 'sportsbook' },

  // --- us2 region: additional / newer US sportsbooks ---
  espnbet:          { bookmakerName: 'ESPN BET',               sourceRegion: 'us2',   sourceType: 'sportsbook' },
  fanatics:         { bookmakerName: 'Fanatics',               sourceRegion: 'us2',   sourceType: 'sportsbook' },
  fliff:            { bookmakerName: 'Fliff',                  sourceRegion: 'us2',   sourceType: 'sportsbook' },
  hardrock_bet:     { bookmakerName: 'Hard Rock Bet',          sourceRegion: 'us2',   sourceType: 'sportsbook' },
  hardrockbet:      { bookmakerName: 'Hard Rock Bet',          sourceRegion: 'us2',   sourceType: 'sportsbook' },
  hardrockbet_az:   { bookmakerName: 'Hard Rock Bet (AZ)',     sourceRegion: 'us2',   sourceType: 'sportsbook' },
  tipico_us:        { bookmakerName: 'Tipico (US)',            sourceRegion: 'us2',   sourceType: 'sportsbook' },
  betanysports:     { bookmakerName: 'BetAnySports',           sourceRegion: 'us2',   sourceType: 'sportsbook' },
  betr_us:          { bookmakerName: 'Betr (US)',              sourceRegion: 'us2',   sourceType: 'sportsbook' },
  pinnacle:         { bookmakerName: 'Pinnacle',               sourceRegion: 'us2',   sourceType: 'sportsbook' },
  betparx:          { bookmakerName: 'betParx',                sourceRegion: 'us2',   sourceType: 'sportsbook' },
  ballybet:         { bookmakerName: 'Bally Bet',              sourceRegion: 'us2',   sourceType: 'sportsbook' },
  rebet:            { bookmakerName: 'Rebet',                  sourceRegion: 'us2',   sourceType: 'sportsbook' },

  // --- us_ex region: exchanges and prediction markets ---
  betfair_ex_us:    { bookmakerName: 'Betfair Exchange (US)',  sourceRegion: 'us_ex', sourceType: 'exchange' },
  sporttrade:       { bookmakerName: 'Sporttrade',             sourceRegion: 'us_ex', sourceType: 'exchange' },
  kalshi:           { bookmakerName: 'Kalshi',                 sourceRegion: 'us_ex', sourceType: 'exchange' },
  novig:            { bookmakerName: 'Novig',                  sourceRegion: 'us_ex', sourceType: 'exchange' },
  polymarket:       { bookmakerName: 'Polymarket',             sourceRegion: 'us_ex', sourceType: 'exchange' },
  prophetx:         { bookmakerName: 'ProphetX',               sourceRegion: 'us_ex', sourceType: 'exchange' },
  betopenly:        { bookmakerName: 'BetOpenly',              sourceRegion: 'us_ex', sourceType: 'exchange' },
}

export function lookupBookmaker(key) {
  return CATALOG[key] || null
}

export function getSourceType(key) {
  return CATALOG[key]?.sourceType || 'unknown'
}

export function getSourceRegion(key) {
  return CATALOG[key]?.sourceRegion || 'unknown'
}

/**
 * Comparator for deterministic bookmaker ordering:
 * sportsbooks first, then exchanges, then unknown — alphabetically within each group.
 */
export function bookmakerSortComparator(a, b) {
  const typeOrder = { sportsbook: 0, exchange: 1, unknown: 2 }
  const aOrder = typeOrder[a.sourceType] ?? 2
  const bOrder = typeOrder[b.sourceType] ?? 2
  if (aOrder !== bOrder) return aOrder - bOrder
  return (a.bookmakerName || '').localeCompare(b.bookmakerName || '')
}
