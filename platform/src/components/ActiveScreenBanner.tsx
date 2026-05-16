import { useRef, useState, useEffect } from 'react'
import type { ScreenerResponse } from './TickerCard'
import './ActiveScreenBanner.css'

export interface ScreenerCriteria {
  min_drawdown: number
  min_div_yield: number
  max_payout_ratio: number
  max_settled_range: number
}

export const DEFAULT_CRITERIA: ScreenerCriteria = {
  min_drawdown: 0.30,
  min_div_yield: 0.03,
  max_payout_ratio: 0.80,
  max_settled_range: 0.125,
}

interface FilterDef {
  key: keyof ScreenerCriteria
  label: string
  op: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
}

const FILTER_DEFS: FilterDef[] = [
  {
    key: 'min_drawdown',
    label: 'Decline from peak',
    op: '≥',
    min: 0, max: 0.60, step: 0.05,
    fmt: v => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: 'max_settled_range',
    label: 'Settled range',
    op: '<',
    min: 0.025, max: 0.30, step: 0.025,
    fmt: v => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: 'min_div_yield',
    label: 'Dividend yield',
    op: '>',
    min: 0.005, max: 0.12, step: 0.005,
    fmt: v => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: 'max_payout_ratio',
    label: 'Payout ratio',
    op: '<',
    min: 0.20, max: 1.00, step: 0.05,
    fmt: v => `${(v * 100).toFixed(0)}%`,
  },
]

const INDEX_OPTIONS = [
  { id: 'sp500',     label: 'S&P 500' },
  { id: 'nasdaq100', label: 'NASDAQ 100' },
  { id: 'dji',       label: 'Dow Jones' },
]

interface Props {
  data?: ScreenerResponse
  criteria: ScreenerCriteria
  indices: string[]
  loading: boolean
  onChange: (key: keyof ScreenerCriteria, value: number) => void
  onIndicesChange: (indices: string[]) => void
  onRun: () => void
}

export function ActiveScreenBanner({ data, criteria, indices, loading, onChange, onIndicesChange, onRun }: Props) {
  const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggle(id: string) {
    if (indices.includes(id)) {
      if (indices.length === 1) return
      onIndicesChange(indices.filter(i => i !== id))
    } else {
      onIndicesChange([...indices, id])
    }
  }

  const label = indices.length === INDEX_OPTIONS.length
    ? 'All Indices'
    : INDEX_OPTIONS.filter(o => indices.includes(o.id)).map(o => o.label).join(', ')

  return (
    <div className="asb-root">
      <div className="asb-top">
        <div className="asb-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="oklch(0.78 0.12 215)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18 M7 12h10 M11 18h2" />
          </svg>
          <span className="asb-label">Active Screen</span>
        </div>
        <div className="asb-right">
          <div className="asb-index-dropdown" ref={ref}>
            <button className="asb-index-btn" onClick={() => setOpen(o => !o)} type="button">
              <span>{label}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div className="asb-index-panel">
                {INDEX_OPTIONS.map(opt => {
                  const checked = indices.includes(opt.id)
                  return (
                    <label key={opt.id} className={`asb-index-option${checked ? ' asb-index-option--checked' : ''}`}>
                      <input
                        type="checkbox"
                        className="asb-index-checkbox"
                        checked={checked}
                        disabled={checked && indices.length === 1}
                        onChange={() => toggle(opt.id)}
                      />
                      {opt.label}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {data && (
            <span className="asb-date">
              As of <span className="de-mono">{now}</span>
            </span>
          )}
          {data?.cached && <span className="asb-cached">cached</span>}
          <button className="asb-run-btn" onClick={onRun} disabled={loading}>
            {loading ? (<><span className="asb-run-spinner" />Running…</>) : 'Run Screen'}
          </button>
        </div>
      </div>

      <div className="asb-filters">
        {FILTER_DEFS.map(def => {
          const pct = ((criteria[def.key] - def.min) / (def.max - def.min)) * 100
          return (
            <div key={def.key} className="asb-filter-item">
              <div className="asb-filter-header">
                <span className="asb-filter-label">{def.label}</span>
                <span className="asb-filter-val">
                  <span className="asb-filter-op">{def.op}</span>
                  <span className="de-mono">{def.fmt(criteria[def.key])}</span>
                </span>
              </div>
              <input
                type="range"
                className="asb-slider"
                min={def.min}
                max={def.max}
                step={def.step}
                value={criteria[def.key]}
                style={{ '--fill': `${pct}%` } as React.CSSProperties}
                onChange={e => onChange(def.key, parseFloat(e.target.value))}
              />
              <div className="asb-slider-range">
                <span>{def.fmt(def.min)}</span>
                <span>{def.fmt(def.max)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
