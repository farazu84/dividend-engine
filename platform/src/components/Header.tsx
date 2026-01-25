import './Header.css'

export function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">ModernFi Liquidity Management</h1>
        <nav className="header-nav">
          <a href="#" className="header-nav-item">Markets</a>
          <a href="#" className="header-nav-item">Liquidity</a>
          <a href="#" className="header-nav-item">Compliance</a>
        </nav>
      </div>
      <div className="header-right">
        <div className="search-box">
          <span className="material-icons-outlined">search</span>
          <input type="text" placeholder="Search instruments..." />
        </div>
        <button className="notification-btn">
          <span className="material-icons-outlined">notifications</span>
        </button>
      </div>
    </header>
  )
}
