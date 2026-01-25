import { useEffect, useState, useRef } from 'react'
import { OrderModal } from './OrderModal'
import './BenchmarkCard.css'

interface Observation {
  date: string
  yield_rate: number
}

interface SeriesData {
  series_id: string
  term: string
  maturity_months: number
  observations: Observation[]
}

export interface BenchmarkCardConfig {
  series_id: string
  term: string
  label: string
  ticker: string
  maturity_months: number
}

function MiniChart({ data, isPositive, seriesId }: { data: Observation[], isPositive: boolean, seriesId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size with device pixel ratio for sharpness
    const dpr = window.devicePixelRatio || 1
    const width = 80
    const height = 32
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get values and calculate scale
    const values = data.map(d => d.yield_rate)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 0.01
    const padding = range * 0.15

    // Calculate points
    const points: { x: number; y: number }[] = values.map((value, index) => ({
      x: (index / (values.length - 1)) * width,
      y: height - ((value - minValue + padding) / (range + padding * 2)) * height,
    }))

    const color = isPositive ? '#22c55e' : '#ef4444'

    ctx.beginPath()
    ctx.moveTo(points[0].x, height)
    points.forEach(point => ctx.lineTo(point.x, point.y))
    ctx.lineTo(points[points.length - 1].x, height)
    ctx.closePath()
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(1, `${color}00`)
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y))
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()

  }, [data, isPositive, seriesId])

  return <canvas className="mini-chart" ref={canvasRef}></canvas>
}

interface BenchmarkCardProps {
  config: BenchmarkCardConfig
}

export function BenchmarkCard({ config }: BenchmarkCardProps) {
  const [data, setData] = useState<SeriesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/yields/history/${config.series_id}`)
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error(`Failed to fetch ${config.series_id}`, err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [config.series_id])

  if (loading || !data || data.observations.length === 0) {
    return (
      <div className="benchmark-card">
        <div className="card-loading">Loading...</div>
      </div>
    )
  }

  const currentYield = data.observations[data.observations.length - 1].yield_rate
  const startYield = data.observations[0].yield_rate
  
  const change = currentYield - startYield
  const changeBps = change * 100
  const isPositive = change >= 0

  return (
    <>
      <div className="benchmark-card" onClick={() => setIsOrderModalOpen(true)}>
        <div className="card-header-row">
          <div className="card-info">
            <span className="card-label">{config.label}</span>
            <span className="card-ticker">{config.ticker}</span>
          </div>
          <div className="trend-icon">
            <span className={`material-icons-outlined ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? 'trending_up' : 'trending_down'}
            </span>
          </div>
        </div>
        <div className="card-body">
          <div className="yield-value">{currentYield.toFixed(3)}%</div>
          <MiniChart data={data.observations} isPositive={isPositive} seriesId={config.series_id} />
        </div>
        <div className="yield-change-row">
          <div className={`yield-change ${isPositive ? 'positive' : 'negative'}`}>
            <span className="material-icons-outlined">
              {isPositive ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {isPositive ? '+' : ''}{changeBps.toFixed(1)} bps
          </div>
          <span className="time-badge">7D</span>
        </div>
      </div>

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        seriesId={config.series_id}
        term={config.term}
        label={config.label}
        currentYield={currentYield}
        changeBps={changeBps}
      />
    </>
  )
}
