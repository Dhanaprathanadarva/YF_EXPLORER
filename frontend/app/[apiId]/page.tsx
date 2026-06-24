'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import axios from 'axios'
import { API_CONFIGS } from '../lib/api-configs'
import ParamForm from '../components/ParamForm'
import ResponsePanel from '../components/ResponsePanel'

interface ApiResult {
  url: string
  status: number
  statusText: string
  data: unknown
  time: number
}

interface DashboardResult {
  search: ApiResult
  chart: ApiResult
  marketSummary: ApiResult
  trending: ApiResult
}

const DASHBOARD_TABS: { key: keyof DashboardResult; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'chart', label: 'Chart' },
  { key: 'marketSummary', label: 'Market Summary' },
  { key: 'trending', label: 'Trending' },
]

export default function ApiPage() {
  const params = useParams()
  const router = useRouter()
  const apiId = params.apiId as string

  const config = API_CONFIGS.find((c) => c.id === apiId)

  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>(() => {
    if (!config) return {}
    return Object.fromEntries(config.fields.map((f) => [f.name, f.defaultValue]))
  })

  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [dashboardResult, setDashboardResult] = useState<DashboardResult | null>(null)
  const [activeTab, setActiveTab] = useState<keyof DashboardResult>('search')
  const [error, setError] = useState<string | null>(null)

  const handleChange = useCallback((name: string, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!config) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    setDashboardResult(null)

    try {
      if (config.isDashboard) {
        const response = await axios.post<DashboardResult>(
          `http://localhost:5000${config.backendPath}`,
          formValues
        )
        setDashboardResult(response.data)
        setActiveTab('search')
      } else {
        const response = await axios.post<ApiResult>(
          `http://localhost:5000${config.backendPath}`,
          formValues
        )
        setResult(response.data)
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_NETWORK') {
          setError('Cannot connect to backend on port 5000. Make sure the backend is running.')
        } else {
          setError(err.response?.data?.error ?? err.message)
        }
      } else if (err instanceof AggregateError || (err instanceof Error && err.message.includes('ECONNREFUSED'))) {
        setError('Cannot connect to backend on port 5000. Make sure the backend is running.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setIsLoading(false)
    }
  }, [config, formValues])

  if (!config) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#555] mb-4">API &quot;{apiId}&quot; not found.</p>
          <button onClick={() => router.push('/')} className="text-sm text-[#888] hover:text-[#e5e5e5] underline">
            Back to home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[#111] bg-[#080808] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-[#444] hover:text-[#888] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All APIs
          </button>

          <div className="w-px h-4 bg-[#1a1a1a]" />

          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
              style={{ color: config.accentColor, background: `${config.accentColor}18`, border: `1px solid ${config.accentColor}25` }}
            >
              {config.version}
            </span>
            <h1 className="text-sm font-semibold text-[#e5e5e5]">{config.name}</h1>
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold text-[#4ade80]">{config.isDashboard ? 'POST' : 'GET'}</span>
            <span className="text-[11px] font-mono text-[#444]">{config.endpoint}</span>
          </div>
        </div>
      </header>

      {/* Context bar */}
      <div className="border-b border-[#0e0e0e] bg-[#090909] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <p className="text-xs text-[#484848] leading-relaxed max-w-3xl">{config.context}</p>
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="max-w-[1400px] mx-auto w-full flex gap-0 overflow-hidden">

          {/* Left: Parameters */}
          <div className="w-80 flex-shrink-0 border-r border-[#111] overflow-auto">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-4 rounded-full" style={{ background: config.accentColor }} />
                <h2 className="text-xs font-semibold text-[#888] uppercase tracking-widest">Parameters</h2>
              </div>
              <ParamForm
                fields={config.fields}
                values={formValues}
                onChange={handleChange}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                accentColor={config.accentColor}
              />
            </div>
          </div>

          {/* Right: Response */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {config.isDashboard && dashboardResult ? (
              <>
                {/* Tab bar */}
                <div className="flex-shrink-0 border-b border-[#111] px-5 pt-4 flex items-end gap-1">
                  {DASHBOARD_TABS.map((tab) => {
                    const subResult = dashboardResult[tab.key]
                    const isActive = activeTab === tab.key
                    const statusOk = subResult.status >= 200 && subResult.status < 300
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors border-b-2 ${
                          isActive
                            ? 'text-[#e5e5e5] border-current'
                            : 'text-[#555] border-transparent hover:text-[#888]'
                        }`}
                        style={isActive ? { borderColor: config.accentColor, color: config.accentColor } : {}}
                      >
                        {tab.label}
                        <span
                          className="text-[9px] font-bold px-1 py-0.5 rounded"
                          style={{
                            color: statusOk ? '#4ade80' : '#f87171',
                            background: statusOk ? '#4ade8018' : '#f8717118',
                          }}
                        >
                          {subResult.status}
                        </span>
                        <span className="text-[9px] text-[#444]">{subResult.time}ms</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex-1 overflow-hidden p-5">
                  <ResponsePanel
                    result={dashboardResult[activeTab]}
                    error={null}
                    isLoading={false}
                    accentColor={config.accentColor}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-hidden p-5">
                <ResponsePanel
                  result={result}
                  error={error}
                  isLoading={isLoading}
                  accentColor={config.accentColor}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
