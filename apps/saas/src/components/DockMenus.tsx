import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Flame, MousePointerClick, Play, Pencil, Plus, ArrowRight, Square, Eye } from 'lucide-react'
import { loadTests, saveTests, UT_START, UT_STATE, utRunning, type UtStart, type TestTask } from '../tools/tests/store'
import { TaskEdit } from '../pages/heatmap/TaskEdit'
import { SESSION_EVENT, endSession, sessionState } from '../tools/insights/tracker'
import { setFlag, useFlag, readJSON, writeJSON } from '../tools/shared'
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

const PICK_KEY = 'market.dock.heatmap'
interface Pick { testId: string; taskId: string; eyes: boolean; name: string }

/**
 * Start a heatmap test right on the page you're on: choose a task, optionally your name and eye
 * tracking, and go. The task runs here; the results open on their own page.
 */
export function HeatmapMenu() {
  const { toast } = useStore()
  const [tests, setTests] = useState(loadTests)
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(utRunning)
  const [editing, setEditing] = useState<'edit' | 'new' | null>(null)
  const saved = readJSON<Pick | null>(PICK_KEY, null)
  const [pick, setPickState] = useState<Pick>(() => ({ testId: saved?.testId ?? tests[0]?.id ?? '', taskId: saved?.taskId ?? tests[0]?.tasks[0]?.id ?? '', eyes: saved?.eyes ?? false, name: saved?.name ?? '' }))
  const setPick = (p: Pick) => { setPickState(p); writeJSON(PICK_KEY, p) }
  useEffect(() => {
    const sync = () => setRunning(utRunning())
    window.addEventListener(UT_STATE, sync)
    return () => window.removeEventListener(UT_STATE, sync)
  }, [])
  useEffect(() => { if (open) setTests(loadTests()) }, [open])
  const test = tests.find((t) => t.id === pick.testId) ?? tests[0]
  const task = test?.tasks.find((t) => t.id === pick.taskId) ?? test?.tasks[0]

  const start = () => {
    if (!test || !task) return
    setOpen(false)
    window.dispatchEvent(new CustomEvent<UtStart>(UT_START, { detail: { testId: test.id, taskId: task.id, eyes: pick.eyes, name: pick.name } }))
  }
  const saveTask = (t: TestTask) => {
    if (!test) return
    const next = tests.map((x) => (x.id === test.id ? { ...x, tasks: editing === 'edit' ? x.tasks.map((k) => (k.id === t.id ? t : k)) : [...x.tasks, t], updatedAt: new Date().toISOString() } : x))
    saveTests(next); setTests(next); setEditing(null)
    setPick({ ...pick, testId: test.id, taskId: t.id })
    toast(editing === 'edit' ? 'Task saved' : 'Task added')
  }

  return (
    <>
      <DockPopover label="Heatmap" open={open} onOpenChange={setOpen} button={(o) => (
        <button className={`dock-icon ${o ? 'on' : ''}`} aria-label="Heatmap test" aria-expanded={o} title="Heatmap test: do a task here, see where you clicked and looked"><Flame size={15} /></button>
      )}>
        {() => (
          <div className="dock-pop hm-pop" role="dialog" aria-label="Heatmap test">
            <div className="dock-verhead"><b>Heatmap test</b><span>Do a task right here. Your clicks (and, if you like, where you look) are recorded.</span></div>
            {running ? <p className="hm-pop-busy">A task is running. Finish it, or give up, first.</p> : !test ? <p className="hm-pop-busy">No usability test yet.</p> : (
              <>
                {tests.length > 1 && (
                  <select className="hm-pop-select" value={test.id} onChange={(e) => { const t = tests.find((x) => x.id === e.target.value); setPick({ ...pick, testId: e.target.value, taskId: t?.tasks[0]?.id ?? '' }) }} aria-label="Test">
                    {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
                <div className="hm-pop-tasks" role="radiogroup" aria-label="Task">
                  {test.tasks.map((t, i) => (
                    <label key={t.id} className={t.id === task?.id ? 'on' : ''}>
                      <input type="radio" name="hm-task" checked={t.id === task?.id} onChange={() => setPick({ ...pick, taskId: t.id })} />
                      <span><b>Task {i + 1}</b> {t.prompt}</span>
                    </label>
                  ))}
                </div>
                <div className="hm-pop-row">
                  <button onClick={() => { setOpen(false); setEditing('edit') }} disabled={!task}><Pencil size={12} /> Change task</button>
                  <button onClick={() => { setOpen(false); setEditing('new') }}><Plus size={12} /> New task</button>
                </div>
                <input className="hm-pop-input" value={pick.name} onChange={(e) => setPick({ ...pick, name: e.target.value })} maxLength={40} placeholder="Name or code (optional)" aria-label="Name or code" />
                <label className="hm-pop-check"><input type="checkbox" checked={pick.eyes} onChange={(e) => setPick({ ...pick, eyes: e.target.checked })} /> <Eye size={13} /> Also record where I look (webcam, about a minute to calibrate)</label>
                <button className="hm-pop-start" onClick={start} disabled={!task}><Play size={13} /> Start the task here</button>
              </>
            )}
            <div className="tk-foot"><span /><Link to="/console/heatmap" onClick={() => setOpen(false)}>See results <ArrowRight size={12} /></Link></div>
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

/** Record sessions from where you are: switch recording on or off, end the current session. */
export function SessionsMenu() {
  const recording = useFlag('insights')
  const [state, setState] = useState(sessionState)
  useEffect(() => {
    const sync = () => setState(sessionState())
    window.addEventListener(SESSION_EVENT, sync)
    sync()
    return () => window.removeEventListener(SESSION_EVENT, sync)
  }, [])
  return (
    <DockPopover label="Sessions" button={(o) => (
      <button className={`dock-icon ${o ? 'on' : ''} ${recording ? 'rec' : ''}`} aria-label="Sessions" aria-expanded={o} title="Sessions: record what people tap, in order"><MousePointerClick size={15} /></button>
    )}>
      {(close) => (
        <div className="dock-pop" role="dialog" aria-label="Sessions">
          <div className="dock-verhead"><b>Sessions</b><span>Records each visit as a path: the pages opened and every tap, in order, with timing. Never what anyone types.</span></div>
          <label className="hm-pop-check big">
            <input type="checkbox" checked={recording} onChange={() => { if (recording) endSession('stopped'); setFlag('insights', !recording) }} />
            <span><b>{recording ? 'Recording is on' : 'Recording is off'}</b><br /><small>{recording ? (state === 'active' ? 'A session is being recorded now.' : 'A session starts when the home page opens.') : 'Turn it on, then use the shop as a visitor would.'}</small></span>
          </label>
          {recording && state === 'active' && <button className="hm-pop-start ghost" onClick={() => { endSession('ended'); close() }}><Square size={12} /> End this session</button>}
          <div className="tk-foot"><span /><Link to="/console/sessions" onClick={close}>See sessions <ArrowRight size={12} /></Link></div>
        </div>
      )}
    </DockPopover>
  )
}
