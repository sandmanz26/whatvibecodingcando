/**
 * The installable script. One tag adds collaboration (comments pinned to the page, replies,
 * completion) to any website:
 *
 *   <script src="https://YOUR-HOST/embed/vibe.js" data-project="my-app" defer></script>
 *
 * The snippet carries only the project; everything else (on/off, environments, who sees it, the
 * launcher, the look) is the project's published configuration, read when the script starts and
 * followed live (see config.ts). Attributes on the script tag:
 *   data-project   which project (letters, digits, - and _; default: the site's host name)
 *   data-disabled  load nothing (for test runs and local builds)
 *   data-position, data-shortcut, data-color, data-products
 *                  the 0.1 options, used only until the project publishes settings
 *
 * Who sees it: with "reviewers only" (the default), a visitor needs a review link (#vibe_t=<one-time
 * token>, made by the panel); the token is traded for a reviewer session and removed from the address.
 * The site's own buttons open it with data-vibe="comment" | "comments", code with window.VibeCollab.open().
 *
 * The widget lives in a shadow root, so the site's CSS can't reach it and its CSS can't
 * reach the site. It never reads what visitors type into the site's own fields.
 */
import { Component, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Widget, OPEN_EVENT, type Config, type OpenWhat } from './Widget'
import { LocalBackend, NS } from './store'
import { CSS } from './styles'
import { LocalConfigSource, envFor, reportSeen, type ConfigSource, type ReviewerSession, type WidgetConfig } from './config'

/** The public API: window.VibeCollab.open('comment' | 'list'). Calls made before the script loaded are queued in q. */
interface Api { version: string; project: string; open: (what?: OpenWhat) => void; q?: unknown[][] }
declare global { interface Window { __vibeCollab?: { version: string; project: string }; VibeCollab?: Api | { q?: unknown[][] } } }

const VERSION = '0.2.0'

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

/** A crash inside the widget removes the widget, never the host page. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.warn('[Vibe Collab] the widget stopped after an error; the page is unaffected.', e) }
  render() { return this.state.failed ? null : this.props.children }
}

const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* ignore */ } },
}
const sessionKey = (p: string) => `${NS}session:${p}`
const previewKey = (p: string) => `${NS}preview:${p}`
function readSession(project: string): ReviewerSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(sessionKey(project)) ?? 'null') as ReviewerSession | null
    return v && v.project === project && typeof v.exp === 'number' && v.exp > Date.now() ? v : null
  } catch { return null }
}

/**
 * A review link (#vibe_t=<one-time token>) signs this browser in as a reviewer of the project. The
 * token is taken off the address at once, so it isn't left in history, shared or sent on.
 */
