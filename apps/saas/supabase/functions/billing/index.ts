/**
 * Edge Function `billing` (Supabase, Deno): checkout, customer portal and the provider's webhook.
 * Routes and rules: handler.ts. Setup: docs/BILLING.md.
 *
 * Secrets (Supabase → Edge Functions → Secrets; never in the repository or the app):
 *   BILLING_ENABLED         "true" to allow checkout and portal (also needs app_settings.billing_enabled)
 *   BILLING_PROVIDER        "paddle"
 *   BILLING_SANDBOX         "true" while testing with Paddle's sandbox
 *   BILLING_API_KEY         the provider's server API key
 *   BILLING_WEBHOOK_SECRET  the webhook destination's secret
 *   BILLING_PRICE_FOUNDING  price id of Pro at $2/site/month (founding)
 *   BILLING_PRICE_NORMAL    price id of Pro at $4.80/site/month
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
 * Deploy with: supabase functions deploy billing --no-verify-jwt (the webhook has no user token;
 * checkout and portal check the user's token themselves).
 */
import { handle } from './handler.ts'
import { paddle } from './paddle.ts'
import type { BillingProvider } from './provider.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const SB_URL = env('SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

function providerFor(): BillingProvider | null {
  if (env('BILLING_PROVIDER') === 'paddle' && env('BILLING_API_KEY') && env('BILLING_WEBHOOK_SECRET')) {
    return paddle({ apiKey: env('BILLING_API_KEY'), webhookSecret: env('BILLING_WEBHOOK_SECRET'), sandbox: env('BILLING_SANDBOX') === 'true' })
  }
  return null
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`${fn}: ${r.status}`)
  const t = await r.text()
  return (t ? JSON.parse(t) : null) as T
}

async function user(authorization: string): Promise<{ id: string } | null> {
  if (!/^Bearer .{20,}$/.test(authorization)) return null
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY') || SB_KEY, Authorization: authorization } })
  if (!r.ok) return null
  const u = await r.json() as { id?: string; is_anonymous?: boolean }
  return u.id && !u.is_anonymous ? { id: u.id } : null
}

Deno.serve(async (req) => {
  try {
    return await handle(req, { env, provider: providerFor(), rpc, user })
  } catch (e) {
    console.error('billing', (e as Error).message)
    return Response.json({ error: 'server_error' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
})
