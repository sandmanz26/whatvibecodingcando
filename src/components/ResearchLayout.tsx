import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, ArrowLeft, MousePointerClick, ListChecks, Timer, DoorOpen, Eye } from 'lucide-react'
import { Toasts } from './ui'

/**
 * The research console lives apart from Skillhouse: it studies how people use the
 * product (sessions, heatmaps, usability tests) and is not part of the product itself.
 */
export function ResearchLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="research">
      <header className="topbar research-bar">
        <span className="research-mark"><FlaskConical size={15} /> Research console</span>
        <nav className="seg" aria-label="Research tools">
          <NavLink to="/console/insights" className={({ isActive }) => (isActive ? 'on' : '')}><MousePointerClick size={13} /> Sessions</NavLink>
          <NavLink to="/console/tests" className={({ isActive }) => (isActive ? 'on' : '')}><ListChecks size={13} /> Usability tests</NavLink>
          <NavLink to="/console/fivesec" className={({ isActive }) => (isActive ? 'on' : '')}><Timer size={13} /> 5-second tests</NavLink>
          <NavLink to="/console/doors" className={({ isActive }) => (isActive ? 'on' : '')}><DoorOpen size={13} /> Fake doors</NavLink>
          <NavLink to="/console/gaze" className={({ isActive }) => (isActive ? 'on' : '')}><Eye size={13} /> Eye tracking</NavLink>
        </nav>
        <div className="spacer" />
        <Link to="/" className="btn sm"><ArrowLeft size={14} /> Back to Skillhouse</Link>
      </header>
      <Outlet />
      <Toasts />
    </div>
  )
}
