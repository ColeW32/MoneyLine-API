import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

import { connectDB } from './db.js'
import { validateApiKey } from './middleware/auth.js'
import { perMinuteRateLimit } from './middleware/rateLimit.js'
import { creditCheck } from './middleware/creditCheck.js'
import { registerTierGate } from './middleware/tierGate.js'
import { logUsage } from './middleware/logUsage.js'

import leagueRoutes from './routes/leagues.js'
import teamRoutes from './routes/teams.js'
import playerRoutes from './routes/players.js'
import playerPropsRoutes from './routes/playerProps.js'
import eventRoutes from './routes/events.js'
import oddsRoutes from './routes/odds.js'
import edgeRoutes from './routes/edge.js'
import bestBetsRoutes from './routes/bestBets.js'
import manageRoutes from './routes/manage.js'
import billingRoutes from './routes/billing.js'
import { startScheduler } from './ingestion/scheduler.js'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
})

// --- Plugins ---
const DASHBOARD_ORIGINS = [
  'https://moneylineapp.com',
  'https://www.moneylineapp.com',
  'http://localhost:3001',
]

await fastify.register(cors, {
  origin: true,        // /v1 is a public API — open to all origins
  credentials: true,   // allow cookies/auth headers from dashboard
})

// Block browser requests to dashboard routes from unknown origins
fastify.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/manage') && !request.url.startsWith('/auth')) return
  const origin = request.headers.origin
  if (origin && !DASHBOARD_ORIGINS.includes(origin)) {
    return reply.code(403).send({ success: false, error: { message: 'Forbidden', statusCode: 403 } })
  }
})
await fastify.register(helmet, { global: true })

// --- Tier gate (must register before routes) ---
registerTierGate(fastify)

// --- Global hooks ---
// Auth + rate limiting + credit check on all /v1 routes
fastify.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/v1')) return
  await validateApiKey(request, reply)
  if (reply.sent) return
  await perMinuteRateLimit(request, reply)
  if (reply.sent) return
  await creditCheck(request, reply)
})

// Usage logging (fires after response is sent)
fastify.addHook('onResponse', logUsage)

// --- Routes ---
await fastify.register(manageRoutes) // /auth/* and /manage/* (JWT-auth'd, not API-key-auth'd)
await fastify.register(billingRoutes) // /manage/billing/* (JWT-auth'd)
await fastify.register(leagueRoutes)
await fastify.register(teamRoutes)
await fastify.register(playerRoutes)
await fastify.register(playerPropsRoutes)
await fastify.register(eventRoutes)
await fastify.register(oddsRoutes)
await fastify.register(edgeRoutes)
await fastify.register(bestBetsRoutes)

// --- Health check ---
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// --- LLM reference ---
const __dirname = dirname(fileURLToPath(import.meta.url))
const llmsTxt = readFileSync(join(__dirname, 'llms.txt'), 'utf-8')
fastify.get('/llms.txt', async (_request, reply) => {
  reply.type('text/plain; charset=utf-8').send(llmsTxt)
})

// --- Error handler ---
fastify.setErrorHandler((err, request, reply) => {
  fastify.log.error(err)
  reply.code(err.statusCode || 500).send({
    success: false,
    data: null,
    meta: { requestId: `ml_req_err` },
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      statusCode: err.statusCode || 500,
    },
  })
})

// --- Start ---
async function start() {
  try {
    await connectDB()

    const port = parseInt(process.env.PORT || process.env.API_PORT) || 3000
    const host = (process.env.NODE_ENV === 'production' || process.env.PORT) ? '0.0.0.0' : '127.0.0.1'

    await fastify.listen({ port, host })
    console.log(`[server] MoneyLine API running on http://${host}:${port}`)

    // Start ingestion scheduler
    startScheduler()
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
