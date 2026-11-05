import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, ArrowLeft, MousePointerClick, ListChecks, Timer, DoorOpen, Eye, Palette, FileText, Lightbulb, ScanSearch, Mic, Sparkles, Columns2, Plug, Flame } from 'lucide-react'
import { Toasts } from './ui'

/**
 * The research console lives apart from the marketplace: it studies how people use the
 * marketplace (sessions, heatmaps, usability tests) and is not part of the product itself.
 */
export function ResearchLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    // The tool tabs scroll sideways when they don't fit; keep the current one in view.
    const seg = document.querySelector<HTMLElement>('.research-bar .seg')
    const on = seg?.querySelector<HTMLElement>('a.on')
    if (seg && on) {
      const s = seg.getBoundingClientRect(), o = on.getBoundingClientRect()
      if (o.left < s.left || o.right > s.right) seg.scrollLeft += o.left - s.left - (s.width - o.width) / 2
    }
  }, [pathname])
  return (
    <div className="research">
      <header className="topbar research-bar no-print">
        <span className="research-mark"><FlaskConical size={15} /> Research console</span>
        <nav className="seg" aria-label="Research tools">
          <NavLink to="/console/sessions" className={({ isActive }) => (isActive ? 'on' : '')}><MousePointerClick size={13} /> Sessions</NavLink>
          <NavLink to="/console/heatmap" className={({ isActive }) => (isActive ? 'on' : '')}><Flame size={13} /> Heatmap</NavLink>
          <NavLink to="/console/tests" className={({ isActive }) => (isActive ? 'on' : '')}><ListChecks size={13} /> Usability tests</NavLink>
          <NavLink to="/console/fivesec" className={({ isActive }) => (isActive ? 'on' : '')}><Timer size={13} /> 5-second tests</NavLink>
          <NavLink to="/console/doors" className={({ isActive }) => (isActive ? 'on' : '')}><DoorOpen size={13} /> Fake doors</NavLink>
          <NavLink to="/console/gaze" className={({ isActive }) => (isActive ? 'on' : '')}><Eye size={13} /> Eye tracking</NavLink>
          <NavLink to="/console/design" className={({ isActive }) => (isActive ? 'on' : '')}><Palette size={13} /> Design tokens</NavLink>
          <NavLink to="/console/dscheck" className={({ isActive }) => (isActive ? 'on' : '')}><ScanSearch size={13} /> DS check</NavLink>
          <NavLink to="/console/report" className={({ isActive }) => (isActive ? 'on' : '')}><FileText size={13} /> Report</NavLink>
          <NavLink to="/console/repo" className={({ isActive }) => (isActive ? 'on' : '')}><Lightbulb size={13} /> Insights</NavLink>
          <NavLink to="/console/compare" className={({ isActive }) => (isActive ? 'on' : '')}><Columns2 size={13} /> Compare</NavLink>
          <NavLink to="/console/narration" className={({ isActive }) => (isActive ? 'on' : '')}><Mic size={13} /> Narration</NavLink>
          <NavLink to="/console/prompts" className={({ isActive }) => (isActive ? 'on' : '')}><Sparkles size={13} /> Prompts</NavLink>
          <NavLink to="/console/install" className={({ isActive }) => (isActive ? 'on' : '')}><Plug size={13} /> Install</NavLink>
        </nav>
        <div className="spacer" />
        <Link to="/" className="btn sm"><ArrowLeft size={14} /> Back to the shop</Link>
      </header>
      <Outlet />
      <Toasts />
    </div>
  )
}
