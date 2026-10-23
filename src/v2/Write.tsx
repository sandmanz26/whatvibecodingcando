import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Circle, X } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { slugify } from '../data/seed'
import type { Category, Skill } from '../data/types'
import { bumpVersion, matchSkills, qualityChecks } from '../lib/logic'

const CATEGORIES: Category[] = ['Engineering', 'Design', 'Product', 'Support', 'Operations', 'Writing']
const TOOLS = ['Read', 'Grep', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(curl:*)', 'Write']

function blank(teamId: string): Skill {
  return {
    id: '', name: '', title: '', description: '', category: 'Operations', ownerId: '', teamIds: [teamId], stage: 'draft', version: '0.1.0',
    createdAt: '', updatedAt: '', triggers: [], instructions: '', examples: [], tools: ['Read'], usage: Array(12).fill(0), usageByTeam: {},
    rating: 0, minutesSaved: 15, reviewerIds: [], approvals: [], comments: [], versions: [], hasEvals: false,
  }
}

/** A textarea that grows with its text, so the page reads as a page. */
function Grow(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return <textarea ref={ref} rows={1} className="v2-write-area" {...props} />
}

export default function V2Write() {
  const { id } = useParams()
  const { skill, skills, teams, me, saveSkill, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const existing = id ? skill(id) : undefined
  const [s, setS] = useState<Skill>(() => existing ?? blank(me.teamId))
  const [trigger, setTrigger] = useState('')
  const [probe, setProbe] = useState('')
  const set = <K extends keyof Skill>(k: K, v: Skill[K]) => setS((x) => ({ ...x, [k]: v }))

  const clean = { ...s, name: slugify(s.title), examples: s.examples.filter((e) => e.trim()) }
  const checks = qualityChecks(clean)
  const ready = checks.filter((c) => c.ok).length
  const sim = useMemo(() => matchSkills(probe, [...skills.filter((x) => x.id !== s.id), { ...clean, id: '__draft', stage: 'published' as const }]),
    [probe, skills, clean, s.id])

  if (id && !existing) return <main className="v2-canvas"><div className="v2-col"><h1 className="v2-title">This skill isn’t on the shelf</h1></div></main>
  if (existing ? !allowed('skill.edit', existing) : !allowed('skill.create')) {
    return (
      <main className="v2-canvas"><div className="v2-col">
        <h1 className="v2-title">{existing ? `${existing.title} isn’t yours to edit` : 'Writing skills needs the Member role'}</h1>
        <p className="v2-sub">You’re viewing as {me.name}, a {me.role}. {me.role === 'Member' ? 'Members edit the skills they wrote; ask the owner, or comment on it.' : 'Viewers can read and use every skill on the shelf.'}</p>
        <Link className="v2-btn" style={{ marginTop: 20 }} to={existing ? `/v2/skills/${existing.id}` : '/v2/shelf'}>Back</Link>
      </div></main>
    )
  }

  const live = existing?.stage === 'published'
  const save = () => {
    if (s.title.trim().length < 3) return toast('Give it a name first', 'error')
    const saved = saveSkill(clean, !existing)
    toast(!existing ? `${saved.title} is on your desk as a draft` : live ? `Saved as v${saved.version} and sent for review` : 'Saved')
    nav(`/v2/skills/${saved.id}`)
  }
  const addTrigger = () => {
    const t = trigger.trim()
    if (t && !s.triggers.includes(t)) set('triggers', [...s.triggers, t])
    setTrigger('')
  }

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 className="v2-title">{existing ? `Editing ${existing.title}` : 'Write a skill'}</h1>
            <p className="v2-sub" style={{ marginTop: 4 }}>
              {live ? `It stays live while v${bumpVersion(existing!.version)} goes through review.` : 'Write it the way you’d explain it to a new colleague. Claude reads exactly this.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="v2-btn ghost" onClick={() => nav(-1)}>Cancel</button>
            <button className="v2-btn primary" onClick={save}>{!existing ? 'Save as draft' : live ? `Save v${bumpVersion(existing.version)} for review` : 'Save'}</button>
          </div>
        </header>

        <div className="v2-grid" style={{ marginTop: 32, alignItems: 'start' }}>
          <section className="v2-panel v2-span-8" aria-label="The skill">
            <div className="v2-doc" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <input className="v2-write-title" value={s.title} onChange={(e) => set('title', e.target.value)} placeholder="Name it after the job it does" aria-label="Name" autoFocus={!existing} />
                <p className="v2-small" style={{ marginTop: 4 }}>{slugify(s.title) ? `.claude/skills/${slugify(s.title)}/` : 'The folder name follows the title'}</p>
              </div>
              <div>
                <h2 style={{ margin: '0 0 6px' }}>What it does, and when Claude should use it</h2>
                <Grow value={s.description} onChange={(e) => set('description', e.target.value)} placeholder="Drafts customer-facing release notes from merged pull requests. Use before each release." aria-label="Description" />
              </div>
              <div>
                <h2 style={{ margin: '0 0 8px' }}>How people will ask for it</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {s.triggers.map((t) => (
                    <span key={t} className="v2-chip" style={{ height: 30, paddingRight: 4, fontSize: 13 }}>“{t}”
                      <button aria-label={`Remove ${t}`} onClick={() => set('triggers', s.triggers.filter((x) => x !== t))} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'grid', padding: 4 }}><X size={12} /></button>
                    </span>
                  ))}
                  <input className="v2-write-area" style={{ width: 240, height: 30, lineHeight: '30px' }} value={trigger} onChange={(e) => setTrigger(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTrigger() } }} onBlur={addTrigger} placeholder="Type a phrase, press Enter" aria-label="Add a trigger phrase" />
                </div>
              </div>
              <div>
                <h2 style={{ margin: '0 0 6px' }}>Instructions</h2>
                <Grow value={s.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder={'1. Read the whole thing before answering.\n2. …'} aria-label="Instructions" style={{ minHeight: 120 }} />
              </div>
              <div>
                <h2 style={{ margin: '0 0 6px' }}>An example request</h2>
                <Grow value={s.examples.join('\n')} onChange={(e) => set('examples', e.target.value.split('\n'))} placeholder="Draft the release notes for v4.12" aria-label="Examples, one per line" />
              </div>
            </div>
          </section>

          <aside className="v2-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <section className="v2-panel" aria-label="Ready for review">
              <div className="v2-panel-head"><h2 className="v2-section">Ready for review</h2><span className="v2-small num" style={{ marginLeft: 'auto' }}>{ready} of {checks.length}</span></div>
              <div className="v2-meter" style={{ marginBottom: 10 }}><i style={{ width: `${(ready / checks.length) * 100}%` }} /></div>
              {checks.map((c) => (
                <div key={c.id} className="v2-check" style={{ color: c.ok ? 'var(--text)' : 'var(--muted)' }}>
                  {c.ok ? <Check size={15} color="var(--accent)" strokeWidth={2.4} /> : <Circle size={15} />}
                  <span>{c.label}{!c.ok && <span className="v2-small" style={{ display: 'block' }}>{c.hint}</span>}</span>
                </div>
              ))}
            </section>

            <section className="v2-panel" aria-label="Would it trigger">
              <div className="v2-panel-head"><h2 className="v2-section">Would it trigger?</h2></div>
              <input className="v2-input" value={probe} onChange={(e) => setProbe(e.target.value)} placeholder={s.triggers[0] ? `Try “${s.triggers[0]}”` : 'Ask the way a teammate would'} aria-label="Test a request" />
              <div style={{ marginTop: 10 }}>
                {probe && sim.length === 0 && <p className="v2-note">No skill would pick this up; Claude answers on its own.</p>}
                {sim.map((r, i) => (
                  <div key={r.skill.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 40px', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.skill.id === '__draft' ? (s.title || 'This skill') + ' (yours)' : r.skill.title}</span>
                    <span className="v2-meter"><i style={{ width: `${r.score * 100}%`, background: r.skill.id === '__draft' ? 'var(--accent)' : 'var(--chart-3)' }} /></span>
                    <span className="num v2-small" style={{ textAlign: 'right', color: 'var(--text)' }}>{Math.round(r.score * 100)}%</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="v2-panel" aria-label="Details">
              <div className="v2-panel-head"><h2 className="v2-section">Shelf and lending</h2></div>
              <label className="v2-small" htmlFor="cat">Shelf</label>
              <select id="cat" className="v2-input" style={{ marginTop: 6, appearance: 'auto' }} value={s.category} onChange={(e) => set('category', e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <div className="v2-small" style={{ marginTop: 14 }}>Lend to</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {teams.map((t) => {
                  const on = s.teamIds.includes(t.id)
                  return <button key={t.id} className="v2-btn sm" aria-pressed={on} style={on ? { background: 'var(--text)', color: '#fff' } : undefined}
                    onClick={() => set('teamIds', on ? s.teamIds.filter((x) => x !== t.id) : [...s.teamIds, t.id])}>{t.name}</button>
                })}
              </div>
              <div className="v2-small" style={{ marginTop: 14 }}>It may use</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {TOOLS.map((t) => {
                  const on = s.tools.includes(t)
                  return <button key={t} className="v2-btn sm" aria-pressed={on} style={on ? { background: 'var(--text)', color: '#fff' } : undefined}
                    onClick={() => set('tools', on ? s.tools.filter((x) => x !== t) : [...s.tools, t])}>{t}</button>
                })}
              </div>
              <label className="v2-small" htmlFor="mins" style={{ display: 'block', marginTop: 14 }}>Minutes it saves each time</label>
              <input id="mins" type="number" min={1} max={480} className="v2-input num" style={{ marginTop: 6, width: 120 }} value={s.minutesSaved} onChange={(e) => set('minutesSaved', Math.max(1, Number(e.target.value) || 1))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={s.hasEvals} onChange={() => set('hasEvals', !s.hasEvals)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                Eval suite attached (needed before it goes on the shelf)
              </label>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
