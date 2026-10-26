/**
 * Heatmap overlay, framework-agnostic. Draws taps on the elements they landed on (re-measured
 * on every scroll, so sticky sidebars and different layouts stay right), per-element counts,
 * a single replayed tap, or gaze as soft areas.
 *
 * Only data from the same page AND the same layout bucket (mobile < 640, tablet < 1024,
 * desktop) is drawn: a phone's taps over a desktop layout mean nothing.
 */
import { RESEARCH_ATTR, isEmbedded, type ResearchConfig } from './config'
import type { ClickEvent } from './tracker'
import type { GazePoint } from './gaze-runner'
import { layoutOf } from './sessions'

export type HeatmapMode = 'dots' | 'elements' | 'gaze'

export interface HeatmapOptions {
  mode: HeatmapMode
  clicks?: ClickEvent[]
  gaze?: GazePoint[]
  /** one replayed tap: x % of width, y page px, and where on its element (%) */
  dot?: { x: number; y: number; ex?: number; ey?: number }
  /** selector of an element to ring and scroll to */
  focus?: string
}

const CSS_ID = 'research-heatmap-css'
const CSS = `
.rh-fixed{position:fixed;inset:0;pointer-events:none;z-index:2147483000;overflow:hidden}
.rh-abs{position:absolute;top:0;left:0;width:100%;pointer-events:none;z-index:2147483000}
.rh-fixed i,.rh-abs i{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(235,104,52,.32);box-shadow:0 0 0 1px rgba(235,104,52,.25)}
.rh-abs i.stale{background:rgba(140,140,136,.28);box-shadow:0 0 0 1px rgba(140,140,136,.4)}
i.rh-one{width:28px;height:28px;margin:-14px 0 0 -14px;background:rgba(235,104,52,.55);box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(235,104,52,.9)}
.rh-box{position:fixed;pointer-events:none;z-index:2147483000;border:2px solid;border-radius:6px}
.rh-box.good{border-color:#1baf7a;background:rgba(27,175,122,.12)}.rh-box.meh{border-color:#eda100;background:rgba(237,161,0,.12)}
.rh-box.bad{border-color:#d03b3b;background:rgba(208,59,59,.12)}.rh-box.focus{border-color:#2a78d6;border-style:dashed}
.rh-box span{position:absolute;top:-11px;left:-2px;font:600 11px/18px system-ui,sans-serif;padding:0 6px;border-radius:9px;background:#111;color:#fff;white-space:nowrap}
`

function visibleEl(sel: string, ignore: string): Element | null {
  try {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest(ignore)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  } catch { /* selector from another version */ }
  return null
}

