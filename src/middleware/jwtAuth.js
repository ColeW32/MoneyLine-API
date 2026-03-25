import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getCollection } from '../db.js'
import { error } from '../utils/response.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean)

// Lazily initialised — avoids crash on startup if SUPABASE_URL is not yet set
let _jwks
function getJWKS() {
  if (!_jwks) {
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not configured')
    _jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  }
  return _jwks
}

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
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: `${SUPABASE_URL}/auth/v1`,
    })

    const supabaseId = payload.sub
    const email = payload.email
    const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)

    // Find or create user record in MongoDB
    let user = await getCollection('users').findOne({ supabaseId })

    if (!user) {
      const doc = {
        supabaseId,
        email,
        tier: 'free',
        isAdmin,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const result = await getCollection('users').insertOne(doc)
      user = { ...doc, _id: result.insertedId }
    } else if (user.isAdmin !== isAdmin) {
      await getCollection('users').updateOne({ supabaseId }, { $set: { isAdmin } })
      user = { ...user, isAdmin }
    }

    request.user = user
  } catch (err) {
    return reply.code(401).send(error('Invalid or expired token.', 401))
  }
}
