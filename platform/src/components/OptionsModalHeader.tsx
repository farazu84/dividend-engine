import { type ScreenedStock } from './TickerCard'
import { type DividendPayment } from './OptionsModal'

const fmt = {
  money: (n: number, d = 2) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (n: number, d = 2) => `${(n * 100).toFixed(d)}%`,
  signedPct: (n: number, d = 1) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(d)}%`,
}

function TickerLogo({ symbol, size = 52 }: { symbol: string; size?: number }) {
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const hue = (hash * 47) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: `oklch(0.32 0.04 ${hue})`,
      color: `oklch(0.85 0.06 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
      fontSize: size * 0.28, letterSpacing: 0.5,
      border: '1px solid rgba(255,255,255,0.04)',
    }}>
      {symbol.length > 4 ? symbol.slice(0, 4) : symbol}
    </div>
  )
}

function Sparkline({ data, width = 110, height = 36, color = '#fca5a5' }: {
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
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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

function fmtDivDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m) - 1]
  return `${month} ${parseInt(d)}, ${y}`
}

interface Props {
  stock: ScreenedStock
  bestRoi: number | null
  recentDividends: DividendPayment[]
  onClose: () => void
}

export function OptionsModalHeader({ stock, bestRoi, recentDividends, onClose }: Props) {
  const trend = stock.price_history?.length ? stock.price_history : genTrend(stock.ticker, stock.drawdown_pct * 100)

  return (
    <div className="om-header">
      <div className="om-header__top">
        <div className="om-header__identity">
          <TickerLogo symbol={stock.ticker} size={52} />
          <div>
            <div className="om-header__name-row">
              <span className="om-header__ticker">{stock.ticker}</span>
              <span className="om-header__full-name">{stock.name}</span>
            </div>
            <div className="om-header__sector">{stock.sector}</div>
          </div>
        </div>
        <div className="om-header__actions">
          <button className="om-btn-icon" aria-label="Expand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className="om-btn-icon" aria-label="Close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="om-stats">
        <div className="om-stat">
          <div className="om-stat__label">Stock Price</div>
          <div className="om-stat__value">${fmt.money(stock.price)}</div>
          <div className="om-stat__sub">Peak ${fmt.money(stock.week52_high)}</div>
        </div>

        <div className="om-stat">
          <div className="om-stat__label">From Peak</div>
          <div className="om-stat__value om-stat__value--red">
            {fmt.signedPct(-stock.drawdown_pct)}
          </div>
        </div>

        <div className="om-stat">
          <div className="om-stat__label">Dividend Yield</div>
          <div className="om-stat__value">{fmt.pct(stock.div_yield)}</div>
          <div className="om-stat__sub">${fmt.money(stock.div_per_quarter)} / qtr</div>
          {recentDividends.length > 0 && (
            <div className="om-div-history">
              {recentDividends.map(d => (
                <div key={d.date} className="om-div-history__row">
                  <span className="om-div-history__date">{fmtDivDate(d.date)}</span>
                  <span className="om-div-history__amt">${fmt.money(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="om-stat">
          <div className="om-stat__label">Payout Ratio</div>
          <div className="om-stat__value">{fmt.pct(stock.payout_ratio, 0)}</div>
        </div>

        <div className="om-stat">
          <div className="om-stat__label">Best ROI/yr</div>
          <div className={`om-stat__value${bestRoi !== null ? ' om-stat__value--teal' : ''}`}>
            {bestRoi !== null ? fmt.pct(bestRoi) : '—'}
          </div>
        </div>

        <div className="om-stat">
          <div className="om-stat__label">Trend (Price)</div>
          <div style={{ marginTop: 6 }}>
            <Sparkline data={trend} width={110} height={36} color="#fca5a5" />
          </div>
        </div>
      </div>
    </div>
  )
}
