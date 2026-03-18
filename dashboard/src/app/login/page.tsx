'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen ml-page-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-[#1a1a1a]">
          Money <span className="font-light">\</span> Line
        </Link>
      </nav>

      {/* Split layout */}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12 sm:py-20 flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
        {/* Left — marketing copy */}
        <div className="flex-1 max-w-lg">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#6b7280] mb-4">
            Welcome back
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] leading-[1.1] mb-6">
            Sign in to your{' '}
            <span className="underline decoration-[#e8ff47] decoration-4 underline-offset-4">
              MoneyLine
            </span>
            {' '}account.
          </h1>
          <p className="text-[#4a4a4a] text-base leading-relaxed">
            Access your API keys, usage analytics, and account settings.
            Manage your integration from one dashboard.
          </p>
        </div>

        {/* Right — login form card */}
        <div className="w-full lg:w-[440px] bg-white rounded-2xl border border-[#e0e0e0] p-8 shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Sign in</h2>
              <p className="text-sm text-[#6b7280] mt-1">
                Enter your credentials to continue.
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 ml-4 text-xs border border-[#e0e0e0] rounded-full px-4 py-2 text-[#1a1a1a] hover:bg-[#f5f4f0] transition-colors whitespace-nowrap"
            >
              New here?<br />Sign up
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#1a1a1a]">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full h-11 px-4 rounded-lg border border-[#e0e0e0] bg-white text-[#1a1a1a] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 focus:border-[#1a1a1a] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-[#1a1a1a]">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="w-full h-11 px-4 rounded-lg border border-[#e0e0e0] bg-white text-[#1a1a1a] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 focus:border-[#1a1a1a] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in \u2192'}
            </button>

            <p className="text-center text-xs text-[#9ca3af]">
              Secure by design &middot; Your data never leaves our infrastructure.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
