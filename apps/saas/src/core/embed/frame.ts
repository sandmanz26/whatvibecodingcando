/**
 * The session frame: /embed/session.html, on our own domain, loaded hidden by the script on a
 * customer's site. It makes and keeps the reviewer's anonymous Supabase session, so:
 * - CAPTCHA (Turnstile) runs on our domain, where its site key works;
 * - the refresh token stays in our domain's storage (partitioned per site by the browser), out of
 *   reach of the customer's page; the page gets only the short-lived access token.
 *
 * Database calls are still made by the page itself, so the server keeps checking the page's real
 * Origin. The frame answers only its parent window, and only to the origin that asked. Sessions are
 * kept per asking origin too: even a browser that doesn't partition frame storage by site never
 * hands one site's session to another.
 *
 * Protocol (postMessage, all with vc: 1):
 *   frame → parent  { op: 'ready' }
 *   parent → frame  { op: 'session', id, create, migrate? }   migrate: a refresh token the page kept before
 *   frame → parent  { id, ok, access_token, expires_at, refresh_token? }   refresh_token only when this frame can't store it
 *   frame → parent  { op: 'show' | 'hide' }   Turnstile needs a click: show the frame
 */
import { TURNSTILE_KEY, turnstileToken } from './turnstile'

interface Kept { access_token: string; refresh_token: string; expires_at: number }
const KEY = 'vc-frame:auth'

export function frameMain(url: string, key: string) {
  const store = {
    ok: (() => { try { localStorage.setItem(`${KEY}:t`, '1'); localStorage.removeItem(`${KEY}:t`); return true } catch { return false } })(),
    get(o: string): Kept | null { try { return JSON.parse(localStorage.getItem(`${KEY}:${o}`) ?? 'null') } catch { return null } },
    set(o: string, k: Kept | null) { try { if (k) localStorage.setItem(`${KEY}:${o}`, JSON.stringify(k)); else localStorage.removeItem(`${KEY}:${o}`) } catch { /* not kept */ } },
  }
  const memory = new Map<string, Kept>()
  const get = (o: string) => (store.ok ? store.get(o) : memory.get(o) ?? null)
  const set = (o: string, k: Kept | null) => { if (k) memory.set(o, k); else memory.delete(o); if (store.ok) store.set(o, k) }

  const auth = async (path: string, body: unknown): Promise<Kept> => {
    const r = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = String(j.msg ?? j.message ?? j.error_description ?? r.status)
      throw new Error(/anonymous/i.test(msg) ? 'anonymous_disabled' : /captcha/i.test(msg) ? 'captcha_failed' : msg)
    }
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600) }
  }
  const box = document.getElementById('ts') ?? document.body
  const post = (m: Record<string, unknown>, origin: string) => window.parent.postMessage({ vc: 1, ...m }, origin)

  let busy: Promise<Kept | null> = Promise.resolve(null)
  const session = (create: boolean, migrate: string | undefined, origin: string) => {
    busy = busy.catch(() => null).then(async () => {
      let k = get(origin)
      if (!k && migrate) { try { k = await auth('token?grant_type=refresh_token', { refresh_token: migrate }); set(origin, k) } catch { k = null } }
      if (k && k.expires_at * 1000 - Date.now() > 60_000) return k
      if (k) { try { k = await auth('token?grant_type=refresh_token', { refresh_token: k.refresh_token }); set(origin, k); return k } catch { set(origin, null) } }
      if (!create) return null
      const captcha = TURNSTILE_KEY ? await turnstileToken(box, () => post({ op: 'show' }, origin), () => post({ op: 'hide' }, origin)) : ''
      k = await auth('signup', captcha ? { data: {}, gotrue_meta_security: { captcha_token: captcha } } : { data: {} })
      set(origin, k)
      return k
    })
    return busy
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || e.data.vc !== 1 || e.data.op !== 'session') return
    const { id, create, migrate } = e.data as { id: number; create: boolean; migrate?: string }
    void session(!!create, typeof migrate === 'string' ? migrate : undefined, e.origin).then(
      (k) => post(k ? { id, ok: true, access_token: k.access_token, expires_at: k.expires_at, ...(store.ok ? {} : { refresh_token: k.refresh_token }) } : { id, ok: true }, e.origin),
      (err: Error) => post({ id, ok: false, error: err.message }, e.origin),
    )
  })
  // The parent may be any site: it learns only that the frame is there.
  if (window.parent !== window) window.parent.postMessage({ vc: 1, op: 'ready', persist: store.ok }, '*')
}
