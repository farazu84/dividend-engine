import { Link } from 'react-router-dom'
import './Sidebar.css'

interface SidebarProps {
  activeNav: string
}

export function Sidebar({ activeNav }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <span className="material-icons-outlined">account_balance</span>
          </div>
          <div className="logo-text">
            <span className="logo-title">ModernFi</span>
            <span className="logo-subtitle">LIQUIDITY MANAGEMENT</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
        >
          <span className="material-icons-outlined">dashboard</span>
          Dashboard
        </Link>
        <Link
          to="/history"
          className={`nav-item ${activeNav === 'orders' ? 'active' : ''}`}
        >
          <span className="material-icons-outlined">history</span>
          Order History
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" alt="User" />
          </div>
          <div className="user-details">
            <span className="user-name">A. Henderson</span>
            <span className="user-role">Senior Treasurer</span>
          </div>
          <button className="settings-btn">
            <span className="material-icons-outlined">settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
