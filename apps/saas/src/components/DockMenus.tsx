import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flame, MousePointerClick, Play, Pencil, Plus, ExternalLink, Eye } from 'lucide-react'
import { loadSessions, loadTests, saveTests, UT_START, UT_STATE, utRunning, type Outcome, type UtStart, type TestTask } from '../tools/tests/store'
import { TaskEdit } from '../pages/heatmap/TaskEdit'
import { flushNow, startSessionNow } from '../tools/insights/tracker'
import { loadEvents, layoutOf } from '../tools/insights/store'
import { buildSessions, clock } from '../tools/insights/sessions'
import { setFlag, readJSON, writeJSON } from '../tools/shared'
import { useStore } from '../store/store'

/** A dock button with a panel above it (or below, when the dock sits near the top). Outside click or Esc closes. */
export function DockPopover({ button, label, children, className = '', open: openProp, onOpenChange }: {
  button: (open: boolean) => React.ReactNode; label: string; className?: string; children: (close: () => void) => React.ReactNode
  open?: boolean; onOpenChange?: (v: boolean) => void
}) {
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const setOpen = (v: boolean) => { if (onOpenChange) onOpenChange(v); else setOwn(v) }
  const [down, setDown] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', out)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', out); window.removeEventListener('keydown', key) }
  })
  return (
    <div className={`dock-ver ${down ? 'down' : ''} ${className}`} ref={box}>
      <span onClick={() => { setDown((box.current?.getBoundingClientRect().top ?? 999) < 420); setOpen(!open) }} aria-label={label}>{button(open)}</span>
      {open && children(() => setOpen(false))}
    </div>
  )
}

