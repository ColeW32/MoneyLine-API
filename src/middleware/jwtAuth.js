import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getCollection } from '../db.js'
import { error } from '../utils/response.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

/**
 * Verify Supabase JWT via JWKS and auto-provision a MongoDB user record.
 * Extracts `sub` (Supabase user UUID) and `email` from the token.
 * On first request, creates a new user doc with tier='free'.
 */
export async function verifyJwt(request, reply) {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send(error('Authorization header required. Use: Bearer <token>', 401))
  }

  try {
    const token = header.slice(7)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
    })

    const supabaseId = payload.sub
    const email = payload.email

    // Find or create user record in MongoDB
    let user = await getCollection('users').findOne({ supabaseId })

    if (!user) {
      const doc = {
        supabaseId,
        email,
        tier: 'free',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const result = await getCollection('users').insertOne(doc)
      user = { ...doc, _id: result.insertedId }
    }

    request.user = user
  } catch (err) {
    return reply.code(401).send(error('Invalid or expired token.', 401))
  }
}
