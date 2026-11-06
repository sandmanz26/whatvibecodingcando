import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ShoppingCart, Sparkles, Package } from 'lucide-react'
import { useStore } from '../store/store'
import { CATEGORIES } from '../data/shop'
import { Assistant } from './Assistant'
import { Toasts } from './ui'

/** The shop's frame: header with the AI search, category row, page, footer, assistant panel. */
export function Layout() {
  const { cartCount, ask } = useStore()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [q, setQ] = useState(params.get('q') ?? '')
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { if (pathname === '/search') setQ(params.get('q') ?? '') }, [pathname, params])

  return (
    <div className="shop">
      <header className="sh-head">
        <div className="sh-bar container">
          <Link to="/" className="sh-logo" aria-label="Marketplace home"><span className="sh-logo-box">LOGO</span><b>Marketplace</b></Link>
          <form className="sh-search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`) }}>
            <Sparkles size={16} className="sh-search-ai" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, or describe what you need — “running shoes under 500k”" aria-label="Search or describe what you need" />
            <button type="submit" className="btn primary" aria-label="Search"><Search size={15} /> Search</button>
          </form>
          <button id="ask-ai" className="btn" onClick={() => ask()}><Sparkles size={15} /> Ask AI</button>
          <Link to="/orders" className="btn ghost" aria-label="Orders"><Package size={15} /><span className="sh-txt">Orders</span></Link>
          <Link to="/cart" className="btn ghost sh-cart" aria-label={`Cart, ${cartCount} items`}><ShoppingCart size={16} /><span className="sh-txt">Cart</span>{cartCount > 0 && <span className="sh-count">{cartCount}</span>}</Link>
        </div>
        <nav className="sh-cats container" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <NavLink key={c.id} to={`/search?cat=${c.id}`} className={() => (pathname === '/search' && params.get('cat') === c.id && !params.get('q') ? 'on' : '')}>{c.name}</NavLink>
          ))}
          <span className="sh-cats-note">Prototype · sample products, AI answers are scripted</span>
        </nav>
      </header>
      <main className="sh-main container">
        <Outlet />
      </main>
      <footer className="sh-foot">
        <div className="container sh-foot-grid">
          <div><b>Marketplace</b><p className="muted">Lo-fi prototype for research.</p></div>
          <div><b>Help</b><p className="muted">Shipping · Returns · Contact</p></div>
          <div><b>Sell</b><p className="muted">Open a shop · Seller centre</p></div>
          <div><b>About</b><p className="muted">Company · Careers · Privacy</p></div>
        </div>
      </footer>
      <Assistant />
      <Toasts />
    </div>
  )
}
