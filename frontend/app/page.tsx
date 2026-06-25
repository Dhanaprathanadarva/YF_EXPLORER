import Link from 'next/link'
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
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {API_CONFIGS.map((config) => (
            <ApiCard key={config.id} config={config} />
          ))}
        </div>
      </div>

      {/* Fan-out feature card */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="mb-3">
          <span className="text-xs font-medium text-[#444] uppercase tracking-widest">Advanced</span>
        </div>
        <Link href="/fanout" className="group block">
          <div className="relative bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 transition-all duration-200 hover:border-[#333] hover:bg-[#141414]">
            <div className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full opacity-60 group-hover:opacity-100 transition-opacity bg-[#f97316]" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest text-[#f97316] bg-[#f9731618] border border-[#f9731625]">
                BullMQ
              </span>
              <svg className="w-4 h-4 text-[#333] group-hover:text-[#555] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#e5e5e5] mb-1 group-hover:text-white transition-colors">
              Recursive Fan-out
            </h2>
            <p className="text-sm text-[#666] mb-4 leading-relaxed">
              Search → parallel chart fetch for each symbol via a managed job queue
            </p>
            <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2">
              <span className="text-[10px] font-bold text-[#f97316]">POST</span>
              <span className="text-[11px] font-mono text-[#555]">/api/fanout/start</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <span className="text-xs text-[#444]">Concurrency · Retries · Rate limiting</span>
              <span className="text-[#333]">·</span>
              <span className="text-xs font-medium text-[#f97316]">Explore →</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
