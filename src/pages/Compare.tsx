import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Crosshair, Minimize2, Maximize2, ExternalLink, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty, Modal } from '../components/ui'
import { ScreenViewer, DEVICES, type Device, type Picked } from '../tools/insights/ScreenViewer'
import { Crop } from '../tools/compare/Crop'
import { buildSamples, markSeeded, wasSeeded } from '../tools/compare/samples'
import { APP, readJSON, writeJSON } from '../tools/shared'
import { MAX_NOTE, SCREENS, loadReviews, nameOf, rid, same, sameSpot, saveReviews, screenOf, snapshot, stale, type About, type CNote, type Review, type Side, type Slot } from '../tools/compare/store'

const NAME_KEY = `${APP}.reviewPins.name`
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const appLink = (s: Slot) => `${window.location.pathname}${window.location.search}#${screenOf(s)}`
const short = (label: string) => label.replace(/^[a-z0-9]+(\.[\w-]+)?\s*/, '').replace(/[“”]/g, '').slice(0, 28) || label.slice(0, 28)

/* ---------- picking one component ---------- */

const MARK = 'data-cmp-selected'

function Picker({ side, start, onCancel, onUse }: { side: Side; start?: Slot; onCancel: () => void; onUse: (s: Slot) => void }) {
  const { toast } = useStore()
  const [device, setDevice] = useState<Device>(start?.device ?? 'desktop')
  const [screen, setScreen] = useState(start ? screenOf(start) : SCREENS[0].page)
  const [chain, setChain] = useState<Element[]>([])
  const [idx, setIdx] = useState(0)
  const el = chain[idx] as Element | undefined
  const [page, query] = screen.split('?')

  // A new screen or device reloads the frame, so an earlier choice no longer exists.
  useEffect(() => { setChain([]); setIdx(0) }, [device, screen])

  const onPick = useCallback((p: Picked) => {
    if (!p.target || !p.el) return
    const doc = p.target.ownerDocument
    const up: Element[] = []
    for (let n: Element | null = p.target; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) up.push(n)
    const at = up.indexOf(p.el)
    setChain(at >= 0 ? up : [p.el])
    setIdx(Math.max(0, at))
  }, [])

  // Keep the chosen element marked in the screen, even while the pointer hovers elsewhere.
  useEffect(() => {
    if (!el) return
    const doc = el.ownerDocument
    if (!doc.getElementById('cmp-mark-style')) {
      const s = doc.createElement('style')
      s.id = 'cmp-mark-style'
      s.textContent = `[${MARK}] { outline: 3px solid #e8590c !important; outline-offset: 2px !important; }`
      doc.head.appendChild(s)
    }
    el.setAttribute(MARK, side)
    return () => el.removeAttribute(MARK)
  }, [el, side])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const use = () => {
    if (!el) return
    if (!el.isConnected) { setChain([]); toast('The screen changed after you picked. Pick the component again.', 'error'); return }
    el.removeAttribute(MARK)
    onUse(snapshot(el, device))
  }

  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="modal cmp-picker" role="dialog" aria-modal="true" aria-label={`Pick component ${side}`}>
        <div className="modal-head row wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16 }}>Pick component {side}</h2>
            <p>Choose a screen, then click the component. Use Wider or Narrower if the outline isn’t the whole component.</p>
          </div>
          <div className="seg" role="group" aria-label="Device">
            {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
          </div>
        </div>
        <div className="modal-body stack gap-12">
          <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Screen">
            {SCREENS.map((s) => <button key={s.page} className="chip" aria-pressed={screen === s.page} onClick={() => setScreen(s.page)}>{s.label}</button>)}
          </div>
          <ScreenViewer key={device} page={page} query={query} device={device} mode="pick" onPick={onPick} maxHeight={Math.min(560, window.innerHeight - 330)} />
        </div>
        <div className="modal-foot cmp-picker-foot">
          <span className="cmp-picked">{el ? <><b>Selected:</b> <span className="mono">{nameOf(el)}</span></> : <span className="muted">Nothing selected yet.</span>}</span>
          <button className="btn sm" disabled={!el || idx === 0} onClick={() => setIdx(idx - 1)} title="Select the part inside"><Minimize2 size={13} /> Narrower</button>
          <button className="btn sm" disabled={!el || idx >= chain.length - 1} onClick={() => setIdx(idx + 1)} title="Select the element around it"><Maximize2 size={13} /> Wider</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={!el} onClick={use}>Use as {side}</button>
        </div>
      </div>
    </>
  )
}

