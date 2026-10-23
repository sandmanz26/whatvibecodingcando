import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, ThumbsUp, FlaskConical, Lock, GripVertical } from 'lucide-react'
import { useStore } from '../store/store'
import { Avatar, Lens, stageIcon } from '../components/ui'
import { LENS } from '../data/lens'
import { blockers, requiredApprovals, STAGES, ago } from '../lib/logic'
import type { Stage } from '../data/types'

export default function Pipeline() {
  const { skills, me, policies, member, moveSkill } = useStore()
  const nav = useNavigate()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [mine, setMine] = useState(false)

  const dragging = dragId ? skills.find((s) => s.id === dragId) : undefined
  const visible = skills.filter((s) => !mine || s.ownerId === me.id || s.reviewerIds.includes(me.id))

  return (
    <main className="page" style={{ maxWidth: 1480 }}>
      <div className="page-head">
        <div>
          <h1>Review</h1>
          <p>Drag a skill to move it. Rules are enforced as you drop — if a move is blocked, the column tells you why.</p>
        </div>
        <div className="actions">
          <div className="seg" role="group" aria-label="Filter">
            <button aria-pressed={!mine} onClick={() => setMine(false)}>All skills</button>
            <button aria-pressed={mine} onClick={() => setMine(true)}>Mine & reviewing</button>
          </div>
        </div>
      </div>

      <Lens info={LENS.pipeline} />

      <div className="board">
        {STAGES.map((col) => {
          const items = visible.filter((s) => s.stage === col.id)
          const why = dragging && dragging.stage !== col.id ? blockers(dragging, col.id, me, policies) : []
          const isOver = over === col.id && dragging && dragging.stage !== col.id
          return (
            <section
              key={col.id}
              className={`col ${isOver ? (why.length ? 'blocked' : 'over') : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(col.id) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragId && dragging?.stage !== col.id) moveSkill(dragId, col.id); setDragId(null) }}
              aria-label={col.label}
            >
              <div className="col-head" title={col.hint}>
                {stageIcon(col.id)}
                <h3>{col.label}</h3>
                <span className="n">{items.length}</span>
              </div>
              {isOver && why.length > 0 && (
                <div className="row" style={{ gap: 6, fontSize: 12, color: 'var(--critical-ink)', fontWeight: 550, padding: '0 4px 10px' }}>
                  <Lock size={13} /> {why[0]}
                </div>
              )}
              {items.map((s) => {
                const need = requiredApprovals(s, policies)
                return (
                  <article
                    key={s.id}
                    className={`card kcard ${dragId === s.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id) }}
                    onDragEnd={() => { setDragId(null); setOver(null) }}
                    onClick={() => nav(`/skills/${s.id}`)}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4>{s.title}</h4>
                      <GripVertical size={14} color="var(--ink-3)" style={{ flex: 'none' }} />
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="mono muted" style={{ fontSize: 11 }}>v{s.version} · {ago(s.updatedAt)}</span>
                      {s.stage !== 'deprecated' && !s.hasEvals && <span className="pill-warn" title="No eval suite attached"><FlaskConical size={12} />No evals</span>}
                    </div>
                    {(s.stage === 'review' || s.stage === 'approved') && (
                      <div className="meter" style={{ height: 4 }}>
                        {Array.from({ length: need }).map((_, i) => <span key={i} style={{ flex: 1, background: i < s.approvals.length ? 'var(--good)' : 'var(--surface-3)', borderRadius: 999 }} />)}
                      </div>
                    )}
                    <div className="meta">
                      <span className="row" style={{ gap: 6 }}><Avatar member={member(s.ownerId)} />{member(s.ownerId)?.name.split(' ')[0]}</span>
                      <span className="row" style={{ gap: 10 }}>
                        {(s.stage === 'review' || s.stage === 'approved') && <span className="approvals num" title="Approvals"><ThumbsUp size={12} />{s.approvals.length}/{need}</span>}
                        {s.comments.length > 0 && <span className="approvals num"><MessageSquare size={12} />{s.comments.length}</span>}
                      </span>
                    </div>
                    <label className="sr-only" htmlFor={`mv-${s.id}`}>Move {s.title}</label>
                    <select
                      id={`mv-${s.id}`}
                      className="sr-only"
                      value={s.stage}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => moveSkill(s.id, e.target.value as Stage)}
                    >
                      {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </article>
                )
              })}
              {items.length === 0 && <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '24px 8px', border: '1px dashed var(--line-strong)', borderRadius: 10 }}>Drop here</div>}
            </section>
          )
        })}
      </div>
    </main>
  )
}
