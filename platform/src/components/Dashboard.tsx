import { BenchmarkInstruments } from './BenchmarkInstruments'
import { YieldCurve } from './YieldCurve'
import './Dashboard.css'

export function Dashboard() {
  const isMarketOpen = () => {
    const now = new Date()
    const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day = estTime.getDay()
    const hours = estTime.getHours()
    const minutes = estTime.getMinutes()
    const timeInMinutes = hours * 60 + minutes

    // Market open: Monday-Friday, 9:30 AM - 4:00 PM EST
    const marketOpen = 9 * 60 + 30
    const marketClose = 16 * 60
    const isWeekday = day >= 1 && day <= 5

    return isWeekday && timeInMinutes >= marketOpen && timeInMinutes < marketClose
  }

  const marketOpen = isMarketOpen()

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="breadcrumb">
          <span>Treasury Markets</span>
          <span className="separator">/</span>
          <span className="current">Yield Curve Overview</span>
          <span className={`market-status ${marketOpen ? 'open' : 'closed'}`}>
            {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
        </div>
        <div className="powered-by">
          Powered By: <span className="fred-label">FRED API</span>
        </div>
      </div>

      <YieldCurve />

      <BenchmarkInstruments />
    </div>
  )
}
