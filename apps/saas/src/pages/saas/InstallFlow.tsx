/**
 * The install journey, shared by onboarding (step 3) and the panel's Install page:
 *   ① paste the snippet (framework tabs) ② open your site from here (one-time team token)
 *   ③ visitors don't see it: only the team and invited reviewers.
 * Below it, the live install check: "Waiting for your site…" until the script reports, then
 * "Installed on <host>", or a troubleshooting card after two minutes. A report from a local dev
 * address that isn't in the project offers "Add this address" (one click: added and published).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, Plus, TriangleAlert, LifeBuoy } from 'lucide-react'
import { hostMatches, hostProblem, lastSeen, type Seen } from '../../core/embed/config'
import { cloud } from '../../saas/supabase'
import { installsOf, straysOf } from '../../saas/cloud'
import { draftOf, liveOf, openAsReviewer, siteTargets } from '../../saas/widget'
import { copyText } from '../../saas/snippet'
import type { Project } from '../../saas/account'
import { track, trackOnce, setPerson } from '../../lib/analytics'

type Toast = (t: string, k?: 'error') => void

export const GUIDES: { id: string; label: string; where: string; code?: (s: string) => string }[] = [
  { id: 'html', label: 'HTML', where: 'Paste it just before </body> on every page (or in your shared footer).' },
  { id: 'vite', label: 'React / Vue / Svelte (Vite)', where: 'Paste it into index.html at the project root, before </body>. One place covers every route.' },
  { id: 'next', label: 'Next.js', where: 'Add it to app/layout.tsx with next/script, inside <body>:', code: (s) => `import Script from 'next/script'\n\n<Script\n  src="${(s.match(/src="([^"]+)"/) ?? [])[1]}"\n${(s.match(/  data-[^\n]+/g) ?? []).map((x) => x.replace(/^\s+/, '  ')).join('\n')}\n  strategy="afterInteractive"\n/>` },
  { id: 'cms', label: 'WordPress / Webflow / Framer', where: 'Use the site’s “custom code” setting for the footer (Webflow: Site settings → Custom code → Footer; Framer: Site settings → General → End of <body>; WordPress: a header-and-footer plugin).' },
  { id: 'ai', label: 'Ask an AI assistant', where: 'Paste this into your AI coding assistant, opened in your project:', code: (s) => `Add this script tag to my site so it loads on every page, once (just before </body>, or the framework's equivalent such as next/script in the root layout). Don't change anything else.\n\n${s}` },
]

/** Opens one of the project's addresses with a one-time team token: the widget shows there for this browser. */
export function openSite(p: Project, url: string, toast: Toast) {
  if (!liveOf(p)) { toast('Press Update site in Widget first: your site has no settings yet.', 'error'); return }
  track('open_my_site')
  void openAsReviewer(p.id, url, false, true).then((ok) => { if (!ok) toast('Couldn’t make the one-time link. Try again.', 'error') })
}

/** The addresses to open, the one the script was last seen on first. */
function targetsOf(p: Project, seenHost?: string) {
  const t = siteTargets(p)
  const i = seenHost ? t.findIndex((x) => x.host === seenHost) : -1
  return i > 0 ? [t[i], ...t.slice(0, i), ...t.slice(i + 1)] : t
}

export function OpenSiteButtons({ project, toast, seenHost, primary = true }: { project: Project; toast: Toast; seenHost?: string; primary?: boolean }) {
  const t = targetsOf(project, seenHost)
  if (!t.length) return <span className="up-muted">Add your site’s address first (below, or in Widget → Website).</span>
  return (
    <span className="ih-open">
      <button type="button" className={`lp-btn ${primary ? 'primary' : ''}`} onClick={() => openSite(project, t[0].url, toast)}>Open my site <ExternalLink size={14} /></button>
      {t.slice(1, 4).map((x) => <button key={x.host} type="button" className="up-linkbtn" onClick={() => openSite(project, x.url, toast)}>or {x.host}</button>)}
    </span>
  )
}

