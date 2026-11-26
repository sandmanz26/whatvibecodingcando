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
import { decide, type Decision } from './decide'
import { LocalBackend, NS, type Backend } from './store'
import { CSS } from './styles'
import { acceptHandoff, serveRaw, LocalConfigSource, anyModule, modulesOf, parseConfig, reportSeen, type ConfigSource, type ReviewerSession, type WidgetConfig } from './config'
import * as server from './server'
import { frameMain } from './frame'
import { bridgeMain, openBridge, type Bridge } from './demo-bridge'
import { Participant, VisitorConsent } from './Research'
import { heatNoteSeen, loadRun, markHeatNoteSeen, reviewerClicksOff, saveRun, setReviewerClicksOff, startReviewerClicks, studyInfo, takeStudyToken, visitorModules, type ResearchModule, type RunState, type VisitorModule } from './research'

/** The public API: window.OurHunch.open('comment' | 'list') (also window.VibeCollab, the original name). Calls made before the script loaded are queued in q. */
interface Api { version: string; project: string; open: (what?: OpenWhat) => void; q?: unknown[][] }
declare global { interface Window { __vibeCollab?: { version: string; project: string; server?: boolean }; VibeCollab?: Api | { q?: unknown[][] }; OurHunch?: Api } }

import { VERSION } from './version'
import { takeHint } from './hints'

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
  componentDidCatch(e: unknown) { console.warn('[ourhunch] the widget stopped after an error; the page is unaffected.', e) }
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

