import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ArrowRight, Plus, ExternalLink, Code2, MousePointer2, Users, ShieldCheck, Sparkles } from 'lucide-react'
import { BRAND, CATEGORIES, PRODUCTS, inScript, statusLabel, type Category } from '../../saas/products'
import { demoUrl } from '../../saas/snippet'
import { isSignedIn, loadSaas } from '../../saas/account'
import '../../saas/saas.css'

const PICK_KEY = 'vibe.landing.pick'
const readPick = (): string[] => { try { return JSON.parse(sessionStorage.getItem(PICK_KEY) ?? '["comments"]') } catch { return ['comments'] } }

const FAQ = [
  { q: 'Where are comments saved?', a: 'During the beta, in each person’s own browser, so teammates don’t see each other’s comments yet. Shared projects with a database are the next step. The script already stores data through one small interface, so that switch doesn’t change what you install.' },
  { q: 'Does it work with my framework?', a: 'Yes. It’s one script tag, so it works with React, Next.js, Vue, Svelte, Webflow, WordPress or plain HTML. Single-page apps with normal or hash routes are followed page by page.' },
  { q: 'Can it break my site?', a: 'The widget lives in a shadow root: your CSS can’t reach it and its CSS can’t reach your site. A click used to place a comment never reaches your page. It never reads what people type into your forms.' },
  { q: 'Which products work on my site today?', a: `${inScript()} are in the script now. The other tools are built and you can use them in the live demo; they move into the script one by one. Pick them now and they switch on for your project as they arrive.` },
  { q: 'What will it cost?', a: 'Everything is free during the beta. The plan after that: you pay only for the products you turn on, each with a free tier. Prices will be announced before the beta ends.' },
]

