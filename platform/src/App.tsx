import { Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { OrderHistory } from './components/OrderHistory'
import './App.css'

function App() {
  const location = useLocation()
  const activeNav = location.pathname === '/history' ? 'orders' : 'dashboard'

  return (
    <div className="app-layout">
      <Sidebar activeNav={activeNav} />

      <div className="main-content">
        <Header />

        <main className="main-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<OrderHistory />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
