'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface Heading {
  id: string
  text: string
  level: number
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const observerRef = useRef<IntersectionObserver | null>(null)
  const pathname = usePathname()

  // Scan the page for h2/h3 elements on mount and on route change
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const els = main.querySelectorAll('h2, h3')
    const found: Heading[] = []

    els.forEach((el) => {
      // Auto-generate id from text if missing
      if (!el.id) {
        el.id = el.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || ''
      }
      if (el.id) {
        found.push({
          id: el.id,
          text: el.textContent || '',
          level: el.tagName === 'H3' ? 3 : 2,
        })
      }
    })

    setHeadings(found)
    setActiveId(found[0]?.id || '')
  }, [pathname])

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    if (!headings.length) return

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible heading
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

      if (visible.length > 0) {
        setActiveId(visible[0].target.id)
      }
    }

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    })

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observerRef.current!.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [headings])

  if (!headings.length) return null

  return (
    <nav className="w-48 flex-shrink-0 pl-6">
      <div className="fixed w-48 pl-6 top-14 h-[calc(100vh-3.5rem)] overflow-y-auto pt-10 pb-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
          On this page
        </p>
        <ul className="space-y-1 border-l border-[#e0e0e0]">
          {headings.map((h) => {
            const active = activeId === h.id
            return (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    setActiveId(h.id)
                  }}
                  className={`block text-[12px] leading-snug py-1 transition-colors border-l-2 -ml-px ${
                    h.level === 3 ? 'pl-5' : 'pl-3'
                  } ${
                    active
                      ? 'border-[#1a1a1a] text-[#1a1a1a] font-medium'
                      : 'border-transparent text-[#6b7280] hover:text-[#4a4a4a] hover:border-[#ccc]'
                  }`}
                >
                  {h.text}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
