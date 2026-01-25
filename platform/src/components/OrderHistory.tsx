import { useEffect, useState, useRef } from 'react'
import './OrderHistory.css'

interface Order {
  id: number
  user_id: number
  series_id: string
  term: string
  amount: number
  yield_rate: number
  status: string
  ordered_at: string
}

const ITEMS_PER_PAGE = 5

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [maturityFilter, setMaturityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    const fetchOrders = async () => {
      try {
        const response = await fetch('http://localhost:8000/orders?user_id=1')
        const data = await response.json()
        setOrders(data)
      } catch (err) {
        console.error('Failed to fetch orders', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const filteredOrders = orders.filter(order => {
    if (maturityFilter !== 'all' && order.term !== maturityFilter) return false
    if (statusFilter !== 'all' && order.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC'
    }) + ' EST'
  }

  const formatAmount = (amount: number) => {
    return '$' + amount.toLocaleString('en-US')
  }

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled': return 'status-filled'
      case 'pending': return 'status-pending'
      case 'cancelled': return 'status-cancelled'
      default: return ''
    }
  }

  const getInstrumentLabel = (term: string) => {
    return `US ${term} Treasury`
  }

  const uniqueTerms = [...new Set(orders.map(o => o.term))].sort((a, b) => {
    const aNum = parseInt(a)
    const bNum = parseInt(b)
    return aNum - bNum
  })

  if (loading) {
    return (
      <div className="order-history">
        <div className="loading">Loading orders...</div>
      </div>
    )
  }

  return (
    <div className="order-history">
      <div className="history-header">
        <div className="header-breadcrumb">
          <span className="breadcrumb-path">ModernFi</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Order History</span>
        </div>
        <h1>Order History</h1>
        <p>Review and manage your historical treasury trades.</p>
      </div>

      <div className="filters-row">
        <div className="filter-group">
          <label>Maturity:</label>
          <select 
            value={maturityFilter} 
            onChange={(e) => { setMaturityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All</option>
            {uniqueTerms.map(term => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All</option>
            <option value="filled">Filled</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="orders-table">
        <div className="table-header">
          <div className="col-date">TRADE DATE/TIME</div>
          <div className="col-instrument">INSTRUMENT</div>
          <div className="col-side">SIDE</div>
          <div className="col-status">STATUS</div>
          <div className="col-yield">YIELD (%)</div>
          <div className="col-quantity">QUANTITY (PAR)</div>
        </div>

        {paginatedOrders.length === 0 ? (
          <div className="no-orders">No orders found</div>
        ) : (
          paginatedOrders.map((order) => (
            <div key={order.id} className="table-row">
              <div className="col-date">
                <span className="date-primary">{formatDate(order.ordered_at)}</span>
                <span className="date-secondary">{formatTime(order.ordered_at)}</span>
              </div>
              <div className="col-instrument">
                <span className="instrument-name">{getInstrumentLabel(order.term)}</span>
              </div>
              <div className="col-side">
                <span className="side-indicator buy">
                  <span className="material-icons-outlined">arrow_upward</span>
                  BUY
                </span>
              </div>
              <div className="col-status">
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              <div className="col-yield">
                <span className="yield-value">{order.yield_rate.toFixed(3)}%</span>
              </div>
              <div className="col-quantity">
                <span className="quantity-value">{formatAmount(order.amount)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 0 && (
        <div className="pagination">
          <span className="pagination-info">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length} results
          </span>
          <div className="pagination-controls">
            <button 
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <span className="material-icons-outlined">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
              let pageNum = i + 1
              if (totalPages > 3 && currentPage > 2) {
                pageNum = currentPage - 1 + i
                if (pageNum > totalPages) pageNum = totalPages - (2 - i)
              }
              return (
                <button
                  key={pageNum}
                  className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}
            <button 
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <span className="material-icons-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
