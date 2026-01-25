import { useState } from 'react'
import { BenchmarkCard, BenchmarkCardConfig } from './BenchmarkCard'
import { WatchlistModal, ALL_TREASURY_SERIES } from './WatchlistModal'
import './BenchmarkInstruments.css'

const DEFAULT_WATCHLIST = ['DGS2', 'DGS5', 'DGS10', 'DGS30']

export function BenchmarkInstruments() {
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const watchlistCards: BenchmarkCardConfig[] = watchlist
    .map(seriesId => ALL_TREASURY_SERIES.find(s => s.series_id === seriesId))
    .filter((s): s is BenchmarkCardConfig => s !== undefined)
    .sort((a, b) => a.maturity_months - b.maturity_months)

  const handleSaveWatchlist = (seriesIds: string[]) => {
    setWatchlist(seriesIds)
  }

  return (
    <div className="benchmark-instruments">
      <div className="benchmark-header">
        <h2>Benchmark Instruments</h2>
        <button className="manage-btn" onClick={() => setIsModalOpen(true)}>
          <span className="material-icons-outlined">settings</span>
          Manage Watchlist
        </button>
      </div>
      <div className="benchmark-cards">
        {watchlistCards.map((card) => (
          <BenchmarkCard 
            key={card.series_id} 
            config={card} 
          />
        ))}
      </div>

      <WatchlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedSeriesIds={watchlist}
        onSave={handleSaveWatchlist}
      />
    </div>
  )
}
