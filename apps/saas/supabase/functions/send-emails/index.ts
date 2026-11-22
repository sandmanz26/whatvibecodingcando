/**
 * Edge Function `send-emails` (Supabase, Deno): sends feedback notifications with Resend.
 *
 * Called by pg_cron (README "Email notifications"): every 5 minutes with {"mode":"instant"} and once a
 * day with {"mode":"daily"}. Asks email_due() what to send, sends one email per member per project,
 * then email_done() with the outbox rows it sent. Rows whose email failed stay pending and are tried
 * again on the next run.
 *
 * Secrets (Supabase → Edge Functions → Secrets; never in the repository or the app):
 *   RESEND_API_KEY      the Resend API key
 *   EMAIL_FROM          e.g. "Vibe Collab <notify@yourdomain.com>" (a domain verified in Resend)
 *   EMAIL_CRON_SECRET   a long random string; pg_cron sends it as "Authorization: Bearer …"
 *   APP_URL             e.g. https://whatvibecodingcando.vercel.app
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 * Deploy with: supabase functions deploy send-emails --no-verify-jwt
 */
import { render, type Due, type Email } from './render.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const SB_URL = env('SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

/** Compares secrets in constant time. */
function same(a: string, b: string) {
  if (!a || a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`)
  const t = await r.text()
  return (t ? JSON.parse(t) : null) as T
}

/** Resend's batch endpoint takes up to 100 emails a call. */
async function send(emails: Email[]) {
  for (let i = 0; i < emails.length; i += 100) {
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emails.slice(i, i + 100).map((e) => ({ from: env('EMAIL_FROM'), to: [e.to], subject: e.subject, html: e.html, text: e.text }))),
    })
    if (!r.ok) throw new Error(`resend: ${r.status} ${await r.text()}`)
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!same(req.headers.get('Authorization') ?? '', `Bearer ${env('EMAIL_CRON_SECRET')}`)) return new Response('unauthorized', { status: 401 })
  for (const k of ['RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env(k)) return new Response(`missing secret ${k}`, { status: 500 })
  const daily = ((await req.json().catch(() => ({}))) as { mode?: string }).mode === 'daily'

  const due = (await rpc<Due[] | null>('email_due', { p_daily: daily })) ?? []
  let sent = 0, failed = 0
  for (const d of due) {
    const emails = render(d, env('APP_URL'), daily)
    try {
      if (emails.length) await send(emails)
      await rpc('email_done', { p_ids: d.outbox_ids })
      sent += emails.length
    } catch (e) {
      failed++
      console.error(`project ${d.project_id}:`, (e as Error).message)
    }
  }
  return Response.json({ projects: due.length, emails: sent, failed })
})
