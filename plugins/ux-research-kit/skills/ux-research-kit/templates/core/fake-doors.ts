/**
 * Fake doors — a button for something that isn't built yet, to measure who wants it.
 * Recorded per anonymous tab: the door was seen (at least half on screen) and clicked. Nothing else.
 */
import { RESEARCH_ATTR, isEmbedded, type ResearchConfig } from './config'
import { readJSON, tab, uid, writeJSON } from './storage'

export interface FakeDoor {
  id: string
  name: string
  page: string
  /** the element the door is, or sits next to */
  sel: string
  anchorLabel: string
  /** 'existing': that element becomes the door · 'new': a button is added after it */
  mode: 'existing' | 'new'
  label: string
  message: string
  live: boolean
  createdAt: string
}

export interface DoorEvent { door: string; sid: string; type: 'seen' | 'click'; t: string; vw: number }

export const DEFAULT_MESSAGE = 'This isn’t available yet. Thanks for trying it — it tells us whether to build it next.'
const ATTR = 'data-fake-door'

const keys = (cfg: ResearchConfig) => ({ doors: `${cfg.app}.doors`, events: `${cfg.app}.doors.events`, sid: `${cfg.app}.doors.sid` })
export const doorsEvent = (cfg: ResearchConfig) => `${cfg.app}:doors`

export const loadDoors = (cfg: ResearchConfig) => readJSON<FakeDoor[]>(keys(cfg).doors, [])
export function saveDoors(cfg: ResearchConfig, doors: FakeDoor[]) { writeJSON(keys(cfg).doors, doors); window.dispatchEvent(new Event(doorsEvent(cfg))) }
export const loadDoorEvents = (cfg: ResearchConfig) => readJSON<DoorEvent[]>(keys(cfg).events, [])
const addEvent = (cfg: ResearchConfig, e: DoorEvent) => writeJSON(keys(cfg).events, [...loadDoorEvents(cfg), e].slice(-20000))
export const clearDoorEvents = (cfg: ResearchConfig, door: string) => writeJSON(keys(cfg).events, loadDoorEvents(cfg).filter((e) => e.door !== door))

function doorSid(cfg: ResearchConfig) {
  let id = tab.get(keys(cfg).sid)
  if (!id) { id = uid(); tab.set(keys(cfg).sid, id) }
  return id
}

export function doorStats(cfg: ResearchConfig, door: string) {
  const ev = loadDoorEvents(cfg).filter((e) => e.door === door)
  const seen = new Set(ev.filter((e) => e.type === 'seen').map((e) => e.sid))
  const clickedBy = new Set(ev.filter((e) => e.type === 'click').map((e) => e.sid))
  clickedBy.forEach((s) => seen.add(s))
  return { seen: seen.size, clickedBy: clickedBy.size, clicks: ev.filter((e) => e.type === 'click').length, rate: seen.size ? clickedBy.size / seen.size : 0 }
}

function anchorFor(sel: string, ignore: string): HTMLElement | null {
  try {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest(ignore) || el.hasAttribute(`${ATTR}-new`)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  } catch { /* selector from an older layout */ }
  return null
}

function showNote(door: FakeDoor) {
  const wrap = document.createElement('div')
  wrap.setAttribute(RESEARCH_ATTR, '')
  wrap.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483600"></div>
<div role="dialog" aria-modal="true" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(400px,calc(100vw - 32px));background:#fff;color:#111;border-radius:12px;padding:20px;z-index:2147483601;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.2)">
<b style="font-size:16px">Coming soon</b><p style="margin:8px 0 16px"></p><button type="button" style="float:right;padding:6px 14px;border-radius:8px;border:0;background:#111;color:#fff;font:inherit;cursor:pointer">OK</button></div>`
  wrap.querySelector('p')!.textContent = door.message
  const close = () => wrap.remove()
  wrap.querySelector('button')!.addEventListener('click', close)
  wrap.firstElementChild!.addEventListener('click', close)
  document.body.appendChild(wrap)
  wrap.querySelector('button')!.focus()
}

/**
 * Puts live doors on their pages and counts them. Call `refresh()` after route changes
 * (or rely on the built-in 700 ms re-check). In an iframe nothing is counted.
 */
export function installFakeDoors(cfg: ResearchConfig, opts: { onOpen?: (door: FakeDoor) => void } = {}) {
  const seen = new Set<string>()
  let page = cfg.path()
  const counting = () => !isEmbedded && !cfg.paused() && !cfg.query().has('heatmap')
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const id = (en.target as HTMLElement).getAttribute(ATTR)
    if (!id || !en.isIntersecting || seen.has(id)) return
    seen.add(id)
    if (counting()) addEvent(cfg, { door: id, sid: doorSid(cfg), type: 'seen', t: new Date().toISOString(), vw: window.innerWidth })
  }), { threshold: 0.5 })

  const live = () => loadDoors(cfg).filter((d) => d.live && d.page === cfg.path())

  const place = () => {
    if (cfg.path() !== page) { page = cfg.path(); seen.clear() }
    const here = live()
    // Doors that were switched off or belong to another page go away.
    document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
      if (!here.some((d) => d.id === el.getAttribute(ATTR))) { if (el.hasAttribute(`${ATTR}-new`)) el.remove(); else el.removeAttribute(ATTR) }
    })
    for (const d of here) {
      const anchor = anchorFor(d.sel, cfg.ignore)
      if (!anchor) continue
      let el: HTMLElement | null = d.mode === 'existing' ? anchor : null
      if (d.mode === 'new') {
        const next = anchor.nextElementSibling
        el = next instanceof HTMLElement && next.getAttribute(ATTR) === d.id ? next : null
        if (!el) {
          const b = document.createElement('button')
          const control = anchor.matches('a, button')
          const block = getComputedStyle(anchor).display === 'block'
          // Copy the neighbour's classes so the door looks like it belongs.
          b.className = control ? anchor.className.replace(/\b(active|on|selected)\b/g, '').trim() : ''
          b.type = 'button'
          b.textContent = d.label
          b.setAttribute(`${ATTR}-new`, '')
          if (block) b.style.marginTop = '8px'
          anchor.insertAdjacentElement('afterend', b)
          el = b
        }
      }
      if (el && el.getAttribute(ATTR) !== d.id) { el.setAttribute(ATTR, d.id); io.observe(el) }
    }
  }

  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.(`[${ATTR}]`)
    const door = el && live().find((d) => d.id === el.getAttribute(ATTR))
    if (!door) return
    // The door goes nowhere: the app never sees the click (the click tracker still does).
    e.preventDefault()
    e.stopPropagation()
    if (counting()) addEvent(cfg, { door: door.id, sid: doorSid(cfg), type: 'click', t: new Date().toISOString(), vw: window.innerWidth })
    ;(opts.onOpen ?? showNote)(door)
  }

  place()
  const timer = window.setInterval(place, 700)
  document.addEventListener('click', onClick, true)
  return {
    refresh: place,
    uninstall() {
      window.clearInterval(timer)
      io.disconnect()
      document.removeEventListener('click', onClick, true)
      document.querySelectorAll(`[${ATTR}-new]`).forEach((b) => b.remove())
      document.querySelectorAll(`[${ATTR}]`).forEach((a) => a.removeAttribute(ATTR))
    },
  }
}

export const newDoor = (p: Partial<FakeDoor> = {}): FakeDoor => ({
  id: uid(), name: '', page: '/', sel: '', anchorLabel: '', mode: 'new', label: '', message: DEFAULT_MESSAGE, live: false, createdAt: new Date().toISOString(), ...p,
})
