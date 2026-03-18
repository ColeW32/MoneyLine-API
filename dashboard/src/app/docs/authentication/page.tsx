import { CodeBlock } from '@/components/docs/CodeBlock'

export const metadata = {
  title: 'Authentication — MoneyLine API Docs',
  description: 'Learn how to authenticate requests to the MoneyLine API using your API key.',
}

export default function AuthenticationPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Authentication</h1>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-4">
        All requests to the MoneyLine API must include a valid API key. Pass your key
        via the <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">x-api-key</code> header
        on every request. Requests without a valid key will be rejected with
        a <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">401</code> status code.
      </p>

      {/* Getting an API Key */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Getting an API Key</h2>

      <ol className="list-decimal list-inside text-[15px] text-[#4a4a4a] leading-relaxed space-y-2">
        <li>Create a free account on the <a href="/signup" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">sign-up page</a>.</li>
        <li>Open your <a href="/dashboard" className="underline underline-offset-2 hover:text-[#1a1a1a] transition-colors">dashboard</a>.</li>
        <li>Click <strong>Create Key</strong> to generate a new API key.</li>
      </ol>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-4">
        Your key will look something like <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">ml_live_abc123...</code>.
        Keep it secret &mdash; treat it like a password.
      </p>

      {/* Example Request */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Example Request</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        Include the <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">x-api-key</code> header
        with your key in every request:
      </p>

      <CodeBlock
        title="Authenticated request"
        code={{
          curl: `curl -H "x-api-key: ml_live_abc123..." \\\n  https://api.moneylineapi.com/v1/events/today`,
          javascript: `const res = await fetch("https://api.moneylineapi.com/v1/events/today", {\n  headers: { "x-api-key": "ml_live_abc123..." }\n})`,
          python: `import requests\n\nres = requests.get("https://api.moneylineapi.com/v1/events/today",\n  headers={"x-api-key": "ml_live_abc123..."})`,
        }}
      />

      {/* Tier Access Levels */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Tier Access Levels</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-4">
        The data you can access depends on your plan. Each tier unlocks additional
        endpoints and higher rate limits:
      </p>

      <div className="overflow-x-auto rounded-xl border border-[#e0e0e0]">
        <table className="w-full text-[14px] text-left">
          <thead>
            <tr className="bg-[#f5f2eb] text-[#1a1a1a]">
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Includes</th>
              <th className="px-4 py-3 font-semibold text-right">Rate Limit</th>
            </tr>
          </thead>
          <tbody className="text-[#4a4a4a]">
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-3 font-medium text-[#1a1a1a]">Free</td>
              <td className="px-4 py-3">Scores, standings, schedules, rosters</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">1,000 req/month</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-3 font-medium text-[#1a1a1a]">Hobbyist</td>
              <td className="px-4 py-3">+ Odds, injuries, bookmaker data</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">50,000 req/month</td>
            </tr>
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-3 font-medium text-[#1a1a1a]">Pro</td>
              <td className="px-4 py-3">+ Edge analysis, play-by-play, all bookmakers</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">500,000 req/month</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-3 font-medium text-[#1a1a1a]">Enterprise</td>
              <td className="px-4 py-3">Everything + custom feeds</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">Unlimited</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Error Responses */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Error Responses</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        If your API key is missing or invalid, the API returns a <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">401 Unauthorized</code> response:
      </p>

      <CodeBlock
        title="401 — Invalid or missing key"
        code={`{
  "success": false,
  "error": {
    "code": 401,
    "message": "Valid API key required. Pass x-api-key header."
  }
}`}
      />

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-6 mb-2">
        If your key is valid but your plan does not include the requested resource, the
        API returns a <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">403 Forbidden</code> response:
      </p>

      <CodeBlock
        title="403 — Tier-gated resource"
        code={`{
  "success": false,
  "error": {
    "code": 403,
    "message": "Your plan does not include access to this resource."
  }
}`}
      />
    </div>
  )
}
