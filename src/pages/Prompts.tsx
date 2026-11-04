import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ChevronDown, ChevronUp, Download, ArrowUpRight } from 'lucide-react'
import { useStore } from '../store/store'
import { Switch } from '../components/ui'
import { APP, readJSON, writeJSON } from '../tools/shared'
import { FRAMEWORKS, PROMPTS, ROUTINGS, SKILL_INSTALL, allMarkdown, promptFor, type Framework, type PromptContext, type PromptEntry, type Routing } from '../tools/prompts/catalog'

const KEY = `${APP}.prompts.ctx`
const GROUPS = ['All', 'Research', 'Feedback', 'Design', 'Reporting', 'Everything'] as const
/** Where each tool can be tried in this demo. */
const TRY: Partial<Record<string, string>> = {
  sessions: '/console/insights', heatmap: '/console/insights', usability: '/console/tests', fivesec: '/console/fivesec', doors: '/console/doors',
  gaze: '/console/gaze', narration: '/console/narration', 'design-tokens': '/console/design', 'ds-check': '/console/dscheck', report: '/console/report', repo: '/console/repo', compare: '/console/compare', comments: '/',
}

/** Copies text, falling back to a hidden textarea where the Clipboard API isn't allowed. */
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back */ }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  return ok
}

function Card({ p, ctx, onCopied }: { p: PromptEntry; ctx: PromptContext; onCopied: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = promptFor(p, ctx)
  const copy = async () => {
    if (await copyText(text)) { setCopied(true); onCopied(p.title); window.setTimeout(() => setCopied(false), 1800) }
  }
  return (
    <article className="card prompt-card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <span className="muted" style={{ fontSize: 12 }}>{p.group}</span>
          <h3>{p.title}</h3>
        </div>
        {TRY[p.id] && <Link className="btn ghost sm" to={TRY[p.id]!} title="See it in this demo">Try it here <ArrowUpRight size={12} /></Link>}
      </div>
      <p>{p.summary}</p>
      <div className="row wrap" style={{ gap: 6 }}>{p.needs.map((n) => <span key={n} className="badge outline">{n}</span>)}</div>
      <div className="row" style={{ gap: 8, marginTop: 4 }}>
        <button className="btn primary sm" onClick={() => void copy()}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy prompt</>}</button>
        <button className="btn sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? <><ChevronUp size={13} /> Hide prompt</> : <><ChevronDown size={13} /> Show prompt</>}</button>
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>{text.split(/\s+/).length} words</span>
      </div>
      {open && <pre className="code prompt-text">{text}</pre>}
    </article>
  )
}

export default function Prompts() {
  const { toast } = useStore()
  const [ctx, setCtx] = useState<PromptContext>(() => readJSON<PromptContext>(KEY, { framework: 'react', routing: 'unsure', skill: false }))
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('All')
  useEffect(() => writeJSON(KEY, ctx), [ctx])
  const list = useMemo(() => PROMPTS.filter((p) => group === 'All' || p.group === group), [group])

  const download = () => {
    const url = URL.createObjectURL(new Blob([allMarkdown(ctx)], { type: 'text/markdown' }))
    Object.assign(document.createElement('a'), { href: url, download: 'ux-research-prompts.md' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Use these tools in your own project</h1>
          <p>Every research tool in this demo, as a prompt you can give your own Claude. Each prompt spells out how the tool should behave — its states, what happens on cancel, and what it must never record — so Claude builds the same logic instead of guessing.</p>
        </div>
        <div className="actions"><button className="btn" onClick={download}><Download size={14} /> Download all (.md)</button></div>
      </div>

      <section className="card card-body prompt-how">
        <ol>
          <li><b>Open your project in Claude Code</b><span className="muted">The prompts work best there, because Claude can read and change your code. You can also paste one into claude.ai to get the code to add yourself.</span></li>
          <li><b>Tell the prompt about your app</b><span className="muted">Pick your framework and routing below; every prompt updates.</span></li>
          <li><b>Copy a prompt and paste it</b><span className="muted">Claude reads your project, tells you its plan, builds, then tests in a browser and says what it couldn’t test.</span></li>
        </ol>
      </section>

      <section className="card card-body mt-16 prompt-ctx">
        <div className="field">
          <label htmlFor="fw">Framework</label>
          <select id="fw" className="select" value={ctx.framework} onChange={(e) => setCtx({ ...ctx, framework: e.target.value as Framework })}>
            {(Object.keys(FRAMEWORKS) as Framework[]).map((f) => <option key={f} value={f}>{FRAMEWORKS[f]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rt">Routing</label>
          <select id="rt" className="select" value={ctx.routing} onChange={(e) => setCtx({ ...ctx, routing: e.target.value as Routing })}>
            {(Object.keys(ROUTINGS) as Routing[]).map((r) => <option key={r} value={r}>{ROUTINGS[r]}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Use the ux-research-kit skill</label>
          <span className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={ctx.skill} onChange={() => setCtx({ ...ctx, skill: !ctx.skill })} label="Use the ux-research-kit skill" /> {ctx.skill ? 'Short prompts; the skill carries the details' : 'Full prompts; nothing to install'}</span>
        </div>
        {ctx.skill && (
          <div className="prompt-install">
            <b>Install the skill once, in Claude Code:</b>
            <pre className="code">{SKILL_INSTALL}</pre>
            <button className="btn sm" onClick={() => void copyText(SKILL_INSTALL).then((ok) => ok && toast('Install commands copied'))}><Copy size={13} /> Copy</button>
            <span className="muted" style={{ fontSize: 12.5 }}>Or copy its folder into ~/.claude/skills/. Without the skill, switch this off and use the full prompts.</span>
          </div>
        )}
      </section>

      <div className="row wrap mt-16" style={{ gap: 6, marginBottom: 12 }}>
        {GROUPS.map((g) => <button key={g} className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g} <span className="num" style={{ opacity: .6 }}>{g === 'All' ? PROMPTS.length : PROMPTS.filter((p) => p.group === g).length}</span></button>)}
      </div>

      <div className="prompt-grid">
        {list.map((p) => <Card key={p.id} p={p} ctx={ctx} onCopied={(t) => toast(`Copied: ${t}`)} />)}
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>These prompts describe the tools as they behave in this demo. Your Claude will adapt them to your codebase, so review its plan before it starts, and check the result in your own browser.</p>
    </main>
  )
}
