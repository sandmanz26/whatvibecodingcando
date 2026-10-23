import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { DoorOpen } from 'lucide-react'
import { TOOL_DOM, currentQuery, isConsole, isEmbedded } from '../shared'
import { DOORS_EVENT, addDoorEvent, doorSid, loadDoors, type FakeDoor } from './store'

const ATTR = 'data-fakedoor'

function anchorFor(sel: string): HTMLElement | null {
  try {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (el.closest(TOOL_DOM) || el.hasAttribute(`${ATTR}-new`)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  } catch { /* selector from an older layout */ }
  return null
}

/** Puts live fake doors on their pages, counts who sees and clicks them, and answers the click. */
export function FakeDoors() {
  const { pathname } = useLocation()
  const [doors, setDoors] = useState<FakeDoor[]>(loadDoors)
  const [open, setOpen] = useState<FakeDoor | null>(null)
  // Inside the console's viewer or a heatmap the doors are shown, but nothing is counted.
  const counting = !isEmbedded && !isConsole(pathname) && !currentQuery().has('heatmap')

  useEffect(() => {
    const sync = () => setDoors(loadDoors())
    window.addEventListener(DOORS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(DOORS_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])

  useEffect(() => {
    if (isConsole(pathname)) return
    const here = doors.filter((d) => d.live && d.page === pathname)
    const seen = new Set<string>()
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      const id = (en.target as HTMLElement).getAttribute(ATTR)
      if (!id || !en.isIntersecting || seen.has(id)) return
      seen.add(id)
      if (counting) addDoorEvent({ door: id, sid: doorSid(), type: 'seen', t: new Date().toISOString(), vw: window.innerWidth })
    }), { threshold: 0.5 })

    const place = () => {
      for (const d of here) {
        const anchor = anchorFor(d.sel)
        if (!anchor) continue
        let el: HTMLElement | null
        if (d.mode === 'existing') {
          el = anchor
        } else {
          el = anchor.nextElementSibling instanceof HTMLElement && anchor.nextElementSibling.getAttribute(ATTR) === d.id ? anchor.nextElementSibling : null
          if (!el) {
            const b = document.createElement('button')
            const control = anchor.matches('a, button')
            const block = getComputedStyle(anchor).display === 'block'
            b.className = control ? anchor.className.replace(/\b(active|on)\b/g, '').trim() : block ? 'btn sm' : 'btn'
            b.type = 'button'
            b.textContent = d.label
            b.setAttribute(`${ATTR}-new`, '')
            if (!control && block) b.style.marginTop = '8px'
            anchor.insertAdjacentElement('afterend', b)
            el = b
          }
        }
        if (el.getAttribute(ATTR) !== d.id) { el.setAttribute(ATTR, d.id); io.observe(el) }
      }
    }
    place()
    const t = window.setInterval(place, 700)

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(`[${ATTR}]`)
      const door = el && here.find((d) => d.id === el.getAttribute(ATTR))
      if (!door) return
      // The door goes nowhere: the app never sees the click. The click tracker still does.
      e.preventDefault()
      e.stopPropagation()
      if (counting) addDoorEvent({ door: door.id, sid: doorSid(), type: 'click', t: new Date().toISOString(), vw: window.innerWidth })
      setOpen(door)
    }
    document.addEventListener('click', onClick, true)

    return () => {
      window.clearInterval(t)
      io.disconnect()
      document.removeEventListener('click', onClick, true)
      document.querySelectorAll(`[${ATTR}-new]`).forEach((b) => b.remove())
      document.querySelectorAll(`[${ATTR}]`).forEach((a) => a.removeAttribute(ATTR))
    }
  }, [doors, pathname, counting])

  if (!open) return null
  return createPortal(
    <div data-insights-ignore>
      <div className="scrim" onClick={() => setOpen(null)} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={open.name} style={{ width: 'min(420px, calc(100vw - 32px))' }}>
        <div className="modal-head">
          <h2 className="row" style={{ gap: 8, fontSize: 16 }}><DoorOpen size={16} /> Coming soon</h2>
          <p>{open.message}</p>
        </div>
        <div className="modal-foot"><button className="btn primary" autoFocus onClick={() => setOpen(null)}>OK</button></div>
      </div>
    </div>,
    document.body,
  )
}
