/**
 * The installable script. One tag adds collaboration (comments pinned to the page, replies,
 * completion) to any website:
 *
 *   <script src="https://YOUR-HOST/embed/vibe.js" data-project="my-app" defer></script>
 *
 * Options (data- attributes on the script tag):
 *   data-project   which project the comments belong to (letters, digits, - and _; default: the site's host name)
 *   data-position  "right" (default) or "left": where the buttons sit
 *   data-shortcut  "off" to turn off the C key
 *   data-color     the accent colour, as #rrggbb
 *   data-products  products to run, comma separated (only "comments" exists so far); left out, all run
 *
 * The widget lives in a shadow root, so the site's CSS can't reach it and its CSS can't
 * reach the site. It never reads what visitors type into the site's own fields.
 */
import { createRoot } from 'react-dom/client'
import { Widget, type Config } from './Widget'
import { LocalBackend } from './store'
import { CSS } from './styles'

declare global { interface Window { __vibeCollab?: { version: string; project: string } } }

const VERSION = '0.1.0'

/**
 * The host element's own box, set inline with !important: that beats even !important rules in the
 * host's stylesheets, which ":host" in the shadow root can't. Setting styles through the CSSOM is
 * allowed under a strict Content-Security-Policy.
 */
function pinHostStyle(host: HTMLElement) {
  const set: [string, string][] = [
    ['all', 'initial'], ['display', 'block'], ['position', 'static'], ['visibility', 'visible'], ['opacity', '1'],
    ['transform', 'none'], ['filter', 'none'], ['contain', 'none'], ['width', '0'], ['height', '0'], ['margin', '0'], ['padding', '0'], ['border', '0'],
  ]
  for (const [k, v] of set) host.style.setProperty(k, v, 'important')
}

/**
 * The widget's CSS. A constructed stylesheet is used where the browser has one: unlike a <style>
 * element, it isn't blocked by a host's "style-src" policy without 'unsafe-inline'.
 */
function addStyles(root: ShadowRoot, css: string) {
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    root.adoptedStyleSheets = [sheet]
    return
  } catch { /* older browser: fall back to a style element */ }
  const style = document.createElement('style')
  style.textContent = css
  root.appendChild(style)
}

function boot() {
  if (window.__vibeCollab) return // installed twice: keep the first
  const script = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[src*="vibe.js"]')
  const d = script?.dataset ?? {}
  const project = /^[\w-]{1,64}$/.test(d.project ?? '') ? d.project! : (window.location.hostname || 'local').replace(/[^\w-]/g, '-')
  const config: Config = { project, position: d.position === 'left' ? 'left' : 'right', shortcut: d.shortcut !== 'off' }
  const color = /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color! : '#e8590c'
  window.__vibeCollab = { version: VERSION, project }
  // Turned off for this project in the panel: install nothing.
  if (d.products !== undefined && !d.products.split(',').map((x) => x.trim()).includes('comments')) return

  const start = () => {
    // A custom tag, not a div: the host's rules for div (or body > div) don't reach it.
    const host = document.createElement('vibe-collab')
    host.id = 'vibe-collab'
    host.setAttribute('data-vibe-collab', VERSION)
    pinHostStyle(host)
    // On <html>, not <body>: a transform or filter on body would make "position: fixed" follow the
    // body instead of the window, and frameworks that redraw body would remove the widget.
    document.documentElement.appendChild(host)
    // Put back if the host page removes it (a framework replacing the document's children).
    new MutationObserver(() => { if (!host.isConnected) document.documentElement.appendChild(host) })
      .observe(document.documentElement, { childList: true })
    const root = host.attachShadow({ mode: 'open' })
    addStyles(root, CSS.replace('--vc-accent: #e8590c', `--vc-accent: ${color}`))
    const mount = document.createElement('div')
    root.appendChild(mount)
    createRoot(mount).render(<Widget backend={new LocalBackend(project)} config={config} host={host} />)
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}

boot()
