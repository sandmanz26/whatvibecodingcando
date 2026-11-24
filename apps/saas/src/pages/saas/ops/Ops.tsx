// Internal ops panel at /app#/admin: founder only, with its own sign-in (saas/ops.ts), apart from the customer panel.
// All data comes from admin-only database functions (saas/ops.ts); no comment text, no PostHog events.
import { useCallback, useEffect, useState } from 'react'
import { LogOut, RefreshCw, X } from 'lucide-react'
import { cloud } from '../../../saas/supabase'
import { Modal, Toasts } from '../../../components/ui'
import { useStore } from '../../../store/store'
import {
  PLANS, PLAN_LABEL, amAdmin, opsEmail, opsSignIn, opsSignOut, opsAudit, opsDaily, opsFunnel, opsOverview, opsSetPlan, opsUserDetail, opsUsers,
  type AuditRow, type Day, type Funnel, type OpsUser, type Overview, type Plan, type UserDetail,
} from '../../../saas/ops'

const PAGE = 50
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en')
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')
const when = (s: string) => new Date(s).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Ops() {
  const [state, setState] = useState<'checking' | 'out' | 'in'>(cloud ? 'checking' : 'out')
  useEffect(() => {
    document.title = 'Ops · ourhunch'
    if (!cloud) return
    let live = true
    void amAdmin().then((x) => { if (live) setState(x ? 'in' : 'out') }).catch(() => { if (live) setState('out') })
    return () => { live = false }
  }, [])
  if (!cloud) return <Plain title="Ops needs the server" text="This build runs the browser demo, which has no accounts to look at." />
  if (state === 'checking') return <Plain title="" text="Loading…" />
  if (state === 'out') return <OpsLogin onIn={() => setState('in')} />
  return <OpsPanel onOut={() => setState('out')} />
}

function Plain({ title, text }: { title: string; text: string }) {
  return <div className="up ops-plain"><main className="up-main"><div className="up-page">{title && <h1>{title}</h1>}<p className="up-muted">{text}</p></div></main></div>
}

/** Its own sign-in: email and password, a session only for this tab. */
function OpsLogin({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    if (busy) return
    if (!email.trim() || !pw) { setError('Enter your email and password.'); return }
    setBusy(true); setError('')
    const e = await opsSignIn(email.trim(), pw)
    setBusy(false); setPw('')
    if (e) setError(e); else onIn()
  }
  return (
    <div className="lp ops-login">
      <form className="lp-auth-card ops-login-card" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <p className="ops-login-tag">ourhunch · internal</p>
        <h1>Ops sign-in</h1>
        <p className="lp-muted">For the ourhunch team only. This session ends when you close the tab.</p>
        <label className="lp-field">Email<input id="ops-email" type="email" autoFocus autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></label>
        <label className="lp-field">Password<input id="ops-password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={200} /></label>
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

function OpsPanel({ onOut }: { onOut: () => void }) {
  const [me, setMe] = useState<string | null>(null)
  useEffect(() => { void opsEmail().then(setMe) }, [])
  const { toast } = useStore()
  const [days, setDays] = useState(30)
  const [ov, setOv] = useState<Overview | null>(null)
  const [daily, setDaily] = useState<Day[] | null>(null)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [audit, setAudit] = useState<AuditRow[] | null>(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, d, f, a] = await Promise.all([opsOverview(), opsDaily(days), opsFunnel(days), opsAudit(30)])
      setOv(o); setDaily(d); setFunnel(f); setAudit(a); setErr('')
    } catch (e) { setErr((e as Error).message) } finally { setLoading(false) }
  }, [days])
  useEffect(() => { void load() }, [load, tick])
  // Refresh every 2 minutes, only while the tab is visible.
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setTick((x) => x + 1) }, 120_000)
    return () => window.clearInterval(t)
  }, [])
  const refresh = () => setTick((x) => x + 1)
  return (
    <div className="up ops">
      <main className="up-main">
        <div className="up-page ops-page">
          <div className="up-head">
            <div><h1>Ops</h1><p>Internal. Everything here is read through admin-only functions; plan changes are logged.</p></div>
            <div className="ops-actions">
              <label className="up-muted">Window <select className="up-select" value={days} onChange={(e) => setDays(+e.target.value)}>{[7, 30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
              <button className="lp-btn sm" onClick={refresh} disabled={loading}><RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}</button>
              {me && <span className="up-muted ops-me">{me}</span>}
              <button className="lp-btn sm ghost" onClick={async () => { await opsSignOut(); onOut() }}><LogOut size={14} /> Sign out</button>
            </div>
          </div>
          {err && <div className="up-warn">Couldn’t load: {err}</div>}
          {ov && <Kpis ov={ov} />}
          <div className="ops-two">
            <section className="up-card"><h2>Signups and new projects per day</h2>{daily ? <DailyChart rows={daily} /> : <p className="up-muted">Loading…</p>}</section>
            <section className="up-card"><h2>Funnel, last {days} days</h2>{funnel ? <FunnelBars f={funnel} /> : <p className="up-muted">Loading…</p>}
              {ov && <Founding n={ov.plans.founding ?? 0} limit={ov.founding_limit} />}</section>
          </div>
          <Users onChanged={() => { refresh(); toast('Plan saved') }} />
          <section className="up-card"><h2>Recent admin actions</h2>{audit ? <Audit rows={audit} /> : <p className="up-muted">Loading…</p>}</section>
        </div>
      </main>
      <Toasts />
    </div>
  )
}

