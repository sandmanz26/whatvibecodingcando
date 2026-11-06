import { useState } from 'react'
import { Crosshair } from 'lucide-react'
import { Modal } from '../../components/ui'
import { ScreenViewer, type Picked } from '../../tools/insights/ScreenViewer'
import { uid, type TestTask } from '../../tools/tests/store'

const PAGES = ['/', '/search', '/product/p1', '/product/p9', '/cart', '/checkout', '/orders']

/**
 * Change a task, or write a new one, without leaving the Heatmap. A task needs a prompt, the page
 * it starts on, and what counts as success: reaching a page, or clicking an element (picked on the
 * real screen). Results already collected stay with the task.
 */
export function TaskEdit({ task, results, onCancel, onSave }: { task?: TestTask; results: number; onCancel: () => void; onSave: (t: TestTask) => void }) {
  const [t, setT] = useState<TestTask>(task ?? { id: uid(), prompt: '', startPage: '/', success: { kind: 'page', page: '/product/p1' }, limitSec: 60 })
  const [picking, setPicking] = useState(false)
  const [tried, setTried] = useState(false)
  const pathOk = (p: string) => /^\/[\w\-/*]*$/.test(p)
  const problem = !t.prompt.trim() ? 'Write what the participant should do.'
    : !pathOk(t.startPage) ? 'The start page is a path like /search.'
      : t.success.kind === 'page' ? (!pathOk(t.success.page) ? 'The goal page is a path like /product/p1 (a trailing * matches below it).' : '')
        : !t.success.sel ? 'Pick the element to click.' : ''
  const save = () => { setTried(true); if (!problem) onSave({ ...t, prompt: t.prompt.trim() }) }

  if (picking) {
    const page = t.success.kind === 'element' ? t.success.page : t.startPage
    return (
      <Modal title="Pick what they should click" description="Click it on the screen. Use Navigate to reach another screen first." onClose={() => setPicking(false)}
        footer={<button className="btn" onClick={() => setPicking(false)}>Cancel</button>}>
        <div>
          <ScreenViewer page={page} device="desktop" mode="pick" maxHeight={Math.min(560, window.innerHeight - 260)}
            onPick={(p: Picked) => { setT({ ...t, success: { kind: 'element', sel: p.sel, label: p.label, page: p.page } }); setPicking(false) }} />
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={task ? 'Change this task' : 'New task'} description={task && results ? `${results} participant result${results === 1 ? '' : 's'} stay with this task. Change the wording or goal only if they still fit.` : undefined} onClose={onCancel}
      footer={<><button className="btn" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={save}>{task ? 'Save task' : 'Add task'}</button></>}>
      <div className="stack gap-12">
        <datalist id="te-pages">{PAGES.map((p) => <option key={p} value={p} />)}</datalist>
        <div className="field"><label htmlFor="te-prompt">What should they do?</label>
          <textarea id="te-prompt" className="textarea" rows={3} value={t.prompt} onChange={(e) => setT({ ...t, prompt: e.target.value })} placeholder="e.g. Find a gift for someone who loves coffee and open its page." /></div>
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="te-start">Starts on</label><input id="te-start" className="input mono" list="te-pages" value={t.startPage} onChange={(e) => setT({ ...t, startPage: e.target.value.trim() })} /></div>
          <div className="field" style={{ width: 120 }}><label htmlFor="te-limit">Time limit (s)</label><input id="te-limit" type="number" min={10} max={900} className="input num" value={t.limitSec} onChange={(e) => setT({ ...t, limitSec: Math.min(900, Math.max(10, Number(e.target.value) || 60)) })} /></div>
        </div>
        <div className="field">
          <label>Success means</label>
          <div className="seg" role="group" aria-label="Success">
            <button aria-pressed={t.success.kind === 'page'} onClick={() => setT({ ...t, success: { kind: 'page', page: t.success.page || '/' } })}>Reaching a page</button>
            <button aria-pressed={t.success.kind === 'element'} onClick={() => setT({ ...t, success: t.success.kind === 'element' ? t.success : { kind: 'element', sel: '', label: '', page: t.startPage } })}>Clicking something</button>
          </div>
          {t.success.kind === 'page'
            ? <input className="input mono" list="te-pages" value={t.success.page} onChange={(e) => setT({ ...t, success: { kind: 'page', page: e.target.value.trim() } })} aria-label="Goal page" />
            : <div className="row" style={{ gap: 8 }}>
                <button className="btn sm" onClick={() => setPicking(true)}><Crosshair size={13} /> {t.success.sel ? 'Pick again' : 'Pick on the screen'}</button>
                <span className="muted" style={{ fontSize: 13 }}>{t.success.sel ? <>{t.success.label} on <span className="mono">{t.success.page}</span></> : 'Nothing picked yet'}</span>
              </div>}
        </div>
        {tried && problem && <p style={{ color: 'var(--critical-ink)', fontSize: 13, margin: 0 }}>{problem}</p>}
      </div>
    </Modal>
  )
}
