'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mlapi.bet'

export default function LlmsPage() {
  const [copied, setCopied] = useState(false)

  async function handleDownload() {
    const res = await fetch(`${API_URL}/llms.txt`)
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'moneyline-api-reference.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${API_URL}/llms.txt`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">For AI &amp; LLMs</h1>
        <p className="text-[#6b7280] mt-2 text-sm leading-relaxed max-w-2xl">
          Give your AI assistant or coding LLM everything it needs to integrate with the
          MoneyLine API. Download a single reference file or point your tool at our{' '}
          <code className="text-xs bg-[#eae8e3] px-1.5 py-0.5 rounded font-mono">llms.txt</code>{' '}
          URL, including the full sportsbook, DFS, and exchange catalog.
        </p>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        {/* Download card */}
        <button
          onClick={handleDownload}
          className="group relative bg-[#1a1a1a] text-white rounded-xl p-5 text-left hover:bg-[#2a2a2a] transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Download .md file</p>
              <p className="text-xs text-zinc-400 mt-1">
                Save locally and paste into your LLM context
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0V15" />
            </svg>
          </div>
        </button>

        {/* Copy URL card */}
        <button
          onClick={handleCopy}
          className="group relative bg-[#f5f3ef] text-[#1a1a1a] rounded-xl p-5 text-left hover:bg-[#eae8e3] transition-colors border border-[#e0ded8]"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-[#6b7280]">
              {copied ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.072a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.5 8.688" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {copied ? 'Copied!' : 'Copy llms.txt URL'}
              </p>
              <p className="text-xs text-[#6b7280] mt-1">
                Point tools like Cursor, Claude, or Copilot directly
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* URL display */}
      <div className="max-w-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">
          URL
        </p>
        <div className="bg-[#f5f3ef] border border-[#e0ded8] rounded-lg px-4 py-3 font-mono text-sm text-[#1a1a1a] select-all">
          {API_URL}/llms.txt
        </div>
      </div>

      {/* What's included */}
      <div className="max-w-2xl">
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-3">What&apos;s included</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Authentication setup',
            'All 36 public API endpoints',
            'Query parameters & types',
            'Response shapes with examples',
            'Sportsbook, DFS, and exchange catalog',
            'Tier permissions & credit system',
            'Rate limit details',
            'Error codes & formats',
            'Quick-start curl examples',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-[#4a4a4a]">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth="2" className="shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* How to use */}
      <div className="max-w-2xl space-y-4">
        <h2 className="text-sm font-semibold text-[#1a1a1a]">How to use</h2>

        <div className="space-y-3">
          <div className="bg-[#f5f3ef] border border-[#e0ded8] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#1a1a1a] mb-1">Cursor / Windsurf / Claude Code</p>
            <p className="text-xs text-[#6b7280]">
              Download the file and add it to your project root, or paste the URL into your
              AI tool&apos;s context settings so it can fetch it automatically.
            </p>
          </div>

          <div className="bg-[#f5f3ef] border border-[#e0ded8] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#1a1a1a] mb-1">ChatGPT / Claude</p>
            <p className="text-xs text-[#6b7280]">
              Download the .md file and upload it as an attachment when starting a conversation
              about building with the MoneyLine API.
            </p>
          </div>

          <div className="bg-[#f5f3ef] border border-[#e0ded8] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#1a1a1a] mb-1">Custom agents</p>
            <p className="text-xs text-[#6b7280]">
              Have your agent fetch{' '}
              <code className="text-[10px] bg-[#e0ded8] px-1 py-0.5 rounded font-mono">{API_URL}/llms.txt</code>{' '}
              at runtime. It&apos;s always up-to-date and requires no authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
