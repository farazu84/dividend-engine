import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, IChartApi, AreaSeries, Time } from 'lightweight-charts'
import './YieldCurve.css'

interface YieldPoint {
  term: string
  maturity_months: number
  yield_rate: number
  date: string
}

export function YieldCurve() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [yields, setYields] = useState<YieldPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const fetchedRef = useRef(false)

  const fetchYields = useCallback(async (date?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = date 
        ? `http://localhost:8000/yields?date=${date}`
        : 'http://localhost:8000/yields'
      const response = await fetch(url)
      const data = await response.json()
      setYields(data.yields)
      if (data.yields.length > 0) {
        const returnedDate = data.yields[0].date
        // Set the date picker to the returned date if no date was specified
        if (!date) {
          setSelectedDate(returnedDate)
        }
      }
    } catch (err) {
      setError('Failed to fetch yield data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchYields()
  }, [fetchYields])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value
    setSelectedDate(date)
    if (date) {
      fetchYields(date)
    } else {
      fetchYields()
    }
  }

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

  return (
    <div className="yield-curve-card">
      <div className="card-header">
        <div className="card-title">
          <h2>Treasury Yield Curve</h2>
          <div className="card-subtitle">
            <span>Yield spread across fixed income maturities</span>
            <span className="date-separator">•</span>
            <span className="date-label">As of</span>
            <div className="date-picker-wrapper">
              <input
                type="date"
                className="date-picker"
                value={selectedDate}
                onChange={handleDateChange}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>
        <div className="curve-legend">
          <span className="legend-item">
            <span className="dot live"></span>
            {selectedDate ? 'HISTORICAL' : 'LIVE CURVE'}
          </span>
        </div>
      </div>
      
      {loading ? (
        <div className="yield-curve-loading">Loading yield data...</div>
      ) : error ? (
        <div className="yield-curve-error">{error}</div>
      ) : yields.length === 0 ? (
        <div className="yield-curve-no-data">No Market Data</div>
      ) : (
        <div className="chart-container" ref={chartContainerRef}></div>
      )}
    </div>
  )
}
