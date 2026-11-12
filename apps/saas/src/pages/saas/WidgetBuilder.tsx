import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RotateCcw, TriangleAlert, Plus, X, RefreshCw, Rocket, History, Lock, Users } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal, Switch } from '../../components/ui'
import { PRODUCTS } from '../../saas/products'
import { demoUrl } from '../../saas/snippet'
import { draftOf, liveOf, openAsReviewer, publish, releasable, reviewerUrl } from '../../saas/widget'
import { MAX_ENVS, MAX_LABEL, anyModule, hostProblem, sameConfig, type Env, type ModuleId, type WidgetConfig } from '../../core/embed/config'
import { AnonWarning, ago, openDemo, usePanel } from './Panel'
import { cloud } from '../../saas/supabase'

/**
 * Widget: what the script shows on a project's sites, built here and published. Edits are a draft
 * (seen only in previews) until Publish; every publish is a numbered release that can be rolled back.
 * The snippet on the site never changes.
 */
export function WidgetBuilder() {
  const { s, project, setProject } = usePanel()
  const { toast } = useStore()
  const [confirm, setConfirm] = useState<'publish' | 'discard' | { rollback: number } | null>(null)
  if (!project) return null
  const draft = draftOf(project)
  const live = liveOf(project)
  const out = releasable(project, draft)
  const dirty = !live || !sameConfig(live.config, out)
  const edit = (fn: (c: WidgetConfig) => WidgetConfig) => { if (!setProject((p) => ({ ...p, config: fn(draftOf(p)) }))) toast('Not saved: this browser’s storage is full or blocked.', 'error') }
  const by = s.account?.name ?? 'You'

  const warnings: string[] = []
  if (!draft.on) warnings.push('The widget is switched off: it shows nowhere.')
  if (!draft.envs.some((e) => e.on)) warnings.push('No environment is on, so it shows only on the hosted demo site.')
  if (!anyModule(out.modules)) warnings.push('No module is on, so there is nothing to show.')
  if (draft.launcher.kind === 'hidden' && !draft.launcher.shortcut) warnings.push('No launcher and no C key: people can open it only with your own data-vibe buttons.')
  if (draft.audience === 'everyone') warnings.push(cloud ? 'Every visitor can post comments. Each person is rate limited, but there is no CAPTCHA yet: watch for spam.' : 'Every visitor can post comments. Until the server is live there is no spam protection.')

  return (
    <div className="up-page">
      <div className="up-head">
        <div><h1>Widget</h1><p>What the script shows on your sites, to whom and where. Changes are a draft until you publish; your snippet never changes.</p></div>
        <span className={`wb-live ${live ? '' : 'none'}`}>{live ? <>Live: <b>v{live.version}</b> · {ago(live.at)}</> : 'Not published yet'}</span>
      </div>

      <div className={`wb-bar ${dirty ? 'dirty' : ''}`} role="status">
        {dirty ? <span><b>{live ? 'Unpublished changes.' : 'Not published yet.'}</b> {live ? `Your sites still show v${live.version}.` : 'Your sites use the old snippet options until you publish.'}</span> : <span>Your sites show these settings (v{live!.version}).</span>}
        <span className="lp-grow" />
        {dirty && live && <button className="lp-btn sm ghost" onClick={() => setConfirm('discard')}>Discard changes</button>}
        <button className="lp-btn sm primary" disabled={!dirty} onClick={() => setConfirm('publish')}><Rocket size={13} /> Publish v{(live?.version ?? 0) + 1}</button>
      </div>
      <AnonWarning />

      <div className="wb-grid">
        <div className="wb-form">
          <section className="up-card">
            <div className="up-row"><h2 className="lp-grow">Widget on</h2><Switch checked={draft.on} onChange={() => edit((c) => ({ ...c, on: !c.on }))} label="Widget on" /></div>
            <p className="up-muted">The project’s off switch. Publishing it off hides the widget on every site at once, without touching your code.</p>
          </section>

          <section className="up-card">
            <h2>Who sees it</h2>
            <p className="up-muted">Who sees Comments. The design tools (Inspect, Design system check, Design tokens) are always for reviewers only.</p>
            <div className="wb-choices" role="radiogroup" aria-label="Who sees Comments">
              <button role="radio" aria-checked={draft.audience === 'reviewers'} className={draft.audience === 'reviewers' ? 'on' : ''} onClick={() => edit((c) => ({ ...c, audience: 'reviewers' }))}>
                <Lock size={16} /><span><span><b>Reviewers only</b> <em>Recommended</em></span><small>People you open the site for with a review link (your team, your client). Visitors never see it or load it.</small></span>
              </button>
              <button role="radio" aria-checked={draft.audience === 'everyone'} className={draft.audience === 'everyone' ? 'on' : ''} onClick={() => edit((c) => ({ ...c, audience: 'everyone' }))}>
                <Users size={16} /><span><b>Everyone visiting</b><small>For open betas. Every visitor can comment; the design tools stay with reviewers.</small></span>
              </button>
            </div>
          </section>

          <Environments envs={draft.envs} onChange={(envs) => edit((c) => ({ ...c, envs }))} />

          <section className="up-card">
            <h2>Modules</h2>
            {PRODUCTS.filter((p) => p.id === 'comments' || p.status === 'script').map((p) => {
              const on = project.products.includes(p.id)
              const toggle = () => {
                if (p.id === 'comments') { if (on) edit((c) => ({ ...c, modules: { ...c.modules, comments: !c.modules.comments } })); return }
                if (!setProject((x) => ({ ...x, products: on ? x.products.filter((y) => y !== p.id) : [...x.products, p.id] }))) toast('Not saved: this browser’s storage is full or blocked.', 'error')
              }
              return (
                <div className="up-row" key={p.id}>
                  <span className="lp-grow"><b>{p.name}</b>{p.id === 'comments' && !on ? <small className="up-muted"> · turned off in <Link to="/app/products">Products</Link></small> : p.id !== 'comments' ? <small className="up-muted"> · reviewers only, in their browser</small> : null}</span>
                  <Switch checked={!!out.modules[p.id as ModuleId]} onChange={toggle} label={p.name} />
                </div>
              )
            })}
            <p className="up-muted">Inspect, Design system check and Design tokens show as buttons beside Comments, for reviewers only. They read the page’s styles in the reviewer’s browser and send nothing. Turning one on or off here also changes it in Products; publish to apply.</p>
          </section>

          <section className="up-card">
            <h2>Launcher</h2>
            <div className="up-form">
              <label>Buttons
                <span className="seg" role="group" aria-label="Launcher">
                  <button aria-pressed={draft.launcher.kind === 'floating'} onClick={() => edit((c) => ({ ...c, launcher: { ...c.launcher, kind: 'floating' } }))}>Floating</button>
                  <button aria-pressed={draft.launcher.kind === 'hidden'} onClick={() => edit((c) => ({ ...c, launcher: { ...c.launcher, kind: 'hidden' } }))}>Your own buttons</button>
                </span>
              </label>
              {draft.launcher.kind === 'floating' && <>
                <label>Corner
                  <span className="seg" role="group" aria-label="Corner">
                    <button aria-pressed={draft.launcher.position === 'right'} onClick={() => edit((c) => ({ ...c, launcher: { ...c.launcher, position: 'right' } }))}>Bottom right</button>
                    <button aria-pressed={draft.launcher.position === 'left'} onClick={() => edit((c) => ({ ...c, launcher: { ...c.launcher, position: 'left' } }))}>Bottom left</button>
                  </span>
                </label>
                <label>Button text <input className="up-search" value={draft.launcher.label} maxLength={MAX_LABEL} onChange={(e) => edit((c) => ({ ...c, launcher: { ...c.launcher, label: e.target.value } }))} onBlur={() => { if (!draft.launcher.label.trim()) edit((c) => ({ ...c, launcher: { ...c.launcher, label: 'Comment' } })) }} /></label>
              </>}
              <label>C key starts a comment <Switch checked={draft.launcher.shortcut} onChange={() => edit((c) => ({ ...c, launcher: { ...c.launcher, shortcut: !c.launcher.shortcut } }))} label="C key starts a comment" /></label>
            </div>
            {draft.launcher.kind === 'hidden' && <pre className="up-code">{`<button data-vibe="comment">Give feedback</button>\n<button data-vibe="comments">All comments</button>\n\n// or from code\nwindow.VibeCollab.open('comment')`}</pre>}
          </section>

          <section className="up-card">
            <h2>Look</h2>
            <div className="up-form">
              <label>Accent <input type="color" value={draft.theme.accent} onChange={(e) => edit((c) => ({ ...c, theme: { ...c.theme, accent: e.target.value } }))} className="up-color" /></label>
              <label>Panels
                <span className="seg" role="group" aria-label="Panels">
                  <button aria-pressed={draft.theme.mode === 'light'} onClick={() => edit((c) => ({ ...c, theme: { ...c.theme, mode: 'light' } }))}>Light</button>
                  <button aria-pressed={draft.theme.mode === 'dark'} onClick={() => edit((c) => ({ ...c, theme: { ...c.theme, mode: 'dark' } }))}>Dark</button>
                </span>
              </label>
            </div>
          </section>

          <Releases releases={project.releases ?? []} live={live?.version} onRollback={(v) => setConfirm({ rollback: v })} />
        </div>

        <div className="wb-side">
          <Preview projectId={project.id} siteUrl={project.siteUrl} />
          {warnings.length > 0 && <section className="up-card"><h2>Before you publish</h2><ul className="wb-warn">{warnings.map((w) => <li key={w}><TriangleAlert size={13} /> {w}</li>)}</ul></section>}
        </div>
      </div>

      {confirm === 'publish' && (
        <Modal title={`Publish v${(live?.version ?? 0) + 1}?`} description="Every site with your snippet follows these settings the next time a page loads. You can roll back to any earlier version." onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary" onClick={() => {
            if (setProject((p) => publish(p, by))) toast(`Published v${(live?.version ?? 0) + 1}`)
            else toast('Not published: this browser’s storage is full or blocked.', 'error')
            setConfirm(null)
          }}>Publish</button></>}>
          {warnings.length > 0 && <ul className="wb-warn">{warnings.map((w) => <li key={w}><TriangleAlert size={13} /> {w}</li>)}</ul>}
        </Modal>
      )}
      {confirm === 'discard' && live && (
        <Modal title="Discard your changes?" description={`The draft goes back to what is live (v${live.version}).`} onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep editing</button><button className="btn primary" onClick={() => { setProject((p) => ({ ...p, config: live.config })); setConfirm(null); toast('Changes discarded') }}>Discard</button></>} />
      )}
      {confirm && typeof confirm === 'object' && (() => {
        const r = (project.releases ?? []).find((x) => x.version === confirm.rollback)
        if (!r) return null
        return (
          <Modal title={`Roll back to v${r.version}?`} description={`Its settings are published again as v${(live?.version ?? 0) + 1}, and become your draft. Nothing is deleted from the history.`} onClose={() => setConfirm(null)}
            footer={<><button className="btn" onClick={() => setConfirm(null)}>Cancel</button><button className="btn primary" onClick={() => {
              if (setProject((p) => publish(p, by, r.config))) toast(`Rolled back: v${r.version} is live again as v${(live?.version ?? 0) + 1}`)
              setConfirm(null)
            }}>Roll back</button></>} />
        )
      })()}
    </div>
  )
}

