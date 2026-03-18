import { CodeBlock } from '@/components/docs/CodeBlock'

export const metadata = {
  title: 'Error Codes — MoneyLine API Docs',
  description: 'Reference for all error codes returned by the MoneyLine API and how to handle them.',
}

export default function ErrorCodesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[#1a1a1a]">Error Codes</h1>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mt-4">
        The MoneyLine API uses conventional HTTP status codes to indicate the outcome of
        a request. All errors return a consistent JSON format so you can handle them
        predictably in your application.
      </p>

      {/* Error Format */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">Error Response Format</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-2">
        Every error response includes a <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">success</code>{' '}
        flag set to <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">false</code> along
        with an <code className="text-[13px] bg-[#f0ede6] px-1.5 py-0.5 rounded font-mono">error</code> object
        containing the HTTP status code and a human-readable message:
      </p>

      <CodeBlock
        title="Error structure"
        code={`{
  "success": false,
  "error": {
    "code": 400,
    "message": "Descriptive error message here."
  }
}`}
      />

      {/* Error Codes Table */}
      <h2 className="text-xl font-semibold text-[#1a1a1a] mt-10 mb-3">HTTP Status Codes</h2>

      <p className="text-[15px] text-[#4a4a4a] leading-relaxed mb-4">
        Below is a complete list of error codes the API may return:
      </p>

      <div className="overflow-x-auto rounded-lg border border-[#e0e0e0]">
        <table className="w-full text-[14px] text-left">
          <thead>
            <tr className="bg-[#f5f4f0] text-[#1a1a1a]">
              <th className="px-4 py-2.5 font-semibold">Code</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="text-[#4a4a4a]">
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">400</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Bad Request</td>
              <td className="px-4 py-2.5">Invalid query parameters or missing required fields</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">401</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Unauthorized</td>
              <td className="px-4 py-2.5">Missing or invalid API key</td>
            </tr>
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">403</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Forbidden</td>
              <td className="px-4 py-2.5">Your plan does not include access to this resource</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">404</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Not Found</td>
              <td className="px-4 py-2.5">The requested resource does not exist</td>
            </tr>
            <tr className="border-t border-[#e8e8e8]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">429</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Too Many Requests</td>
              <td className="px-4 py-2.5">Rate limit exceeded</td>
            </tr>
            <tr className="border-t border-[#e8e8e8] bg-[#faf9f6]">
              <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a]">500</td>
              <td className="px-4 py-2.5 font-medium text-[#1a1a1a]">Internal Server Error</td>
              <td className="px-4 py-2.5">Something went wrong on our end</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
