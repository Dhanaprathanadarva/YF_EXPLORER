'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const ACCENT = '#f97316' // orange — distinct from other endpoints

interface JobStatus {
  total: number
  completed: number
  done: boolean
}

interface JobResult {
  key: string
  depth: number
  path: string[]
  data: unknown
}

interface JobTiming {
  key: string
  waitTimeMs: number
  processingTimeMs: number
  totalTimeMs: number
}

interface LevelTiming {
  depth: number
  wallClockMs: number
  jobCount: number
  jobs: JobTiming[]
}

interface Timing {
  totalTimeMs: number | null
  levelTimings: LevelTiming[]
}

interface SeqJobTiming {
  key: string
  timeMs: number
}

interface SeqLevelTiming {
  depth: number
  wallClockMs: number
  jobCount: number
  jobs: SeqJobTiming[]
}

interface SequentialTiming {
  totalTimeMs: number
  levelTimings: SeqLevelTiming[]
}

interface FanoutResults {
  rootJobId: string
  totalJobs: number
  timing: Timing
  results: JobResult[]
}

export default function FanoutPage() {
  const router = useRouter()
  const [query, setQuery] = useState('Apple')
  const [rootJobId, setRootJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [results, setResults] = useState<FanoutResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null)
  const [sequentialTiming, setSequentialTiming] = useState<SequentialTiming | null>(null)
  const [expandedSeqLevel, setExpandedSeqLevel] = useState<number | null>(null)
  const [isSequential, setIsSequential] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const fetchResults = useCallback(async (jobId: string, query: string) => {
    const res = await axios.get<FanoutResults>(
      `http://localhost:5000/api/fanout/results/${jobId}`
    )
    if (res.status === 200) {
      setResults(res.data)
      stopPolling()

      // Now run the same query sequentially for comparison
      setIsSequential(true)
      try {
        const seqRes = await axios.post<SequentialTiming>(
          'http://localhost:5000/api/fanout/sequential',
          { query }
        )
        setSequentialTiming(seqRes.data)
      } catch {
        // sequential is best-effort — don't block UI
      } finally {
        setIsSequential(false)
      }
    }
  }, [])

  const pollStatus = useCallback((jobId: string, query: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get<JobStatus>(
          `http://localhost:5000/api/fanout/status/${jobId}`
        )
        setStatus(res.data)
        if (res.data.done) {
          stopPolling()
          await fetchResults(jobId, query)
        }
      } catch {
        stopPolling()
        setError('Lost connection to backend while polling.')
      }
    }, 1000)
  }, [fetchResults])

  const handleStart = useCallback(async () => {
    if (!query.trim()) return
    setIsStarting(true)
    setError(null)
    setStatus(null)
    setResults(null)
    setRootJobId(null)
    setSequentialTiming(null)
    stopPolling()

    try {
      const res = await axios.post<{ rootJobId: string }>(
        'http://localhost:5000/api/fanout/start',
        { query: query.trim() }
      )
      const jobId = res.data.rootJobId
      setRootJobId(jobId)
      pollStatus(jobId, query.trim())
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.code === 'ERR_NETWORK'
          ? 'Cannot connect to backend on port 5000.'
          : err.response?.data?.error ?? err.message)
      } else {
        setError(String(err))
      }
    } finally {
      setIsStarting(false)
    }
  }, [query, pollStatus])

  // Group results by depth
  const byDepth = results
    ? results.results.reduce<Record<number, JobResult[]>>((acc, r) => {
        acc[r.depth] = acc[r.depth] ?? []
        acc[r.depth].push(r)
        return acc
      }, {})
    : {}

  const progressPct = status && status.total > 0
    ? Math.round((status.completed / status.total) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">

      {/* Header */}
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
              style={{ color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}25` }}
            >
              BullMQ
            </span>
            <h1 className="text-sm font-semibold text-[#e5e5e5]">Recursive Fan-out</h1>
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-bold" style={{ color: ACCENT }}>POST</span>
            <span className="text-[11px] font-mono text-[#444]">/api/fanout/start</span>
          </div>
        </div>
      </header>

      {/* Context bar */}
      <div className="border-b border-[#0e0e0e] bg-[#090909] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-3">
          <p className="text-xs text-[#484848] leading-relaxed max-w-3xl">
            Recursive fan-out using BullMQ. Level 1 searches for the query and resolves symbols.
            Level 2 fetches chart data for each symbol in parallel — all managed by a job queue with
            concurrency control, retries, and rate limiting.
          </p>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="max-w-[1400px] mx-auto w-full flex gap-0 overflow-hidden">

          {/* Left — Input */}
          <div className="w-80 flex-shrink-0 border-r border-[#111] overflow-auto p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-4 rounded-full" style={{ background: ACCENT }} />
              <h2 className="text-xs font-semibold text-[#888] uppercase tracking-widest">Parameters</h2>
            </div>

            {/* Query input */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#666] mb-1.5">Query</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Apple, TSLA, Microsoft"
                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-[#e5e5e5] placeholder-[#333] focus:outline-none focus:border-[#333]"
              />
              <p className="text-[10px] text-[#444] mt-1.5">
                Company name or ticker — resolved to symbol at Level 1
              </p>
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={isStarting || (!results && !!rootJobId && !status?.done)}
              className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: ACCENT,
                color: '#000',
                opacity: (isStarting || (!results && !!rootJobId && !status?.done)) ? 0.5 : 1,
              }}
            >
              {isStarting
                ? 'Starting...'
                : rootJobId && !status?.done
                ? 'Running...'
                : 'Start Fan-out'}
            </button>

            {/* Status section */}
            {rootJobId && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full" style={{ background: ACCENT }} />
                  <h2 className="text-xs font-semibold text-[#888] uppercase tracking-widest">Status</h2>
                </div>

                {/* Job ID */}
                <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
                  <p className="text-[9px] text-[#444] uppercase tracking-wide mb-1">Job ID</p>
                  <p className="text-[10px] font-mono text-[#555] break-all">{rootJobId}</p>
                </div>

                {/* Progress */}
                {status && (
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-[#555]">
                        {status.completed} / {status.total} jobs
                      </p>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: status.done ? '#4ade80' : ACCENT,
                          background: status.done ? '#4ade8018' : `${ACCENT}18`,
                        }}
                      >
                        {status.done ? 'DONE' : 'RUNNING'}
                      </span>
                    </div>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%`, background: status.done ? '#4ade80' : ACCENT }}
                      />
                    </div>
                    <p className="text-[9px] text-[#333] mt-1 text-right">{progressPct}%</p>
                  </div>
                )}

                {/* Level-wise + total timing */}
                {results?.timing && (
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-3">
                    <p className="text-[9px] text-[#444] uppercase tracking-wide">Time Breakdown</p>

                    {/* Per level */}
                    {results.timing.levelTimings.map((lt) => {
                      const isExpanded = expandedLevel === lt.depth
                      const canExpand  = lt.jobs && lt.jobs.length > 0
                      const fmt = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
                      const slowest = lt.jobs[0]?.totalTimeMs ?? 1
                      return (
                        <div key={lt.depth}>
                          {/* Level row — clickable */}
                          <button
                            className="w-full text-left"
                            onClick={() => canExpand && setExpandedLevel(isExpanded ? null : lt.depth)}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="flex items-center gap-1 text-[10px] text-[#555]">
                                {canExpand && (
                                  <svg
                                    className="w-2.5 h-2.5 transition-transform"
                                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                                Level {lt.depth}
                                <span className="text-[#333] ml-1">({lt.jobCount} job{lt.jobCount !== 1 ? 's' : ''})</span>
                              </span>
                              <span className="text-[10px] font-semibold text-[#e5e5e5]">
                                {fmt(lt.wallClockMs)}
                              </span>
                            </div>
                            <div className="w-full bg-[#1a1a1a] rounded-full h-1">
                              <div
                                className="h-1 rounded-full"
                                style={{
                                  width: results.timing.totalTimeMs
                                    ? `${Math.round((lt.wallClockMs / results.timing.totalTimeMs) * 100)}%`
                                    : '100%',
                                  background: ACCENT,
                                  opacity: 0.5 + (lt.depth * 0.2),
                                }}
                              />
                            </div>
                          </button>

                          {/* Expanded — total time per job (wait + processing, matches Bull Board) */}
                          {isExpanded && (
                            <div className="mt-2 ml-3 space-y-2.5 border-l border-[#1e1e1e] pl-3">
                              {/* Column headers */}
                              <div className="flex justify-between text-[8px] text-[#333] uppercase tracking-wide">
                                <span>Ticker</span>
                                <span>Time</span>
                              </div>
                              {lt.jobs.map((job, i) => (
                                <div key={i}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-mono text-[#555] truncate max-w-[80px]">
                                      {job.key}
                                    </span>
                                    <span className="text-[9px] font-semibold text-[#e5e5e5]">
                                      {fmt(job.totalTimeMs)}
                                    </span>
                                  </div>
                                  {/* Bar relative to slowest job */}
                                  <div className="w-full bg-[#1a1a1a] rounded-full h-0.5">
                                    <div
                                      className="h-0.5 rounded-full"
                                      style={{
                                        width: `${Math.round((job.totalTimeMs / slowest) * 100)}%`,
                                        background: ACCENT,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Divider */}
                    <div className="border-t border-[#1a1a1a] pt-2 flex justify-between items-center">
                      <span className="text-[9px] text-[#444]">Total (wall-clock)</span>
                      <span className="text-sm font-bold" style={{ color: ACCENT }}>
                        {results.timing.totalTimeMs != null
                          ? results.timing.totalTimeMs < 1000
                            ? `${results.timing.totalTimeMs}ms`
                            : `${(results.timing.totalTimeMs / 1000).toFixed(2)}s`
                          : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sequential timing breakdown */}
                {isSequential && (
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
                    <p className="text-[9px] text-[#444] uppercase tracking-wide mb-2">Sequential (running...)</p>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: '#60a5fa40', borderTopColor: '#60a5fa' }} />
                      <span className="text-[9px] text-[#444]">Running same calls one by one...</span>
                    </div>
                  </div>
                )}

                {sequentialTiming && (
                  <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-3">
                    <p className="text-[9px] text-[#444] uppercase tracking-wide">Sequential Breakdown</p>

                    {sequentialTiming.levelTimings.map((lt) => {
                      const isExpanded = expandedSeqLevel === lt.depth
                      const fmt = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
                      const slowest = Math.max(...lt.jobs.map((j) => j.timeMs), 1)
                      return (
                        <div key={lt.depth}>
                          <button className="w-full text-left" onClick={() => setExpandedSeqLevel(isExpanded ? null : lt.depth)}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="flex items-center gap-1 text-[10px] text-[#555]">
                                <svg className="w-2.5 h-2.5 transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                Level {lt.depth}
                                <span className="text-[#333] ml-1">({lt.jobCount} job{lt.jobCount !== 1 ? 's' : ''})</span>
                              </span>
                              <span className="text-[10px] font-semibold text-[#e5e5e5]">{fmt(lt.wallClockMs)}</span>
                            </div>
                            <div className="w-full bg-[#1a1a1a] rounded-full h-1">
                              <div className="h-1 rounded-full" style={{ width: `${Math.round((lt.wallClockMs / sequentialTiming.totalTimeMs) * 100)}%`, background: '#60a5fa', opacity: 0.5 + (lt.depth * 0.2) }} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 ml-3 space-y-2.5 border-l border-[#1e1e1e] pl-3">
                              <div className="flex justify-between text-[8px] text-[#333] uppercase tracking-wide">
                                <span>Ticker</span>
                                <span>Time</span>
                              </div>
                              {lt.jobs.map((job, i) => (
                                <div key={i}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-mono text-[#555] truncate max-w-[80px]">{job.key}</span>
                                    <span className="text-[9px] font-semibold text-[#e5e5e5]">{fmt(job.timeMs)}</span>
                                  </div>
                                  <div className="w-full bg-[#1a1a1a] rounded-full h-0.5">
                                    <div className="h-0.5 rounded-full" style={{ width: `${Math.round((job.timeMs / slowest) * 100)}%`, background: '#60a5fa' }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="border-t border-[#1a1a1a] pt-2 flex justify-between items-center">
                      <span className="text-[9px] text-[#444]">Total (wall-clock)</span>
                      <span className="text-sm font-bold text-[#60a5fa]">
                        {sequentialTiming.totalTimeMs < 1000
                          ? `${sequentialTiming.totalTimeMs}ms`
                          : `${(sequentialTiming.totalTimeMs / 1000).toFixed(2)}s`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — Results */}
          <div className="flex-1 overflow-auto p-5">
            <div className="h-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden flex flex-col">

              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0">
                <span className="text-xs font-semibold text-[#555] uppercase tracking-widest">Results</span>
                {results && (
                  <span className="text-xs text-[#444]">{results.totalJobs} jobs · {results.results.length} results</span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4">

                {/* Error */}
                {error && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center max-w-sm">
                      <p className="text-sm font-medium text-[#f87171] mb-1">Error</p>
                      <p className="text-xs text-[#555]">{error}</p>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!error && !rootJobId && (
                  <div className="h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-full border border-[#1a1a1a] flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#2a2a2a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h8M4 18h4" />
                      </svg>
                    </div>
                    <p className="text-sm text-[#333]">Enter a query and start the fan-out</p>
                  </div>
                )}

                {/* Polling — waiting for results */}
                {!error && rootJobId && !results && (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${ACCENT}40`, borderTopColor: ACCENT }}
                    />
                    <p className="text-xs text-[#444]">
                      Processing jobs... {status ? `${status.completed}/${status.total}` : ''}
                    </p>
                  </div>
                )}

                {/* Results grouped by depth */}
                {results && (
                  <div className="space-y-6">
                    {Object.entries(byDepth)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([depth, jobs]) => (
                        <div key={depth}>
                          {/* Depth header */}
                          <div className="flex items-center gap-2 mb-3">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                              style={{ color: ACCENT, background: `${ACCENT}18`, border: `1px solid ${ACCENT}25` }}
                            >
                              Level {depth}
                            </span>
                            <span className="text-[10px] text-[#444]">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
                            <div className="flex-1 h-px bg-[#1a1a1a]" />
                          </div>

                          {/* Job cards */}
                          <div className="space-y-2">
                            {jobs.map((job, i) => (
                              <div
                                key={i}
                                className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-[#e5e5e5]">{job.key}</span>
                                  {job.path.length > 0 && (
                                    <span className="text-[10px] text-[#444]">
                                      via {job.path.join(' → ')}
                                    </span>
                                  )}
                                </div>
                                <pre className="text-[10px] font-mono text-[#555] whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-auto">
                                  {JSON.stringify(job.data, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
