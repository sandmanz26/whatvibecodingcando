import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, ArrowLeft, MousePointerClick, ListChecks, Timer, DoorOpen, Eye, Palette, FileText, Lightbulb, ScanSearch, Mic, Sparkles, Columns2, Plug, Flame, Menu, X } from 'lucide-react'
import { Toasts } from './ui'

const GROUPS: { title: string; links: { to: string; icon: typeof Flame; label: string }[] }[] = [
  { title: 'Behaviour', links: [
    { to: '/console/sessions', icon: MousePointerClick, label: 'Sessions' },
    { to: '/console/heatmap', icon: Flame, label: 'Heatmap' },
    { to: '/console/gaze', icon: Eye, label: 'Eye tracking' },
  ] },
  { title: 'Tests', links: [
    { to: '/console/tests', icon: ListChecks, label: 'Usability tests' },
    { to: '/console/fivesec', icon: Timer, label: '5-second tests' },
    { to: '/console/doors', icon: DoorOpen, label: 'Fake doors' },
  ] },
  { title: 'Design', links: [
    { to: '/console/compare', icon: Columns2, label: 'Compare' },
    { to: '/console/design', icon: Palette, label: 'Design tokens' },
    { to: '/console/dscheck', icon: ScanSearch, label: 'DS check' },
  ] },
  { title: 'Findings', links: [
    { to: '/console/narration', icon: Mic, label: 'Narration' },
    { to: '/console/report', icon: FileText, label: 'Report' },
    { to: '/console/repo', icon: Lightbulb, label: 'Insights' },
  ] },
  { title: 'Use it yourself', links: [
    { to: '/console/prompts', icon: Sparkles, label: 'Prompts' },
    { to: '/console/install', icon: Plug, label: 'Install' },
  ] },
]

/**
 * The research console lives apart from the marketplace: it studies how people use the
 * marketplace (sessions, heatmaps, usability tests) and is not part of the product itself.
 * Its tools are in a sidebar, grouped; on a phone the sidebar opens from the top bar.
 */
export function ResearchLayout() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { window.scrollTo(0, 0); setOpen(false) }, [pathname])
  const current = GROUPS.flatMap((g) => g.links).find((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))
  return (
    <div className={`research rs ${open ? 'menu-open' : ''}`}>
      <header className="rs-top no-print">
        <button className="btn ghost sm icon" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X size={16} /> : <Menu size={16} />}</button>
        <span className="research-mark"><FlaskConical size={15} /> {current?.label ?? 'Research console'}</span>
      </header>
      <aside className="rs-side no-print" aria-label="Research tools">
        <span className="research-mark rs-brand"><FlaskConical size={15} /> Research console</span>
        <Link to="/" className="btn sm rs-back"><ArrowLeft size={14} /> Back to the shop</Link>
        <nav className="rs-nav">
          {GROUPS.map((g) => (
            <div key={g.title} className="rs-group">
              <span className="rs-title">{g.title}</span>
              {g.links.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'on' : '')}><Icon size={15} /> {label}</NavLink>)}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="rs-scrim" onClick={() => setOpen(false)} />}
      <div className="rs-main"><Outlet /></div>
      <Toasts />
    </div>
  )
}
