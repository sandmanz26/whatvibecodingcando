import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BRAND, LAYERS, LINKS, LOOP, PRICES, PROBLEMS, SHEETS, SPEC } from './content'
import Notes from './Notes'
import Showcase from './Showcase'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Out = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="m3 8.5 3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Mark = () => (
  <svg className="logo-mark" width="22" height="22" viewBox="0 0 32 32" aria-hidden><path d="M16 3a11 11 0 0 1 11 11c0 8-11 15-11 15S5 22 5 14A11 11 0 0 1 16 3z" fill="currentColor" /><circle cx="16" cy="14" r="4" className="logo-eye" /></svg>
)

/** Fades a block in the first time it is scrolled to. */
function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'li' | 'article' }) {
  const ref = useRef<HTMLElement | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || typeof IntersectionObserver !== 'function') { setSeen(true); return }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref as never} className={`rv ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` } as CSSProperties}>{children}</Tag>
}

/** Which sheet (section) is on screen, for the nav's counter. */
function useSheet() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY + window.innerHeight * 0.4
      let cur = 0
      SHEETS.forEach((s, n) => { const el = document.getElementById(s.id); if (el && el.offsetTop <= y) cur = n })
      setI(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])
  return i
}

function Nav() {
  const i = useSheet()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <header className="nav">
      <a href="#top" className="logo"><Mark />{BRAND}</a>
      <nav className="nav-links" aria-label="Sections">
        <a href="#problem">Problem</a>
        <a href="#layer">Product</a>
        <a href="#loop">How it works</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <span className="nav-sheet" aria-hidden>{pad(i + 1)}/{pad(SHEETS.length)} <b>{SHEETS[i].name}</b></span>
      <a className="btn marker sm" href={LINKS.start}>Start free</a>
    </header>
  )
}

/**
 * The hero is its own demo: the headline gets reviewed while you watch. A reviewer pins the word
 * "finished", asks the question the product exists for, and the second line answers it.
 */
