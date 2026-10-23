import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Crosshair, Plus, Trash2 } from 'lucide-react'
import { Empty, Modal } from '../components/ui'
import { DEVICES, ScreenViewer, type Device, type Picked } from '../tools/insights/ScreenViewer'
import { loadTests, saveTests, uid, type TestTask, type UsabilityTest } from '../tools/tests/store'
import { useStore } from '../store/store'

const newTask = (): TestTask => ({ id: uid(), prompt: '', startPage: '/', success: { kind: 'page', page: '/' }, limitSec: 60 })

export default function TestEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const { skills, projects, toast } = useStore()
  const existing = isNew ? undefined : loadTests().find((t) => t.id === id)
  const [test, setTest] = useState<UsabilityTest>(() => existing ?? {
    id: uid(), name: '', intro: 'You’ll get a few short tasks. There are no wrong answers — we’re testing the design, not you.',
    tasks: [newTask()], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  const [picking, setPicking] = useState<string | null>(null)
  const [pickDevice, setPickDevice] = useState<Device>('desktop')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!isNew && !existing) return <main className="page"><div className="card"><Empty title="Test not found"><Link className="btn sm" to="/console/tests">All tests</Link></Empty></div></main>

  const pages = ['/', '/skills', '/projects', '/teams', '/health', ...skills.map((s) => `/skills/${s.id}`), ...projects.map((p) => `/projects/${p.id}`), '/v2', '/v2/shelf', '/v2/projects', '/v2/tidy']
  const setTask = (tid: string, patch: Partial<TestTask>) => setTest((t) => ({ ...t, tasks: t.tasks.map((x) => (x.id === tid ? { ...x, ...patch } : x)) }))
  const move = (i: number, d: -1 | 1) => setTest((t) => {
    const tasks = [...t.tasks]
    ;[tasks[i], tasks[i + d]] = [tasks[i + d], tasks[i]]
    return { ...t, tasks }
  })

  const problems = [
    !test.name.trim() && 'Give the test a name',
    test.tasks.length === 0 && 'Add at least one task',
    test.tasks.some((t) => !t.prompt.trim()) && 'Every task needs a prompt',
    test.tasks.some((t) => t.success.kind === 'element' && !t.success.sel) && 'Pick the target element for every “tap an element” task',
  ].filter(Boolean) as string[]

  const save = () => {
    const all = loadTests()
    const next = { ...test, name: test.name.trim(), updatedAt: new Date().toISOString() }
    saveTests(isNew ? [...all, next] : all.map((t) => (t.id === next.id ? next : t)))
    toast(isNew ? 'Test created' : 'Test saved')
    nav(`/console/tests/${next.id}`)
  }

  const pickingTask = test.tasks.find((t) => t.id === picking)
  const onPick = (p: Picked) => {
    if (!picking) return
    setTask(picking, { success: { kind: 'element', sel: p.sel, label: p.label, page: p.page } })
    setPicking(null)
    toast(`Target set: “${p.label}”`)
  }

  return (
    <main className="page" style={{ maxWidth: 980 }}>
      
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}><Link to="/console/tests">Usability tests</Link> /</div>
          <h1>{isNew ? 'New usability test' : `Edit ${existing!.name}`}</h1>
          <p>Write each task as a goal the participant understands without knowing the app’s words for things.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => nav(-1)}>Cancel</button>
          <span className="tip" data-tip={problems[0]}>
            <button className="btn primary" aria-disabled={problems.length > 0} onClick={() => problems.length === 0 && save()}><Check size={15} /> {isNew ? 'Create test' : 'Save'}</button>
          </span>
        </div>
      </div>

      <section className="card card-body stack gap-16" style={{ marginBottom: 16 }}>
        <div className="field">
          <label htmlFor="tname">Test name</label>
          <input id="tname" className="input" value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} placeholder="e.g. Finding duplicate skills" />
        </div>
        <div className="field">
          <label htmlFor="tintro">Welcome message</label>
          <span className="hint">Shown before the first task. Set the scene; don’t hint at answers.</span>
          <textarea id="tintro" className="textarea" rows={2} value={test.intro} onChange={(e) => setTest({ ...test, intro: e.target.value })} />
        </div>
      </section>

      <datalist id="app-pages">{pages.map((p) => <option key={p} value={p} />)}</datalist>

      <div className="stack gap-12">
        {test.tasks.map((t, i) => (
          <section key={t.id} className="card card-body stack gap-12">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>Task {i + 1}</h3>
              <div className="row" style={{ gap: 2 }}>
                <button className="btn ghost sm icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button className="btn ghost sm icon" aria-label="Move down" disabled={i === test.tasks.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button className="btn ghost sm icon" aria-label="Delete task" onClick={() => setTest({ ...test, tasks: test.tasks.filter((x) => x.id !== t.id) })}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="field">
              <label htmlFor={`p-${t.id}`}>What should they do?</label>
              <textarea id={`p-${t.id}`} className="textarea" rows={2} value={t.prompt} onChange={(e) => setTask(t.id, { prompt: e.target.value })} placeholder="e.g. Find out which team uses skills the most." />
            </div>
            <div className="grid g-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor={`s-${t.id}`}>Starts on</label>
                <input id={`s-${t.id}`} className="input mono" list="app-pages" value={t.startPage} onChange={(e) => setTask(t.id, { startPage: e.target.value || '/' })} />
              </div>
              <div className="field">
                <label htmlFor={`l-${t.id}`}>Time limit (seconds)</label>
                <input id={`l-${t.id}`} type="number" min={10} max={900} className="input num" value={t.limitSec} onChange={(e) => setTask(t.id, { limitSec: Math.min(900, Math.max(10, Number(e.target.value) || 60)) })} />
              </div>
            </div>
            <div className="field">
              <label>Counts as success when they…</label>
              <div className="seg" role="group" aria-label="Success rule" style={{ alignSelf: 'flex-start' }}>
                <button aria-pressed={t.success.kind === 'page'} onClick={() => setTask(t.id, { success: { kind: 'page', page: t.success.kind === 'page' ? t.success.page : '/' } })}>Reach a page</button>
                <button aria-pressed={t.success.kind === 'element'} onClick={() => setTask(t.id, { success: { kind: 'element', sel: '', label: '', page: t.startPage } })}>Tap an element</button>
              </div>
              {t.success.kind === 'page' ? (
                <>
                  <input className="input mono" list="app-pages" value={t.success.page} aria-label="Target page" onChange={(e) => setTask(t.id, { success: { kind: 'page', page: e.target.value } })} />
                  <span className="hint">End with * to accept any page below it, e.g. <span className="mono">/skills/*</span>.</span>
                </>
              ) : (
                <div className="row wrap" style={{ gap: 10 }}>
                  {t.success.sel ? (
                    <span className="badge" style={{ height: 'auto', padding: '6px 10px' }}><Crosshair size={13} /> “{t.success.label}” on <span className="mono">{t.success.page}</span></span>
                  ) : <span className="muted" style={{ fontSize: 13 }}>No element picked yet.</span>}
                  <button className="btn sm" onClick={() => setPicking(t.id)}><Crosshair size={13} /> {t.success.sel ? 'Pick again' : 'Pick on screen'}</button>
                </div>
              )}
            </div>
          </section>
        ))}
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setTest({ ...test, tasks: [...test.tasks, newTask()] })}><Plus size={14} /> Add task</button>
      </div>

      {!isNew && (
        <div className="mt-24"><button className="btn danger" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete test</button></div>
      )}

      {pickingTask && (
        <>
          <div className="scrim" onClick={() => setPicking(null)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label="Pick the target element" style={{ width: 'min(1100px, calc(100vw - 32px))' }}>
            <div className="modal-head row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16 }}>Pick what they should tap</h2>
                <p>Task {test.tasks.indexOf(pickingTask) + 1}: {pickingTask.prompt || 'untitled'}</p>
              </div>
              <div className="seg" role="group" aria-label="Device">
                {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={pickDevice === d} onClick={() => setPickDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
              </div>
            </div>
            <div className="modal-body">
              <ScreenViewer page={pickingTask.startPage} device={pickDevice} mode="pick" onPick={onPick} maxHeight={Math.min(640, window.innerHeight - 240)} />
            </div>
            <div className="modal-foot"><button className="btn" onClick={() => setPicking(null)}>Cancel</button></div>
          </div>
        </>
      )}

      {confirmDelete && (
        <Modal title="Delete this test?" description="The test and its tasks are removed. Results already collected stay until you delete them." onClose={() => setConfirmDelete(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Keep test</button>
            <button className="btn primary" onClick={() => { saveTests(loadTests().filter((x) => x.id !== test.id)); toast('Test deleted'); nav('/console/tests') }}>Delete test</button>
          </>}
        />
      )}
    </main>
  )
}
