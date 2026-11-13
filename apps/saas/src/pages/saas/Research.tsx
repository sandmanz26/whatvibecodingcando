import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Copy, Download, Eraser, ExternalLink, Flame, FlaskConical, Link2, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal } from '../../components/ui'
import { copyText, demoUrl } from '../../saas/snippet'
import { liveOf, openAsReviewer } from '../../saas/widget'
import { productOf } from '../../saas/products'
import { cloud } from '../../saas/supabase'
import { clearStudyResults, deleteRun, deleteStudy, listStudies, projectSessions, revokeStudyLink, saveStudy, studyLink, studyResults, type EventRow, type RunRow, type StudyKind, type StudyRow } from '../../saas/cloud'
import { ago, usePanel } from './Panel'
import { download, toCsv } from '../../saas/stats'

const fileName = (s: string) => s.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'study'
/** One row per participant: when, device, eye-tracking accuracy, and each task's outcome and time, or their answers. */
function runsCsv(runs: RunRow[], studyOf?: (r: RunRow) => string) {
  const taskIds = [...new Set(runs.flatMap((r) => (r.result.tasks ?? []).map((t) => t.id)))]
  return toCsv(
    [...(studyOf ? ['study'] : []), 'participant', 'started', 'finished', 'device', 'screen width', 'eye tracking accuracy (px)', ...taskIds.flatMap((_, i) => [`task ${i + 1} outcome`, `task ${i + 1} seconds`, `task ${i + 1} clicks`]), 'answers'],
    runs.map((r, i) => [...(studyOf ? [studyOf(r)] : []), i + 1, r.started_at, r.finished_at ?? '', r.device ?? '', r.vw ?? '', r.gaze_accuracy ?? '',
      ...taskIds.flatMap((id) => { const t = (r.result.tasks ?? []).find((x) => x.id === id); return t ? [t.outcome, Math.round(t.ms / 1000), t.clicks ?? ''] : ['', '', ''] }),
      (r.result.answers ?? []).filter(Boolean).join(' | ')]))
}
/** One row per recorded event: clicks (with rage and dead clicks), page views, gaze and fake-door clicks. */
function eventsCsv(runs: RunRow[], events: EventRow[]) {
  const n = new Map(runs.map((r, i) => [r.id, i + 1]))
  return toCsv(['participant', 'ms into the run', 'task', 'kind', 'page', 'element', 'selector', 'rage click', 'nothing clickable', 'on target'],
    [...events].sort((a, b) => (n.get(a.run_id) ?? 0) - (n.get(b.run_id) ?? 0) || a.t - b.t)
      .map((e) => [n.get(e.run_id) ?? '', e.t, e.task ?? '', e.kind, e.page, e.label ?? '', e.sel ?? '', e.rage ? 'yes' : '', e.dead ? 'yes' : '', e.hit == null ? '' : e.hit ? 'yes' : 'no']))
}

/**
 * Research (#/app/research): studies on the project's own site, with participants who agreed.
 * A study has a participant link; people who open it see a consent screen, then the study. Results
 * here; the clicks also show as a heatmap over the real page, for reviewers (the script's Heatmap).
 */