function drawGaze(canvas: HTMLCanvasElement, points: GazePoint[], vw: number, h: number) {
  canvas.width = vw
  canvas.height = h
  canvas.style.width = `${vw}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  const r = 80
  for (const p of points) {
    const x = (p.x / 100) * vw, y = p.y
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(0,0,0,0.09)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const img = ctx.getImageData(0, 0, vw, h)
  const d = img.data
  let max = 1
  for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i]
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / max
    if (a < 0.04) { d[i + 3] = 0; continue }
    const [R, G, B] = a < 0.33 ? [42, 120 + a * 300, 214] : a < 0.66 ? [80 + (a - 0.33) * 520, 200, 80] : [240, 200 - (a - 0.66) * 450, 40]
    d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(70 + a * 120)
  }
  ctx.putImageData(img, 0, 0)
}

/** Draws the overlay; returns how much was drawn and a destroy function. */
export function mountHeatmap(cfg: ResearchConfig, o: HeatmapOptions): { count: number; missing: number; destroy(): void } {
  if (!document.getElementById(CSS_ID)) {
    const s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s)
  }
  const page = cfg.path()
  const bucket = layoutOf(window.innerWidth)
  const clicks = (o.clicks ?? []).filter((c) => c.page === page && layoutOf(c.vw) === bucket)
  const gaze = (o.gaze ?? []).filter((g) => g.page === page && layoutOf(g.vw) === bucket)
  const root = document.createElement('div')
  root.setAttribute(RESEARCH_ATTR, '')
  const fixed = document.createElement('div'); fixed.className = 'rh-fixed'
  const abs = document.createElement('div'); abs.className = 'rh-abs'
  root.append(abs, fixed)
  document.body.appendChild(root)

  const groups = new Map<string, { label: string; taps: number; nothing: number }>()
  clicks.forEach((c) => {
    const g = groups.get(c.sel) ?? { label: c.label, taps: 0, nothing: 0 }
    g.taps++
    if (c.fx === 'nothing' && c.kind !== 'field') g.nothing++
    groups.set(c.sel, g)
  })
  let missing = 0

  const measure = () => {
    fixed.replaceChildren()
    abs.replaceChildren()
    abs.style.height = `${document.documentElement.scrollHeight}px`
    const rects = new Map<string, DOMRect>()
    missing = 0
    const sels = new Set([...groups.keys(), ...(o.focus ? [o.focus] : [])])
    sels.forEach((sel) => { const el = visibleEl(sel, cfg.ignore); if (el) rects.set(sel, el.getBoundingClientRect()); else if (groups.has(sel)) missing++ })
    const at = (sel: string | undefined, ex = 50, ey = 50) => { const r = sel ? rects.get(sel) : undefined; return r ? { left: r.left + (ex / 100) * r.width, top: r.top + (ey / 100) * r.height } : null }
    const dot = (parent: HTMLElement, left: number | string, top: number, cls = '') => {
      const i = document.createElement('i'); if (cls) i.className = cls
      i.style.left = typeof left === 'number' ? `${left}px` : left; i.style.top = `${top}px`; parent.appendChild(i)
    }
    if (o.mode === 'gaze') {
      const c = document.createElement('canvas'); abs.appendChild(c)
      drawGaze(c, gaze, window.innerWidth, Math.min(document.documentElement.scrollHeight, 16000))
    } else if (o.dot) {
      const p = at(o.focus, o.dot.ex, o.dot.ey)
      if (p) dot(fixed, p.left, p.top, 'rh-one'); else dot(abs, `${o.dot.x}%`, o.dot.y, 'rh-one')
    } else if (o.mode === 'dots') {
      clicks.forEach((c) => { const p = at(c.sel, c.ex, c.ey); if (p) dot(fixed, p.left, p.top); else dot(abs, `${c.x}%`, c.y, 'stale') })
    }
    if (o.mode === 'elements' || o.focus) {
      rects.forEach((r, sel) => {
        const g = groups.get(sel)
        if (o.mode !== 'elements' && sel !== o.focus) return
        const b = document.createElement('div')
        const tone = !g ? 'focus' : g.nothing / g.taps >= 0.5 ? 'bad' : g.nothing / g.taps >= 0.2 ? 'meh' : 'good'
        b.className = `rh-box ${tone}${sel === o.focus ? ' focus' : ''}`
        Object.assign(b.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
        if (g && o.mode === 'elements') { const s = document.createElement('span'); s.textContent = `${g.taps} · ${g.label.slice(0, 26)}`; b.appendChild(s) }
        fixed.appendChild(b)
      })
    }
  }
  measure()
  const timer = window.setInterval(measure, 1000)
  window.addEventListener('scroll', measure, true)
  window.addEventListener('resize', measure)

  // Bring the subject into view — scrollTo, because scrollIntoView would also scroll a parent page.
  window.setTimeout(() => {
    const el = o.focus ? visibleEl(o.focus, cfg.ignore) : null
    if (el) { const r = el.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight / 2 + r.height / 2) }) }
    else if (o.dot) window.scrollTo({ top: Math.max(0, o.dot.y - window.innerHeight / 2) })
  }, 300)

  const count = o.mode === 'gaze' ? gaze.length : clicks.length
  if (isEmbedded) window.parent.postMessage({ type: `${cfg.app}:heatmap`, count, missing, unit: o.mode === 'gaze' ? 'gaze sample' : 'tap', page, layout: bucket }, window.location.origin)

  return {
    count,
    get missing() { return missing },
    destroy() {
      window.clearInterval(timer)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      root.remove()
    },
  }
}

/** Reads ?heatmap[=elements|gaze], &el=, &dot=x,y,ex,ey from the URL and mounts accordingly. */
export function heatmapFromUrl(cfg: ResearchConfig, data: { clicks: () => ClickEvent[]; gaze?: () => GazePoint[] }) {
  const q = cfg.query()
  if (!q.has('heatmap')) return null
  const m = q.get('heatmap')
  const mode: HeatmapMode = m === 'elements' ? 'elements' : m === 'gaze' ? 'gaze' : 'dots'
  const d = q.get('dot')?.split(',').map(Number)
  return mountHeatmap(cfg, {
    mode,
    clicks: mode === 'gaze' ? [] : data.clicks(),
    gaze: mode === 'gaze' ? data.gaze?.() ?? [] : [],
    focus: q.get('el') ?? undefined,
    dot: d ? { x: d[0], y: d[1], ex: d[2], ey: d[3] } : undefined,
  })
}