function takeReviewToken(project: string, source: ConfigSource): ReviewerSession | null {
  const h = window.location.hash
  const m = /(?:^#|&)vibe_t=([0-9a-f]{32,64})/.exec(h)
  if (!m) return null
  const rest = h.replace(/^#/, '').split('&').filter((x) => !x.startsWith('vibe_t=')).join('&')
  try { history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`) } catch { /* ignore */ }
  const s = source.redeem(project, m[1])
  if (!s) { console.warn('[Vibe Collab] that review link has expired or was already used. Ask for a new one.'); return null }
  try { localStorage.setItem(sessionKey(project), JSON.stringify({ ...s, preview: false })) } catch { /* ignore */ }
  if (s.preview) ss.set(previewKey(project), '1')
  return s
}

/** Is this the hosted demo site, served from where the script itself comes from? It runs whatever the environments say. */
function isHostedDemo(script: HTMLScriptElement | null) {
  try { return !!script && new URL(script.src).origin === window.location.origin && /\/embed-demo\.html$/.test(window.location.pathname) } catch { return false }
}

type Decision = { show: true; config: WidgetConfig; preview: boolean } | { show: false; why: string }
/**
 * Whether the widget shows here, and with which settings. Order matters: the off switch first, then
 * where (environment), then what (modules), then who (audience).
 */
function decide(o: { config: WidgetConfig | null; draft: WidgetConfig | null; preview: boolean; host: string; hostname: string; demo: boolean; reviewer: boolean }): Decision {
  const preview = o.preview && o.reviewer && !!o.draft
  const c = preview ? o.draft : o.config
  if (!c) return { show: false, why: 'This project has no published widget settings yet.' }
  if (!c.on) return { show: false, why: 'The widget is switched off for this project.' }
  if (!o.demo) {
    const env = envFor(c, o.host) ?? envFor(c, o.hostname)
    if (!env) return { show: false, why: `${o.hostname} isn’t one of this project’s environments.` }
    if (!env.on) return { show: false, why: `The widget is off in the ${env.name} environment.` }
  }
  if (!c.modules.comments) return { show: false, why: 'No module is turned on.' }
  if (c.audience === 'reviewers' && !o.reviewer) return { show: false, why: 'Only reviewers see it; open the site through a review link.' }
  return { show: true, config: c, preview }
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
  if (window.__vibeCollab) { console.warn('[Vibe Collab] the script is on this page twice; the second copy does nothing.'); return }
  const script = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[src*="vibe.js"]')
  const d = script?.dataset ?? {}
  // data-disabled: for test runs and local builds that shouldn't load it.
  if (d.disabled !== undefined && d.disabled !== 'false') return
  const project = /^[\w-]{1,64}$/.test(d.project ?? '') ? d.project! : (window.location.hostname || 'local').replace(/[^\w-]/g, '-')
  window.__vibeCollab = { version: VERSION, project }

  const source: ConfigSource = new LocalConfigSource()
  const demo = isHostedDemo(script)
  let token = takeReviewToken(project, source)
  const SESSION_EVENT = 'vibe-collab:session'

  // Before the project has published settings, the snippet's own data- attributes apply, as in 0.1.
  const first = source.get(project)
  if (first.gone) { console.info('[Vibe Collab] this project was deleted; nothing to show.'); reportSeen(project, { at: new Date().toISOString(), host: window.location.host, page: window.location.pathname, version: VERSION, shown: false, why: 'The project was deleted.' }); return }
  const legacy: WidgetConfig | null = first.live ? null : {
    v: 1, on: d.products === undefined || d.products.split(',').map((x) => x.trim()).includes('comments'),
    modules: { comments: true },
    theme: { accent: /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color! : '#e8590c', mode: 'light' },
    launcher: { kind: 'floating', position: d.position === 'left' ? 'left' : 'right', label: 'Comment', shortcut: d.shortcut !== 'off' },
    audience: 'everyone', envs: [],
  }

  const host = document.createElement('vibe-collab')
  host.id = 'vibe-collab'
  host.setAttribute('data-vibe-collab', VERSION)
  pinHostStyle(host)

  /** Re-decides whenever the settings change (published, or the draft while previewing). */
  function Root() {
    const read = () => {
      const s = source.get(project)
      if (s.gone) return { show: false as const, why: 'The project was deleted.' }
      return decide({
        config: s.live?.config ?? legacy, draft: s.draft, preview: ss.get(previewKey(project)) === '1',
        host: window.location.host, hostname: window.location.hostname, demo: demo || !!legacy, reviewer: !!readSession(project) || !!token,
      })
    }
    const [decision, setDecision] = useState(read)
    useEffect(() => source.subscribe(project, () => setDecision(read())), []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      const on = () => setDecision(read())
      host.addEventListener(SESSION_EVENT, on)
      return () => host.removeEventListener(SESSION_EVENT, on)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      reportSeen(project, { at: new Date().toISOString(), host: window.location.host, page: window.location.pathname, version: VERSION, shown: decision.show, why: decision.show ? '' : decision.why })
      if (!decision.show) console.info(`[Vibe Collab] not shown: ${decision.why}`)
    }, [decision])
    if (!decision.show) return null
    const c = decision.config
    const config: Config = {
      project, position: c.launcher.position, shortcut: c.launcher.shortcut, launcher: c.launcher.kind, label: c.launcher.label,
      accent: c.theme.accent, mode: c.theme.mode,
      ...(decision.preview ? { preview: { exit: () => { ss.del(previewKey(project)); setDecision(read()) } } } : {}),
    }
    return <Widget backend={new LocalBackend(project)} config={config} host={host} />
  }

  const open = (what: OpenWhat = 'comment') => host.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: what === 'list' ? 'list' : 'comment' }))
  const queued = (window.VibeCollab as { q?: unknown[][] } | undefined)?.q ?? []
  window.VibeCollab = { version: VERSION, project, open }
  // The site's own buttons: <button data-vibe="comment"> starts a comment, data-vibe="comments" opens the list.
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest?.('[data-vibe]')
    const what = el?.getAttribute('data-vibe')
    if (what !== 'comment' && what !== 'comments') return
    e.preventDefault()
    open(what === 'comments' ? 'list' : 'comment')
  }, true)

  // A review link opened on a page that is already open changes only the address's hash.
  window.addEventListener('hashchange', () => {
    if (!/(?:^#|&)vibe_t=/.test(window.location.hash)) return
    const s = takeReviewToken(project, source)
    if (s) token = s
    host.dispatchEvent(new Event(SESSION_EVENT))
  })

  const start = () => {
    try {
      // On <html>, not <body>: a transform or filter on body would make "position: fixed" follow the
      // body instead of the window, and frameworks that redraw body would remove the widget.
      document.documentElement.appendChild(host)
      // Put back if the host page removes it (a framework replacing the document's children).
      new MutationObserver(() => { if (!host.isConnected) document.documentElement.appendChild(host) })
        .observe(document.documentElement, { childList: true })
      const root = host.attachShadow({ mode: 'open' })
      addStyles(root, CSS)
      const mount = document.createElement('div')
      root.appendChild(mount)
      createRoot(mount).render(<Boundary><Root /></Boundary>)
      for (const call of queued) if (call[0] === 'open') open(call[1] as OpenWhat)
    } catch (e) {
      console.warn('[Vibe Collab] could not start; the page is unaffected.', e)
    }
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}

try { boot() } catch (e) { console.warn('[Vibe Collab] could not start; the page is unaffected.', e) }
