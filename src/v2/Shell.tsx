import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Library, FolderGit2, HeartPulse, Search } from 'lucide-react'
import { useStore } from '../store/store'
import { Toasts } from '../components/ui'
import { CommandPalette } from '../components/CommandPalette'
import { Mark } from './bits'
import './v2.css'

export function V2Shell() {
  const { open } = useStore()
  const [palette, setPalette] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nav = (to: string, label: string, Icon: typeof Home, count?: number) => (
    <NavLink to={to} end={to === '/v2'} className={({ isActive }) => `v2-nav ${isActive ? 'active' : ''}`}>
      <Icon size={16} strokeWidth={1.6} />{label}{count ? <span className="count">{count}</span> : null}
    </NavLink>
  )

  return (
    <div className="v2">
      <div className="v2-shell">
        <aside className="v2-side" aria-label="Skillhouse">
          <NavLink to="/v2" className="v2-brand">
            <Mark />
            <div><b>Skillhouse</b><span>Arunika Labs</span></div>
          </NavLink>
          {nav('/v2', 'Home', Home)}
          {nav('/v2/shelf', 'Shelves', Library)}
          {nav('/v2/projects', 'Projects', FolderGit2)}
          {nav('/v2/tidy', 'Tidy up', HeartPulse, open.length)}
        </aside>

        <header className="v2-top">
          <NavLink to="/v2" className="v2-phone-brand"><Mark size={24} />Skillhouse</NavLink>
          <button className="v2-btn ghost sm v2-phone-search" onClick={() => setPalette(true)} aria-label="Search"><Search size={16} /></button>
          <button className="v2-search" onClick={() => setPalette(true)}>
            <Search size={14} /> Find a skill or a project <kbd>Ctrl K</kbd>
          </button>
        </header>

        <div className="v2-sheet">
          <Outlet />
        </div>
      </div>

      {palette && <CommandPalette v2 onClose={() => setPalette(false)} />}

      <Toasts />
    </div>
  )
}
