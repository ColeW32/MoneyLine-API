import { CodeBlock } from './CodeBlock'
import { ParamTable } from './ParamTable'
import { TierBadge } from './TierBadge'

interface Param {
  name: string
  type: string
  required?: boolean
  description: string
}

interface EndpointCardProps {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  description: string
  tier?: 'free' | 'hobbyist' | 'pro' | 'enterprise'
  params?: Param[]
  response?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-[#dcfce7] text-[#166534]',
  POST: 'bg-[#dbeafe] text-[#1e40af]',
  DELETE: 'bg-[#fee2e2] text-[#991b1b]',
}

export function EndpointCard({ method, path, description, tier, params, response }: EndpointCardProps) {
  return (
    <div className="border border-[#e0e0e0] rounded-xl bg-white my-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#e0e0e0]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${METHOD_COLORS[method]}`}>
            {method}
          </span>
          <code className="text-[14px] font-mono font-medium text-[#1a1a1a]">{path}</code>
          {tier && tier !== 'free' && (
            <TierBadge tier={tier} />
          )}
        </div>
        <p className="text-[14px] text-[#4a4a4a] mt-2">{description}</p>
      </div>

      {params && params.length > 0 && (
        <div className="px-5 py-3 border-b border-[#e0e0e0]">
          <ParamTable params={params} />
        </div>
      )}

      {response && (
        <div className="px-5 py-3">
          <p className="text-[11px] font-medium text-[#6b7280] uppercase tracking-wider mb-1">Response</p>
          <CodeBlock code={response} />
        </div>
      )}
    </div>
  )
}
