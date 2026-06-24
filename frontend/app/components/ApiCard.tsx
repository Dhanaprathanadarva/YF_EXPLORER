import Link from 'next/link'
import { ApiConfig } from '../lib/api-configs'

export default function ApiCard({ config }: { config: ApiConfig }) {
  return (
    <Link href={`/${config.id}`} className="group block">
      <div
        className="relative bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 h-full transition-all duration-200 hover:border-[#333] hover:bg-[#141414]"
        style={{ '--accent': config.accentColor } as React.CSSProperties}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full opacity-60 group-hover:opacity-100 transition-opacity"
          style={{ background: config.accentColor }}
        />

        {/* Version badge */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
            style={{ color: config.accentColor, background: `${config.accentColor}18`, border: `1px solid ${config.accentColor}30` }}
          >
            {config.version}
          </span>
          <svg
            className="w-4 h-4 text-[#333] group-hover:text-[#555] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </div>

        {/* Name */}
        <h2 className="text-lg font-bold text-[#e5e5e5] mb-1 group-hover:text-white transition-colors">
          {config.name}
        </h2>

        {/* Short description */}
        <p className="text-sm text-[#666] mb-4 leading-relaxed">
          {config.shortDescription}
        </p>

        {/* Endpoint pill */}
        <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2">
          <span className="text-[10px] font-bold text-[#4ade80]">GET</span>
          <span className="text-[11px] font-mono text-[#555] truncate">{config.endpoint}</span>
        </div>

        {/* Field count */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className="text-xs text-[#444]">{config.fields.length} parameters</span>
          <span className="text-[#333]">·</span>
          <span
            className="text-xs font-medium"
            style={{ color: config.accentColor }}
          >
            Explore →
          </span>
        </div>
      </div>
    </Link>
  )
}
