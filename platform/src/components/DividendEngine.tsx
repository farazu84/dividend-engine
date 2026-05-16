import { useState, useEffect, useCallback } from 'react'
import { TickerCard, type ScreenerResponse, type ScreenedStock } from './TickerCard'
import { ActiveScreenBanner, type ScreenerCriteria, DEFAULT_CRITERIA } from './ActiveScreenBanner'
import { OptionsModal, type TickerOptionsResponse } from './OptionsModal'
import './DividendEngine.css'

// ─── Results header ───────────────────────────────────────────────────────────

function ResultsHeader({ data }: { data: ScreenerResponse }) {
  const totalStrikes = data.results.reduce((s, r) => s + (r.total_strikes ?? 0), 0)
  return (
    <div className="de-results-header">
      <div>
        <h1 className="de-results-title">Screener Results</h1>
        <p className="de-results-sub">
          <span className="de-mono" style={{ color: '#cbd5e1' }}>{data.total}</span> tickers ·{' '}
          <span className="de-mono" style={{ color: '#cbd5e1' }}>{totalStrikes}</span> covered-call candidates
        </p>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="de-card de-card--skeleton">
      <div className="de-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="de-skel" style={{ width: 40, height: 40, borderRadius: 8 }} />
          <div>
            <div className="de-skel" style={{ width: 56, height: 14, marginBottom: 6 }} />
            <div className="de-skel" style={{ width: 120, height: 10 }} />
          </div>
        </div>
        <div className="de-skel" style={{ width: 80, height: 20, borderRadius: 999 }} />
      </div>
      <div className="de-card__price-row">
        <div>
          <div className="de-skel" style={{ width: 80, height: 22, marginBottom: 6 }} />
          <div className="de-skel" style={{ width: 100, height: 11 }} />
        </div>
        <div className="de-skel" style={{ width: 88, height: 28 }} />
      </div>
      <div className="de-card__stats">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ padding: '10px 14px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div className="de-skel" style={{ width: 48, height: 9, marginBottom: 6 }} />
            <div className="de-skel" style={{ width: 52, height: 13 }} />
          </div>
        ))}
      </div>
      <div className="de-card__footer">
        <div className="de-skel" style={{ width: 140, height: 11 }} />
        <div className="de-skel" style={{ width: 72, height: 11 }} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DividendEngine() {
  const [criteria, setCriteria] = useState<ScreenerCriteria>(DEFAULT_CRITERIA)
  const [selectedIndices, setSelectedIndices] = useState<string[]>(['sp500'])
  const [data, setData] = useState<ScreenerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedStock, setSelectedStock] = useState<ScreenedStock | null>(null)
  const [optionsData, setOptionsData] = useState<TickerOptionsResponse | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  const fetchScreener = useCallback((c: ScreenerCriteria, indices: string[]) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      min_drawdown: String(c.min_drawdown),
      min_div_yield: String(c.min_div_yield),
      max_payout_ratio: String(c.max_payout_ratio),
      max_settled_range: String(c.max_settled_range),
    })
    indices.forEach(idx => params.append('index', idx))
    fetch(`http://localhost:8000/screener?${params}`)
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`)
        return r.json()
      })
      .then((d: ScreenerResponse) => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchScreener(DEFAULT_CRITERIA, ['sp500'])
  }, [fetchScreener])

  const handleCriteriaChange = useCallback((key: keyof ScreenerCriteria, value: number) => {
    setCriteria(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleIndicesChange = useCallback((indices: string[]) => {
    setSelectedIndices(indices)
  }, [])

  const handleRun = useCallback(() => {
    fetchScreener(criteria, selectedIndices)
  }, [fetchScreener, criteria, selectedIndices])

  const handleCardClick = useCallback((stock: ScreenedStock) => {
    setSelectedStock(stock)
    setOptionsData(null)
    setOptionsLoading(true)
    fetch(`http://localhost:8000/screener/${stock.ticker}/options`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d: TickerOptionsResponse) => {
        setOptionsData(d)
        setOptionsLoading(false)
      })
      .catch(() => setOptionsLoading(false))
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedStock(null)
    setOptionsData(null)
  }, [])

  return (
    <div className="de-root">
      <ActiveScreenBanner
        data={data ?? undefined}
        criteria={criteria}
        indices={selectedIndices}
        loading={loading}
        onChange={handleCriteriaChange}
        onIndicesChange={handleIndicesChange}
        onRun={handleRun}
      />

      {error && (
        <div className="de-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fca5a5"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <span>Could not load screener data — {error}</span>
        </div>
      )}

      {!error && (
        <>
          {data ? (
            <ResultsHeader data={data} />
          ) : (
            <div className="de-results-header">
              <div className="de-skel" style={{ width: 180, height: 22, marginBottom: 8 }} />
              <div className="de-skel" style={{ width: 220, height: 13 }} />
            </div>
          )}

          <div className="de-grid">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
              : data?.results.length === 0
                ? (
                  <div className="de-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                      stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <p>No stocks match the current screen.</p>
                  </div>
                )
                : data?.results.map(stock => (
                  <TickerCard
                    key={stock.ticker}
                    stock={stock}
                    onClick={() => handleCardClick(stock)}
                  />
                ))
            }
          </div>
        </>
      )}

      {selectedStock && (
        <OptionsModal
          stock={selectedStock}
          options={optionsData}
          loading={optionsLoading}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}
