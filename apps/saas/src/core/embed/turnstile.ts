/**
 * Cloudflare Turnstile (CAPTCHA), for Supabase Auth's "CAPTCHA protection". Off until the build has a
 * site key (VITE_TURNSTILE_SITE_KEY): then every sign-up and sign-in sends a fresh token, which
 * Supabase checks with the secret key kept in its own settings (never here).
 *
 * Turnstile runs only on hostnames listed for the site key, so it runs on our own domain: in the
 * panel, and in the script's session frame (session.html), never on customers' sites.
 */
export const TURNSTILE_KEY = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim()

interface TurnstileApi {
  render(el: HTMLElement, o: Record<string, unknown>): string
  execute(id: string): void
  reset(id: string): void
  remove(id: string): void
}
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<TurnstileApi> | null = null
function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('captcha_unavailable')))
    s.onerror = () => { loading = null; reject(new Error('captcha_unavailable')) }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * A one-time token. `box` holds the widget: it stays empty and invisible unless Cloudflare needs the
 * person to click (then `show` is called, and `hide` once done).
 */
export async function turnstileToken(box: HTMLElement, show: () => void = () => {}, hide: () => void = () => {}): Promise<string> {
  if (!TURNSTILE_KEY) return ''
  const api = await load()
  return new Promise((resolve, reject) => {
    let id = ''
    const done = (f: () => void) => { window.clearTimeout(timer); hide(); try { api.remove(id) } catch { /* gone */ } f() }
    const timer = window.setTimeout(() => done(() => reject(new Error('captcha_timeout'))), 120_000)
    id = api.render(box, {
      sitekey: TURNSTILE_KEY,
      appearance: 'interaction-only',
      execution: 'render',
      callback: (t: string) => done(() => resolve(t)),
      'error-callback': () => done(() => reject(new Error('captcha_failed'))),
      'expired-callback': () => { try { api.reset(id) } catch { /* ignore */ } },
      'before-interactive-callback': show,
      'after-interactive-callback': hide,
    })
  })
}
