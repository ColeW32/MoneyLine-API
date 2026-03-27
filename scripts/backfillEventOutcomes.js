import 'dotenv/config'
import { connectDB, closeDB, getCollection } from '../src/db.js'
import { deriveEventOutcome } from '../src/ingestion/normalizers/shared.js'

const args = process.argv.slice(2)

function parseListArg(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return null

  const value = args[index + 1]
  if (!value) return null

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

async function main() {
  const leagues = parseListArg('--league')

  await connectDB()

  try {
    const filter = {
      status: 'final',
      ...(leagues?.length ? { leagueId: { $in: leagues } } : {}),
    }

    const projection = {
      _id: 0,
      eventId: 1,
      leagueId: 1,
      status: 1,
      homeTeamId: 1,
      awayTeamId: 1,
      homeTeamName: 1,
      awayTeamName: 1,
      'scores.home': 1,
      'scores.away': 1,
    }

    const events = await getCollection('events').find(filter, { projection }).toArray()
    if (events.length === 0) {
      console.log('[backfill:event-outcomes] No final events matched the query')
      return
    }

    const ops = []
    let skipped = 0

    for (const event of events) {
      const outcome = deriveEventOutcome({
        status: event.status,
        homeTeamId: event.homeTeamId,
        awayTeamId: event.awayTeamId,
        homeTeamName: event.homeTeamName,
        awayTeamName: event.awayTeamName,
        homeScore: event.scores?.home,
        awayScore: event.scores?.away,
      })

      if (!Object.keys(outcome).length) {
        skipped++
        continue
      }

      ops.push({
        updateOne: {
          filter: { eventId: event.eventId },
          update: {
            $set: {
              ...outcome,
              updatedAt: new Date(),
            },
          },
        },
      })
    }

    if (ops.length > 0) {
      await getCollection('events').bulkWrite(ops, { ordered: false })
    }

    console.log(`[backfill:event-outcomes] Updated ${ops.length} final event(s); skipped ${skipped}`)
  } finally {
    await closeDB()
  }
}

main().catch((err) => {
  console.error(`[backfill:event-outcomes] Failed: ${err.message}`)
  process.exit(1)
})
