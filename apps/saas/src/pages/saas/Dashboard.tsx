import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, ExternalLink, X, Power, MessagesSquare, Users, Globe, Share2, FlaskConical } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal, Switch } from '../../components/ui'
import { STATUS_LABEL, statusOf } from '../../core/embed/store'
import { lastSeen } from '../../core/embed/config'
import { productOf } from '../../saas/products'
import { liveOf, setLiveOn } from '../../saas/widget'
import { cloud } from '../../saas/supabase'
import { listStudies, projectStats, type StudyRow } from '../../saas/cloud'
import { statsOf, type Stats } from '../../saas/stats'
import { AnonWarning, ago, openDemo, usePanel, useThreads } from './Panel'

/**
 * The project's dashboard: is the widget on, what has come in, from where, and what to do next.
 * On the server the numbers are counted in the database (project_stats), so this stays fast however
 * many comments a project has; in the demo they are counted from this browser's comments.
 */
export function Dashboard() {
  const { s, project, setProject } = usePanel()
  const { toast } = useStore()
  const [params, setParams] = useSearchParams()
  const { threads } = useThreads(project?.id, s.account?.name)
  const [server, setServer] = useState<Stats | null>(null)
  const [failed, setFailed] = useState('')
  const [confirmOff, setConfirmOff] = useState(false)
  const [studies, setStudies] = useState<StudyRow[] | null>(null)
  const research = !!project && ['usability', 'fivesec', 'heatmap'].some((id) => project.products.includes(id))
  useEffect(() => {
    if (!cloud || !project || !research) return
    let live = true
    void listStudies(project.id).then((x) => { if (live) setStudies(x) }).catch(() => { if (live) setStudies([]) })
    return () => { live = false }
  }, [project?.id, research]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!cloud || !project) return
    let live = true
    const load = () => void projectStats(project.id).then((x) => { if (live) { setServer(x); setFailed('') } }).catch((e) => { if (live) setFailed((e as Error).message || 'the server refused') })
    load()
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load() }, 30_000)
    return () => { live = false; window.clearInterval(t) }
  }, [project?.id, threads.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const local = useMemo(() => {
    if (cloud || !project) return null
    const seen = lastSeen(project.id)
    return statsOf(threads, seen ? [{ host: seen.host, last_seen: seen.at, version: seen.version, shown: seen.shown, why: seen.why }] : [])
  }, [threads, project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!project) return null
  const st = cloud ? server : local
  const live = liveOf(project)
  const on = !!live?.config.on
  const by = s.account?.name ?? 'You'
  const toggle = (next: boolean) => {
    if (setProject((p) => setLiveOn(p, next, by))) toast(next ? 'Widget on: your sites show it again' : 'Widget off on every site')
    setConfirmOff(false)
  }
  const total = st ? st.open + st.ongoing + st.completed : 0
  const steps = [
    { done: !!live, label: 'Publish your widget settings', to: '/app/widget' },
    { done: !!project.copiedSnippet, label: 'Copy your snippet into your site', to: '/app/install' },
    { done: !!st?.sites.length, label: 'See the script running on a site', to: '/app/install' },
    { done: cloud ? (st?.reviewers ?? 0) > 0 : total > 0, label: cloud ? 'Invite a reviewer' : 'Leave the first comment', to: cloud ? '/app/team' : '/app/install' },
    { done: total > 0, label: 'Get the first comment', to: '/app/comments' },
    ...(cloud && research ? [{ done: !!studies?.some((x) => x.runs > 0), label: 'Run a first study with participants', to: '/app/research' }] : []),
  ]
  const left = steps.filter((x) => !x.done).length

  return (
    <div className="up-page">
      {params.get('welcome') && (
        <div className="up-welcome">
          <div><h2>Welcome, {s.account!.name.split(' ')[0]}.</h2><p>Your workspace and “{project.name}” are ready. Next: put the snippet on your site.</p></div>
          <button className="up-x" onClick={() => setParams({}, { replace: true })} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="up-head">
        <div><h1>{project.name}</h1><p>Project id <code>{project.id}</code>{project.siteUrl && <> · <a href={project.siteUrl} target="_blank" rel="noopener">{project.siteUrl.replace(/^https?:\/\//, '')} <ExternalLink size={12} /></a></>}</p></div>
      </div>

      <AnonWarning />
      {failed && !server && <p className="up-warn">Couldn’t load the numbers: {failed}. If this is a new setup, run the latest migrations in Supabase (see supabase/README.md).</p>}
      <section className={`up-card db-status ${on ? 'on' : 'off'}`}>
        <Power size={18} />
        <div className="lp-grow">
          <b>{!live ? 'Not published yet' : on ? 'Widget on' : 'Widget off'}</b>
          <small>{!live ? 'Publish the widget settings to control it from here.' : on ? `Live v${live.version} · ${live.config.audience === 'everyone' ? 'everyone visiting' : 'reviewers only'} · ${live.config.envs.filter((e) => e.on).length} environment${live.config.envs.filter((e) => e.on).length === 1 ? '' : 's'} on` : 'Hidden on every site. Comments are kept.'}</small>
        </div>
        {live && <Switch checked={on} onChange={() => (on ? setConfirmOff(true) : toggle(true))} label={on ? 'Turn the widget off' : 'Turn the widget on'} />}
        <Link to="/app/widget" className="lp-btn sm">Settings</Link>
      </section>

      <div className="db-kpis">
        {(['open', 'ongoing', 'completed'] as const).map((k) => (
          <Link key={k} to={`/app/comments?status=${k}`} className={`db-kpi st-${k}`}><span>{STATUS_LABEL[k]}</span><b>{st ? st[k] : '–'}</b></Link>
        ))}
        <div className="db-kpi"><span><MessagesSquare size={13} /> Replies</span><b>{st ? st.replies : '–'}</b></div>
        <Link to="/app/team" className="db-kpi"><span><Users size={13} /> {cloud ? 'Reviewers' : 'People'}</span><b>{st ? st.reviewers : '–'}</b>{cloud && st ? <small>{st.active_reviewers} active this week</small> : null}</Link>
      </div>

      <div className="up-cols">
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow">Comments, last 14 days</h2>{st?.last_comment && <span className="up-muted">last {ago(st.last_comment)}</span>}</div>
          {st ? <DayBars days={st.per_day} /> : <p className="up-muted">Loading…</p>}
        </section>
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow">Pages with the most comments</h2></div>
          {!st || !st.pages.length ? <p className="up-muted">{st ? 'No comments yet.' : 'Loading…'}</p> : (
            <table className="db-table">
              <thead><tr><th>Page</th><th>Open</th><th>Total</th></tr></thead>
              <tbody>{st.pages.map((p) => <tr key={p.page}><td><code>{p.page}</code></td><td className="num">{p.open}</td><td className="num">{p.total}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>

      <div className="up-cols">
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow">Latest comments</h2><Link to="/app/comments" className="lp-btn sm">All comments</Link><Link to="/app/comments?share=1" className="lp-btn sm ghost"><Share2 size={13} /> Share</Link></div>
          {threads.length === 0 ? <p className="up-muted">No comments yet. <button className="up-linkbtn" onClick={() => openDemo(project.id, toast)}>Try it on the demo site</button> with this project.</p> : (
            <ul className="up-recent">
              {[...threads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map((t) => (
                <li key={t.id}><span className={`up-badge st-${statusOf(t)}`}>{STATUS_LABEL[statusOf(t)]}</span><span className="up-clip">{t.text}</span><span className="up-muted">{t.author} · {ago(t.createdAt)}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow"><Globe size={15} /> Where the script runs</h2><Link to="/app/install" className="lp-btn sm ghost">Install</Link></div>
          {!st || !st.sites.length ? <p className="up-muted">{st ? 'Not seen on any site yet.' : 'Loading…'}</p> : (
            <ul className="db-sites">
              {st.sites.map((x) => <li key={x.host}><span className={`db-dot ${x.shown ? 'ok' : ''}`} aria-hidden /><code className="lp-grow">{x.host}</code><span className="up-muted">{x.shown ? 'widget shown' : 'hidden'} · {ago(x.last_seen)}</span></li>)}
            </ul>
          )}
        </section>
      </div>

      {research && (
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow"><FlaskConical size={15} /> Research</h2><Link to="/app/research" className="lp-btn sm">{cloud ? 'Studies' : 'Open'}</Link></div>
          {!cloud ? <p className="up-muted">Studies with participants on your site need the server; this demo panel has none.</p>
            : !studies ? <p className="up-muted">Loading…</p>
              : !studies.length ? <p className="up-muted">No studies yet. <Link to="/app/research">Make one</Link> and send its link to participants.</p>
                : <div className="db-kpis">
                  <div className="db-kpi"><span>Open studies</span><b>{studies.filter((x) => x.status === 'open').length}</b></div>
                  <div className="db-kpi"><span>Participants</span><b>{studies.reduce((n, x) => n + x.runs, 0)}</b></div>
                  <div className="db-kpi"><span>Latest study</span><b className="up-clip" style={{ fontSize: 15 }}>{studies[0].name}</b><small>{ago(studies[0].created_at)}</small></div>
                </div>}
        </section>
      )}

      <div className="up-cols">
        {left > 0 && (
          <section className="up-card">
            <h2>Get set up · {steps.length - left} of {steps.length}</h2>
            <ol className="up-steps">
              {steps.map((x) => (
                <li key={x.label} className={x.done ? 'done' : ''}>{x.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span className="lp-grow"><Link to={x.to}>{x.label}</Link></span></li>
              ))}
            </ol>
          </section>
        )}
        <section className="up-card">
          <div className="up-row"><h2 className="lp-grow">Tools on</h2><Link to="/app/products" className="lp-btn sm">Change</Link></div>
          <div className="up-chips">
            {project.products.length === 0 && <span className="up-muted">None. Turn on at least Comments to use the script.</span>}
            {project.products.map((id) => { const p = productOf(id); if (!p) return null; const Icon = p.icon; return <span key={id} className="up-chip"><span className="lp-icon xs" style={{ background: p.hue }}><Icon size={12} /></span>{p.name}{p.status === 'console' && <small>early access</small>}</span> })}
          </div>
        </section>
      </div>

      {confirmOff && (
        <Modal title="Turn the widget off everywhere?" description="It disappears from every site with your snippet within a few minutes. Comments are kept; turn it back on any time." onClose={() => setConfirmOff(false)}
          footer={<><button className="btn" onClick={() => setConfirmOff(false)}>Keep it on</button><button className="btn primary" onClick={() => toggle(false)}>Turn off</button></>} />
      )}
    </div>
  )
}

/**
 * One series, one colour: comments per day as thin bars from the baseline, with the day and count
 * on hover (and as a table for screen readers). No legend: the card's title names the series.
 */
function DayBars({ days }: { days: Stats['per_day'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.n))
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const total = days.reduce((n, d) => n + d.n, 0)
  return (
    <div className="db-bars-wrap">
      <div className="db-bars" role="img" aria-label={`${total} comments in the last 14 days`} onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <div key={d.day} className={`db-bar-hit ${hover === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${label(d.day)}: ${d.n}`}>
            <span className="db-bar" style={{ height: d.n ? `${Math.max(4, (d.n / max) * 100)}%` : 0 }} />
          </div>
        ))}
        {hover !== null && <div className={`db-tip ${hover < 3 ? 'start' : hover > days.length - 4 ? 'end' : ''}`} style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}><b>{days[hover].n}</b> {days[hover].n === 1 ? 'comment' : 'comments'}<small>{label(days[hover].day)}</small></div>}
      </div>
      <div className="db-axis"><span>{label(days[0].day)}</span><span>max {max}</span><span>{label(days[days.length - 1].day)}</span></div>
      <table className="sr-only"><caption>Comments per day</caption><tbody>{days.map((d) => <tr key={d.day}><th>{label(d.day)}</th><td>{d.n}</td></tr>)}</tbody></table>
    </div>
  )
}
