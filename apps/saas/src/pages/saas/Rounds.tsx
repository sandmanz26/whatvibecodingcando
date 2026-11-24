import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Copy, Download, Pencil, Play, Printer, RotateCcw, Square } from 'lucide-react'
import { useStore } from '../../store/store'
import { Modal } from '../../components/ui'
import { usePanel, useThreads } from './Panel'
import { cloud } from '../../saas/supabase'
import { copyText, demoUrl } from '../../saas/snippet'
import { liveOf } from '../../saas/widget'
import { roundLabel, roundsOf, startRound, updateRound, useRounds, type Approval, type RoundInfo } from '../../saas/rounds'
import { track } from '../../lib/analytics'

const day = (iso: string | null | undefined) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
const STATUS: Record<RoundInfo['status'], string> = { open: 'Open', closed: 'Closed', approved: 'Approved' }

/** Where reviewers open the site: its address (or the demo site in the browser-only demo). */
function siteLink(projectId: string, siteUrl: string) { return cloud && siteUrl ? siteUrl : demoUrl(projectId) }

/**
 * Rounds (#/app/rounds): the owner starts, closes and reopens review rounds; reviewers approve the
 * open one from the widget. Approvals are listed with a printable record.
 */
export function RoundsPage() {
  const { project, setProject } = usePanel()
  const { toast } = useStore()
  const { rounds, approvals, loaded, error, reload } = useRounds(project?.id)
  const { threads } = useThreads(project?.id)
  const [starting, setStarting] = useState(false)
  const [editing, setEditing] = useState<RoundInfo | null>(null)
  const [started, setStarted] = useState<{ n: number; name: string } | null>(null)
  if (!project) return null
  const settings = roundsOf(project)
  const latest = rounds[0] ?? null
  const open = rounds.find((r) => r.status === 'open') ?? null
  const next = (latest?.n ?? 0) + 1
  const chip = open ? `Round ${open.n} open` : latest?.status === 'approved' ? 'Approved' : 'No round open'
  const act = async (fn: () => Promise<void>, msg: string) => { try { await fn(); reload(); toast(msg) } catch (e) { toast(`Not saved: ${(e as Error).message}`, 'error') } }
  const countsFor = (id: string) => { const in_ = threads.filter((t) => t.round === id); return { open: in_.filter((t) => !t.resolved).length, done: in_.filter((t) => !!t.resolved).length } }
  const link = siteLink(project.id, project.siteUrl)

  if (!settings.on) return (
    <div className="up-page">
      <div className="up-head"><div><h1>Rounds</h1><p>Work with your client in review rounds: you open a round, they comment, then approve the version.</p></div></div>
      <section className="up-card">
        <h2>Review rounds are off for “{project.name}”</h2>
        <p className="up-muted">With rounds on, reviewers comment only while a round is open, see what changed, and can press “Approve this version”. You and your team can always comment. Rounds included in your quote are set in <Link to="/app/settings">Settings → Review rounds</Link>.</p>
        <div className="up-row"><button className="lp-btn primary" onClick={() => { if (setProject((p) => ({ ...p, rounds: { on: true, included: roundsOf(p).included } }))) { track('rounds_turned_on'); toast('Review rounds on') } }}>Turn on review rounds</button></div>
      </section>
    </div>
  )

  return (
    <div className="up-page">
      <div className="up-head">
        <div>
          <h1>Rounds <span className={`up-badge ${open ? 'st-open' : latest?.status === 'approved' ? 'st-completed' : ''}`}>{chip}</span></h1>
          <p>{open ? roundLabel(open.n, settings.included) : latest ? `${roundLabel(latest.n, settings.included)} · ${STATUS[latest.status].toLowerCase()}` : 'No round yet.'} · {settings.included == null ? 'unlimited rounds in your quote' : `${settings.included} included in your quote`} (<Link to="/app/settings">change</Link>)</p>
        </div>
        <button className="lp-btn primary" disabled={!!open || !loaded} title={open ? 'Close the open round first' : undefined} onClick={() => setStarting(true)}><Play size={14} /> Start round {next}</button>
      </div>
      {error && <p className="up-warn">Couldn’t load the rounds: {error}</p>}
      {!cloud && <p className="up-note">Demo mode: rounds are saved in this browser, and the widget on the <a href={demoUrl(project.id)} target="_blank" rel="noopener">demo site</a> follows them.</p>}

      {started && (
        <div className="up-linkbox">
          <p><b>{started.name}</b> is open. Reviewers don’t get an email from ourhunch (they have no account), so tell them yourself:</p>
          <pre className="up-code">{`${started.name} is ready for your review: ${link}`}</pre>
          <div className="up-row wrap">
            <button className="lp-btn sm primary" onClick={() => void copyText(`${started.name} is ready for your review: ${link}`).then((ok) => toast(ok ? 'Message copied' : 'Copy failed', ok ? undefined : 'error'))}><Copy size={13} /> Copy message</button>
            <button className="lp-btn sm" onClick={() => void copyText(link).then((ok) => toast(ok ? 'Review link copied' : 'Copy failed', ok ? undefined : 'error'))}><Copy size={13} /> Copy review link</button>
            <button className="lp-btn sm ghost" onClick={() => setStarted(null)}>Done</button>
          </div>
          <p className="up-hint">{cloud ? <>Reviewers who already opened a review link stay reviewers in that browser, so the site’s address is enough. For someone new, make a personal link in <Link to="/app/reviewers">Reviewers</Link>.</> : 'In the demo, the link opens the demo site with this project.'}</p>
        </div>
      )}

      {rounds.length === 0 ? <div className="up-card up-muted">{loaded ? `No rounds yet. Press Start round 1 when the first version is ready for your client.` : 'Loading…'}</div> : (
        <ul className="up-inbox">
          {rounds.map((r) => {
            const c = countsFor(r.id)
            const appr = approvals.filter((a) => a.roundId === r.id)
            return (
              <li key={r.id} className="up-card">
                <div className="up-row wrap">
                  <span className={`up-badge ${r.status === 'open' ? 'st-open' : r.status === 'approved' ? 'st-completed' : ''}`}>{STATUS[r.status]}</span>
                  <b>{r.name}</b>
                  <span className="up-muted">{roundLabel(r.n, settings.included)} · started {day(r.startedAt)}{r.closedAt ? ` · ${r.status === 'approved' ? 'approved' : 'closed'} ${day(r.closedAt)}` : ''}{r.due ? ` · due ${day(r.due)}` : ''}</span>
                </div>
                {r.note && <p className="up-text">{r.note}</p>}
                <p className="up-muted"><Link to={`/app/comments?round=${r.id}`}>{c.open + c.done} comment{c.open + c.done === 1 ? '' : 's'}</Link> in this round: {c.open} open, {c.done} completed.</p>
                {appr.map((a) => <p key={a.id} className="up-check ok"><BadgeCheck size={14} /> Approved by <b>{a.name}</b> · {when(a.at)}{a.version ? ` · version ${a.version}` : ''} · <Link to={`/app/rounds/${a.id}/record`}>Record</Link></p>)}
                <div className="up-row">
                  {r.status === 'open' && <button className="lp-btn sm" onClick={() => void act(() => updateRound(project.id, r.id, { status: 'closed' }), `${r.name} closed`)}><Square size={12} /> Close round</button>}
                  {r.status !== 'open' && r.id === latest?.id && !open && <button className="lp-btn sm" onClick={() => void act(() => updateRound(project.id, r.id, { status: 'open' }), `${r.name} reopened`)}><RotateCcw size={12} /> Reopen</button>}
                  <button className="lp-btn sm ghost" onClick={() => setEditing(r)}><Pencil size={12} /> Edit</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {approvals.length > 0 && (
        <section className="up-card">
          <h2>Approvals</h2>
          <ol className="up-timeline">
            {approvals.map((a) => {
              const r = rounds.find((x) => x.id === a.roundId)
              return <li key={a.id}><b>{a.name}</b> approved {r ? r.name : 'a round'}{a.version ? ` (version ${a.version})` : ''} · {when(a.at)}{a.openComments ? ` · ${a.openComments} open comment${a.openComments === 1 ? '' : 's'} then` : ''} · <Link to={`/app/rounds/${a.id}/record`}><Download size={12} /> Download record</Link></li>
            })}
          </ol>
          <p className="up-hint">A record of approval made in the widget, not a legal signature.</p>
        </section>
      )}

      {starting && <RoundDialog title={`Start round ${next}`} initial={{ name: `Round ${next}`, note: '', due: '' }} warn={settings.included != null && next > settings.included ? `This is extra round ${next - settings.included} beyond the ${settings.included} included in this project.` : ''}
        submit="Start round" onClose={() => setStarting(false)} onSave={async (x) => {
          try { await startRound(project.id, { n: next, ...x, due: x.due || null }); setStarting(false); setStarted({ n: next, name: x.name.trim() || `Round ${next}` }); reload(); track('round_started', { n: next }); toast(`Round ${next} started`) }
          catch (e) { toast(`Not started: ${(e as Error).message}`, 'error') }
        }} />}
      {editing && <RoundDialog title={`Edit ${editing.name}`} initial={{ name: editing.name, note: editing.note, due: editing.due ?? '' }} submit="Save" onClose={() => setEditing(null)}
        onSave={async (x) => { const id = editing.id; setEditing(null); await act(() => updateRound(project.id, id, { name: x.name || editing.name, note: x.note, due: x.due || null }), 'Round saved') }} />}
      {open && !liveOf(project) && <p className="up-warn">Your site has no published settings yet: reviewers can’t see the widget. Press Update site in <Link to="/app/widget">Widget</Link>.</p>}
    </div>
  )
}

function RoundDialog({ title, initial, warn, submit, onClose, onSave }: { title: string; initial: { name: string; note: string; due: string }; warn?: string; submit: string; onClose: () => void; onSave: (x: { name: string; note: string; due: string }) => Promise<void> | void }) {
  const [x, setX] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !x.name.trim()} onClick={() => { setBusy(true); void Promise.resolve(onSave(x)).finally(() => setBusy(false)) }}>{busy ? 'Saving…' : submit}</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="rd-name">Round name</label><input id="rd-name" className="input" value={x.name} maxLength={80} onChange={(e) => setX({ ...x, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="rd-note">What changed (optional, shown to reviewers)</label><textarea id="rd-note" className="input" rows={4} maxLength={2000} value={x.note} onChange={(e) => setX({ ...x, note: e.target.value })} placeholder="New checkout page, bigger product photos…" /></div>
        <div className="field"><label htmlFor="rd-due">Due date (optional)</label><input id="rd-due" className="input" type="date" value={x.due} onChange={(e) => setX({ ...x, due: e.target.value })} /></div>
        {warn && <p className="up-warn">{warn} ourhunch doesn’t bill for rounds; this is only a reminder.</p>}
        <p className="hint">Only one round can be open at a time. While it’s open, reviewers can comment and approve.</p>
      </div>
    </Modal>
  )
}

/** A printable record of one approval (#/app/rounds/<approval id>/record). */
export function RoundRecord() {
  const { project } = usePanel()
  const { id } = useParams()
  const { rounds, approvals, loaded } = useRounds(project?.id)
  if (!project) return null
  const a: Approval | undefined = approvals.find((x) => x.id === id)
  const r = a && rounds.find((x) => x.id === a.roundId)
  if (!a) return <div className="up-page"><p className="up-muted">{loaded ? 'This approval isn’t in this project.' : 'Loading…'}</p><Link to="/app/rounds">Back to Rounds</Link></div>
  return (
    <div className="up-page up-record">
      <div className="up-head no-print"><div><Link to="/app/rounds">← Rounds</Link></div><button className="lp-btn primary" onClick={() => window.print()}><Printer size={14} /> Print or save as PDF</button></div>
      <h1>Record of approval</h1>
      <dl className="up-dl">
        <dt>Project</dt><dd>{project.name} (<code>{project.id}</code>)</dd>
        <dt>Site</dt><dd>{a.origin || project.siteUrl || '—'}</dd>
        <dt>Round</dt><dd>{r ? `${r.name} (round ${r.n})` : '—'}</dd>
        <dt>Site version</dt><dd>{a.version || 'not set'}</dd>
        <dt>Approved by</dt><dd>{a.name}</dd>
        <dt>Time</dt><dd>{when(a.at)} ({Intl.DateTimeFormat().resolvedOptions().timeZone}) · {a.at}</dd>
        <dt>Statement confirmed</dt><dd>“{a.statement}”</dd>
        <dt>Open comments then</dt><dd>{a.openComments}</dd>
      </dl>
      {a.openList.length > 0 && <>
        <h2>Open comments at that moment{a.openComments > a.openList.length ? ` (the newest ${a.openList.length})` : ''}</h2>
        <ol className="up-record-list">{a.openList.map((c, i) => <li key={i}><code>{c.page}</code> · {c.author}: {c.text}</li>)}</ol>
      </>}
      <p className="up-hint">Made with ourhunch from the reviewer’s “Approve this version” in the site’s widget. A record of approval, not a legal signature. The name was typed by the reviewer{cloud ? '; the reviewer came in through a review link' : ''}.</p>
    </div>
  )
}
