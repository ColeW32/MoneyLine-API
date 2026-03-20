import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

import { connectDB } from './db.js'
import { validateApiKey } from './middleware/auth.js'
import { rateLimit } from './middleware/rateLimit.js'
import { registerTierGate } from './middleware/tierGate.js'
import { logUsage } from './middleware/logUsage.js'

import leagueRoutes from './routes/leagues.js'
import teamRoutes from './routes/teams.js'
import playerRoutes from './routes/players.js'
import eventRoutes from './routes/events.js'
import oddsRoutes from './routes/odds.js'
import edgeRoutes from './routes/edge.js'
import manageRoutes from './routes/manage.js'
import { startScheduler } from './ingestion/scheduler.js'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
})

// --- Plugins ---
await fastify.register(cors, { origin: true })
await fastify.register(helmet, { global: true })

// --- Tier gate (must register before routes) ---
registerTierGate(fastify)

// --- Global hooks ---
// Auth + rate limiting on all /v1 routes
fastify.addHook('onRequest', async (request, reply) => {
  if (!request.url.startsWith('/v1')) return
  await validateApiKey(request, reply)
  if (reply.sent) return
  await rateLimit(request, reply)
})

// Usage logging (fires after response is sent)
fastify.addHook('onResponse', logUsage)

// --- Routes ---
await fastify.register(manageRoutes) // /auth/* and /manage/* (JWT-auth'd, not API-key-auth'd)
await fastify.register(leagueRoutes)
await fastify.register(teamRoutes)
await fastify.register(playerRoutes)
await fastify.register(eventRoutes)
await fastify.register(oddsRoutes)
await fastify.register(edgeRoutes)

// --- Health check ---
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

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
