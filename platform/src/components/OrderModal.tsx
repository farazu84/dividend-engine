import { useState } from 'react'
import './OrderModal.css'

interface OrderModalProps {
  isOpen: boolean
  onClose: () => void
  seriesId: string
  term: string
  label: string
  currentYield: number
  changeBps: number
}

export function OrderModal({ 
  isOpen, 
  onClose, 
  seriesId, 
  term, 
  label, 
  currentYield, 
  changeBps 
}: OrderModalProps) {
  const [amount, setAmount] = useState('')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitYield, setLimitYield] = useState(currentYield.toFixed(3))
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatAmount = (value: string) => {
    const num = value.replace(/[^0-9]/g, '')
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || /^\d+$/.test(raw)) {
      setAmount(raw)
    }
  }

  const setMinAmount = () => setAmount('100000')
  const setMaxAmount = () => setAmount('50000000')

  const handleLimitYieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d{0,3}$/.test(value)) {
      setLimitYield(value)
    }
  }

  const handleSubmit = async () => {
    const numericAmount = parseInt(amount, 10)
    if (!numericAmount || numericAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const yieldToSubmit = orderType === 'limit' ? parseFloat(limitYield) : currentYield
    if (orderType === 'limit' && (isNaN(yieldToSubmit) || yieldToSubmit <= 0)) {
      alert('Please enter a valid target yield')
      return
    }

    // For buy limit orders, target yield must be higher than current yield
    // (higher yield = lower price, so we're waiting for a better buying opportunity)
    if (orderType === 'limit' && yieldToSubmit <= currentYield) {
      alert(`For a limit buy order, the target yield must be higher than the current market yield (${currentYield.toFixed(3)}%). A higher yield means a lower bond price.`)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('http://localhost:8000/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1, // Stubbed user_id
          series_id: seriesId,
          term: term,
          amount: numericAmount,
          yield_rate: yieldToSubmit,
          order_type: orderType,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to place order')
      }

      onClose()
    } catch (err) {
      console.error('Order submission failed:', err)
      alert('Failed to place order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPositive = changeBps >= 0
  const limitYieldNum = parseFloat(limitYield)
  const isLimitYieldValid = orderType === 'market' || (limitYieldNum > currentYield)

  return (
    <div className="order-modal-overlay" onClick={handleOverlayClick}>
      <div className="order-modal">
        <div className="order-modal-header">
          <div className="order-modal-title">
            <h2>Submit Order</h2>
            <p>{label} (Benchmark)</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <div className="yield-display">
          <span className="yield-label">CURRENT MARKET YIELD</span>
          <div className="yield-value-row">
            <span className="yield-value">{currentYield.toFixed(3)}%</span>
            <span className={`yield-change ${isPositive ? 'positive' : 'negative'}`}>
              <span className="material-icons-outlined">
                {isPositive ? 'trending_up' : 'trending_down'}
              </span>
              {isPositive ? '+' : ''}{changeBps.toFixed(1)}bp
            </span>
          </div>
          <div className="market-status">
            <span className="status-dot"></span>
            LIVE MARKET DATA
          </div>
        </div>

        <div className="order-form">
          <div className="form-group">
            <div className="form-label-row">
              <label>QUANTITY</label>
              <span className="form-hint">USD PAR VALUE</span>
            </div>
            <div className="amount-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="text"
                value={formatAmount(amount)}
                onChange={handleAmountChange}
                className="amount-input"
              />
              <div className="amount-buttons">
                <button onClick={setMinAmount}>MIN</button>
                <button onClick={setMaxAmount}>MAX</button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>ORDER TYPE</label>
            <div className="order-type-buttons">
              <button 
                className={`order-type-btn ${orderType === 'market' ? 'active' : ''}`}
                onClick={() => setOrderType('market')}
              >
                <span className="type-name">Market</span>
                <span className="type-desc">Best Yield</span>
              </button>
              <button 
                className={`order-type-btn ${orderType === 'limit' ? 'active' : ''}`}
                onClick={() => setOrderType('limit')}
              >
                <span className="type-name">Limit</span>
                <span className="type-desc">Target Yield</span>
              </button>
            </div>
          </div>

          {orderType === 'limit' && (
            <div className="form-group">
              <div className="form-label-row">
                <label>TARGET YIELD</label>
                <span className="form-hint">MUST BE &gt; {currentYield.toFixed(3)}%</span>
              </div>
              <div className={`yield-input-wrapper ${!isLimitYieldValid && limitYield ? 'invalid' : ''}`}>
                <input
                  type="text"
                  value={limitYield}
                  onChange={handleLimitYieldChange}
                  className="yield-input"
                  placeholder="0.000"
                />
                <span className="yield-symbol">%</span>
              </div>
              {!isLimitYieldValid && limitYield && (
                <span className="validation-error">Target yield must be higher than current market yield</span>
              )}
            </div>
          )}

          <div className="order-info">
            <span className="material-icons-outlined info-icon">info</span>
            {orderType === 'market' ? (
              <p>
                Executing at market will prioritize the current yield of <strong>{currentYield.toFixed(3)}%</strong>.
              </p>
            ) : (
              <p>
                Buy limit order will execute when yield rises to <strong>{limitYield || '0.000'}%</strong> (lower price). Target must be above current yield.
              </p>
            )}
          </div>

          <button 
            className="submit-btn" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            <span className="material-icons-outlined">bolt</span>
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
