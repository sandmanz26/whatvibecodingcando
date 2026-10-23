import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Library, FolderGit2, Users, HeartPulse, Search,
  Layers, ChevronRight,
} from 'lucide-react'
import { useStore } from '../store/store'
import { CommandPalette } from './CommandPalette'
import { Toasts } from './ui'

const TITLES: Record<string, string> = {
  '': 'Overview',
  skills: 'Skills',
  projects: 'Projects',
  teams: 'Teams',
  health: 'Health',
}

export function Layout() {
  const { skills, projects, open, skill, project } = useStore()
  const [palette, setPalette] = useState(false)
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  const parts = loc.pathname.split('/').filter(Boolean)
  const section = parts[0] ?? ''
  const crumb = section === 'skills' && parts[1] ? skill(parts[1])?.title : section === 'projects' && parts[1] ? project(parts[1])?.name : undefined

  const nav = (to: string, label: string, Icon: typeof LayoutGrid, count?: number, alert?: boolean) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={16} />
      {label}
      {count !== undefined && count > 0 && <span className={`count ${alert ? 'alert' : ''}`}>{count}</span>}
    </NavLink>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark"><Layers size={15} /></span>
          <span>
            <div className="brand-name">Skillhouse</div>
            <div className="brand-sub">Arunika Labs workspace</div>
          </span>
        </Link>
        {nav('/', 'Overview', LayoutGrid)}
        {nav('/skills', 'Skills', Library, skills.length)}
        {nav('/projects', 'Projects', FolderGit2, projects.length)}
        {nav('/teams', 'Teams', Users)}
        {nav('/health', 'Health', HeartPulse, open.length, open.some((v) => v.severity === 'high'))}
      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Arunika Labs</Link>
            <ChevronRight size={13} />
            {crumb ? (
              <>
                <Link to={`/${section}`}>{TITLES[section]}</Link>
                <ChevronRight size={13} />
                <span className="here">{crumb}</span>
              </>
            ) : (
              <span className="here">{TITLES[section] ?? 'Overview'}</span>
            )}
          </nav>
          <div className="spacer" />
          <button className="search-btn" onClick={() => setPalette(true)}>
            <Search size={14} /> <span className="label-text">Search or jump to…</span> <kbd>⌘K</kbd>
          </button>
        </header>
        <Outlet />
      </div>


      {palette && <CommandPalette onClose={() => setPalette(false)} />}


      <Toasts />
    </div>
  )
}
