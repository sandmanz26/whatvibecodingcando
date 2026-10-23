import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Download, Pencil, Send, ThumbsUp, Upload, Archive, Star, Wrench, FlaskConical, ShieldAlert, Undo2 } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { Avatar, CategoryIcon, Empty, GuardedButton, Lens, StageBadge, Switch, TeamTag } from '../components/ui'
import { LineChart, Legend } from '../components/charts'
import { LENS } from '../data/lens'
import { SourceBlock } from '../components/SourceBlock'
import { WEEK_LABELS } from '../data/seed'
import { ago, blockers, dateLabel, fmt, isRisky, minimumRole, requiredApprovals, sum, toSkillMd } from '../lib/logic'

type Tab = 'overview' | 'source' | 'versions' | 'access' | 'discussion'

function Highlighted({ text }: { text: string }) {
  let inFm = false
  let fmCount = 0
  return (
    <pre className="code">
      {text.split('\n').map((line, i) => {
        if (line === '---') { fmCount++; inFm = fmCount === 1; return <div key={i} className="fm">{line}</div> }
        if (inFm) {
          const [k, ...rest] = line.split(':')
          return <div key={i}><span className="key">{k}</span>:{rest.join(':')}</div>
        }
        if (line.startsWith('#')) return <div key={i} className="h">{line}</div>
        if (line.startsWith('- ')) return <div key={i} className="li">{line}</div>
        return <div key={i}>{line || ' '}</div>
      })}
    </pre>
  )
}

