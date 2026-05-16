import { useState, useMemo, useRef, useEffect } from 'react'
import { type OptionStrike } from './TickerCard'

type SortKey = 'strike' | 'roi_year' | 'protection' | 'days_to_expiry'

const SORT_OPTIONS: { label: string; key: SortKey }[] = [
  { label: 'Strike', key: 'strike' },
  { label: 'ROI/Year', key: 'roi_year' },
  { label: 'Protection', key: 'protection' },
  { label: 'DTE', key: 'days_to_expiry' },
]

const SORT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  strike: 'asc',
  roi_year: 'desc',
  protection: 'desc',
  days_to_expiry: 'asc',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}/${y}`
}

function r2(n: number) { return Math.round(n * 100) / 100 }
function r4(n: number) { return Math.round(n * 10000) / 10000 }

// ─── Recalculation logic (mirrors options.py _strike_metrics) ────────────────

function calcExProbability(timeValue: number, divPerQuarter: number): string {
  if (divPerQuarter <= 0) return 'N/A'
  if (timeValue <= 0) return 'Very High'
  const ratio = timeValue / divPerQuarter
  if (ratio < 0.3) return 'Very High'
  if (ratio < 1.0) return 'High'
  if (ratio < 2.0) return 'Medium'
  if (ratio < 3.5) return 'Low'
  return 'Very Low'
}

function calcEarlyExercise(
  timeValue: number,
  divPerQuarter: number,
  futureExDivDates: string[],
): { numDiv: number; earlyDate: string | null } {
  if (divPerQuarter <= 0 || futureExDivDates.length === 0) return { numDiv: 0, earlyDate: null }
  const n = timeValue <= divPerQuarter
    ? 0
    : Math.max(0, Math.floor(timeValue / divPerQuarter) - 1)
  return {
    numDiv: n,
    earlyDate: n < futureExDivDates.length ? futureExDivDates[n] : null,
  }
}

function recalcFromPremium(
  original: OptionStrike,
  newPremium: number,
  price: number,
  divPerQuarter: number,
  futureExDivDates: string[],
): OptionStrike {
  const callValue = r2(original.strike + newPremium)
  const investment = r2((price - newPremium) * 100)
  if (investment <= 0) return original

  const intrinsic = Math.max(price - original.strike, 0)
  const timeValue = newPremium - intrinsic

  const roiYear = r4(
    (100 * ((callValue - price) + divPerQuarter * original.num_dividends))
    / investment / (original.days_to_expiry / 365)
  )

  const { numDiv: numDivEarlyEx, earlyDate: earlyExDateStr } =
    calcEarlyExercise(timeValue, divPerQuarter, futureExDivDates)

  let daysToEarlyEx: number | null = null
  let roiYearEarlyEx: number | null = null

  if (earlyExDateStr) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const earlyDate = new Date(earlyExDateStr + 'T00:00:00')
    daysToEarlyEx = Math.floor((earlyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysToEarlyEx > 0) {
      roiYearEarlyEx = r4(
        (100 * ((callValue - price) + divPerQuarter * numDivEarlyEx))
        / investment / (daysToEarlyEx / 365)
      )
    }
  }

  return {
    ...original,
    premium: r2(newPremium),
    call_value: callValue,
    investment_per_100: investment,
    roi_year: roiYear,
    num_div_early_ex: numDivEarlyEx,
    early_exercise_date: earlyExDateStr,
    days_to_early_ex: daysToEarlyEx,
    roi_year_early_ex: roiYearEarlyEx ?? null,
    ex_probability: calcExProbability(timeValue, divPerQuarter),
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProtBar({ value }: { value: number }) {
  const width = Math.min(100, (value / 0.5) * 100)
  return (
    <div className="om-prot">
      <div className="om-prot__bar">
        <div className="om-prot__fill" style={{ width: `${width}%` }} />
      </div>
      <span className="om-prot__pct">{(value * 100).toFixed(2)}%</span>
    </div>
  )
}

function ExProbBadge({ prob }: { prob: string }) {
  const cls = prob.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <span className={`om-expb om-expb--${cls}`}>
      <span className="om-expb__dot" />
      {prob}
    </span>
  )
}

// ─── Inline editable premium cell ────────────────────────────────────────────

interface PremiumCellProps {
  rowKey: string
  value: number
  isOverridden: boolean
  isEditing: boolean
  editingValue: string
  onStartEdit: () => void
  onEditChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  onReset: () => void
}

function PremiumCell({
  value, isOverridden, isEditing,
  editingValue, onStartEdit, onEditChange, onCommit, onCancel, onReset,
}: PremiumCellProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="om-premium-edit">
        <span className="om-premium-sigil">$</span>
        <input
          ref={inputRef}
          type="number"
          className="om-premium-input"
          value={editingValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onCommit() }
            if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          }}
          step="0.01"
          min="0.01"
        />
      </div>
    )
  }

  return (
    <div
      className={`om-premium-display${isOverridden ? ' om-premium-display--edited' : ''}`}
      onClick={onStartEdit}
      title="Click to edit"
    >
      {value.toFixed(2)}
      {isOverridden ? (
        <button
          className="om-premium-reset"
          onMouseDown={e => { e.stopPropagation(); onReset() }}
          title="Reset to market price"
        >×</button>
      ) : (
        <svg className="om-premium-pen" width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  strikes: OptionStrike[]
  loading: boolean
  price: number
  divPerQuarter: number
  futureExDivDates: string[]
}

export function OptionsTable({ strikes, loading, price, divPerQuarter, futureExDivDates }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('strike')
  const [premiumOverrides, setPremiumOverrides] = useState<Record<string, number>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const subtitle = useMemo(() => {
    if (strikes.length === 0) return ''
    const uniqueExpiries = [...new Set(strikes.map(s => s.expiry))].sort()
    const n = strikes.length
    if (uniqueExpiries.length === 1) {
      return `${n} strike${n !== 1 ? 's' : ''} · expires ${fmtDate(uniqueExpiries[0])}`
    }
    return `${n} strike${n !== 1 ? 's' : ''} · ${uniqueExpiries.length} expiries`
  }, [strikes])

  // Apply overrides and sort
  const sorted = useMemo(() => {
    const dir = SORT_DIR[sortKey]
    return [...strikes]
      .sort((a, b) => {
        const va = a[sortKey] as number
        const vb = b[sortKey] as number
        return dir === 'asc' ? va - vb : vb - va
      })
      .map(s => {
        const key = `${s.strike}-${s.expiry}`
        const override = premiumOverrides[key]
        return override !== undefined
          ? recalcFromPremium(s, override, price, divPerQuarter, futureExDivDates)
          : s
      })
  }, [strikes, sortKey, premiumOverrides, price, divPerQuarter, futureExDivDates])

  function rowKey(s: OptionStrike) { return `${s.strike}-${s.expiry}` }

  function startEdit(key: string, currentValue: number) {
    setEditingKey(key)
    setEditingValue(currentValue.toFixed(2))
  }

  function commitEdit(key: string) {
    const parsed = parseFloat(editingValue)
    if (!isNaN(parsed) && parsed > 0) {
      setPremiumOverrides(prev => ({ ...prev, [key]: parsed }))
    }
    setEditingKey(null)
  }

  function resetOverride(key: string) {
    setPremiumOverrides(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="om-body">
      <div className="om-table-head-row">
        <div>
          <span className="om-section-title">Covered-call candidates</span>
          {subtitle && <span className="om-section-sub">{subtitle}</span>}
        </div>
        {!loading && strikes.length > 0 && (
          <div className="om-sort-control">
            <span>Sort by</span>
            <select
              className="om-sort-select"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="om-loading">
          <div className="om-spinner" />
          Loading options data…
        </div>
      ) : strikes.length === 0 ? (
        <div className="om-loading">No options data available for this ticker.</div>
      ) : (
        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>Strike</th>
                <th>Call Price</th>
                <th>Expiry</th>
                <th>Protection</th>
                <th>Call Value</th>
                <th>DTE</th>
                <th>Divs</th>
                <th>Investment</th>
                <th>ROI/Year</th>
                <th>Early Ex.</th>
                <th>ROI Early</th>
                <th>Ex Probability</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const key = rowKey(s)
                const isOverridden = key in premiumOverrides
                const isEditing = editingKey === key

                const roiEarlyCls =
                  s.roi_year_early_ex === null
                    ? 'om-roi-early--nil'
                    : s.roi_year_early_ex >= 0
                      ? 'om-roi-early--pos'
                      : 'om-roi-early--neg'

                return (
                  <tr key={i} className={isOverridden ? 'om-row--overridden' : ''}>
                    <td>${s.strike % 1 === 0 ? s.strike.toFixed(0) : s.strike.toFixed(2)}</td>
                    <td className="om-td-premium">
                      <PremiumCell
                        rowKey={key}
                        value={s.premium}
                        isOverridden={isOverridden}
                        isEditing={isEditing}
                        editingValue={editingValue}
                        onStartEdit={() => startEdit(key, s.premium)}
                        onEditChange={setEditingValue}
                        onCommit={() => commitEdit(key)}
                        onCancel={() => setEditingKey(null)}
                        onReset={() => resetOverride(key)}
                      />
                    </td>
                    <td>{fmtDate(s.expiry)}</td>
                    <td><ProtBar value={s.protection} /></td>
                    <td className={isOverridden ? 'om-cell--recalced' : ''}>{s.call_value.toFixed(2)}</td>
                    <td>{s.days_to_expiry}</td>
                    <td>{s.num_dividends}</td>
                    <td className={isOverridden ? 'om-cell--recalced' : ''}>
                      ${s.investment_per_100.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    <td className={isOverridden ? 'om-cell--recalced' : ''}>
                      <span className="om-roi-year">{(s.roi_year * 100).toFixed(2)}%</span>
                    </td>
                    <td>{fmtDate(s.early_exercise_date)}</td>
                    <td className={isOverridden ? 'om-cell--recalced' : ''}>
                      <span className={roiEarlyCls}>
                        {s.roi_year_early_ex === null
                          ? '—'
                          : `${s.roi_year_early_ex >= 0 ? '+' : ''}${(s.roi_year_early_ex * 100).toFixed(2)}%`}
                      </span>
                    </td>
                    <td className={isOverridden ? 'om-cell--recalced' : ''}>
                      <ExProbBadge prob={s.ex_probability} />
                    </td>
                    <td>
                      <svg className="om-row-action" width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7M17 7H7M17 7v10" />
                      </svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