/** Result pages open in a new tab, so whatever is going on in this one stays as it is. */
export function openResults(route: string) {
  flushNow()
  window.open(`${window.location.pathname}${window.location.search}#${route}`, '_blank', 'noopener')
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface Recent { key: string; title: string; meta: string; tag?: { text: string; tone: 'good' | 'bad' | 'live' | 'plain' }; route: string }

/** The latest three results, each opening on the results page in a new tab, and "See all". */
function RecentList({ items, empty, all, label }: { items: Recent[] | null; empty: string; all: string; label: string }) {
  return (
    <div className="dk-recent">
      <div className="dk-recent-head"><b>{label}</b><button onClick={() => openResults(all)} title="Opens in a new tab">See all <ExternalLink size={11} /></button></div>
      {items === null ? <p className="dk-recent-empty">Loading…</p> : !items.length ? <p className="dk-recent-empty">{empty}</p> : (
        <ul>
          {items.map((r) => (
            <li key={r.key}>
              <button onClick={() => openResults(r.route)} title="Open in a new tab">
                <span className="dk-recent-title">{r.title}</span>
                <span className="dk-recent-meta">{r.meta}</span>
                {r.tag && <em className={`dk-tag ${r.tag.tone}`}>{r.tag.text}</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const PICK_KEY = 'market.dock.heatmap'
interface Pick { testId: string; taskId: string }
const OUTCOME: Record<Outcome, { text: string; tone: 'good' | 'bad' | 'plain' }> = {
  success: { text: 'Done', tone: 'good' },
  timeout: { text: 'Time up', tone: 'bad' },
  gave_up: { text: 'Stopped', tone: 'plain' },
}

/** The latest three heatmap runs (a participant's attempt at one task), newest first. */
function recentRuns(): Recent[] {
  const tests = loadTests()
  return loadSessions().flatMap((s) => {
    const t = tests.find((x) => x.id === s.testId)
    if (!t) return []
    return s.attempts.map((a) => {
      const i = t.tasks.findIndex((k) => k.id === a.taskId)
      const page = encodeURIComponent(a.pages[0] ?? '/')
      return {
        at: s.startedAt,
        key: `${s.id}|${a.taskId}`,
        title: s.participant,
        meta: `Task ${i + 1} · ${(a.ms / 1000).toFixed(0)} s · ${ago(s.startedAt)}`,
        tag: OUTCOME[a.outcome],
        route: `/console/heatmap/view?ut=${t.id}&utask=${a.taskId}&run=${s.id}&page=${page}&device=${layoutOf(s.vw)}`,
      }
    })
  }).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3)
}

/**
 * Heatmap test from the page you're on: the latest runs, then pick a task and Start (with or
 * without eye tracking). Once a task runs, the dock gives way to the task bar, whose only action is Stop.
 */
export function HeatmapMenu() {
  const { toast } = useStore()
  const [tests, setTests] = useState(loadTests)
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(utRunning)
  const [editing, setEditing] = useState<'edit' | 'new' | null>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  const saved = readJSON<Pick | null>(PICK_KEY, null)
  const [pick, setPickState] = useState<Pick>(() => ({ testId: saved?.testId ?? tests[0]?.id ?? '', taskId: saved?.taskId ?? tests[0]?.tasks[0]?.id ?? '' }))
  const setPick = (p: Pick) => { setPickState(p); writeJSON(PICK_KEY, { testId: p.testId, taskId: p.taskId }) }
  useEffect(() => {
    const sync = () => setRunning(utRunning())
    window.addEventListener(UT_STATE, sync)
    return () => window.removeEventListener(UT_STATE, sync)
  }, [])
  useEffect(() => { if (open) { setTests(loadTests()); setRecent(recentRuns()) } }, [open])
  const test = tests.find((t) => t.id === pick.testId) ?? tests[0]
  const task = test?.tasks.find((t) => t.id === pick.taskId) ?? test?.tasks[0]

  const start = (eyes: boolean) => {
    if (!test || !task || utRunning()) return
    setOpen(false)
    window.dispatchEvent(new CustomEvent<UtStart>(UT_START, { detail: { testId: test.id, taskId: task.id, eyes } }))
  }
  const saveTask = (t: TestTask) => {
    if (!test) return
    const next = tests.map((x) => (x.id === test.id ? { ...x, tasks: editing === 'edit' ? x.tasks.map((k) => (k.id === t.id ? t : k)) : [...x.tasks, t], updatedAt: new Date().toISOString() } : x))
    saveTests(next); setTests(next); setEditing(null)
    setPick({ testId: test.id, taskId: t.id })
    toast(editing === 'edit' ? 'Task saved' : 'Task added')
  }

  return (
    <>
      <DockPopover label="Heatmap" open={open} onOpenChange={setOpen} button={(o) => (
        <button className={`dock-icon ${o ? 'on' : ''}`} aria-label="Heatmap test" aria-expanded={o} title="Heatmap test: do a task here, see where you clicked and looked"><Flame size={15} /></button>
      )}>
        {() => (
          <div className="dock-pop hm-pop" role="dialog" aria-label="Heatmap test">
            <div className="dock-verhead"><b>Heatmap test</b><span>Do a task right here. Your clicks (and, if you choose, where you look) are recorded.</span></div>
            <RecentList label="Latest runs" items={recent} empty="No runs yet. Start one below." all="/console/heatmap" />
            {running ? <p className="hm-pop-busy">A task is running. Stop it first.</p> : !test ? <p className="hm-pop-busy">No usability test yet.</p> : (
              <>
                {tests.length > 1 && (
                  <select className="hm-pop-select" value={test.id} onChange={(e) => { const t = tests.find((x) => x.id === e.target.value); setPick({ testId: e.target.value, taskId: t?.tasks[0]?.id ?? '' }) }} aria-label="Test">
                    {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <div className="hm-pop-tasks" role="radiogroup" aria-label="Task">
                  {test.tasks.map((t, i) => (
                    <button key={t.id} role="radio" aria-checked={t.id === task?.id} className={t.id === task?.id ? 'on' : ''} onClick={() => setPick({ testId: test.id, taskId: t.id })}>
                      <b>Task {i + 1}</b> {t.prompt}
                    </button>
                  ))}
                </div>
                <div className="hm-pop-row">
                  <button onClick={() => { setOpen(false); setEditing('edit') }} disabled={!task}><Pencil size={12} /> Change task</button>
                  <button onClick={() => { setOpen(false); setEditing('new') }}><Plus size={12} /> New task</button>
                </div>
                <div className="dk-starts">
                  <button className="hm-pop-start" onClick={() => start(false)} disabled={!task}><Play size={13} /> Start</button>
                  <button className="hm-pop-start ghost" onClick={() => start(true)} disabled={!task} title="Uses your webcam to estimate where you look; about a minute to calibrate. Video never leaves the browser."><Eye size={13} /> Start with eye tracking</button>
                </div>
              </>
            )}
          </div>
        )}
      </DockPopover>
      {editing && test && createPortal(
        <TaskEdit task={editing === 'edit' ? task : undefined} results={0} onCancel={() => setEditing(null)} onSave={saveTask} />,
        document.body,
      )}
    </>
  )
}

/**
 * Sessions from the page you're on: the latest three, and Start. Start records a session from
 * this page at once; the dock then gives way to the recording bar, whose only action is Stop.
 */
export function SessionsMenu() {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<Recent[] | null>(null)
  useEffect(() => {
    if (!open) return
    let live = true
    setRecent(null)
    flushNow()
    void loadEvents().then((d) => {
      if (!live) return
      setRecent(buildSessions(d.events).slice(0, 3).map((s) => ({
        key: s.sid,
        title: `Session ${s.n}`,
        meta: `${s.pages.length} page${s.pages.length === 1 ? '' : 's'} · ${s.taps} tap${s.taps === 1 ? '' : 's'} · ${clock(s.ms)} · ${ago(s.start)}`,
        tag: s.problems ? { text: `${s.problems} problem${s.problems === 1 ? '' : 's'}`, tone: 'bad' } : undefined,
        route: `/console/sessions?sid=${s.sid}`,
      })))
    })
    return () => { live = false }
  }, [open])
  const start = () => {
    setOpen(false)
    setFlag('insights', true)
    startSessionNow()
  }
  return (
    <DockPopover label="Sessions" open={open} onOpenChange={setOpen} button={(o) => (
      <button className={`dock-icon ${o ? 'on' : ''}`} aria-label="Sessions" aria-expanded={o} title="Sessions: record what people tap, in order"><MousePointerClick size={15} /></button>
    )}>
      {() => (
        <div className="dock-pop" role="dialog" aria-label="Sessions">
          <div className="dock-verhead"><b>Sessions</b><span>Records a visit as a path: the pages opened and every tap, in order, with timing. Never what anyone types.</span></div>
          <RecentList label="Latest sessions" items={recent} empty="No sessions yet. Start one below." all="/console/sessions" />
          <button className="hm-pop-start" onClick={start}><Play size={13} /> Start recording here</button>
        </div>
      )}
    </DockPopover>
  )
}