function Environments({ envs, onChange }: { envs: Env[]; onChange: (e: Env[]) => void }) {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [tried, setTried] = useState(false)
  const h = host.trim().toLowerCase()
  const problem = hostProblem(h) || (envs.some((e) => e.host === h) ? 'Already in the list.' : '') || (envs.length >= MAX_ENVS ? `At most ${MAX_ENVS} environments.` : '')
  const add = () => {
    setTried(true)
    if (problem) return
    onChange([...envs, { id: Math.random().toString(36).slice(2, 10), name: name.trim().slice(0, 40) || h, host: h, on: true }])
    setName(''); setHost(''); setTried(false)
  }
  return (
    <section className="up-card">
      <h2>Where</h2>
      <p className="up-muted">The sites the widget may show on. One snippet everywhere; turn each environment on or off here. The hosted demo site always works.</p>
      <ul className="wb-envs">
        {envs.map((e) => (
          <li key={e.id}>
            <span className="lp-grow"><b>{e.name}</b> <code>{e.host}</code></span>
            <Switch checked={e.on} onChange={() => onChange(envs.map((x) => (x.id === e.id ? { ...x, on: !x.on } : x)))} label={`${e.name} on`} />
            <button className="lp-btn sm ghost" onClick={() => onChange(envs.filter((x) => x.id !== e.id))} aria-label={`Remove ${e.name}`}><X size={13} /></button>
          </li>
        ))}
        {!envs.length && <li className="up-muted">None yet.</li>}
      </ul>
      <form className="wb-add" onSubmit={(e) => { e.preventDefault(); add() }} noValidate>
        <input className="up-search" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (Staging)" aria-label="Environment name" maxLength={40} />
        <input className="up-search" value={host} onChange={(e) => setHost(e.target.value)} placeholder="staging.example.com" aria-label="Host" aria-invalid={tried && !!problem} />
        <button className="lp-btn sm" type="submit"><Plus size={13} /> Add</button>
      </form>
      {tried && problem ? <p className="lp-error">{problem}</p> : <p className="up-muted">Patterns: <code>*.example.com</code>, or for previews <code>shop-git-*.vercel.app</code>. Wildcards over shared hosts (<code>*.vercel.app</code>) are refused: they’d match other people’s sites.</p>}
    </section>
  )
}

