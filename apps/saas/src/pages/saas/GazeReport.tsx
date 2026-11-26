import { useMemo, useState } from 'react'
import { Eye, ExternalLink, Flame, TriangleAlert } from 'lucide-react'
import { gazeReport, pageRows, GOOD_ACC, MIN_PEOPLE, type GazeEvent, type GazeRun, type PageReport } from '../../saas/gaze-report'
import type { Interval } from '../../core/heatstats'
import type { Snap } from './SnapshotHeat'

/**
 * Eye-tracking results (Labs) for one study: a summary row, then a sortable page table beside a
 * detail pane (below it on phones) with a large preview of where people's eyes rested, and per page the elements people looked at (with 95% ranges), what they looked
 * at first, and how looking compares with clicking on the same page.
 */
const pct = (x: number) => `${Math.round(x * 100)}%`
const range = (c: Interval) => `${Math.round(c.lo * 100)}–${Math.round(c.hi * 100)}%`
const secs = (ms: number | null) => (ms == null ? '–' : ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`)

/** A share with its 95% range: the bar is the share, the whisker the range (0–100% scale). */
function ShareBar({ c, label, muted }: { c: Interval; label: string; muted?: boolean }) {
  return (
    <span className="gz-share">
      <svg viewBox="0 0 100 12" width="72" height="12" role="img" aria-label={`${label}: ${pct(c.p)}, 95% range ${range(c)}`} className={muted ? 'gz-muted' : ''}>
        <rect x="0" y="3" width="100" height="6" rx="3" className="gz-track" />
        <rect x="0" y="3" width={Math.max(1, c.p * 100)} height="6" rx="3" className="gz-bar" />
        <line x1={c.lo * 100} x2={c.hi * 100} y1="6" y2="6" className="gz-ci" />
        <line x1={c.lo * 100} x2={c.lo * 100} y1="2" y2="10" className="gz-ci" />
        <line x1={c.hi * 100} x2={c.hi * 100} y1="2" y2="10" className="gz-ci" />
      </svg>
      <b>{pct(c.p)}</b>
    </span>
  )
}

/** Where eyes rested: on the page's snapshot when there is one, else a schematic of the page's width. */
function Preview({ p, big, snap }: { p: PageReport; big?: boolean; snap?: Snap | null }) {
  const maxDur = Math.max(1, ...p.dots.map((d) => d.dur))
  const sh = snap ? Math.round(snap.height * (snap.vw / Math.max(1, snap.width)) * (p.vw / snap.vw)) : 0
  return (
    <svg className={`gz-thumb ${big ? 'big' : ''}`} viewBox={`0 0 ${p.vw} ${p.height}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`Preview of ${p.page}: ${p.dots.length} fixations from ${p.people} people`}>
      {snap ? <image href={snap.url} x="0" y="0" width={p.vw} height={sh} preserveAspectRatio="none" data-snapshot="yes" /> : <rect x="0" y="0" width={p.vw} height={p.height} className="gz-page" />}
      {p.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={10 + 30 * Math.sqrt(d.dur / maxDur)} className="gz-dot" />)}
    </svg>
  )
}

type SortKey = 'people' | 'fixations' | 'page'
/** Snapshots for the report's project: on/off (null = unknown or no server) and the switch. */
export interface SnapshotsSwitch { on: boolean | null; toggle: () => Promise<void> }

/** Where the picture of a page comes from, said inline under the drawing. */
function SnapNote({ has, sw }: { has: boolean; sw?: SnapshotsSwitch }) {
  const [busy, setBusy] = useState(false)
  if (has || !sw || sw.on === null) return null
  if (sw.on) return <p className="up-muted gz-snapnote" data-gz-snap="waiting">The next visit will save a picture of this page; the dots are drawn on it from then on.</p>
  return (
    <div className="gz-snapcard" data-gz-snap="off">
      <div className="lp-grow"><b>Turn on page snapshots to see the page here</b>
        <p className="up-muted">Once per page layout and device, a team member’s, reviewer’s or study participant’s browser (never a visitor’s) saves one picture of the page, with every form field emptied and private parts greyed out. Only your team sees it. New visits will have the picture; past visits stay as dots.</p></div>
      <button className="lp-btn sm primary" disabled={busy} role="switch" aria-checked={false} onClick={() => { setBusy(true); void sw.toggle().finally(() => setBusy(false)) }} data-gz-snap-on="">{busy ? 'Turning on…' : 'Turn on'}</button>
    </div>
  )
}

