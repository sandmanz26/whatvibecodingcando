import { NavLink } from 'react-router-dom'
import { MousePointerClick, ListChecks } from 'lucide-react'

/** Switches between the console's research tools. */
export function ConsoleNav() {
  return (
    <nav className="seg" aria-label="Research tools" style={{ marginBottom: 16 }}>
      <NavLink to="/console/insights" className={({ isActive }) => (isActive ? 'on' : '')}><MousePointerClick size={13} /> Sessions</NavLink>
      <NavLink to="/console/tests" className={({ isActive }) => (isActive ? 'on' : '')}><ListChecks size={13} /> Usability tests</NavLink>
    </nav>
  )
}
