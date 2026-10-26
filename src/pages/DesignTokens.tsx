import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload, RotateCcw, Check, Wand2 } from 'lucide-react'
import { useStore } from '../store/store'
import { ScreenViewer, DEVICES, type Device } from '../tools/insights/ScreenViewer'
import { PRESETS, presetOf } from '../tools/design/presets'
import { baseline, changes, flatten, loadDesign, merge, saveDesign, validate, type Design, type DesignDoc } from '../tools/design/tokens'

const SCREENS = [
  { page: '/', label: 'Overview' },
  { page: '/skills', label: 'Skills' },
  { page: '/teams', label: 'Teams' },
  { page: '/health', label: 'Health' },
  { page: '/v2', label: 'v2 Home' },
]

/** A few tokens worth a direct control; everything else is in the JSON. */
const QUICK: { name: string; label: string; kind: 'color' | 'px' }[] = [
  { name: 'primary', label: 'Primary', kind: 'color' },
  { name: 'primary-ink', label: 'On primary', kind: 'color' },
  { name: 'accent', label: 'Accent', kind: 'color' },
  { name: 'page', label: 'Page', kind: 'color' },
  { name: 'surface', label: 'Surface', kind: 'color' },
  { name: 'ink', label: 'Text', kind: 'color' },
  { name: 'r-sm', label: 'Control corners', kind: 'px' },
  { name: 'r-lg', label: 'Card corners', kind: 'px' },
]

const pretty = (d: DesignDoc) => JSON.stringify(d, null, 2)
const hex = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? `#${v.slice(1).split('').map((c) => c + c).join('')}` : '#000000')

/** Sets one token in the light scope of a document, wherever it sits in the tree. */
function setToken(doc: DesignDoc, name: string, value: string): DesignDoc {
  const next = JSON.parse(JSON.stringify(doc)) as DesignDoc
  const visit = (tree: Record<string, unknown>): boolean => {
    for (const [k, v] of Object.entries(tree)) {
      if (k === name && v && typeof v === 'object' && '$value' in v) { (v as { $value: string }).$value = value; return true }
      if (v && typeof v === 'object' && !('$value' in v) && visit(v as Record<string, unknown>)) return true
    }
    return false
  }
  next.light ??= {}
  if (!visit(next.light as Record<string, unknown>)) ((next.light.other ??= {}) as Record<string, unknown>)[name] = { $value: value }
  return next
}

