import { useMemo, useState } from 'react'
import { Columns2, Image as ImageIcon } from 'lucide-react'
import { alignPoint, type Box, type Pt } from '../../core/snapalign'
import { loadLocal, localSnapshotUrl, layoutNo } from '../../core/embed/localheat'

/**
 * Heatmaps drawn on a page snapshot (a masked picture of the page, saved once per page, layout and
 * device). Without a snapshot yet: the schematic (the page's width, grey). Layouts are never mixed:
 * each (page, layout) has its own map; a page whose layout changed says so and offers a compare.
 */
export interface Snap { url: string; vw: number; width: number; height: number; boxes: Record<string, Box> }
export interface HeatGroup { page: string; layout: number; since: string | null; points: Pt[]; people: number; snap: Snap | null }

const cssHeight = (s: Snap) => Math.round(s.height * (s.vw / Math.max(1, s.width)))

export function SnapshotHeat({ snap, points, kind = 'click', small, label }: { snap: Snap | null; points: Pt[]; kind?: 'click' | 'gaze'; small?: boolean; label: string }) {
  const vw = snap?.vw ?? Math.max(320, ...points.map((p) => p.vw ?? 0))
  const meta = snap ? { vw: snap.vw, height: cssHeight(snap), boxes: snap.boxes } : { vw, height: Math.max(600, ...points.map((p) => ((p.y ?? 0) * vw) / Math.max(1, p.vw ?? vw) + 40)), boxes: {} }
  const placed = useMemo(() => points.map((p) => alignPoint(p, meta)).filter((x): x is NonNullable<typeof x> => !!x), [points, meta.vw, meta.height]) // eslint-disable-line react-hooks/exhaustive-deps
  const r = Math.max(18, meta.vw / 40) * (kind === 'gaze' ? 2.2 : 1)
  const id = `sh${Math.abs([...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`
  return (
    <svg className={`sh-pic ${small ? 'small' : ''}`} viewBox={`0 0 ${meta.vw} ${meta.height}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`${label}: ${placed.length} ${kind === 'gaze' ? 'gaze points' : 'clicks'}${snap ? ' on a snapshot of the page' : ' (schematic, no snapshot yet)'}`} data-snapshot={snap ? 'yes' : 'no'}>
      <defs><radialGradient id={id}><stop offset="0" stopColor={kind === 'gaze' ? '#2563eb' : '#ef4444'} stopOpacity="0.55" /><stop offset="1" stopColor={kind === 'gaze' ? '#2563eb' : '#ef4444'} stopOpacity="0" /></radialGradient></defs>
      {snap ? <image href={snap.url} x="0" y="0" width={meta.vw} height={meta.height} preserveAspectRatio="none" /> : <rect x="0" y="0" width={meta.vw} height={meta.height} className="gz-page" />}
      {placed.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={r} fill={`url(#${id})`} />)}
    </svg>
  )
}

/** The note and compare for a page whose layout changed. */
export function LayoutSplit({ groups, kind = 'click' }: { groups: HeatGroup[]; kind?: 'click' | 'gaze' }) {
  const [compare, setCompare] = useState(false)
  const [pick, setPick] = useState(0)
  const known = groups.filter((g) => g.layout > 0).sort((a, b) => b.layout - a.layout)
  const g = groups[Math.min(pick, groups.length - 1)]
  const changed = known.length > 1 ? known[0] : null
  const name = (x: HeatGroup) => (x.layout ? `Layout ${x.layout}${x.since ? ` · since ${new Date(x.since).toLocaleDateString()}` : ''}` : 'Unknown layout (before layout tracking)')
  return (
    <div className="sh-page" data-layout-page={groups[0]?.page}>
      <div className="up-row wrap"><code className="lp-grow">{groups[0]?.page}</code>
        {groups.length > 1 && <div className="seg" role="group" aria-label="Layout">{groups.map((x, i) => <button key={x.layout} aria-pressed={!compare && i === pick} onClick={() => { setPick(i); setCompare(false) }} data-layout={x.layout}>{x.layout ? `Layout ${x.layout}` : 'Unknown'}</button>)}</div>}
        {known.length > 1 && <button className="lp-btn sm ghost" aria-pressed={compare} onClick={() => setCompare(!compare)} data-layout-compare=""><Columns2 size={13} /> Compare</button>}
      </div>
      {changed && <p className="up-warn" data-layout-changed="">Layout changed on {changed.since ? new Date(changed.since).toLocaleDateString() : 'a later date'} — results split into before/after.</p>}
      {compare && known.length > 1 ? (
        <div className="sh-compare">{[known[1], known[0]].map((x) => <figure key={x.layout}><SnapshotHeat snap={x.snap} points={x.points} kind={kind} label={`${x.page} ${name(x)}`} /><figcaption className="up-muted">{name(x)} · {x.people} {x.people === 1 ? 'person' : 'people'}</figcaption></figure>)}</div>
      ) : g && (
        <figure><SnapshotHeat snap={g.snap} points={g.points} kind={kind} label={`${g.page} ${name(g)}`} /><figcaption className="up-muted">{name(g)} · {g.people} {g.people === 1 ? 'person' : 'people'} · {g.snap ? 'drawn on a snapshot of the page (fields emptied, private parts greyed)' : <><ImageIcon size={12} /> schematic: no snapshot of this layout yet</>}</figcaption></figure>
      )}
    </div>
  )
}

/** Groups events into (page, layout) maps. layoutOf: event → layout number and its start (0 = unknown). */
export function groupByLayout<E extends Pt & { page: string; run_id?: string; r?: string }>(events: E[], layoutOf: (e: E) => { n: number; since: string | null }, snapOf: (page: string, n: number) => Snap | null): HeatGroup[][] {
  const pages = new Map<string, Map<number, { since: string | null; points: E[]; people: Set<string> }>>()
  for (const e of events) {
    const l = layoutOf(e)
    const m = pages.get(e.page) ?? new Map(); pages.set(e.page, m)
    const g = m.get(l.n) ?? { since: l.since, points: [], people: new Set<string>() }; m.set(l.n, g)
    g.points.push(e); g.people.add(e.run_id ?? e.r ?? '')
  }
  return [...pages].map(([page, m]) => [...m].sort((a, b) => b[0] - a[0]).map(([n, g]) => ({ page, layout: n, since: g.since, points: g.points, people: g.people.size, snap: snapOf(page, n) })))
}

/** The demo (no server): this browser's heatmap clicks, per page and layout, on the demo's snapshots. */
export function LocalPageHeat({ project, kind = 'click' }: { project: string; kind?: 'click' | 'gaze' }) {
  const s = loadLocal(project)
  const evs = s.events.filter((e) => e.kind === kind && !s.runs.find((r) => r.id === e.r)?.excluded)
  if (!evs.length) return null
  const groups = groupByLayout(evs, (e) => { const n = layoutNo(s, e.page, e.lh); return { n, since: n ? new Date(s.layouts!.find((l) => l.page === e.page && l.n === n)!.since).toISOString() : null } }, (page, n) => {
    const x = (s.snaps ?? []).find((y) => y.page === page && y.n === n && y.taken)
    const url = x ? localSnapshotUrl(project, x.path) : null
    return x && url ? { url, vw: x.vw, width: x.width, height: x.height, boxes: x.boxes } : null
  })
  return (
    <div className="sh-list" data-local-heat={kind}>
      <h3>{kind === 'gaze' ? 'Where people looked' : 'Clicks'} by page</h3>
      {groups.map((g) => <LayoutSplit key={g[0].page} groups={g} kind={kind} />)}
    </div>
  )
}
