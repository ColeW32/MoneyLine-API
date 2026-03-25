'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://mlapi.bet'
const LS_KEY = 'ml_admin_api_key'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface Endpoint {
  id: string
  category: string
  label: string
  method: string
  path: string
}

interface ResponseState {
  status: number
  ms: number
  body: string
}

async function fetchEndpoints(token: string): Promise<{ endpoints: Endpoint[]; categories: string[] } | null> {
  const res = await fetch('/api/admin/endpoints', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data.success ? data.data : null
}

async function fetchFirstActiveKey(token: string): Promise<string | null> {
  const res = await fetch('/api/manage/keys', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!data.success) return null
  const active = (data.data as { status: string; keyPrefix: string }[]).find((k) => k.status === 'active')
  return active?.keyPrefix ?? null
}

export default function ApiTesterPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('')

  const [route, setRoute] = useState('/v1/events?league=nfl')
  const [apiKey, setApiKey] = useState('')
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [method, setMethod] = useState<Method>('GET')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<ResponseState | null>(null)
  const responseRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      router.replace('/dashboard')
    }
  }, [loading, user, router])

  // Load endpoint list + attempt to restore saved API key
  useEffect(() => {
    if (loading || !user?.isAdmin) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Restore saved key from localStorage
      const saved = localStorage.getItem(LS_KEY)
      if (saved) {
        setApiKey(saved)
      } else {
        // Fetch key prefix as a hint (full key not stored server-side)
        const prefix = await fetchFirstActiveKey(session.access_token)
        if (prefix) setKeyHint(prefix)
      }

      const data = await fetchEndpoints(session.access_token)
      if (data) {
        setEndpoints(data.endpoints)
        setCategories(data.categories)
      }
    })()
  }, [loading, user])

  // Persist API key to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) localStorage.setItem(LS_KEY, apiKey)
  }, [apiKey])

  // When an endpoint is selected from the dropdown, populate route + method
  function handleEndpointSelect(id: string) {
    setSelectedEndpoint(id)
    const ep = endpoints.find((e) => e.id === id)
    if (ep) {
      setRoute(ep.path)
      setMethod(ep.method as Method)
    }
  }

  async function sendRequest() {
    if (!route.trim()) return
    setSending(true)
    setResponse(null)

    const path = route.startsWith('/') ? route : `/${route}`
    const url = `${API_BASE}${path}`
    const headers: Record<string, string> = {}
    if (apiKey.trim()) headers['x-api-key'] = apiKey.trim()
    if ((method === 'POST' || method === 'PATCH') && body.trim()) {
      headers['content-type'] = 'application/json'
    }

    const start = Date.now()
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: (method === 'POST' || method === 'PATCH') && body.trim() ? body : undefined,
      })
      const ms = Date.now() - start
      const text = await res.text()
      let pretty = text
      try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch { /* raw */ }
      setResponse({ status: res.status, ms, body: pretty })
    } catch (err) {
      setResponse({ status: 0, ms: Date.now() - start, body: String(err) })
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [response])

  if (loading) return <div className="text-zinc-400 text-sm">Loading...</div>

  const statusColor = !response ? ''
    : response.status >= 500 ? 'text-red-400'
    : response.status >= 400 ? 'text-yellow-400'
    : response.status >= 200 ? 'text-green-400'
    : 'text-zinc-400'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">API Tester</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Sending to <span className="font-mono text-zinc-300">{API_BASE}</span>
        </p>
      </div>

      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5 space-y-4">

        {/* Endpoint dropdown */}
        {categories.length > 0 && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Select Endpoint</label>
            <select
              value={selectedEndpoint}
              onChange={(e) => handleEndpointSelect(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-white/30"
            >
              <option value="">— or type a custom route below —</option>
              {categories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {endpoints
                    .filter((ep) => ep.category === cat)
                    .map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.method} {ep.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Method + Route */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Method &amp; Route</label>
          <div className="flex gap-3">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-white/30 w-28 shrink-0"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
            <input
              type="text"
              value={route}
              onChange={(e) => { setRoute(e.target.value); setSelectedEndpoint('') }}
              onKeyDown={(e) => e.key === 'Enter' && !sending && sendRequest()}
              placeholder="/v1/events?league=nfl"
              className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            API Key
            {keyHint && !apiKey && (
              <span className="ml-2 text-zinc-600 font-mono">(your key starts with {keyHint}...)</span>
            )}
          </label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ml_live_... (saved locally once entered)"
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Request body */}
        {(method === 'POST' || method === 'PATCH') && (
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Request Body (JSON)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="{}"
              rows={4}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono placeholder-zinc-600 focus:outline-none focus:border-white/30 resize-y"
            />
          </div>
        )}

        <button
          onClick={sendRequest}
          disabled={sending || !route.trim()}
          className="px-5 py-2 bg-[#e8ff47] hover:bg-[#d4eb3f] text-[#1a1a1a] text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      {/* Response terminal */}
      {response !== null && (
        <div className="bg-[#0a0c10] rounded-xl border border-white/5 overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 bg-[#0f1117]">
            <span className={`text-sm font-mono font-bold ${statusColor}`}>
              {response.status === 0 ? 'ERROR' : `HTTP ${response.status}`}
            </span>
            <span className="text-xs text-zinc-500">{response.ms}ms</span>
          </div>
          <pre
            ref={responseRef}
            className="p-5 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed max-h-[60vh] overflow-y-auto"
          >
            {response.body}
          </pre>
        </div>
      )}
    </div>
  )
}
