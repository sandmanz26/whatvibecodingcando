import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, Boxes, Code2, MessagesSquare, Users, Settings, Plus, ExternalLink, Copy, Check, Trash2, RotateCcw, MousePointer2, ArrowLeft, LogOut, Circle, CheckCircle2, X, TriangleAlert } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal, Switch, Toasts } from '../../components/ui'
import { BRAND, PRODUCTS, productOf } from '../../saas/products'
import { copyText, demoUrl, snippet } from '../../saas/snippet'
import { canHash, checkPassword, freeId, hashPassword, isOnboarded, isSignedIn, newProject, originOf, passwordProblem, slug, useSaas, validEmail, type Project, type SaasState } from '../../saas/account'
import { LocalBackend, STATUS_LABEL, pageUrl, statusOf, type Status, type Thread } from '../../core/embed/store'
import '../../saas/saas.css'

interface Ctx { leave: (to: string, change: () => void) => void; logOut: () => void; s: SaasState; update: (fn: (s: SaasState) => SaasState) => boolean; project: Project | null; setProject: (fn: (p: Project) => Project) => boolean }
const usePanel = () => useOutletContext<Ctx>()
const ago = (iso: string) => {
  const m = (Date.now() - new Date(iso).getTime()) / 60000
  if (m < 1) return 'just now'
  if (m < 60) return `${Math.floor(m)} min ago`
  if (m < 1440) return `${Math.floor(m / 60)} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
/** The snippet for a project, with the products the script can run. */
const snippetOf = (p: Project) => snippet({ project: p.id, ...p.widget, products: p.products.filter((id) => productOf(id)?.status === 'script') })

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
  if (exit) return <Navigate to={exit} replace />
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
        <div className="up-beta"><TriangleAlert size={14} /> Beta without a server: this workspace is saved in this browser only.</div>
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
  const [params, setParams] = useSearchParams()
  const { threads } = useThreads(project?.id)
  if (!project) return null
  const invited = s.invites.some((i) => i.projectId === project.id)
  const steps = [
    { done: project.products.length > 0, label: 'Pick your tools', to: '/app/products' },
    { done: !!project.copiedSnippet, label: 'Copy your snippet into your site', to: '/app/install' },
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
          {threads.length === 0 ? <p className="up-muted">No comments yet. <a href={demoUrl(project.id)} target="_blank" rel="noopener">Try it on the demo site</a> with this project.</p> : (
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
  const scriptChanged = !!project.copiedSnippet && project.copiedSnippet !== snippetOf(project)
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Products</h1><p>Turn tools on or off for “{project.name}”. Early-access tools are built and usable in the demo; they switch on in your script as they move into it.</p></div></div>
      {scriptChanged && <p className="up-warn"><TriangleAlert size={14} /> Your snippet changed since you copied it. <Link to="/app/install">Copy it again</Link> so your site follows.</p>}
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
                <a href={p.demo.startsWith('#') ? p.demo : demoUrl(project.id)} target="_blank" rel="noopener" className="up-link">Try it <ExternalLink size={11} /></a>
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
  if (!project) return null
  const code = snippetOf(project)
  const stale = project.copiedSnippet && project.copiedSnippet !== code
  const g = GUIDES.find((x) => x.id === guide)!
  const copy = async (text: string, what: string, mark: boolean) => {
    if (!(await copyText(text))) { toast('Copy failed. Select the text and copy it by hand.', 'error'); return }
    if (mark) setProject((p) => ({ ...p, copiedSnippet: code }))
    toast(`${what} copied`)
  }
  const w = project.widget
  const comments = project.products.includes('comments')
  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Install</h1><p>One snippet per project. Paste it once; it works on every page of the site.</p></div>
        <a className="lp-btn" href={demoUrl(project.id)} target="_blank" rel="noopener">Try on the demo site <ExternalLink size={13} /></a></div>
      {!comments && <p className="up-warn"><TriangleAlert size={14} /> Comments is off for this project, so the script shows nothing. <Link to="/app/products">Turn it on</Link>.</p>}
      {stale && <p className="up-warn"><TriangleAlert size={14} /> Your snippet changed since you last copied it. Copy it again and replace the old one on your site.</p>}
      <div className="up-cols">
        <section className="up-card">
          <h2>Your snippet</h2>
          <pre className="up-code">{code}</pre>
          <button className="lp-btn primary" onClick={() => void copy(code, 'Snippet', true)}><Copy size={14} /> Copy snippet</button>
        </section>
        <section className="up-card">
          <h2>Widget</h2>
          <div className="up-form">
            <label>Buttons
              <span className="seg" role="group" aria-label="Buttons position">
                <button aria-pressed={w.position === 'right'} onClick={() => setProject((p) => ({ ...p, widget: { ...p.widget, position: 'right' } }))}>Bottom right</button>
                <button aria-pressed={w.position === 'left'} onClick={() => setProject((p) => ({ ...p, widget: { ...p.widget, position: 'left' } }))}>Bottom left</button>
              </span>
            </label>
            <label>Accent <input type="color" value={w.color} onChange={(e) => setProject((p) => ({ ...p, widget: { ...p.widget, color: e.target.value } }))} className="up-color" /></label>
            <label>C key starts a comment <Switch checked={w.shortcut} onChange={() => setProject((p) => ({ ...p, widget: { ...p.widget, shortcut: !p.widget.shortcut } }))} label="C key starts a comment" /></label>
          </div>
        </section>
      </div>
      <section className="up-card">
        <h2>Where to paste it</h2>
        <div className="up-tabs" role="tablist">{GUIDES.map((x) => <button key={x.id} role="tab" aria-selected={guide === x.id} onClick={() => setGuide(x.id)}>{x.label}</button>)}</div>
        <p>{g.where}</p>
        {g.code && <><pre className="up-code">{g.code(code)}</pre><button className="lp-btn sm" onClick={() => void copy(g.code!(code), g.id === 'claude' ? 'Prompt' : 'Code', g.id !== 'claude')}><Copy size={13} /> Copy</button></>}
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
      <p className="up-note">Until shared projects arrive, this inbox shows the comments saved in this browser on this domain, for example from the <a href={demoUrl(project.id)} target="_blank" rel="noopener">demo site</a> opened with this project. Comments made on your own site stay in that site’s browser storage for now.</p>
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
                  {url ? <a className="lp-btn sm ghost" href={url} target="_blank" rel="noopener">Open on site <ExternalLink size={12} /></a> : <span className="up-muted" title="Add the site address in Settings">No site address</span>}
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
      <p className="up-note">No emails are sent yet: invites are kept as pending until shared projects arrive. Until then, teammates can comment on your site with the snippet, under their own name.</p>
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
  const [domain, setDomain] = useState('')
  const [confirm, setConfirm] = useState<'project' | 'account' | null>(null)
  const [typed, setTyped] = useState('')
  useEffect(() => { setPname(project?.name ?? ''); setSite(project?.siteUrl ?? '') }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const accountDirty = name.trim() !== s.account!.name || email.trim() !== s.account!.email
  const accountOk = !!name.trim() && validEmail(email)
  const siteOk = !site.trim() || !!originOf(site)
  const projectDirty = !!project && (pname.trim() !== project.name || (originOf(site) ?? '') !== project.siteUrl)
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const hostOk = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$|^localhost(:\d+)?$/.test(host)

  return (
    <div className="up-page">
      <div className="up-head"><div><h1>Settings</h1></div><button className="lp-btn sm" onClick={logOut}><LogOut size={14} /> Log out</button></div>
      <section className="up-card">
        <h2>You</h2>
        <div className="up-grid2">
          <label className="lp-field">Name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!name.trim()} /></label>
          <label className="lp-field">Email<input type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} aria-invalid={!validEmail(email)} /></label>
        </div>
        <div className="up-row"><button className="lp-btn primary sm" disabled={!accountDirty || !accountOk} onClick={() => { if (update((x) => ({ ...x, account: { ...x.account!, name: name.trim(), email: email.trim() } }))) toast('Saved') }}>Save</button>
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
          <h3 className="up-sub">Allowed domains</h3>
          <p className="up-muted">Where this project’s snippet may run. Enforced once shared projects arrive; until then it is a list for your team.</p>
          <ul className="up-domains">{project.domains.map((d) => <li key={d}><code>{d}</code><button className="lp-btn sm ghost" onClick={() => setProject((p) => ({ ...p, domains: p.domains.filter((x) => x !== d) }))} aria-label={`Remove ${d}`}><X size={13} /></button></li>)}
            {!project.domains.length && <li className="up-muted">None yet.</li>}</ul>
          <form className="up-row" onSubmit={(e) => { e.preventDefault(); if (!hostOk || project.domains.includes(host)) return; setProject((p) => ({ ...p, domains: [...p.domains, host] })); setDomain('') }}>
            <input className="up-search" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.example.com or *.example.com" aria-label="Domain" />
            <button className="lp-btn sm" type="submit" disabled={!hostOk || project.domains.includes(host)}>Add</button>
            {domain && !hostOk && <span className="lp-error">Enter a domain like app.example.com.</span>}
            {hostOk && project.domains.includes(host) && <span className="up-muted">Already in the list.</span>}
          </form>
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
                update((x) => { const projects = x.projects.filter((p) => p.id !== project.id); return { ...x, projects, current: projects[0]?.id ?? null, invites: x.invites.filter((i) => i.projectId !== project.id) } })
                toast('Project deleted'); setConfirm(null); nav('/app')
              } else {
                leave('/landingpage', () => {
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
  const has = !!s.account?.password
  const problem = passwordProblem(pw, s.account?.email)
  const save = async () => {
    setError('')
    if (problem) { setError(problem); return }
    if (pw !== pw2) { setError('The new passwords don’t match.'); return }
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
