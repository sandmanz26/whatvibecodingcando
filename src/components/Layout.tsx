import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Library, KanbanSquare, Users, ShieldCheck, LineChart, Sparkles, Search, Moon, Sun,
  RotateCcw, Layers, X, CircleAlert, ChevronRight, MousePointerClick, ListChecks,
} from 'lucide-react'
import { useStore } from '../store/store'
import { evaluate } from '../lib/logic'
import { Avatar, Modal } from './ui'
import { CommandPalette } from './CommandPalette'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = document.documentElement.dataset.theme
    if (t === 'light' || t === 'dark') return t
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('skillhouse:theme', theme) } catch { /* ignore */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

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
  const { skills, members, policies, me, dispatch, toasts, dismiss, skill, toast } = useStore()
  const [theme, toggleTheme] = useTheme()
  const [palette, setPalette] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
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

        <div className="sidebar-foot">
          <label className="row viewas" htmlFor="viewas" title="Switch person to see permissions change">
            <Avatar member={me} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <select
                id="viewas"
                aria-label="Viewing as"
                value={me.id}
                onChange={(e) => {
                  dispatch({ type: 'setUser', id: e.target.value })
                  const m = members.find((x) => x.id === e.target.value)!
                  toast(`Now viewing as ${m.name} (${m.role})`)
                }}
              >
                {(['Admin', 'Maintainer', 'Member', 'Viewer'] as const).map((r) => (
                  <optgroup key={r} label={r}>
                    {members.filter((m) => m.role === r).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <small>{me.role}</small>
            </span>
            <button className="btn ghost sm icon" onClick={(e) => { e.preventDefault(); toggleTheme() }} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
            <button className="btn ghost sm icon" onClick={(e) => { e.preventDefault(); setConfirmReset(true) }} aria-label="Reset demo data" title="Reset demo data"><RotateCcw size={14} /></button>
          </label>
        </div>
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

      {confirmReset && (
        <Modal
          title="Reset demo data?"
          description="Every change you made — new skills, approvals, roles, policies — goes back to the original seed. Your theme and lens settings stay."
          onClose={() => setConfirmReset(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmReset(false)}>Keep my changes</button>
            <button className="btn primary" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); toast('Demo data reset') }}>Reset data</button>
          </>}
        />
      )}

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
