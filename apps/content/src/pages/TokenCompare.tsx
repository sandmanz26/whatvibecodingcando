import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, Trash2, ArrowLeftRight, Link2, Check, FileJson, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/store'
import { Modal } from '../components/ui'
import { ScreenViewer, DEVICES, type Device } from '../tools/insights/ScreenViewer'
import { loadDesign, saveDesign, type Scope } from '../tools/design/tokens'
import { SAMPLES } from '../tools/design/samples'
import { PAIRS, appTokens, autoMap, choices, compareDocs, contrast, loadSets, parseFile, resolveColors, saveSets, type Choice, type Kind, type TokenSet } from '../tools/design/tokenfile'

const SCREENS = [
  { page: '/', label: 'Home' },
  { page: '/search', label: 'Search' },
  { page: '/product/p1', label: 'Product' },
  { page: '/cart', label: 'Cart' },
]
const KINDS: (Kind | 'all')[] = ['all', 'color', 'radius', 'font', 'shadow', 'size', 'other']
const isColor = (v?: string) => !!v && /^(#|rgb|hsl|oklch|color)/.test(v)
const Sw = ({ v }: { v?: string }) => (isColor(v) ? <i className="swatch" style={{ background: v }} /> : null)

/* ---------- mapping the app's tokens to a file's ---------- */

function MapDialog({ set, onClose, onSave }: { set: TokenSet; onClose: () => void; onSave: (map: Record<string, string>) => void }) {
  const app = useMemo(() => appTokens(), [])
  const [map, setMap] = useState(set.map)
  const [onlyMapped, setOnlyMapped] = useState(false)
  const changed = JSON.stringify(map) !== JSON.stringify(set.map)
  const [discard, setDiscard] = useState(false)
  const close = () => (changed ? setDiscard(true) : onClose())
  const rows = app.filter((a) => !onlyMapped || map[a.name])
  const count = Object.keys(map).length
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="modal tk-map" role="dialog" aria-modal="true" aria-label={`Map tokens of ${set.name}`}>
        <div className="modal-head">
          <h2 style={{ fontSize: 16 }}>Map “{set.name}” to the app</h2>
          <p>For each of the app’s tokens, choose the token from your file that should replace it. Only tokens of the same kind are offered. Unmapped tokens keep the app’s own value.</p>
        </div>
        <div className="modal-body stack gap-12">
          <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 13 }}><b className="num" style={{ color: 'var(--ink)' }}>{count}</b> of {app.length} app tokens mapped</span>
            <span className="row" style={{ gap: 6 }}>
              <button className="chip" aria-pressed={onlyMapped} onClick={() => setOnlyMapped((v) => !v)}>Only mapped</button>
              <button className="btn sm" onClick={() => setMap(autoMap(set))}>Match by name again</button>
              <button className="btn sm" onClick={() => setMap({})} disabled={!count}>Clear all</button>
            </span>
          </div>
          <div className="tk-map-list">
            <table className="table">
              <thead><tr><th>App token</th><th>App value</th><th>From your file</th></tr></thead>
              <tbody>
                {rows.map((a) => {
                  const opts = set.tokens.filter((t) => t.kind === a.kind)
                  const cur = set.tokens.find((t) => t.path === map[a.name])
                  return (
                    <tr key={a.name}>
                      <td className="mono" style={{ fontSize: 12 }}>--{a.name}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}><Sw v={a.light} />{a.light ?? a.dark}</td>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          <Sw v={cur?.light ?? cur?.dark} />
                          <select className="select tk-select" value={map[a.name] ?? ''} aria-label={`File token for --${a.name}`}
                            onChange={(e) => setMap((m) => { const n = { ...m }; if (e.target.value) n[a.name] = e.target.value; else delete n[a.name]; return n })}>
                            <option value="">— keep the app’s —</option>
                            {opts.map((t) => <option key={t.path} value={t.path}>{t.path} · {t.light ?? t.dark}</option>)}
                          </select>
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && <tr><td colSpan={3} className="muted">No tokens mapped yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!changed} onClick={() => onSave(map)}>Save mapping</button>
        </div>
      </div>
      {discard && <Modal title="Discard mapping changes?" onClose={() => setDiscard(false)}
        footer={<><button className="btn" onClick={() => setDiscard(false)}>Keep editing</button><button className="btn primary" onClick={onClose}>Discard</button></>} />}
    </>
  )
}

