/**
 * What a study's participant sees on the customer's site: the consent screen, then the study
 * (usability tasks, a 5-second test, or a free browse for a heatmap), then a thank-you. See
 * research.ts for what is recorded and what never is.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, Flag, Timer, X } from 'lucide-react'
import { Recorder, cleanConfig, finishRun, pageMatches, saveRun, startRun, type Door, type Outcome, type RunState } from './research'

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const KIND_LABEL = { usability: 'tasks on this site', fivesec: 'a 5-second test', browse: 'a short visit' } as const

export function Participant({ project, initial, accent, doorsOn = false }: { project: string; initial: RunState; accent: string; doorsOn?: boolean }) {
  const recRef = useRef<Recorder | null>(null)
  const [st, setSt] = useState<RunState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [, tick] = useState(0)
  const stRef = useRef(st)
  stRef.current = st
  const update = (next: RunState) => { setSt(next); saveRun(project, next.phase === 'declined' ? null : next) }

  const tasks = st.config?.tasks ?? []
  const task = st.kind === 'usability' ? tasks[st.index] : undefined
  const limitMs = st.kind === 'usability' ? (task?.limitSec ?? 180) * 1000 : st.kind === 'browse' ? (st.config?.minutes ?? 3) * 60_000 : (st.config?.seconds ?? 5) * 1000
  const elapsed = st.taskStart ? Date.now() - st.taskStart : 0

  /* ---- finishing a task, and the run ---- */
  const finishAll = async (s: RunState) => {
    update({ ...s, phase: 'done' })
    try { await finishRun(s.run!, { kind: s.kind, tasks: s.results, answers: s.answers }) } catch { /* the events are in; the summary is retried below */ }
  }
  const endTask = (outcome: Outcome) => {
    const s = stRef.current
    if (s.phase !== 'task' && s.phase !== 'showing') return
    if (s.kind === 'fivesec') { update({ ...s, phase: 'questions' }); return }
    const result = { id: task?.id ?? 'visit', outcome, ms: Date.now() - (s.taskStart ?? Date.now()), pages: s.pages.slice(0, 30), clicks: s.clicks, firstClickHit: s.firstClickHit }
    const next: RunState = { ...s, results: [...s.results, result], index: s.index + 1, pages: [], clicks: 0, firstClickHit: null, taskStart: undefined }
    if (s.kind === 'usability' && next.index < tasks.length) update({ ...next, phase: 'intro' })
    else void finishAll(next)
  }

  /* ---- recording, while a task or the 5 seconds run ---- */
  const recording = st.phase === 'task' || st.phase === 'showing'
  useEffect(() => {
    if (!recording || !st.run) return
    const s0 = stRef.current
    const rec = new Recorder(st.run, s0.t0 ?? Date.now(),
      ({ el, page }) => {
        const s = stRef.current
        const rule = s.kind === 'usability' ? s.config?.tasks?.[s.index]?.success : undefined
        const hit = rule?.kind === 'element' ? !!el.closest(rule.sel) : null
        const next = { ...s, clicks: s.clicks + 1, firstClickHit: s.clicks === 0 ? hit : s.firstClickHit }
        setSt(next); saveRun(project, next)
        if (rule?.kind === 'element' && hit) window.setTimeout(() => endTask('success'), 150)
        void page
      },
      (page) => {
        const s = stRef.current
        const next = { ...s, pages: s.pages[s.pages.length - 1] === page ? s.pages : [...s.pages, page].slice(-30) }
        setSt(next); saveRun(project, next)
        const rule = s.kind === 'usability' ? s.config?.tasks?.[s.index]?.success : undefined
        if (rule?.kind === 'page' && pageMatches(rule.page, page)) window.setTimeout(() => endTask('success'), 300)
      })
    recRef.current = rec
    rec.start(() => (stRef.current.kind === 'usability' ? stRef.current.config?.tasks?.[stRef.current.index]?.id : stRef.current.kind), (el) => {
      const rule = stRef.current.config?.tasks?.[stRef.current.index]?.success
      return rule?.kind === 'element' ? !!el.closest(rule.sel) : undefined
    })
    return () => { recRef.current = null; void rec.end() }
  }, [recording, st.run, st.index]) // eslint-disable-line react-hooks/exhaustive-deps

  // The clock: time limits, and the 5 seconds.
  useEffect(() => {
    if (!recording) return
    const iv = window.setInterval(() => {
      tick((n) => n + 1)
      const s = stRef.current
      if (s.taskStart && Date.now() - s.taskStart >= limitMs) endTask(s.kind === 'browse' ? 'done' : 'timeout')
    }, 250)
    return () => window.clearInterval(iv)
  }, [recording, limitMs]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- actions ---- */
  const agree = async () => {
    setBusy(true); setError('')
    try {
      const r = await startRun(project, st.token)
      update({ ...st, phase: 'intro', run: r.run, kind: r.kind, name: r.name, config: cleanConfig(r.kind, r.config), t0: Date.now(), index: 0, results: [], answers: [] })
    } catch (e) {
      const m = (e as Error).message
      setError(m === 'study_full' ? 'This study has all the participants it needs. Thank you!' : m === 'study_closed' || m === 'link_expired' ? 'This study has ended. Thank you!' : 'The study couldn’t start. Open the link again in a moment.')
    } finally { setBusy(false) }
  }
  const begin = () => {
    const start = st.kind === 'usability' ? task?.startPage : st.config?.page
    const next: RunState = { ...st, phase: st.kind === 'fivesec' ? 'showing' : 'task', taskStart: Date.now(), pages: [], clicks: 0, firstClickHit: null }
    update(next)
    // Each task can start on its own page of the site (same site only).
    if (start && start !== window.location.pathname) window.location.assign(new URL(start, window.location.origin).href)
  }

  /* ---- what shows ---- */
  const style = { ['--vc-accent' as string]: accent }
  if (st.phase === 'declined') return null
  if (st.phase === 'consent') {
    const info = st.info
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Take part in a study">
          <span className="vc-kicker">Study · {info ? KIND_LABEL[info.kind] : ''}</span>
          <h2>{info?.name ?? 'A study'}</h2>
          <p>The people behind this site ask you to try it {info?.kind === 'usability' ? `with ${info.tasks} short task${info.tasks === 1 ? '' : 's'}` : ''} and show how it went.</p>
          <ul className="vc-list">
            <li><Check size={14} /> Recorded: where you click, which pages you open, and how long things take.</li>
            <li><Check size={14} /> Never recorded: what you type into this site, your screen as video, or your camera.</li>
            <li><Check size={14} /> Only for this study, in this tab. Close the tab to stop at any time.</li>
          </ul>
          {error && <p className="vc-bad">{error}</p>}
          <div className="vc-row"><span className="vc-grow" />
            <button className="vc-btn" onClick={() => update({ ...st, phase: 'declined' })}>No thanks</button>
            <button className="vc-btn primary" disabled={busy || !!error} onClick={() => void agree()}>{busy ? 'Starting…' : 'I agree, start'}</button>
          </div>
          <p className="vc-where">Run with Vibe Collab for the site’s owner.</p>
        </div>
      </div>
    )
  }
  if (st.phase === 'intro') {
    const prompt = st.kind === 'usability' ? task?.prompt : st.config?.prompt
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Your task">
          <span className="vc-kicker">{st.kind === 'usability' ? `Task ${st.index + 1} of ${tasks.length}` : st.kind === 'fivesec' ? `You’ll see a page for ${st.config?.seconds ?? 5} seconds` : `About ${st.config?.minutes ?? 3} minutes`}</span>
          <h2>{prompt || (st.kind === 'browse' ? 'Use the site as you normally would.' : 'Look at the page.')}</h2>
          {st.index === 0 && st.config?.intro && <p>{st.config.intro}</p>}
          <p className="vc-muted">{st.kind === 'usability' ? `When you’re done, press Done. You have ${mmss((task?.limitSec ?? 180) * 1000)}; there are no wrong answers.` : st.kind === 'fivesec' ? 'Then we’ll ask a question or two about what you remember.' : 'Press Finish when you’re done.'}</p>
          <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={begin}>Start</button></div>
        </div>
      </div>
    )
  }
  const doors = doorsOn && recording && st.config?.doors?.length ? <Doors doors={st.config.doors} rec={recRef} task={task?.id ?? st.kind} /> : null
  if (st.phase === 'task') {
    return (
      <div className="vc" style={style}>
        {doors}
        <div className="vc-taskbar" role="status">
          <span className="vc-kicker">{st.kind === 'usability' ? `${st.index + 1}/${tasks.length}` : 'Visit'}</span>
          <span className="vc-taskprompt" title={task?.prompt}>{st.kind === 'usability' ? task?.prompt : (st.config?.prompt || 'Use the site as you normally would')}</span>
          <span className="vc-clock"><Timer size={13} /> {mmss(limitMs - elapsed)}</span>
          {st.kind === 'usability' && <button className="vc-btn" onClick={() => endTask('gave_up')}><Flag size={13} /> Give up</button>}
          <button className="vc-btn primary" onClick={() => endTask(st.kind === 'browse' ? 'done' : 'done')}><Check size={13} /> {st.kind === 'browse' ? 'Finish' : 'Done'}</button>
        </div>
      </div>
    )
  }
  if (st.phase === 'showing') return <div className="vc" style={style}>{doors}<div className="vc-taskbar small" role="status"><Timer size={13} /> {Math.ceil(Math.max(0, limitMs - elapsed) / 1000)}</div></div>
  if (st.phase === 'questions') return <Questions st={st} style={style} onDone={(answers) => void finishAll({ ...st, answers })} />
  if (st.phase === 'done') {
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Thank you">
          <h2>Thank you!</h2>
          <p>That’s all. What you did helps the people behind this site make it better.</p>
          <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => { saveRun(project, null); update({ ...st, phase: 'declined' }) }}><X size={13} /> Close</button></div>
        </div>
      </div>
    )
  }
  return null
}

