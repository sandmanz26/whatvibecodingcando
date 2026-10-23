import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Ban, CircleSlash, Download, Flame, MousePointerClick, RefreshCw, Trash2, X, FileText } from 'lucide-react'
import { Empty, Modal, Switch } from '../components/ui'
import { DEVICES, ScreenViewer, type Device } from '../tools/insights/ScreenViewer'
import { clearEvents, layoutOf, loadEvents, type ClickEvent, type Loaded } from '../tools/insights/store'
import { flushNow } from '../tools/insights/tracker'
import { buildSessions, clock, loadNotes, saveNote, sessionCsv, TAGS, type Session, type Step } from '../tools/insights/sessions'
import { setFlag, useFlag } from '../tools/shared'

const FLAG: Record<Step['flags'][number], { icon: React.ReactNode; text: string }> = {
  rage: { icon: <Flame size={12} />, text: 'rage tap' },
  dead: { icon: <Ban size={12} />, text: 'not a control' },
  idle: { icon: <CircleSlash size={12} />, text: 'did nothing' },
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** One session as a list of moves: each page it opened, and every tap inside it, in order. */
export function Timeline({ steps, active, onPick }: { steps: Step[]; active: number | null; onPick: (i: number) => void }) {
  let n = 0
  return (
    <ol className="tl2">
      {steps.map((s, i) => {
        // Screens passed through without a tap fold into one line; the last one before a tap stays its own row.
        if (s.kind === 'view' && steps[i + 1]?.kind === 'view') {
          if (steps[i - 1]?.kind === 'view') return null
          let j = i
          while (steps[j + 1]?.kind === 'view' && steps[j + 2]?.kind === 'view') j++
          const run = steps.slice(i, j + 1)
          if (run.length < 2) return (
            <li key={i} className="tl2-page">
              <span className="tl2-time num">{clock(s.at)}</span>
              <span><b>Opened <span className="mono">{s.page}</span></b>{s.from && <span className="muted"> from {s.from}</span>}</span>
            </li>
          )
          return (
            <li key={i} className="tl2-page">
              <span className="tl2-time num">{clock(s.at)}</span>
              <span className="muted">Went through {run.map((v) => v.page).join(' → ')}</span>
            </li>
          )
        }
        if (s.kind === 'view' && steps[i - 1]?.kind === 'view' && steps[i - 2]?.kind === 'view' && steps[i + 1]?.kind === 'view') return null
        if (s.kind === 'view') {
          return (
            <li key={i} className="tl2-page">
              <span className="tl2-time num">{clock(s.at)}</span>
              <span><b>Opened <span className="mono">{s.page}</span></b>{s.from && <span className="muted"> from {s.from}</span>}</span>
            </li>
          )
        }
        n++
        return (
          <li key={i}>
            <button className={`tl2-tap ${active === i ? 'on' : ''} ${s.flags.length ? 'bad' : ''}`} onClick={() => onPick(i)}>
              <span className="tl2-time num">{clock(s.at)}</span>
              <span className="tl2-n num">{n}</span>
              <span className="tl2-body">
                <b>{s.label}</b>
                <span className="muted">{s.what} · {s.where}</span>
                <span className="tl2-effect">→ {s.effect}
                  {s.flags.map((f) => <span key={f} className="tl2-flag">{FLAG[f].icon}{FLAG[f].text}</span>)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** The real screen for one step, with the tap drawn and the element ringed. ← → move through the steps. */
export function StepDrawer({ steps, index, onMove, onClose, title }: { steps: Step[]; index: number; onMove: (i: number) => void; onClose: () => void; title: string }) {
  const taps = steps.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'tap')
  const pos = taps.findIndex((x) => x.i === index)
  const step = steps[index]
  const go = useCallback((d: number) => { const t = taps[pos + d]; if (t) onMove(t.i) }, [taps, pos, onMove])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [go, onClose])
  const device = layoutOf(step.vw) as Device
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Step ${pos + 1}`} data-insights-ignore>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>{title} · tap {pos + 1} of {taps.length} · {clock(step.at)}</div>
            <h2 style={{ fontSize: 16 }}>{step.label}</h2>
            <div className="muted" style={{ fontSize: 13 }}>on <span className="mono">{step.page}</span> · {step.where} · → {step.effect}</div>
          </div>
          <div className="row">
            <button className="btn sm icon" onClick={() => go(-1)} disabled={pos <= 0} aria-label="Previous tap"><ArrowLeft size={14} /></button>
            <button className="btn sm icon" onClick={() => go(1)} disabled={pos >= taps.length - 1} aria-label="Next tap"><ArrowRight size={14} /></button>
            <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
          </div>
        </div>
        <ScreenViewer key={`${step.page}-${device}`} page={step.page} device={device} mode="dots" dot={{ x: step.x ?? 50, y: step.y ?? 0, ex: step.ex, ey: step.ey }} focus={step.sel} maxHeight={Math.max(360, window.innerHeight - 220)} />
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Shown at the width it was tapped at ({DEVICES[device].label} px). Use ← → to step through the session.</p>
      </aside>
    </>
  )
}

function Notes({ sid }: { sid: string }) {
  const [n, setN] = useState(() => loadNotes()[sid] ?? { note: '', tags: [] })
  useEffect(() => setN(loadNotes()[sid] ?? { note: '', tags: [] }), [sid])
  const update = (next: typeof n) => { setN(next); saveNote(sid, next) }
  return (
    <div className="stack gap-12">
      <div className="row wrap" style={{ gap: 6 }}>
        {TAGS.map((t) => (
          <button key={t} className="chip" aria-pressed={n.tags.includes(t)} onClick={() => update({ ...n, tags: n.tags.includes(t) ? n.tags.filter((x) => x !== t) : [...n.tags, t] })}>{t}</button>
        ))}
      </div>
      <textarea className="textarea" rows={3} placeholder="What did you notice? e.g. looked for review under Skills first" value={n.note} onChange={(e) => update({ ...n, note: e.target.value })} aria-label="Research note" />
    </div>
  )
}

export default function Sessions() {
  const recording = useFlag('insights')
  const [data, setData] = useState<Loaded | null>(null)
  const [tab, setTab] = useState<'sessions' | 'heatmap'>('sessions')
  const [sid, setSid] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [heat, setHeat] = useState<{ page: string | null; device: Device; mode: 'dots' | 'elements' }>({ page: null, device: 'desktop', mode: 'dots' })
  const [notesVer, setNotesVer] = useState(0)

  const refresh = useCallback(async () => { flushNow(); setData(await loadEvents()) }, [])
  useEffect(() => { void refresh() }, [refresh])

  const sessions = useMemo(() => buildSessions(data?.events ?? []), [data])
  const open = sessions.find((s) => s.sid === sid) ?? sessions[0]
  // Re-read when switching sessions, so tags added in the notes box show in the list.
  const notes = useMemo(() => (notesVer >= 0 ? loadNotes() : {}), [notesVer])

  const pages = useMemo(() => {
    const m = new Map<string, number>()
    ;(data?.events ?? []).forEach((e) => { if (e.type === 'click') m.set(e.page, (m.get(e.page) ?? 0) + 1) })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [data])
  const heatPage = heat.page ?? pages[0]?.[0] ?? '/'
  const topHere = useMemo(() => {
    const m = new Map<string, number>()
    ;(data?.events ?? []).filter((e): e is ClickEvent => e.type === 'click' && e.page === heatPage && layoutOf(e.vw) === heat.device)
      .forEach((c) => m.set(c.label, (m.get(c.label) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [data, heatPage, heat.device])

  const exportCsv = (s: Session) => {
    const url = URL.createObjectURL(new Blob([sessionCsv(s)], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: `session-${s.n}.csv` }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page">
      
      <div className="page-head">
        <div>
          <h1>Sessions</h1>
          <p>What each person tapped, in order, and which screens they went through. Nothing they type is recorded.</p>
        </div>
        <div className="actions">
          <label className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={recording} onChange={() => setFlag('insights', !recording)} label="Record sessions" /> Recording {recording ? 'on' : 'off'}</label>
          <button className="btn" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button>
          <button className="btn ghost danger" onClick={() => setConfirm(true)} disabled={!data?.events.length} aria-label="Delete all sessions"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'sessions'} onClick={() => setTab('sessions')}>Sessions<span className="count">{sessions.length}</span></button>
        <button role="tab" aria-selected={tab === 'heatmap'} onClick={() => setTab('heatmap')}>Heatmap</button>
      </div>

      {data && sessions.length === 0 ? (
        <div className="card"><Empty title="No sessions yet">
          <span style={{ maxWidth: 460 }}>{recording ? 'Use the app in another tab — open a few screens and tap around — then press Refresh.' : 'Recording is off. Switch it on above, use the app, then come back.'}</span>
        </Empty></div>
      ) : tab === 'sessions' ? (
        <div className="ses">
          <nav className="ses-list" aria-label="Sessions">
            {sessions.map((s) => {
              const note = notes[s.sid]
              return (
                <button key={s.sid} className={`ses-row ${open?.sid === s.sid ? 'on' : ''}`} onClick={() => { setSid(s.sid); setStep(null); setNotesVer((v) => v + 1) }}>
                  <span className="row" style={{ justifyContent: 'space-between' }}><b>Session {s.n}</b><span className="muted num">{clock(s.ms)}</span></span>
                  <span className="muted">{when(s.start)} · {s.layout}</span>
                  <span className="muted">{s.pages.length} screen{s.pages.length === 1 ? '' : 's'} · {s.taps} tap{s.taps === 1 ? '' : 's'}{s.problems ? <span style={{ color: 'var(--critical-ink)' }}> · {s.problems} stuck</span> : null}</span>
                  {note?.tags.length ? <span className="row wrap" style={{ gap: 4 }}>{note.tags.map((t) => <span key={t} className="badge" style={{ height: 20 }}>{t}</span>)}</span> : null}
                </button>
              )
            })}
          </nav>

          {open && (
            <section className="stack gap-16" style={{ minWidth: 0 }}>
              <div className="card card-body">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: 17 }}>Session {open.n}</h2>
                    <p className="muted" style={{ fontSize: 13 }}>{when(open.start)} · {clock(open.ms)} long · {open.layout}, {open.vw}px wide · {open.taps} taps</p>
                  </div>
                  <div className="row">
                    <button className="btn sm primary" onClick={() => { const i = open.steps.findIndex((s) => s.kind === 'tap'); if (i >= 0) setStep(i) }} disabled={!open.taps}><MousePointerClick size={13} /> Replay taps</button>
                    <button className="btn sm" onClick={() => exportCsv(open)}><Download size={13} /> CSV</button>
                  </div>
                </div>
                <div className="journey" aria-label="Screens in order">
                  {open.pages.map((p, i) => (
                    <span key={i} className="row" style={{ gap: 6 }}>{i > 0 && <ArrowRight size={13} className="muted" />}<span className="journey-page mono">{p}</span></span>
                  ))}
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px', alignItems: 'start' }}>
                <div className="card card-body">
                  <h3 style={{ marginBottom: 10 }}>Step by step</h3>
                  <Timeline steps={open.steps} active={step} onPick={setStep} />
                </div>
                <div className="card card-body">
                  <h3 className="row" style={{ gap: 6, marginBottom: 10 }}><FileText size={14} /> Your notes</h3>
                  <Notes sid={open.sid} />
                </div>
              </div>
            </section>
          )}
        </div>
      ) : (
        <section className="card">
          <div className="card-head">
            <div><h2>Where people tap on a screen</h2><p>Every session’s taps on one screen, at one width</p></div>
            <div className="row wrap">
              <select className="select" style={{ width: 200, height: 30 }} value={heatPage} onChange={(e) => setHeat((h) => ({ ...h, page: e.target.value }))} aria-label="Screen">
                {pages.map(([p, n]) => <option key={p} value={p}>{p} · {n} taps</option>)}
              </select>
              <div className="seg" role="group" aria-label="Device">
                {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={heat.device === d} onClick={() => setHeat((h) => ({ ...h, device: d }))}>{d[0].toUpperCase() + d.slice(1)}</button>)}
              </div>
              <div className="seg" role="group" aria-label="Show">
                <button aria-pressed={heat.mode === 'dots'} onClick={() => setHeat((h) => ({ ...h, mode: 'dots' }))}>Taps</button>
                <button aria-pressed={heat.mode === 'elements'} onClick={() => setHeat((h) => ({ ...h, mode: 'elements' }))}>Elements</button>
              </div>
            </div>
          </div>
          <div className="card-body grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 240px', alignItems: 'start' }}>
            <ScreenViewer page={heatPage} device={heat.device} mode={heat.mode} />
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Most tapped here</div>
              {topHere.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No taps on this screen at this width.</p>}
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topHere.map(([label, n]) => <li key={label}><span>{label}</span> <span className="muted num">· {n}</span></li>)}
              </ol>
            </div>
          </div>
        </section>
      )}

      {open && step !== null && open.steps[step]?.kind === 'tap' && (
        <StepDrawer steps={open.steps} index={step} onMove={setStep} onClose={() => setStep(null)} title={`Session ${open.n}`} />
      )}

      {confirm && data && (
        <Modal title="Delete every session?" description={`Removes ${sessions.length} sessions (${data.events.length} events) from ${data.scope}. This can’t be undone.`} onClose={() => setConfirm(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirm(false)}>Keep them</button>
            <button className="btn primary" onClick={async () => { await clearEvents(data.configured); setConfirm(false); void refresh() }}>Delete sessions</button>
          </>}
        />
      )}
    </main>
  )
}
