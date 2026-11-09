import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, Boxes, Code2, MessagesSquare, Users, Settings, Plus, ExternalLink, Copy, Check, Trash2, RotateCcw, MousePointer2, ArrowLeft, LogOut, Circle, CheckCircle2, X, TriangleAlert, SlidersHorizontal, Radar } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal, Switch, Toasts } from '../../components/ui'
import { BRAND, PRODUCTS, productOf } from '../../saas/products'
import { copyText, demoUrl, installSnippet, sameInstall } from '../../saas/snippet'
import { liveOf, openAsReviewer, serveProject, unserveProject } from '../../saas/widget'
import { lastSeen } from '../../core/embed/config'
import { SAAS_ERROR, canHash, checkPassword, freeId, hashPassword, isOnboarded, isSignedIn, newProject, originOf, passwordProblem, refreshCloud, slug, useSaas, useSaasReady, validEmail, type Project, type SaasState } from '../../saas/account'
import { cloud, supabase, authMessage } from '../../saas/supabase'
import { deleteWorkspaceCloud } from '../../saas/cloud'
import { LocalBackend, STATUS_LABEL, pageUrl, statusOf, type Status, type Thread } from '../../core/embed/store'
import '../../saas/saas.css'

export interface Ctx { leave: (to: string, change: () => void) => void; logOut: () => void; s: SaasState; update: (fn: (s: SaasState) => SaasState) => boolean; project: Project | null; setProject: (fn: (p: Project) => Project) => boolean }
export const usePanel = () => useOutletContext<Ctx>()
const ago = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000
  if (m < 1) return 'just now'
  if (m < 60) return `${Math.floor(m)} min ago`
  if (m < 1440) return `${Math.floor(m / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
/** The snippet for a project: the script and the project id. The widget's settings live in the panel. */
const snippetOf = (p: Project) => installSnippet(p.id)
/** Opens the demo site as a reviewer of the project (the widget shows to reviewers only by default). */
export const openDemo = (projectId: string, toast: (t: string, k?: 'error') => void) => { if (!openAsReviewer(projectId, demoUrl(projectId))) toast('Couldn’t open the review link: this browser’s storage is blocked.', 'error') }
/** "x min ago" for the panel. */
export { ago }

/** A project's comments. On this domain only, until shared projects exist: see the inbox note. */
function useThreads(projectId: string | undefined) {
  const backend = useMemo(() => (projectId ? new LocalBackend(projectId) : null), [projectId])
  const [threads, setThreads] = useState<Thread[]>([])
  useEffect(() => {
    if (!backend) { setThreads([]); return }
    const load = () => void backend.list().then(setThreads)
    load()
    const off = backend.subscribe(load)
    const iv = window.setInterval(load, 4000) // a tab of the demo site may have changed them
    return () => { off(); clearInterval(iv) }
  }, [backend])
  return { threads, backend, reload: () => void backend?.list().then(setThreads) }
}

/* ---------- frame ---------- */


export function PanelLayout() {
  const [s, update] = useSaas()
  const { toast } = useStore()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  const { pathname } = useLocation()
  /**
   * Where the panel is going on the way out (logging out, deleting the workspace). The guards below
   * would otherwise see "signed out" or "no account" first and send you elsewhere. Kept per panel,
   * and dropped when the address changes, so it can never leave the panel stuck.
   */
  const [exit, setExit] = useState<string | null>(null)
  useEffect(() => { setExit(null) }, [pathname])
  // The script reads each project's published settings (and draft, for previews) from the configuration stand-in.
  useEffect(() => { for (const p of s.projects) serveProject(p) }, [s.projects])
  const ready = useSaasReady()
  // A change the server refused: say so (the panel has already been reloaded from the server).
  useEffect(() => {
    const on = (e: Event) => toast(`Not saved: ${(e as CustomEvent<string>).detail}`, 'error')
    window.addEventListener(SAAS_ERROR, on)
    return () => window.removeEventListener(SAAS_ERROR, on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (exit) return <Navigate to={exit} replace />
  if (!ready) return <div className="up"><main className="up-main"><p className="up-muted">Loading your workspace…</p></main></div>
  if (!s.account) return <Navigate to="/app/register" replace />
  if (!isSignedIn(s)) return <Navigate to={`/app/login?next=${encodeURIComponent(pathname)}`} replace />
  if (!isOnboarded(s)) return <Navigate to="/app/onboarding" replace />
  const leave = (to: string, change: () => void) => { setExit(to); change() }
  const logOut = () => leave('/app/login', () => update((x) => ({ ...x, signedIn: false })))
  const project = s.projects.find((p) => p.id === s.current) ?? s.projects[0] ?? null
  const setProject = (fn: (p: Project) => Project) => {
    if (!project) return false
    const ok = update((x) => ({ ...x, projects: x.projects.map((p) => (p.id === project.id ? fn(p) : p)) }))
    if (!ok) toast('Not saved: this browser’s storage is full or blocked.', 'error')
    return ok
  }
  const LINKS = [
    { to: '/app', end: true, icon: LayoutDashboard, label: 'Overview' },
    { to: '/app/products', icon: Boxes, label: 'Products' },
    { to: '/app/install', icon: Code2, label: 'Install' },
    { to: '/app/widget', icon: SlidersHorizontal, label: 'Widget' },
    { to: '/app/comments', icon: MessagesSquare, label: 'Comments' },
    { to: '/app/team', icon: Users, label: 'Team' },
    { to: '/app/settings', icon: Settings, label: 'Settings' },
  ]
  return (
    <div className="up">
      <aside className="up-side">
        <Link to="/landingpage" className="lp-logo sm"><span className="lp-mark" aria-hidden><MousePointer2 size={13} /></span>{BRAND}</Link>
        <label className="up-proj">
          <span>Project</span>
          <select value={project?.id ?? ''} onChange={(e) => (e.target.value === '__new' ? setCreating(true) : update((x) => ({ ...x, current: e.target.value })))} aria-label="Project">
            {s.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {!s.projects.length && <option value="">No project</option>}
            <option value="__new">+ New project…</option>
          </select>
        </label>
        <nav className="up-nav" aria-label="Panel">
          {LINKS.map(({ to, end, icon: Icon, label }) => <NavLink key={to} to={to} end={end}><Icon size={16} /> {label}</NavLink>)}
        </nav>
        <span className="lp-grow" />
        <div className="up-me"><b>{s.account.name}</b><span>{s.account.email}</span><button className="up-logout" onClick={logOut}><LogOut size={13} /> Log out</button></div>
        <Link to="/landingpage" className="up-back"><ArrowLeft size={14} /> Website</Link>
      </aside>
      <main className="up-main">
        <div className="up-beta"><TriangleAlert size={14} /> {cloud
          ? 'Beta: your account, projects and widget settings are saved on the server. Comments and the installation check still work on the demo site only, until the script is connected.'
          : 'Beta without a server: this workspace is saved in this browser only.'}</div>
        {project || pathname === '/app/settings' ? <Outlet context={{ s, update, project, setProject, leave, logOut } satisfies Ctx} /> : (
          <div className="up-empty"><h1>No project yet</h1><p>Create a project for a site or app to get its snippet.</p><button className="lp-btn primary" onClick={() => setCreating(true)}><Plus size={15} /> New project</button></div>
        )}
      </main>
      {creating && <NewProject taken={s.projects.map((p) => p.id)} onClose={() => setCreating(false)} onCreate={(p) => {
        if (update((x) => ({ ...x, projects: [...x.projects, p], current: p.id }))) { setCreating(false); toast(`Project “${p.name}” created`); nav('/app/install') }
        else toast('Not saved: this browser’s storage is full or blocked.', 'error')
      }} />}
      <Toasts />
    </div>
  )
}

function NewProject({ taken, onClose, onCreate }: { taken: string[]; onClose: () => void; onCreate: (p: Project) => void }) {
  const [name, setName] = useState('')
  const [site, setSite] = useState('')
  const [tried, setTried] = useState(false)
  const siteOk = !site.trim() || !!originOf(site)
  return (
    <Modal title="New project" description="One project per site or app. It gets its own snippet, comments and settings." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => { setTried(true); if (slug(name) && siteOk) onCreate(newProject(name, site, ['comments'], taken)) }}>Create project</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="np-name">Name</label><input id="np-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={tried && !slug(name)} />
          <span className="hint">{tried && !slug(name) ? <span style={{ color: 'var(--critical-ink)' }}>Give it a name with letters or digits.</span> : name && <>Project id: <code>{freeId(name, taken)}</code></>}</span></div>
        <div className="field"><label htmlFor="np-site">Site address (optional)</label><input id="np-site" className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="shop.example.com" aria-invalid={!siteOk} />
          {!siteOk && <span className="hint" style={{ color: 'var(--critical-ink)' }}>That doesn’t look like a web address.</span>}</div>
        <p className="hint">Starts with Comments on. Change products after.</p>
      </div>
    </Modal>
  )
}

/* ---------- overview ---------- */

export function Overview() {
  const { s, project } = usePanel()
  const { toast } = useStore()
  const [params, setParams] = useSearchParams()
  const { threads } = useThreads(project?.id)
  if (!project) return null
  const invited = s.invites.some((i) => i.projectId === project.id)
  const seen = lastSeen(project.id)
  const steps = [
    { done: project.products.length > 0, label: 'Pick your tools', to: '/app/products' },
    { done: !!liveOf(project), label: 'Publish your widget settings', to: '/app/widget' },
    { done: !!project.copiedSnippet, label: 'Copy your snippet into your site', to: '/app/install' },
    { done: !!seen, label: 'See the script running', to: '/app/install', hint: 'Shown once the script has loaded on the demo site in this browser' },
    { done: threads.length > 0, label: 'Leave the first comment', to: '/app/install', hint: 'On your site, or on the demo site with this project' },
    { done: invited, label: 'Invite a teammate', to: '/app/team' },
  ]
  const left = steps.filter((x) => !x.done).length
  const count = (st: Status) => threads.filter((t) => statusOf(t) === st).length
  return (
    <div className="up-page">
      {params.get('welcome') && (
        <div className="up-welcome">
          <div><h2>Welcome, {s.account!.name.split(' ')[0]}.</h2><p>Your workspace and “{project.name}” are ready. Next: put the snippet on your site.</p></div>
          <button className="up-x" onClick={() => setParams({}, { replace: true })} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="up-head"><div><h1>{project.name}</h1><p>Project id <code>{project.id}</code>{project.siteUrl && <> · <a href={project.siteUrl} target="_blank" rel="noopener">{project.siteUrl.replace(/^https?:\/\//, '')} <ExternalLink size={12} /></a></>}</p></div></div>
      <div className="up-cols">
        <section className="up-card">
          <h2>{left ? `Get set up · ${steps.length - left} of ${steps.length}` : 'All set up'}</h2>
          <ol className="up-steps">
            {steps.map((x) => (
              <li key={x.label} className={x.done ? 'done' : ''}>
                {x.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <span className="lp-grow"><Link to={x.to}>{x.label}</Link>{x.hint && !x.done && <small>{x.hint}</small>}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="up-card">
          <h2>Comments</h2>
          <div className="up-stats">
            {(['open', 'ongoing', 'completed'] as const).map((st) => <Link key={st} to={`/app/comments?status=${st}`} className={`up-stat st-${st}`}><b>{count(st)}</b><span>{STATUS_LABEL[st]}</span></Link>)}
          </div>
          {threads.length === 0 ? <p className="up-muted">No comments yet. <button className="up-linkbtn" onClick={() => openDemo(project.id, toast)}>Try it on the demo site</button> with this project.</p> : (
            <ul className="up-recent">
              {[...threads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map((t) => (
                <li key={t.id}><span className={`up-badge st-${statusOf(t)}`}>{STATUS_LABEL[statusOf(t)]}</span><span className="up-clip">{t.text}</span><span className="up-muted">{ago(t.createdAt)}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="up-card">
        <div className="up-row"><h2>Tools on</h2><Link to="/app/products" className="lp-btn sm">Change</Link></div>
        <div className="up-chips">
          {project.products.length === 0 && <span className="up-muted">None. Turn on at least Comments to use the script.</span>}
          {project.products.map((id) => { const p = productOf(id); if (!p) return null; const Icon = p.icon; return <span key={id} className="up-chip"><span className="lp-icon xs" style={{ background: p.hue }}><Icon size={12} /></span>{p.name}{p.status === 'console' && <small>early access</small>}</span> })}
        </div>
      </section>
    </div>
  )
}

/* ---------- products ---------- */

export function Products() {
  const { project, setProject } = usePanel()
  const { toast } = useStore()
  if (!project) return null
  const toggle = (id: string) => {
    const on = project.products.includes(id)
    const p = productOf(id)!
    if (setProject((x) => ({ ...x, products: on ? x.products.filter((y) => y !== id) : [...x.products, id] })))
      toast(on ? `${p.name} turned off` : p.status === 'script' ? `${p.name} turned on` : `${p.name}: early access requested`)
  }
  const live = liveOf(project)
  const pending = !!live && live.config.modules.comments !== project.products.includes('comments')
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Products</h1><p>Turn tools on or off for “{project.name}”. Early-access tools are built and usable in the demo; they switch on in your script as they move into it.</p></div></div>
      {pending && <p className="up-warn"><TriangleAlert size={14} /> Your site follows this change once you <Link to="/app/widget">publish the widget</Link>. The snippet stays the same.</p>}
      <div className="up-products">
        {PRODUCTS.map((p) => {
          const on = project.products.includes(p.id)
          const Icon = p.icon
          return (
            <article key={p.id} className={`up-product ${on ? 'on' : ''}`}>
              <span className="lp-icon" style={{ background: p.hue }}><Icon size={17} /></span>
              <div className="lp-grow">
                <h3>{p.name} <span className={`lp-status ${p.status}`}>{p.status === 'script' ? 'In the script' : 'Early access'}</span></h3>
                <p>{p.tagline}</p>
                {p.demo.startsWith('#') ? <a href={p.demo} target="_blank" rel="noopener" className="up-link">Try it <ExternalLink size={11} /></a> : <button className="up-link up-linkbtn" onClick={() => openDemo(project.id, toast)}>Try it <ExternalLink size={11} /></button>}
              </div>
              <span className="up-toggle">
                <Switch checked={on} onChange={() => toggle(p.id)} label={`${p.name} for ${project.name}`} />
                <small>{on ? (p.status === 'script' ? 'On' : 'Requested') : 'Off'}</small>
              </span>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- install ---------- */

const GUIDES: { id: string; label: string; where: string; code?: (s: string) => string }[] = [
  { id: 'html', label: 'HTML', where: 'Paste it just before </body> on every page (or in your shared footer).' },
  { id: 'vite', label: 'React / Vue / Svelte (Vite)', where: 'Paste it into index.html at the project root, before </body>. One place covers every route.' },
  { id: 'next', label: 'Next.js', where: 'Add it to app/layout.tsx with next/script, inside <body>:', code: (s) => `import Script from 'next/script'\n\n<Script\n  src="${(s.match(/src="([^"]+)"/) ?? [])[1]}"\n${(s.match(/  data-[^\n]+/g) ?? []).map((x) => x.replace(/^\s+/, '  ')).join('\n')}\n  strategy="afterInteractive"\n/>` },
  { id: 'cms', label: 'WordPress / Webflow / Framer', where: 'Use the site’s “custom code” setting for the footer (Webflow: Site settings → Custom code → Footer; Framer: Site settings → General → End of <body>; WordPress: a header-and-footer plugin).' },
  { id: 'claude', label: 'Ask Claude', where: 'Paste this into Claude Code in your project:', code: (s) => `Add this script tag to my site so it loads on every page, once (just before </body>, or the framework's equivalent such as next/script in the root layout). Don't change anything else.\n\n${s}` },
]