/** Is this the hosted demo site, served from where the script itself comes from? It runs whatever the environments say. */
function isHostedDemo(script: HTMLScriptElement | null) {
  try { return !!script && new URL(script.src).origin === window.location.origin && /\/embed-demo\.html$/.test(window.location.pathname) } catch { return false }
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

/**
 * Where the widget's settings, reviewer state and comments come from. Two kinds:
 *   server  the project's settings file on the CDN, reviewer sessions and comments on the server
 *   local   this browser's stand-in (the browser-only demo, and installs that never published)
 */
/** skipEnvs: installs that never published (0.1 snippet options) run wherever the snippet is. */
/** reviewer: may read and post comments; invited: came in through a review link (not only joined an open widget). */
interface Snapshot { live: WidgetConfig | null; draft: WidgetConfig | null; preview: boolean; reviewer: boolean; invited: boolean; gone: boolean; skipEnvs: boolean }
interface Mode {
  /** true on the server: reading and posting need a reviewer session for this browser */
  readonly sessions: boolean
  snapshot(): Snapshot
  subscribe(cb: () => void): () => void
  /** a review link's token, from the address */
  useToken(token: string): Promise<void>
  /** before showing a widget that is open to everyone: a reviewer session for this browser */
  join(): Promise<void>
  exitPreview(): void
  backend(): Backend
  reportSeen(shown: boolean, why: string): void
}

function localMode(project: string, legacy: WidgetConfig | null, trial = false, bridge: Bridge | null = null): Mode {
  const source: ConfigSource = new LocalConfigSource()
  let token: ReviewerSession | null = null
  const subs = new Set<() => void>()
  return {
    sessions: false,
    snapshot() {
      const s = source.get(project)
      const reviewer = !!readSession(project) || !!token || (trial && !s.live)
      return { live: s.live?.config ?? legacy, draft: s.draft, preview: ss.get(previewKey(project)) === '1', reviewer, invited: reviewer, gone: !!s.gone, skipEnvs: !s.live && !!legacy }
    },
    subscribe(cb) { subs.add(cb); const off = source.subscribe(project, cb); return () => { subs.delete(cb); off() } },
    async useToken(t) {
      const s = source.redeem(project, t)
      if (!s) { console.warn('[ourhunch] that review link has expired or was already used. Ask for a new one.'); return }
      try { localStorage.setItem(sessionKey(project), JSON.stringify({ ...s, preview: false })) } catch { /* ignore */ }
      // A fresh link decides: a tab opened from the panel can inherit an old preview flag.
      if (s.preview) ss.set(previewKey(project), '1')
      else ss.del(previewKey(project))
      token = s
      subs.forEach((f) => f())
    },
    async join() { /* the stand-in has no sessions: everyone may comment */ },
    exitPreview() { ss.del(previewKey(project)); subs.forEach((f) => f()) },
    backend: () => new LocalBackend(project),
    reportSeen(shown, why) {
      reportSeen(project, { at: new Date().toISOString(), host: window.location.host, page: window.location.pathname, version: VERSION, shown, why })
      bridge?.seen(project, { page: window.location.pathname, version: VERSION, shown, why })
    },
  }
}

const draftKey = (p: string) => `${NS}draft:${p}`
/**
 * Came in through a review link (kept in this browser). Only decides whether the design tools show:
 * they read the page's own styles in this browser and reach no data, so a visitor who sets it by hand
 * gains nothing. Comments are checked by the server either way.
 */
const invitedKey = (p: string) => `${NS}invited:${p}`
const invitedStore = {
  get: (p: string) => { try { return localStorage.getItem(invitedKey(p)) === '1' } catch { return false } },
  set: (p: string, v: boolean) => { try { if (v) localStorage.setItem(invitedKey(p), '1'); else localStorage.removeItem(invitedKey(p)) } catch { /* ignore */ } },
}
function serverMode(project: string, first: server.ServedFile): Mode {
  let live = first.live?.config ?? null
  let gone = first.gone
  let reviewer = server.isReviewer(project)
  const readDraft = () => { try { return parseConfig(JSON.parse(ss.get(draftKey(project)) ?? 'null')) } catch { return null } }
  let draft = readDraft()
  const subs = new Set<() => void>()
  const notify = () => subs.forEach((f) => f())
  const setReview = (r: server.ReviewStart | null, viaLink = false) => {
    reviewer = !!r
    if (!r) invitedStore.set(project, false)
    else if (viaLink) invitedStore.set(project, true)
    if (r?.preview) { ss.set(previewKey(project), '1'); ss.set(draftKey(project), JSON.stringify(r.draft ?? null)); draft = parseConfig(r.draft) }
    if (r?.name) { try { if (!localStorage.getItem(`${NS}name`)) localStorage.setItem(`${NS}name`, r.name) } catch { /* ignore */ } }
    notify()
  }
  // This browser was a reviewer: still? (A reviewer removed in the panel loses the widget here.)
  if (reviewer) void server.startReview(project, null).then((r) => { if (!r) setReview(null) })
  let timers: number[] = []
  const poll = () => {
    timers.forEach((t) => window.clearInterval(t))
    timers = []
    if (!reviewer) return
    // Reviewers follow publishing (and the off switch) within a minute; previews follow the draft as it is edited.
    timers.push(window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void server.fetchSettings(project, true).then((f) => { if (f.gone !== gone || f.live?.version !== undefined) { gone = f.gone; live = f.live?.config ?? live; notify() } })
    }, 60_000))
    if (ss.get(previewKey(project)) === '1') timers.push(window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void server.getDraft(project).then((d) => { if (d && JSON.stringify(d) !== JSON.stringify(draft)) { draft = d; ss.set(draftKey(project), JSON.stringify(d)); notify() } })
    }, 4000))
  }
  subs.add(poll)
  poll()
  return {
    sessions: true,
    snapshot: () => ({ live, draft, preview: ss.get(previewKey(project)) === '1', reviewer, invited: reviewer && invitedStore.get(project), gone, skipEnvs: false }),
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb) },
    async useToken(t) {
      // A fresh link decides whether this tab previews: a tab opened from the panel can inherit an old flag.
      ss.del(previewKey(project)); ss.del(draftKey(project)); draft = null
      setReview(await server.startReview(project, t, (() => { try { return localStorage.getItem(`${NS}name`) ?? undefined } catch { return undefined } })()), true)
    },
    async join() { if (!reviewer) setReview(await server.startReview(project, null, undefined, true)) },
    exitPreview() { ss.del(previewKey(project)); ss.del(draftKey(project)); draft = null; notify() },
    backend: () => new server.ServerBackend(project),
    reportSeen: (shown, why) => server.reportSeen(project, VERSION, shown, why),
  }
}