function Hero() {
  const [step, setStep] = useState(() => (reducedMotion() ? 5 : 0))
  useEffect(() => {
    if (step >= 5) return
    const wait = [700, 1100, 500, 1500, 1100][step]
    const t = window.setTimeout(() => setStep((s) => s + 1), wait)
    return () => window.clearTimeout(t)
  }, [step])

  return (
    <section id="top" className={`hero step-${step}`}>
      <div className="wrap hero-in">
        <p className="eyebrow on-blue">The review layer for AI-built products</p>
        <h1>
          <span className="h1-a">It looks <span className="pinned">finished.
            <span className="pin hero-pin" aria-hidden>1</span>
            <span className="cursor" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 7.5-6.5 2L9 18z" fill="#e4ff54" stroke="#070d3a" strokeWidth="1.4" strokeLinejoin="round" /></svg>
              <i>Rani</i>
            </span>
          </span></span>{' '}
          <span className="h1-b">Find out if it’s <span className="hl">right.</span></span>
        </h1>

        <div className="hero-foot">
          <div className="hero-copy">
            <p className="lede">AI builds your product in an afternoon. {BRAND} is how your team reviews it: one script tag puts comments, user tests and design checks on top of your live site.</p>
            <div className="row">
              <a className="btn marker lg" href={LINKS.start}>Start free <Arrow /></a>
              <a className="btn line lg" href={LINKS.demo} target="_blank" rel="noopener">Try the live demo <Out /></a>
            </div>
            <p className="fine on-blue">Free during the beta · Works with React, Next.js, Vue, Svelte, Webflow, WordPress and plain HTML</p>
          </div>

          <aside className="thread" aria-label="An example review comment on the headline">
            <div className="thread-head"><span className="pin sm" aria-hidden>1</span><span>on <b>h1</b> · this page · 1440 px</span></div>
            <div className="msg m1"><b>Rani</b><p>It <em>looks</em> finished. Has anyone outside the team actually tried it?</p></div>
            <div className="msg m2"><b>Budi</b><p>Not yet. Sending a test link to five people now.</p></div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function Problem() {
  return (
    <section id="problem" className="sheet paper">
      <div className="wrap">
        <div className="head">
          <p className="eyebrow">The problem</p>
          <h2>Building takes an afternoon now. <span className="dim">Reviewing still takes weeks.</span></h2>
          <p className="sub">AI coding tools removed the wait to build. They didn’t remove the need to check the work, and the checking still runs on screenshots, chat threads and guesses. You’ve heard all six of these.</p>
        </div>
        <ul className="problems">
          {PROBLEMS.map((p, n) => (
            <Reveal as="li" key={p.quote} delay={n % 2 ? 80 : 0}>
              <p className="quote"><span>“{p.quote}”</span></p>
              <div className="problem-body">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
              <p className="cost"><span>What it costs</span>{p.cost}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal className="verdict">
          <p>Six problems, one cause: <span className="hl ink">the review happens somewhere other than the product.</span></p>
        </Reveal>
      </div>
    </section>
  )
}

/** Everything else the same script carries, grouped by the layer it belongs to. */
function Toolbox() {
  return (
    <section id="tools" className="sheet paper">
      <div className="wrap">
        <div className="head">
          <p className="eyebrow">The toolbox</p>
          <h2>Those were five. <span className="dim">The same script carries the rest.</span></h2>
          <p className="sub">Three layers, one install. Turn on only what you need for this project and add the others when you want them.</p>
        </div>
        <div className="boxes">
          {LAYERS.map((l, n) => (
            <Reveal as="article" key={l.id} className="box-col" delay={n * 90}>
              <p className="eyebrow">{l.label} · {l.verb}</p>
              <h3>{l.title}</h3>
              <ul>
                {l.tools.map((t) => (
                  <li key={t.name}><b>{t.name}{t.tag && <em>{t.tag}</em>}</b><span>{t.what}</span></li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Loop() {
  return (
    <section id="loop" className="sheet paper">
      <div className="wrap">
        <div className="head">
          <p className="eyebrow">How it works</p>
          <h2>Ship, review, fix. <span className="dim">Then go round again.</span></h2>
          <p className="sub">The loop is short on purpose. With AI the fix is one prompt away, so the review should be one link away.</p>
        </div>
        <ol className="loop">
          {LOOP.map((s, n) => (
            <Reveal as="li" key={s.title} delay={n * 90}>
              <span className="num">{n + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>
        <svg className="loop-arrow" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden>
          <path d="M1130 8 C1180 40 1120 78 1000 78 L160 78 C70 78 30 50 62 10" />
          <path d="M48 26 62 8 82 22" />
        </svg>
      </div>
    </section>
  )
}

function TryIt({ onStart }: { onStart: () => void }) {
  return (
    <section id="try" className="sheet marker-sheet">
      <div className="wrap try">
        <div>
          <p className="eyebrow">Try it</p>
          <h2>This page is reviewable. Press <kbd>C</kbd> and click anything.</h2>
        </div>
        <div className="try-side">
          <p>That’s the whole idea, built into this page: point at the thing you mean and say it there. Your notes here stay in this tab. On the real product they reach your team, with the page, element and version attached.</p>
          <div className="row">
            <button className="btn ink lg" onClick={onStart}>Leave a note on this page</button>
            <a className="btn line-ink lg" href={LINKS.demo} target="_blank" rel="noopener">Open the full demo <Out /></a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Spec() {
  return (
    <section id="spec" className="sheet paper">
      <div className="wrap">
        <div className="head">
          <p className="eyebrow">The spec</p>
          <h2>Safe to put on a real site.</h2>
          <p className="sub">It runs on your production pages, so these are the parts that matter. No claims here, only how it is built.</p>
        </div>
        <Reveal>
          <dl className="titleblock">
            {SPEC.map((s) => (
              <div key={s.k}>
                <dt>{s.k}</dt>
                <dd><b>{s.v}</b><span>{s.d}</span></dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="sheet paper tight-top">
      <div className="wrap">
        <div className="head">
          <p className="eyebrow">Pricing</p>
          <h2>Every tool. <span className="hl ink">$2 a site.</span></h2>
          <p className="sub">One price per website or app. No seats and no tiers to compare. During the beta every account gets Pro free, and nothing is charged without you choosing it.</p>
        </div>
        <div className="prices">
          {PRICES.map((p, n) => (
            <Reveal as="article" key={p.name} className={`price ${n ? 'pro' : ''}`} delay={n * 90}>
              <h3>{p.name}</h3>
              <p className="amount">{p.price}{p.unit && <small>{p.unit}</small>}</p>
              <p className="price-note">{p.note}</p>
              <ul>{p.items.map((x) => <li key={x}><Tick />{x}</li>)}</ul>
              <a className={`btn ${n ? 'marker' : 'line-ink'} full`} href={LINKS.start}>{p.cta} <Arrow /></a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function End() {
  return (
    <section className="end">
      <div className="wrap">
        <h2>It looks finished. <span className="hl">Go find out.</span></h2>
        <div className="row center">
          <a className="btn marker lg" href={LINKS.start}>Start free <Arrow /></a>
          <a className="btn line lg" href={LINKS.demo} target="_blank" rel="noopener">Try the live demo <Out /></a>
        </div>
        <footer className="foot">
          <span className="logo"><Mark />{BRAND}</span>
          <span className="fine on-blue">Beta · a working name</span>
          <span className="grow" />
          <a href={LINKS.guide}>User guide</a>
          <a href={LINKS.login}>Log in</a>
          <a href={LINKS.privacy}>Privacy</a>
          <a href={LINKS.terms}>Terms</a>
        </footer>
      </div>
    </section>
  )
}

export default function App() {
  const [commenting, setCommenting] = useState(false)
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Showcase />
        <Toolbox />
        <Loop />
        <TryIt onStart={() => setCommenting(true)} />
        <Spec />
        <Pricing />
        <End />
      </main>
      <Notes on={commenting} setOn={setCommenting} />
    </>
  )
}
