import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import {
  LayoutGrid, Library, KanbanSquare, Users, ShieldCheck, LineChart, Sparkles, Search, Moon, Sun,
  Lightbulb, RotateCcw, Layers, X, CircleAlert, ChevronRight,
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
  skills: 'Skill library',
  pipeline: 'Review pipeline',
  team: 'Team & access',
  governance: 'Governance',
  insights: 'Insights',
  playbook: 'Playbook',
}

export function Layout() {
  const { skills, members, policies, me, dispatch, toasts, dismiss, lens, setLens, skill, toast } = useStore()
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
            <div className="brand-sub">Acme Labs workspace</div>
          </span>
        </Link>
        {nav('/', 'Overview', LayoutGrid)}
        {nav('/skills', 'Skill library', Library, skills.length)}
        {nav('/pipeline', 'Review pipeline', KanbanSquare, inReview)}
        <div className="nav-label">Manage</div>
        {nav('/team', 'Team & access', Users)}
        {nav('/governance', 'Governance', ShieldCheck, violations.length, violations.some((v) => v.severity === 'critical'))}
        {nav('/insights', 'Insights', LineChart)}
        <div className="nav-label">Demo</div>
        {nav('/playbook', 'Playbook', Sparkles)}

        <div className="sidebar-foot">
          <div className="card" style={{ padding: 10 }}>
            <label className="label" htmlFor="viewas" style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 550 }}>Viewing as</label>
            <div className="row" style={{ marginTop: 6 }}>
              <Avatar member={me} />
              <select
                id="viewas"
                className="select"
                style={{ height: 30, fontSize: 12.5, fontWeight: 550 }}
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
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>Role: <b style={{ color: 'var(--ink-2)' }}>{me.role}</b> · switch to see permissions change</div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '0 2px' }}>
            <button className="btn ghost sm" onClick={() => setLens(!lens)} aria-pressed={lens} title="Toggle demo lens">
              <Lightbulb size={14} color={lens ? 'var(--accent)' : undefined} /> Lens {lens ? 'on' : 'off'}
            </button>
            <div className="row" style={{ gap: 2 }}>
              <button className="btn ghost sm icon" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}</button>
              <button className="btn ghost sm icon" onClick={() => setConfirmReset(true)} aria-label="Reset demo data" title="Reset demo data"><RotateCcw size={14} /></button>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Acme Labs</Link>
            <ChevronRight size={13} />
            {crumbSkill ? (
              <>
                <Link to="/skills">Skill library</Link>
                <ChevronRight size={13} />
                <span className="here">{crumbSkill.title}</span>
              </>
            ) : (
              <span className="here">{parts[1] === 'new' ? 'New skill' : TITLES[section] ?? 'Overview'}</span>
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