const KIND: Record<StudyKind, { label: string; product: string; help: string }> = {
  usability: { label: 'Usability test', product: 'usability', help: 'Give people tasks on your site; see who succeeds, how long it takes and where they click.' },
  fivesec: { label: '5-second test', product: 'fivesec', help: 'Show a page for a few seconds, then ask what people remember.' },
  browse: { label: 'Heatmap visit', product: 'heatmap', help: 'People use your site freely for a few minutes; their clicks build the heatmap.' },
}
/** Filters for the sidebar's Results links. */
const FILTERS: { id: string; title: string; help: string; empty: string; has: (s: StudyRow) => boolean }[] = [
  { id: 'usability', title: 'Usability tests', help: 'Tasks on your site: who succeeds, how long it takes, where people click.', empty: 'No usability tests yet. Make one with New study.', has: (s) => s.kind === 'usability' },
  { id: 'fivesec', title: '5-second tests', help: 'What people remember after seeing a page for a few seconds.', empty: 'No 5-second tests yet. Make one with New study.', has: (s) => s.kind === 'fivesec' },
  { id: 'browse', title: 'Heatmaps', help: 'Studies whose clicks build a heatmap. Open a study’s Results, then its heatmap buttons.', empty: 'No heatmap visits yet. Make one with New study → Heatmap visit.', has: (s) => s.kind === 'browse' || s.kind === 'usability' },
  { id: 'eyes', title: 'Eye tracking', help: 'Studies that ask participants to turn on their webcam for eye tracking.', empty: 'No study uses eye tracking yet. Edit a usability test and turn on eye tracking.', has: (s) => s.eye_tracking },
  { id: 'doors', title: 'Fake doors', help: 'Studies that offer a feature that doesn’t exist yet, to measure interest.', empty: 'No study has fake doors yet. Edit a study and add one under Fake doors.', has: (s) => Array.isArray(s.config.doors) && (s.config.doors as unknown[]).length > 0 },
]
interface TaskDraft { id: string; prompt: string; startPage: string; rule: 'none' | 'page' | 'element'; target: string; limitSec: number }
const newTask = (n: number): TaskDraft => ({ id: `t${n}`, prompt: '', startPage: '/', rule: 'none', target: '', limitSec: 180 })
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const secs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s` : `${Math.round(ms / 1000)} s`)
const cleanPath = (p: string) => { const t = p.trim().replace(/^https?:\/\/[^/]+/, '') || '/'; return t.startsWith('/') ? t.split(/[?#]/)[0].slice(0, 300) : `/${t.split(/[?#]/)[0]}`.slice(0, 300) }

/** The product a study needs, and whether it is in the published settings. */
function useModuleOn() {
  const { project } = usePanel()
  return (kind: StudyKind) => !!project && !!liveOf(project)?.config.modules[KIND[kind].product as 'heatmap']
}

export function Research() {
  const { project } = usePanel()
  const { toast } = useStore()
  const [rows, setRows] = useState<StudyRow[] | null>(null)
  const [editing, setEditing] = useState<StudyRow | 'new' | null>(null)
  const [link, setLink] = useState<{ id: string; url: string } | null>(null)
  const [confirm, setConfirm] = useState<StudyRow | null>(null)
  const [clearing, setClearing] = useState<StudyRow | null>(null)
  const [params, setParams] = useSearchParams()
  // The sidebar's Results links: ?kind=usability|fivesec|browse|eyes|doors filters the studies, ?tab=sessions opens Sessions.
  const tab: 'studies' | 'sessions' = params.get('tab') === 'sessions' ? 'sessions' : 'studies'
  const setTab = (t: 'studies' | 'sessions') => setParams(t === 'sessions' ? { tab: 'sessions' } : {}, { replace: true })
  const filter = FILTERS.find((f) => f.id === params.get('kind')) ?? null
  const moduleOn = useModuleOn()
  const load = () => { if (project && cloud) void listStudies(project.id).then(setRows).catch((e: Error) => { setRows([]); toast(`Couldn’t load studies: ${e.message}`, 'error') }) }
  useEffect(load, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!project) return null
  const siteBase = project.siteUrl || ''
  const linkFor = async (s: StudyRow) => {
    try {
      const token = await studyLink(s.id)
      const c = s.config as { tasks?: { startPage?: string }[]; page?: string }
      const start = s.kind === 'usability' ? c.tasks?.[0]?.startPage || '/' : c.page || '/'
      const base = siteBase ? new URL(start, siteBase).href : demoUrl(project.id)
      const u = new URL(base); u.hash = `vibe_r=${token}`
      setLink({ id: s.id, url: u.href }); load()
    } catch (e) { toast(`Couldn’t make the link: ${(e as Error).message}`, 'error') }
  }
  return (
    <div className="up-page">
      <div className="up-head">
        <div><h1>{tab === 'sessions' ? 'Sessions' : filter?.title ?? 'Research'}</h1><p>{filter ? <>{filter.help} <Link to="/app/research">All studies</Link></> : 'Studies on your own site, with people who agree to take part. Visitors who didn’t open a study’s link are never recorded.'}</p></div>
        {cloud && <button className="lp-btn primary" onClick={() => setEditing('new')}><Plus size={14} /> New study</button>}
      </div>
      {cloud && <div className="seg rs-tabs" role="tablist"><button role="tab" aria-selected={tab === 'studies'} aria-pressed={tab === 'studies'} onClick={() => setTab('studies')}>Studies</button><button role="tab" aria-selected={tab === 'sessions'} aria-pressed={tab === 'sessions'} onClick={() => setTab('sessions')}>Session insights</button></div>}
      {tab === 'sessions' ? <Sessions studies={rows ?? []} /> : <>
      {!cloud && <p className="up-warn"><TriangleAlert size={13} /> Studies on your site need the server: this demo panel has none. Try the research tools in the demo console instead.</p>}
      {cloud && rows && !rows.length && (
        <section className="up-card rs-empty">
          <FlaskConical size={22} />
          <h2>No studies yet</h2>
          <p className="up-muted">Start with a usability test (tasks on your site), a 5-second test, or a heatmap visit. You get a link to send to participants (email, WhatsApp, a recruiting tool).</p>
          <button className="lp-btn primary" onClick={() => setEditing('new')}><Plus size={14} /> New study</button>
        </section>
      )}
      <ul className="rs-list">
        {cloud && rows && rows.length > 0 && filter && !rows.some(filter.has) && <section className="up-card up-muted">{filter.empty}</section>}
        {(rows ?? []).filter((s) => !filter || filter.has(s)).map((s) => (
          <li key={s.id} className="up-card">
            <div className="up-row">
              <span className="lp-grow"><b>{s.name}</b><small className="up-muted"> · {KIND[s.kind].label} · {s.runs} participant{s.runs === 1 ? '' : 's'} · {ago(s.created_at)}</small></span>
              <span className={`up-badge ${s.status === 'open' ? '' : 'pending'}`}>{s.status === 'open' ? 'Open' : 'Closed'}</span>
            </div>
            {!moduleOn(s.kind) && <p className="up-warn"><TriangleAlert size={13} /> Participants’ links won’t open yet: turn on {productOf(KIND[s.kind].product)?.name ?? KIND[s.kind].label} in <Link to="/app/products">Products</Link>, then update your site from Widget.</p>}
            <div className="up-row wrap">
              <Link className="lp-btn sm primary" to={`/app/research/${s.id}`}>Results</Link>
              <button className="lp-btn sm" onClick={() => void linkFor(s)}><Link2 size={13} /> {s.has_link ? 'New participant link' : 'Participant link'}</button>
              {s.has_link && <button className="lp-btn sm ghost" onClick={() => void revokeStudyLink(s.id).then(() => { toast('Link revoked: it no longer opens the study'); load() })}>Revoke link</button>}
              <button className="lp-btn sm ghost" onClick={() => setEditing(s)}>Edit</button>
              {s.runs > 0 && <button className="lp-btn sm ghost" onClick={() => setClearing(s)}><Eraser size={13} /> Clear results</button>}
              <button className="lp-btn sm ghost" onClick={() => void saveStudy(project.id, { ...s, status: s.status === 'open' ? 'closed' : 'open' }).then(load)}>{s.status === 'open' ? 'Close' : 'Reopen'}</button>
              <span className="lp-grow" />
              <button className="lp-btn sm ghost" onClick={() => setConfirm(s)} aria-label={`Delete ${s.name}`}><Trash2 size={13} /></button>
            </div>
            {link?.id === s.id && (
              <div className="up-linkbox">
                <p>Send this to participants. It works for 30 days, for up to {s.max_runs} people; a new link replaces it.</p>
                <pre className="up-code">{link.url}</pre>
                <button className="lp-btn sm" onClick={() => void copyText(link.url).then((ok) => toast(ok ? 'Link copied' : 'Copy failed', ok ? undefined : 'error'))}><Copy size={13} /> Copy link</button>
                {!siteBase && <p className="up-hint">No website set yet, so the link opens the demo site. Set it in Widget → Website.</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
      </>}
      {editing && <StudyEditor study={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {clearing && (
        <Modal title={`Clear the results of “${clearing.name}”?`} description={`${clearing.runs} participant${clearing.runs === 1 ? '’s' : 's’'} runs are deleted: tasks, answers, clicks and gaze, so its heatmap starts empty. The study and its link stay. This can’t be undone.`} onClose={() => setClearing(null)}
          footer={<><button className="btn" onClick={() => setClearing(null)}>Keep them</button><button className="btn primary" onClick={() => void clearStudyResults(clearing.id).then(() => { toast('Results cleared'); setClearing(null); load() }).catch((e: Error) => toast(`Couldn’t clear: ${e.message}`, 'error'))}>Clear results</button></>} />
      )}
      {confirm && (
        <Modal title={`Delete “${confirm.name}”?`} description="Its participant link, every participant’s run and their clicks are deleted. This can’t be undone." onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep it</button><button className="btn primary" onClick={() => void deleteStudy(confirm.id).then(() => { toast('Study deleted'); setConfirm(null); load() })}>Delete</button></>} />
      )}
    </div>
  )
}

function StudyEditor({ study, onClose, onSaved }: { study: StudyRow | null; onClose: () => void; onSaved: () => void }) {
  const { project } = usePanel()
  const { toast } = useStore()
  const c = (study?.config ?? {}) as Record<string, unknown>
  const [kind, setKind] = useState<StudyKind>(study?.kind ?? 'usability')
  const [name, setName] = useState(study?.name ?? '')
  const [intro, setIntro] = useState(String(c.intro ?? ''))
  const [tasks, setTasks] = useState<TaskDraft[]>(() => ((c.tasks as Record<string, unknown>[] | undefined) ?? [{}]).map((t, i) => {
    const s = (t.success ?? {}) as { kind?: string; page?: string; sel?: string }
    return { ...newTask(i + 1), id: String(t.id ?? `t${i + 1}`), prompt: String(t.prompt ?? ''), startPage: String(t.startPage ?? '/'), rule: s.kind === 'page' ? 'page' : s.kind === 'element' ? 'element' : 'none', target: String(s.kind === 'page' ? s.page ?? '' : s.sel ?? ''), limitSec: Number(t.limitSec ?? 180) }
  }))
  const [page, setPage] = useState(String(c.page ?? '/'))
  const [prompt, setPrompt] = useState(String(c.prompt ?? ''))
  const [seconds, setSeconds] = useState(Number(c.seconds ?? 5))
  const [minutes, setMinutes] = useState(Number(c.minutes ?? 3))
  const [questions, setQuestions] = useState<string[]>(((c.questions as string[] | undefined) ?? ['What was this page about?', 'What would you click first?']).concat(['', '', '']).slice(0, 3))
  const [maxRuns, setMaxRuns] = useState(study?.max_runs ?? 200)
  const [eyes, setEyes] = useState(study?.eye_tracking ?? false)
  const gazeOn = !!project && !!liveOf(project)?.config.modules.gaze
  const [doors, setDoors] = useState<{ page: string; sel: string; mode: 'add' | 'existing'; label: string; message: string }[]>(() => ((c.doors as Record<string, string>[] | undefined) ?? []).map((d) => ({ page: d.page ?? '', sel: d.sel ?? '', mode: d.mode === 'existing' ? 'existing' : 'add', label: d.label ?? '', message: d.message ?? '' })))
  const doorsOn = !!project && !!liveOf(project)?.config.modules.doors
  const [busy, setBusy] = useState(false)
  const problem = !name.trim() ? 'Give the study a name.' : kind === 'usability' && (!tasks.length || tasks.some((t) => !t.prompt.trim())) ? 'Every task needs what to do.' : kind === 'usability' && tasks.some((t) => t.rule !== 'none' && !t.target.trim()) ? 'A success rule needs its page or element.' : ''
  const save = async () => {
    if (!project || problem || busy) return
    const config: Record<string, unknown> = kind === 'usability'
      ? { intro: intro.trim(), tasks: tasks.map((t, i) => ({ id: `t${i + 1}`, prompt: t.prompt.trim().slice(0, 300), startPage: cleanPath(t.startPage), limitSec: Math.min(1800, Math.max(15, t.limitSec)), success: t.rule === 'page' ? { kind: 'page', page: cleanPath(t.target) } : t.rule === 'element' ? { kind: 'element', sel: t.target.trim().slice(0, 400) } : { kind: 'none' } })) }
      : kind === 'fivesec' ? { intro: intro.trim(), page: cleanPath(page), prompt: prompt.trim(), seconds: Math.min(30, Math.max(3, seconds)), questions: questions.map((q) => q.trim()).filter(Boolean).slice(0, 3) }
        : { intro: intro.trim(), page: cleanPath(page), prompt: prompt.trim(), minutes: Math.min(30, Math.max(1, minutes)) }
    config.doors = doors.filter((d) => d.sel.trim()).slice(0, 5).map((d, i) => ({ id: `d${i + 1}`, page: d.page.trim() ? cleanPath(d.page) : '', sel: d.sel.trim().slice(0, 400), mode: d.mode, label: d.label.trim().slice(0, 60) || 'New', message: d.message.trim().slice(0, 300) }))
    setBusy(true)
    try { await saveStudy(project.id, { id: study?.id, kind, name, config, status: study?.status, eye_tracking: kind !== 'fivesec' && eyes, max_runs: Math.min(1000, Math.max(1, maxRuns)) }); toast(study ? 'Study saved' : 'Study created'); onSaved() }
    catch (e) { toast(`Not saved: ${(e as Error).message}`, 'error') }
    finally { setBusy(false) }
  }
  const setTask = (i: number, p: Partial<TaskDraft>) => setTasks(tasks.map((t, j) => (j === i ? { ...t, ...p } : t)))
  return (
    <Modal title={study ? 'Edit study' : 'New study'} onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!!problem || busy} onClick={() => void save()}>{study ? 'Save' : 'Create study'}</button></>}>
      <div className="rs-form">
        {!study && (
          <div className="rs-kinds" role="radiogroup" aria-label="Kind of study">
            {(Object.keys(KIND) as StudyKind[]).map((k) => <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}><b>{KIND[k].label}</b><small>{KIND[k].help}</small></button>)}
          </div>
        )}
        <label className="lp-field">Name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={kind === 'usability' ? 'Checkout, round 1' : kind === 'fivesec' ? 'Home page first impression' : 'Pricing page heatmap'} /></label>
        <label className="lp-field">Welcome text (optional)<textarea rows={2} maxLength={600} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Thanks for helping! Think aloud if you like; there are no wrong answers." /></label>
        {kind === 'usability' && (
          <>
            <h3 className="up-sub">Tasks</h3>
            {tasks.map((t, i) => (
              <div key={i} className="rs-task">
                <div className="up-row"><b>Task {i + 1}</b><span className="lp-grow" />{tasks.length > 1 && <button className="lp-btn sm ghost" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} aria-label={`Remove task ${i + 1}`}><X size={13} /></button>}</div>
                <label className="lp-field">What to do<input value={t.prompt} maxLength={300} onChange={(e) => setTask(i, { prompt: e.target.value })} placeholder="Find a coffee under Rp 100.000 and add it to your cart" /></label>
                <div className="up-grid2">
                  <label className="lp-field">Starts on page<input value={t.startPage} onChange={(e) => setTask(i, { startPage: e.target.value })} placeholder="/" /></label>
                  <label className="lp-field">Time limit (seconds)<input type="number" min={15} max={1800} value={t.limitSec} onChange={(e) => setTask(i, { limitSec: Number(e.target.value) })} /></label>
                </div>
                <label className="lp-field">It’s done when
                  <select className="up-select" value={t.rule} onChange={(e) => setTask(i, { rule: e.target.value as TaskDraft['rule'] })}>
                    <option value="none">The participant says so (Done)</option>
                    <option value="page">They reach a page</option>
                    <option value="element">They click an element</option>
                  </select>
                </label>
                {t.rule !== 'none' && <label className="lp-field">{t.rule === 'page' ? 'Page (e.g. /cart, or /order/* for any page below)' : 'Element (a CSS selector, e.g. #checkout or button.buy)'}<input value={t.target} onChange={(e) => setTask(i, { target: e.target.value })} placeholder={t.rule === 'page' ? '/cart' : '#checkout'} /></label>}
              </div>
            ))}
            {tasks.length < 10 && <button className="lp-btn sm" onClick={() => setTasks([...tasks, newTask(tasks.length + 1)])}><Plus size={13} /> Add a task</button>}
          </>
        )}
        {kind !== 'usability' && (
          <div className="up-grid2">
            <label className="lp-field">Page<input value={page} onChange={(e) => setPage(e.target.value)} placeholder="/" /></label>
            {kind === 'fivesec'
              ? <label className="lp-field">Seconds<input type="number" min={3} max={30} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} /></label>
              : <label className="lp-field">Minutes<input type="number" min={1} max={30} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>}
          </div>
        )}
        {kind !== 'usability' && <label className="lp-field">What to tell them first (optional)<input value={prompt} maxLength={300} onChange={(e) => setPrompt(e.target.value)} placeholder={kind === 'fivesec' ? 'Imagine you’re looking for a gift.' : 'Look around as if you’re choosing a plan.'} /></label>}
        {kind === 'fivesec' && (
          <>
            <h3 className="up-sub">Questions afterwards</h3>
            {questions.map((q, i) => <label key={i} className="lp-field">Question {i + 1}{i > 0 ? ' (optional)' : ''}<input value={q} maxLength={200} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))} /></label>)}
          </>
        )}
        {kind !== 'fivesec' && (
          <label className="up-check"><input type="checkbox" checked={eyes} onChange={(e) => setEyes(e.target.checked)} /> Ask participants for webcam eye tracking (they can say no; video stays in their browser, only where they look is saved){!gazeOn && ' · turn on Eye tracking in Products and update your site'}</label>
        )}
        <details className="wb-more" open={doors.length > 0}>
          <summary>Fake doors (optional)</summary>
          <p className="up-muted">Offer a feature that doesn’t exist yet, to see who wants it. Participants who click it see that it’s coming soon. Only this study’s participants see the doors.{!doorsOn && ' Turn on Fake doors in Products and press Update site for them to show.'}</p>
          {doors.map((d, i) => (
            <div key={i} className="rs-task">
              <div className="up-row"><b>Door {i + 1}</b><span className="lp-grow" /><button className="lp-btn sm ghost" onClick={() => setDoors(doors.filter((_, j) => j !== i))} aria-label={`Remove door ${i + 1}`}><X size={13} /></button></div>
              <div className="up-grid2">
                <label className="lp-field">Shown as<select className="up-select" value={d.mode} onChange={(e) => setDoors(doors.map((x, j) => (j === i ? { ...x, mode: e.target.value as 'add' | 'existing' } : x)))}><option value="add">A new button beside an element</option><option value="existing">An element already on the page</option></select></label>
                <label className="lp-field">Element (CSS selector)<input value={d.sel} onChange={(e) => setDoors(doors.map((x, j) => (j === i ? { ...x, sel: e.target.value } : x)))} placeholder="#search" /></label>
                <label className="lp-field">Label<input value={d.label} maxLength={60} onChange={(e) => setDoors(doors.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="AI search" /></label>
                <label className="lp-field">Only on page (optional)<input value={d.page} onChange={(e) => setDoors(doors.map((x, j) => (j === i ? { ...x, page: e.target.value } : x)))} placeholder="/ or /shop/*" /></label>
              </div>
              <label className="lp-field">After a click, tell them<input value={d.message} maxLength={300} onChange={(e) => setDoors(doors.map((x, j) => (j === i ? { ...x, message: e.target.value } : x)))} placeholder="AI search is coming soon. Thanks for your interest!" /></label>
            </div>
          ))}
          {doors.length < 5 && <button className="lp-btn sm" onClick={() => setDoors([...doors, { page: '', sel: '', mode: 'add', label: '', message: '' }])}><Plus size={13} /> Add a fake door</button>}
        </details>
        <label className="lp-field">Participants at most<input type="number" min={1} max={1000} value={maxRuns} onChange={(e) => setMaxRuns(Number(e.target.value))} /></label>
        <p className="up-muted">Participants first see what is recorded (clicks, pages, time) and what never is (what they type into your site, video), and choose to agree.</p>
        {problem && <p className="lp-error">{problem}</p>}
      </div>
    </Modal>
  )
}

/* ---------- results ---------- */

export function StudyResults() {
  const { id } = useParams()
  const { project } = usePanel()
  const { toast } = useStore()
  const nav = useNavigate()
  const [study, setStudy] = useState<StudyRow | null>(null)
  const [data, setData] = useState<{ runs: RunRow[]; events: EventRow[] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const load = () => {
    if (!project || !id || !cloud) return
    void listStudies(project.id).then((l) => setStudy(l.find((s) => s.id === id) ?? null))
    void studyResults(id).then(setData).catch((e: Error) => toast(`Couldn’t load results: ${e.message}`, 'error'))
  }
  useEffect(load, [project?.id, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const byRun = useMemo(() => { const m = new Map<string, EventRow[]>(); for (const e of data?.events ?? []) m.set(e.run_id, [...(m.get(e.run_id) ?? []), e]); return m }, [data])
  if (!project) return null
  if (!cloud) return <div className="up-page"><p className="up-warn">Studies need the server.</p></div>
  const runs = data?.runs ?? []
  const done = runs.filter((r) => r.finished_at)
  const tasks = ((study?.config as { tasks?: { id: string; prompt: string }[] } | undefined)?.tasks) ?? []
  const clicks = (data?.events ?? []).filter((e) => e.kind === 'click')
  const pages = [...clicks.reduce((m, e) => m.set(e.page, [(m.get(e.page)?.[0] ?? 0) + 1, (m.get(e.page)?.[1] ?? 0) + (e.rage ? 1 : 0), (m.get(e.page)?.[2] ?? 0) + (e.dead ? 1 : 0)]), new Map<string, number[]>())].sort((a, b) => b[1][0] - a[1][0])
  const heatOn = !!liveOf(project)?.config.modules.heatmap
  const openHeat = (page: string, gaze = false) => {
    // A page kind (/product/:id) has no single address: any page of that kind shows its map.
    if (page.includes(':id')) { toast(`Open any ${page.replace(/:id/g, '…')} page of your site as a reviewer, then press Heatmap in the dock: the map covers every page of that kind.`); return }
    const base = project.siteUrl ? new URL(page, project.siteUrl).href : demoUrl(project.id)
    const u = new URL(base); u.hash = gaze ? 'vibe_tool=heatmap&vibe_heat=gaze' : 'vibe_tool=heatmap'
    void openAsReviewer(project.id, u.href).then((ok) => { if (!ok) toast('Couldn’t open your site as a reviewer.', 'error') })
  }
  return (
    <div className="up-page">
      <button className="lp-btn sm ghost" onClick={() => nav('/app/research')}><ArrowLeft size={14} /> Research</button>
      <div className="up-head"><div><h1>{study?.name ?? 'Study'}</h1><p>{study ? KIND[study.kind].label : ''} · {runs.length} participant{runs.length === 1 ? '' : 's'}, {done.length} finished{runs.some((r) => r.gaze_accuracy) ? ` · eye tracking for ${runs.filter((r) => r.gaze_accuracy).length} (median accuracy ${Math.round(median(runs.filter((r) => r.gaze_accuracy).map((r) => r.gaze_accuracy!)))} px)` : ''}</p></div></div>
      {runs.length > 0 && data && (
        <div className="up-row wrap rs-actions">
          <button className="lp-btn sm" onClick={() => download(`${fileName(study?.name ?? 'study')}-participants.csv`, runsCsv(runs))}><Download size={13} /> Participants (CSV)</button>
          <button className="lp-btn sm" onClick={() => download(`${fileName(study?.name ?? 'study')}-clicks-and-gaze.csv`, eventsCsv(runs, data.events))}><Download size={13} /> Clicks, pages and gaze (CSV)</button>
          <span className="lp-grow" />
          <button className="lp-btn sm ghost danger" onClick={() => setClearing(true)}><Eraser size={13} /> Clear results</button>
        </div>
      )}
      {clearing && <Modal title="Clear this study’s results?" description={`All ${runs.length} participants’ runs are deleted: their tasks, answers, clicks and gaze, so the heatmap starts empty too. The study and its participant link stay. This can’t be undone.`} onClose={() => setClearing(false)}
        footer={<><button className="btn" onClick={() => setClearing(false)}>Keep them</button><button className="btn primary" onClick={() => void clearStudyResults(id!).then(() => { toast('Results cleared'); setClearing(false); load() }).catch((e: Error) => toast(`Couldn’t clear: ${e.message}`, 'error'))}>Clear results</button></>} />}
      {!data ? <p className="up-muted">Loading…</p> : !runs.length ? <p className="up-muted">No participants yet. Send the participant link from Research.</p> : (
        <>
          {study?.kind === 'usability' && (
            <section className="up-card">
              <h2>Tasks</h2>
              <table className="db-table">
                <thead><tr><th>Task</th><th>Success</th><th>Gave up</th><th>Ran out of time</th><th>Median time</th><th>First click right</th></tr></thead>
                <tbody>
                  {tasks.map((t, i) => {
                    const rs = done.flatMap((r) => (r.result.tasks ?? []).filter((x) => x.id === t.id))
                    const fc = rs.filter((x) => x.firstClickHit != null)
                    return <tr key={t.id}><td><b>{i + 1}.</b> {t.prompt}</td><td>{pct(rs.filter((x) => x.outcome === 'success' || x.outcome === 'done').length, rs.length)}</td><td>{pct(rs.filter((x) => x.outcome === 'gave_up').length, rs.length)}</td><td>{pct(rs.filter((x) => x.outcome === 'timeout').length, rs.length)}</td><td>{rs.length ? secs(median(rs.map((x) => x.ms))) : '–'}</td><td>{fc.length ? pct(fc.filter((x) => x.firstClickHit).length, fc.length) : '–'}</td></tr>
                  })}
                </tbody>
              </table>
              <p className="up-muted">Success counts tasks the site saw finished (the page reached or element clicked) and tasks the participant marked Done.</p>
            </section>
          )}
          {study?.kind === 'fivesec' && (
            <section className="up-card">
              <h2>What people remembered</h2>
              <ul className="rs-answers">{done.flatMap((r) => (r.result.answers ?? []).map((a, i) => a && <li key={`${r.id}${i}`}>“{a}”<small className="up-muted"> · {ago(r.finished_at!)}</small></li>))}</ul>
            </section>
          )}
          {(() => {
            const dv = (data?.events ?? []).filter((e) => e.kind === 'door')
            if (!dv.length) return null
            const rows = [...dv.reduce((m, e) => { const k = e.label ?? e.sel ?? '?'; const v = m.get(k) ?? { saw: new Set<string>(), clicked: new Set<string>() }; (e.hit ? v.clicked : v.saw).add(e.run_id); return m.set(k, v) }, new Map<string, { saw: Set<string>; clicked: Set<string> }>())]
            return (
              <section className="up-card">
                <h2>Fake doors</h2>
                <table className="db-table"><thead><tr><th>Door</th><th>Saw it</th><th>Clicked</th><th>Interest</th></tr></thead>
                  <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.saw.size}</td><td>{v.clicked.size}</td><td>{pct(v.clicked.size, Math.max(v.saw.size, v.clicked.size))}</td></tr>)}</tbody></table>
                <p className="up-muted">People, not clicks: someone who clicked three times counts once.</p>
              </section>
            )
          })()}
          {(() => {
            const gz = (data?.events ?? []).filter((e) => e.kind === 'gaze')
            if (!gz.length) return null
            // Each gaze point stands for about 200 ms of looking.
            const rows = [...gz.reduce((m, e) => { const k = `${e.page}\u0000${e.label ?? e.sel ?? '?'}`; const v = m.get(k) ?? { page: e.page, what: e.label ?? e.sel ?? '?', n: 0, people: new Set<string>() }; v.n++; v.people.add(e.run_id); return m.set(k, v) }, new Map<string, { page: string; what: string; n: number; people: Set<string> }>()).values()].sort((a, b) => b.n - a.n).slice(0, 15)
            const pagesG = [...new Set(gz.map((e) => e.page))]
            return (
              <section className="up-card">
                <h2>Where people looked</h2>
                <table className="db-table"><thead><tr><th>Page</th><th>Element</th><th>Looked at</th><th>People</th></tr></thead>
                  <tbody>{rows.map((x) => <tr key={x.page + x.what}><td><code>{x.page}</code></td><td>{x.what}</td><td>{(x.n * 0.2).toFixed(1)} s</td><td>{x.people.size}</td></tr>)}</tbody></table>
                <div className="up-row wrap">{pagesG.slice(0, 6).map((pg) => <button key={pg} className="lp-btn sm" onClick={() => openHeat(pg, true)}>Gaze heatmap of {pg} <ExternalLink size={12} /></button>)}</div>
                <p className="up-muted">Webcam eye tracking is estimated (about 100–200 px), so read this as areas, not exact points. Only participants who agreed to it.</p>
              </section>
            )
          })()}
          <section className="up-card">
            <h2><Flame size={16} /> Clicks by page</h2>
            {!heatOn && <p className="up-warn"><TriangleAlert size={13} /> To see the heatmap over your page, turn on Heatmaps in Products and update your site.</p>}
            <table className="db-table">
              <thead><tr><th>Page</th><th>Clicks</th><th>Rage clicks</th><th>On nothing clickable</th><th /></tr></thead>
              <tbody>{pages.map(([p, [n, rage, dead]]) => <tr key={p}><td><code>{p}</code></td><td>{n}</td><td>{rage}</td><td>{dead}</td><td>{heatOn && <button className="lp-btn sm" onClick={() => openHeat(p)}>Heatmap <ExternalLink size={12} /></button>}</td></tr>)}</tbody>
            </table>
          </section>
          <section className="up-card">
            <h2>Participants</h2>
            <p className="up-muted">Each participant’s path: the pages they opened and what they clicked, in order. Rage clicks are three or more quick clicks in one spot.</p>
            <ul className="rs-runs">
              {runs.map((r) => {
                const ev = byRun.get(r.id) ?? []
                const rage = ev.filter((e) => e.rage).length, dead = ev.filter((e) => e.dead).length
                return (
                  <li key={r.id} className="up-card">
                    <div className="up-row">
                      <span className="lp-grow"><b>{r.device ?? 'device'} · {r.vw ?? '?'} px</b><small className="up-muted"> · {ago(r.started_at)} · {r.finished_at ? 'finished' : 'not finished'} · {ev.filter((e) => e.kind === 'click').length} clicks{rage ? ` · ${rage} rage` : ''}{dead ? ` · ${dead} on nothing clickable` : ''}</small></span>
                      <button className="lp-btn sm ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide path' : 'Path'}</button>
                      <button className="lp-btn sm ghost" aria-label="Delete this participant’s data" onClick={() => void deleteRun(r.id).then(() => { toast('Participant’s data deleted'); load() })}><Trash2 size={13} /></button>
                    </div>
                    {(r.result.tasks ?? []).length > 0 && <p className="up-muted">{(r.result.tasks ?? []).map((t, i) => `${i + 1}: ${t.outcome.replace('_', ' ')} (${secs(t.ms)})`).join(' · ')}</p>}
                    {open === r.id && <PathList ev={ev} />}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/* ---------- session insights: every participant, across studies ---------- */

/** One participant's path: pages opened and clicks, in order. */
function PathList({ ev }: { ev: EventRow[] }) {
  return (
    <ol className="rs-path">
      {ev.slice(0, 300).map((e, i) => <li key={i} className={e.rage ? 'rage' : e.dead ? 'dead' : ''}><span className="up-muted">{secs(e.t)}</span> {e.kind === 'page' ? <>opened <code>{e.page}</code></> : e.kind === 'door' ? <>{e.hit ? 'clicked' : 'saw'} the fake door “{e.label}”</> : <>clicked {e.label ?? e.sel ?? 'something'}{e.rage ? ' (rage)' : e.dead ? ' (nothing clickable)' : ''}</>}</li>)}
    </ol>
  )
}

function Sessions({ studies }: { studies: StudyRow[] }) {
  const { project } = usePanel()
  const { toast } = useStore()
  const [data, setData] = useState<{ runs: (RunRow & { study_id: string })[]; events: EventRow[] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [only, setOnly] = useState<'all' | 'frustrated'>('all')
  useEffect(() => { if (project) void projectSessions(project.id).then(setData).catch((e: Error) => toast(`Couldn’t load sessions: ${e.message}`, 'error')) }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const byRun = useMemo(() => { const m = new Map<string, EventRow[]>(); for (const e of data?.events ?? []) m.set(e.run_id, [...(m.get(e.run_id) ?? []), e]); return m }, [data])
  if (!data) return <p className="up-muted">Loading…</p>
  if (!data.runs.length) return <section className="up-card"><h2>No sessions yet</h2><p className="up-muted">Each participant who takes part in a study is a session here: the pages they opened, what they clicked, and where they got stuck.</p></section>
  const clicks = data.events.filter((e) => e.kind === 'click')
  const rage = clicks.filter((e) => e.rage), dead = clicks.filter((e) => e.dead)
  const pagesPer = data.runs.map((r) => new Set((byRun.get(r.id) ?? []).filter((e) => e.kind === 'page').map((e) => e.page)).size)
  // Where people got stuck: rage clicks and clicks on nothing clickable, by page and element.
  const spots = [...[...rage, ...dead].reduce((m, e) => {
    const k = `${e.page}\u0000${e.label ?? e.sel ?? '?'}`
    const v = m.get(k) ?? { page: e.page, what: e.label ?? e.sel ?? '?', rage: 0, dead: 0, people: new Set<string>() }
    if (e.rage) v.rage++; else v.dead++
    v.people.add(e.run_id)
    return m.set(k, v)
  }, new Map<string, { page: string; what: string; rage: number; dead: number; people: Set<string> }>()).values()].sort((a, b) => b.people.size - a.people.size || b.rage - a.rage).slice(0, 15)
  const studyName = (id: string) => studies.find((s) => s.id === id)?.name ?? 'study'
  const frustrated = (id: string) => (byRun.get(id) ?? []).some((e) => e.rage || e.dead)
  const list = data.runs.filter((r) => only === 'all' || frustrated(r.id))
  return (
    <>
      <div className="up-row wrap rs-actions">
        <button className="lp-btn sm" onClick={() => download('sessions.csv', runsCsv(data.runs, (r) => studyName((r as RunRow & { study_id: string }).study_id)))}><Download size={13} /> Sessions (CSV)</button>
        <button className="lp-btn sm" onClick={() => download('sessions-clicks-and-pages.csv', eventsCsv(data.runs, data.events))}><Download size={13} /> Clicks and pages (CSV)</button>
      </div>
      <div className="db-kpis">
        <div className="db-kpi"><span>Sessions</span><b>{data.runs.length}</b></div>
        <div className="db-kpi"><span>Pages per session</span><b>{pagesPer.length ? (pagesPer.reduce((a, b) => a + b, 0) / pagesPer.length).toFixed(1) : '–'}</b></div>
        <div className="db-kpi"><span>Rage clicks</span><b>{rage.length}</b><small>{new Set(rage.map((e) => e.run_id)).size} sessions</small></div>
        <div className="db-kpi"><span>On nothing clickable</span><b>{dead.length}</b><small>{new Set(dead.map((e) => e.run_id)).size} sessions</small></div>
      </div>
      <section className="up-card">
        <h2>Where people got stuck</h2>
        {!spots.length ? <p className="up-muted">No rage clicks or clicks on nothing clickable yet.</p> : (
          <table className="db-table">
            <thead><tr><th>Page</th><th>Element</th><th>People</th><th>Rage clicks</th><th>On nothing clickable</th></tr></thead>
            <tbody>{spots.map((x) => <tr key={x.page + x.what}><td><code>{x.page}</code></td><td>{x.what}</td><td>{x.people.size}</td><td>{x.rage}</td><td>{x.dead}</td></tr>)}</tbody>
          </table>
        )}
        <p className="up-muted">Rage clicks: three or more quick clicks in one spot. Clicks on nothing clickable: on text or images people expected to do something.</p>
      </section>
      <section className="up-card">
        <div className="up-row"><h2 className="lp-grow">Sessions</h2>
          <span className="seg"><button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>All</button><button aria-pressed={only === 'frustrated'} onClick={() => setOnly('frustrated')}>With frustration</button></span></div>
        <ul className="rs-runs">
          {list.map((r) => {
            const ev = byRun.get(r.id) ?? []
            const pages = [...new Set(ev.filter((e) => e.kind === 'page').map((e) => e.page))]
            return (
              <li key={r.id} className="up-card">
                <div className="up-row">
                  <span className="lp-grow"><b>{studyName(r.study_id)}</b><small className="up-muted"> · {r.device ?? 'device'} · {ago(r.started_at)} · {ev.filter((e) => e.kind === 'click').length} clicks · {pages.length} page{pages.length === 1 ? '' : 's'}{frustrated(r.id) ? ' · frustration' : ''}</small></span>
                  <button className="lp-btn sm ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide path' : 'Path'}</button>
                </div>
                <p className="up-muted rs-trail">{pages.map((p) => <code key={p}>{p}</code>)}</p>
                {open === r.id && <PathList ev={ev} />}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

