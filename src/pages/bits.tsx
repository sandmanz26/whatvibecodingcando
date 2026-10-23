import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Skill } from '../data/types'
import { useStore } from '../store/store'
import { KIND_LABEL, cmpVersion, fmt, recent, skillByTeam, teamsUsing, type Issue } from '../lib/logic'
import { SeverityTag } from '../components/ui'

const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)', 'var(--seq-7)']

/** Runs per week in one team, as a shaded cell. Blank when the team doesn't have it installed. */
function Cell({ value, max, installed, home }: { value: number; max: number; installed: boolean; home: boolean }) {
  if (!installed) return <td className="mx-cell"><span className="mx-none" aria-label="Not installed">·</span></td>
  const step = value <= 0 ? -1 : Math.min(SEQ.length - 1, Math.floor((Math.sqrt(value) / Math.sqrt(max)) * SEQ.length))
  return (
    <td className="mx-cell">
      <span className={`mx-box ${home ? 'home' : ''}`} style={{ background: step < 0 ? 'var(--surface-2)' : SEQ[step], color: step >= 4 ? '#fff' : 'var(--ink)' }}
        title={`${value ? `${value.toFixed(value < 10 ? 1 : 0)} runs a week` : 'Installed, no runs in 4 weeks'}${home ? ' · owning team' : ''}`}>
        {value ? (value < 10 ? value.toFixed(1) : fmt(value)) : '0'}
      </span>
    </td>
  )
}

/** Who uses what: skills down, teams across, runs per week in each team's projects. */
export function UsageMatrix({ skills, base = '' }: { skills: Skill[]; base?: string }) {
  const inv = useStore()
  const nav = useNavigate()
  const rows = skills.map((s) => {
    const by = skillByTeam(inv, s.id)
    const using = teamsUsing(inv, s.id)
    return { s, using, per: Object.fromEntries(inv.teams.map((t) => [t.id, recent(by[t.id] ?? []) / 4])) }
  })
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.per)))
  return (
    <div className="matrix">
      <table>
        <thead>
          <tr>
            <th>Skill</th>
            {inv.teams.map((t) => <th key={t.id}><span className="row" style={{ gap: 6, justifyContent: 'center' }}><i className="team-sq" style={{ background: `var(--s${t.slot})` }} />{t.name}</span></th>)}
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, using, per }) => (
            <tr key={s.id} className="clickable" onClick={() => nav(`${base}/skills/${s.id}`)}>
              <td><b style={{ fontWeight: 550 }}>{s.title}</b><div className="muted" style={{ fontSize: 12 }}>by {inv.team(s.teamId)?.name}</div></td>
              {inv.teams.map((t) => <Cell key={t.id} value={per[t.id]} max={max} installed={using.includes(t.id)} home={t.id === s.teamId} />)}
              <td>{using.length > 1 ? <span className="badge">Shared · {using.length} teams</span> : <span className="muted" style={{ fontSize: 12.5 }}>One team</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row wrap" style={{ gap: 14, marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
        <span>Number = runs a week in that team’s projects, last 4 weeks</span>
        <span className="row" style={{ gap: 6 }}><span className="mx-box home" style={{ width: 18, height: 14, background: 'var(--surface-2)' }} />Outline = the team that owns it</span>
        <span>· = not installed</span>
      </div>
    </div>
  )
}

export function IssueCard({ issue, compact = false, base = '' }: { issue: Issue; compact?: boolean; base?: string }) {
  const { skill, project, dismissed, setDismissed, toast } = useStore()
  const s = skill(issue.skillId)!
  const other = issue.otherId ? skill(issue.otherId) : undefined
  const off = dismissed.includes(issue.id)
  if (compact) return (
    <Link to={`${base}/health?kind=${issue.kind}`} className="issue-row">
      <SeverityTag level={issue.severity} />
      <span style={{ minWidth: 0 }}><b>{issue.title}</b><span className="muted">{issue.action}</span></span>
    </Link>
  )
  return (
    <article className={`card issue ${off ? 'off' : ''}`}>
      <div className="row wrap" style={{ gap: 10 }}>
        <SeverityTag level={issue.severity} />
        <span className="badge outline">{KIND_LABEL[issue.kind]}</span>
        <div style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={() => { setDismissed(issue.id, !off); toast(off ? 'Back on the list' : 'Left as is — it won’t count as open') }}>
          {off ? 'Put back on the list' : 'Leave as is'}
        </button>
      </div>
      <h3>{issue.title}</h3>
      <p className="muted">{issue.detail}</p>
      <p className="issue-action"><ArrowRight size={14} /> {issue.action}</p>
      <div className="row wrap" style={{ gap: 6 }}>
        <Link className="chip" to={`${base}/skills/${s.id}`}>{s.title}</Link>
        {other && <Link className="chip" to={`${base}/skills/${other.id}`}>{other.title}</Link>}
        {issue.projectIds.map((p) => <Link key={p} className="chip mono" to={`${base}/projects/${p}`}>{project(p)?.name}</Link>)}
      </div>
    </article>
  )
}

/** The version a project runs, against the latest. */
export function VersionTag({ version, latest, edited }: { version: string; latest: string; edited?: boolean }) {
  if (edited) return <span className="badge" style={{ color: 'var(--critical-ink)' }}>v{version}, edited copy</span>
  const behind = cmpVersion(version, latest) < 0
  return behind ? <span className="badge" style={{ color: '#8f6100' }}>v{version} · behind</span> : <span className="muted num">v{version}</span>
}