function Questions({ st, style, onDone }: { st: RunState; style: React.CSSProperties; onDone: (answers: string[]) => void }) {
  const qs = st.config?.questions?.length ? st.config.questions : ['What do you remember about the page you saw?']
  const [answers, setAnswers] = useState<string[]>(qs.map(() => ''))
  return (
    <div className="vc vc-cover" style={style}>
      <div className="vc-modal" role="dialog" aria-label="What do you remember?">
        <span className="vc-kicker">Time’s up</span>
        <h2>What do you remember?</h2>
        {qs.map((q, i) => (
          <label key={i} className="vc-q">{q}
            <textarea rows={2} maxLength={300} value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
          </label>
        ))}
        <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => onDone(answers.map((a) => a.trim().slice(0, 300)))}>Send</button></div>
      </div>
    </div>
  )
}

/**
 * Fake doors: a feature that doesn't exist yet, offered to the study's participants to measure
 * interest. "add": a button of ours beside an element of the page; "existing": an element of the
 * page itself. Seeing one and clicking it are recorded; clicking shows that it is coming soon.
 */
function Doors({ doors, rec, task }: { doors: Door[]; rec: React.MutableRefObject<Recorder | null>; task?: string }) {
  const [, tick] = useState(0)
  const [msg, setMsg] = useState<Door | null>(null)
  const seen = useRef(new Set<string>())
  const here = doors.filter((d) => !d.page || pageMatches(d.page, window.location.pathname))
  const find = (d: Door) => { try { return document.querySelector(d.sel) } catch { return null } }
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 400)
    const redraw = () => tick((n) => n + 1)
    window.addEventListener('scroll', redraw, true); window.addEventListener('resize', redraw)
    // An existing element as the door: its click is the door's, not the page's.
    const click = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const d = doors.find((x) => x.mode === 'existing' && (!x.page || pageMatches(x.page, window.location.pathname)) && (() => { try { return !!(e.target as Element).closest(x.sel) } catch { return false } })())
      if (!d) return
      e.preventDefault(); e.stopPropagation()
      rec.current?.door(d, true, task); setMsg(d)
    }
    document.addEventListener('click', click, true)
    return () => { window.clearInterval(iv); window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', redraw); document.removeEventListener('click', click, true) }
  }, [doors, task]) // eslint-disable-line react-hooks/exhaustive-deps
  // Seen: once per page load, when its element is on the page.
  useEffect(() => {
    for (const d of here) {
      const k = `${window.location.pathname}|${d.id}`
      const el = find(d)
      // Only once the recorder is there (it starts in the parent's effect, after this one's first run).
      if (!seen.current.has(k) && rec.current && el && el.getBoundingClientRect().width > 0) { seen.current.add(k); rec.current.door(d, false, task) }
    }
  })
  return (
    <>
      {here.filter((d) => d.mode === 'add').map((d) => {
        const r = find(d)?.getBoundingClientRect()
        if (!r || r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null
        const left = Math.min(window.innerWidth - 160, r.right + 8)
        return <button key={d.id} className="vc-door" style={{ left, top: r.top + r.height / 2 - 15 }} onClick={() => { rec.current?.door(d, true, task); setMsg(d) }}>{d.label}<span>new</span></button>
      })}
      {msg && (
        <div className="vc-scrim" onClick={() => setMsg(null)}>
          <div className="vc-modal" role="dialog" aria-label="Coming soon" onClick={(e) => e.stopPropagation()}>
            <span className="vc-kicker">Coming soon</span>
            <h2>{msg.label}</h2>
            <p>{msg.message}</p>
            <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => setMsg(null)}>OK</button></div>
          </div>
        </div>
      )}
    </>
  )
}