/** The snippet, Copy, and the three steps beside it. */
export function InstallSteps({ project, code, copied, onCopy, toast }: { project: Project; code: string; copied: boolean; onCopy: () => void; toast: Toast }) {
  const [guide, setGuide] = useState('html')
  const g = GUIDES.find((x) => x.id === guide)!
  const copyGuide = async () => {
    if (!(await copyText(g.code!(code)))) { toast('Copy failed. Select the text and copy it by hand.', 'error'); return }
    if (g.id !== 'ai') onCopy()
    toast(g.id === 'ai' ? 'Prompt copied' : 'Code copied')
  }
  return (
    <div className="ih">
      <div className="ih-snippet">
        <pre className="up-code" aria-label="Your snippet">{code}</pre>
        <button type="button" className="lp-btn primary" onClick={onCopy}>{copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy snippet</>}</button>
      </div>
      <ol className="ih-steps">
        <li>
          <b>Paste it before <code>&lt;/body&gt;</code></b>
          <div className="up-tabs" role="tablist" aria-label="Your site is built with">{GUIDES.map((x) => <button key={x.id} type="button" role="tab" aria-selected={guide === x.id} onClick={() => setGuide(x.id)}>{x.label}</button>)}</div>
          <p className="up-muted">{g.where}</p>
          {g.code && <><pre className="up-code">{g.code(code)}</pre><button type="button" className="lp-btn sm" onClick={() => void copyGuide()}><Copy size={13} /> Copy</button></>}
        </li>
        <li>
          <b>Open your site from here</b>
          <p className="up-muted">This opens it with a one-time team link, so the widget appears for you in this browser.</p>
          <OpenSiteButtons project={project} toast={toast} />
        </li>
        <li>
          <b>Visitors won’t see anything</b>
          <p className="up-muted">Only your team and the reviewers you invite see it. That’s why opening your site directly shows nothing: the widget appears only in browsers opened from here or through a review link.</p>
        </li>
      </ol>
    </div>
  )
}

