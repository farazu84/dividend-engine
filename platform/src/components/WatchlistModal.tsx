import { useState } from 'react'
import './WatchlistModal.css'

export interface TreasurySeries {
  series_id: string
  term: string
  label: string
  ticker: string
  maturity_months: number
}

export const ALL_TREASURY_SERIES: TreasurySeries[] = [
  { series_id: 'DGS1MO', term: '1M', label: 'US 1M Treasury', ticker: 'UST1M:GOV', maturity_months: 1 },
  { series_id: 'DGS3MO', term: '3M', label: 'US 3M Treasury', ticker: 'UST3M:GOV', maturity_months: 3 },
  { series_id: 'DGS6MO', term: '6M', label: 'US 6M Treasury', ticker: 'UST6M:GOV', maturity_months: 6 },
  { series_id: 'DGS1', term: '1Y', label: 'US 1Y Treasury', ticker: 'UST1Y:GOV', maturity_months: 12 },
  { series_id: 'DGS2', term: '2Y', label: 'US 2Y Treasury', ticker: 'UST2Y:GOV', maturity_months: 24 },
  { series_id: 'DGS3', term: '3Y', label: 'US 3Y Treasury', ticker: 'UST3Y:GOV', maturity_months: 36 },
  { series_id: 'DGS5', term: '5Y', label: 'US 5Y Treasury', ticker: 'UST5Y:GOV', maturity_months: 60 },
  { series_id: 'DGS7', term: '7Y', label: 'US 7Y Treasury', ticker: 'UST7Y:GOV', maturity_months: 84 },
  { series_id: 'DGS10', term: '10Y', label: 'US 10Y Treasury', ticker: 'UST10Y:GOV', maturity_months: 120 },
  { series_id: 'DGS20', term: '20Y', label: 'US 20Y Treasury', ticker: 'UST20Y:GOV', maturity_months: 240 },
  { series_id: 'DGS30', term: '30Y', label: 'US 30Y Treasury', ticker: 'UST30Y:GOV', maturity_months: 360 },
]

interface WatchlistModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSeriesIds: string[]
  onSave: (seriesIds: string[]) => void
}

export function WatchlistModal({ isOpen, onClose, selectedSeriesIds, onSave }: WatchlistModalProps) {
  const [selected, setSelected] = useState<string[]>(selectedSeriesIds)

  if (!isOpen) return null

  const toggleSeries = (seriesId: string) => {
    if (selected.includes(seriesId)) {
      setSelected(selected.filter(id => id !== seriesId))
    } else if (selected.length < 4) {
      setSelected([...selected, seriesId])
    }
  }

  const handleSave = () => {
    if (selected.length === 4) {
      onSave(selected)
      onClose()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Manage Watchlist</h2>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        
        <p className="modal-subtitle">
          Select 4 treasury instruments to display ({selected.length}/4 selected)
        </p>

        <div className="series-grid">
          {ALL_TREASURY_SERIES.map((series) => {
            const isSelected = selected.includes(series.series_id)
            const isDisabled = !isSelected && selected.length >= 4
            
            return (
              <button
                key={series.series_id}
                className={`series-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => toggleSeries(series.series_id)}
                disabled={isDisabled}
              >
                <div className="series-info">
                  <span className="series-term">{series.term}</span>
                  <span className="series-label">{series.label}</span>
                </div>
                {isSelected && (
                  <span className="material-icons-outlined check-icon">check_circle</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="save-btn" 
            onClick={handleSave}
            disabled={selected.length !== 4}
          >
            Save Watchlist
          </button>
        </div>
      </div>
    </div>
  )
}
