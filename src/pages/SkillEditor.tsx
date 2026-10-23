import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Circle, Plus, Trash2, Wand2, Info, Sparkles } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { CATEGORIES, Empty, Lens, Switch } from '../components/ui'
import { ScoreRing } from '../components/charts'
import { LENS } from '../data/lens'
import { slugify } from '../data/seed'
import type { Skill } from '../data/types'
import { bumpVersion, matchSkills, qualityChecks, toSkillMd } from '../lib/logic'

const TOOL_OPTIONS = ['Read', 'Grep', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(curl:*)', 'Bash', 'Write', 'Edit']

const TEMPLATES: Record<string, Partial<Skill>> = {
  Reviewer: {
    title: 'Security review',
    category: 'Engineering',
    description: 'Reviews a change for common security issues: injection, auth gaps, secrets in code and unsafe dependencies. Use when a PR touches auth, payments or user input.',
    triggers: ['security review', 'is this safe', 'check for vulnerabilities'],
    instructions: '1. List every entry point that takes user input.\n2. Check each against the OWASP top 10.\n3. Rate findings critical / high / medium / low.\n4. Suggest a concrete fix for each finding.',
    examples: ['Security review for the new login endpoint'],
    tools: ['Read', 'Grep'],
  },
  Writer: {
    title: 'Customer newsletter',
    category: 'Writing',
    description: 'Drafts the monthly customer newsletter from release notes and blog posts in our voice. Use at the start of each month.',
    triggers: ['newsletter', 'monthly update for customers'],
    instructions: 'Open with the single most useful change. Max 300 words. One CTA. Plain, warm, specific — no hype words.',
    examples: ['Draft the November newsletter'],
    tools: ['Read'],
  },
  Analyst: {
    title: 'Metric explainer',
    category: 'Product',
    description: 'Explains why a metric moved by checking seasonality, recent releases and segment shifts. Use when a dashboard number looks surprising.',
    triggers: ['why did this metric', 'explain the drop', 'what happened to signups'],
    instructions: 'Rule out data issues first. Then check releases in the window, then segment mix. End with confidence: high / medium / low.',
    examples: ['Why did trial conversions drop last week?'],
    tools: ['Read'],
  },
}

function blank(teamId: string): Skill {
  return {
    id: '', name: '', title: '', description: '', category: 'Operations', ownerId: '', teamIds: [teamId], stage: 'draft', version: '0.1.0',
    createdAt: '', updatedAt: '', triggers: ['', ''], instructions: '', examples: [''], tools: [], usage: Array(12).fill(0), usageByTeam: {},
    rating: 0, minutesSaved: 15, reviewerIds: [], approvals: [], comments: [], versions: [], hasEvals: false,
  }
}

function ListInput({ label, hint, values, onChange, placeholder }: { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {hint && <span className="hint">{hint}</span>}
      <div className="list-input">
        {values.map((v, i) => (
          <div key={i} className="item">
            <input className="input" value={v} placeholder={placeholder} aria-label={`${label} ${i + 1}`} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="btn ghost icon" aria-label="Remove" onClick={() => onChange(values.filter((_, j) => j !== i))} disabled={values.length <= 1}><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...values, ''])}><Plus size={13} /> Add</button>
      </div>
    </div>
  )
}

export default function SkillEditor() {
  const { id } = useParams()
  const isNew = !id
  const { skill, skills, teams, me, saveSkill, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const existing = id ? skill(id) : undefined
  const [s, setS] = useState<Skill>(() => existing ?? blank(me.teamId))
  const [prompt, setPrompt] = useState('')
  const set = <K extends keyof Skill>(k: K, v: Skill[K]) => setS((x) => ({ ...x, [k]: v }))

  const clean = { ...s, name: slugify(s.title), triggers: s.triggers.filter((t) => t.trim()), examples: s.examples.filter((e) => e.trim()) }
  const checks = qualityChecks(clean)
  const score = checks.filter((c) => c.ok).length / checks.length
  const md = toSkillMd(clean)

  // Simulate against the live catalog, with this draft swapped in as if it were published.
  const sim = useMemo(() => {
    const pool = [...skills.filter((x) => x.id !== s.id), { ...clean, id: '__draft', stage: 'published' as const }]
    return matchSkills(prompt, pool)
  }, [prompt, skills, clean, s.id])

  if (!isNew && !existing) return <main className="page"><div className="card"><Empty title="Skill not found" /></div></main>
  if (isNew ? !allowed('skill.create') : !allowed('skill.edit', existing)) {
    return (
      <main className="page">
        <div className="card"><Empty title="You can’t edit this skill">
          <span>Viewing as {me.name} ({me.role}). {me.role === 'Member' ? 'Members can only edit skills they own.' : 'Viewers have read-only access.'}</span>
          <Link className="btn sm" to={existing ? `/skills/${existing.id}` : '/skills'}>Go back</Link>
        </Empty></div>
      </main>
    )
  }

  const live = existing?.stage === 'published'
  const canSave = s.title.trim().length >= 3

  const save = () => {
    const saved = saveSkill(clean, isNew)
    toast(isNew ? `Draft “${saved.title}” created` : live ? `Saved as v${saved.version} — sent to review` : 'Changes saved')
    nav(`/skills/${saved.id}`)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{isNew ? 'New skill' : `Edit ${existing!.title}`}</h1>
          <p>{isNew ? 'Describe what the skill does and when Claude should use it. The SKILL.md writes itself.' : `v${existing!.version} · ${existing!.name}`}</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => nav(-1)}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!canSave}><Check size={15} /> {isNew ? 'Create draft' : live ? `Save as v${bumpVersion(existing!.version)}` : 'Save changes'}</button>
        </div>
      </div>

      <Lens info={LENS.editor} />

      {live && (
        <div className="card row" style={{ padding: '10px 14px', marginBottom: 16, gap: 10, fontSize: 13 }}>
          <Info size={15} color="var(--accent)" />
          <span className="secondary">This skill is live. Saving creates <b>v{bumpVersion(existing!.version)}</b>, clears approvals and sends it back to review — the current version stays live until then.</span>
        </div>
      )}

      <div className="editor">
        <div className="stack gap-16">
          {isNew && (
            <section className="card card-body">
              <div className="row" style={{ gap: 8, marginBottom: 10 }}><Wand2 size={15} /><h3>Start from a template</h3></div>
              <div className="row wrap">
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <button key={k} className="chip" onClick={() => setS((x) => ({ ...x, ...t }))}>{k} · {t.title}</button>
                ))}
              </div>
            </section>
          )}

          <section className="card card-body stack gap-16">
            <div className="grid g-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="title">Name</label>
                <input id="title" className="input" value={s.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Release notes" />
                <span className="hint mono">{slugify(s.title) || 'skill-slug'}</span>
              </div>
              <div className="field">
                <label htmlFor="cat">Category</label>
                <select id="cat" className="select" value={s.category} onChange={(e) => set('category', e.target.value as Skill['category'])}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="desc">Description</label>
              <span className="hint">Claude reads this to decide when to use the skill. Say what it does and “Use when …”.</span>
              <textarea id="desc" className="textarea" rows={3} value={s.description} onChange={(e) => set('description', e.target.value)} />
              <span className="hint num" style={{ textAlign: 'right', color: s.description.length < 60 ? 'var(--critical-ink)' : undefined }}>{s.description.length} / 60+ characters</span>
            </div>
            <ListInput label="Trigger phrases" hint="How people actually ask for this." values={s.triggers} onChange={(v) => set('triggers', v)} placeholder="e.g. write release notes" />
            <div className="field">
              <label htmlFor="instr">Instructions</label>
              <span className="hint">Rules, order of steps, and what a good result looks like.</span>
              <textarea id="instr" className="textarea mono" rows={7} value={s.instructions} onChange={(e) => set('instructions', e.target.value)} style={{ fontSize: 12.5 }} />
            </div>
            <ListInput label="Example requests" values={s.examples} onChange={(v) => set('examples', v)} placeholder="e.g. Draft release notes for v4.12" />
          </section>

          <section className="card card-body stack gap-16">
            <div className="field">
              <label>Allowed tools</label>
              <span className="hint">Anything that runs shell or writes files needs two approvals.</span>
              <div className="row wrap" style={{ marginTop: 4 }}>
                {TOOL_OPTIONS.map((t) => (
                  <button type="button" key={t} className="chip mono" style={{ fontSize: 12 }} aria-pressed={s.tools.includes(t)} onClick={() => set('tools', s.tools.includes(t) ? s.tools.filter((x) => x !== t) : [...s.tools, t])}>{t}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Share with teams</label>
              <div className="row wrap">
                {teams.map((t) => (
                  <button type="button" key={t.id} className="chip" aria-pressed={s.teamIds.includes(t.id)} onClick={() => set('teamIds', s.teamIds.includes(t.id) ? s.teamIds.filter((x) => x !== t.id) : [...s.teamIds, t.id])}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: `var(--s${t.slot})` }} />{t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid g-2" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="mins">Minutes saved per run</label>
                <input id="mins" type="number" min={1} max={480} className="input num" value={s.minutesSaved} onChange={(e) => set('minutesSaved', Math.max(1, Number(e.target.value) || 1))} />
                <span className="hint">Feeds the ROI numbers in Insights.</span>
              </div>
              <div className="field">
                <label>Eval suite</label>
                <div className="row" style={{ height: 34 }}>
                  <Switch checked={s.hasEvals} onChange={() => set('hasEvals', !s.hasEvals)} label="Eval suite attached" />
                  <span className="secondary" style={{ fontSize: 13 }}>{s.hasEvals ? '6 test cases attached' : 'None attached'}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="preview stack gap-16">
          <section className="card card-body">
            <div className="row" style={{ gap: 12, marginBottom: 14 }}>
              <ScoreRing value={score} />
              <div>
                <h3>Quality score</h3>
                <p className="muted" style={{ fontSize: 12.5 }}>{score === 1 ? 'Ready for review.' : `${checks.filter((c) => !c.ok).length} thing${checks.filter((c) => !c.ok).length > 1 ? 's' : ''} to improve before review.`}</p>
              </div>
            </div>
            <div className="checks">
              {checks.map((c) => (
                <div key={c.id} className={`check ${c.ok ? 'ok' : 'no'}`}>
                  <span className="ic">{c.ok ? <Check size={15} strokeWidth={2.6} /> : <Circle size={15} />}</span>
                  <span>{c.label}{!c.ok && <small>{c.hint}</small>}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-body">
            <div className="row" style={{ gap: 8, marginBottom: 4 }}><Sparkles size={15} /><h3>Trigger simulator</h3></div>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>Type a request — see which skill would win against your live catalog.</p>
            <input className="input" placeholder={clean.triggers[0] ? `Try “${clean.triggers[0]}”` : 'e.g. can you write the release notes?'} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Test request" />
            <div style={{ marginTop: 10 }}>
              {prompt && sim.length === 0 && <p className="muted" style={{ fontSize: 13, padding: '8px 0' }}>No skill would trigger. Claude answers without one.</p>}
              {sim.map((r, i) => (
                <div key={r.skill.id} className="sim-result">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 550, fontSize: 13 }}>
                      {r.skill.id === '__draft' ? <>{clean.title || 'This skill'} <span className="badge" style={{ height: 18, fontSize: 11 }}>this draft</span></> : r.skill.title}
                      {i === 0 && <span className="muted" style={{ fontWeight: 450, fontSize: 12 }}> · would trigger</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>matched: {r.hits.join(', ') || 'phrase'}</div>
                  </div>
                  <div className="sim-bar"><span style={{ width: `${r.score * 100}%`, background: r.skill.id === '__draft' ? 'var(--s2)' : 'var(--s1)' }} /></div>
                  <div className="num" style={{ textAlign: 'right', fontSize: 12.5, fontWeight: 600 }}>{Math.round(r.score * 100)}%</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card card-body">
            <h3 style={{ marginBottom: 10 }}>SKILL.md preview</h3>
            <pre className="code" style={{ maxHeight: 340 }}>{md}</pre>
          </section>
        </div>
      </div>
    </main>
  )
}
