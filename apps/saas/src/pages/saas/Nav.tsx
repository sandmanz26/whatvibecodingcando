import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, Boxes, ChevronRight, Code2, LayoutDashboard, LifeBuoy, Settings, SlidersHorizontal, Sparkles, Users, Wrench, type LucideIcon } from 'lucide-react'
import type { Project } from '../../saas/account'

/**
 * The panel's sidebar, two levels deep so it stays short however many tools a project turns on:
 * Overview, then Setup (how the widget gets on the site) and Results (one entry per tool that
 * collects data, only for the tools that are on), then Team, Settings and the guide.
 */
interface Item { to: string; label: string; icon?: LucideIcon }
interface Group { id: string; label: string; icon: LucideIcon; items: Item[] }

/** Tools that collect something, and where their results are read. */
const RESULTS: { product: string; label: string; to: string }[] = [
  { product: 'comments', label: 'Comments', to: '/app/comments' },
  { product: 'compare', label: 'Component reviews', to: '/app/comments?kind=compare' },
  { product: 'narration', label: 'Voice notes', to: '/app/comments?kind=voice' },
  { product: 'usability', label: 'Usability tests', to: '/app/research?kind=usability' },
  { product: 'fivesec', label: '5-second tests', to: '/app/research?kind=fivesec' },
  { product: 'heatmap', label: 'Heatmaps', to: '/app/research?kind=browse' },
  { product: 'gaze', label: 'Eye tracking', to: '/app/research?kind=eyes' },
  { product: 'doors', label: 'Fake doors', to: '/app/research?kind=doors' },
  { product: 'insights', label: 'Sessions', to: '/app/research?tab=sessions' },
  { product: 'report', label: 'Report', to: '/app/report' },
]
const STUDY_TOOLS = ['usability', 'fivesec', 'heatmap', 'gaze', 'doors', 'insights']

export function groupsFor(project: Project | null): Group[] {
  const on = (id: string) => !!project?.products.includes(id)
  const results: Item[] = [
    ...(STUDY_TOOLS.some(on) ? [{ to: '/app/research', label: 'All studies' }] : []),
    ...RESULTS.filter((r) => on(r.product)).map(({ to, label }) => ({ to, label })),
  ]
  return [
    { id: 'setup', label: 'Setup', icon: Wrench, items: [
      { to: '/app/products', label: 'Products', icon: Boxes },
      { to: '/app/install', label: 'Install', icon: Code2 },
      { to: '/app/widget', label: 'Widget', icon: SlidersHorizontal },
      ...(on('prompts') ? [{ to: '/app/prompts', label: 'Build-it prompts', icon: Sparkles }] : []),
    ] },
    { id: 'results', label: 'Results', icon: BarChart3, items: results },
  ]
}

/** Whether a link is the page being shown: same path, and the same ?kind / ?tab (other params, like ?status, don't count). */
function isHere(to: string, pathname: string, search: string) {
  const [path, q = ''] = to.split('?')
  if (path !== pathname) return false
  const want = new URLSearchParams(q), have = new URLSearchParams(search)
  return ['kind', 'tab'].every((k) => (want.get(k) ?? '') === (have.get(k) ?? ''))
}

const OPEN_KEY = 'saas:nav:open'
function readOpen(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as Record<string, boolean> } catch { return {} } }

export function PanelNav({ project }: { project: Project | null }) {
  const { pathname, search } = useLocation()
  const groups = groupsFor(project)
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ setup: true, results: true, ...readOpen() }))
  // The group holding the page being shown always opens.
  useEffect(() => {
    const g = groups.find((x) => x.items.some((i) => isHere(i.to, pathname, search)))
    if (g && !open[g.id]) setOpen((o) => ({ ...o, [g.id]: true }))
  }, [pathname, search]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id: string) => setOpen((o) => { const n = { ...o, [id]: !o[id] }; try { localStorage.setItem(OPEN_KEY, JSON.stringify(n)) } catch { /* only a convenience */ } return n })
  const link = (i: Item, child = false) => {
    const here = isHere(i.to, pathname, search)
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
              {g.id === 'results' && <small className="up-navcount" aria-label={`${g.items.length} pages`}>{g.items.length}</small>}
              <ChevronRight size={14} className="up-navchev" aria-hidden />
            </button>
            <div id={id} className="up-navitems" hidden={!open[g.id]}>
              {g.items.length ? g.items.map((i) => link(i, true)) : <p className="up-navempty">Turn on a tool in <Link to="/app/products">Products</Link> to see its results here.</p>}
            </div>
          </div>
        )
      })}
      {link({ to: '/app/team', label: 'Team', icon: Users })}
      {link({ to: '/app/settings', label: 'Settings', icon: Settings })}
      {link({ to: '/guide', label: 'User guide', icon: LifeBuoy })}
    </nav>
  )
}

