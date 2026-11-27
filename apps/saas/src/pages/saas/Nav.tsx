import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Boxes, ChevronRight, Code2, FlaskConical, LayoutDashboard, LifeBuoy, MessageSquare, Settings, SlidersHorizontal, Users, Wrench, type LucideIcon } from 'lucide-react'
import type { Project } from '../../saas/account'

/**
 * The panel's sidebar, two levels deep so it stays short however many tools a project turns on:
 * Overview, Setup (how the widget gets on the site), Feedback (what people wrote or said) and
 * Research (studies and their results), then Reviewers, Settings and the guide.
 *
 * Exactly one item is active: the one whose path and ?kind / ?tab / ?module match the address; on
 * a page under it with no item of its own (a study's results, /app/research/<id>), the closest
 * parent path. Tools that are off are left out of the menu (Products is where they are turned on,
 * and the Research overview still lists them as Off), so the sidebar only shows places with data.
 */
interface Item { to: string; label: string; icon?: LucideIcon }
interface Group { id: string; label: string; icon: LucideIcon; items: Item[]; empty: string }

/** Feedback tools and where their results are read. */
const FEEDBACK: { product: string; label: string; to: string }[] = [
  { product: 'comments', label: 'Comments', to: '/app/comments' },
  { product: 'compare', label: 'Component reviews', to: '/app/comments?kind=compare' },
  { product: 'narration', label: 'Voice notes', to: '/app/comments?kind=voice' },
]
/** Research modules; each has a default (★) study and its results under Research. */
const RESEARCH: { product: string; label: string; to: string }[] = [
  { product: 'usability', label: 'Usability tests', to: '/app/research?module=usability' },
  { product: 'fivesec', label: '5-second tests', to: '/app/research?module=fivesec' },
  { product: 'heatmap', label: 'Heatmaps', to: '/app/research?module=heatmap' },
  { product: 'gaze', label: 'Eye tracking', to: '/app/research?module=gaze' },
  { product: 'insights', label: 'Participant paths', to: '/app/research?tab=sessions' },
]
const STUDY_TOOLS = ['usability', 'fivesec', 'heatmap', 'gaze', 'insights']

export function groupsFor(project: Project | null): Group[] {
  const on = (id: string) => !!project?.products.includes(id)
  const pick = (l: typeof FEEDBACK) => l.filter((r) => on(r.product)).map(({ to, label }) => ({ to, label }))
  const feedback: Item[] = [
    ...pick(FEEDBACK),
    // Review rounds: a project setting (Settings → Review rounds), not a tool.
    ...(project?.rounds?.on ? [{ to: '/app/rounds', label: 'Rounds' }] : []),
    ...(on('report') ? [{ to: '/app/report', label: 'Report' }] : []),
  ]
  const research: Item[] = [
    ...(STUDY_TOOLS.some(on) ? [{ to: '/app/research', label: 'All studies' }] : []),
    ...pick(RESEARCH),
  ]
  return [
    { id: 'setup', label: 'Setup', icon: Wrench, empty: '', items: [
      { to: '/app/products', label: 'Products', icon: Boxes },
      { to: '/app/install', label: 'Install', icon: Code2 },
      { to: '/app/widget', label: 'Widget', icon: SlidersHorizontal },
    ] },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare, empty: 'Turn on Comments in', items: feedback },
    { id: 'research', label: 'Research', icon: FlaskConical, empty: 'Turn on a research tool in', items: research },
  ]
}

export { activeOf } from '../../saas/nav-active'
import { activeOf } from '../../saas/nav-active'

const OPEN_KEY = 'saas:nav:open'
function readOpen(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as Record<string, boolean> } catch { return {} } }

export function PanelNav({ project }: { project: Project | null }) {
  const { pathname, search } = useLocation()
  const groups = groupsFor(project)
  const TOP = ['/app', '/app/reviewers', '/app/settings', '/guide']
  const active = activeOf([...TOP, ...groups.flatMap((g) => g.items.map((i) => i.to))], pathname, search)
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ setup: true, feedback: true, research: true, ...readOpen() }))
  // The group holding the page being shown always opens.
  useEffect(() => {
    const g = groups.find((x) => x.items.some((i) => i.to === active))
    if (g && !open[g.id]) setOpen((o) => ({ ...o, [g.id]: true }))
  }, [pathname, search]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem(OPEN_KEY, JSON.stringify(n)) } catch { /* only a convenience */ } return n })
  const link = (i: Item, child = false) => {
    const here = i.to === active
    const Icon = i.icon
    return <Link key={i.to} to={i.to} className={`${here ? 'active' : ''} ${child ? 'child' : ''}`} aria-current={here ? 'page' : undefined}>{Icon ? <Icon size={16} /> : <span className="up-navdot" aria-hidden />} {i.label}</Link>
  }
  return (
    <nav className="up-nav" aria-label="Panel">
      {link({ to: '/app', label: 'Overview', icon: LayoutDashboard })}
      {groups.map((g) => {
        const Icon = g.icon
        const id = `nav-${g.id}`
        return (
          <div key={g.id} className={`up-navgroup ${open[g.id] ? 'open' : ''}`}>
            <button type="button" className="up-navhead" aria-expanded={!!open[g.id]} aria-controls={id} onClick={() => toggle(g.id)}>
              <Icon size={16} /> <span className="lp-grow">{g.label}</span>
              <ChevronRight size={14} className="up-navchev" aria-hidden />
            </button>
            <div id={id} className="up-navitems" hidden={!open[g.id]}>
              {g.items.length ? g.items.map((i) => link(i, true)) : <p className="up-navempty">{g.empty} <Link to="/app/products">Products</Link> to see results here.</p>}
            </div>
          </div>
        )
      })}
      {link({ to: '/app/reviewers', label: 'Reviewers', icon: Users })}
      {link({ to: '/app/settings', label: 'Settings', icon: Settings })}
      {link({ to: '/guide', label: 'User guide', icon: LifeBuoy })}
    </nav>
  )
}

