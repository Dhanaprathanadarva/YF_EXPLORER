'use client'

import { useState } from 'react'
import JsonTree from './JsonTree'

interface ApiResult {
  url: string
  status: number
  statusText: string
  data: unknown
  time: number
}

interface ResponsePanelProps {
  result: ApiResult | null
  error: string | null
  isLoading: boolean
  accentColor: string
}

type ViewMode = 'tree' | 'raw'

function statusColor(status: number) {
  if (status >= 200 && status < 300) return '#4ade80'
  if (status >= 400 && status < 500) return '#fbbf24'
  return '#f87171'
}

export default function ResponsePanel({ result, error, isLoading, accentColor }: ResponsePanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = result ? JSON.stringify(result.data, null, 2) : ''
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#555] uppercase tracking-widest">Response</span>
          {result && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold"
                style={{ color: statusColor(result.status) }}
              >
                {result.status} {result.statusText}
              </span>
              <span className="text-xs text-[#444]">{result.time}ms</span>
            </div>
          )}
        </div>

        {result && (
          <div className="flex items-center gap-1">
            {(['tree', 'raw'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="px-2.5 py-1 text-xs rounded transition-colors capitalize"
                style={{
                  background: viewMode === m ? '#1e1e1e' : 'transparent',
                  color: viewMode === m ? '#e5e5e5' : '#555',
                }}
              >
                {m}
              </button>
            ))}
            <div className="w-px h-3.5 bg-[#222] mx-1" />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors hover:bg-[#1e1e1e]"
              style={{ color: copied ? '#4ade80' : '#555' }}
            >
              {copied ? (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied</>
              ) : (
                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* URL bar */}
      {result && (
        <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#090909] flex-shrink-0">
          <p className="text-[10px] text-[#444] uppercase tracking-wide mb-0.5">Request URL</p>
          <p className="text-xs font-mono break-all" style={{ color: accentColor + 'cc' }}>{result.url}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {isLoading && (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${accentColor}40`, borderTopColor: 'transparent' }}
            />
            <p className="text-xs text-[#444]">Fetching from Yahoo Finance...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="w-10 h-10 rounded-full bg-[#1a0000] border border-[#5a1a1a] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#f87171]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#f87171] mb-1">Request Failed</p>
              <p className="text-xs text-[#555]">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && !result && (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full border border-[#1a1a1a] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#2a2a2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-[#333]">Fill in the parameters and send</p>
          </div>
        )}

        {!isLoading && !error && result && (
          viewMode === 'tree' ? (
            <JsonTree data={result.data} />
          ) : (
            <pre className="text-xs font-mono text-[#c0c0c0] whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )
        )}
      </div>
    </div>
  )
}