function Kpis({ ov }: { ov: Overview }) {
  const tiles: [string, number, string?][] = [
    ['Users', ov.users_total, `+${fmt(ov.users_24h)} 24h · +${fmt(ov.users_7d)} 7d · +${fmt(ov.users_30d)} 30d`],
    ['Signed in, 7 days', ov.active_7d],
    ['Sites (projects)', ov.projects_total],
    ['Script seen', ov.sites_seen, `${fmt(ov.sites_shown)} showing the widget`],
    ['Comments', ov.comments_total, `+${fmt(ov.comments_7d)} in 7 days`],
    ['Studies / runs, 7 days', ov.studies_7d, `${fmt(ov.runs_7d)} runs`],
    ['Reviewers', ov.reviewers_total],
    ['Email outbox', ov.email_pending, ov.email_stuck ? `${fmt(ov.email_stuck)} waiting over 1 hour` : 'none stuck'],
  ]
  return (
    <div className="ops-kpis">
      {tiles.map(([label, n, sub]) => (
        <div key={label} className={`ops-kpi ${label === 'Email outbox' && ov.email_stuck ? 'warn' : ''}`}><span>{label}</span><b>{fmt(n)}</b>{sub && <small>{sub}</small>}</div>
      ))}
    </div>
  )
}

/** Two series over days: a simple inline SVG line chart with a zero-based axis and labelled ticks. */
function DailyChart({ rows }: { rows: Day[] }) {
  const W = 560, H = 200, L = 34, R = 10, T = 10, B = 26
  const max = Math.max(1, ...rows.map((r) => Math.max(r.signups, r.projects)))
  const step = max <= 4 ? 1 : Math.ceil(max / 4)
  const top = step * Math.ceil(max / step)
  const x = (i: number) => L + (rows.length <= 1 ? 0 : (i * (W - L - R)) / (rows.length - 1))
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const path = (k: 'signups' | 'projects') => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join('')
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  const every = Math.max(1, Math.ceil(rows.length / 6))
  const total = (k: 'signups' | 'projects') => rows.reduce((a, r) => a + r[k], 0)
  return (
    <div>
      <div className="ops-legend"><span><i className="s1" /> Signups ({fmt(total('signups'))})</span><span><i className="s2" /> New projects ({fmt(total('projects'))})</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ops-chart" role="img" aria-label={`Signups and new projects per day over ${rows.length} days`}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
        {rows.map((r, i) => (i % every === 0 || i === rows.length - 1) && <text key={r.day} x={x(i)} y={H - 8} textAnchor="middle">{new Date(r.day + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}</text>)}
        <path d={path('projects')} className="l2" />
        <path d={path('signups')} className="l1" />
        {rows.map((r, i) => <rect key={r.day} x={x(i) - (W - L - R) / rows.length / 2} y={T} width={(W - L - R) / rows.length} height={H - T - B} className="hit"><title>{`${r.day}: ${r.signups} signups, ${r.projects} projects`}</title></rect>)}
      </svg>
    </div>
  )
}

function FunnelBars({ f }: { f: Funnel }) {
  const steps: [string, number][] = [['Signed up', f.signed_up], ['Made a project', f.onboarded], ['Script seen on a site', f.installed], ['Got a first comment', f.commented]]
  const base = Math.max(1, f.signed_up)
  return (
    <div className="ops-funnel">
      {steps.map(([label, n], i) => {
        const pct = Math.round((n / base) * 100)
        return (
          <div key={label} className="ops-fstep">
            <div className="ops-frow"><span>{label}</span><b>{fmt(n)}{i > 0 && <small> · {f.signed_up ? `${pct}%` : '—'}</small>}</b></div>
            <div className="ops-fbar" aria-hidden><i style={{ width: `${f.signed_up ? (n / base) * 100 : 0}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function Founding({ n, limit }: { n: number; limit: number }) {
  return (
    <div className="ops-founding">
      <div className="ops-frow"><span>Founding seats</span><b>{fmt(n)} / {fmt(limit)}</b></div>
      <div className="ops-fbar" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={n} aria-label="Founding seats used"><i style={{ width: `${Math.min(100, (n / limit) * 100)}%` }} /></div>
    </div>
  )
}

function Users({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ total: number; rows: OpsUser[] } | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [planFor, setPlanFor] = useState<OpsUser | null>(null)
  const [n, setN] = useState(0)
  useEffect(() => { const t = window.setTimeout(() => { setSearch(q.trim()); setOffset(0) }, 300); return () => window.clearTimeout(t) }, [q])
  useEffect(() => {
    let live = true
    void opsUsers(search, PAGE, offset).then((d) => { if (live) { setData(d); setErr('') } }).catch((e) => { if (live) setErr((e as Error).message) })
    return () => { live = false }
  }, [search, offset, n])
  return (
    <section className="up-card">
      <div className="ops-row"><h2>Users{data ? ` (${fmt(data.total)})` : ''}</h2><input className="up-search grow" type="search" placeholder="Search by email or user id" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></div>
      {err && <div className="up-warn">{err}</div>}
      <div className="ops-tablewrap">
        <table className="ops-table">
          <thead><tr><th>Email</th><th>Signed up</th><th>Last sign-in</th><th>Via</th><th className="num">Projects</th><th className="num">Comments</th><th>Plan</th><th /></tr></thead>
          <tbody>
            {data?.rows.map((u) => (
              <tr key={u.id}>
                <td><button className="ops-link" onClick={() => setOpen(u.id)}>{u.email ?? u.id}</button></td>
                <td>{date(u.created_at)}</td><td>{date(u.last_sign_in_at)}</td><td>{u.provider}</td>
                <td className="num">{fmt(u.projects)}</td><td className="num">{fmt(u.comments)}</td>
                <td><span className={`up-badge plan-${u.plan}`}>{PLAN_LABEL[u.plan] ?? u.plan}</span></td>
                <td><button className="lp-btn sm" onClick={() => setPlanFor(u)}>Set plan</button></td>
              </tr>
            ))}
            {data && !data.rows.length && <tr><td colSpan={8} className="up-muted">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.total > PAGE && (
        <div className="ops-row">
          <span className="up-muted">{fmt(offset + 1)}–{fmt(Math.min(offset + PAGE, data.total))} of {fmt(data.total)}</span>
          <span className="lp-grow" />
          <button className="lp-btn sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
          <button className="lp-btn sm" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
        </div>
      )}
      {open && <Drawer id={open} onClose={() => setOpen(null)} />}
      {planFor && <SetPlan user={planFor} onClose={() => setPlanFor(null)} onSaved={() => { setPlanFor(null); setN((x) => x + 1); onChanged() }} />}
    </section>
  )
}

function SetPlan({ user, onClose, onSaved }: { user: OpsUser; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore()
  const [plan, setPlan] = useState<Plan>(user.plan)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await opsSetPlan(user.id, plan, note.trim()); onSaved() } catch (e) { toast(`Not saved: ${(e as Error).message}`, 'error') } finally { setBusy(false) }
  }
  return (
    <Modal title="Set plan" description={`For ${user.email ?? user.id}. Billing is not built: this only changes the label. Logged.`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={() => void save()}>Save plan</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="ops-plan">Plan</label>
          <select id="ops-plan" className="input" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>{PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}</select></div>
        <div className="field"><label htmlFor="ops-note">Note (why)</label><input id="ops-note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. early friend, invoice #12" /></div>
      </div>
    </Modal>
  )
}

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<UserDetail | null | undefined>(undefined)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    void opsUserDetail(id).then((x) => { if (live) setD(x) }).catch((e) => { if (live) setErr((e as Error).message) })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => { live = false; document.removeEventListener('keydown', key) }
  }, [id, onClose])
  return (
    <div className="ops-drawer-bg" onClick={onClose}>
      <aside className="ops-drawer" role="dialog" aria-modal="true" aria-label="User detail" onClick={(e) => e.stopPropagation()}>
        <div className="ops-row"><h2>{d?.email ?? 'User'}</h2><span className="lp-grow" /><button className="lp-btn sm ghost" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        {err && <div className="up-warn">{err}</div>}
        {d === undefined && !err && <p className="up-muted">Loading…</p>}
        {d === null && <p className="up-muted">No such user.</p>}
        {d && (
          <>
            <dl className="ops-dl">
              <dt>User id</dt><dd><code>{d.id}</code></dd>
              <dt>Signed up</dt><dd>{date(d.created_at)}</dd>
              <dt>Last sign-in</dt><dd>{date(d.last_sign_in_at)}</dd>
              <dt>Via</dt><dd>{d.provider}</dd>
              <dt>Plan</dt><dd>{PLAN_LABEL[d.plan?.plan ?? 'free']}{d.plan?.note ? ` — ${d.plan.note}` : ''}</dd>
            </dl>
            {d.workspaces.length === 0 && <p className="up-muted">No workspace yet (not onboarded).</p>}
            {d.workspaces.map((w) => (
              <div key={w.id} className="ops-ws">
                <h3>{w.name} <span className="up-badge">{w.role}</span></h3>
                {w.projects.length === 0 ? <p className="up-muted">No projects.</p> : (
                  <table className="ops-table">
                    <thead><tr><th>Project</th><th>Site</th><th>Created</th><th>Script</th><th className="num">Comments</th></tr></thead>
                    <tbody>{w.projects.map((p) => (
                      <tr key={p.id}><td>{p.name}<br /><small className="up-muted">{p.public_id}</small></td><td>{p.origin || '—'}</td><td>{date(p.created_at)}</td>
                        <td>{p.installed ? <span className="up-badge st-completed">seen</span> : <span className="up-badge">not yet</span>}</td><td className="num">{fmt(p.comments)}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  )
}

function Audit({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) return <p className="up-muted">No admin actions yet.</p>
  return (
    <div className="ops-tablewrap">
      <table className="ops-table">
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td>{when(r.at)}</td><td>{r.admin ?? '—'}</td><td>{r.action}</td><td><code>{r.target ?? '—'}</code></td>
            <td>{r.action === 'set_plan' ? `${String(r.detail.from)} → ${String(r.detail.to)}${r.detail.note ? ` (${String(r.detail.note)})` : ''}` : JSON.stringify(r.detail)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}
