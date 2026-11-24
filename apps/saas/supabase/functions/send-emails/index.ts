/**
 * Edge Function `send-emails` (Supabase, Deno): every email ourhunch sends itself, through Resend.
 *
 * Called by pg_cron (README "Email notifications") with a mode:
 *   {"mode":"instant"}    every 5 minutes: activity emails of 'instant' projects (and approvals), plus welcome emails
 *   {"mode":"daily"}      once a day: the daily summary of 'daily' projects
 *   {"mode":"lifecycle"}  once a day: onboarding emails (day 1, day 3, day 7; welcome if one was missed)
 *   {"mode":"weekly"}     Mondays: the weekly summary for account owners
 * Rows whose email failed stay pending and are tried again on the next run.
 *
 * Unsubscribe (no cron secret; the token is the only key): POST ?unsubscribe=<token> (the
 * List-Unsubscribe-Post one-click request from mail apps) or POST {"unsubscribe":"<token>"} (the
 * app's #/unsubscribe page). It turns "Tips and product updates" off for that account.
 *
 * Secrets (Supabase → Edge Functions → Secrets; never in the repository or the app):
 *   RESEND_API_KEY        the Resend API key
 *   EMAIL_FROM            e.g. "ourhunch <hello@ourhunch.com>" (a domain verified in Resend)
 *   EMAIL_CRON_SECRET     a long random string; pg_cron sends it as "Authorization: Bearer …"
 *   APP_URL               https://ourhunch.com (every link in the emails starts here)
 *   EMAIL_REPLY_TO        optional: where replies to the welcome email go
 *   EMAIL_FOUNDER_NAME    optional: signs the welcome email (otherwise "The ourhunch team")
 *   EMAIL_POSTAL_ADDRESS  optional: the business postal address in every footer
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 * Deploy with: supabase functions deploy send-emails --no-verify-jwt
 */
import { render, renderLifecycle, renderWeekly, type Brand, type Due, type Email, type LifecycleDue, type WeeklyDue } from './render.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const SB_URL = env('SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

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
      body: JSON.stringify(emails.slice(i, i + 100).map((e) => ({
        from: env('EMAIL_FROM'), to: [e.to], subject: e.subject, html: e.html, text: e.text,
        ...(e.headers ? { headers: e.headers } : {}), ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      }))),
    })
    if (!r.ok) throw new Error(`resend: ${r.status} ${await r.text()}`)
  }
}

async function unsubscribe(req: Request, url: URL): Promise<Response> {
  let token = url.searchParams.get('unsubscribe') ?? ''
  if (!token && (req.headers.get('Content-Type') ?? '').includes('application/json')) {
    token = String(((await req.json().catch(() => ({}))) as { unsubscribe?: unknown }).unsubscribe ?? '')
  }
  if (!/^[0-9a-f]{64}$/.test(token)) return Response.json({ ok: false }, { status: 400, headers: CORS })
  const ok = await rpc<boolean>('email_unsubscribe', { p_token: token })
  return Response.json({ ok: !!ok }, { headers: CORS })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const url = new URL(req.url)
  if (url.searchParams.has('unsubscribe')) return unsubscribe(req, url)
  const auth = req.headers.get('Authorization') ?? ''
  const cron = same(auth, `Bearer ${env('EMAIL_CRON_SECRET')}`)
  if (!cron) {
    // The app's unsubscribe page (signed in or not: the token decides).
    if ((req.headers.get('Content-Type') ?? '').includes('application/json')) {
      const body = (await req.clone().json().catch(() => ({}))) as { unsubscribe?: unknown }
      if (typeof body.unsubscribe === 'string') return unsubscribe(req, url)
    }
    return new Response('unauthorized', { status: 401 })
  }
  for (const k of ['RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env(k)) return new Response(`missing secret ${k}`, { status: 500 })
  const mode = ((await req.json().catch(() => ({}))) as { mode?: string }).mode ?? 'instant'
  const brand: Brand = {
    appUrl: env('APP_URL'), postal: env('EMAIL_POSTAL_ADDRESS') || undefined, founder: env('EMAIL_FOUNDER_NAME') || undefined,
    replyTo: env('EMAIL_REPLY_TO') || undefined, unsubscribeEndpoint: `${SB_URL.replace(/\/$/, '')}/functions/v1/send-emails`,
  }
  let sent = 0, failed = 0, batches = 0

  // Activity emails, grouped per project.
  if (mode === 'instant' || mode === 'daily') {
    const daily = mode === 'daily'
    const due = (await rpc<Due[] | null>('email_due', { p_daily: daily })) ?? []
    batches += due.length
    for (const d of due) {
      const emails = render(d, brand, daily)
      try {
        if (emails.length) await send(emails)
        await rpc('email_done', { p_ids: d.outbox_ids })
        sent += emails.length
      } catch (e) {
        failed++
        console.error(`project ${d.project_id}:`, (e as Error).message)
      }
    }
  }

  // Lifecycle emails (welcome every 5 minutes; the rest daily) and the weekly summary: one per person.
  const people = async (list: { user_id: string; kind: string; email: Email }[]) => {
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100)
      try {
        await send(chunk.map((x) => x.email))
        await rpc('email_sent_mark', { p_items: chunk.map((x) => ({ user_id: x.user_id, kind: x.kind })) })
        sent += chunk.length
      } catch (e) {
        failed++
        console.error(`people:`, (e as Error).message)
      }
    }
  }
  if (mode === 'instant' || mode === 'lifecycle') {
    const due = (await rpc<LifecycleDue[] | null>('email_lifecycle_due', { p_welcome_only: mode === 'instant' })) ?? []
    batches += due.length
    await people(due.map((x) => ({ user_id: x.user_id, kind: x.kind, email: renderLifecycle(x, brand) })))
  }
  if (mode === 'weekly') {
    const due = (await rpc<WeeklyDue[] | null>('email_weekly_due', {})) ?? []
    batches += due.length
    await people(due.map((x) => ({ user_id: x.user_id, kind: x.kind, email: renderWeekly(x, brand) })))
  }
  return Response.json({ mode, batches, emails: sent, failed })
})
