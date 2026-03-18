'use client'

import { useEffect, useState } from 'react'
import { listKeys, createKey, revokeKey, type ApiKey } from '@/lib/api'

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newRawKey, setNewRawKey] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    try {
      const res = await listKeys()
      setKeys(res.data)
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const res = await createKey(newKeyName || 'Default')
      setNewRawKey(res.data.rawKey)
      setNewKeyName('')
      loadKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    try {
      await revokeKey(keyId)
      loadKeys()
    } catch {}
  }

  function copyKey() {
    navigator.clipboard.writeText(newRawKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">API Keys</h1>

      {/* New key created banner */}
      {newRawKey && (
        <div className="bg-[#e8ff47]/10 border border-[#e8ff47]/30 rounded-xl p-5">
          <p className="text-sm text-[#e8ff47] font-medium mb-2">
            Your new API key (copy it now — it won&apos;t be shown again):
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-[#0a0b0f] text-[#e8ff47] px-3 py-2 rounded-lg font-mono text-sm border border-white/5 break-all">
              {newRawKey}
            </code>
            <button onClick={copyKey} className="shrink-0 border border-[#e8ff47]/30 text-[#e8ff47] px-4 py-2 rounded-lg text-sm hover:bg-[#e8ff47]/10 transition-colors">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewRawKey('')}
            className="mt-2 text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create key form */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Create New Key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., My App, Production)"
            className="flex-1 h-10 px-3 rounded-lg border border-white/10 bg-[#0f1117] text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#e8ff47]/20 focus:border-[#e8ff47]/40 transition-colors"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 h-10 rounded-lg bg-[#e8ff47] text-[#1a1a1a] text-sm font-medium hover:bg-[#d4eb3f] disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {/* Keys list */}
      <div className="bg-[#1a1d27] rounded-xl border border-white/5 p-5">
        <h2 className="text-white font-semibold text-sm mb-4">Your Keys</h2>
        {keys.length === 0 ? (
          <p className="text-zinc-500 text-sm">No API keys yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 bg-[#0f1117] rounded-lg border border-white/5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{key.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      key.status === 'active'
                        ? 'border-[#e8ff47]/30 text-[#e8ff47]'
                        : 'border-red-500/30 text-red-400'
                    }`}>
                      {key.status}
                    </span>
                  </div>
                  <code className="text-xs text-zinc-500 font-mono">
                    {key.keyPrefix}{'••••••••••••••••••••••••'}
                  </code>
                  <p className="text-xs text-zinc-600">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                  </p>
                </div>
                {key.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="text-red-400 hover:text-red-300 text-xs hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
