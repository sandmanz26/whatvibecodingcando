import { useEffect, useState } from 'react'
import { isEmbedded } from '../shared'
import { DESIGN_EVENT, DESIGN_MESSAGE, baseline, loadDesign, toCss, type Design, type DesignDoc } from './tokens'
import { presetOf } from './presets'

let base: DesignDoc | null = null

/**
 * Puts a simulated design on the app: the browser's saved variant, or — inside the
 * console's screen viewer — whatever the console is previewing.
 */
export function DesignLayer() {
  const [design, setDesign] = useState<Design | null>(loadDesign)

  useEffect(() => {
    const sync = () => setDesign(loadDesign())
    window.addEventListener(DESIGN_EVENT, sync)
    window.addEventListener('storage', sync)
    if (!isEmbedded) return () => { window.removeEventListener(DESIGN_EVENT, sync); window.removeEventListener('storage', sync) }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== DESIGN_MESSAGE) return
      setDesign(e.data.design ?? null)
    }
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ type: `${DESIGN_MESSAGE}:ready` }, window.location.origin)
    return () => { window.removeEventListener(DESIGN_EVENT, sync); window.removeEventListener('storage', sync); window.removeEventListener('message', onMsg) }
  }, [])

  useEffect(() => {
    let el = document.getElementById('design-sim') as HTMLStyleElement | null
    if (!design) {
      el?.remove()
      delete document.documentElement.dataset.uilib
      return
    }
    // Read the app's own tokens before any override is on the page.
    base ??= baseline()
    if (!el) { el = document.createElement('style'); el.id = 'design-sim'; document.head.appendChild(el) }
    const preset = presetOf(design.preset)
    el.textContent = `${toCss(design.doc, base)}\n${preset.css}`
    if (preset.id === 'wireframe') delete document.documentElement.dataset.uilib
    else document.documentElement.dataset.uilib = preset.id
  }, [design])

  return null
}
