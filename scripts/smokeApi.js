import 'dotenv/config'

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'

function color(text, code) {
  return `${code}${text}${RESET}`
}

function readArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return fallback
  return process.argv[index + 1] || fallback
}

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function formatBody(body) {
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body, null, 2)
  } catch {
    return String(body)
  }
}

async function request(baseUrl, path, { key, expectedStatus = 200 } = {}) {
  const url = `${baseUrl}${path}`
  const started = Date.now()

  try {
    const res = await fetch(url, {
      headers: key ? { 'x-api-key': key } : {},
    })

    const durationMs = Date.now() - started
    const contentType = res.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await res.json()
      : await res.text()

    return {
      ok: res.status === expectedStatus,
      status: res.status,
      durationMs,
      url,
      body,
    }
  } catch (err) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - started,
      url,
      error: err,
      body: null,
    }
  }
}

function printResult(label, result, { allowFailure = false, showBody = false } = {}) {
  if (result.ok) {
    console.log(`${color('PASS', GREEN)} ${label} ${color(`${result.status} ${result.durationMs}ms`, CYAN)}`)
    if (showBody) {
      console.log(formatBody(result.body))
      console.log()
    }
    return true
  }

  const statusLabel = result.status == null ? 'request failed' : String(result.status)
  const prefix = allowFailure ? color('WARN', YELLOW) : color('FAIL', RED)
  console.log(`${prefix} ${label} ${color(`${statusLabel} ${result.durationMs}ms`, CYAN)}`)

  if (result.error) {
    console.log(`      ${result.error.message}`)
  } else if (result.body?.error?.message) {
    console.log(`      ${result.body.error.message}`)
  }

  if (showBody && result.body != null) {
    console.log(formatBody(result.body))
    console.log()
  }

  return allowFailure
}

function toArrayResponse(body) {
  return Array.isArray(body?.data) ? body.data : []
}

