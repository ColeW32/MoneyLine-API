import { MongoClient } from 'mongodb'

let client
let db

export async function connectDB() {
  if (db) return db

  client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  db = client.db(process.env.MONGODB_DB_NAME || 'moneyline')

  console.log('[db] Connected to MongoDB')
  return db
}

export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.')
  return db
}

export function getCollection(name) {
  return getDB().collection(name)
}

export async function closeDB() {
  if (client) {
    await client.close()
    client = null
    db = null
  }
}
