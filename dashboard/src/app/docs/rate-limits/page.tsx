import { CodeBlock } from '@/components/docs/CodeBlock'

export const metadata = {
  title: 'Rate Limits — MoneyLine API Docs',
  description: 'Understand the rate limits for each MoneyLine API plan tier and how to handle 429 responses.',
}

export default function RateLimitsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Rate Limits</h1>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-4">
        Every API key is subject to rate limits based on the plan tier it belongs to.
        Rate limits help ensure fair usage and keep the platform fast and reliable for
        everyone. If you need higher limits, consider upgrading your plan.
      </p>

      {/* Plan Limits Table */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Limits by Plan</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-4">
        The table below outlines the request allowances and feature access for each plan tier:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[#e0e0e0]">
        <table className="w-full text-[14px] text-left">
          <thead>
            <tr className="bg-[#f5f4f0] text-[#1a1a1a]">
              <th className="px-4 py-2.5 font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Requests/Month</th>
              <th className="px-4 py-2.5 font-semibold">Requests/Minute</th>
              <th className="px-4 py-2.5 font-semibold">Bookmakers</th>
              <th className="px-4 py-2.5 font-semibold">Edge Access</th>
            </tr>
          </thead>
          <tbody className="text-[#4a4a4a]">
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Free</td>
              <td className="px-4 py-2.5">1,000</td>
              <td className="px-4 py-2.5">5</td>
              <td className="px-4 py-2.5">None</td>
              <td className="px-4 py-2.5">No</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Hobbyist</td>
              <td className="px-4 py-2.5">50,000</td>
              <td className="px-4 py-2.5">30</td>
              <td className="px-4 py-2.5">1 per request</td>
              <td className="px-4 py-2.5">No</td>
            </tr>
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Pro</td>
              <td className="px-4 py-2.5">500,000</td>
              <td className="px-4 py-2.5">120</td>
              <td className="px-4 py-2.5">All</td>
              <td className="px-4 py-2.5">Yes</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Enterprise</td>
              <td className="px-4 py-2.5">Unlimited</td>
              <td className="px-4 py-2.5">Unlimited</td>
              <td className="px-4 py-2.5">All</td>
              <td className="px-4 py-2.5">Yes</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rate Limit Headers */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Rate Limit Headers</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-4">
        Every API response includes headers that tell you where you stand relative to
        your current rate limit window. Use these to build smart retry logic and avoid
        hitting limits:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[#e0e0e0]">
        <table className="w-full text-[14px] text-left">
          <thead>
            <tr className="bg-[#f5f4f0] text-[#1a1a1a]">
              <th className="px-4 py-2.5 font-semibold">Header</th>
              <th className="px-4 py-2.5 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#4a4a4a]">
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">X-RateLimit-Limit</td>
              <td className="px-4 py-2.5">Your per-minute request limit</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">X-RateLimit-Remaining</td>
              <td className="px-4 py-2.5">The number of requests remaining in the current window</td>
            </tr>
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">X-RateLimit-Reset</td>
              <td className="px-4 py-2.5">Seconds until the current rate limit window resets</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 429 Response */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Exceeding the Limit</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        If you exceed your rate limit, the API will return a{' '}
        <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">429 Too Many Requests</code>{' '}
        response. When this happens, wait for the window to reset before retrying.
        Check the <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">X-RateLimit-Reset</code>{' '}
        header to know exactly how long to wait.
      </p>

      <CodeBlock
        title="429 — Rate limit exceeded"
        code={`{
  "success": false,
  "error": {
    "code": 429,
    "message": "Rate limit exceeded. Please wait before making another request."
  }
}`}
      />
    </div>
  )
}
