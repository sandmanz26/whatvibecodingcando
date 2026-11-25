import { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, TriangleAlert } from 'lucide-react'
import { studyHeatmap } from '../../saas/cloud'
import { cleanSummary, compareViews, MIN_EXPOSURES, verName, versionsOf, viewOf, type Summary } from '../../core/embed/heatsummary'
import { binsToPoints, exposureWeight, fmtShare } from '../../core/heatstats'
import { drawHeat, LEGEND } from '../../core/heat'

/**
 * One page's heatmap numbers over ALL of the study's clicks (the server aggregates them): one device
 * and one version at a time, element click rates of everyone and per view with 95% intervals, the
 * scroll-reach curve, an exposure-adjusted density preview, and a comparison between versions.
 */
export function PageAccuracy({ study, pages }: { study: string; pages: string[] }) {
  const [page, setPage] = useState(pages[0])
  const [sum, setSum] = useState<Summary | null>(null)
  const [err, setErr] = useState('')
  const [dev, setDev] = useState('all')
  const [ver, setVer] = useState<string | null>(null)
  const [vs, setVs] = useState('')
  const [exposed, setExposed] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    setSum(null); setErr('')
    studyHeatmap(study, page).then((d) => { if (live) setSum(cleanSummary(d)) }).catch((e: Error) => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [study, page])
  const devices = useMemo(() => [...new Set((sum?.groups ?? []).map((g) => g.dev))], [sum])
  const versions = useMemo(() => (sum ? versionsOf(sum, dev) : []), [sum, dev])
  const version = ver != null && versions.some((v) => v.ver === ver) ? ver : (versions[0]?.ver ?? '')
  const view = useMemo(() => (sum ? viewOf(sum, dev, version) : null), [sum, dev, version])
  const compared = useMemo(() => (sum && view && vs && vs !== version ? compareViews(view, viewOf(sum, dev, vs), [verName(version), verName(vs)]) : []), [sum, view, vs, dev, version])
  useEffect(() => {
    const c = canvas.current
    if (!c || !view) return
    const W = 1280
    const pts = binsToPoints(view.bins, W, true)
    const maxY = Math.max(800, ...pts.map((p) => p.y + 40))
    // The whole page fits: at most 520 px tall, narrower when the page is long.
    const scale = Math.min(c.parentElement!.clientWidth / W, 520 / maxY)
    c.style.width = `${Math.round(W * scale)}px`
    c.style.height = `${Math.round(maxY * scale)}px`
    drawHeat(c, pts.map((p) => ({ x: p.x, y: p.y, w: p.w * (exposed ? exposureWeight(view.reach(p.row), view.reachedAt(p.row)) : 1) })), scale, 26, 0.9)
  }, [view, exposed])
  return (
    <section className="up-card">
      <h2><Flame size={16} /> Heatmap numbers, every click</h2>
      <div className="up-row wrap">
        <label className="lp-field">Page<select value={page} onChange={(e) => setPage(e.target.value)}>{pages.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="lp-field">Device<select value={dev} onChange={(e) => setDev(e.target.value)}><option value="all">All devices</option>{devices.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
        {versions.length > 0 && <label className="lp-field">Site version<select value={version} onChange={(e) => setVer(e.target.value)}>{versions.map((v) => <option key={v.ver} value={v.ver}>{verName(v.ver)} ({v.people})</option>)}</select></label>}
        {versions.length > 1 && <label className="lp-field">Compare with<select value={vs} onChange={(e) => setVs(e.target.value)}><option value="">—</option>{versions.filter((v) => v.ver !== version).map((v) => <option key={v.ver} value={v.ver}>{verName(v.ver)}</option>)}</select></label>}
      </div>
      {err ? <p className="up-warn"><TriangleAlert size={13} /> Couldn’t load: {err}</p> : !view ? <p className="up-muted">Loading…</p> : !view.people ? <p className="up-muted">Nothing recorded for this page here yet.</p> : (
        <>
          <p className="up-muted">{view.people} {view.people === 1 ? 'person' : 'people'} · {view.clicks} clicks, all counted (aggregated on the server). Versions are never mixed{versions.length > 1 ? `: ${versions.length} on this page` : ''}.</p>
          <div className="rs-heatgrid">
            <div>
              <canvas ref={canvas} className="rs-heatprev" aria-label="Click density of every click on this page, without the page behind it" />
              <div className="rs-legend" style={{ background: LEGEND }} aria-hidden />
              <label className="up-check"><input type="checkbox" checked={exposed} onChange={(e) => setExposed(e.target.checked)} disabled={!view.depthPeople} /> Adjust for how many people saw it (scrolled that far){!view.depthPeople ? ' · no scroll data for this page yet' : ''}</label>
              <p className="up-muted">Positions are scaled to a 1,280 px wide page. To see it over the page itself, open the Heatmap button above.</p>
            </div>
            <div>
              <h3>How far people scrolled</h3>
              {view.depthPeople ? (
                <div className="rs-reach" role="img" aria-label="Share of people who reached each depth of the page">
                  {view.curve.map((c) => <div key={c.at}><span>{Math.round(c.at * 100)}%</span><i style={{ width: `${Math.round(c.share * 100)}%` }} /><b>{Math.round(c.share * 100)}%</b></div>)}
                </div>
              ) : <p className="up-muted">No scroll data yet (recorded from this version of the script on).</p>}
              <p className="up-muted">Depth of the page (left), share of {view.depthPeople} people who got at least that far (right).</p>
            </div>
          </div>
          <table className="db-table">
            <thead><tr><th>Element</th><th title="People who clicked it, of everyone on this page">Of people</th><th title="People who clicked it, of people who saw it (≥ 50% visible for ≥ 0.5 s)">Per view</th><th>Saw it</th><th>First click</th><th>Dead</th></tr></thead>
            <tbody>{view.elements.slice(0, 15).map((e) => (
              <tr key={e.sel} className={e.perView.ok ? '' : 'rs-faint'} title={e.perView.ok ? '' : `Seen by fewer than ${MIN_EXPOSURES} people: too few to trust`}>
                <td>{e.label}</td><td className="rs-ci">{fmtShare(e.people, view.people)}</td><td className="rs-ci">{e.seen || e.people ? fmtShare(e.people, Math.max(e.seen, e.people)) : '–'}</td><td>{e.seen}</td><td>{e.first}</td><td>{e.dead}</td>
              </tr>))}</tbody>
          </table>
          <p className="up-muted">± is the 95% range (Wilson): the true share is likely inside it. Per view divides by the people who actually saw the element, so content further down isn’t unfairly cold. Greyed rows: seen by fewer than {MIN_EXPOSURES} people.</p>
          {compared.length > 0 && <><h3>{verName(version)} vs {verName(vs)}</h3><ul className="rs-answers">{compared.map((c) => <li key={c.sel}><b>{c.label}:</b> {c.c.words}</li>)}</ul></>}
        </>
      )}
    </section>
  )
}
