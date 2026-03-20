import 'dotenv/config'
import { connectDB, closeDB } from '../src/db.js'

async function migrate() {
  const db = await connectDB()
  console.log('[migrate] Starting credit system migration...')

  // 1. Rename hobbyist tier to starter in users collection
  const userResult = await db.collection('users').updateMany(
    { tier: 'hobbyist' },
    { $set: { tier: 'starter', updatedAt: new Date() } }
  )
  console.log(`  - Migrated ${userResult.modifiedCount} users from hobbyist → starter`)

  // 2. Rename hobbyist tier to starter in api_keys collection
  const keyResult = await db.collection('api_keys').updateMany(
    { tier: 'hobbyist' },
    { $set: { tier: 'starter' } }
  )
  console.log(`  - Migrated ${keyResult.modifiedCount} API keys from hobbyist → starter`)

  // 3. Add default billing fields to all users missing them
  const billingDefaults = {
    autoUpgrade: true,
    billingCycleAnchor: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    creditsUsedThisPeriod: 0,
    overageCredits: 0,
    cardOnFile: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  }

  const bulkOps = []
  const users = await db.collection('users').find({}).toArray()
  for (const user of users) {
    const updates = {}
    for (const [key, defaultVal] of Object.entries(billingDefaults)) {
      if (user[key] === undefined) {
        updates[key] = defaultVal
      }
    }
    if (Object.keys(updates).length > 0) {
      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { ...updates, updatedAt: new Date() } },
        },
      })
    }
  }

  if (bulkOps.length > 0) {
    const bulkResult = await db.collection('users').bulkWrite(bulkOps)
    console.log(`  - Added billing fields to ${bulkResult.modifiedCount} users`)
  } else {
    console.log('  - All users already have billing fields')
  }

  console.log('[migrate] Migration complete.')
  await closeDB()
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err)
  process.exit(1)
})
