import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { Columns2, X, Plus, Crosshair, Hand, Minimize2, Maximize2, MapPin, CheckCircle2, Clock, RotateCcw, ArrowRight, TriangleAlert, ExternalLink } from 'lucide-react'
import { useStore } from '../../store/store'
import { layoutOf } from '../insights/store'
import { isEmbedded } from '../shared'
import { AnnotatedCrop, Diff } from './parts'
import { buildSamples, markSeeded, wasSeeded } from './samples'
import {
  CHOICE_LABEL, COMPARE_CHANGED, COMPARE_OPEN, loadReviews, nameOf, rid, sameSpot, saveReviews, screenOf, snapshot, statusOf, reviewerName,
  type Annotation, type Choice, type CompareOpen, type Review, type Side, type Slot,
} from './store'
import type { Device } from '../insights/ScreenViewer'

const SKIP = '[data-compare-ui], [data-insights-ignore], [data-review-pins], [data-usability-test], [data-gaze], [data-inspector], .dock, .toasts'
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/* ---------- picking a component on the page you're on ---------- */

function PagePicker({ side, onUse, onCancel }: { side: Side; onUse: (s: Slot) => void; onCancel: () => void }) {
  const [chain, setChain] = useState<Element[]>([])
  const [idx, setIdx] = useState(0)
  const [hover, setHover] = useState<Element | null>(null)
  const [navigate, setNavigate] = useState(false)
  const [, tick] = useState(0)
  const el = chain[idx]
  useEffect(() => {
    if (navigate) return
    const tool = (t: EventTarget | null) => !(t instanceof Element) || !!t.closest(SKIP)
    const move = (e: PointerEvent) => { if (!tool(e.target)) setHover(e.target as Element) }
    const block = (e: Event) => { if (!tool(e.target)) { e.preventDefault(); e.stopPropagation() } }
    const click = (e: MouseEvent) => {
      if (tool(e.target)) return
      e.preventDefault(); e.stopPropagation()
      const up: Element[] = []
      for (let n: Element | null = e.target as Element; n && n !== document.body; n = n.parentElement) up.push(n)
      // Start on the nearest control or card, so one click usually gets the whole component.
      const start = Math.max(0, up.findIndex((n) => n.matches('a, button, input, select, textarea, [role=button], .card, .pcard, .chip')))
      setChain(up); setIdx(start)
    }
    const redraw = () => tick((n) => n + 1)
    document.addEventListener('pointermove', move, true)
    document.addEventListener('click', click, true)
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit']) document.addEventListener(t, block, true)
    window.addEventListener('scroll', redraw, true)
    document.documentElement.classList.add('inspecting')
    return () => {
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('click', click, true)
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit']) document.removeEventListener(t, block, true)
      window.removeEventListener('scroll', redraw, true)
      document.documentElement.classList.remove('inspecting')
    }
  }, [navigate])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])
  // A chosen element that left the page (another screen opened) is let go.
  useEffect(() => { if (el && !el.isConnected) { setChain([]); setIdx(0) } })
  const box = (e: Element | null | undefined, cls: string) => { if (!e || !e.isConnected) return null; const r = e.getBoundingClientRect(); return <div className={cls} style={{ left: r.left, top: r.top, width: r.width, height: r.height }} /> }
  return createPortal(
    <div data-compare-ui>
      {!navigate && box(hover, 'cmpk-hover')}
      {box(el, 'cmpk-sel')}
      <div className="cmpk-bar" role="dialog" aria-label={`Pick component ${side}`}>
        <b className="cmp-side">{side}</b>
        <span className="cmpk-text">{navigate ? 'Use the shop to reach the right screen, then press Pick.' : el ? <>Selected: <span className="mono">{nameOf(el)}</span></> : `Click the component to use as ${side}.`}</span>
        <div className="seg" role="group" aria-label="Mode">
          <button aria-pressed={!navigate} onClick={() => setNavigate(false)}><Crosshair size={13} /> Pick</button>
          <button aria-pressed={navigate} onClick={() => setNavigate(true)}><Hand size={13} /> Navigate</button>
        </div>
        <button className="btn sm" disabled={!el || idx === 0} onClick={() => setIdx(idx - 1)}><Minimize2 size={13} /> Narrower</button>
        <button className="btn sm" disabled={!el || idx >= chain.length - 1} onClick={() => setIdx(idx + 1)}><Maximize2 size={13} /> Wider</button>
        <button className="btn sm" onClick={onCancel}>Cancel</button>
        <button className="btn sm primary" disabled={!el} onClick={() => el && onUse(snapshot(el, layoutOf(window.innerWidth) as Device))}>Use as {side}</button>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- reviewing one comparison ---------- */

function ReviewView({ review, onClose, onSave }: { review: Review; onClose: () => void; onSave: (r: Review, msg: string) => void }) {
  const me = reviewerName()
  const pending = statusOf(review) === 'pending'
  const round = review.round ?? 1
  const [annotate, setAnnotate] = useState(false)
  const [hl, setHl] = useState<string | null>(null)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [summary, setSummary] = useState('')
  const [tried, setTried] = useState(false)
  const anns = useMemo(() => [...(review.annotations ?? [])].sort((a, b) => a.at.localeCompare(b.at)), [review.annotations])
  const numberOf = (a: Annotation) => anns.indexOf(a) + 1
  const now = () => new Date().toISOString()
  const add = (side: Side, x: number, y: number, text: string) => onSave({ ...review, annotations: [...anns, { id: rid(), side, x, y, text, author: me, at: now(), round }], updatedAt: now() }, 'Note added')
  const remove = (a: Annotation) => onSave({ ...review, annotations: anns.filter((x) => x.id !== a.id), updatedAt: now() }, 'Note deleted')
  const decide = () => {
    setTried(true)
    if (!choice) return
    onSave({ ...review, status: 'done', decision: { by: me, at: now(), choice, summary: summary.trim(), round }, updatedAt: now() }, 'Review submitted')
    setAnnotate(false)
  }
  const again = () => onSave({ ...review, status: 'pending', history: [...(review.history ?? []), ...(review.decision ? [review.decision] : [])], decision: undefined, round: round + 1, updatedAt: now() }, 'Sent back for another review')
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !annotate) onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [annotate, onClose])

  return createPortal(
    <div className="cmpr" data-compare-ui role="dialog" aria-modal="true" aria-label={`Review: ${review.title}`}>
      <div className="cmpr-head">
        <div className="cmpr-title">
          <span className={`cmpr-status ${pending ? 'pending' : 'done'}`}>{pending ? <><Clock size={12} /> Awaiting review{round > 1 ? ` · round ${round}` : ''}</> : <><CheckCircle2 size={12} /> Reviewed</>}</span>
          <h2>{review.title}</h2>
          {review.question && <p className="cmpr-q">“{review.question}”</p>}
          <span className="muted" style={{ fontSize: 12.5 }}>Submitted by {review.submittedBy ?? 'someone'} · {when(review.createdAt)}{review.sample ? ' · sample' : ''}</span>
        </div>
        <button className={`btn sm ${annotate ? 'primary' : ''}`} onClick={() => setAnnotate((v) => !v)} aria-pressed={annotate}><MapPin size={13} /> {annotate ? 'Done annotating' : 'Annotate'}</button>
        <button className="btn sm ghost icon" onClick={onClose} aria-label="Close review"><X size={16} /></button>
      </div>
      {annotate && <div className="cmpr-hint"><MapPin size={13} /> Click anywhere on A or B to pin a note there.</div>}
      <div className="cmpr-body">
        <div className="cmp-pair">
          {(['A', 'B'] as const).map((s) => {
            const slot = s === 'A' ? review.a : review.b
            return (
              <section key={s} className="card card-body cmp-slot">
                <div className="row" style={{ justifyContent: 'space-between' }}><b className="cmp-side">{s}</b><a className="btn sm ghost" href={`${window.location.pathname}${window.location.search}#${screenOf(slot)}`} target="_blank" rel="noopener">{screenOf(slot)} · {slot.device} <ExternalLink size={11} /></a></div>
                <AnnotatedCrop slot={slot} side={s} annotations={anns} numberOf={numberOf} annotate={annotate} onAdd={(x, y, t) => add(s, x, y, t)} onRemove={remove} me={me} highlight={hl} onHighlight={setHl} maxHeight={300} />
                <span className="mono muted" style={{ fontSize: 12 }}>{slot.label}</span>
              </section>
            )
          })}
        </div>
        <div className="cmpr-cols">
          <Diff a={review.a} b={review.b} />
          <section className="card card-body cmpr-decide">
            {pending ? (
              <>
                <h3>Your decision</h3>
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>Reviewing as <b>{me}</b>. Pin notes on the components, then decide.</p>
                <div className="cmpr-choices" role="radiogroup" aria-label="Decision">
                  {(Object.keys(CHOICE_LABEL) as Choice[]).map((c) => <button key={c} role="radio" aria-checked={choice === c} className={choice === c ? 'on' : ''} onClick={() => setChoice(c)}>{CHOICE_LABEL[c]}</button>)}
                </div>
                <textarea className="textarea" rows={3} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Why, and what should change (optional)" aria-label="Summary" />
                {tried && !choice && <p className="cmpr-err">Choose a decision first.</p>}
                <button className="btn primary" onClick={decide}>Submit review</button>
              </>
            ) : review.decision && (
              <>
                <h3>Decision: {CHOICE_LABEL[review.decision.choice]}</h3>
                <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>by {review.decision.by} · {when(review.decision.at)}{round > 1 ? ` · round ${round}` : ''}</p>
                {review.decision.summary && <p className="cmpr-summary">{review.decision.summary}</p>}
                <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{anns.filter((a) => a.round === round).length} note{anns.filter((a) => a.round === round).length === 1 ? '' : 's'} pinned on the components.</p>
                <button className="btn" onClick={again}><RotateCcw size={13} /> Changed it? Ask for another review</button>
              </>
            )}
            {(review.history?.length ?? 0) > 0 && (
              <details className="cmpr-history"><summary>Earlier reviews ({review.history!.length})</summary>
                <ul>{review.history!.map((d, i) => <li key={i}><b>Round {d.round}:</b> {CHOICE_LABEL[d.choice]} · {d.by}{d.summary ? ` — ${d.summary}` : ''}</li>)}</ul>
              </details>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- the panel: list, new comparison, review ---------- */

/** The dock's Compare button, with how many comparisons wait for a review. */
export function CompareButton() {
  const [n, setN] = useState(() => loadReviews().filter((r) => statusOf(r) === 'pending').length)
  useEffect(() => {
    const sync = () => setN(loadReviews().filter((r) => statusOf(r) === 'pending').length)
    window.addEventListener(COMPARE_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(COMPARE_CHANGED, sync); window.removeEventListener('storage', sync) }
  }, [])
  return (
    <button className="dock-icon dock-count" onClick={() => window.dispatchEvent(new Event(COMPARE_OPEN))} aria-label={`Compare components, ${n} waiting for review`} title="Compare components: submit two for review, or review them">
      <Columns2 size={15} />{n > 0 && <span>{n}</span>}
    </button>
  )
}

export function CompareDock() {
  const { toast } = useStore()
  const [list, setList] = useState<Review[]>(loadReviews)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'todo' | 'all'>('todo')
  const [form, setForm] = useState<{ title: string; question: string; a?: Slot; b?: Slot } | null>(null)
  const [picking, setPicking] = useState<Side | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)
  /** A review opened from the list goes back to the list when closed, so the next one is a click away. */
  const [fromList, setFromList] = useState(false)
  const [tried, setTried] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const seeded = useRef(false)
  const { pathname } = useLocation()
  // Another page: the panel closes, except while picking a component (you may be going to find it).
  useEffect(() => { if (!picking) setOpen(false) }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sync = () => setList(loadReviews())
    window.addEventListener(COMPARE_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(COMPARE_CHANGED, sync); window.removeEventListener('storage', sync) }
  }, [])
  // Example comparisons the first time, so there is something to review.
  const seed = useCallback(async () => {
    if (seeded.current || loadReviews().length || wasSeeded()) return
    seeded.current = true
    setSeeding(true)
    const s = await buildSamples('Sample')
    markSeeded()
    if (s.length) saveReviews([...loadReviews(), ...s])
    setSeeding(false)
  }, [])
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<CompareOpen>).detail
      if (!d || d.view === 'list') { setOpen((v) => (d ? true : !v)); setReviewing(null); void seed() }
      else if (d.view === 'new') { setOpen(true); setForm({ title: '', question: '' }); setTried(false) }
      else { setReviewing(d.id); setFromList(false); setOpen(false) }
    }
    window.addEventListener(COMPARE_OPEN, on)
    return () => window.removeEventListener(COMPARE_OPEN, on)
  }, [seed])

  if (isEmbedded) return null
  const save = (r: Review, msg: string) => { saveReviews(loadReviews().map((x) => (x.id === r.id ? r : x))); toast(msg) }
  const pending = list.filter((r) => statusOf(r) === 'pending').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const all = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const shown = tab === 'todo' ? pending : all
  const dup = form?.a && form.b && sameSpot(form.a, form.b)
  const submit = () => {
    setTried(true)
    if (!form?.a || !form.b || dup || !form.question.trim()) return
    const now = new Date().toISOString()
    // A component's name is like: button.btn “Add to cart”. The title uses the words inside the quotes.
    const short = (l: string, fallback: string) => (l.match(/“([^”]+)”/)?.[1] ?? fallback).slice(0, 32)
    const title = form.title.trim() || `${short(form.a.label, 'A')} vs ${short(form.b.label, 'B')}`
    saveReviews([...loadReviews(), { id: rid(), title, question: form.question.trim(), a: form.a, b: form.b, notes: [], annotations: [], createdAt: now, updatedAt: now, submittedBy: reviewerName(), status: 'pending', round: 1 }])
    setForm(null); setTab('todo')
    toast('Sent for review')
  }
  const review = list.find((r) => r.id === reviewing)

  return (
    <>
      {open && !picking && createPortal(
        <aside className="cmpd" data-compare-ui aria-label="Compare components">
          <div className="cmpd-head">
            <b>Compare components</b>
            <span className="cmp-grow" />
            <button className="btn sm ghost icon" onClick={() => { setOpen(false); setForm(null) }} aria-label="Close"><X size={15} /></button>
          </div>
          {form ? (
            <div className="cmpd-form">
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>Pick two components on the shop’s pages and ask a reviewer to decide.</p>
              <label className="field"><span className="label">What should the reviewer decide?</span>
                <textarea className="textarea" rows={2} value={form.question} maxLength={300} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. Which card should we use everywhere?" aria-invalid={tried && !form.question.trim()} /></label>
              <label className="field"><span className="label">Title <span className="muted">(optional)</span></span><input className="input" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              {(['A', 'B'] as const).map((s) => {
                const slot = s === 'A' ? form.a : form.b
                return (
                  <div key={s} className="cmpd-slot">
                    <b className="cmp-side">{s}</b>
                    <span className="cmpd-slot-text">{slot ? <><span className="mono">{slot.label}</span><small>{screenOf(slot)} · {slot.device}</small></> : <span className="muted">Not picked yet</span>}</span>
                    <button className="btn sm" onClick={() => setPicking(s)}><Crosshair size={13} /> {slot ? 'Pick again' : 'Pick on the page'}</button>
                  </div>
                )
              })}
              {dup && <p className="cmpr-err"><TriangleAlert size={13} /> A and B are the same component on the same screen and width.</p>}
              {tried && !form.question.trim() && <p className="cmpr-err">Write what the reviewer should decide.</p>}
              {tried && (!form.a || !form.b) && <p className="cmpr-err">Pick both components.</p>}
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setForm(null)}>Cancel</button>
                <button className="btn primary" onClick={submit}>Send for review</button>
              </div>
            </div>
          ) : (
            <>
              <div className="cmpd-tabs" role="tablist">
                <button role="tab" aria-selected={tab === 'todo'} onClick={() => setTab('todo')}>To review <span>{pending.length}</span></button>
                <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>All <span>{list.length}</span></button>
                <span className="cmp-grow" />
                <button className="btn sm primary" onClick={() => { setForm({ title: '', question: '' }); setTried(false) }}><Plus size={13} /> New</button>
              </div>
              <ul className="cmpd-list">
                {seeding && <li className="muted cmpd-empty">Preparing example comparisons…</li>}
                {!seeding && shown.length === 0 && <li className="muted cmpd-empty">{tab === 'todo' ? 'Nothing waiting for review.' : 'No comparisons yet.'} Press <b>New</b> to pick two components on the page.</li>}
                {shown.map((r) => {
                  const p = statusOf(r) === 'pending'
                  return (
                    <li key={r.id}>
                      <button onClick={() => { setReviewing(r.id); setFromList(true); setOpen(false) }}>
                        <span className="row" style={{ gap: 6 }}><span className={`cmpr-status ${p ? 'pending' : 'done'}`}>{p ? 'To review' : CHOICE_LABEL[r.decision!.choice]}</span><b className="cmpd-title">{r.title}</b></span>
                        {r.question && <span className="cmpd-q">{r.question}</span>}
                        <span className="muted" style={{ fontSize: 11.5 }}>by {r.submittedBy ?? 'someone'} · {(r.annotations ?? []).length} note{(r.annotations ?? []).length === 1 ? '' : 's'} · {when(r.updatedAt)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="tk-foot cmpd-foot"><span /><Link to="/console/compare" onClick={() => setOpen(false)}>All comparisons <ArrowRight size={12} /></Link></div>
            </>
          )}
        </aside>,
        document.body,
      )}
      {picking && form && <PagePicker side={picking} onCancel={() => setPicking(null)} onUse={(s) => { setForm({ ...form, [picking === 'A' ? 'a' : 'b']: s }); setPicking(null) }} />}
      {review && <ReviewView review={review} onClose={() => { setReviewing(null); if (fromList) setOpen(true) }} onSave={save} />}
    </>
  )
}
