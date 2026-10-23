import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Download, Pencil } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { LineChart } from '../components/charts'
import { WEEK_LABELS } from '../data/seed'
import { ago, dateLabel, fmt, minimumRole, requiredApprovals, stageLabel, sum, toSkillMd } from '../lib/logic'
import { SkillDoc } from './SkillDoc'
import { Face, firstName } from './bits'

export default function V2SkillPage() {
  const { id } = useParams()
  const { skill, member, team, teams, policies, dispatch, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const [note, setNote] = useState('')
  const s = skill(id ?? '')

  if (!s) return (
    <main className="v2-canvas"><div className="v2-col"><h1 className="v2-title">This skill isn’t on the shelf</h1>
      <p className="v2-sub">It may have been removed. <Link to="/v2/shelf" style={{ textDecoration: 'underline' }}>Back to the shelf</Link></p></div></main>
  )

  const owner = member(s.ownerId)
  const runs4 = sum(s.usage.slice(-4))
  const hours4 = Math.round((runs4 * s.minutesSaved) / 60)
  const waiting = s.stage === 'review' || s.stage === 'approved'
  const download = () => {
    const url = URL.createObjectURL(new Blob([toSkillMd(s)], { type: 'text/markdown' }))
    Object.assign(document.createElement('a'), { href: url, download: `${s.name}-SKILL.md` }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <div className="v2-small" style={{ marginBottom: 8 }}><Link to="/v2/shelf">The shelf</Link> / {s.category}</div>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 className="v2-title">{s.title}</h1>
            <p className="v2-sub" style={{ marginTop: 4 }}>
              {firstName(owner)} wrote it · v{s.version} · {s.stage === 'published' ? `${fmt(runs4)} runs and ${fmt(hours4)} hours saved in the last 4 weeks` : `${stageLabel(s.stage)}, updated ${ago(s.updatedAt)}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="v2-btn ghost" onClick={download}><Download size={15} /> SKILL.md</button>
            {allowed('skill.edit', s) && s.stage !== 'deprecated' && <button className="v2-btn" onClick={() => nav(`/v2/write/${s.id}`)}><Pencil size={14} /> Edit</button>}
            {waiting && <button className="v2-btn primary" onClick={() => nav(`/v2/review/${s.id}`)}>Open on the review desk <ArrowRight size={15} /></button>}
          </div>
        </header>

        <div className="v2-grid" style={{ marginTop: 32, alignItems: 'start' }}>
          <div className="v2-span-8 v2-panel">
            <div className="v2-panel-head"><h2 className="v2-section">What Claude reads</h2><span className="v2-small" style={{ marginLeft: 'auto' }}>.claude/skills/{s.name}/SKILL.md</span></div>
            <SkillDoc skill={s} />
          </div>

          <aside className="v2-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <section className="v2-panel">
              <div className="v2-panel-head"><h2 className="v2-section">Runs each week</h2></div>
              {sum(s.usage) === 0 ? <div className="v2-empty">No runs yet. It counts from the day it goes on the shelf.</div> : (
                <LineChart series={[{ id: 'r', label: 'Runs', color: 'var(--accent)', values: s.usage }]} labels={WEEK_LABELS} height={140} />
              )}
            </section>

            <section className="v2-panel">
              <dl className="v2-kv">
                <dt>Owner</dt><dd><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Face member={owner} size="sm" />{owner?.name}</span></dd>
                <dt>Lent to</dt><dd>{s.teamIds.map((t) => team(t)?.name).join(', ') || 'Nobody yet'}</dd>
                <dt>Saves</dt><dd className="num">{s.minutesSaved} min a run</dd>
                <dt>Rating</dt><dd className="num">{s.rating ? `${s.rating.toFixed(1)} of 5` : '—'}</dd>
                <dt>Approvals</dt><dd className="num">{s.approvals.length} of {requiredApprovals(s, policies)}</dd>
                <dt>Evals</dt><dd>{s.hasEvals ? 'Attached' : <span style={{ color: 'var(--negative)' }}>None yet</span>}</dd>
              </dl>
              {allowed('access.manage') && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }} aria-label="Lend to teams">
                  {teams.map((t) => {
                    const on = s.teamIds.includes(t.id)
                    return <button key={t.id} className="v2-btn sm" style={on ? { background: 'var(--text)', color: '#fff' } : undefined} aria-pressed={on}
                      onClick={() => { dispatch({ type: 'toggleAccess', id: s.id, teamId: t.id }); toast(`${on ? 'Took it back from' : 'Lent it to'} ${t.name}`) }}>{t.name}</button>
                  })}
                </div>
              )}
            </section>

            <section className="v2-panel">
              <div className="v2-panel-head"><h2 className="v2-section">Versions</h2><span className="v2-chip">{s.versions.length}</span></div>
              <div className="v2-rows">
                {s.versions.slice(0, 3).map((v) => (
                  <div key={v.version + v.at} className="v2-row" style={{ cursor: 'default' }}>
                    <span className="main"><b className="num">v{v.version}</b><span>{v.note}</span></span>
                    <span className="side">{dateLabel(v.at)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="v2-panel">
              <div className="v2-panel-head"><h2 className="v2-section">Talk about it</h2><span className="v2-chip">{s.comments.length}</span></div>
              <div className="v2-rows">
                {s.comments.length === 0 && <div className="v2-empty">No one has said anything yet.</div>}
                {s.comments.slice(-3).map((c) => (
                  <div key={c.id} className="v2-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <Face member={member(c.authorId)} size="sm" />
                    <span className="main"><b>{firstName(member(c.authorId))} <span className="v2-small" style={{ display: 'inline', fontWeight: 400 }}>{ago(c.at)}</span></b><span style={{ whiteSpace: 'normal', color: 'var(--text)' }}>{c.text}</span></span>
                  </div>
                ))}
              </div>
              {allowed('skill.comment') ? (
                <form style={{ display: 'flex', gap: 8, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; dispatch({ type: 'comment', id: s.id, text: note.trim() }); setNote('') }}>
                  <input className="v2-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say something to the team" aria-label="Comment" />
                  <button className="v2-btn" type="submit" aria-disabled={!note.trim()}>Send</button>
                </form>
              ) : <p className="v2-note" style={{ marginTop: 12 }}>Commenting needs the {minimumRole('skill.comment')} role.</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
