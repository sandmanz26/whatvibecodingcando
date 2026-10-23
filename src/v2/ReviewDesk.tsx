import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Undo2, Upload } from 'lucide-react'
import { useStore } from '../store/store'
import { ago, blockers, can, requiredApprovals, stageLabel } from '../lib/logic'
import type { Skill } from '../data/types'
import { SkillDoc } from './SkillDoc'
import { Face, firstName } from './bits'

export default function V2ReviewDesk() {
  const { id } = useParams()
  const { skills, me, member, team, policies, dispatch, moveSkill, toast } = useStore()
  const nav = useNavigate()
  const [note, setNote] = useState('')

  // Ready to publish first, then the oldest review — the one that has waited longest.
  const queue = skills.filter((s) => s.stage === 'review' || s.stage === 'approved')
    .sort((a, b) => (a.stage === b.stage ? a.updatedAt.localeCompare(b.updatedAt) : a.stage === 'approved' ? -1 : 1))
  // Once a skill leaves the queue (published, sent back), the desk moves on to the next one.
  const open = queue.find((s) => s.id === id) ?? queue[0]

  const actions = (s: Skill) => {
    const need = requiredApprovals(s, policies)
    const out: { label: string; icon: React.ReactNode; primary?: boolean; why: string[]; run: () => void }[] = []
    if (s.stage === 'review') {
      if (!s.approvals.includes(me.id) && s.approvals.length < need) {
        const why = !can(me, 'skill.approve', s) ? [s.ownerId === me.id ? 'You wrote it, so someone else approves it' : 'Approving needs the Maintainer role'] : []
        out.push({ label: 'Approve', icon: <Check size={15} />, primary: true, why, run: () => { dispatch({ type: 'approve', id: s.id }); toast(`You approved ${s.title}`) } })
      } else {
        out.push({ label: 'Mark as approved', icon: <Check size={15} />, primary: true, why: blockers(s, 'approved', me, policies), run: () => moveSkill(s.id, 'approved') })
      }
    }
    if (s.stage === 'approved') out.push({ label: 'Put it on the shelf', icon: <Upload size={15} />, primary: true, why: blockers(s, 'published', me, policies), run: () => moveSkill(s.id, 'published') })
    out.push({ label: 'Send back to draft', icon: <Undo2 size={15} />, why: blockers(s, 'draft', me, policies), run: () => moveSkill(s.id, 'draft') })
    return out
  }

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <header>
          <h1 className="v2-title">Review desk</h1>
          <p className="v2-sub" style={{ marginTop: 4 }}>
            {queue.length === 0 ? 'The desk is clear.' : `${queue.length} waiting · ${queue.filter((s) => s.stage === 'approved').length} ready to put on the shelf`}
          </p>
        </header>

        {queue.length === 0 && !open ? (
          <div className="v2-empty" style={{ marginTop: 24 }}>Nothing is waiting for review. When someone sends a skill in, it lands here. <Link to="/v2/shelf" style={{ textDecoration: 'underline' }}>Browse the shelf</Link></div>
        ) : (
          <div className={`desk ${id && open?.id === id ? 'has-open' : ''}`} style={{ marginTop: 24 }}>
            <nav className="desk-list" aria-label="Waiting for review">
              {queue.map((s) => {
                const owner = member(s.ownerId)
                return (
                  <button key={s.id} className="desk-row" aria-current={open?.id === s.id} onClick={() => nav(`/v2/review/${s.id}`)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Face member={owner} size="sm" /><b>{owner?.name}</b></span>
                    <span className="when">{ago(s.updatedAt)}</span>
                    <span className="what" style={{ color: 'var(--text)' }}>{s.title} · v{s.version}</span>
                    <span className="meta">
                      <span className={`v2-chip ${s.stage === 'approved' ? 'pos' : 'teal'}`}>{s.stage === 'approved' ? 'Ready to publish' : `${s.approvals.length} of ${requiredApprovals(s, policies)} approvals`}</span>
                      {!s.hasEvals && <span className="v2-chip warn">No evals</span>}
                    </span>
                  </button>
                )
              })}
            </nav>

            {open && (
              <section className="v2-panel" aria-label={open.title}>
                <Link to="/v2/review" className="v2-link desk-back" style={{ marginBottom: 12 }}><ArrowLeft size={14} /> All waiting</Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}><Link to={`/v2/skills/${open.id}`}>{open.title}</Link></h2>
                    <p className="v2-small" style={{ marginTop: 4 }}>
                      {firstName(member(open.ownerId))} sent v{open.version} {ago(open.updatedAt)} · {stageLabel(open.stage)} · for {open.teamIds.map((t) => team(t)?.name).join(', ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {actions(open).map((a) => (
                      <button key={a.label} className={`v2-btn ${a.primary ? 'primary' : ''}`} aria-disabled={a.why.length > 0} title={a.why[0]} onClick={() => a.why.length === 0 && a.run()}>
                        {a.icon} {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                {actions(open).find((a) => a.primary && a.why.length) && (
                  <p className="v2-note" style={{ marginTop: 10, color: 'var(--warning)' }}>{actions(open).find((a) => a.primary)!.why[0]}.</p>
                )}

                <div style={{ marginTop: 16 }}><SkillDoc skill={open} /></div>

                <div style={{ marginTop: 16 }}>
                  <h3 className="v2-section" style={{ marginBottom: 10 }}>Conversation</h3>
                  <div className="v2-rows">
                    {open.comments.length === 0 && <div className="v2-empty">No notes yet. Say what you checked, or what should change.</div>}
                    {open.comments.map((c) => (
                      <div key={c.id} className="v2-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                        <Face member={member(c.authorId)} size="sm" />
                        <span className="main"><b>{firstName(member(c.authorId))} <span className="v2-small" style={{ display: 'inline', fontWeight: 400 }}>{ago(c.at)}</span></b><span style={{ whiteSpace: 'normal', color: 'var(--text)' }}>{c.text}</span></span>
                      </div>
                    ))}
                  </div>
                  {can(me, 'skill.comment') && (
                    <form style={{ display: 'flex', gap: 8, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; dispatch({ type: 'comment', id: open.id, text: note.trim() }); setNote('') }}>
                      <input className="v2-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Note to ${firstName(member(open.ownerId))}`} aria-label="Review note" />
                      <button className="v2-btn" type="submit" aria-disabled={!note.trim()}>Send</button>
                    </form>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