function LookSelect({ all, value, onChange, label }: { all: Choice[]; value: string; onChange: (v: string) => void; label: string }) {
  const up = all.filter((c) => c.kind === 'upload')
  return (
    <select className="select tk-look" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <optgroup label="Built in">{all.filter((c) => c.kind === 'builtin').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
      {up.length > 0 && <optgroup label="Uploaded">{up.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
    </select>
  )
}

/* ---------- the page ---------- */

export default function TokenCompare() {
  const { toast } = useStore()
  const [sets, setSets] = useState<TokenSet[]>(loadSets)
  const all = useMemo(() => choices(sets), [sets])
  const [aId, setA] = useState('preset:wireframe')
  const [bId, setB] = useState(() => { const s = loadSets(); return s.length ? `set:${s[s.length - 1].id}` : 'preset:material' })
  const [screen, setScreen] = useState('/')
  const [device, setDevice] = useState<Device>('desktop')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [onlyDiff, setOnlyDiff] = useState(true)
  const [mapping, setMapping] = useState<TokenSet | null>(null)
  const [deleting, setDeleting] = useState<TokenSet | null>(null)
  const [drag, setDrag] = useState(false)
  const [applied, setApplied] = useState(() => JSON.stringify(loadDesign()))
  const file = useRef<HTMLInputElement>(null)

  // A choice that no longer exists (its set was deleted) falls back to a built-in look.
  const a = all.find((c) => c.id === aId) ?? all[0]
  const b = all.find((c) => c.id === bId) ?? all.find((c) => c.id !== a.id) ?? all[0]
  const rows = useMemo(() => compareDocs(a.doc, b.doc), [a, b])
  const shown = rows.filter((r) => (!onlyDiff || !r.same) && (kind === 'all' || r.kind === kind))
  const differ = rows.filter((r) => !r.same).length

  const commit = (next: TokenSet[]) => {
    if (!saveSets(next)) { toast('This browser’s storage is full. Delete a token set and try again.', 'error'); return false }
    setSets(next)
    return true
  }

  const addFiles = async (files: { name: string; text: () => Promise<string> }[]) => {
    let next = [...sets]
    let last: TokenSet | undefined
    for (const f of files) {
      const r = parseFile(f.name, await f.text())
      if (r.error || !r.set) { toast(r.error ?? 'Could not read the file', 'error'); continue }
      const set = r.set
      const names = new Set(next.map((s) => s.name))
      for (let i = 2; names.has(set.name); i++) set.name = `${set.name.replace(/ \(\d+\)$/, '')} (${i})`
      next = [...next, set]
      last = set
      const mapped = Object.keys(set.map).length
      toast(mapped ? `${set.name}: ${set.tokens.length} tokens, ${mapped} matched the app by name` : `${set.name}: ${set.tokens.length} tokens, none matched by name. Map them to see a change.`, mapped ? 'default' : 'error')
    }
    if (last && commit(next)) { setB(`set:${last.id}`); if (!Object.keys(last.map).length) setMapping(last) }
  }

  const apply = (c: Choice) => {
    const d = c.id === 'preset:wireframe' ? null : { doc: c.doc, preset: c.preset }
    saveDesign(d)
    setApplied(JSON.stringify(loadDesign()))
    toast(d ? `${c.name} applied in this browser` : 'Back to the app’s own design')
  }
  const isApplied = (c: Choice) => (c.id === 'preset:wireframe' ? applied === 'null' : applied === JSON.stringify({ doc: c.doc, preset: c.preset }))

  const contrastRows = useMemo(() => {
    const names = [...new Set(PAIRS.flatMap((p) => [p.fg, p.bg]))]
    const res = (doc: Choice['doc'], s: Scope) => resolveColors(doc, s, names)
    return (['light', 'dark'] as Scope[]).flatMap((s) => {
      const ca = res(a.doc, s), cb = res(b.doc, s)
      return PAIRS.map((p) => ({ scope: s, ...p, a: ca[p.fg] && ca[p.bg] ? contrast(ca[p.fg]!, ca[p.bg]!) : null, b: cb[p.fg] && cb[p.bg] ? contrast(cb[p.fg]!, cb[p.bg]!) : null }))
    })
  }, [a, b])

  useEffect(() => { if (mapping && !sets.some((s) => s.id === mapping.id)) setMapping(null) }, [sets, mapping])

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Upload & compare design tokens</h1>
          <p>Upload a token file (W3C design tokens, Tokens Studio JSON, or CSS variables), see it on the real screens, and compare two token sets side by side: the screens, text contrast, and every token that differs.</p>
        </div>
        <div className="actions"><Link className="btn" to="/console/design">Edit tokens by hand</Link></div>
      </div>

      <section className={`card card-body tk-drop ${drag ? 'on' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(Array.from(e.dataTransfer.files)) }}>
        <div className="row wrap" style={{ gap: 10, justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 10 }}>
            <FileJson size={20} />
            <div>
              <b>Drop token files here</b>
              <p className="muted" style={{ fontSize: 12.5 }}>.json or .css, up to 2 MB. Files stay in this browser.</p>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {SAMPLES.map((s) => <button key={s.fileName} className="btn sm" onClick={() => void addFiles([{ name: s.fileName, text: async () => s.text }])}>Try {s.fileName}</button>)}
            <button className="btn primary sm" onClick={() => file.current?.click()}><Upload size={13} /> Upload files</button>
            <input ref={file} type="file" multiple accept=".json,.css,application/json,text/css" hidden onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          </div>
        </div>
        {sets.length > 0 && (
          <ul className="tk-sets">
            {[...sets].reverse().map((s) => {
              const c = all.find((x) => x.id === `set:${s.id}`)!
              const mapped = Object.keys(s.map).length
              return (
                <li key={s.id}>
                  <input className="input tk-name" value={s.name} maxLength={60} aria-label="Token set name"
                    onChange={(e) => commit(sets.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                    onBlur={(e) => { if (!e.target.value.trim()) commit(sets.map((x) => (x.id === s.id ? { ...x, name: s.fileName } : x))) }} />
                  <span className="muted tk-facts">{s.format} · {s.tokens.length} tokens · <span style={{ color: mapped ? undefined : 'var(--critical-ink)' }}>{mapped} mapped to the app</span>{s.skipped.length > 0 && <> · <span title={s.skipped.slice(0, 12).join('\n')}>{s.skipped.length} skipped</span></>}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => setMapping(s)}><Link2 size={13} /> Map tokens</button>
                    <button className="btn sm" onClick={() => apply(c)} disabled={isApplied(c) || !mapped}>{isApplied(c) ? <><Check size={13} /> Applied</> : 'Apply in this browser'}</button>
                    <button className="btn sm icon danger" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`} title="Delete"><Trash2 size={13} /></button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card mt-16">
        <div className="card-head tk-head">
          <div><h2>Compare</h2><p>{differ ? `${differ} token values differ` : 'These two looks have the same tokens'}{a.preset !== b.preset ? ' · the UI-library looks also restyle components' : ''}</p></div>
          <div className="row wrap" style={{ gap: 6 }}>
            <LookSelect all={all} value={a.id} onChange={setA} label="Look A" />
            <button className="btn sm icon" onClick={() => { setA(b.id); setB(a.id) }} aria-label="Swap A and B" title="Swap"><ArrowLeftRight size={13} /></button>
            <LookSelect all={all} value={b.id} onChange={setB} label="Look B" />
          </div>
        </div>
        <div className="card-body row wrap" style={{ gap: 8, paddingTop: 0 }}>
          <div className="seg" role="group" aria-label="Screen">
            {SCREENS.map((s) => <button key={s.page} aria-pressed={screen === s.page} onClick={() => setScreen(s.page)}>{s.label}</button>)}
          </div>
          <div className="seg" role="group" aria-label="Device">
            {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>Both previews follow the console’s light/dark theme.</span>
        </div>
        {a.id === b.id && <p className="cmp-warn" style={{ padding: '0 20px' }}><TriangleAlert size={14} /> A and B are the same look. Choose another one for B.</p>}
        <div className="card-body tk-pair">
          {[{ side: 'A', c: a }, { side: 'B', c: b }].map(({ side, c }) => (
            <div key={side} className="stack gap-8" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 8, minWidth: 0 }}><b className="cmp-side">{side}</b><b className="tk-ellipsis">{c.name}</b></span>
                <button className="btn sm ghost" onClick={() => apply(c)} disabled={isApplied(c)}>{isApplied(c) ? <><Check size={13} /> In use</> : 'Use in this browser'}</button>
              </div>
              <ScreenViewer page={screen} device={device} mode="live" design={{ doc: c.doc, preset: c.preset }} maxHeight={460} />
            </div>
          ))}
        </div>
      </section>

      <section className="card mt-16">
        <div className="card-head"><div><h2>Text contrast</h2><p>WCAG ratio for the app’s main text colours. 4.5 or more passes AA for normal text.</p></div></div>
        <div className="card-body" style={{ paddingTop: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Pair</th><th>Mode</th><th>A · {a.name}</th><th>B · {b.name}</th></tr></thead>
            <tbody>
              {contrastRows.map((r) => (
                <tr key={r.scope + r.fg}>
                  <td>{r.label} <span className="muted mono" style={{ fontSize: 11.5 }}>--{r.fg} / --{r.bg}</span></td>
                  <td className="muted">{r.scope}</td>
                  {[r.a, r.b].map((v, i) => <td key={i}>{v == null ? <span className="muted">—</span> : <span className={`tk-ratio ${v >= 4.5 ? 'pass' : 'fail'}`}>{v.toFixed(2)} {v >= 4.5 ? 'AA' : 'fails AA'}</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-16">
        <div className="card-head tk-head">
          <div><h2>Tokens</h2><p>{shown.length} shown · {differ} differ in total</p></div>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="chip" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((v) => !v)}>Only differences</button>
            {KINDS.map((k) => <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? 'All kinds' : k}</button>)}
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, maxHeight: 460, overflow: 'auto' }}>
          {shown.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{onlyDiff ? 'No differences of this kind.' : 'No tokens of this kind.'}</p> : (
            <table className="table">
              <thead><tr><th>Token</th><th>Mode</th><th>A</th><th>B</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.scope + r.name} className={r.same ? '' : 'tk-diff'}>
                    <td className="mono" style={{ fontSize: 12 }}>--{r.name}</td>
                    <td className="muted">{r.scope}</td>
                    <td className="mono" style={{ fontSize: 12 }}><Sw v={r.a} />{r.a ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}><Sw v={r.b} />{r.b ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {mapping && <MapDialog key={mapping.id} set={mapping} onClose={() => setMapping(null)}
        onSave={(map) => { if (commit(sets.map((x) => (x.id === mapping.id ? { ...x, map } : x)))) { toast(`Mapping saved: ${Object.keys(map).length} tokens`); setMapping(null) } }} />}
      {deleting && (
        <Modal title={`Delete “${deleting.name}”?`} description="The token set and its mapping are removed from this browser. A look already applied in this browser stays until you turn it off." onClose={() => setDeleting(null)}
          footer={<><button className="btn" onClick={() => setDeleting(null)}>Keep it</button>
            <button className="btn primary" onClick={() => { commit(sets.filter((x) => x.id !== deleting.id)); setDeleting(null); toast('Token set deleted') }}>Delete</button></>} />
      )}
    </main>
  )
}
