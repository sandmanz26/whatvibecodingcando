import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../store/store'
import { LineChart } from '../components/charts'
import { DEMO_NOW, WEEK_LABELS } from '../data/seed'
import { ago, can, evaluate, fmt, requiredApprovals, sum } from '../lib/logic'
import { Shelf } from './Shelf'
import { Face, firstName, longDate } from './bits'

const VERB: Record<string, string> = {
  created: 'started', updated: 'edited', submitted: 'sent for review', approved: 'approved', published: 'put on the shelf',
  deprecated: 'retired', commented: 'commented on', access: 'lent out', role: 'changed a role', policy: 'changed a rule', restored: 'took back',
}

export default function V2Home() {
  const { skills, members, policies, audit, me, member, skill } = useStore()
  const nav = useNavigate()

  const n = useMemo(() => {
    const weeklyHours = Array.from({ length: 12 }, (_, i) => Math.round(sum(skills.map((s) => (s.usage[i] ?? 0) * s.minutesSaved)) / 60))
    const hours4 = sum(weeklyHours.slice(-4))
    const runs4 = sum(skills.map((s) => sum(s.usage.slice(-4))))
    const people = new Set(members.map((m) => m.id)).size
    const best = weeklyHours.indexOf(Math.max(...weeklyHours))
    const bestSkill = [...skills].sort((a, b) => (b.usage[best] ?? 0) * b.minutesSaved - (a.usage[best] ?? 0) * a.minutesSaved)[0]
    return { weeklyHours, hours4, runs4, people, best, bestSkill }
  }, [skills, members])

  // Things whose next step is this person's, most urgent first.
  const yours = useMemo(() => {
    const out: { id: string; to: string; title: string; detail: string; tag: string; tone: string; who?: string }[] = []
    evaluate(skills, members, policies).filter((v) => v.severity === 'critical').forEach((v) => {
      const s = skill(v.skillId)!
      out.push({ id: `v${v.skillId}`, to: `/v2/skills/${s.id}`, title: s.title, detail: v.message, tag: 'Needs an owner', tone: 'neg', who: s.ownerId })
    })
    skills.filter((s) => s.stage === 'review' && can(me, 'skill.approve', s) && !s.approvals.includes(me.id)).forEach((s) =>
      out.push({ id: `r${s.id}`, to: `/v2/review/${s.id}`, title: s.title, detail: `${firstName(member(s.ownerId))} asked · ${s.approvals.length} of ${requiredApprovals(s, policies)} approvals`, tag: 'Review', tone: 'teal', who: s.ownerId }))
    skills.filter((s) => s.stage === 'approved' && can(me, 'skill.publish', s)).forEach((s) =>
      out.push({ id: `a${s.id}`, to: `/v2/review/${s.id}`, title: s.title, detail: 'Approved, not on the shelf yet', tag: 'Publish', tone: 'pos', who: s.ownerId }))
    skills.filter((s) => s.stage === 'draft' && s.ownerId === me.id).forEach((s) =>
      out.push({ id: `d${s.id}`, to: `/v2/write/${s.id}`, title: s.title, detail: 'Your draft', tag: 'Finish', tone: '', who: s.ownerId }))
    return out
  }, [skills, members, policies, me, member, skill])

  const reviews = yours.filter((y) => y.tag === 'Review').length
  const fact = reviews
    ? `${reviews === 1 ? 'One skill is' : `${reviews === 2 ? 'Two' : reviews} skills are`} waiting on your review.`
    : yours.length ? `${yours.length === 1 ? 'One thing needs' : `${yours.length} things need`} you today.`
      : 'Nothing is waiting on you.'
  const team = members.length
  const inReview = skills.filter((s) => s.stage === 'review').length
  const approved = skills.filter((s) => s.stage === 'approved').length
  const onShelf = skills.filter((s) => s.stage === 'published').length

  return (
    <main className="v2-canvas">
      <div className="v2-col v2-enter">
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            {/* Two deliberate lines: who, then today's one fact. */}
            <h1 className="v2-greeting">Morning, Arunika Labs.<br className="v2-br" /> {fact}</h1>
            <p className="v2-sub">{longDate(DEMO_NOW)} · {firstName(me)}, your shelf saved the team {fmt(n.hours4)} hours in the last four weeks.</p>
          </div>
          {yours.length > 0 && <button className="v2-btn primary" onClick={() => nav(yours[0].to)}>{yours[0].tag === 'Review' ? 'Start reviewing' : 'Open the first one'} <ArrowRight size={15} /></button>}
        </header>

        <section className="v2-grid" style={{ marginTop: 50 }} aria-label="This month in numbers">
          <div className="v2-tile lead v2-span-3">
            <span className="label">Hours saved, last 4 weeks</span>
            <span className="value">{fmt(n.hours4)}<small>h</small></span>
            <span className="cap">About {(n.hours4 / 160).toFixed(1)} people working full time</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">Skill runs, last 4 weeks</span>
            <span className="value">{fmt(n.runs4)}</span>
            <span className="cap">By {team} people in 4 teams</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">On the shelf</span>
            <span className="value">{onShelf}</span>
            <span className="cap">Published and lent to teams</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">Waiting for review</span>
            <span className="value">{inReview}</span>
            <span className="cap">{approved ? `${approved} more approved, ready to publish` : 'Ready when you are'}</span>
          </div>
        </section>

        <div className="v2-grid" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
          <section className="v2-panel v2-span-9" aria-labelledby="shelf-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="shelf-h">The shelf</h2>
              <span className="v2-chip">{skills.length} skills</span>
              <Link className="v2-link" to="/v2/shelf">View all</Link>
            </div>
            <Shelf skills={skills} height={226} />
          </section>

          <section className="v2-panel v2-span-3" aria-labelledby="yours-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="yours-h">Waiting on you</h2>
              <span className="v2-chip">{yours.length}</span>
            </div>
            {yours.length === 0 ? (
              <div className="v2-empty">{me.role === 'Viewer' ? 'Viewers read and use skills; reviews go to Maintainers.' : 'Nothing needs you. New reviews land here first.'}</div>
            ) : (
              <div className="v2-rows">
                {yours.slice(0, 4).map((y) => (
                  <button key={y.id} className="v2-row" onClick={() => nav(y.to)}>
                    <span className="main">
                      <b>{y.title}</b>
                      <span><span className={`v2-chip ${y.tone}`} style={{ marginRight: 6 }}>{y.tag}</span>{y.detail}</span>
                    </span>
                  </button>
                ))}
                {yours.length > 4 && <Link className="v2-link" to="/v2/review" style={{ paddingTop: 4 }}>{yours.length - 4} more on the review desk</Link>}
              </div>
            )}
          </section>
        </div>

        <div className="v2-grid" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
          <section className="v2-panel v2-span-6" aria-labelledby="hours-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="hours-h">Hours saved each week</h2>
              <span className="v2-small" style={{ marginLeft: 'auto' }}>Last 12 weeks</span>
            </div>
            <div className="v2-inner">
              <LineChart series={[{ id: 'h', label: 'Hours saved', color: 'var(--accent)', values: n.weeklyHours }]} labels={WEEK_LABELS} height={196} area />
            </div>
            <p className="v2-note" style={{ marginTop: 12 }}>
              Best week was {WEEK_LABELS[n.best]}: {fmt(n.weeklyHours[n.best])} h, led by {n.bestSkill.title}.
            </p>
          </section>

          <section className="v2-panel v2-span-6" aria-labelledby="lately-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="lately-h">Lately on the shelf</h2>
              <Link className="v2-link" to="/governance?tab=audit">Full history</Link>
            </div>
            <div className="v2-rows">
              {audit.slice(0, 4).map((a) => {
                const s = a.skillId ? skill(a.skillId) : undefined
                const who = member(a.actorId)
                return (
                  <button key={a.id} className="v2-row" onClick={() => s && nav(`/v2/skills/${s.id}`)} style={{ cursor: s ? 'pointer' : 'default' }}>
                    <Face member={who} />
                    <span className="main"><b>{firstName(who)} {VERB[a.action] ?? a.action}{s ? ` ${s.title}` : ''}</b><span>{a.detail}</span></span>
                    <span className="side">{ago(a.at)}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
