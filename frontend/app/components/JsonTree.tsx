'use client'

import { useState } from 'react'

interface JsonTreeProps {
  data: unknown
  depth?: number
}

function getType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function ValueDisplay({ value }: { value: unknown }) {
  const type = getType(value)
  if (type === 'string') return <span className="text-[#f9a825]">&quot;{String(value)}&quot;</span>
  if (type === 'number') return <span className="text-[#81d4fa]">{String(value)}</span>
  if (type === 'boolean') return <span className="text-[#ce93d8]">{String(value)}</span>
  if (type === 'null') return <span className="text-[#888]">null</span>
  return null
}

export default function JsonTree({ data, depth = 0 }: JsonTreeProps) {
  const type = getType(data)

  if (type !== 'object' && type !== 'array') {
    return <ValueDisplay value={data} />
  }

  const isArray = type === 'array'
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(data as Record<string, unknown>)

  if (entries.length === 0) {
    return <span className="text-[#666]">{isArray ? '[]' : '{}'}</span>
  }

  return (
    <div className="flex flex-col">
      {entries.map(([key, value]) => (
        <TreeNode key={key} keyName={key} value={value} isArrayItem={isArray} depth={depth} />
      ))}
    </div>
  )
}

function TreeNode({
  keyName,
  value,
  isArrayItem,
  depth,
}: {
  keyName: string
  value: unknown
  isArrayItem: boolean
  depth: number
}) {
  const [collapsed, setCollapsed] = useState(depth >= 3)
  const type = getType(value)
  const isExpandable = type === 'object' || type === 'array'
  const childCount = isExpandable
    ? Array.isArray(value)
      ? (value as unknown[]).length
      : Object.keys(value as object).length
    : 0

  return (
    <div className="flex flex-col" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      <div
        className={`flex items-start gap-1.5 py-[2px] rounded px-1 -mx-1 group ${isExpandable ? 'cursor-pointer hover:bg-[#1a1a1a]' : ''}`}
        onClick={isExpandable ? () => setCollapsed(!collapsed) : undefined}
      >
        {/* Expand/collapse toggle */}
        <div className="w-3 flex-shrink-0 mt-[3px]">
          {isExpandable && (
            <svg
              className="w-3 h-3 text-[#444] group-hover:text-[#666] transition-transform"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {/* Key */}
        {!isArrayItem && (
          <span className="text-[#60a5fa] text-xs font-mono flex-shrink-0">{keyName}</span>
        )}
        {isArrayItem && (
          <span className="text-[#555] text-xs font-mono flex-shrink-0">{keyName}</span>
        )}
        {!isArrayItem && <span className="text-[#555] text-xs font-mono flex-shrink-0">:</span>}

        {/* Value or summary */}
        {isExpandable ? (
          collapsed ? (
            <span className="text-[#555] text-xs font-mono">
              {Array.isArray(value) ? `[${childCount}]` : `{${childCount}}`}
            </span>
          ) : (
            <span className="text-[#444] text-xs font-mono">{Array.isArray(value) ? '[' : '{'}</span>
          )
        ) : (
          <span className="text-xs font-mono break-all">
            <ValueDisplay value={value} />
          </span>
        )}
      </div>

      {isExpandable && !collapsed && (
        <>
          <JsonTree data={value} depth={depth + 1} />
          <div style={{ paddingLeft: depth === 0 ? 4 : 20 }}>
            <span className="text-[#444] text-xs font-mono">{Array.isArray(value) ? ']' : '}'}</span>
          </div>
        </>
      )}
    </div>
  )
}
