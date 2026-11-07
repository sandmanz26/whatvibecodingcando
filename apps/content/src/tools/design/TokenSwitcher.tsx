import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Download, Upload, RotateCcw, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { baseline, flatten, loadDesign, merge, saveDesign, DESIGN_EVENT, type DesignDoc } from './tokens'
import { PRESETS } from './presets'
import { LOOKS } from './looks'
import { autoMap, docOf, loadSets, parseFile, saveSets, type TokenSet } from './tokenfile'

/**
 * Design tokens, live: switch the whole app between looks from the dock, tweak the main
 * tokens, or paste/upload your own (a template is provided). Every change shows at once on
 * the page you're on; nothing changes in the code.
 */

const TEMPLATE_TOKENS = {
  color: ['primary', 'primary-ink', 'accent', 'page', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'line'],
  radius: ['r-sm', 'r', 'r-lg'],
  font: ['font'],
}
const DARK_TOKENS = ['primary', 'primary-ink', 'page', 'surface', 'ink', 'ink-2', 'line']

/** A ready-to-edit token file: the app's own values under the app's own names. */
export function templateText(): string {
  const b = baseline()
  const light = flatten(b.light), dark = flatten(b.dark)
  const group = (names: string[], src: Record<string, string>) => Object.fromEntries(names.filter((n) => src[`--${n}`]).map((n) => [n, { $value: src[`--${n}`] }]))
  return JSON.stringify({
    $description: 'Design tokens template. Change any value and keep the names: each name is the CSS variable it sets. Remove what you don’t need; aliases like {color.primary} work.',
    light: { color: group(TEMPLATE_TOKENS.color, light), radius: group(TEMPLATE_TOKENS.radius, light), font: group(TEMPLATE_TOKENS.font, light) },
    dark: { color: group(DARK_TOKENS, dark) },
  }, null, 2)
}

const hex6 = (v: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{3}$/i.test(v) ? `#${v.slice(1).split('').map((c) => c + c).join('')}` : '#2b2b2b')

/** Sets tokens in the light scope of a document (light tokens apply in dark mode too unless dark redefines them). */
function withTokens(doc: DesignDoc, values: Record<string, string>): DesignDoc {
  return merge(doc, { light: { tweak: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { $value: v }])) } })
}