export function Install() {
  const { project, setProject } = usePanel()
  const { toast } = useStore()
  const [guide, setGuide] = useState('html')
  const [seen, setSeen] = useState(() => (project ? lastSeen(project.id) : null))
  useEffect(() => {
    if (!project) return
    const t = window.setInterval(() => setSeen(lastSeen(project.id)), 3000)
    return () => window.clearInterval(t)
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!project) return null
  const code = snippetOf(project)
  const stale = !!project.copiedSnippet && !sameInstall(project.copiedSnippet, project.id)
  const g = GUIDES.find((x) => x.id === guide)!
  const copy = async (text: string, what: string, mark: boolean) => {
    if (!(await copyText(text))) { toast('Copy failed. Select the text and copy it by hand.', 'error'); return }
    if (mark) setProject((p) => ({ ...p, copiedSnippet: code }))
    toast(`${what} copied`)
  }
  const live = liveOf(project)
  const scriptHost = new URL(code.match(/src="([^"]+)"/)?.[1] ?? window.location.href).host
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Install</h1><p>One snippet per project. Paste it once; it works on every page and never has to change. What the widget shows, to whom and where is set in <Link to="/app/widget">Widget</Link>.</p></div>
        <button className="lp-btn" onClick={() => openDemo(project.id, toast)}>Try on the demo site <ExternalLink size={13} /></button></div>
      {stale && <p className="up-warn"><TriangleAlert size={14} /> The snippet on your site is from an older version or another project. It keeps working; copy this one when you next touch your site.</p>}
      {!live && <p className="up-warn"><TriangleAlert size={14} /> No widget settings published yet: your site uses the old snippet options. <Link to="/app/widget">Publish them</Link> to control it from here.</p>}
      <div className="up-cols">
        <section className="up-card">
          <h2>Your snippet</h2>
          <pre className="up-code">{code}</pre>
          <button className="lp-btn primary" onClick={() => void copy(code, 'Snippet', true)}><Copy size={14} /> Copy snippet</button>
        </section>
        <section className="up-card">
          <h2><Radar size={16} /> Installation check</h2>
          {seen ? (
            <>
              <p className={`up-check ${seen.shown ? 'ok' : 'warn'}`}>{seen.shown ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />} Script {seen.version} loaded on <code>{seen.host}{seen.page}</code> {ago(seen.at)}.</p>
              <p className="up-muted">{seen.shown ? 'The widget was shown.' : `The widget stayed hidden: ${seen.why}`}</p>
            </>
          ) : <p className="up-muted">Not seen yet. Open your site, or the demo site, after installing.</p>}
          <p className="up-note">{cloud ? 'Until the script is connected to the server' : 'Beta without a server'}: this check only sees the demo site opened in this browser. Once it is, every site with your snippet reports here.</p>
        </section>
      </div>
      <section className="up-card">
        <h2>Where to paste it</h2>
        <div className="up-tabs" role="tablist">{GUIDES.map((x) => <button key={x.id} role="tab" aria-selected={guide === x.id} onClick={() => setGuide(x.id)}>{x.label}</button>)}</div>
        <p>{g.where}</p>
        {g.code && <><pre className="up-code">{g.code(code)}</pre><button className="lp-btn sm" onClick={() => void copy(g.code!(code), g.id === 'claude' ? 'Prompt' : 'Code', g.id !== 'claude')}><Copy size={13} /> Copy</button></>}
      </section>
      <section className="up-card">
        <h2>For developers</h2>
        <dl className="up-dl">
          <dt>Content-Security-Policy</dt>
          <dd>If your site sends one, allow the script: <code>script-src {scriptHost}</code>. When the server is live, also <code>connect-src</code> for its API.</dd>
          <dt>Your own button</dt>
          <dd><code>{'<button data-vibe="comment">Give feedback</button>'}</code> starts a comment; <code>data-vibe="comments"</code> opens the list. From code: <code>window.VibeCollab.open('comment')</code>.</dd>
          <dt>Tests and local builds</dt>
          <dd>Add <code>data-disabled</code> to the script tag where it shouldn’t load (end-to-end tests, for example).</dd>
          <dt>Staging and previews</dt>
          <dd>Keep one snippet everywhere. Turn the widget on or off per environment in <Link to="/app/widget">Widget → Where</Link>.</dd>
        </dl>
      </section>
    </div>
  )
}

