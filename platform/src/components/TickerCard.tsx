import { useState } from 'react'
import './TickerCard.css'

// ─── Types (exported so other components can consume them) ────────────────────

export interface OptionStrike {
  strike: number
  premium: number
  expiry: string
  days_to_expiry: number
  protection: number
  call_value: number
  investment_per_100: number
  num_dividends: number
  roi_year: number
  early_exercise_date: string | null
  num_div_early_ex: number
  days_to_early_ex: number | null
  roi_year_early_ex: number | null
  ex_probability: string
}

export interface ScreenedStock {
  ticker: string
  name: string
  sector: string
  price: number
  week52_high: number
  drawdown_pct: number
  div_yield: number
  div_per_quarter: number
  payout_ratio: number
  market_cap: number | null
  pe_ratio: number | null
  price_history?: number[]
  next_ex_div_date?: string | null
  strikes?: OptionStrike[]
  total_strikes?: number
}

export interface ScreenerResponse {
  indices: string[]
  total: number
  cached: boolean
  results: ScreenedStock[]
}

// ─── Helpers (private to this component tree) ─────────────────────────────────

const fmt = {
  money: (n: number, d = 2) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (n: number, d = 1) => `${(n * 100).toFixed(d)}%`,
  signedPct: (n: number, d = 1) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`,
  bigMoney: (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
    return `$${n.toLocaleString()}`
  },
}

function genTrend(symbol: string, declinePct: number): number[] {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const N = 40
  return Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1)
    const noise = Math.sin(seed + i * 0.7) * 0.04 + Math.cos(seed * 0.3 + i * 1.3) * 0.03
    return 1 - (declinePct / 100) * t * t + noise * (1 - t * 0.5)
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sparkline({ data, width = 80, height = 26, color = '#fca5a5' }: {
  data: number[]; width?: number; height?: number; color?: string
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TickerLogo({ symbol, size = 36 }: { symbol: string; size?: number }) {
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const hue = (hash * 47) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: `oklch(0.32 0.04 ${hue})`,
      color: `oklch(0.85 0.06 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      fontSize: size * 0.3, letterSpacing: 0.5,
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      {symbol.length > 4 ? symbol.slice(0, 4) : symbol}
    </div>
  )
}

function CardStat({ label, value, accent, borderRight }: {
  label: string; value: string; accent?: boolean; borderRight?: boolean
}) {
  return (
    <div className="tc-stat" style={{ borderRight: borderRight ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
      <div className="de-label">{label}</div>
      <div className="de-mono tc-stat__value" style={{ color: accent ? 'oklch(0.82 0.10 215)' : '#e2e8f0' }}>
        {value}
      </div>
    </div>
  )
}

// ─── TickerCard ───────────────────────────────────────────────────────────────

export function TickerCard({ stock, onClick }: { stock: ScreenedStock; onClick?: () => void }) {
  const trend = stock.price_history?.length ? stock.price_history : genTrend(stock.ticker, stock.drawdown_pct * 100)
  const [hovered, setHovered] = useState(false)

  return (
    <button
      className={`de-card ${hovered ? 'de-card--hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Header: logo + name + sector */}
      <div className="de-card__header">
        <div className="tc-identity">
          <TickerLogo symbol={stock.ticker} size={40} />
          <div style={{ minWidth: 0 }}>
            <div className="de-card__ticker">{stock.ticker}</div>
            <div className="de-card__name">{stock.name}</div>
          </div>
        </div>
        <div className="de-sector-pill">{stock.sector}</div>
      </div>

      {/* Price + sparkline */}
      <div className="de-card__price-row">
        <div>
          <div className="de-card__price">${fmt.money(stock.price)}</div>
          <div className="de-card__decline">{fmt.signedPct(-stock.drawdown_pct)} from peak</div>
        </div>
        <Sparkline data={trend} width={88} height={28} />
      </div>

      {/* Stat row: Market Cap | P/E | Yield */}
      <div className="de-card__stats">
        <CardStat label="Market cap" value={stock.market_cap ? fmt.bigMoney(stock.market_cap) : '—'} borderRight />
        <CardStat label="P / E" value={stock.pe_ratio ? stock.pe_ratio.toFixed(1) : '—'} borderRight />
        <CardStat label="Yield" value={fmt.pct(stock.div_yield)} accent />
      </div>

      {/* Payout bar */}
      <div className="de-card__payout">
        <div className="tc-payout__header">
          <span className="de-label">Payout ratio</span>
          <span className="de-mono" style={{ fontSize: 11, color: '#94a3b8' }}>{fmt.pct(stock.payout_ratio)}</span>
        </div>
        <div className="tc-payout__track">
          <div className="tc-payout__fill" style={{ width: `${Math.min(100, (stock.payout_ratio / 0.8) * 100)}%` }} />
        </div>
      </div>

      {/* Index chip */}
      <div className="de-card__index">
        <span className="de-label" style={{ marginRight: 8 }}>Index</span>
        <span className="de-index-chip">S&amp;P 500</span>
      </div>

      {/* Footer */}
      <div className="de-card__footer">
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          <span className="de-mono" style={{ color: '#e2e8f0', fontWeight: 500 }}>{stock.total_strikes ?? '—'}</span>
          {' '}covered-call candidates
        </span>
        <span className="de-card__cta">
          View strikes
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  )
}
