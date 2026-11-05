import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, TriangleAlert, Pin } from 'lucide-react'
import { DEFAULT_SCALE, readTokens } from '../dscheck/scan'
import { COMMENT_EVENT } from '../pins/ReviewPins'
import { isEmbedded } from '../shared'

/**
 * Inspect: hover anything in the app to see the colours, font and spacing it really renders
 * with, and whether each value is one of the design tokens. Made for checking what a vibe-coded
 * screen actually uses. Click to pin an element; the click never reaches the app.
 * It reads computed styles only, never what anyone typed.
 */
export const INSPECT_EVENT = 'market:inspect'
export const INSPECT_STATE = 'market:inspect-state'

const SKIP = '[data-inspector], [data-insights-ignore], [data-review-pins], [data-usability-test], [data-fivesec], [data-gaze], .dock, .toasts'
type Tokens = ReturnType<typeof readTokens>
interface Row { label: string; value: string; swatch?: string; token?: string; off?: string; note?: string }
interface Info { name: string; size: string; rows: Row[]; offCount: number }

const rgbOf = (s: string) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1] }
const hex = (rgb: number[]) => `#${rgb.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}${rgb[3] < 1 ? ` · ${Math.round(rgb[3] * 100)}%` : ''}`
const near = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1 && Math.abs(a[3] - b[3]) <= 0.02
const firstFamily = (f: string) => f.split(',')[0].trim().replace(/^["']|["']$/g, '')

/**
 * Several tokens can share a value (white is both --surface and --primary-ink). Text takes the
 * "ink" one and fills take the others, so the name shown is the one a designer would use there.
 */
function colorRow(t: Tokens, label: string, value: string, note?: string, kind: 'text' | 'fill' = 'fill'): Row {
  const rgb = rgbOf(value)
  if (!rgb) return { label, value }
  const hits = t.colors.filter((c) => near(c.rgb, rgb))
  const hit = hits.find((c) => /ink/.test(c.name) === (kind === 'text')) ?? hits[0]
  if (hit) return { label, value: hex(rgb), swatch: value, token: hit.name, note }
  let best = { name: '', d: Infinity }
  for (const c of t.colors) { const d = Math.hypot(c.rgb[0] - rgb[0], c.rgb[1] - rgb[1], c.rgb[2] - rgb[2]) + Math.abs(c.rgb[3] - rgb[3]) * 255; if (d < best.d) best = { name: c.name, d } }
  return { label, value: hex(rgb), swatch: value, off: best.name ? `nearest ${best.name}` : 'not a token', note }
}

/** The background a person actually sees behind the element: its own, or the first painted one above it. */
function seenBackground(el: Element): { value: string; from?: string } {
  let n: Element | null = el
  while (n) {
    const bg = getComputedStyle(n).backgroundColor
    const rgb = rgbOf(bg)
    if (rgb && rgb[3] > 0) return { value: bg, from: n === el ? undefined : 'from a parent' }
    n = n.parentElement
  }
  return { value: 'rgb(255, 255, 255)', from: 'page default' }
}

function nameOf(el: Element) {
  const tag = el.tagName.toLowerCase()
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : ''
  const aria = el.getAttribute('aria-label')
  // Form fields: their tag only; what someone typed is never read.
  if (/^(input|textarea|select)$/.test(tag)) return `${tag}${cls}${aria ? ` “${aria.slice(0, 30)}”` : ''}`
  const text = aria ?? ((el as HTMLElement).innerText ?? '').trim().split('\n')[0]
  return `${tag}${cls}${text ? ` “${text.slice(0, 30)}”` : ''}`
}

function inspect(el: Element, t: Tokens): Info {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const rows: Row[] = []
  const hasText = !!(el.textContent?.trim()) || /^(input|textarea|select|button)$/i.test(el.tagName)
  if (hasText) {
    const fam = firstFamily(cs.fontFamily)
    const famOk = !t.fonts.length || t.fonts.includes(fam.toLowerCase())
    rows.push({ label: 'Font', value: fam, ...(famOk ? { token: t.fonts.length ? '--font' : undefined } : { off: `use ${t.fonts[0]}` }) })
    const fs = parseFloat(cs.fontSize)
    const onScale = DEFAULT_SCALE.some((s) => Math.abs(s - fs) < 0.25)
    const nearest = [...DEFAULT_SCALE].sort((a, b) => Math.abs(a - fs) - Math.abs(b - fs))[0]
    rows.push({ label: 'Font size', value: cs.fontSize, ...(onScale ? { token: 'type scale' } : { off: `nearest ${nearest}px` }) })
    rows.push({ label: 'Weight · line', value: `${cs.fontWeight} · ${cs.lineHeight}` })
    rows.push(colorRow(t, 'Text colour', cs.color, undefined, 'text'))
  }
  const bg = seenBackground(el)
  rows.push(colorRow(t, 'Background', bg.value, bg.from))
  // A border nobody can see (transparent) isn't a value to check.
  if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && (rgbOf(cs.borderTopColor)?.[3] ?? 1) > 0) rows.push(colorRow(t, `Border ${cs.borderTopWidth}`, cs.borderTopColor))
  const rad = parseFloat(cs.borderTopLeftRadius)
  if (rad > 0) {
    const tok = t.radii.find((x) => Math.abs(x.px - rad) < 0.5)
    rows.push({ label: 'Corner radius', value: cs.borderTopLeftRadius, ...(tok || rad >= 999 || cs.borderTopLeftRadius.endsWith('%') ? { token: tok?.name ?? 'pill' } : { off: 'not a token' }) })
  }
  const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
  if (pad.some((p) => parseFloat(p) > 0)) rows.push({ label: 'Padding', value: pad.every((p) => p === pad[0]) ? pad[0] : pad.join(' ') })
  return { name: nameOf(el), size: `${Math.round(r.width)} × ${Math.round(r.height)}`, rows, offCount: rows.filter((x) => x.off).length }
}

export function Inspector() {
  const [on, setOn] = useState(false)
  const [el, setEl] = useState<Element | null>(null)
  const [pinned, setPinned] = useState(false)
  const [, setTick] = useState(0)
  const tokens = useRef<Tokens | null>(null)
  const onRef = useRef(false)

  const set = useCallback((v: boolean) => {
    onRef.current = v
    // Tokens are read when inspecting starts, so they match the current theme and design.
    if (v) tokens.current = readTokens(document)
    setOn(v)
    if (!v) { setEl(null); setPinned(false) }
    window.dispatchEvent(new CustomEvent(INSPECT_STATE, { detail: v }))
  }, [])

  // Toggle from the dock, the I key, and off when someone starts a comment.
  useEffect(() => {
    if (isEmbedded) return
    const toggle = () => set(!onRef.current)
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); toggle() }
    }
    const offForComment = () => set(false)
    window.addEventListener(INSPECT_EVENT, toggle)
    window.addEventListener('keydown', key)
    window.addEventListener(COMMENT_EVENT, offForComment)
    return () => { window.removeEventListener(INSPECT_EVENT, toggle); window.removeEventListener('keydown', key); window.removeEventListener(COMMENT_EVENT, offForComment) }
  }, [set])

  useEffect(() => {
    if (!on) return
    let raf = 0
    const tool = (t: EventTarget | null) => !(t instanceof Element) || !!t.closest(SKIP)
    const move = (e: PointerEvent) => {
      if (pinned || tool(e.target)) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setEl(e.target as Element))
    }
    // Clicks choose an element; they must not press buttons, follow links or submit forms in the app.
    const block = (e: Event) => { if (tool(e.target)) return; e.preventDefault(); e.stopPropagation() }
    const click = (e: MouseEvent) => {
      if (tool(e.target)) return
      e.preventDefault(); e.stopPropagation()
      setEl(e.target as Element); setPinned(true)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (pinned) setPinned(false); else set(false) } }
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTick((n) => n + 1)) }
    document.addEventListener('pointermove', move, true)
    document.addEventListener('click', click, true)
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit']) document.addEventListener(t, block, true)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', redraw)
    document.documentElement.classList.add('inspecting')
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('click', click, true)
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit']) document.removeEventListener(t, block, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', redraw, true)
      window.removeEventListener('resize', redraw)
      document.documentElement.classList.remove('inspecting')
    }
  }, [on, pinned, set])

  // A pinned element that left the page (another screen opened) lets go.
  useEffect(() => { if (el && !el.isConnected) { setEl(null); setPinned(false) } })

  if (!on) return null
  const info = el && el.isConnected && tokens.current ? inspect(el, tokens.current) : null
  const r = el?.getBoundingClientRect()
  const W = Math.min(300, window.innerWidth - 16)
  // Beside the element, clear of the dock: below it if there is room, else above, else in a corner.
  const H = 300, DOCK = 84
  let panel: React.CSSProperties = {}
  if (r) {
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    if (r.bottom + 8 + H < window.innerHeight - DOCK) panel = { left, top: r.bottom + 8, width: W }
    else if (r.top - 8 - H > 56) panel = { left, bottom: Math.max(DOCK, window.innerHeight - r.top + 8), width: W }
    else panel = { left: Math.max(8, window.innerWidth - W - 12), top: 60, width: W }
  }

  return createPortal(
    <div className="insp" data-inspector data-insights-ignore>
      <div className="insp-bar"><span>{pinned ? 'Pinned · click another element, or Esc to unpin' : 'Inspect · hover anything, click to pin'}</span><button onClick={() => set(false)}><X size={13} /> Stop</button></div>
      {r && <div className={`insp-box ${pinned ? 'pinned' : ''}`} style={{ left: r.left, top: r.top, width: r.width, height: r.height }}><span>{Math.round(r.width)} × {Math.round(r.height)}</span></div>}
      {info && (
        <div className="insp-panel" style={panel} role="dialog" aria-label="Inspected styles">
          <div className="insp-head">
            <b className="mono" title={info.name}>{info.name}</b>
            {pinned ? <button className="insp-x" onClick={() => setPinned(false)} aria-label="Unpin" title="Unpin (Esc)"><X size={13} /></button> : <span className="insp-pin" title="Click to pin"><Pin size={12} /></span>}
          </div>
          <dl className="insp-rows">
            {info.rows.map((x) => (
              <div key={x.label} className={x.off ? 'off' : ''}>
                <dt>{x.label}</dt>
                <dd>
                  <span className="insp-val">{x.swatch && <i style={{ background: x.swatch }} />}<span className="mono">{x.value}</span></span>
                  {x.token ? <span className="insp-tok"><Check size={11} /> {x.token}</span> : x.off ? <span className="insp-bad"><TriangleAlert size={11} /> {x.off}</span> : null}
                  {x.note && <span className="insp-note">{x.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className={`insp-sum ${info.offCount ? 'bad' : ''}`}>{info.offCount ? `${info.offCount} value${info.offCount === 1 ? '' : 's'} aren’t design tokens` : 'Everything checked uses design tokens'}</div>
        </div>
      )}
    </div>,
    document.body,
  )
}
