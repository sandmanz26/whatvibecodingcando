import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Crop } from './Crop'
import { same, type Annotation, type Side, type Slot } from './store'

/** The rendered styles of A and B, row by row, with the differences marked. */
export function Diff({ a, b }: { a: Slot; b: Slot }) {
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

/**
 * A component, cropped from the live screen, with the reviewer's numbered pins on it. In annotate
 * mode a click drops a pin and asks for its note; Esc or Cancel drops it again.
 */
export function AnnotatedCrop({ slot, side, annotations, numberOf, annotate, onAdd, onRemove, me, highlight, onHighlight, maxHeight }: {
  slot: Slot; side: Side; annotations: Annotation[]; numberOf: (a: Annotation) => number
  annotate: boolean; onAdd: (x: number, y: number, text: string) => void; onRemove: (a: Annotation) => void; me: string
  highlight: string | null; onHighlight: (id: string | null) => void; maxHeight?: number
}) {
  const [draft, setDraft] = useState<{ x: number; y: number; text: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!annotate) setDraft(null) }, [annotate])
  useEffect(() => {
    if (!draft) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setDraft(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [draft])
  const place = (e: React.MouseEvent) => {
    if (!annotate || draft) return
    const r = box.current!.getBoundingClientRect()
    setDraft({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10, text: '' })
  }
  const save = () => { if (draft && draft.text.trim()) { onAdd(draft.x, draft.y, draft.text.trim()); setDraft(null) } }
  const mine = annotations.filter((a) => a.side === side)
  const overlay = (
    <div ref={box} className={`cmp-ann ${annotate ? 'on' : ''}`} onClick={place} aria-label={annotate ? `Click on ${side} to add a note` : undefined}>
      {mine.map((a) => (
        <button key={a.id} className={`cmp-pin ${highlight === a.id ? 'hl' : ''}`} style={{ left: `${a.x}%`, top: `${a.y}%` }}
          onClick={(e) => { e.stopPropagation(); onHighlight(highlight === a.id ? null : a.id) }} title={`${a.author}: ${a.text}`} aria-label={`Note ${numberOf(a)}: ${a.text}`}>{numberOf(a)}</button>
      ))}
      {draft && (
        <>
          <span className="cmp-pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }}>+</span>
          <div className={`cmp-ann-form ${draft.y > 60 ? 'up' : ''} ${draft.x > 55 ? 'left' : ''}`} style={{ left: `${draft.x}%`, top: `${draft.y}%` }} onClick={(e) => e.stopPropagation()}>
            <textarea autoFocus rows={2} maxLength={600} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder={`Note on ${side}…`} aria-label={`Note on ${side}`}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() } }} />
            <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn sm ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn sm primary" onClick={save} disabled={!draft.text.trim()}>Add note</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
  return (
    <div className="cmp-ann-wrap">
      <Crop slot={slot} maxHeight={maxHeight} overlay={overlay} />
      {mine.length > 0 && (
        <ol className="cmp-ann-list">
          {mine.map((a) => (
            <li key={a.id} className={highlight === a.id ? 'hl' : ''} onMouseEnter={() => onHighlight(a.id)} onMouseLeave={() => onHighlight(null)}>
              <span className="cmp-pin static">{numberOf(a)}</span>
              <span className="cmp-ann-text"><b>{a.author}</b> {a.text}{a.round > 1 ? <em> · round {a.round}</em> : null}</span>
              {a.author === me && <button className="btn sm icon ghost" onClick={() => onRemove(a)} aria-label={`Delete note ${numberOf(a)}`}><Trash2 size={12} /></button>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
