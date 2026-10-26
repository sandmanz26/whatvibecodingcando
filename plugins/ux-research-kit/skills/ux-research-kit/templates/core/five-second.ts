/**
 * 5-second tests — show a screen for a few seconds and record the first click: where it
 * landed, on which control, how fast. Never anything typed.
 */
import { RESEARCH_ATTR, isEmbedded, type ResearchConfig } from './config'
import { readJSON, uid, writeJSON } from './storage'
import { describeTarget, type ClickEvent } from './tracker'

export interface FiveSecTest {
  id: string
  name: string
  prompt: string
  page: string
  query?: string
  seconds: number
  /** the element a right first click lands on, if any */
  target?: { sel: string; label: string }
  createdAt: string
}

export interface FiveSecResult {
  id: string
  testId: string
  t: string
  vw: number
  vh: number
  missed?: boolean
  ms?: number
  x?: number
  y?: number
  docH?: number
  ex?: number
  ey?: number
  sel?: string
  label?: string
  hit?: boolean
}

const keys = (cfg: ResearchConfig) => ({ tests: `${cfg.app}.fivesec`, results: `${cfg.app}.fivesec.results` })
export const loadFiveSec = (cfg: ResearchConfig) => readJSON<FiveSecTest[]>(keys(cfg).tests, [])
export const saveFiveSec = (cfg: ResearchConfig, t: FiveSecTest[]) => writeJSON(keys(cfg).tests, t)
export const loadFiveSecResults = (cfg: ResearchConfig) => readJSON<FiveSecResult[]>(keys(cfg).results, [])
const addResult = (cfg: ResearchConfig, r: FiveSecResult) => writeJSON(keys(cfg).results, [...loadFiveSecResults(cfg), r])
export const clearFiveSecResults = (cfg: ResearchConfig, testId: string) => writeJSON(keys(cfg).results, loadFiveSecResults(cfg).filter((r) => r.testId !== testId))

export function summarizeFiveSec(cfg: ResearchConfig, test: FiveSecTest) {
  const rs = loadFiveSecResults(cfg).filter((r) => r.testId === test.id)
  const clicked = rs.filter((r) => !r.missed)
  const times = clicked.map((r) => r.ms ?? 0).sort((a, b) => a - b)
  const median = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : 0
  const by = new Map<string, { n: number; hit: boolean }>()
  clicked.forEach((r) => { const e = by.get(r.label ?? '') ?? { n: 0, hit: !!r.hit }; e.n++; by.set(r.label ?? '', e) })
  return {
    participants: rs.length, clicked: clicked.length, hits: clicked.filter((r) => r.hit).length, medianMs: median,
    firsts: [...by.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.n - a.n),
  }
}

/** First clicks in the shape the heatmap draws. With a target, misses colour as idle. */
export function fiveSecAsClicks(cfg: ResearchConfig, test: FiveSecTest): ClickEvent[] {
  return loadFiveSecResults(cfg).filter((r) => r.testId === test.id && !r.missed).map((r) => ({
    type: 'click', t: r.t, sid: r.id, page: test.page, vw: r.vw, vh: r.vh, x: r.x ?? 50, y: r.y ?? 0, docH: r.docH ?? 0,
    label: r.label ?? '', tag: '', kind: 'button', section: '', sel: r.sel ?? '', ex: r.ex ?? 50, ey: r.ey ?? 50, ew: 0, eh: 0, ms: r.ms ?? 0, sy: 0,
    fx: test.target ? (r.hit ? 'changed' : 'nothing') : 'changed',
  }))
}

/**
 * Participant side. Navigate the app to test.page first, then call this: the screen stays
 * covered until they are ready, shows for test.seconds, and the first click is kept.
 */
