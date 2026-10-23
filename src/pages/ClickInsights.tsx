import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Flame, MousePointerClick, RefreshCw, Trash2, Ban, CircleSlash, Pin } from 'lucide-react'
import { Empty, Modal, Switch } from '../components/ui'
import { analyze, applyFilters, pct, type ElementRow, type Filters } from '../tools/insights/analyze'
import { clearEvents, loadEvents, type Loaded } from '../tools/insights/store'
import { flushNow } from '../tools/insights/tracker'
import { setFlag, useFlag, TOOLS_API } from '../tools/shared'

/** Opens a screen of the app in a new tab with the heatmap overlay. */
function openHeatmap(page: string, extra = '') {
  window.open(`${window.location.pathname}${window.location.search}#${page}?heatmap${extra}`, '_blank', 'noopener')
}

function TapSpots({ row }: { row: ElementRow }) {
  // The element drawn to its own aspect ratio, with a dot where each tap landed.
  return (
    <div className="ti-spots" style={{ aspectRatio: `${Math.max(1, row.w)} / ${Math.max(1, row.h)}` }} aria-label={`Where ${row.taps} taps landed on the element`}>
      {row.spots.slice(-200).map((s, i) => <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%` }} />)}
    </div>
  )
}

export default function ClickInsights() {
  const insightsOn = useFlag('insights')
  const pinsOn = useFlag('reviewPins')
  const [data, setData] = useState<Loaded | null>(null)
  const [filters, setFilters] = useState<Filters>({ days: 'all', page: 'all', layout: 'all' })
  const [open, setOpen] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(async () => {
    flushNow()
    setData(await loadEvents())
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const all = data?.events ?? []
  const pages = useMemo(() => [...new Set(all.map((e) => e.page))].sort(), [all])
  const scoped = useMemo(() => applyFilters(all, filters), [all, filters])
  const a = useMemo(() => analyze(scoped), [scoped])
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Click insights</h1>
          <p>Which screens people open, what they tap, and where they get stuck. No typed text, field values or page content is ever recorded.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button>
          <button className="btn danger" onClick={() => setConfirmClear(true)} disabled={!all.length}><Trash2 size={14} /> Clear</button>
        </div>
      </div>

      <section className="card card-body" style={{ marginBottom: 16 }}>
        <div className="grid g-2" style={{ gap: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h3 className="row" style={{ gap: 8 }}><MousePointerClick size={15} /> Record clicks</h3>
              <p className="muted" style={{ fontSize: 12.5 }}>{import.meta.env.PROD ? 'Off by default in production until consent is decided. ' : 'On by default in development. '}Never records on this console or while a heatmap is open.</p>
            </div>
            <Switch checked={insightsOn} onChange={() => setFlag('insights', !insightsOn)} label="Record clicks" />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <h3 className="row" style={{ gap: 8 }}><Pin size={15} /> Review pins</h3>
              <p className="muted" style={{ fontSize: 12.5 }}>A floating pen button for dropping notes on any screen. Shows below 500 px wide (the mobile layout).</p>
            </div>
            <Switch checked={pinsOn} onChange={() => setFlag('reviewPins', !pinsOn)} label="Review pins" />
          </div>
        </div>
      </section>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <section className="card stat">
          <div className="stat-label">Source</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{data ? data.scope : 'Loading…'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{!TOOLS_API ? 'No server configured' : data?.configured ? `Endpoint ${TOOLS_API}/clicks` : `${TOOLS_API}/clicks has no store`}</div>
        </section>
        <section className="card stat"><div className="stat-label">Events</div><div className="stat-value num">{scoped.length}</div><div className="muted" style={{ fontSize: 12 }}>{a.sessions} session{a.sessions === 1 ? '' : 's'}</div></section>
        <section className="card stat"><div className="stat-label">Screens viewed</div><div className="stat-value num">{a.views}</div><div className="muted" style={{ fontSize: 12 }}>{a.screens.length} distinct</div></section>
        <section className="card stat"><div className="stat-label">Taps</div><div className="stat-value num">{a.taps}</div><div className="muted" style={{ fontSize: 12 }}>{a.problemTaps} problem tap{a.problemTaps === 1 ? '' : 's'}</div></section>
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Date range">
          {([1, 7, 30, 'all'] as const).map((d) => <button key={d} aria-pressed={filters.days === d} onClick={() => set('days', d)}>{d === 'all' ? 'All time' : d === 1 ? 'Today' : `${d} days`}</button>)}
        </div>
        <select className="select" style={{ width: 200 }} value={filters.page} onChange={(e) => set('page', e.target.value)} aria-label="Page">
          <option value="all">All pages</option>
          {pages.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Layout">
          {(['all', 'mobile', 'tablet', 'desktop'] as const).map((l) => <button key={l} aria-pressed={filters.layout === l} onClick={() => set('layout', l)}>{l === 'all' ? 'All layouts' : l[0].toUpperCase() + l.slice(1)}</button>)}
        </div>
      </div>

      {data && scoped.length === 0 ? (
        <div className="card">
          <Empty title={all.length ? 'Nothing matches these filters' : 'No clicks recorded yet'}>
            <span style={{ maxWidth: 460 }}>
              {all.length ? 'Widen the date range or pick another page or layout.'
                : insightsOn ? 'Leave the console and use the app — open a few screens, tap around. Come back and press Refresh.'
                  : 'Recording is off. Switch on “Record clicks” above, then use the app and come back.'}
            </span>
          </Empty>
        </div>
      ) : (
        <div className="stack gap-16">
          <div className="grid g-2">
            <section className="card">
              <div className="card-head"><div><h2>Screens</h2><p>Views and taps per page</p></div></div>
              <div className="card-body" style={{ paddingTop: 8 }}>
                <table className="table">
                  <thead><tr><th>Page</th><th className="r">Views</th><th className="r">Taps</th><th className="r"></th></tr></thead>
                  <tbody>
                    {a.screens.map((s) => (
                      <tr key={s.page}>
                        <td className="mono">{s.page}</td>
                        <td className="r num">{s.views}</td>
                        <td className="r num">{s.taps}</td>
                        <td className="r">
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                            <button className="btn sm" onClick={() => openHeatmap(s.page)}>Heatmap <ExternalLink size={12} /></button>
                            <button className="btn sm ghost" onClick={() => set('page', s.page)}>Elements</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="card-head"><div><h2>Problem taps</h2><p>Where people tapped and the app didn’t answer the way they expected</p></div></div>
              <div className="card-body" style={{ paddingTop: 8 }}>
                <div className="stack gap-4" style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
                  <span className="row" style={{ gap: 6 }}><CircleSlash size={13} /> <b style={{ color: 'var(--ink-2)' }}>Did nothing</b> — a control was tapped but the screen didn’t change within 0.7 s.</span>
                  <span className="row" style={{ gap: 6 }}><Flame size={13} /> <b style={{ color: 'var(--ink-2)' }}>Rage</b> — 3+ taps in the same spot within a second.</span>
                  <span className="row" style={{ gap: 6 }}><Ban size={13} /> <b style={{ color: 'var(--ink-2)' }}>Dead</b> — tapped something that isn’t a control; it probably looks like one.</span>
                </div>
                {a.problems.length === 0 && <p className="muted" style={{ fontSize: 13, padding: '12px 0' }}>No problem taps in this range.</p>}
                <table className="table">
                  <tbody>
                    {a.problems.slice(0, 10).map((p) => (
                      <tr key={p.key}>
                        <td>
                          <div style={{ fontWeight: 550 }}>{p.label}</div>
                          <div className="muted mono" style={{ fontSize: 11.5 }}>{p.page} · {p.section}</div>
                        </td>
                        <td className="r" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>
                          {p.nothing > 0 && <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><CircleSlash size={12} /> {p.nothing}</span>}
                          {p.rage > 0 && <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><Flame size={12} /> {p.rage}</span>}
                          {p.dead > 0 && <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><Ban size={12} /> {p.dead}</span>}
                        </td>
                        <td className="r"><button className="btn sm ghost" onClick={() => openHeatmap(p.page, `=elements&el=${encodeURIComponent(p.sel)}`)}>Show <ExternalLink size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="card">
            <div className="card-head"><div><h2>Elements</h2><p>{filters.page === 'all' ? 'Every tapped element, all pages' : `Tapped elements on ${filters.page}`} — expand a row to see where on it people tap</p></div></div>
            <div className="card-body" style={{ overflowX: 'auto', paddingTop: 8 }}>
              <table className="table">
                <thead>
                  <tr><th></th><th>Element</th><th>Kind</th><th>Section</th><th className="r">Taps</th><th className="r">Did nothing</th><th className="r">Rage</th><th className="r">Median time to tap</th><th className="r">Median scroll</th><th></th></tr>
                </thead>
                <tbody>
                  {a.elements.slice(0, 80).map((e) => (
                    <Fragment key={e.key}>
                      <tr className="clickable" onClick={() => setOpen(open === e.key ? null : e.key)} aria-expanded={open === e.key}>
                        <td style={{ width: 24 }}>{open === e.key ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td><div style={{ fontWeight: 550 }}>{e.label}</div>{filters.page === 'all' && <div className="muted mono" style={{ fontSize: 11.5 }}>{e.page}</div>}</td>
                        <td className="secondary">{e.kind}</td>
                        <td className="secondary">{e.section}</td>
                        <td className="r num">{e.taps}</td>
                        <td className="r num">{pct(e.nothing, e.taps)}%</td>
                        <td className="r num">{e.rage || '—'}</td>
                        <td className="r num">{(e.medianMs / 1000).toFixed(1)} s</td>
                        <td className="r num">{Math.round(e.medianScroll)}%</td>
                        <td className="r"><button className="btn sm ghost" onClick={(ev) => { ev.stopPropagation(); openHeatmap(e.page, `=elements&el=${encodeURIComponent(e.sel)}`) }}>Show on screen</button></td>
                      </tr>
                      {open === e.key && (
                        <tr>
                          <td />
                          <td colSpan={9}>
                            <div className="row" style={{ gap: 24, alignItems: 'flex-start', padding: '6px 0 10px' }}>
                              <TapSpots row={e} />
                              <div className="stack gap-4" style={{ fontSize: 12.5 }}>
                                <span className="muted">States seen</span>
                                {e.states.length ? e.states.map((s) => <span key={s} className="mono">{s}</span>) : <span className="secondary">None</span>}
                                <span className="muted" style={{ marginTop: 8 }}>Selector</span>
                                <span className="mono" style={{ fontSize: 11.5, wordBreak: 'break-all', maxWidth: 520 }}>{e.sel}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Paths</h2><p>Most common moves from one screen to the next</p></div></div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              {a.paths.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No screen-to-screen moves yet.</p>}
              <table className="table">
                <tbody>
                  {a.paths.slice(0, 12).map((p) => (
                    <tr key={p.path}><td className="mono">{p.path}</td><td className="r num">{p.n}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {confirmClear && data && (
        <Modal
          title="Clear all click data?"
          description={`Deletes ${data.events.length} events from ${data.scope}. This can’t be undone.`}
          onClose={() => setConfirmClear(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmClear(false)}>Keep data</button>
            <button className="btn primary" onClick={async () => { await clearEvents(data.configured); setConfirmClear(false); void refresh() }}>Clear data</button>
          </>}
        />
      )}
    </main>
  )
}
