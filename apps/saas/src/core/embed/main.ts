/**
 * The installable script's loader: dist/embed/vibe.js, the one tag customers put on their site.
 *
 * Most people who load a customer's page are plain visitors, who never see the widget (by default
 * only reviewers do). So this part is small: it reads the published settings (a cached CDN file) and
 * decides whether this browser needs the widget at all. Only then does it load the app beside it
 * (vibe-app.js: React, comments, tools, studies). It needs the app when:
 * - the address carries a review link, a study link or a tool hint (#vibe_t, #vibe_r, #vibe_tool);
 * - this browser is a reviewer of the project, or is taking part in one of its studies;
 * - the widget is open to everyone (Comments for every visitor);
 * - the project has no published settings yet (older installs: options in the snippet);
 * - the build has no server (the browser-only demo);
 * - it is our own session frame (session.html).
 * A plain visitor gets the sampled installation check, and nothing else.
 */
import * as server from './server'
import { envFor } from './config'
import { NS } from './store'
import { VERSION } from './version'

declare global { interface Window { __vibeCollabLoader?: boolean; __vibeCollabApp?: { boot: (s: HTMLScriptElement | null) => Promise<void> } } }

const script = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[src*="vibe.js"]')

/** Adds the app beside this script (same place, same version) and starts it. */
function app(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.__vibeCollabApp) { void window.__vibeCollabApp.boot(script).then(resolve, reject); return }
    const s = document.createElement('script')
    const url = new URL('vibe-app.js', script!.src).href
    // Sites that enforce Trusted Types only take a script address through a named policy. Ours
    // passes exactly one address: the app beside this file. If the site's policy list leaves our
    // name out, say how to allow it.
    const tt = (window as { trustedTypes?: { createPolicy: (n: string, r: { createScriptURL: (u: string) => string }) => { createScriptURL: (u: string) => unknown } } }).trustedTypes
    let src: unknown = url
    if (tt) {
      try { src = tt.createPolicy('vibe-collab', { createScriptURL: (u) => { if (u !== url) throw new Error('unexpected address'); return u } }).createScriptURL(url) }
      catch { reject(new Error('this site’s Trusted Types policy doesn’t allow “vibe-collab”; add it to trusted-types in the Content-Security-Policy')); return }
    }
    ;(s as unknown as { src: unknown }).src = src
    s.async = true
    if (script!.nonce) s.nonce = script!.nonce
    s.setAttribute('data-vibe-collab-app', '')
    s.onload = () => { const a = window.__vibeCollabApp; if (a) void a.boot(script).then(resolve, reject); else reject(new Error('app missing')) }
    s.onerror = () => reject(new Error('the app couldn’t load'))
    document.head.appendChild(s)
  })
}

async function main() {
  if (!script?.src) return
  if (script.dataset.frame !== undefined) return app()
  if (window.__vibeCollabLoader) { console.warn('[Vibe Collab] the script is on this page twice; the second copy does nothing.'); return }
  window.__vibeCollabLoader = true
  const d = script.dataset
  if (d.disabled !== undefined && d.disabled !== 'false') return
  if (!server.hasServer) return app()
  const project = /^[\w-]{1,64}$/.test(d.project ?? '') ? d.project! : (window.location.hostname || 'local').replace(/[^\w-]/g, '-')
  if (/(?:^#|&)vibe_(t|r|tool)=/.test(window.location.hash)) return app()
  const has = (store: () => Storage, k: string) => { try { return store().getItem(k) !== null } catch { return false } }
  if (has(() => localStorage, `${NS}reviewer:${project}`) || has(() => localStorage, `${NS}session:${project}`) || has(() => sessionStorage, `${NS}run:${project}`)) return app()
  const file = await server.fetchSettings(project)
  if (file.gone) { console.info('[Vibe Collab] this project was deleted; nothing to show.'); return }
  if (!file.live) return app()
  const c = file.live.config
  if (c.on && c.audience === 'everyone' && c.modules.comments) return app()
  // A plain visitor: nothing shows. Why, for the console and the installation check (sampled).
  const env = envFor(c, window.location.host, project) ?? envFor(c, window.location.hostname, project)
  const why = !c.on ? 'The widget is switched off for this project.'
    : !env ? `${window.location.hostname} isn’t one of this project’s environments (Widget → Website).`
      : !env.on ? `The widget is off for ${window.location.hostname} (Widget → Website).`
        : 'Only reviewers see it; open the site through a review link.'
  console.info(`[Vibe Collab] not shown: ${why}`)
  server.reportSeen(project, VERSION, false, why)
}

main().catch((e) => console.warn('[Vibe Collab] could not start; the page is unaffected.', e))