export function TokenSwitcher({ onClose }: { onClose: () => void }) {
  const base = useMemo(() => baseline(), [])
  const [applied, setApplied] = useState(loadDesign)
  const [sets, setSets] = useState<TokenSet[]>(loadSets)
  const [own, setOwn] = useState(false)
  const [text, setText] = useState(templateText)
  const [error, setError] = useState('')
  /** Only what the person edits applies: opening the template must not replace the current look. */
  const [dirty, setDirty] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const sync = () => setApplied(loadDesign())
    window.addEventListener(DESIGN_EVENT, sync)
    return () => window.removeEventListener(DESIGN_EVENT, sync)
  }, [])

  const current = applied?.doc ?? base
  const light = flatten(merge(base, current).light)
  const samples = LOOKS.map((l) => ({ ...l, on: applied?.from === `look:${l.id}`, apply: () => saveDesign({ doc: merge(base, l.doc), preset: 'wireframe', from: `look:${l.id}` }) }))
  const looks = [
    ...PRESETS.map((p) => ({ id: `preset:${p.id}`, name: p.id === 'wireframe' ? 'App’s own' : p.name, apply: () => saveDesign(p.id === 'wireframe' ? null : { doc: merge(base, p.tokens), preset: p.id }), on: p.id === 'wireframe' ? !applied : applied?.preset === p.id && applied.from === undefined })),
    ...sets.map((s) => ({ id: `set:${s.id}`, name: s.name, apply: () => saveDesign({ doc: merge(base, docOf(s)), preset: 'wireframe', from: s.id }), on: applied?.from === s.id })),
  ]
  const tweak = (values: Record<string, string>) => saveDesign({ doc: withTokens(current, values), preset: applied?.preset ?? 'wireframe', ...(applied?.from ? { from: applied.from } : {}) })

  /** Applies pasted or uploaded tokens: kept as a set (so it can be compared later) and switched on. */
  const applyTokens = (fileName: string, body: string, keep: boolean) => {
    const r = parseFile(fileName, body)
    if (r.error || !r.set) { setError(r.error ?? 'Couldn’t read those tokens.'); return }
    const set = r.set
    set.map = autoMap(set)
    if (!Object.keys(set.map).length) { setError('None of these token names match the app’s. Keep the names from the template.'); return }
    setError('')
    if (keep) {
      const next = [...sets.filter((x) => x.name !== set.name), set]
      if (!saveSets(next)) { setError('This browser’s storage is full; the tokens are applied but not kept.') } else setSets(next)
    }
    saveDesign({ doc: merge(base, docOf(set)), preset: 'wireframe', ...(keep ? { from: set.id } : {}) })
  }
  // Pasted tokens apply as you type, once they are valid.
  useEffect(() => {
    if (!own || !dirty) return
    const t = window.setTimeout(() => applyTokens('pasted.json', text, false), 400)
    return () => clearTimeout(t)
  }, [text, own, dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = () => {
    const url = URL.createObjectURL(new Blob([templateText()], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: 'design-tokens-template.json' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dock-pop tk-pop" role="dialog" aria-label="Design tokens">
      <div className="dock-verhead"><b>Design tokens · live</b><span>Changes show on this page straight away and stay on while you browse.</span></div>
      <div className="tk-label">Sample looks</div>
      <div className="tk-samples" role="group" aria-label="Sample looks">
        {samples.map((l) => (
          <button key={l.id} aria-pressed={l.on} onClick={() => { setOwn(false); setError(''); l.apply() }} title={l.note}>
            <span className="tk-swatch" aria-hidden>{l.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
            <span className="tk-sample-name">{l.on && <Check size={11} />}{l.name}</span>
            <small>{l.note}</small>
          </button>
        ))}
      </div>
      <div className="tk-label">UI libraries{sets.length ? ' and your sets' : ''}</div>
      <div className="tk-looks" role="group" aria-label="Looks">
        {looks.map((l) => <button key={l.id} aria-pressed={l.on} onClick={() => { setOwn(false); setError(''); l.apply() }}>{l.on && <Check size={12} />}{l.name}</button>)}
      </div>
      <div className="tk-tweak">
        <label>Primary <input type="color" value={hex6(light['--primary'] ?? '')} onChange={(e) => tweak({ primary: e.target.value })} aria-label="Primary colour" /></label>
        <label>Accent <input type="color" value={hex6(light['--accent'] ?? '')} onChange={(e) => tweak({ accent: e.target.value })} aria-label="Accent colour" /></label>
        <label className="tk-range">Corners <input type="range" min={0} max={24} value={parseInt(light['--r'] ?? '10', 10) || 0} onChange={(e) => { const v = Number(e.target.value); tweak({ r: `${v}px`, 'r-sm': `${Math.round(v * 0.6)}px`, 'r-lg': `${Math.round(v * 1.4)}px` }) }} aria-label="Corner radius" /><span className="num">{light['--r']}</span></label>
      </div>
      <button className="tk-own-toggle" onClick={() => setOwn((v) => !v)} aria-expanded={own}>{own ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Use your own tokens</button>
      {own && (
        <div className="tk-own">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setDirty(true) }} spellCheck={false} aria-label="Your design tokens (JSON or CSS)" rows={9} />
          {error ? <p className="tk-err">{error}</p> : <p className="tk-ok">Edit the template: valid changes apply as you type.</p>}
          <div className="tk-own-actions">
            <button onClick={download}><Download size={12} /> Template</button>
            <button onClick={() => file.current?.click()}><Upload size={12} /> Upload file</button>
            <button onClick={() => { setDirty(false); applyTokens('my tokens.json', text, true) }}>Save as a set</button>
            <input ref={file} type="file" accept=".json,.css,application/json,text/css" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const body = await f.text(); setDirty(false); setText(body); applyTokens(f.name, body, true) } }} />
          </div>
        </div>
      )}
      <div className="tk-foot">
        <button onClick={() => { setOwn(false); setError(''); saveDesign(null) }} disabled={!applied}><RotateCcw size={12} /> Back to the app’s own</button>
        <Link to="/console/design/compare" onClick={onClose}>Compare sets <ArrowRight size={12} /></Link>
      </div>
    </div>
  )
}