export default function SkillDetail() {
  const { id } = useParams()
  const { skill, member, teams, me, policies, dispatch, moveSkill, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const s = skill(id ?? '')

  const md = useMemo(() => (s ? toSkillMd(s) : ''), [s])
  if (!s) return <main className="page"><div className="card"><Empty title="Skill not found"><Link className="btn sm" to="/skills">Back to library</Link></Empty></div></main>

  const owner = member(s.ownerId)
  const need = requiredApprovals(s, policies)
  const runs4 = sum(s.usage.slice(-4))
  const series = s.teamIds.filter((t) => sum(s.usageByTeam[t] ?? []) > 0).map((tid) => {
    const t = teams.find((x) => x.id === tid)!
    return { id: t.id, label: t.name, color: `var(--s${t.slot})`, values: s.usageByTeam[tid] }
  })

  const copy = async () => {
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { toast('Copy not available in this browser', 'error') }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${s.name}-SKILL.md` })
    a.click()
    URL.revokeObjectURL(url)
  }

  // One primary next step, based on stage and role.
  const primary = (() => {
    const b = (to: Parameters<typeof moveSkill>[1]) => blockers(s, to, me, policies)
    if (s.stage === 'draft') return { label: 'Submit for review', icon: <Send size={14} />, why: b('review'), run: () => moveSkill(s.id, 'review') }
    if (s.stage === 'review') {
      if (!s.approvals.includes(me.id) && s.approvals.length < need) {
        const ok = allowed('skill.approve', s)
        return { label: 'Approve', icon: <ThumbsUp size={14} />, why: ok ? [] : [s.ownerId === me.id ? 'You can’t approve your own skill' : `Needs ${minimumRole('skill.approve')} role`], run: () => { dispatch({ type: 'approve', id: s.id }); toast(`You approved “${s.title}”`) } }
      }
      return { label: 'Mark approved', icon: <Check size={14} />, why: b('approved'), run: () => moveSkill(s.id, 'approved') }
    }
    if (s.stage === 'approved') return { label: 'Publish', icon: <Upload size={14} />, why: b('published'), run: () => moveSkill(s.id, 'published') }
    if (s.stage === 'published') return { label: 'Deprecate', icon: <Archive size={14} />, why: b('deprecated'), run: () => moveSkill(s.id, 'deprecated') }
    return { label: 'Restore to draft', icon: <Undo2 size={14} />, why: b('draft'), run: () => moveSkill(s.id, 'draft') }
  })()

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'source', label: 'SKILL.md' },
    { id: 'versions', label: 'Versions', count: s.versions.length },
    { id: 'access', label: 'Access', count: s.teamIds.length },
    { id: 'discussion', label: 'Discussion', count: s.comments.length },
  ]

  return (
    <main className="page">
      <div className="page-head" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <CategoryIcon category={s.category} size={18} />
          <div>
            <div className="row wrap" style={{ gap: 10 }}>
              <h1>{s.title}</h1>
              <StageBadge stage={s.stage} />
            </div>
            <div className="mono muted" style={{ marginTop: 2 }}>{s.name} · v{s.version} · updated {ago(s.updatedAt)}</div>
          </div>
        </div>
        <div className="actions">
          <GuardedButton allowed={allowed('skill.edit', s) && s.stage !== 'deprecated'} reason={s.stage === 'deprecated' ? 'Restore it to edit' : `Needs ${minimumRole('skill.edit')} role or ownership`} onClick={() => nav(`/skills/${s.id}/edit`)}>
            <Pencil size={14} /> Edit
          </GuardedButton>
          <GuardedButton className={s.stage === 'published' ? 'btn danger' : 'btn primary'} allowed={primary.why.length === 0} reason={primary.why[0]} onClick={primary.run}>
            {primary.icon} {primary.label}
          </GuardedButton>
        </div>
      </div>

      <Lens info={LENS.detail} />

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="grid g-main">
        <div className="stack gap-16">
          {tab === 'overview' && (
            <>
              <section className="card card-body">
                <h2 style={{ marginBottom: 6 }}>What it does</h2>
                <p className="secondary">{s.description}</p>
                <div className="label" style={{ marginTop: 16, marginBottom: 8 }}>Triggers when someone says</div>
                <div className="row wrap">{s.triggers.map((t) => <span key={t} className="badge">“{t}”</span>)}</div>
                {s.examples.length > 0 && (
                  <>
                    <div className="label" style={{ marginTop: 16, marginBottom: 8 }}>Example requests</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)' }}>{s.examples.map((e) => <li key={e}>{e}</li>)}</ul>
                  </>
                )}
              </section>
              <section className="card">
                <div className="card-head">
                  <div><h2>Weekly runs</h2><p>{series.length > 1 ? 'Split by team' : 'Last 12 weeks'}</p></div>
                  {series.length > 1 && <Legend items={series} />}
                </div>
                <div className="card-body">
                  {sum(s.usage) === 0
                    ? <Empty title="No runs yet">Usage appears here once the skill is published.</Empty>
                    : <LineChart series={series.length ? series : [{ id: 'all', label: 'Runs', color: 'var(--s1)', values: s.usage }]} labels={WEEK_LABELS} height={220} area={series.length <= 1} />}
                </div>
              </section>
            </>
          )}

          {tab === 'source' && (
            <section className="card card-body">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <div><h2>SKILL.md</h2><p className="muted" style={{ fontSize: 12.5 }}>Generated from the fields below — drop it in <span className="mono">.claude/skills/{s.name}/</span></p></div>
                <div className="row">
                  <button className="btn sm" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</button>
                  <button className="btn sm" onClick={download}><Download size={13} /> Download</button>
                </div>
              </div>
              <Highlighted text={md} />
            </section>
          )}

          {tab === 'versions' && (
            <section className="card card-body">
              <h2 style={{ marginBottom: 16 }}>Version history</h2>
              <div className="timeline">
                {s.versions.map((v, i) => (
                  <div key={v.version + v.at} className={`tl-item ${i === 0 ? 'current' : ''}`}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono" style={{ fontWeight: 600 }}>v{v.version}</span>
                      {i === 0 && <span className="badge" style={{ height: 20 }}>Current</span>}
                      <span className="muted" style={{ fontSize: 12.5 }}>{dateLabel(v.at)}</span>
                    </div>
                    <p className="secondary" style={{ marginTop: 4 }}>{v.note}</p>
                    <div className="row muted" style={{ gap: 6, marginTop: 6, fontSize: 12.5 }}><Avatar member={member(v.authorId)} />{member(v.authorId)?.name}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'access' && (
            <section className="card">
              <div className="card-head"><div><h2>Who can use this skill</h2><p>Teams without access won’t see it in Claude</p></div></div>
              <div className="card-body">
                <table className="table">
                  <thead><tr><th>Team</th><th className="r">Runs · 12 wks</th><th className="r">Share</th><th className="r">Access</th></tr></thead>
                  <tbody>
                    {teams.map((t) => {
                      const r = sum(s.usageByTeam[t.id] ?? [])
                      const total = Math.max(1, sum(s.usage))
                      const on = s.teamIds.includes(t.id)
                      return (
                        <tr key={t.id}>
                          <td><TeamTag id={t.id} /></td>
                          <td className="r num">{on ? fmt(r) : '—'}</td>
                          <td className="r num muted">{on && r ? `${Math.round((r / total) * 100)}%` : '—'}</td>
                          <td className="r">
                            <Switch checked={on} label={`Access for ${t.name}`} disabledReason={allowed('access.manage') ? undefined : `Needs ${minimumRole('access.manage')} role`}
                              onChange={() => { dispatch({ type: 'toggleAccess', id: s.id, teamId: t.id }); toast(`${on ? 'Removed' : 'Gave'} ${t.name} access`) }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'discussion' && (
            <section className="card card-body">
              <h2 style={{ marginBottom: 12 }}>Discussion</h2>
              {s.comments.length === 0 && <Empty title="No comments yet">Reviewers’ questions and decisions live here.</Empty>}
              <div className="feed">
                {s.comments.map((c) => (
                  <div key={c.id} className="feed-item">
                    <Avatar member={member(c.authorId)} />
                    <div className="what"><b>{member(c.authorId)?.name}</b><div style={{ color: 'var(--ink)', marginTop: 2 }}>{c.text}</div></div>
                    <div className="when">{ago(c.at)}</div>
                  </div>
                ))}
              </div>
              {allowed('skill.comment') ? (
                <form className="row mt-16" style={{ alignItems: 'flex-start' }} onSubmit={(e) => { e.preventDefault(); if (!draft.trim()) return; dispatch({ type: 'comment', id: s.id, text: draft.trim() }); setDraft('') }}>
                  <Avatar member={me} />
                  <textarea className="textarea" rows={2} placeholder="Ask a question or leave a review note…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Comment" />
                  <button className="btn primary" type="submit" disabled={!draft.trim()}>Comment</button>
                </form>
              ) : <p className="muted mt-16" style={{ fontSize: 12.5 }}>Viewers can read the discussion but not comment.</p>}
            </section>
          )}
        </div>

        <aside className="stack gap-16">
          {s.source && (
            <section className="card card-body">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><h3>Where it comes from</h3>{s.source.latest && <span className="badge">Update upstream</span>}</div>
              <SourceBlock skill={s} />
            </section>
          )}
          <section className="card card-body">
            <div className="stack gap-12">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Owner</span>
                <span className="row" style={{ gap: 6 }}><Avatar member={owner} />{owner?.name}</span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Runs · 4 wks</span><b className="num">{fmt(runs4)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Time saved per run</span><b className="num">{s.minutesSaved} min</b></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Rating</span><b className="row num" style={{ gap: 4 }}>{s.rating ? <><Star size={13} fill="currentColor" color="var(--ink-3)" />{s.rating.toFixed(1)}</> : '—'}</b></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Created</span><span>{dateLabel(s.createdAt)}</span></div>
            </div>
          </section>

          <section className="card card-body">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h3>Approvals</h3>
              <span className="num muted">{s.approvals.length} / {need}</span>
            </div>
            <div className="meter" style={{ marginBottom: 12 }}>
              {Array.from({ length: need }).map((_, i) => <span key={i} style={{ flex: 1, background: i < s.approvals.length ? 'var(--good)' : 'var(--surface-3)', borderRadius: 999 }} />)}
            </div>
            {s.approvals.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>No approvals yet.</p>}
            <div className="stack gap-4">
              {s.approvals.map((a) => <span key={a} className="row" style={{ gap: 6, fontSize: 13 }}><Avatar member={member(a)} />{member(a)?.name}<Check size={13} color="var(--good)" /></span>)}
            </div>
            {isRisky(s) && <p className="row muted" style={{ fontSize: 12, marginTop: 12, gap: 6, alignItems: 'flex-start' }}><ShieldAlert size={14} style={{ flex: 'none', marginTop: 1 }} />Uses {s.tools.filter((t) => /^(Bash|Write|Edit)/.test(t)).join(', ')} — needs two approvals by policy.</p>}
          </section>

          <section className="card card-body">
            <h3 style={{ marginBottom: 10 }}>Quality</h3>
            <div className="stack gap-12" style={{ fontSize: 13 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="row" style={{ gap: 6 }}><FlaskConical size={14} color="var(--ink-3)" />Eval suite</span>
                {s.hasEvals ? <span className="row" style={{ gap: 4, color: 'var(--good-ink)', fontWeight: 550 }}><Check size={13} />Attached</span>
                  : <GuardedButton className="btn sm" allowed={allowed('skill.edit', s)} reason="Needs ownership or Maintainer role" onClick={() => { dispatch({ type: 'attachEvals', id: s.id }); toast('Eval suite attached — 6 cases passing') }}>Attach</GuardedButton>}
              </div>
              <div>
                <span className="row" style={{ gap: 6, marginBottom: 8 }}><Wrench size={14} color="var(--ink-3)" />Allowed tools</span>
                <div className="row wrap" style={{ gap: 4 }}>{s.tools.length ? s.tools.map((t) => <span key={t} className="badge mono" style={{ fontSize: 11 }}>{t}</span>) : <span className="muted">None</span>}</div>
              </div>
            </div>
          </section>

          <section className="card card-body">
            <h3 style={{ marginBottom: 10 }}>Shared with</h3>
            <div className="row wrap">{s.teamIds.map((t) => <TeamTag key={t} id={t} />)}</div>
          </section>
        </aside>
      </div>
    </main>
  )
}
