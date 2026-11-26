import { useMemo, useState } from 'react'
import { Eye, ExternalLink, Flame, TriangleAlert } from 'lucide-react'
import { gazeReport, GOOD_ACC, MIN_PEOPLE, type GazeEvent, type GazeRun, type PageReport } from '../../saas/gaze-report'
import type { Interval } from '../../core/heatstats'

/**
 * Eye-tracking results (Labs) for one study: summary first, then the pages with a preview of where
 * people's eyes rested, and per page the elements people looked at (with 95% ranges), what they looked
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

/** Where eyes rested, drawn as dots on the page's width (no screenshot is stored, so it's a schematic). */
function Preview({ p, big }: { p: PageReport; big?: boolean }) {
  const maxDur = Math.max(1, ...p.dots.map((d) => d.dur))
  return (
    <svg className={`gz-thumb ${big ? 'big' : ''}`} viewBox={`0 0 ${p.vw} ${p.height}`} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`Preview of ${p.page}: ${p.dots.length} fixations from ${p.people} people`}>
      <rect x="0" y="0" width={p.vw} height={p.height} className="gz-page" />
      {p.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={10 + 30 * Math.sqrt(d.dur / maxDur)} className="gz-dot" />)}
    </svg>
  )
}

export function GazeReport({ runs, events, sample, onView }: { runs: GazeRun[]; events: GazeEvent[]; sample?: boolean; onView?: (page: string, kind: 'click' | 'gaze') => void }) {
  const r = useMemo(() => gazeReport(runs, events), [runs, events])
  const [pick, setPick] = useState<string | null>(null)
  if (!r.participants && !r.pages.length) return null
  const page = r.pages.find((p) => p.page === pick) ?? r.pages[0]
  const accN = runs.filter((x) => x.gaze_accuracy != null).length
  return (
    <section className="up-card gz" data-gaze-report="">
      <div className="up-row"><h2 className="lp-grow"><Eye size={16} /> Eye tracking</h2><span className="up-badge st-ongoing">Labs</span>{sample && <span className="up-badge pending">Sample data</span>}</div>
      <p className="up-muted">Webcam eye tracking is an estimate: read areas, not exact points. Only people who agreed and calibrated. {sample ? 'These numbers are made up, to show what the report looks like; a real study replaces them.' : ''}</p>
      <div className="db-kpis gz-kpis">
        <div className="db-kpi"><span>Participants</span><b>{r.participants}</b><small className="up-muted">with eye tracking</small></div>
        <div className="db-kpi"><span>Good calibration</span><b>{accN ? pct(r.goodShare.p) : '–'}</b><small className="up-muted">{accN ? `${r.good} of ${accN} at ≤ ${GOOD_ACC} px · 95%: ${range(r.goodShare)}` : 'not measured'}</small></div>
        <div className="db-kpi"><span>Median accuracy</span><b>{r.medianAcc == null ? '–' : `${Math.round(r.medianAcc)} px`}</b><small className="up-muted">lower is better</small></div>
        <div className="db-kpi"><span>Drift-corrected</span><b>{r.participants ? pct(r.corrected / r.participants) : '–'}</b><small className="up-muted">{r.corrected} of {r.participants}, with their own clicks</small></div>
      </div>
      {r.participants > 0 && r.participants < MIN_PEOPLE && <p className="up-warn"><TriangleAlert size={13} /> Fewer than {MIN_PEOPLE} people: treat this as anecdotes, not results.</p>}

      <h3>Pages</h3>
      <ul className="gz-pages" role="list">
        {r.pages.map((p) => (
          <li key={p.page}><button type="button" className={`gz-pagebtn ${p === page ? 'on' : ''}`} aria-pressed={p === page} onClick={() => setPick(p.page)} data-gaze-page={p.page}>
            <Preview p={p} /><span><code>{p.page}</code><small className="up-muted">{p.people} {p.people === 1 ? 'person' : 'people'}</small></span>
          </button></li>
        ))}
      </ul>

      {page && (
        <div className="gz-detail">
          <div className="up-row wrap"><h3 className="lp-grow"><code>{page.page}</code> · {page.people} {page.people === 1 ? 'person' : 'people'}{page.corrected ? ` · ${page.corrected} drift-corrected` : ''}</h3>
            {onView && <><button className="lp-btn sm" onClick={() => onView(page.page, 'gaze')} data-view-heat="gaze"><Eye size={13} /> View gaze heatmap <ExternalLink size={12} /></button><button className="lp-btn sm ghost" onClick={() => onView(page.page, 'click')} data-view-heat="click"><Flame size={13} /> View click heatmap <ExternalLink size={12} /></button></>}
          </div>
          <div className="gz-cols">
            <figure className="gz-fig"><Preview p={page} big /><figcaption className="up-muted">Each dot is a fixation; bigger means longer. Schematic: drawn on the page’s width, no screenshot is stored. <b>View gaze heatmap</b> shows it over the real page.</figcaption></figure>
            <div className="gz-first">
              <h4>What people looked at first</h4>
              <ol>{page.elements.filter((e) => e.first > 0).sort((a, b) => b.first - a.first).slice(0, 5).map((e) => <li key={e.label}><span className="lp-grow">{e.label}</span> <b>{e.first}</b> <small className="up-muted">of {page.people}</small></li>)}</ol>
              {page.paths.length > 0 && <>
                <h4>Common first three</h4>
                <ul className="gz-paths">{page.paths.map((x) => <li key={x.steps.join('>')}>{x.steps.map((s, i) => <span key={i}>{i > 0 && <i aria-hidden> → </i>}{s}</span>)} <small className="up-muted">· {x.people} {x.people === 1 ? 'person' : 'people'}</small></li>)}</ul>
              </>}
            </div>
          </div>
          <div className="gz-scroll">
            <table className="db-table gz-table">
              <thead><tr><th>Element</th><th title="Share of people on this page who looked at it at least once; whisker: 95% range">Looked at</th><th title="Median time from arriving on the page to the first look (people who looked)">First look</th><th title="Median total time on it per person who looked">Time on it</th><th title="Average returns after looking elsewhere">Returns</th><th title="Share of the same people who clicked it; whisker: 95% range">Clicked</th></tr></thead>
              <tbody>{page.elements.slice(0, 12).map((e) => (
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
          <p className="gz-legend up-muted"><span className="gz-key bar" /> share of people · <span className="gz-key ci" /> 95% range (wide with few people) · <span className="gz-key muted" /> clicked, same people · scale 0–100%</p>
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
    </section>
  )
}