export function GazeReport({ runs, events, sample, onView, snapFor, snapshots }: { runs: GazeRun[]; events: GazeEvent[]; sample?: boolean; onView?: (page: string, kind: 'click' | 'gaze') => void; snapFor?: (page: string) => Snap | null; snapshots?: SnapshotsSwitch }) {
  const r = useMemo(() => gazeReport(runs, events), [runs, events])
  const rowsAll = useMemo(() => pageRows(r.pages), [r])
  const [pick, setPick] = useState<string | null>(null)
  const [lay, setLay] = useState(0)
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: 'people', desc: true })
  if (!r.participants && !r.pages.length) return null
  const rows = [...rowsAll].sort((a, b) => {
    const d = sort.k === 'page' ? a.page.localeCompare(b.page) : sort.k === 'people' ? a.people - b.people || a.fixations - b.fixations : a.fixations - b.fixations
    return sort.desc ? -d : d
  })
  const row = rowsAll.find((x) => x.page === pick) ?? rows[0]
  const page = row ? row.layouts[Math.min(lay, row.layouts.length - 1)] : undefined
  const accN = runs.filter((x) => x.gaze_accuracy != null).length
  const th = (k: SortKey, label: string, title?: string) => (
    <th aria-sort={sort.k === k ? (sort.desc ? 'descending' : 'ascending') : 'none'} title={title}>
      <button type="button" className="gz-sort" onClick={() => setSort(sort.k === k ? { k, desc: !sort.desc } : { k, desc: k !== 'page' })}>{label}{sort.k === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  )
  const snap = page ? snapFor?.(page.page) ?? null : null
  return (
    <section className="up-card gz" data-gaze-report="">
      <div className="up-row"><h2 className="lp-grow"><Eye size={16} /> Eye tracking</h2><span className="up-badge st-ongoing">Labs</span>{sample && <span className="up-badge pending">Sample data</span>}</div>
      <p className="up-muted">Webcam eye tracking is an estimate: read areas, not exact points. Only people who agreed and calibrated. {sample ? 'These numbers are made up, to show what the report looks like; a real study replaces them.' : ''}</p>
      <div className="gz-sum" data-gz-summary="">
        <span><b>{r.participants}</b> {r.participants === 1 ? 'person' : 'people'} with eye tracking</span>
        <span title={accN ? `95% range ${range(r.goodShare)}` : undefined}><b>{accN ? pct(r.goodShare.p) : '–'}</b> good calibration {accN ? <small className="up-muted">({r.good} of {accN}, ≤ {GOOD_ACC} px)</small> : <small className="up-muted">(not measured)</small>}</span>
        <span><b>{r.medianAcc == null ? '–' : `${Math.round(r.medianAcc)} px`}</b> median accuracy</span>
        <span><b>{r.corrected}</b> drift-corrected with their clicks</span>
        <span><b>{rowsAll.length}</b> {rowsAll.length === 1 ? 'page' : 'pages'}</span>
      </div>
      {r.participants > 0 && r.participants < MIN_PEOPLE && <p className="up-warn"><TriangleAlert size={13} /> Fewer than {MIN_PEOPLE} people: treat this as anecdotes, not results.</p>}

      <div className="gz-split">
        <div className="gz-list">
          <table className="db-table gz-pagetable" data-gz-pages="">
            <thead><tr><th aria-label="Preview" />{th('page', 'Page')}{th('people', 'People', 'Different people (runs) with eye tracking on this page, all layouts')}{th('fixations', 'Fixations')}<th>Most looked at</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.page} className={x === row ? 'on' : ''} data-gaze-page={x.page} onClick={() => { setPick(x.page); setLay(0) }}>
                <td className="gz-mini"><Preview p={x.layouts[0]} snap={snapFor?.(x.layouts[0].page)} /></td>
                <td><button type="button" className="gz-pagelink" aria-pressed={x === row} onClick={(e) => { e.stopPropagation(); setPick(x.page); setLay(0) }}><code>{x.page}</code></button>{x.layouts.length > 1 && <small className="up-muted"> · {x.layouts.length} layouts</small>}</td>
                <td data-gz-people="">{x.people}</td>
                <td>{x.fixations}</td>
                <td className="gz-top">{x.top ?? '–'}</td>
              </tr>))}</tbody>
          </table>
        </div>

        {page && row && (
          <div className="gz-detail" data-gz-detail={row.page}>
            <div className="up-row wrap"><h3 className="lp-grow"><code>{row.page}</code> · {page.people} {page.people === 1 ? 'person' : 'people'}{page.corrected ? ` · ${page.corrected} drift-corrected` : ''}</h3>
              {onView && <><button className="lp-btn sm" onClick={() => onView(page.page, 'gaze')} data-view-heat="gaze"><Eye size={13} /> Gaze heatmap <ExternalLink size={12} /></button><button className="lp-btn sm ghost" onClick={() => onView(page.page, 'click')} data-view-heat="click"><Flame size={13} /> Clicks <ExternalLink size={12} /></button></>}
            </div>
            {row.layouts.length > 1 && (
              <div className="lp-seg gz-lays" role="tablist" aria-label="Layouts of this page">
                {row.layouts.map((l, i) => <button key={l.page} role="tab" aria-selected={i === lay} className={i === lay ? 'on' : ''} onClick={() => setLay(i)}>{l.page.split(' · ')[1] ?? 'layout'} · {l.people}</button>)}
              </div>
            )}
            {row.layouts.length > 1 && <p className="up-muted">Each layout of the page has its own results; they are never mixed.</p>}
            <figure className="gz-fig"><Preview p={page} big snap={snap} /><figcaption className="up-muted">Each dot is a fixation; bigger means longer. {snap ? 'Drawn on a snapshot of the page (fields emptied, private parts greyed out).' : 'Drawn on the page’s width.'}</figcaption></figure>
            <SnapNote has={!!snap} sw={snapshots} />
            <div className="gz-first">
              <h4>What people looked at first</h4>
              <ol>{page.elements.filter((e) => e.first > 0).sort((a, b) => b.first - a.first).slice(0, 5).map((e) => <li key={e.label}><span className="lp-grow">{e.label}</span> <b>{e.first}</b> <small className="up-muted">of {page.people}</small></li>)}</ol>
              {page.paths.length > 0 && <>
                <h4>Common first three</h4>
                <ul className="gz-paths">{page.paths.map((x) => <li key={x.steps.join('>')}>{x.steps.map((s2, i) => <span key={i}>{i > 0 && <i aria-hidden> → </i>}{s2}</span>)} <small className="up-muted">· {x.people} {x.people === 1 ? 'person' : 'people'}</small></li>)}</ul>
              </>}
            </div>
            <div className="gz-scroll">
              <table className="db-table gz-table">
                <thead><tr><th>Element</th><th title="Share of people on this page who looked at it at least once; whisker: 95% range">Looked at</th><th title="Median time from arriving on the page to the first look (people who looked)">First look</th><th title="Median total time on it per person who looked">Time on it</th><th title="Average returns after looking elsewhere">Returns</th><th title="Share of the same people who clicked it; whisker: 95% range">Clicked</th></tr></thead>
                <tbody>{page.elements.slice(0, 8).map((e) => (
                  <tr key={e.label} className={page.people < MIN_PEOPLE ? 'rs-faint' : ''}>
                    <td>{e.label}</td>
                    <td><ShareBar c={e.share} label="Looked at" /></td>
                    <td>{secs(e.ttff)}</td>
                    <td>{secs(e.dwell)}</td>
                    <td>{e.revisits.toFixed(1)}</td>
                    <td><ShareBar c={e.clickShare} label="Clicked" muted /></td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="gz-legend up-muted"><span className="gz-key bar" /> share of people · <span className="gz-key ci" /> 95% range (wide with few people) · <span className="gz-key muted" /> clicked, same people</p>
            {(() => {
              // Only controls (links, buttons, fields): a heading people read but don't click is fine.
              const gap = page.elements.filter((e) => /^(a|button|input|select|textarea|summary|label)\b/.test(e.label) && e.viewers >= 3 && e.share.p - e.clickShare.p >= 0.3).slice(0, 2)
              const blind = page.elements.filter((e) => e.clickers > 0 && e.clickShare.p > e.share.p).slice(0, 1)
              if (!gap.length && !blind.length) return null
              return <ul className="gz-notes">
                {gap.map((e) => <li key={e.label}><b>{e.label}</b>: {pct(e.share.p)} looked at it, {pct(e.clickShare.p)} clicked it. Seen but not used: worth checking whether it reads as clickable and relevant.</li>)}
                {blind.map((e) => <li key={e.label}><b>{e.label}</b>: clicked by more people than were seen looking at it. Usually the eye-tracking estimate missing it: read with care.</li>)}
              </ul>
            })()}
            <p className="up-muted">{page.clickPeople} of {page.people} people clicked something on this page. Greyed rows: fewer than {MIN_PEOPLE} people. “Elsewhere on the page” is looking that couldn’t be matched to an element.</p>
          </div>
        )}
      </div>
    </section>
  )
}