/** Polls while the tab is visible: every 3 s at first, slowing to 20 s; back to 3 s when the tab returns. */
function useVisiblePoll(fn: () => void, deps: unknown[], first = 3000, max = 20000) {
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    let wait = first
    let t = 0
    const tick = () => { if (document.visibilityState === 'visible') f.current(); wait = Math.min(Math.round(wait * 1.5), max); t = window.setTimeout(tick, wait) }
    const onVis = () => { if (document.visibilityState === 'visible') { window.clearTimeout(t); wait = first; tick() } }
    tick()
    document.addEventListener('visibilitychange', onVis)
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

const listed = (p: Project, host: string) => [...draftOf(p).envs, ...(liveOf(p)?.config.envs ?? [])].some((e) => hostMatches(e.host, host) || hostMatches(e.host, host.split(':')[0]))
/** Our own demo site (the panel's address) reports too: that isn't an install on the customer's site. */
const isOurs = (host: string) => host === window.location.host

/** What the script reported: its latest report on one of the project's places, and local addresses outside them. */
/** slow: for the banner on every panel page (every 30 s to 2 min) rather than the install check. */
export function useInstallReports(p: Project | null, slow = false) {
  const [seen, setSeen] = useState<Seen | null>(null)
  const [strays, setStrays] = useState<string[]>([])
  useVisiblePoll(() => {
    if (!p) return
    if (cloud) {
      void installsOf(p.id).then((l) => setSeen(l.find((x) => !isOurs(x.host)) ?? null)).catch(() => { /* next poll */ })
      void straysOf(p.id).then((h) => setStrays(h.filter((x) => !listed(p, x))))
    } else {
      const s = lastSeen(p.id)
      const real = s && !isOurs(s.host) ? s : null
      setSeen(real && listed(p, real.host) ? real : null)
      setStrays(real && !listed(p, real.host) ? [real.host] : [])
    }
  }, [p?.id, JSON.stringify(p ? draftOf(p).envs : null), liveOf(p ?? ({} as Project))?.version], slow ? 30000 : 3000, slow ? 120000 : 20000)
  useEffect(() => {
    if (!p || !seen) return
    trackOnce('install_detected', p.id, { shown: seen.shown })
    setPerson({ has_installed: true })
  }, [p?.id, !!seen]) // eslint-disable-line react-hooks/exhaustive-deps
  return { seen, strays }
}

/** Every panel page except Install: the script ran on a local address that isn't in the project. */
export function StrayBanner({ project, onAdd }: { project: Project; onAdd: (host: string) => boolean }) {
  const { strays } = useInstallReports(project, true)
  if (!strays.length) return null
  const h = strays[0]
  return <p className="up-warn"><TriangleAlert size={14} /> ourhunch saw your script on <code>{h}</code>, which isn’t in this project. <button type="button" className="lp-btn sm" onClick={() => onAdd(h)}><Plus size={13} /> Add it</button></p>
}

const ago = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000
  return m < 1 ? 'just now' : m < 60 ? `${Math.floor(m)} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * The live check. `since`: when the snippet was copied (the wait starts then); `onAdd` adds an
 * address and publishes it (true when done); `next`: what to do once it is installed.
 */
export function InstallCheck({ project, since, onAdd, next, toast }: { project: Project; since: number | null; onAdd: (host: string) => boolean; next?: ReactNode; toast: Toast }) {
  const { seen, strays } = useInstallReports(project)
  const [now, setNow] = useState(Date.now())
  const [help, setHelp] = useState(false)
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t) }, [])
  const late = !seen && since !== null && now - since > 120_000
  const showHelp = !seen && (help || late)
  useEffect(() => { if (showHelp) track('install_help_viewed', { late }) }, [showHelp]) // eslint-disable-line react-hooks/exhaustive-deps
  const add = (h: string) => { if (onAdd(h)) toast(`Added ${h} and updated your site`) }

  return (
    <section className="ih-check" aria-live="polite">
      {strays.map((h) => (
        <p key={h} className="up-warn"><TriangleAlert size={14} /> ourhunch saw your script on <code>{h}</code>, which isn’t in this project. <button type="button" className="lp-btn sm" onClick={() => add(h)}><Plus size={13} /> Add this address</button></p>
      ))}
      {seen ? (
        <>
          <p className="up-check ok"><CheckCircle2 size={15} /> <b>Installed on {seen.host}</b> <span className="up-muted">· {ago(seen.at)}</span></p>
          {!seen.shown && <p className="up-muted">Plain visits there show nothing, as planned. Open it from here to see the widget.</p>}
          <div className="lp-row ih-next"><OpenSiteButtons project={project} toast={toast} seenHost={seen.host} />{next}</div>
        </>
      ) : since !== null ? (
        <p className="ih-wait"><Loader2 size={15} className="ih-spin" /> <b>Waiting for your site…</b> <span className="up-muted">Load any page of your site that has the snippet.</span></p>
      ) : (
        <p className="up-muted">After you copy the snippet and load your site, this shows when the script is seen.</p>
      )}
      {!seen && !showHelp && <button type="button" className="up-linkbtn" onClick={() => setHelp(true)}><LifeBuoy size={13} /> Not showing up?</button>}
      {showHelp && <Troubleshoot project={project} onAdd={add} />}
    </section>
  )
}

function Troubleshoot({ project, onAdd }: { project: Project; onAdd: (h: string) => void }) {
  const [host, setHost] = useState('')
  const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const problem = h ? hostProblem(h) : ''
  const envs = (liveOf(project)?.config ?? draftOf(project)).envs
  const scriptOrigin = (() => { try { return new URL('embed/vibe.js', window.location.href.split('#')[0]).origin } catch { return '' } })()
  const api = cloud ? (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '' : ''
  return (
    <div className="up-card ih-help">
      <h3>Not seen yet? Check these</h3>
      <ol>
        <li><b>The snippet is in the page you opened.</b> In your browser, view the page source (or DevTools → Elements) and search for <code>data-project="{project.id}"</code>. Restart your dev server if it caches HTML.</li>
        <li><b>The project id matches.</b> It must be exactly <code>{project.id}</code>.</li>
        <li><b>The address is in this project.</b> Now: {envs.length ? envs.map((e, i) => <span key={e.id}>{i ? ', ' : ''}<code>{e.host}</code>{e.on ? '' : ' (off)'}</span>) : <i>none</i>}.
          <form className="ih-add" onSubmit={(e) => { e.preventDefault(); if (h && !problem) { onAdd(h); setHost('') } }}>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="e.g. localhost:3001" aria-label="Address to add" aria-invalid={!!problem} />
            <button type="submit" className="lp-btn sm" disabled={!h || !!problem}><Plus size={13} /> Add</button>
          </form>
          {problem && <span className="lp-error">{problem}</span>}
        </li>
        <li><b>Your site’s Content-Security-Policy allows us.</b> If it sends one, add <code>script-src {scriptOrigin}</code> and <code>frame-src {scriptOrigin}</code>{api && <>, plus <code>connect-src {api}</code></>}.</li>
        <li><b>No ad-blocker or privacy extension is blocking it.</b> Try a private window without extensions. The browser console shows lines starting with <code>[ourhunch]</code> that say why.</li>
      </ol>
    </div>
  )
}
