import 'dotenv/config'
import { connectDB, closeDB, getCollection } from '../src/db.js'
import { sha256 } from '../src/utils/hash.js'

function readArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag)
  if (index === -1) return fallback
  return process.argv[index + 1] || fallback
}

async function main() {
  const tier = readArg('--tier', process.env.ML_TEST_API_TIER || 'pro')
  const rawKey = readArg('--key', process.env.ML_TEST_API_KEY || `ml_test_${tier}_local`)
  const name = readArg('--name', `Local ${tier} smoke key`)
  const userId = readArg('--user', `local-dev-${tier}`)

  await connectDB()

  const hashed = sha256(rawKey)
  await getCollection('api_keys').updateOne(
    { keyPrefix: rawKey.substring(0, 16) },
    {
      $set: {
        key: hashed,
        keyPrefix: rawKey.substring(0, 16),
        userId,
        tier,
        name,
        requestCount: 0,
        monthlyRequests: 0,
        status: 'active',
        createdAt: new Date(),
        lastUsedAt: null,
      },
    },
    { upsert: true }
  )

  console.log('[dev:key] Ready')
  console.log(`  tier: ${tier}`)
  console.log(`  key:  ${rawKey}`)
  console.log('\nUse it in Cursor terminal:')
  console.log(`  export ML_TEST_API_KEY=${rawKey}`)
  console.log('  npm run smoke:api')

  await closeDB()
}

main().catch(async (err) => {
  console.error('[dev:key] Failed:', err.message)
  await closeDB().catch(() => {})
  process.exit(1)
})
