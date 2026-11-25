/**
 * The browser-only demo (a build without a server), on a site that isn't the panel's own address:
 * the panel on localhost:5173, the customer's app on localhost:3000. Browsers keep each address's
 * storage apart, so the panel's published settings, its one-time "Open my site" token and the
 * installation check can't meet in one localStorage. This bridge joins them through the hidden
 * frame the script already has on its own address (embed/session.html):
 *   site → frame  { op: 'sync', id, project, token? }   the project's settings, and the token taken once
 *   frame → site  { id, served, handoff }
 *   site → frame  { op: 'seen', project, page, version, shown, why }   the installation check
 * With a server none of this runs: the CDN file, review links and report_seen do it.
 */
import { lastSeen, rawServed, reportSeen, takeHandoff } from './config'

const ID = /^[\w-]{1,64}$/

/** In the frame (the panel's address): answers the site that embeds it. */
export function bridgeMain() {
  window.addEventListener('message', (e) => {
    const d = e.data as { vc?: number; op?: string; id?: number; project?: string; token?: string; page?: string; version?: string; shown?: boolean; why?: string } | null
    if (!d || d.vc !== 1 || e.source !== window.parent || typeof d.project !== 'string' || !ID.test(d.project)) return
    if (d.op === 'sync') {
      const handoff = typeof d.token === 'string' ? takeHandoff(d.project, d.token) : null
      window.parent.postMessage({ vc: 1, id: d.id, served: rawServed(d.project), handoff }, e.origin)
    } else if (d.op === 'seen') {
      let host = ''
      try { host = new URL(e.origin).host } catch { return }
      const before = lastSeen(d.project)
      // Like the server: at most one report every few seconds per site, unless what it says changed.
      if (before && before.host === host && before.shown === !!d.shown && Date.now() - new Date(before.at).getTime() < 5000) return
      reportSeen(d.project, { at: new Date().toISOString(), host, page: String(d.page ?? '/').slice(0, 200), version: String(d.version ?? '').slice(0, 20), shown: !!d.shown, why: String(d.why ?? '').slice(0, 200) })
    }
  })
  if (window.parent !== window) window.parent.postMessage({ vc: 1, op: 'ready' }, '*')
}

export interface Bridge {
  sync(project: string, token: string | null): Promise<{ served: unknown; handoff: { preview: boolean } | null } | null>
  seen(project: string, s: { page: string; version: string; shown: boolean; why: string }): void
}

/** On the site: a hidden frame on the script's own address, or null when it doesn't answer. */
export function openBridge(scriptSrc: string): Promise<Bridge | null> {
  let url: URL
  try { url = new URL('session.html', scriptSrc) } catch { return Promise.resolve(null) }
  return new Promise((resolve) => {
    const f = document.createElement('iframe')
    f.src = url.href
    f.title = 'ourhunch'
    f.setAttribute('aria-hidden', 'true')
    f.setAttribute('tabindex', '-1')
    f.style.cssText = 'position:fixed!important;width:1px!important;height:1px!important;opacity:0!important;border:0!important;pointer-events:none!important;left:0;top:0'
    const replies = new Map<number, (d: unknown) => void>()
    let seq = 0
    const fail = window.setTimeout(() => { f.remove(); resolve(null) }, 4000)
    window.addEventListener('message', (e) => {
      if (e.source !== f.contentWindow || e.origin !== url.origin || !e.data || e.data.vc !== 1) return
      if (e.data.op === 'ready') {
        window.clearTimeout(fail)
        const post = (m: object) => f.contentWindow?.postMessage({ vc: 1, ...m }, url.origin)
        resolve({
          sync: (project, token) => new Promise((ok) => {
            const id = ++seq
            replies.set(id, (d) => ok(d as { served: unknown; handoff: { preview: boolean } | null }))
            post({ op: 'sync', id, project, ...(token ? { token } : {}) })
            window.setTimeout(() => { if (replies.delete(id)) ok(null) }, 3000)
          }),
          seen: (project, s) => post({ op: 'seen', project, ...s }),
        })
      } else if (typeof e.data.id === 'number') {
        const r = replies.get(e.data.id)
        if (r) { replies.delete(e.data.id); r(e.data) }
      }
    })
    ;(document.body ?? document.documentElement).appendChild(f)
  })
}
