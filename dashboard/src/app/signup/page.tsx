'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/api'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) { setError('Please agree to the Terms and Privacy Policy.'); return }
    setError('')
    setLoading(true)

    try {
      const data = await signUp(email, password)
      // If email confirmation is required, show success message
      if (!data.session) {
        setSuccess(true)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen ml-page-bg flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e0e0e0] p-8 text-center">
          <div className="text-3xl mb-4">&#x2709;</div>
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">Check your email</h2>
          <p className="text-sm text-[#6b7280]">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-[#1a1a1a] font-medium underline">
            Go to login
          </Link>
        </div>
      </div>
    )
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
            Get your API key
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] leading-[1.1] mb-6">
            You&apos;re one step away from{' '}
            <span className="underline decoration-[#e8ff47] decoration-4 underline-offset-4">
              getting your API key
            </span>
            .
          </h1>
          <p className="text-[#4a4a4a] text-base leading-relaxed mb-8">
            Create an account to start pulling normalized odds, props, EV
            and arbitrage signals, scores, and prediction markets from US
            sportsbooks and exchanges. No credit card required to get started.
          </p>
          <ul className="space-y-3 text-[#4a4a4a] text-sm">
            <li className="flex items-start gap-2">
              <span className="text-[#1a1a1a] mt-0.5">&middot;</span>
              1,000 free requests on the Starter tier
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#1a1a1a] mt-0.5">&middot;</span>
              Upgrade to Pro when you&apos;re ready — first 2 months free
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#1a1a1a] mt-0.5">&middot;</span>
              Designed for founders, developers, and traders building sports and betting products
            </li>
          </ul>
        </div>

        {/* Right — signup form card */}
        <div className="w-full lg:w-[440px] bg-white rounded-2xl border border-[#e0e0e0] p-8 shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#1a1a1a]">Create your MoneyLine account</h2>
              <p className="text-sm text-[#6b7280] mt-1">
                We&apos;ll generate an API key for you as soon as you finish signup.
              </p>
            </div>
            <Link
              href="/login"
              className="shrink-0 ml-4 text-xs border border-[#e0e0e0] rounded-full px-4 py-2 text-[#1a1a1a] hover:bg-[#f5f4f0] transition-colors whitespace-nowrap"
            >
              Have an account?<br />Log in
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-[#1a1a1a]">Work email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fund-or-company.com"
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
                placeholder="Create a strong password"
                required
                minLength={8}
                className="w-full h-11 px-4 rounded-lg border border-[#e0e0e0] bg-white text-[#1a1a1a] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 focus:border-[#1a1a1a] transition-colors"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#d1d5db] text-[#1a1a1a] focus:ring-[#1a1a1a]/20"
              />
              <span className="text-sm text-[#6b7280]">
                I agree to the{' '}
                <span className="text-[#1a1a1a] underline">Terms</span>
                {' '}and{' '}
                <span className="text-[#1a1a1a] underline">Privacy Policy</span>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#1a1a1a] text-white text-sm font-medium hover:bg-[#333] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account & get API key \u2192'}
            </button>

            <p className="text-center text-xs text-[#9ca3af]">
              Secure by design &middot; You can rotate or revoke keys anytime.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
