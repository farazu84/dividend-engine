import { useEffect } from 'react'
import { type ScreenedStock, type OptionStrike } from './TickerCard'
import { OptionsModalHeader } from './OptionsModalHeader'
import { OptionsTable } from './OptionsTable'
import './OptionsModal.css'

export interface DividendPayment {
  date: string   // YYYY-MM-DD
  amount: number
}

export interface TickerOptionsResponse {
  ticker: string
  name: string
  price: number
  div_per_quarter: number
  next_ex_div_date: string | null
  future_ex_div_dates: string[]
  recent_dividends: DividendPayment[]
  strikes: OptionStrike[]
  total_strikes: number
}

interface Props {
  stock: ScreenedStock
  options: TickerOptionsResponse | null
  loading: boolean
  onClose: () => void
}

export function OptionsModal({ stock, options, loading, onClose }: Props) {
  const bestRoi =
    options && options.strikes.length > 0
      ? Math.max(...options.strikes.map(s => s.roi_year))
      : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleOverlay(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="om-overlay" onClick={handleOverlay}>
      <div className="om-modal" role="dialog" aria-modal="true">
        <OptionsModalHeader
          stock={stock}
          bestRoi={bestRoi}
          recentDividends={options?.recent_dividends ?? []}
          onClose={onClose}
        />
        <OptionsTable
          strikes={options?.strikes ?? []}
          loading={loading}
          price={options?.price ?? 0}
          divPerQuarter={options?.div_per_quarter ?? 0}
          futureExDivDates={options?.future_ex_div_dates ?? []}
        />
      </div>
    </div>
  )
}