export default function DesignTokens() {
  const { toast } = useStore()
  const base = useMemo(() => baseline(), [])
  const saved = loadDesign()
  const [preset, setPreset] = useState(saved?.preset ?? 'skillhouse')
  const [text, setText] = useState(() => pretty(saved?.doc ?? base))
  const [screen, setScreen] = useState('/')
  const [device, setDevice] = useState<Device>('desktop')
  const [applied, setApplied] = useState<Design | null>(saved)
  const file = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => validate(text), [text])
  const [design, setDesign] = useState<Design>({ doc: saved?.doc ?? base, preset: saved?.preset ?? 'skillhouse' })
  // Keep the last valid document while someone is mid-edit, so the preview doesn't flicker.
  useEffect(() => { if (parsed.doc) setDesign({ doc: parsed.doc, preset }) }, [parsed.doc, preset])

  const diff = useMemo(() => changes(base, design.doc), [base, design.doc])
  const light = flatten(design.doc.light)
  const isApplied = !!applied && JSON.stringify(applied) === JSON.stringify(design)

  const choose = (id: string) => {
    setPreset(id)
    setText(pretty(merge(base, presetOf(id).tokens)))
  }
  const quick = (name: string, value: string) => { if (parsed.doc) setText(pretty(setToken(parsed.doc, name, value))) }
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: `tokens-${preset}.json` }).click()
    URL.revokeObjectURL(url)
  }
  const upload = async (f: File | undefined) => {
    if (!f) return
    const t = await f.text()
    const v = validate(t)
    if (v.error) { toast(v.error, 'error'); return }
    // An uploaded file may hold only some tokens: lay it over the app's own.
    setText(pretty(merge(base, v.doc!)))
    toast(`Loaded ${f.name}`)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Design tokens</h1>
          <p>Try another set of design tokens, or another UI library’s look, on the real screens. Edit the JSON (W3C design-token style: the token’s name is the CSS variable it sets; top-level <span className="mono">light</span>, <span className="mono">dark</span> and <span className="mono">v2</span> say where it applies). Apply it to use the variant in this browser, for example during a usability test.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-head"><div><h2>UI library</h2><p>Restyles the classic app’s components the way each library draws them. An imitation of the look; the library’s code isn’t loaded. v2 keeps its own design.</p></div></div>
        <div className="card-body lib-grid">
          {PRESETS.map((p) => (
            <button key={p.id} className={`lib-card ${preset === p.id ? 'on' : ''}`} onClick={() => choose(p.id)} aria-pressed={preset === p.id}>
              <b>{p.name}</b>
              <span className="muted">{p.note}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid mt-16 design-grid">
        <section className="card">
          <div className="card-head">
            <div><h2>Tokens</h2><p>{parsed.error ? <span style={{ color: 'var(--critical-ink)' }}>{parsed.error}</span> : `${diff.length} token${diff.length === 1 ? '' : 's'} differ from Skillhouse`}</p></div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn ghost sm icon" onClick={() => parsed.doc && setText(pretty(parsed.doc))} aria-label="Format JSON" title="Format"><Wand2 size={13} /></button>
              <button className="btn ghost sm icon" onClick={() => choose(preset)} aria-label="Reset to the library’s tokens" title="Reset"><RotateCcw size={13} /></button>
              <button className="btn ghost sm icon" onClick={download} aria-label="Download JSON" title="Download"><Download size={13} /></button>
              <button className="btn ghost sm icon" onClick={() => file.current?.click()} aria-label="Upload JSON" title="Upload"><Upload size={13} /></button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </div>
          <div className="card-body stack gap-12">
            <div className="quick">
              {QUICK.map((q) => (
                <label key={q.name} className="quick-row">
                  <span>{q.label}<small className="mono">--{q.name}</small></span>
                  {q.kind === 'color'
                    ? <input type="color" value={hex(light[`--${q.name}`] ?? '')} onChange={(e) => quick(q.name, e.target.value)} aria-label={q.label} />
                    : <input type="range" min={0} max={28} value={parseInt(light[`--${q.name}`] ?? '0', 10) || 0} onChange={(e) => quick(q.name, `${e.target.value}px`)} aria-label={q.label} />}
                  <span className="mono num quick-val">{light[`--${q.name}`] ?? '—'}</span>
                </label>
              ))}
            </div>
            <textarea className="textarea mono tokens-json" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} aria-label="Design tokens JSON" aria-invalid={!!parsed.error} />
          </div>
        </section>

        <div className="stack gap-16" style={{ minWidth: 0 }}>
          <section className="card">
            <div className="card-head">
              <div><h2>Preview</h2><p>The real screen with these tokens</p></div>
              <div className="row wrap">
                <div className="seg" role="group" aria-label="Screen">
                  {SCREENS.map((s) => <button key={s.page} aria-pressed={screen === s.page} onClick={() => setScreen(s.page)}>{s.label}</button>)}
                </div>
                <div className="seg" role="group" aria-label="Device">
                  {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
                </div>
              </div>
            </div>
            <div className="card-body"><ScreenViewer page={screen} device={device} mode="live" design={design} maxHeight={520} /></div>
            <div className="card-body row wrap" style={{ borderTop: '1px solid var(--line)', justifyContent: 'space-between', gap: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>{applied ? <>This browser uses <b>{presetOf(applied.preset).name}</b>{changes(base, applied.doc).length ? ` with ${changes(base, applied.doc).length} token changes` : ''}.</> : 'This browser shows the app’s own design.'}</span>
              <span className="row" style={{ gap: 8 }}>
                {applied && <button className="btn sm" onClick={() => { saveDesign(null); setApplied(null); toast('Back to the app’s own design') }}>Turn off</button>}
                <button className="btn sm primary" disabled={!!parsed.error || isApplied} onClick={() => { saveDesign(design); setApplied(design); toast('Applied in this browser') }}>{isApplied ? <><Check size={13} /> Applied</> : 'Apply in this browser'}</button>
              </span>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>What changes</h2><p>{diff.length ? `${diff.length} tokens` : 'Nothing yet'}</p></div></div>
            {diff.length > 0 && (
              <div className="card-body" style={{ paddingTop: 0, maxHeight: 280, overflow: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Token</th><th>Where</th><th>From</th><th>To</th></tr></thead>
                  <tbody>
                    {diff.map((c) => (
                      <tr key={c.scope + c.name}>
                        <td className="mono" style={{ fontSize: 12 }}>{c.name}</td>
                        <td className="muted">{c.scope}</td>
                        <td className="mono" style={{ fontSize: 12 }}><Swatch v={c.from} />{c.from ?? '—'}</td>
                        <td className="mono" style={{ fontSize: 12 }}><Swatch v={c.to} />{c.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function Swatch({ v }: { v?: string }) {
  if (!v || !/^(#|rgb|hsl)/.test(v)) return null
  return <i className="swatch" style={{ background: v }} />
}
