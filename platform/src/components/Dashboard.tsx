import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, IChartApi, AreaSeries, Time } from 'lightweight-charts'
import { BenchmarkInstruments } from './BenchmarkInstruments'
import './Dashboard.css'

interface YieldPoint {
  term: string
  maturity_months: number
  yield_rate: number
  date: string
}

export function Dashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [yields, setYields] = useState<YieldPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [yieldDate, setYieldDate] = useState<string>('')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const fetchYields = async () => {
      try {
        const response = await fetch('http://localhost:8000/yields')
        const data = await response.json()
        setYields(data.yields)
        if (data.yields.length > 0) {
          setYieldDate(data.yields[0].date)
        }
      } catch (err) {
        setError('Failed to fetch yield data')
      } finally {
        setLoading(false)
      }
    }

    fetchYields()
  }, [])

  // Create chart function
  const initChart = useCallback(() => {
    if (!chartContainerRef.current || yields.length === 0) return

    const termLabels = yields.map(y => y.term)

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1f2e' },
        textColor: '#8b9ab4',
      },
      grid: {
        vertLines: { color: '#2a3441' },
        horzLines: { color: '#2a3441' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      rightPriceScale: {
        borderColor: '#2a3441',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2a3441',
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: number) => {
          const index = Math.round(time)
          return termLabels[index] || ''
        },
      },
      localization: {
        timeFormatter: (time: number) => {
          const index = Math.round(time)
          return termLabels[index] || ''
        },
      },
      crosshair: {
        horzLine: {
          color: '#3b82f6',
          labelBackgroundColor: '#3b82f6',
        },
        vertLine: {
          color: '#3b82f6',
          labelBackgroundColor: '#3b82f6',
        },
      },
      handleScroll: false,
      handleScale: false,
    })

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#3b82f6',
      topColor: 'rgba(59, 130, 246, 0.4)',
      bottomColor: 'rgba(59, 130, 246, 0.0)',
      lineWidth: 2,
    })

    const chartData = yields.map((y, index) => ({
      time: index as Time,
      value: y.yield_rate,
    }))

    areaSeries.setData(chartData)

    // Fit content and ensure full range is visible
    chart.timeScale().fitContent()
    chart.timeScale().setVisibleLogicalRange({ from: -0.5, to: yields.length - 0.5 })

    return chart
  }, [yields])

  /*
  This useEffect is responsible for creating and updating the chart.
  It is called when the yields data is fetched and when the window is resized.
  It is also responsible for cleaning up the chart when the component is unmounted.
  */
  useEffect(() => {
    if (yields.length === 0) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = initChart()
    if (chart) {
      chartRef.current = chart
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
        chartRef.current.timeScale().fitContent()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [yields, initChart])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      timeZone: 'UTC'
    })
  }

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

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading yield data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error">{error}</div>
      </div>
    )
  }

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

      <div className="yield-curve-card">
        <div className="card-header">
          <div className="card-title">
            <h2>Treasury Yield Curve</h2>
            <p>Yield spread across fixed income maturities {yieldDate && `• As of ${formatDate(yieldDate)}`}</p>
          </div>
          <div className="curve-legend">
            <span className="legend-item">
              <span className="dot live"></span>
              LIVE CURVE
            </span>
          </div>
        </div>
        <div className="chart-container" ref={chartContainerRef}></div>
      </div>

      <BenchmarkInstruments />
    </div>
  )
}
