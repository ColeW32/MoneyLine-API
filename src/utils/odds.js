/**
 * Convert American odds to implied probability (0-1).
 */
export function americanToImplied(american) {
  if (american > 0) return 100 / (american + 100)
  return Math.abs(american) / (Math.abs(american) + 100)
}

/**
 * Convert American odds to decimal odds.
 */
export function americanToDecimal(american) {
  if (american > 0) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

/**
 * Kelly criterion fraction for optimal bet sizing.
 */
export function kellyFraction(prob, american) {
  const decimal = americanToDecimal(american)
  return ((prob * decimal) - 1) / (decimal - 1)
}
