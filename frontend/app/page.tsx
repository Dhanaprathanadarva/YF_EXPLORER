import ApiCard from './components/ApiCard'
import { API_CONFIGS } from './lib/api-configs'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="border-b border-[#111] bg-[#080808]">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#1e1e1e] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#e5e5e5]">YF Explorer</h1>
              <p className="text-[10px] text-[#444]">Yahoo Finance API Explorer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            <span className="text-xs text-[#444]">Backend: localhost:5000</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <div className="mb-2">
          <span className="text-xs font-medium text-[#444] uppercase tracking-widest">Yahoo Finance APIs</span>
        </div>
        <h2 className="text-4xl font-bold text-[#e5e5e5] mb-4 leading-tight">
          Pick an endpoint.<br />
          <span className="text-[#444]">Set parameters. Get data.</span>
        </h2>
        <p className="text-[#555] text-base max-w-xl leading-relaxed">
          Four curated Yahoo Finance endpoints — each with pre-filled defaults, inline parameter docs, and a live response viewer.
        </p>
      </div>

      {/* API Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {API_CONFIGS.map((config) => (
            <ApiCard key={config.id} config={config} />
          ))}
        </div>
      </div>
    </div>
  )
}