async function main() {
  const port = process.env.PORT || process.env.API_PORT || '3000'
  const envKey = process.env.ML_LIVE_API_KEY || process.env.ML_API_KEY || process.env.ML_TEST_API_KEY || null
  const inferredBaseUrl = process.env.ML_LIVE_API_KEY
    ? 'https://mlapi.bet'
    : `http://127.0.0.1:${port}`
  const baseUrl = readArg('--base-url', process.env.API_SMOKE_BASE_URL || inferredBaseUrl)
  const key = readArg('--key', envKey)
  const league = readArg('--league', 'nba')
  const verbose = hasFlag('--verbose')
  const showBody = hasFlag('--show-body')

  console.log(color('\nMoneyLine API smoke test\n', BOLD))
  console.log(`  baseUrl: ${baseUrl}`)
  console.log(`  league:  ${league}`)

  if (!key) {
    console.log(color('\nNo API key provided.\n', YELLOW))
    console.log('Run this first in Cursor terminal:')
    console.log("  export ML_LIVE_API_KEY='ml_live_...'\n  npm run smoke:api")
    console.log('\nOr for local-only testing:')
    console.log('  npm run dev:key -- --tier pro')
    console.log('  export ML_TEST_API_KEY=ml_test_pro_local')
    console.log('  npm run smoke:api')
    process.exit(1)
  }

  let failed = false

  const health = await request(baseUrl, '/health', { expectedStatus: 200 })
  failed = !printResult('GET /health', health, { showBody }) || failed
  if (!health.ok) process.exit(1)

  const events = await request(baseUrl, `/v1/events?league=${league}&limit=5`, { key })
  failed = !printResult('GET /v1/events', events, { showBody }) || failed
  const eventRows = toArrayResponse(events.body)

  const booksAll = await request(baseUrl, '/v1/odds/bookmakers?sourceType=all', { key })
  failed = !printResult('GET /v1/odds/bookmakers?sourceType=all', booksAll, { showBody }) || failed

  const booksDfs = await request(baseUrl, '/v1/odds/bookmakers?sourceType=dfs', { key })
  failed = !printResult('GET /v1/odds/bookmakers?sourceType=dfs', booksDfs, { showBody }) || failed

  const booksExchange = await request(baseUrl, '/v1/odds/bookmakers?sourceType=exchange', { key })
  failed = !printResult('GET /v1/odds/bookmakers?sourceType=exchange', booksExchange, { showBody }) || failed

  const oddsAll = await request(baseUrl, `/v1/odds?league=${league}&limit=5&sourceType=all`, { key })
  failed = !printResult('GET /v1/odds?sourceType=all', oddsAll, { showBody }) || failed
  const oddsRows = toArrayResponse(oddsAll.body)
  const eventId = readArg('--event', null) || oddsRows[0]?.eventId || eventRows[0]?.eventId || null

  const oddsDfs = await request(baseUrl, `/v1/odds?league=${league}&limit=5&sourceType=dfs`, { key })
  failed = !printResult('GET /v1/odds?sourceType=dfs', oddsDfs, { showBody }) || failed

  const oddsExchange = await request(baseUrl, `/v1/odds?league=${league}&limit=5&sourceType=exchange`, { key })
  failed = !printResult('GET /v1/odds?sourceType=exchange', oddsExchange, { showBody }) || failed

  const playerPropOdds = await request(baseUrl, `/v1/odds?league=${league}&limit=5&sourceType=all&market=player_points`, { key })
  failed = !printResult('GET /v1/odds?market=player_points', playerPropOdds, { showBody }) || failed

  const playerPropMarkets = await request(baseUrl, `/v1/player-props/markets?league=${league}`, { key })
  failed = !printResult('GET /v1/player-props/markets', playerPropMarkets, { showBody }) || failed

  const playerProps = await request(baseUrl, `/v1/player-props?league=${league}&market=player_points&sourceType=all&limit=5`, { key })
  failed = !printResult('GET /v1/player-props?market=player_points', playerProps, { showBody }) || failed

  const trendingPlayers = await request(baseUrl, `/v1/players/trending?league=${league}&market=player_points&sortBy=l5&limit=10`, { key })
  printResult('GET /v1/players/trending', trendingPlayers, { allowFailure: true, showBody })

  const playerTrends = await request(baseUrl, `/v1/players/trends?league=${league}&window=25&limit=10`, { key })
  printResult('GET /v1/players/trends', playerTrends, { allowFailure: true, showBody })

  if (eventId) {
    const eventOddsAll = await request(baseUrl, `/v1/events/${eventId}/odds?sourceType=all`, { key })
    failed = !printResult(`GET /v1/events/${eventId}/odds?sourceType=all`, eventOddsAll, { showBody }) || failed

    const eventOddsDfs = await request(baseUrl, `/v1/events/${eventId}/odds?sourceType=dfs`, { key })
    failed = !printResult(`GET /v1/events/${eventId}/odds?sourceType=dfs`, eventOddsDfs, { showBody }) || failed

    const eventOddsExchange = await request(baseUrl, `/v1/events/${eventId}/odds?sourceType=exchange`, { key })
    failed = !printResult(`GET /v1/events/${eventId}/odds?sourceType=exchange`, eventOddsExchange, { showBody }) || failed

    const eventPlayerProps = await request(baseUrl, `/v1/events/${eventId}/player-props?sourceType=all`, { key })
    printResult(`GET /v1/events/${eventId}/player-props?sourceType=all`, eventPlayerProps, { allowFailure: true, showBody })

    const eventEdge = await request(baseUrl, `/v1/events/${eventId}/edge?sourceType=all`, { key, expectedStatus: 200 })
    printResult(`GET /v1/events/${eventId}/edge?sourceType=all`, eventEdge, { allowFailure: true, showBody })
  } else {
    console.log(`${color('WARN', YELLOW)} no eventId discovered; skipping event-specific checks`)
  }

  const bestBets = await request(baseUrl, `/v1/best-bets?league=${league}&limit=5`, { key })
  failed = !printResult('GET /v1/best-bets', bestBets, { showBody }) || failed

  const bestBetsDk = await request(baseUrl, `/v1/best-bets?league=${league}&bookmaker=draftkings&limit=5`, { key })
  failed = !printResult('GET /v1/best-bets?bookmaker=draftkings', bestBetsDk, { showBody }) || failed

  if (eventId) {
    const eventBestBets = await request(baseUrl, `/v1/events/${eventId}/best-bets`, { key, expectedStatus: 200 })
    printResult(`GET /v1/events/${eventId}/best-bets`, eventBestBets, { allowFailure: true, showBody })
  }

  const edgeAll = await request(baseUrl, `/v1/edge?league=${league}&sourceType=all&limit=10`, { key })
  failed = !printResult('GET /v1/edge?sourceType=all', edgeAll, { showBody }) || failed

  const edgeDfs = await request(baseUrl, `/v1/edge?league=${league}&sourceType=dfs&limit=10`, { key })
  failed = !printResult('GET /v1/edge?sourceType=dfs', edgeDfs, { showBody }) || failed

  const edgeArb = await request(baseUrl, `/v1/edge/arbitrage?league=${league}&sourceType=all`, { key })
  failed = !printResult('GET /v1/edge/arbitrage?sourceType=all', edgeArb, { showBody }) || failed

  const edgeValue = await request(baseUrl, `/v1/edge/value?league=${league}&sourceType=all`, { key })
  failed = !printResult('GET /v1/edge/value?sourceType=all', edgeValue, { showBody }) || failed

  const edgeEv = await request(baseUrl, `/v1/edge/ev?league=${league}&sourceType=all`, { key })
  failed = !printResult('GET /v1/edge/ev?sourceType=all', edgeEv, { showBody }) || failed

  if (verbose) {
    const dfsBooks = toArrayResponse(booksDfs.body)
    const exchangeBooks = toArrayResponse(booksExchange.body)
    const edgeRows = toArrayResponse(edgeAll.body)

    console.log('\nSummary')
    console.log(`  DFS books:       ${dfsBooks.length}`)
    console.log(`  Exchange books:  ${exchangeBooks.length}`)
    console.log(`  Events returned: ${eventRows.length}`)
    console.log(`  Edge docs:       ${edgeRows.length}`)
  }

  console.log()
  if (failed) {
    console.log(color('Smoke test finished with failures.', RED))
    process.exit(1)
  }

  console.log(color('Smoke test passed.', GREEN))
}

main().catch((err) => {
  console.error(color(`[smoke:api] Failed: ${err.message}`, RED))
  process.exit(1)
})
