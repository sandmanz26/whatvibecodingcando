import { Link } from 'react-router-dom'
import { ArrowRight, LayoutGrid, Library, KanbanSquare, Users, ShieldCheck, LineChart, PencilRuler, Command, Lightbulb, MousePointerClick, PenLine } from 'lucide-react'
import { useStore } from '../store/store'

const CAPABILITIES = [
  { icon: LayoutGrid, to: '/', title: 'Executive dashboard', body: 'Impact, adoption and a personal action inbox on one screen.', tryIt: 'Switch “Viewing as” to a Viewer — the inbox empties because Viewers don’t review.' },
  { icon: Library, to: '/skills', title: 'Searchable catalog', body: 'Filters live in the URL, so any view is a shareable link.', tryIt: 'Filter to Design + Published, then copy the URL into a new tab.' },
  { icon: PencilRuler, to: '/skills/new', title: 'Guided authoring', body: 'A quality score and trigger simulator coach people while they write.', tryIt: 'Pick the “Reviewer” template and type “is this safe” in the simulator.' },
  { icon: KanbanSquare, to: '/pipeline', title: 'Approval workflow', body: 'Drag-and-drop review board that enforces approval and eval rules.', tryIt: 'Drag “Churn risk summary” to Published — the column explains why it can’t go.' },
  { icon: Users, to: '/team', title: 'Roles & access', body: 'RBAC and a team × skill access matrix, editable in place.', tryIt: 'Open Access matrix and revoke a team. Then find it in the audit log.' },
  { icon: ShieldCheck, to: '/governance', title: 'Policy engine', body: 'Rules re-evaluate the whole catalog live; most issues fix in one click.', tryIt: 'Enable “Least-privilege access” and watch catalog health drop.' },
  { icon: LineChart, to: '/insights', title: 'ROI what-if', body: 'Sliders turn usage into a business case with your own assumptions.', tryIt: 'Drop “Trust in minutes saved” to 50% — is it still worth it?' },
  { icon: MousePointerClick, to: '/console/insights', title: 'Click insights', body: 'Which screens people open, what they tap, and where they get stuck — with heatmaps. Nothing typed is ever recorded.', tryIt: 'Tap around the app, then open Click insights and press “Heatmap” on a screen.' },
  { icon: PenLine, to: '/console/insights', title: 'Review pins', body: 'Reviewers drop numbered notes on any screen and export them as a .txt.', tryIt: 'Turn on Review pins, narrow the window below 500 px and tap the pen button.' },
  { icon: Command, to: '/', title: 'Power-user UX', body: '⌘K palette, dark mode, keyboard-friendly — table stakes, built in minutes.', tryIt: 'Press ⌘K / Ctrl+K and type “view as”.' },
]

const SCRIPT = [
  ['Start as Rani (Admin)', 'Show the Overview: hours saved, the trend, the inbox.'],
  ['Create a skill', 'New skill → Reviewer template. Point at the live score and SKILL.md writing itself.'],
  ['Hit a guardrail', 'Pipeline → drag your draft to Published. It refuses and says why.'],
  ['Switch to Kevin (Member)', 'Same pipeline, fewer powers: can submit, can’t approve or publish.'],
  ['Fix compliance', 'Governance → reassign the Viewer-owned skill in one click. Health goes up.'],
  ['Close with ROI', 'Insights → move the sliders. Every number agrees with every other.'],
]

const NEXT = [
  'Weekly digest email generated from the audit log',
  'Slack / Teams notifications when a review is waiting on you',
  'Skill A/B tests: compare two versions’ ratings and time saved',
  'Import real SKILL.md files from a Git repo',
  'Request-a-skill board where people vote on what to build next',
  'Per-team budgets and usage alerts',
  'Onboarding checklist that assigns starter skills by role',
  'Exportable compliance report (PDF) for audits',
]

export default function Playbook() {
  const { lens, setLens } = useStore()
  return (
    <main className="page" style={{ maxWidth: 1080 }}>
      <section style={{ padding: '24px 0 32px' }}>
        <span className="badge" style={{ marginBottom: 14 }}><Lightbulb size={12} /> Demo playbook</span>
        <h1 style={{ fontSize: 34, letterSpacing: '-0.03em', lineHeight: 1.15, maxWidth: 760 }}>What vibe coding can do for the people who run teams.</h1>
        <p className="secondary" style={{ fontSize: 15.5, marginTop: 12, maxWidth: 680 }}>
          Skillhouse is a front-end-only prototype for managing a team’s Claude skills. The real point is the patterns: dashboards, workflows,
          permissions, policy checks and ROI models that managers usually wait months for — sketched in an afternoon.
        </p>
        <div className="row mt-24">
          <Link to="/" className="btn primary">Start the tour <ArrowRight size={14} /></Link>
          <button className="btn" onClick={() => setLens(!lens)}>{lens ? 'Hide' : 'Show'} lens notes on every page</button>
        </div>
      </section>

      <h2 style={{ marginBottom: 12 }}>Ten management patterns in this demo</h2>
      <div className="grid g-2">
        {CAPABILITIES.map((c) => (
          <Link key={c.title} to={c.to} className="card card-body skill-card" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="cat-icon"><c.icon size={16} /></span>
              <h3>{c.title}</h3>
              <ArrowRight size={14} color="var(--ink-3)" style={{ marginLeft: 'auto' }} />
            </div>
            <p className="secondary" style={{ fontSize: 13 }}>{c.body}</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}><b style={{ color: 'var(--accent)', fontWeight: 600 }}>Try it · </b>{c.tryIt}</p>
          </Link>
        ))}
      </div>

      <div className="grid g-2 mt-24">
        <section className="card card-body">
          <h2 style={{ marginBottom: 14 }}>5-minute demo script</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SCRIPT.map(([t, d], i) => (
              <li key={t} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <span className="num" style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-ink)', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 650 }}>{i + 1}</span>
                <div><div style={{ fontWeight: 600 }}>{t}</div><div className="secondary" style={{ fontSize: 13 }}>{d}</div></div>
              </li>
            ))}
          </ol>
        </section>
        <section className="card card-body">
          <h2 style={{ marginBottom: 4 }}>Ideas to explore next</h2>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Each is another afternoon of vibe coding.</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }} className="secondary">
            {NEXT.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      </div>

      <p className="muted" style={{ fontSize: 12.5, marginTop: 24 }}>
        All data is fictional and lives in your browser (localStorage). Use the reset button in the sidebar to start over.
      </p>
    </main>
  )
}
