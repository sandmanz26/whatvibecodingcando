import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Library, KanbanSquare, Users, ShieldCheck, LineChart, Sparkles, Search,
  Layers, X, CircleAlert, ChevronRight, MousePointerClick, ListChecks,
} from 'lucide-react'
import { useStore } from '../store/store'
import { evaluate } from '../lib/logic'
import { CommandPalette } from './CommandPalette'
import { useTheme } from '../lib/theme'

const TITLES: Record<string, string> = {
  '': 'Overview',
  skills: 'Skills',
  pipeline: 'Review',
  team: 'People',
  governance: 'Rules',
  insights: 'Value',
  playbook: 'Demo guide',
  console: 'Sessions',
}

export function Layout() {
  const { skills, members, policies, toasts, dismiss, skill } = useStore()
  const [, toggleTheme] = useTheme()
  const [palette, setPalette] = useState(false)
  const loc = useLocation()

  const violations = useMemo(() => evaluate(skills, members, policies), [skills, members, policies])
  const inReview = skills.filter((s) => s.stage === 'review').length

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
  const crumbSkill = section === 'skills' && parts[1] && parts[1] !== 'new' ? skill(parts[1]) : undefined

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
        {nav('/pipeline', 'Review', KanbanSquare, inReview)}
        {nav('/team', 'People', Users)}
        {nav('/governance', 'Rules', ShieldCheck, violations.length, violations.some((v) => v.severity === 'critical'))}
        {nav('/insights', 'Value', LineChart)}
        <div className="nav-label">Research</div>
        {nav('/console/insights', 'Sessions', MousePointerClick)}
        {nav('/console/tests', 'Usability tests', ListChecks)}
        {nav('/playbook', 'Demo guide', Sparkles)}

      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Arunika Labs</Link>
            <ChevronRight size={13} />
            {crumbSkill ? (
              <>
                <Link to="/skills">Skills</Link>
                <ChevronRight size={13} />
                <span className="here">{crumbSkill.title}</span>
              </>
            ) : (
              <span className="here">{parts[1] === 'new' ? 'New skill' : section === 'console' && parts[1] === 'tests' ? 'Usability tests' : TITLES[section] ?? 'Overview'}</span>
            )}
          </nav>
          <div className="spacer" />
          <button className="search-btn" onClick={() => setPalette(true)}>
            <Search size={14} /> <span className="label-text">Search or jump to…</span> <kbd>⌘K</kbd>
          </button>
        </header>
        <Outlet />
      </div>


      {palette && <CommandPalette onClose={() => setPalette(false)} toggleTheme={toggleTheme} />}


      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'error' && <CircleAlert size={15} />}
            {t.text}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