/* ---------- comments inbox ---------- */

export function Comments() {
  const { project } = usePanel()
  const { toast } = useStore()
  const [params, setParams] = useSearchParams()
  const { threads, backend, reload } = useThreads(project?.id)
  const [q, setQ] = useState('')
  const [deleting, setDeleting] = useState<Thread | null>(null)
  const status = (params.get('status') ?? 'all') as Status | 'all'
  if (!project || !backend) return null
  const setStatus = (v: Status | 'all') => setParams(v === 'all' ? {} : { status: v }, { replace: true })
  const shown = threads
    .filter((t) => status === 'all' || statusOf(t) === status)
    .filter((t) => !q.trim() || `${t.text} ${t.author} ${t.page} ${t.replies.map((r) => r.text).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const count = (v: Status | 'all') => threads.filter((t) => v === 'all' || statusOf(t) === v).length
  const save = async (t: Thread, msg: string) => { try { await backend.upsert(t); reload(); toast(msg) } catch { toast('Not saved: storage is blocked.', 'error') } }
  // Comments made on the demo site live on this domain; others on the project's own site.
  // Only ever a page of the project's own site (or the demo): a page key that would lead elsewhere gets no link.
  const openUrl = (t: Thread) => (t.page.startsWith('/embed-demo.html') ? demoUrl(project.id) + (t.page.split('#')[1] ? `#${t.page.split('#')[1]}` : '') : project.siteUrl ? pageUrl(t.page, project.siteUrl) : null)
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Comments</h1><p>Everything your team left on “{project.name}”.</p></div></div>
      <p className="up-note">Until shared projects arrive, this inbox shows the comments saved in this browser on this domain, for example from the <button className="up-linkbtn" onClick={() => openDemo(project.id, toast)}>demo site</button> opened with this project. Comments made on your own site stay in that site’s browser storage for now.</p>
      <div className="up-row wrap">
        <div className="up-tabs" role="group" aria-label="Status">
          {(['all', 'open', 'ongoing', 'completed'] as const).map((v) => <button key={v} aria-pressed={status === v} onClick={() => setStatus(v)}>{v === 'all' ? 'All' : STATUS_LABEL[v]} <span>{count(v)}</span></button>)}
        </div>
        <input className="up-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search comments" aria-label="Search comments" />
      </div>
      {shown.length === 0 ? <div className="up-card up-muted">{threads.length === 0 ? 'No comments yet.' : 'Nothing matches.'}</div> : (
        <ul className="up-inbox">
          {shown.map((t) => {
            const url = openUrl(t)
            return (
              <li key={t.id} className="up-card">
                <div className="up-row"><span className={`up-badge st-${statusOf(t)}`}>{STATUS_LABEL[statusOf(t)]}</span><b>{t.author}</b><span className="up-muted">· {ago(t.createdAt)} · <code>{t.page}</code></span></div>
                <p className="up-text">{t.text}</p>
                {t.replies.length > 0 && <ul className="up-replies">{t.replies.map((r) => <li key={r.id}><b>{r.author}</b> {r.text}</li>)}</ul>}
                <div className="up-row">
                  {t.resolved
                    ? <button className="lp-btn sm" onClick={() => void save({ ...t, resolved: undefined }, 'Reopened')}><RotateCcw size={13} /> Reopen</button>
                    : <button className="lp-btn sm" onClick={() => void save({ ...t, resolved: { by: 'panel', at: new Date().toISOString() } }, 'Set as completed')}><Check size={13} /> Set as completed</button>}
                  {url ? (t.page.startsWith('/embed-demo.html')
                    ? <button className="lp-btn sm ghost" onClick={() => { if (!openAsReviewer(project.id, url)) toast('Couldn’t open the review link.', 'error') }} title="Opens the page as a reviewer">Open on site <ExternalLink size={12} /></button>
                    // Review links on your own site need the server; until then this opens the page as it is.
                    : <a className="lp-btn sm ghost" href={url} target="_blank" rel="noopener" title="Opens the page. Signing in as a reviewer there needs the server.">Open on site <ExternalLink size={12} /></a>) : <span className="up-muted" title="Add the site address in Settings">No site address</span>}
                  <span className="lp-grow" />
                  <button className="lp-btn sm ghost danger" onClick={() => setDeleting(t)} aria-label="Delete comment"><Trash2 size={13} /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {deleting && <Modal title="Delete this comment?" description={`“${deleting.text.slice(0, 80)}” and its ${deleting.replies.length} replies are removed for everyone using this browser.`} onClose={() => setDeleting(null)}
        footer={<><button className="btn" onClick={() => setDeleting(null)}>Keep</button><button className="btn primary" onClick={() => { void backend.remove(deleting.id).then(() => { reload(); toast('Comment deleted') }); setDeleting(null) }}>Delete</button></>} />}
    </div>
  )
}

/* ---------- team ---------- */

export function Team() {
  const { s, update, project } = usePanel()
  const { toast } = useStore()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [tried, setTried] = useState(false)
  if (!project) return null
  const mine = s.invites.filter((i) => i.projectId === project.id)
  const e = email.trim().toLowerCase()
  const problem = !validEmail(e) ? 'Enter an email like name@company.com.' : e === s.account!.email.toLowerCase() ? 'That’s you; you’re already the owner.' : mine.some((i) => i.email === e) ? 'Already invited.' : ''
  const invite = () => {
    setTried(true)
    if (problem) return
    if (update((x) => ({ ...x, invites: [...x.invites, { email: e, role, projectId: project.id, at: new Date().toISOString() }] }))) { setEmail(''); setTried(false); toast(`Invite saved for ${e}`) }
  }
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Team</h1><p>People who review “{project.name}”.</p></div></div>
      <p className="up-note">No emails are sent yet: invites are {cloud ? 'saved on the server and ' : ''}kept as pending until shared projects arrive. Until then, teammates can comment on your site with the snippet, under their own name.</p>
      <section className="up-card">
        <form className="up-row wrap" onSubmit={(ev) => { ev.preventDefault(); invite() }} noValidate>
          <input className="up-search grow" type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="teammate@company.com" aria-label="Email" aria-invalid={tried && !!problem} />
          <select className="up-select" value={role} onChange={(ev) => setRole(ev.target.value as 'member' | 'admin')} aria-label="Role"><option value="member">Member</option><option value="admin">Admin</option></select>
          <button className="lp-btn primary" type="submit"><Plus size={14} /> Invite</button>
        </form>
        {tried && problem && <p className="lp-error">{problem}</p>}
      </section>
      <ul className="up-people">
        <li className="up-card"><span className="up-avatar">{s.account!.name[0]?.toUpperCase()}</span><span className="lp-grow"><b>{s.account!.name}</b><small>{s.account!.email}</small></span><span className="up-badge">Owner</span></li>
        {mine.map((i) => (
          <li key={i.email} className="up-card"><span className="up-avatar muted">{i.email[0].toUpperCase()}</span><span className="lp-grow"><b>{i.email}</b><small>{i.role === 'admin' ? 'Admin' : 'Member'} · invited {ago(i.at)}</small></span><span className="up-badge pending">Pending</span>
            <button className="lp-btn sm ghost" onClick={() => update((x) => ({ ...x, invites: x.invites.filter((y) => !(y.email === i.email && y.projectId === project.id)) }))} aria-label={`Remove ${i.email}`}><X size={14} /></button></li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- settings ---------- */

export function SettingsPage() {
  const { s, update, project, setProject, leave, logOut } = usePanel()
  const { toast } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState(s.account!.name)
  const [email, setEmail] = useState(s.account!.email)
  const [pname, setPname] = useState(project?.name ?? '')
  const [site, setSite] = useState(project?.siteUrl ?? '')
  const [confirm, setConfirm] = useState<'project' | 'account' | null>(null)
  const [typed, setTyped] = useState('')
  useEffect(() => { setPname(project?.name ?? ''); setSite(project?.siteUrl ?? '') }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const accountDirty = name.trim() !== s.account!.name || email.trim() !== s.account!.email
  const accountOk = !!name.trim() && validEmail(email)
  const siteOk = !site.trim() || !!originOf(site)
  const projectDirty = !!project && (pname.trim() !== project.name || (originOf(site) ?? '') !== project.siteUrl)

  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Settings</h1></div><button className="lp-btn sm" onClick={logOut}><LogOut size={14} /> Log out</button></div>
      <section className="up-card">
        <h2>You</h2>
        <div className="up-grid2">
          <label className="lp-field">Name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!name.trim()} /></label>
          <label className="lp-field">Email<input type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!validEmail(email)} /></label>
        </div>
        <div className="up-row"><button className="lp-btn primary sm" disabled={!accountDirty || !accountOk} onClick={() => {
          const emailChanged = email.trim().toLowerCase() !== s.account!.email.toLowerCase()
          if (update((x) => ({ ...x, account: { ...x.account!, name: name.trim(), email: email.trim() } }))) toast(cloud && emailChanged ? 'Saved. Confirm the new address from the email we sent to it; until then you log in with the old one.' : 'Saved')
        }}>Save</button>
          {accountDirty && <button className="lp-btn sm ghost" onClick={() => { setName(s.account!.name); setEmail(s.account!.email) }}>Cancel</button>}</div>
      </section>
      <PasswordCard />
      {project && (
        <section className="up-card">
          <h2>Project</h2>
          <div className="up-grid2">
            <label className="lp-field">Name<input value={pname} maxLength={60} onChange={(e) => setPname(e.target.value)} aria-invalid={!pname.trim()} /></label>
            <label className="lp-field">Site address<input value={site} onChange={(e) => setSite(e.target.value)} placeholder="shop.example.com" aria-invalid={!siteOk} />{!siteOk && <span className="lp-error">That doesn’t look like a web address.</span>}</label>
          </div>
          <p className="up-muted">Project id <code>{project.id}</code> can’t change: your snippet and the comments already made are tied to it.</p>
          <div className="up-row"><button className="lp-btn primary sm" disabled={!projectDirty || !pname.trim() || !siteOk} onClick={() => { if (setProject((p) => ({ ...p, name: pname.trim(), siteUrl: originOf(site) ?? '' }))) toast('Saved') }}>Save</button>
            {projectDirty && <button className="lp-btn sm ghost" onClick={() => { setPname(project.name); setSite(project.siteUrl) }}>Cancel</button>}</div>
          <h3 className="up-sub">Where it runs</h3>
          <p className="up-muted">The sites the widget may show on (production, staging, previews) are its environments: <Link to="/app/widget">Widget → Where</Link>.</p>
        </section>
      )}
      <section className="up-card danger">
        <h2>Danger zone</h2>
        {project && <div className="up-row"><span className="lp-grow">Delete “{project.name}”: its settings and invites. Comments saved on sites stay there.</span><button className="lp-btn sm danger" onClick={() => { setTyped(''); setConfirm('project') }}>Delete project</button></div>}
        <div className="up-row"><span className="lp-grow">Delete this demo workspace from this browser: your account, every project and invite.</span><button className="lp-btn sm danger" onClick={() => { setTyped(''); setConfirm('account') }}>Delete workspace</button></div>
      </section>
      {confirm && (
        <Modal title={confirm === 'project' ? `Delete “${project?.name}”?` : 'Delete this workspace?'} description={confirm === 'project' ? `Type the project id (${project?.id}) to confirm.` : 'Type DELETE to confirm. This can’t be undone.'} onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep it</button>
            <button className="btn primary" disabled={typed !== (confirm === 'project' ? project?.id : 'DELETE')} onClick={() => {
              if (confirm === 'project' && project) {
                unserveProject(project.id)
                update((x) => { const projects = x.projects.filter((p) => p.id !== project.id); return { ...x, projects, current: projects[0]?.id ?? null, invites: x.invites.filter((i) => i.projectId !== project.id) } })
                toast('Project deleted'); setConfirm(null); nav('/app')
              } else {
                if (cloud) {
                  // On the server: the workspace, its projects and comments go; installed snippets show nothing.
                  const ids = s.projects.map((p) => p.id)
                  setConfirm(null)
                  void deleteWorkspaceCloud(ids).then(() => { for (const id of ids) unserveProject(id); toast('Workspace deleted'); return refreshCloud() })
                    .catch((e) => toast(`Not deleted: ${e?.message ?? 'the server refused'}`, 'error'))
                  return
                }
                leave('/landingpage', () => {
                  // Its sites stop showing the widget too: the published settings go with it.
                  for (const p of s.projects) unserveProject(p.id)
                  try { localStorage.removeItem('vibe.saas') } catch { /* ignore */ }
                  window.dispatchEvent(new Event('vibe:saas'))
                })
              }
            }}>Delete</button></>}>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation" autoFocus />
        </Modal>
      )}
    </div>
  )
}

/** Change the password: the current one first, then the new one twice. */
function PasswordCard() {
  const { s, update } = usePanel()
  const { toast } = useStore()
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const has = cloud || !!s.account?.password
  const problem = passwordProblem(pw, s.account?.email)
  const save = async () => {
    setError('')
    if (problem) { setError(problem); return }
    if (pw !== pw2) { setError('The new passwords don’t match.'); return }
    if (cloud && supabase) {
      setBusy(true)
      try {
        // The current password is checked by logging in with it again.
        const check = await supabase.auth.signInWithPassword({ email: s.account!.email, password: cur })
        if (check.error) { setError(check.error.code === 'invalid_credentials' ? 'The current password is incorrect.' : authMessage(check.error)); return }
        const { error: e } = await supabase.auth.updateUser({ password: pw })
        if (e) { setError(authMessage(e)); return }
        toast('Password changed'); setCur(''); setPw(''); setPw2('')
      } finally { setBusy(false) }
      return
    }
    if (!canHash()) { setError('This page isn’t on a secure address, so a password can’t be set here.'); return }
    setBusy(true)
    try {
      if (has && !(await checkPassword(cur, s.account!.password!))) { setError('The current password is incorrect.'); return }
      const password = await hashPassword(pw)
      if (update((x) => ({ ...x, account: { ...x.account!, password }, reset: undefined }))) { toast(has ? 'Password changed' : 'Password set'); setCur(''); setPw(''); setPw2('') }
      else setError('Not saved: this browser’s storage is full or blocked.')
    } finally { setBusy(false) }
  }
  return (
    <section className="up-card">
      <h2>Password</h2>
      {!has && <p className="up-muted">This workspace was made before passwords. Set one so you can log in after logging out.</p>}
      <form className="up-grid2" onSubmit={(e) => { e.preventDefault(); void save() }}>
        {has && <label className="lp-field">Current password<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" maxLength={200} /></label>}
        <label className="lp-field">New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" maxLength={200} /></label>
        <label className="lp-field">Confirm new password<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={200} /></label>
        <div className="up-row" style={{ gridColumn: '1 / -1' }}>
          <button className="lp-btn primary sm" type="submit" disabled={busy || !pw || (has && !cur)}>{busy ? 'Saving…' : has ? 'Change password' : 'Set password'}</button>
          {error && <span className="lp-error">{error}</span>}
        </div>
      </form>
    </section>
  )
}