export default function Landing() {
  const nav = useNavigate()
  const [pick, setPick] = useState<string[]>(readPick)
  const [cat, setCat] = useState<Category | 'All'>('All')
  const saas = loadSaas()
  const signedIn = isSignedIn(saas)
  const hasAccount = !!saas.account
  useEffect(() => { try { sessionStorage.setItem(PICK_KEY, JSON.stringify(pick)) } catch { /* ignore */ } }, [pick])
  useEffect(() => { window.scrollTo(0, 0); document.title = `${BRAND} — collaboration and UX research for vibe-coded products` }, [])

  const shown = useMemo(() => PRODUCTS.filter((p) => cat === 'All' || p.category === cat), [cat])
  const picked = PRODUCTS.filter((p) => pick.includes(p.id))
  const toggle = (id: string) => setPick((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const start = () => nav(signedIn ? '/app/products' : `/app/register?products=${picked.map((p) => p.id).join(',')}`)
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
          <nav className="lp-links" aria-label="Sections">
            <button onClick={() => jump('products')}>Products</button>
            <button onClick={() => jump('how')}>How it works</button>
            <button onClick={() => jump('pricing')}>Pricing</button>
            <Link to="/guide">Guide</Link>
            <a href={demoUrl()} target="_blank" rel="noopener">Live demo</a>
          </nav>
          <span className="lp-grow" />
          {signedIn
            ? <Link to="/app" className="lp-btn dark">Open your panel <ArrowRight size={15} /></Link>
            : <><Link to="/app/login" className="lp-btn ghost">Log in</Link>{!hasAccount && <Link to="/app/register" className="lp-btn dark">Get started</Link>}</>}
        </div>
      </header>

      <section className="lp-hero lp-wrap">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow"><Sparkles size={13} /> Free during the beta</span>
          <h1>Review what you vibe-coded, <em>together</em>, on the real thing.</h1>
          <p>One script tag adds comments, usability research and design checks to any site you build, with an AI coding tool or by hand. Pick only the tools you need.</p>
          <div className="lp-row">
            <button className="lp-btn primary lg" onClick={() => jump('products')}>Pick your tools <ArrowRight size={16} /></button>
            <a className="lp-btn lg" href={demoUrl()} target="_blank" rel="noopener">See it on a demo site <ExternalLink size={15} /></a>
          </div>
          <p className="lp-small">Works with React, Next.js, Vue, Svelte, Webflow, WordPress and plain HTML.</p>
        </div>
        <div className="lp-hero-art" aria-hidden>
          <div className="lp-browser">
            <div className="lp-browser-bar"><i /><i /><i /><span>your-app.com/pricing</span></div>
            <div className="lp-browser-body">
              <div className="lp-sk w60" /><div className="lp-sk w40" />
              <div className="lp-sk-cards"><div /><div className="hot" /><div /></div>
              <div className="lp-sk w80" /><div className="lp-sk w50" />
              <span className="lp-pin" style={{ left: '50%', top: '43%' }}>1</span>
              <span className="lp-pin blue" style={{ left: '22%', top: '78%' }}>2</span>
              <div className="lp-bubble">
                <b>Rani</b><span> · just now</span>
                <p>The middle plan should say “per seat”.</p>
                <div className="lp-bubble-reply"><b>Budi</b> Fixed in the next deploy ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-strip">
        <div className="lp-wrap lp-strip-in">
          <span><Code2 size={16} /> One script tag</span>
          <span><MousePointer2 size={16} /> Pins stick to elements</span>
          <span><Users size={16} /> Built for teams</span>
          <span><ShieldCheck size={16} /> Never reads form fields</span>
        </div>
      </section>

      <section id="products" className="lp-wrap lp-section">
        <div className="lp-head">
          <h2>Pick your tools</h2>
          <p>Every tool is a product of its own. Turn on what you need now, add the rest later.</p>
        </div>
        <div className="lp-tabs" role="group" aria-label="Category">
          {(['All', ...CATEGORIES] as const).map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="lp-picker">
          <div className="lp-grid">
            {shown.map((p) => {
              const on = pick.includes(p.id)
              const Icon = p.icon
              return (
                <article key={p.id} className={`lp-card ${on ? 'on' : ''}`}>
                  <div className="lp-card-top">
                    <span className="lp-icon" style={{ background: p.hue }}><Icon size={18} /></span>
                    <span className={`lp-status ${p.status}`}>{statusLabel(p.status)}</span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.tagline}</p>
                  <ul>{p.points.map((x) => <li key={x}><Check size={13} /> {x}</li>)}</ul>
                  <div className="lp-card-foot">
                    <button className={`lp-btn sm ${on ? 'dark' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>{on ? <><Check size={14} /> Added</> : <><Plus size={14} /> Add</>}</button>
                    <a className="lp-try" href={p.demo.startsWith('#') ? p.demo : demoUrl()} target="_blank" rel="noopener">Try it <ArrowRight size={13} /></a>
                  </div>
                </article>
              )
            })}
          </div>
          <aside className="lp-stack" aria-label="Your stack">
            <h3>Your stack</h3>
            {picked.length === 0 ? <p className="lp-muted">Nothing yet. Add the tools you want.</p> : (
              <ul>
                {picked.map((p) => (
                  <li key={p.id}>
                    <span className="lp-dot" style={{ background: p.hue }} />
                    <span className="lp-grow">{p.name}</span>
                    <button onClick={() => toggle(p.id)} aria-label={`Remove ${p.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="lp-stack-price"><span>During the beta</span><b>Free</b></div>
            <button className="lp-btn primary full" disabled={!picked.length} onClick={start}>{signedIn ? 'Turn these on' : `Start with ${picked.length || ''} tool${picked.length === 1 ? '' : 's'}`} <ArrowRight size={15} /></button>
            {picked.some((p) => p.status === 'console') && <p className="lp-muted lp-small">Early-access tools switch on for your project as they move into the script.</p>}
          </aside>
        </div>
      </section>

      <section id="how" className="lp-how">
        <div className="lp-wrap lp-section">
          <div className="lp-head"><h2>Three steps, no rebuild</h2><p>Nothing to change in your code beyond one line.</p></div>
          <ol className="lp-steps">
            <li><b>1</b><h3>Pick</h3><p>Choose the tools for your project. You can change them any time in your panel.</p></li>
            <li><b>2</b><h3>Paste one line</h3><p>Copy your snippet into your site’s HTML, or ask your AI coding assistant to add it for you.</p><code>&lt;script src=".../vibe.js" data-project="my-app" defer&gt;&lt;/script&gt;</code></li>
            <li><b>3</b><h3>Review together</h3><p>Your team comments on the real screens, replies, and marks things done. Everything shows up in your panel.</p></li>
          </ol>
        </div>
      </section>

      <section className="lp-wrap lp-section">
        <div className="lp-head"><h2>Try it right here</h2><p>A plain website with the script installed. Press <b>Comment</b> (or C) and click anything.</p></div>
        <div className="lp-demo">
          <iframe src={demoUrl()} title="Demo site with the script installed" loading="lazy" />
        </div>
      </section>

      <section id="pricing" className="lp-wrap lp-section">
        <div className="lp-head"><h2>Simple pricing</h2><p>Pay for the products you turn on. Nothing else.</p></div>
        <div className="lp-prices">
          <div className="lp-price">
            <h3>Beta</h3>
            <b className="lp-big">Free</b>
            <p>Every product, every project, while we build the shared workspace.</p>
            <ul><li><Check size={14} /> All tools you pick</li><li><Check size={14} /> Unlimited projects</li><li><Check size={14} /> Prompts to build tools into your own code</li></ul>
            <Link to={signedIn ? '/app' : hasAccount ? '/app/login' : '/app/register'} className="lp-btn dark full">{signedIn ? 'Open your panel' : 'Get started'}</Link>
          </div>
          <div className="lp-price muted">
            <h3>After the beta</h3>
            <b className="lp-big">Per product</b>
            <p>Each product you turn on has a free tier; you pay only past it. No seats, no bundles.</p>
            <ul><li><Check size={14} /> Free tier on every product</li><li><Check size={14} /> Turn products off any time</li><li><Check size={14} /> Prices announced before the beta ends</li></ul>
          </div>
        </div>
      </section>

      <section className="lp-wrap lp-section">
        <div className="lp-head"><h2>Questions</h2></div>
        <div className="lp-faq">
          {FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-wrap">
          <h2>Ship it, then review it together.</h2>
          <button className="lp-btn primary lg" onClick={() => (signedIn ? nav('/app') : jump('products'))}>{signedIn ? 'Open your panel' : 'Pick your tools'} <ArrowRight size={16} /></button>
        </div>
      </section>

      <footer className="lp-foot lp-wrap">
        <span className="lp-logo sm"><span className="lp-mark" aria-hidden><MousePointer2 size={13} /></span>{BRAND}</span>
        <span className="lp-muted">Beta · a working name</span>
        <span className="lp-grow" />
        <a href={demoUrl()} target="_blank" rel="noopener">Demo site</a>
        <Link to="/console/prompts">Prompts</Link>
        <Link to="/app">Your panel</Link>
        <Link to="/guide">User guide</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </div>
  )
}
