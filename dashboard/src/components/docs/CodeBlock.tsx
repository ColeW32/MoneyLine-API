'use client'

import { useState } from 'react'

type Language = 'curl' | 'javascript' | 'python'

interface CodeBlockProps {
  code: string | Record<Language, string>
  title?: string
}

export function CodeBlock({ code, title }: CodeBlockProps) {
  const isMulti = typeof code === 'object'
  const languages = isMulti ? (Object.keys(code) as Language[]) : []
  const [lang, setLang] = useState<Language>(languages[0] || 'curl')
  const [copied, setCopied] = useState(false)

  const raw = isMulti ? code[lang] : code

  function copy() {
    navigator.clipboard.writeText(raw)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#222] bg-[#0f0f0f] my-4">
      {(title || isMulti) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#222] bg-[#0a0a0a]">
          {title && <span className="text-[11px] font-medium text-[#666] uppercase tracking-wider">{title}</span>}
          {isMulti && (
            <div className="flex gap-1 ml-auto">
              {languages.map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                    l === lang ? 'bg-[#222] text-white' : 'text-[#666] hover:text-[#999]'
                  }`}
                >
                  {l === 'javascript' ? 'JS' : l === 'curl' ? 'cURL' : 'Python'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <button
          onClick={copy}
          className="absolute top-3 right-3 text-[#555] hover:text-white transition-colors"
          title="Copy"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
        <pre className="p-4 text-[13px] font-mono overflow-x-auto leading-relaxed">
          <code>
            {raw.split('\n').map((line, i) => (
              <span key={i}>
                {colorize(line)}
                {'\n'}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}

function colorize(line: string) {
  if (line.trimStart().startsWith('//') || line.trimStart().startsWith('#')) {
    return <span className="text-[#666]">{line}</span>
  }
  if (line.trimStart().startsWith('GET') || line.trimStart().startsWith('POST') || line.trimStart().startsWith('DELETE')) {
    const method = line.trimStart().split(' ')[0]
    const rest = line.slice(line.indexOf(method) + method.length)
    return (
      <span>
        <span className="text-[#7dd3fc]">{method}</span>
        <span className="text-[#86efac]">{rest}</span>
      </span>
    )
  }
  if (line.includes('curl') || line.includes('fetch') || line.includes('import') || line.includes('requests')) {
    return <span className="text-[#c4b5fd]">{line}</span>
  }

  return line.split(/("(?:[^"\\]|\\.)*")/g).map((part, i) => {
    if (i % 2 === 1) {
      if (part.startsWith('"x-api-key') || part.startsWith('"Content-Type') || part.startsWith('"Authorization')) {
        return <span key={i} className="text-[#fb923c]">{part}</span>
      }
      if (part.includes('/v1/') || part.includes('http') || part.includes('api.moneylineapi.com')) {
        return <span key={i} className="text-[#86efac]">{part}</span>
      }
      return <span key={i} className="text-[#fb923c]">{part}</span>
    }
    return <span key={i} className="text-[#9ca3af]">{part}</span>
  })
}