/** Shown only to the person who opened a review link that didn't work, so they aren't left guessing. */
const LINK_PROBLEMS: Record<string, string> = {
  anonymous_disabled: 'This review link can’t open yet: the site’s comment server doesn’t allow reviewer sessions. Ask the site owner to turn on anonymous sign-ins.',
  link_expired: 'This review link has expired or was already used. Ask the site owner for a new one.',
  origin_not_allowed: 'This review link doesn’t work on this address: the site owner hasn’t switched it on (Widget → Where), or the widget is off.',
  no_project: 'This review link is for a project that no longer exists.',
  rate_limited: 'Too many tries. Wait a minute and open the link again.',
  study_closed: 'This study has ended. Thank you for opening it!',
  study_full: 'This study has all the participants it needs. Thank you!',
  captcha_failed: 'The check that you’re a person didn’t pass. Open the review link again.',
  captcha_timeout: 'The check that you’re a person timed out. Open the review link again.',
  captcha_unavailable: 'The check that you’re a person couldn’t load. Check your connection and open the link again.',
  captcha_blocked: 'This site blocks the sign-in frame the review needs. The site owner can allow whatvibecodingcando.vercel.app in the site’s Content-Security-Policy (frame-src).',
}
function LinkNotice({ why, onClose }: { why: string; onClose: () => void }) {
  return (
    <div className="vc-toast error" role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', bottom: 20, maxWidth: 'min(460px, calc(100vw - 32px))', lineHeight: 1.4 }}>
      <span>{LINK_PROBLEMS[why] ?? 'This review link didn’t work. Open it again, or ask the site owner for a new one.'}</span>
      <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'transparent', color: '#fff', fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

const sameOrigin = (src: string) => { try { return new URL(src).origin === window.location.origin } catch { return true } }
const tipKey = (p: string) => `${NS}tip-panel:${p}`
const tipSeen = (p: string) => { try { return localStorage.getItem(tipKey(p)) === '1' } catch { return false } }
const markTipSeen = (p: string) => { try { localStorage.setItem(tipKey(p), '1') } catch { /* shown again next time */ } }
/**
 * Records the reviewer's clicks into the default "Site heatmap" study, and says so once, with a way to
 * turn it off (also in the Heatmap panel).
 */
function ReviewerClicks({ project, version }: { project: string; version: string }) {
  const [off, setOff] = useState(() => reviewerClicksOff(project))
  const [note, setNote] = useState(() => !heatNoteSeen(project))
  useEffect(() => {
    const on = () => setOff(reviewerClicksOff(project))
    window.addEventListener('vibe-collab:heat-pref', on)
    return () => window.removeEventListener('vibe-collab:heat-pref', on)
  }, [project])
  useEffect(() => (off ? undefined : startReviewerClicks(project, version)), [off, project, version])
  if (!note || off) return null
  const close = () => { markHeatNoteSeen(project); setNote(false) }
  return (
    <div className="vc-toast" role="status" data-vc-heatnote="" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', bottom: 140, maxWidth: 'min(420px, calc(100vw - 32px))', lineHeight: 1.4 }}>
      <span>Your clicks on this site help build its heatmap (and a masked picture of each page layout may be saved, form fields emptied). Turn off in the widget menu (Heatmap), or <button type="button" onClick={() => { setReviewerClicksOff(project, true); close() }} style={{ border: 0, background: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}>turn off now</button>.</span>
      <button type="button" onClick={close} aria-label="Got it" style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

/** Once per project, for the team member who opened the site from the panel. */
function PanelTip({ onClose }: { onClose: () => void }) {
  return (
    <div className="vc-toast" role="status" data-vc-tip="" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', bottom: 84, maxWidth: 'min(420px, calc(100vw - 32px))', lineHeight: 1.4 }}>
      <span>You’re seeing ourhunch because you opened it from your panel. Visitors don’t see it.</span>
      <button type="button" onClick={onClose} aria-label="Got it" style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
    </div>
  )
}

/**
 * The research buttons a visitor sees: every module that is on. A paused one (its default study
 * closed) is hidden; one that can't run here shows with a short reason instead of disappearing.
 */
function researchEntries(ids: ResearchModule[], vms: VisitorModule[] | 'error' | null): { m: VisitorModule; reason?: string }[] {
  const noCamera = typeof navigator === 'undefined' || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia
  const out: { m: VisitorModule; reason?: string }[] = []
  for (const id of ids) {
    const vm = Array.isArray(vms) ? vms.find((x) => x.module === id) : undefined
    if (vm?.state === 'paused') continue
    const m: VisitorModule = vm ?? { module: id, state: 'none', eye: id === 'gaze', tasks: 1 }
    const reason = vms === null ? 'loading…' : vms === 'error' ? 'unavailable right now' : !vm || vm.state === 'none' ? 'not set up yet' : id === 'gaze' && noCamera ? 'needs a camera, which this page or browser can’t use' : undefined
    out.push({ m, reason })
  }
  return out
}

/** Starts the widget (or the session frame) for the script tag `given`: called by the loader (main.ts). */
export async function boot(given?: HTMLScriptElement | null) {
  const me = given ?? (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[src*="vibe.js"]')
  // Loaded by our own session.html: this is the session frame, not a widget.
  if (me?.dataset.frame !== undefined) { if (server.hasServer) frameMain(server.serverUrl, server.serverKey); else bridgeMain(); return }
  if (window.__vibeCollab) { console.warn('[ourhunch] the script is on this page twice; the second copy does nothing.'); return }
  const script = me
  const d = script?.dataset ?? {}
  if (script?.src) server.useFrame(script.src)
  // data-disabled: for test runs and local builds that shouldn't load it.
  if (d.disabled !== undefined && d.disabled !== 'false') return
  const project = /^[\w-]{1,64}$/.test(d.project ?? '') ? d.project! : (window.location.hostname || 'local').replace(/[^\w-]/g, '-')
  window.__vibeCollab = { version: VERSION, project }
  const demo = isHostedDemo(script)
  const gazeUrl = script?.src ? new URL('gaze.js', script.src).href : ''
  const SESSION_EVENT = 'vibe-collab:session'

  // The review link's token, taken off the address at once (so it isn't left in history or shared on).
  // Read from the address the browser first opened too, for sites that redirect on load (hints.ts).
  const token = takeHint('t', '[0-9a-f]{32,64}')
  // Opened with the panel's "Open my site" (not a reviewer's invite): a one-time tip says why it shows.
  const fromPanel = takeHint('from', 'panel') !== null

  // A study's participant (#vibe_r=… and "I agree"): the study runs instead of the widget, for this tab.
  const studyToken = takeStudyToken()
  // (In the browser-only demo the default study's link works too, from this browser's stand-in: localheat.ts.)
  if (studyToken || loadRun(project)) {
    let study = loadRun(project)
    if (studyToken) {
      try {
        const info = await studyInfo(project, studyToken)
        study = { token: studyToken, phase: 'consent', info, index: 0, pages: [], clicks: 0, firstClickHit: null, results: [], answers: [] }
        saveRun(project, study)
      } catch (e) {
        mountAlone(<LinkNotice why={(e as Error).message} onClose={() => document.getElementById('vibe-collab')?.remove()} />)
        return
      }
    }
    if (study && study.phase !== 'declined') {
      const file = await server.fetchSettings(project)
      mountAlone(<Participant project={project} initial={study as RunState} accent={file.live?.config.theme.accent ?? '#e8590c'} doorsOn={!!file.live?.config.modules.doors} version={file.live?.config.version ?? ''} gazeUrl={script?.src ? new URL('gaze.js', script.src).href : ''} />)
      return
    }
  }

  // Server first: a project with a published settings file on the CDN runs on the server.
  let mode: Mode | null = null
  if (server.hasServer) {
    const file = await server.fetchSettings(project, !!token)
    if (file.gone) { console.info('[ourhunch] this project was deleted; nothing to show.'); return }
    if (file.live) mode = serverMode(project, file)
  }
  let bridge: Bridge | null = null
  if (!mode && !server.hasServer && script?.src && !sameOrigin(script.src)) {
    // The browser-only demo on the customer's own address: the panel's settings and token come through the bridge.
    bridge = await openBridge(script.src)
    const r = await bridge?.sync(project, token)
    if (r) { serveRaw(project, r.served); if (r.handoff && token) acceptHandoff(project, token, r.handoff.preview) }
  }
  if (!mode) {
    const first = new LocalConfigSource().get(project)
    if (first.gone) { console.info('[ourhunch] this project was deleted; nothing to show.'); reportSeen(project, { at: new Date().toISOString(), host: window.location.host, page: window.location.pathname, version: VERSION, shown: false, why: 'The project was deleted.' }); return }
    // Before the project has published settings, the snippet's own data- attributes apply, as in 0.1.
    // data-products picks the modules (the onboarding's "Try it on the demo site" passes the products just picked).
    const picked = d.products === undefined ? null : d.products.split(',').map((x) => x.trim())
    const legacyModules = modulesOf((id) => (picked ? picked.includes(id) : id === 'comments'))
    const legacy: WidgetConfig | null = first.live ? null : {
      v: 1, on: anyModule(legacyModules),
      modules: legacyModules,
      theme: { accent: /^#[0-9a-f]{6}$/i.test(d.color ?? '') ? d.color! : '#e8590c', mode: 'light' },
      launcher: { kind: 'floating', position: d.position === 'left' ? 'left' : 'right', label: 'Comment', shortcut: d.shortcut !== 'off' },
      audience: 'everyone', envs: [],
    }
    // Trying products on our own demo site before the project is published: the visitor is the
    // project's owner, so the reviewers' tools show too (they read only this page's styles).
    mode = localMode(project, legacy, demo && !!legacy && picked !== null, bridge)
  }
  const m = mode
  window.__vibeCollab.server = m.sessions
  if (token) await m.useToken(token)

  const host = document.createElement('vibe-collab')
  host.id = 'vibe-collab'
  host.setAttribute('data-vibe-collab', VERSION)
  pinHostStyle(host)

  /** Re-decides whenever the settings or the reviewer state change. */
  function Root() {
    const read = (): Decision => {
      const s = m.snapshot()
      if (s.gone) return { show: false, why: 'The project was deleted.' }
      return decide({
        project, config: s.live, draft: s.draft, preview: s.preview,
        host: window.location.host, hostname: window.location.hostname,
        demo: demo || s.skipEnvs, reviewer: s.reviewer, invited: s.invited,
      })
    }
    const [decision, setDecision] = useState(read)
    const [backend] = useState(() => m.backend())
    const [joining, setJoining] = useState(false)
    useEffect(() => m.subscribe(() => setDecision(read())), []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      const on = () => setDecision(read())
      host.addEventListener(SESSION_EVENT, on)
      return () => host.removeEventListener(SESSION_EVENT, on)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    // Open to everyone: this browser needs a reviewer session before it can read or post.
    const needsJoin = m.sessions && decision.show && decision.comments && decision.config.audience === 'everyone' && !m.snapshot().reviewer
    useEffect(() => {
      if (!needsJoin || joining) return
      setJoining(true)
      void m.join().finally(() => setJoining(false))
    }, [needsJoin]) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      m.reportSeen(decision.show, decision.show ? '' : decision.why)
      if (!decision.show) console.info(`[ourhunch] not shown: ${decision.why}`)
    }, [decision])
    const [problem, setProblem] = useState<string | null>(() => (m.sessions ? server.reviewLinkError() : null))
    useEffect(() => {
      const on = () => setProblem(m.sessions ? server.reviewLinkError() : null)
      host.addEventListener(SESSION_EVENT, on)
      return () => host.removeEventListener(SESSION_EVENT, on)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    const [tip, setTip] = useState(() => fromPanel && !tipSeen(project))
    // Research modules for visitors: which are open (a paused one is hidden), and a run once they press OK.
    const wantsResearch = decision.show && decision.research.length > 0
    const [vms, setVms] = useState<VisitorModule[] | 'error' | null>(null)
    useEffect(() => { if (wantsResearch && vms === null) void visitorModules(project).then(setVms, () => setVms('error')) }, [wantsResearch]) // eslint-disable-line react-hooks/exhaustive-deps
    const [asking, setAsking] = useState<VisitorModule | null>(null)
    const [run, setRun] = useState<RunState | null>(null)
    const notice = problem ? <LinkNotice why={problem} onClose={() => setProblem(null)} /> : null
    if (!decision.show || needsJoin) return notice
    if (run) return <Participant project={project} initial={run} accent={decision.config.theme.accent} doorsOn={!!decision.config.modules.doors} version={decision.config.version ?? ''} gazeUrl={gazeUrl} onEnd={() => setRun(null)} />
    const tipBox = tip && !problem && decision.config.audience === 'reviewers' ? <PanelTip onClose={() => { markTipSeen(project); setTip(false) }} /> : null
    const c = decision.config
    const config: Config = {
      project, position: c.launcher.position, shortcut: c.launcher.shortcut, launcher: c.launcher.kind, label: c.launcher.label,
      accent: c.theme.accent, mode: c.theme.mode,
      comments: decision.comments, tools: decision.tools, team: decision.team,
      compare: decision.comments && !!c.modules.compare, narration: decision.comments && !!c.modules.narration && m.sessions, version: c.version,
      ...(decision.preview ? { preview: { exit: () => m.exitPreview() } } : {}),
      research: researchEntries(decision.research, vms), onResearch: setAsking,
    }
    // Reviewers and the team (let in by the owner) build the heatmap as they click, unless they turned it off.
    const heat = decision.tools.includes('heatmap')
    const consent = asking ? <VisitorConsent project={project} m={asking} accent={c.theme.accent} gazeUrl={gazeUrl} onCancel={() => setAsking(null)} onStart={(s) => { saveRun(project, s); setAsking(null); setRun(s) }} /> : null
    return <>{notice}{tipBox}{heat && <ReviewerClicks project={project} version={c.version ?? ''} />}<Widget backend={backend} config={config} host={host} />{consent}</>
  }

  const open = (what: OpenWhat = 'comment') => host.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: what === 'list' ? 'list' : 'comment' }))
  const queued = (window.VibeCollab as { q?: unknown[][] } | undefined)?.q ?? []
  window.VibeCollab = { version: VERSION, project, open }
  // The brand's name for the same API (window.VibeCollab stays: sites already call it).
  window.OurHunch = window.VibeCollab
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
    const t = takeHint('t', '[0-9a-f]{32,64}')
    if (t) void m.useToken(t).then(() => host.dispatchEvent(new Event(SESSION_EVENT)))
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
      console.warn('[ourhunch] could not start; the page is unaffected.', e)
    }
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}

/** The widget's host element with one thing in it (a study, or a notice), for the cases without the widget. */
function mountAlone(node: ReactNode) {
  const host = document.createElement('vibe-collab')
  host.id = 'vibe-collab'
  host.setAttribute('data-vibe-collab', VERSION)
  pinHostStyle(host)
  const go = () => {
    try {
      document.documentElement.appendChild(host)
      const root = host.attachShadow({ mode: 'open' })
      addStyles(root, CSS)
      const el = document.createElement('div')
      root.appendChild(el)
      createRoot(el).render(<Boundary>{node}</Boundary>)
    } catch (e) { console.warn('[ourhunch] could not start; the page is unaffected.', e) }
  }
  if (document.body) go()
  else document.addEventListener('DOMContentLoaded', go, { once: true })
}

