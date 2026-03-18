interface Param {
  name: string
  type: string
  required?: boolean
  description: string
}

interface ParamTableProps {
  params: Param[]
  title?: string
}

export function ParamTable({ params, title }: ParamTableProps) {
  if (!params.length) return null
  return (
    <div className="my-4">
      {title && <p className="text-[12px] font-medium text-[#6b7280] uppercase tracking-wider mb-2">{title}</p>}
      <div className="border border-[#e0e0e0] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f5f4f0] border-b border-[#e0e0e0]">
              <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#4a4a4a]">Parameter</th>
              <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#4a4a4a]">Type</th>
              <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#4a4a4a]">Required</th>
              <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#4a4a4a]">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p) => (
              <tr key={p.name} className="border-b border-[#e0e0e0] last:border-b-0">
                <td className="px-4 py-2.5 font-mono text-[13px] text-[#1a1a1a] font-medium">{p.name}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-[#6b7280]">{p.type}</td>
                <td className="px-4 py-2.5 text-[12px]">
                  {p.required ? (
                    <span className="text-red-600 font-medium">Yes</span>
                  ) : (
                    <span className="text-[#6b7280]">No</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#4a4a4a]">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