/* ---------- choosing both, before the review is saved ---------- */

function SlotCard({ side, slot, onPick }: { side: Side; slot?: Slot; onPick: () => void }) {
  return (
    <section className="card card-body cmp-slot">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <b className="cmp-side">{side}</b>
        <button className="btn sm" onClick={onPick}><Crosshair size={13} /> {slot ? 'Change' : `Pick component ${side}`}</button>
      </div>
      {slot ? (
        <>
          <Crop slot={slot} maxHeight={220} />
          <SlotMeta slot={slot} />
        </>
      ) : <p className="muted" style={{ fontSize: 13 }}>No component yet.</p>}
    </section>
  )
}

function SlotMeta({ slot }: { slot: Slot }) {
  return (
    <div className="cmp-meta">
      <span className="mono">{slot.label}</span>
      <span className="muted">{screenOf(slot)} · {DEVICES[slot.device].label} <a href={appLink(slot)} target="_blank" rel="noopener" aria-label="Open the screen"><ExternalLink size={11} /></a></span>
    </div>
  )
}

function Editor({ initial, onCancel, onSave }: { initial?: Review; onCancel: () => void; onSave: (title: string, a: Slot, b: Slot) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [a, setA] = useState<Slot | undefined>(initial?.a)
  const [b, setB] = useState<Slot | undefined>(initial?.b)
  const [picking, setPicking] = useState<Side | null>(null)
  const [discard, setDiscard] = useState(false)
  const dup = a && b && sameSpot(a, b)
  const changed = title !== (initial?.title ?? '') || a !== initial?.a || b !== initial?.b
  const cancel = () => (changed ? setDiscard(true) : onCancel())
  const placeholder = a && b ? `${short(a.label)} vs ${short(b.label)}` : 'e.g. Product card on Home vs Search'

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{initial ? 'Change the review' : 'New component review'}</h1>
          <p>Pick two components from the app’s screens: the same component in two places, two variants, or one component on two devices. Notes come after saving.</p>
        </div>
      </div>
      <div className="field" style={{ maxWidth: 520, marginBottom: 16 }}>
        <label htmlFor="cmp-title">Title</label>
        <input id="cmp-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} />
      </div>
      <div className="cmp-pair">
        <SlotCard side="A" slot={a} onPick={() => setPicking('A')} />
        <SlotCard side="B" slot={b} onPick={() => setPicking('B')} />
      </div>
      {dup && <p className="cmp-warn"><TriangleAlert size={14} /> A and B are the same component on the same screen and device. Pick a different one for B, or the same one on another device.</p>}
      {initial && (a !== initial.a || b !== initial.b) && initial.notes.length > 0 && <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>Notes stay. Notes about a component you replace are marked as written about the earlier one.</p>}
      <div className="row mt-16" style={{ gap: 8 }}>
        <button className="btn" onClick={cancel}>Cancel</button>
        <button className="btn primary" disabled={!a || !b || !!dup} onClick={() => a && b && onSave(title.trim() || placeholder, a, b)}>{initial ? 'Save changes' : 'Save review'}</button>
        {(!a || !b) && <span className="muted" style={{ fontSize: 12.5 }}>Pick both components to save.</span>}
      </div>

      {picking && <Picker side={picking} start={picking === 'A' ? a ?? b : b ?? a} onCancel={() => setPicking(null)}
        onUse={(s) => { (picking === 'A' ? setA : setB)(s); setPicking(null) }} />}
      {discard && (
        <Modal title="Discard this review?" description={initial ? 'Your changes to the components and title are not saved.' : 'The components you picked are not saved.'} onClose={() => setDiscard(false)}
          footer={<><button className="btn" onClick={() => setDiscard(false)}>Keep editing</button><button className="btn primary" onClick={onCancel}>Discard</button></>} />
      )}
    </main>
  )
}

/* ---------- a saved review ---------- */

