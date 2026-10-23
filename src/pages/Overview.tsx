import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Plus, ArrowRight } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { LineChart, Legend, Sparkline, BarList } from '../components/charts'
import { GuardedButton, Lens, Severity, StageBadge } from '../components/ui'
import { LENS } from '../data/lens'
import { WEEK_LABELS } from '../data/seed'
import { can, compact, evaluate, fmt, hoursSaved, minimumRole, requiredApprovals, sum, teamWeekly } from '../lib/logic'

function Delta({ now, prev, suffix = 'vs prior 4 wks' }: { now: number; prev: number; suffix?: string }) {
  if (!prev) return <span className="delta"><span className="vs">New this period</span></span>
  const pct = ((now - prev) / prev) * 100
  const up = pct >= 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {Math.abs(pct).toFixed(1)}%<span className="vs">{suffix}</span>
    </span>
  )
}

export default function Overview() {
  const { skills, teams, members, policies, me, member, skill } = useStore()
  const allowed = useCan()
  const nav = useNavigate()

  const m = useMemo(() => {
    const live = skills.filter((s) => s.stage !== 'deprecated')
    const weekly = Array(12).fill(0)
    skills.forEach((s) => s.usage.forEach((v, i) => (weekly[i] += v)))
    const prevSkills = skills.map((s) => ({ ...s, usage: s.usage.slice(0, 8) }))
    const activeAuthors = new Set(live.map((s) => s.ownerId)).size
    return {
      weekly,
      runs4: sum(weekly.slice(-4)),
      runsPrev4: sum(weekly.slice(-8, -4)),
      hours: hoursSaved(skills),
      hoursPrev: hoursSaved(prevSkills),
      published: skills.filter((s) => s.stage === 'published').length,
      publishedSeries: Array.from({ length: 12 }, (_, i) => skills.filter((s) => s.stage === 'published' && s.usage.slice(0, i + 1).some((v) => v > 0)).length),
      activeAuthors,
    }
  }, [skills])

  const series = teams.map((t) => ({ id: t.id, label: t.name, color: `var(--s${t.slot})`, values: teamWeekly(skills, t.id) }))
  const top = [...skills].filter((s) => s.stage === 'published').sort((a, b) => sum(b.usage.slice(-4)) - sum(a.usage.slice(-4))).slice(0, 6)

  // Things that need *this* user's decision.
  const inbox = useMemo(() => {
    const items: { id: string; to: string; title: string; detail: React.ReactNode; tag: React.ReactNode }[] = []
    skills.filter((s) => s.stage === 'review' && can(me, 'skill.approve', s) && !s.approvals.includes(me.id)).forEach((s) =>
      items.push({ id: 'r' + s.id, to: `/skills/${s.id}`, title: s.title, detail: `${s.approvals.length}/${requiredApprovals(s, policies)} approvals · by ${member(s.ownerId)?.name}`, tag: <StageBadge stage="review" /> }))
    skills.filter((s) => s.stage === 'approved' && can(me, 'skill.publish', s)).forEach((s) =>
      items.push({ id: 'a' + s.id, to: '/pipeline', title: s.title, detail: 'Approved — ready to publish', tag: <StageBadge stage="approved" /> }))
    evaluate(skills, members, policies).filter((v) => v.severity === 'critical').forEach((v) =>
      items.push({ id: 'v' + v.skillId + v.policyId, to: '/governance', title: skill(v.skillId)?.title ?? '', detail: v.message, tag: <Severity level="critical" /> }))
    skills.filter((s) => s.stage === 'draft' && s.ownerId === me.id).forEach((s) =>
      items.push({ id: 'd' + s.id, to: `/skills/${s.id}/edit`, title: s.title, detail: 'Your draft — finish and submit', tag: <StageBadge stage="draft" /> }))
    return items
  }, [skills, members, policies, me, member, skill])

  // The demo clock is frozen at 09:00.
  const greeting = 'Good morning'

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{greeting}, {me.name.split(' ')[0]}</h1>
          <p>Here’s how Arunika Labs is using Claude skills over the last 4 weeks.</p>
        </div>
        <div className="actions">
          <GuardedButton className="btn primary" allowed={allowed('skill.create')} reason={`Needs ${minimumRole('skill.create')} role`} onClick={() => nav('/skills/new')}>
            <Plus size={15} /> New skill
          </GuardedButton>
        </div>
      </div>

      <Lens info={LENS.overview} />

      <div className="grid g-kpi">
        <section className="card hero">
          <div className="stat-label">Hours saved · last 4 weeks</div>
          <div className="hero-value num">{fmt(m.hours)}<small>hrs</small></div>
          <div className="stat-foot" style={{ marginTop: 6 }}>
            <Delta now={m.hours} prev={m.hoursPrev} />
            <span className="muted" style={{ fontSize: 12.5 }}>≈ {fmt(m.hours / 160)} FTE-months</span>
          </div>
        </section>
        <section className="card stat">
          <div className="stat-label">Skill runs</div>
          <div className="stat-value num">{compact(m.runs4)}</div>
          <div className="stat-foot"><Delta now={m.runs4} prev={m.runsPrev4} suffix="" /><Sparkline values={m.weekly} /></div>
        </section>
        <section className="card stat">
          <div className="stat-label">Published skills</div>
          <div className="stat-value num">{m.published}</div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>{m.activeAuthors} authors</span><Sparkline values={m.publishedSeries} /></div>
        </section>
        <Link to="/pipeline" className="card stat" style={{ transition: 'border-color .15s' }}>
          <div className="stat-label">Waiting on review</div>
          <div className="stat-value num">{skills.filter((s) => s.stage === 'review').length}</div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>{skills.filter((s) => s.stage === 'approved').length} approved, not live</span><ArrowRight size={14} color="var(--ink-3)" /></div>
        </Link>
      </div>

      <div className="grid g-main mt-16">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Weekly runs by team</h2>
              <p>All skills, last 12 weeks</p>
            </div>
            <Legend items={series} />
          </div>
          <div className="card-body"><LineChart series={series} labels={WEEK_LABELS} height={260} /></div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Needs your attention</h2>
              <p>{inbox.length ? `${inbox.length} item${inbox.length > 1 ? 's' : ''} for ${me.role.toLowerCase()}s like you` : 'Nothing waiting on you'}</p>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {inbox.length === 0 && (
              <div className="empty" style={{ padding: '32px 8px' }}>
                <strong>You’re all caught up</strong>
                <span style={{ fontSize: 13 }}>{me.role === 'Viewer' ? 'Viewers can browse and use skills, but don’t review them.' : 'New reviews and policy issues will show up here.'}</span>
              </div>
            )}
            <div className="stack">
              {inbox.slice(0, 6).map((i) => (
                <Link key={i.id} to={i.to} className="row" style={{ padding: '10px 8px', margin: '0 -8px', borderRadius: 8, alignItems: 'flex-start', justifyContent: 'space-between' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 550, fontSize: 13 }}>{i.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{i.detail}</div>
                  </div>
                  {i.tag}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid g-2 mt-16">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Most-used skills</h2>
              <p>Runs in the last 4 weeks</p>
            </div>
            <Link to="/insights" className="btn ghost sm">Value <ArrowRight size={13} /></Link>
          </div>
          <div className="card-body">
            <BarList rows={top.map((s) => ({ id: s.id, label: s.title, value: sum(s.usage.slice(-4)), onClick: () => nav(`/skills/${s.id}`) }))} />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>From outside</h2>
              <p>Skills brought in from other repositories, pinned to a version</p>
            </div>
            <Link to="/skills?from=outside" className="btn ghost sm">All <ArrowRight size={13} /></Link>
          </div>
          <div className="card-body" style={{ paddingTop: 6 }}>
            <div className="feed">
              {skills.filter((s) => s.source).map((s) => (
                <Link key={s.id} to={`/skills/${s.id}`} className="feed-item" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className="what"><b>{s.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{s.source!.repo} · pinned v{s.source!.pinned}</div></div>
                  <div>
                    {!s.source!.vetted ? <span className="badge" style={{ color: 'var(--critical-ink)' }}>Needs security review</span>
                      : s.source!.latest ? <span className="badge">v{s.source!.latest} upstream</span>
                        : <span className="badge outline">Up to date</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
