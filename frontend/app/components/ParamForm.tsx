'use client'

import { FieldConfig } from '../lib/api-configs'

interface ParamFormProps {
  fields: FieldConfig[]
  values: Record<string, string | number | boolean>
  onChange: (name: string, value: string | number | boolean) => void
  onSubmit: () => void
  isLoading: boolean
  accentColor: string
}

export default function ParamForm({ fields, values, onChange, onSubmit, isLoading, accentColor }: ParamFormProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      className="flex flex-col gap-5"
    >
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#c0c0c0]">
              {field.label}
              {field.required && <span className="ml-1 text-[#f87171]">*</span>}
            </label>
          </div>
          <p className="text-xs text-[#555] leading-relaxed">{field.description}</p>

          {field.type === 'text' && (
            <input
              type="text"
              value={String(values[field.name] ?? field.defaultValue)}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className="bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e5e5e5] placeholder-[#333] font-mono outline-none transition-colors focus:border-[#333]"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
              onFocus={(e) => { e.target.style.borderColor = accentColor + '60' }}
              onBlur={(e) => { e.target.style.borderColor = '#222' }}
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              value={Number(values[field.name] ?? field.defaultValue)}
              onChange={(e) => onChange(field.name, e.target.value)}
              min={1}
              className="bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e5e5e5] font-mono outline-none transition-colors w-32"
              onFocus={(e) => { e.target.style.borderColor = accentColor + '60' }}
              onBlur={(e) => { e.target.style.borderColor = '#222' }}
            />
          )}

          {field.type === 'select' && field.options && (
            <select
              value={String(values[field.name] ?? field.defaultValue)}
              onChange={(e) => onChange(field.name, e.target.value)}
              className="bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e5e5e5] outline-none transition-colors appearance-none cursor-pointer"
              onFocus={(e) => { e.target.style.borderColor = accentColor + '60' }}
              onBlur={(e) => { e.target.style.borderColor = '#222' }}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23555'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px', paddingRight: '32px' }}
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}

          {field.type === 'checkbox' && (
            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.name] ?? field.defaultValue)}
                  onChange={(e) => onChange(field.name, e.target.checked)}
                  className="sr-only"
                />
                <div
                  className="w-10 h-5 rounded-full border transition-all"
                  style={{
                    background: Boolean(values[field.name] ?? field.defaultValue) ? accentColor : '#1a1a1a',
                    borderColor: Boolean(values[field.name] ?? field.defaultValue) ? accentColor : '#333',
                  }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: Boolean(values[field.name] ?? field.defaultValue) ? 'translateX(21px)' : 'translateX(2px)' }}
                  />
                </div>
              </div>
              <span className="text-sm text-[#666]">
                {Boolean(values[field.name] ?? field.defaultValue) ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: isLoading ? '#1a1a1a' : accentColor, color: isLoading ? '#555' : 'white' }}
      >
        {isLoading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Fetching...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Request
          </>
        )}
      </button>
    </form>
  )
}