function Diff({ a, b }: { a: Slot; b: Slot }) {
  const rows = a.styles.map((r) => ({ r, o: b.styles.find((x) => x.key === r.key) }))
  const differ = rows.filter(({ r, o }) => !o || !same(r.value, o.value)).length
  const cell = (v?: { value: string; token?: string }) => v && (
    <span className="cmp-val">
      {/^rgba?\(/.test(v.value) && <i className="cmp-swatch" style={{ background: v.value }} />}
      <span className="mono">{v.value}</span>
      {v.token && <span className="badge outline">{v.token}</span>}
    </span>
  )
  return (
    <section className="card card-body">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <b>Rendered styles</b>
        <span className="muted" style={{ fontSize: 12.5 }}>{differ === 0 ? 'Same in every property checked' : `${differ} of ${rows.length} properties differ`} · as picked</span>
      </div>
      <div className="cmp-table-wrap">
        <table className="cmp-table">
          <thead><tr><th>Property</th><th>A</th><th>B</th></tr></thead>
          <tbody>
            {rows.map(({ r, o }) => {
              const d = !o || !same(r.value, o.value)
              return <tr key={r.key} className={d ? 'diff' : ''}><th scope="row">{r.label}{d && <span className="cmp-dot" aria-label="differs" />}</th><td>{cell(r)}</td><td>{cell(o)}</td></tr>
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Notes({ review, onChange }: { review: Review; onChange: (notes: CNote[]) => void }) {
  const { me } = useStore()
  const [name, setNameState] = useState<string>(() => readJSON(NAME_KEY, me.name))
  const setName = (v: string) => { setNameState(v); writeJSON(NAME_KEY, v) }
  const [text, setText] = useState('')
  const [about, setAbout] = useState<About>('both')
  const [filter, setFilter] = useState<About | 'all'>('all')
  const author = name.trim() || me.name
  useEffect(() => { setText(''); setAbout('both'); setFilter('all') }, [review.id])

  const add = () => {
    const t = text.trim()
    if (!t) return
    onChange([...review.notes, { id: rid(), author, text: t, about, at: new Date().toISOString() }])
    setText('')
  }
  const shown = review.notes.filter((n) => filter === 'all' || n.about === filter)
  const count = (f: About | 'all') => (f === 'all' ? review.notes.length : review.notes.filter((n) => n.about === f).length)
  const ABOUT: Record<About, string> = { A: 'About A', B: 'About B', both: 'Both' }

  return (
    <section className="card card-body stack gap-12">
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
        <b>Notes</b>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Show notes">
          {(['all', 'A', 'B', 'both'] as const).map((f) => <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : ABOUT[f]} <span className="num" style={{ opacity: .6 }}>{count(f)}</span></button>)}
        </div>
      </div>
      {review.notes.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No notes yet. Write what you see: what differs, which works better, and what should change.</p>}
      {review.notes.length > 0 && shown.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No notes {filter === 'both' ? 'about both' : `about ${filter}`}.</p>}
      {shown.length > 0 && (
        <ol className="cmp-notes">
          {shown.map((n) => (
            <li key={n.id}>
              <div className="cmp-note-head">
                <span className={`badge cmp-about-${n.about}`}>{ABOUT[n.about]}</span>
                <b>{n.author}</b><span className="muted">· {when(n.at)}</span>
                {n.author === author && <button className="btn ghost sm icon" style={{ marginLeft: 'auto' }} onClick={() => onChange(review.notes.filter((x) => x.id !== n.id))} aria-label="Delete note" title="Delete note"><Trash2 size={12} /></button>}
              </div>
              <p>{n.text}</p>
              {stale(n, review) && <span className="cmp-stale"><TriangleAlert size={12} /> Written about an earlier component; it was replaced after this note.</span>}
            </li>
          ))}
        </ol>
      )}
      <div className="cmp-compose">
        <textarea className="textarea" rows={3} maxLength={MAX_NOTE} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note…" aria-label="Note"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add() } }} />
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="The note is about">
            {(['A', 'B', 'both'] as const).map((x) => <button key={x} aria-pressed={about === x} onClick={() => setAbout(x)}>{ABOUT[x]}</button>)}
          </div>
          <label className="cmp-name muted">as <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Your name for notes" placeholder={me.name} /></label>
          <button className="btn primary sm" style={{ marginLeft: 'auto' }} disabled={!text.trim()} onClick={add}>Add note</button>
        </div>
      </div>
    </section>
  )
}

/* ---------- the page ---------- */

export default function Compare() {
  const { toast } = useStore()
  const [list, setList] = useState<Review[]>(loadReviews)
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const commit = (next: Review[]) => { setList(next); saveReviews(next) }
  const sorted = useMemo(() => [...list].sort((x, y) => y.createdAt.localeCompare(x.createdAt)), [list])
  const r = list.find((x) => x.id === sel) ?? sorted[0]
  useEffect(() => { window.scrollTo(0, 0) }, [editing])

  // Example reviews the first time the page opens empty, so it shows what it does. Deleting them is
  // respected: they come back only from the button.
  const [seeding, setSeeding] = useState(false)
  const started = useRef(false)
  const addSamples = async () => {
    if (started.current) return
    started.current = true
    setSeeding(true)
    const samples = await buildSamples('Sample')
    markSeeded()
    if (samples.length) { const next = [...loadReviews(), ...samples]; setList(next); saveReviews(next); setSel(samples[0].id) }
    else toast('The sample components couldn’t be found on the screens.', 'error')
    setSeeding(false)
    started.current = false
  }
  useEffect(() => { if (!loadReviews().length && !wasSeeded()) void addSamples() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    const initial = editing === 'new' ? undefined : list.find((x) => x.id === editing)
    return (
      <Editor key={editing} initial={initial} onCancel={() => setEditing(null)}
        onSave={(title, a, b) => {
          const now = new Date().toISOString()
          if (initial) {
            commit(list.map((x) => (x.id === initial.id ? { ...x, title, a, b, updatedAt: now } : x)))
            toast('Review saved')
          } else {
            const id = rid()
            commit([...list, { id, title, a, b, notes: [], createdAt: now, updatedAt: now }])
            setSel(id)
            toast('Review saved. Add your notes.')
          }
          setEditing(null)
        }} />
    )
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Component review</h1>
          <p>Put two components from the app side by side, see how their rendered styles differ, and keep notes on what should change. Reviews are saved in this browser.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => setEditing('new')}><Plus size={14} /> New review</button></div>
      </div>

      {!r ? (
        <div className="card"><Empty title={seeding ? 'Preparing sample reviews…' : 'No reviews yet'}>
          <span>{seeding ? 'Capturing components from the real screens.' : 'Start a review: pick component A and component B from any screen, save, then write your notes.'}</span>
          {!seeding && <button className="btn sm" onClick={() => void addSamples()}>Add sample reviews</button>}
        </Empty></div>
      ) : (
        <div className="ses">
          <nav className="ses-list" aria-label="Reviews">
            {sorted.map((x) => (
              <button key={x.id} className={`ses-row ${x.id === r.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                <b>{x.title}</b>
                <span className="muted">{x.sample && <span className="badge outline" style={{ height: 18, marginRight: 6 }}>Sample</span>}{x.notes.length} note{x.notes.length === 1 ? '' : 's'} · {when(x.updatedAt)}</span>
              </button>
            ))}
          </nav>
          <section className="stack gap-16" style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
              <h2 style={{ fontSize: 18 }}>{r.title}</h2>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn sm" onClick={() => setEditing(r.id)} title="Rename, or replace a component"><Pencil size={13} /> Edit</button>
                <button className="btn sm danger" onClick={() => setConfirmDelete(true)} aria-label="Delete review" title="Delete review"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="cmp-pair">
              {(['A', 'B'] as const).map((s) => {
                const slot = s === 'A' ? r.a : r.b
                return (
                  <section key={s} className="card card-body cmp-slot">
                    <b className="cmp-side">{s}</b>
                    <Crop key={`${r.id}-${slot.pickedAt}`} slot={slot} />
                    <SlotMeta slot={slot} />
                  </section>
                )
              })}
            </div>
            <Diff a={r.a} b={r.b} />
            <Notes review={r} onChange={(notes) => commit(list.map((x) => (x.id === r.id ? { ...x, notes, updatedAt: new Date().toISOString() } : x)))} />
          </section>
        </div>
      )}

      {confirmDelete && r && (
        <Modal title="Delete this review?" description={`“${r.title}” and its ${r.notes.length} note${r.notes.length === 1 ? '' : 's'} are removed from this browser.`} onClose={() => setConfirmDelete(false)}
          footer={<><button className="btn" onClick={() => setConfirmDelete(false)}>Keep review</button>
            <button className="btn primary" onClick={() => { commit(list.filter((x) => x.id !== r.id)); setSel(null); setConfirmDelete(false); toast('Review deleted') }}>Delete review</button></>} />
      )}
    </main>
  )
}
