import { Redis } from '@upstash/redis'

let redis
let warnedFallback = false

class InMemoryPipeline {
  constructor(store) {
    this.store = store
    this.ops = []
  }

  zremrangebyscore(key, min, max) {
    this.ops.push(() => this.store.zremrangebyscore(key, min, max))
    return this
  }

  zadd(key, entry) {
    this.ops.push(() => this.store.zadd(key, entry))
    return this
  }

  zcard(key) {
    this.ops.push(() => this.store.zcard(key))
    return this
  }

  expire(key, ttlSeconds) {
    this.ops.push(() => this.store.expire(key, ttlSeconds))
    return this
  }

  async exec() {
    const results = []
    for (const op of this.ops) {
      results.push(await op())
    }
    return results
  }
}

class InMemoryRedis {
  constructor() {
    this.kv = new Map()
    this.sortedSets = new Map()
    this.expirations = new Map()
  }

  cleanup(key) {
    const expiry = this.expirations.get(key)
    if (expiry && expiry <= Date.now()) {
      this.kv.delete(key)
      this.sortedSets.delete(key)
      this.expirations.delete(key)
    }
  }

  async get(key) {
    this.cleanup(key)
    return this.kv.has(key) ? this.kv.get(key) : null
  }

  async set(key, value, options = {}) {
    this.kv.set(key, value)
    if (options.ex) {
      this.expirations.set(key, Date.now() + (options.ex * 1000))
    } else {
      this.expirations.delete(key)
    }
    return 'OK'
  }

  async incr(key) {
    this.cleanup(key)
    const current = Number(this.kv.get(key) || 0)
    const next = current + 1
    this.kv.set(key, next)
    return next
  }

  async expire(key, ttlSeconds) {
    if (!this.kv.has(key) && !this.sortedSets.has(key)) return 0
    this.expirations.set(key, Date.now() + (ttlSeconds * 1000))
    return 1
  }

  zremrangebyscore(key, min, max) {
    this.cleanup(key)
    const items = this.sortedSets.get(key) || []
    const next = items.filter((item) => item.score < min || item.score > max)
    this.sortedSets.set(key, next)
    return items.length - next.length
  }

  zadd(key, entry) {
    this.cleanup(key)
    const items = this.sortedSets.get(key) || []
    items.push(entry)
    this.sortedSets.set(key, items)
    return 1
  }

  zcard(key) {
    this.cleanup(key)
    return (this.sortedSets.get(key) || []).length
  }

  pipeline() {
    return new InMemoryPipeline(this)
  }
}

export function getRedis() {
  if (!redis) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    } else {
      redis = new InMemoryRedis()
      if (!warnedFallback) {
        warnedFallback = true
        console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN not set; using in-memory Redis fallback for local dev')
      }
    }
  }
  return redis
}
