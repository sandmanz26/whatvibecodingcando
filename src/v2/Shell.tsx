import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Library, Inbox, PenLine, MousePointerClick, Search, X, CircleAlert } from 'lucide-react'
import { useStore } from '../store/store'
import { can } from '../lib/logic'
import { CommandPalette } from '../components/CommandPalette'
import { Face, Mark } from './bits'
import './v2.css'

export function V2Shell() {
  const { me, members, skills, dispatch, toast, toasts, dismiss } = useStore()
  const [palette, setPalette] = useState(false)
  const { pathname } = useLocation()

  // The review desk's count is a queue that needs this person's action.
  const waiting = skills.filter((s) => (s.stage === 'review' && can(me, 'skill.approve', s) && !s.approvals.includes(me.id)) || (s.stage === 'approved' && can(me, 'skill.publish', s))).length

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const nav = (to: string, label: string, Icon: typeof Home, count?: number, wideOnly = false) => (
    <NavLink to={to} end={to === '/v2'} className={({ isActive }) => `v2-nav ${isActive ? 'active' : ''} ${wideOnly ? 'wide-only' : ''}`}>
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
          {nav('/v2/shelf', 'The shelf', Library)}
          {nav('/v2/review', 'Review desk', Inbox, waiting)}
          {nav('/v2/write', 'Write a skill', PenLine)}
          <div className="v2-nav-group">Research</div>
          {nav('/console/insights', 'Clicks and tests', MousePointerClick, undefined, true)}
          <div className="v2-side-foot">
            <label className="v2-me">
              <Face member={me} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <select aria-label="Viewing as" value={me.id} onChange={(e) => {
                  dispatch({ type: 'setUser', id: e.target.value })
                  const m = members.find((x) => x.id === e.target.value)!
                  toast(`Now viewing as ${m.name} (${m.role})`)
                }}>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <small>{me.role} · {me.title}</small>
              </span>
            </label>
          </div>
        </aside>

        <header className="v2-top">
          <NavLink to="/v2" className="v2-phone-brand"><Mark size={24} />Skillhouse</NavLink>
          <button className="v2-btn ghost sm v2-phone-search" onClick={() => setPalette(true)} aria-label="Search"><Search size={16} /></button>
          <button className="v2-search" onClick={() => setPalette(true)}>
            <Search size={14} /> Find a skill, a person or a page <kbd>Ctrl K</kbd>
          </button>
        </header>

        <div className="v2-sheet">
          <Outlet />
        </div>
      </div>

      {palette && <CommandPalette v2 onClose={() => setPalette(false)} toggleTheme={() => {}} />}

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