export function runFiveSecond(cfg: ResearchConfig, test: FiveSecTest, onDone?: (r: FiveSecResult) => void): () => void {
  if (isEmbedded) return () => {}
  const root = document.createElement('div')
  root.setAttribute(RESEARCH_ATTR, '')
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483600;font:14px/1.5 system-ui,sans-serif'
  const cover = (html: string) => {
    root.innerHTML = `<div style="position:absolute;inset:0;background:#f6f6f3;display:grid;place-items:center;padding:16px;color:#111"><div style="max-width:440px;text-align:center">${html}</div></div>`
  }
  const btn = 'padding:8px 16px;border-radius:8px;border:1px solid #ccc;background:#fff;font:inherit;cursor:pointer'
  const primary = 'padding:8px 16px;border-radius:8px;border:0;background:#111;color:#fff;font:inherit;cursor:pointer'
  const finish = (r: FiveSecResult) => {
    addResult(cfg, r)
    onDone?.(r)
    cover(`<h2 style="margin:0 0 8px">Thank you</h2><p>${r.missed ? 'Time ran out before a click — that’s useful to know too.' : `Your click was recorded after ${((r.ms ?? 0) / 1000).toFixed(1)} s.`}</p><button data-act="done" style="${primary}">Done</button>`)
    root.querySelector('[data-act="done"]')!.addEventListener('click', () => root.remove())
  }
  const show = () => {
    const start = Date.now()
    root.innerHTML = '<div data-catch style="position:absolute;inset:0;cursor:pointer"><div style="position:fixed;top:0;left:0;right:0;height:5px;background:rgba(0,0,0,.08)"><i style="display:block;height:100%;width:100%;background:#eb6834"></i></div></div>'
    const bar = root.querySelector('i')!
    const catcher = root.querySelector('[data-catch]')!
    const tick = window.setInterval(() => {
      const ms = Date.now() - start
      bar.style.width = `${Math.max(0, 100 - (ms / (test.seconds * 1000)) * 100)}%`
      if (ms >= test.seconds * 1000) { window.clearInterval(tick); finish({ id: uid(), testId: test.id, t: new Date().toISOString(), vw: window.innerWidth, vh: window.innerHeight, missed: true }) }
    }, 50)
    catcher.addEventListener('click', (e) => {
      const ev = e as MouseEvent
      window.clearInterval(tick)
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => !root.contains(el))
      if (!under) return
      const { el, sel, label } = describeTarget(under)
      const box = el.getBoundingClientRect()
      let hit = false
      if (test.target) { try { hit = [...document.querySelectorAll(test.target.sel)].some((m) => m.contains(under)) } catch { /* old selector */ } }
      finish({
        id: uid(), testId: test.id, t: new Date().toISOString(), vw: window.innerWidth, vh: window.innerHeight, ms: Date.now() - start,
        x: Math.round((ev.clientX / window.innerWidth) * 1000) / 10, y: Math.round(ev.clientY + window.scrollY), docH: document.documentElement.scrollHeight,
        ex: box.width ? Math.round(((ev.clientX - box.left) / box.width) * 1000) / 10 : 50,
        ey: box.height ? Math.round(((ev.clientY - box.top) / box.height) * 1000) / 10 : 50,
        sel, label, ...(test.target ? { hit } : {}),
      })
    }, { once: true })
  }
  const prompt = document.createElement('p'); prompt.textContent = test.prompt
  cover(`<h2 style="margin:0 0 8px">A ${test.seconds}-second look</h2><div data-prompt></div><p style="color:#666">The screen shows for ${test.seconds} seconds. Your first click counts; nothing you type is recorded.</p><div style="display:flex;gap:8px;justify-content:center;margin-top:16px"><button data-act="skip" style="${btn}">Not now</button><button data-act="go" style="${primary}">Show the screen</button></div>`)
  root.querySelector('[data-prompt]')!.appendChild(prompt)
  root.querySelector('[data-act="skip"]')!.addEventListener('click', () => root.remove())
  root.querySelector('[data-act="go"]')!.addEventListener('click', show)
  document.body.appendChild(root)
  return () => root.remove()
}