function Releases({ releases, live, onRollback }: { releases: { version: number; at: string; by: string }[]; live?: number; onRollback: (v: number) => void }) {
  if (!releases.length) return null
  return (
    <section className="up-card">
      <h2><History size={16} /> History</h2>
      <ul className="wb-releases">
        {[...releases].reverse().slice(0, 10).map((r) => (
          <li key={r.version}>
            <b>v{r.version}</b><span className="lp-grow up-muted">{ago(r.at)} · {r.by}</span>
            {r.version === live ? <span className="up-badge">Live</span> : <button className="lp-btn sm ghost" onClick={() => onRollback(r.version)}><RotateCcw size={12} /> Roll back</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The demo site in a frame, opened as a reviewer in preview mode: it shows the draft, live, as you edit. */
function Preview({ projectId, siteUrl }: { projectId: string; siteUrl: string }) {
  const { toast } = useStore()
  const [n, setN] = useState(0)
  // A fresh one-time link for each (re)load of the frame.
  const [src, setSrc] = useState<string | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    let live = true
    setSrc(null)
    void reviewerUrl(projectId, demoUrl(projectId), true).then((u) => { if (!live) return; setSrc(u); if (!u) toast('Preview unavailable: couldn’t make a review link.', 'error') })
    return () => { live = false }
  }, [projectId, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (url: string) => void openAsReviewer(projectId, url, true).then((ok) => { if (!ok) toast('Couldn’t open the preview.', 'error') })
  return (
    <section className="up-card wb-preview">
      <div className="up-row"><h2 className="lp-grow">Preview · draft</h2>
        <button className="lp-btn sm ghost" onClick={() => setN((x) => x + 1)} aria-label="Reload preview" title="Reload"><RefreshCw size={13} /></button>
      </div>
      {src && <iframe ref={frame} key={n} src={src} title="Preview of the widget on the demo site" />}
      <div className="up-row">
        <button className="lp-btn sm" onClick={() => open(demoUrl(projectId))}>Open preview <ExternalLink size={12} /></button>
        {cloud && siteUrl
          ? <button className="lp-btn sm ghost" onClick={() => open(siteUrl)}>Preview on your site <ExternalLink size={12} /></button>
          : <button className="lp-btn sm ghost" onClick={() => openDemo(projectId, toast)}>Open as a reviewer <ExternalLink size={12} /></button>}
      </div>
      <p className="up-muted">The preview shows your draft only to you{cloud ? '' : ', in this browser'}. Visitors keep the published version.</p>
      {siteUrl && !cloud && <p className="up-note">Previewing on <code>{siteUrl.replace(/^https?:\/\//, '')}</code> itself needs the server: review links are checked by it. Until then they work on the demo site only.</p>}
      {cloud && <p className="up-note">On your own site the preview needs the snippet installed and an environment switched on in Where. Publish first if this is your first version.</p>}
    </section>
  )
}
