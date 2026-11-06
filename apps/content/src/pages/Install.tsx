import { useMemo, useState } from 'react'
import { Copy, ExternalLink, Check } from 'lucide-react'
import { useStore } from '../store/store'
import { Switch } from '../components/ui'
import { copyText, demoUrl, snippet as buildSnippet, validProjectId } from '../saas/snippet'

export default function Install() {
  const { toast } = useStore()
  const [project, setProject] = useState('my-app')
  const [position, setPosition] = useState<'right' | 'left'>('right')
  const [shortcut, setShortcut] = useState(true)
  const [color, setColor] = useState('#e8590c')
  const [copied, setCopied] = useState(false)
  const valid = validProjectId(project)
  const snippet = useMemo(() => buildSnippet({ project, position, shortcut, color }), [project, position, shortcut, color])
  const copy = async () => {
    if (!(await copyText(snippet))) return
    setCopied(true); toast('Snippet copied'); window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Add collaboration to any website</h1>
          <p>One script tag adds comments that stick to elements, replies, and a completed state to any site, whatever it is built with. Your team reviews the real product in the browser instead of in screenshots.</p>
        </div>
        <div className="actions"><a className="btn primary" href={demoUrl()} target="_blank" rel="noopener">Try it on a demo site <ExternalLink size={13} /></a></div>
      </div>

      <div className="grid install-grid">
        <section className="card">
          <div className="card-head"><div><h2>Your snippet</h2><p>Paste it before <span className="mono">&lt;/body&gt;</span> on every page, or in your app’s main HTML file.</p></div></div>
          <div className="card-body stack gap-12">
            <div className="field">
              <label htmlFor="in-project">Project</label>
              <input id="in-project" className="input" value={project} maxLength={64} onChange={(e) => setProject(e.target.value.trim())} aria-invalid={!valid} />
              <span className="hint" style={valid ? undefined : { color: 'var(--critical-ink)' }}>{valid ? 'Comments are grouped by project. Use the same name on every page of one site.' : 'Use letters, digits, - and _ only (up to 64).'}</span>
            </div>
            <div className="row wrap" style={{ gap: 16 }}>
              <div className="field">
                <label>Buttons</label>
                <div className="seg" role="group" aria-label="Buttons position">
                  <button aria-pressed={position === 'right'} onClick={() => setPosition('right')}>Bottom right</button>
                  <button aria-pressed={position === 'left'} onClick={() => setPosition('left')}>Bottom left</button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="in-color">Accent</label>
                <input id="in-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 30, padding: 0, border: '1px solid var(--line-strong)', borderRadius: 6, background: 'none' }} />
              </div>
              <div className="field">
                <label>C key starts a comment</label>
                <span className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={shortcut} onChange={() => setShortcut((v) => !v)} label="C key starts a comment" /> {shortcut ? 'On (ignored while typing)' : 'Off'}</span>
              </div>
            </div>
            <pre className="code install-code">{snippet}</pre>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary" disabled={!valid} onClick={() => void copy()}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy snippet</>}</button>
            </div>
          </div>
        </section>

        <div className="stack gap-16">
          <section className="card card-body stack gap-8">
            <h2 style={{ fontSize: 15 }}>What it adds (version 0.1)</h2>
            <ul className="install-list">
              <li><b>Comments pinned to elements.</b> Press Comment (or C) and click. The pin follows its element when the layout changes or the page scrolls.</li>
              <li><b>Draft, post, reply, complete.</b> Nothing is saved until Post. Replies make a comment Ongoing, and Set as completed locks it until it is reopened.</li>
              <li><b>A list across pages.</b> Filter by Open, Ongoing and Completed, for this page or all pages. Single-page apps with hash or normal routes work.</li>
              <li><b>Isolated.</b> It lives in a shadow root: the site’s CSS can’t break it and it can’t change the site. It never reads what people type into the site’s own fields.</li>
            </ul>
          </section>
          <section className="card card-body stack gap-8">
            <h2 style={{ fontSize: 15 }}>Where comments are saved</h2>
            <p className="muted" style={{ fontSize: 13 }}>For now, in each person’s own browser. That is enough to try it, but teammates don’t see each other’s comments yet. Sharing needs a backend: the script already talks to its storage through a small interface (list, save one, delete one, listen for changes), so a database can be plugged in without changing the widget.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
