import { ROUTE_PERMISSIONS } from '../config/routes.js'
import { tierMeetsMinimum } from '../config/tiers.js'
import { error } from '../utils/response.js'

/**
 * Fastify onRoute hook that injects tier-checking preHandler
 * for any route listed in ROUTE_PERMISSIONS.
 */
export function registerTierGate(fastify) {
  fastify.addHook('onRoute', (routeOptions) => {
    const routePattern = routeOptions.url
    const requiredTier = ROUTE_PERMISSIONS[routePattern]

    if (!requiredTier) return // no restriction

    // Prepend a preHandler that checks tier
    const existing = routeOptions.preHandler || []
    const handlers = Array.isArray(existing) ? existing : [existing]

    routeOptions.preHandler = [
      ...handlers,
      async (request, reply) => {
        const userTier = request.apiKey?.tier || 'free'
        if (!tierMeetsMinimum(userTier, requiredTier)) {
          return reply.code(403).send(
            error(
              `This endpoint requires ${requiredTier} tier or higher. Your current tier: ${userTier}.`,
              403
            )
          )
        }
      },
    ]
  })
}
