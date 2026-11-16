import { useEffect, useRef, useState } from 'react'
import { FEATURES, type FeatureId } from './content'

/**
 * The scroll film. The section is tall and its stage is pinned; scrolling plays a short film of
 * the product's layers lifting off a site, one per feature, drawn frame by frame on a canvas
 * (public/frames, made once with an AI video model and kept as images so it scrubs smoothly).
 *
 * The film is atmosphere. What each feature really looks like is drawn in code beside it.
 */
const FRAMES = 134
/** Where in the film (0..1) the scene has settled for: the bare site, then each feature's layer. */
const KEYS = [0.1, 0.46, 0.55, 0.64, 0.72, 1]
const STEPS = KEYS.length
const src = (i: number) => `./frames/f-${String(i + 1).padStart(3, '0')}.webp`
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = (t: number) => t * t * (3 - 2 * t)

/** Film position for a scroll position: travel during the first part of each step, then hold. */
function filmAt(p: number) {
  const x = clamp(p) * STEPS
  const i = Math.min(STEPS - 1, Math.floor(x))
  const from = i === 0 ? 0 : KEYS[i - 1]
  return from + (KEYS[i] - from) * ease(clamp((x - i) / 0.62))
}

function Demo({ id }: { id: FeatureId }) {
  if (id === 'comments') return (
    <div className="demo d-comments">
      <div className="d-head"><span className="pin sm">1</span><span>on <b>button.cta</b> · /pricing</span></div>
      <p className="d-hand"><b>Rani</b> This says “Submit”. It should say what happens next.</p>
      <p className="d-hand reply"><b>Budi</b> Changed to “Start free trial”.</p>
      <span className="d-done">Done</span>
    </div>
  )
  if (id === 'voice') return (
    <div className="demo d-voice">
      <div className="d-head"><span className="pin sm">2</span><span>on <b>section.hero</b> · voice note</span></div>
      <div className="d-player">
        <span className="d-play" aria-hidden><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor" /></svg></span>
        <span className="d-wave" aria-hidden>{[5, 9, 14, 8, 18, 24, 12, 20, 28, 16, 9, 22, 30, 18, 11, 24, 15, 8, 19, 26, 13, 7, 16, 10, 5, 12, 8, 4].map((h, i) => <i key={i} style={{ height: h }} />)}</span>
        <span className="d-time">0:38</span>
      </div>
      <p className="d-hand"><b>Dewi</b> Listen to this one, it’s about the whole first screen.</p>
    </div>
  )
  if (id === 'heatmap') return (
    <div className="demo d-heat">
      <div className="d-head"><span className="d-dot" /><span>Task: <b>find the yearly price</b></span></div>
      <div className="d-map" aria-hidden>
        <i className="w a" /><i className="w b" /><i className="w c" /><i className="w d" /><i className="w e" />
        <i className="blob x" /><i className="blob y" /><i className="blob z" />
      </div>
      <p className="d-fine">Most clicks land on the toggle, not the price. Per screen, per device.</p>
    </div>
  )
  if (id === 'prompt') return (
    <div className="demo d-prompt">
      <div className="d-head"><span className="d-dot m" /><span>Copied for your AI coding tool</span></div>
      <pre>{`Fix this on /pricing
Element   .plan:nth-child(2) .price
Screen    390 × 844, mobile
Version   14
Feedback  “The middle plan should
          say per seat.”`}</pre>
    </div>
  )
  return (
    <div className="demo d-ds">
      <div className="d-head"><span className="d-dot m" /><span>3 values on <b>/pricing</b> aren’t tokens</span></div>
      <ul>
        <li><i style={{ background: '#2b4bff' }} /><code>#2b4bff</code><span>use</span><code className="ok">--color-primary</code></li>
        <li><i className="r" /><code>radius 7px</code><span>use</span><code className="ok">--radius-md</code></li>
        <li><i className="t">Aa</i><code>13.5px</code><span>use</span><code className="ok">--text-sm</code></li>
      </ul>
    </div>
  )
}

export default function Showcase() {
  const section = useRef<HTMLElement | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const el = section.current, cv = canvas.current
    if (!el || !cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const imgs: (HTMLImageElement | undefined)[] = new Array(FRAMES)
    let target = 0, shown = -1, pos = 0, raf = 0, alive = true

    const draw = (n: number) => {
      // The nearest frame that has arrived, so scrubbing never shows a hole.
      const ready = (i: number) => i >= 0 && i < FRAMES && !!imgs[i]?.complete && imgs[i]!.naturalWidth > 0
      let k = -1
      for (let d = 0; d < FRAMES && k < 0; d++) k = ready(n - d) ? n - d : ready(n + d) ? n + d : -1
      if (k < 0) return
      const im = imgs[k]
      if (!im) return
      const w = cv.width, h = cv.height
      const s = Math.max(w / im.naturalWidth, h / im.naturalHeight)
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh)
      shown = k === n ? n : -1
    }
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr)
      shown = -1
    }
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight))
      target = filmAt(p) * (FRAMES - 1)
      setStep(Math.min(STEPS - 1, Math.floor(p * STEPS)))
    }
    const tick = () => {
      if (!alive) return
      pos = calm ? target : pos + (target - pos) * 0.16
      const n = Math.round(pos)
      if (n !== shown) draw(n)
      raf = requestAnimationFrame(tick)
    }
    // First frame first, then the rest in order.
    const load = (i: number) => { const im = new Image(); im.decoding = 'async'; im.src = src(i); imgs[i] = im }
    load(0)
    const rest = window.setTimeout(() => { for (let i = 1; i < FRAMES; i++) load(i) }, 150)

    size(); onScroll(); tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', size)
    return () => { alive = false; cancelAnimationFrame(raf); window.clearTimeout(rest); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', size) }
  }, [])

  const go = (i: number) => {
    const el = section.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + ((i + 0.7) / STEPS) * (el.offsetHeight - window.innerHeight), behavior: 'smooth' })
  }

  return (
    <section id="layer" ref={section} className="show" style={{ height: `${STEPS * 95 + 100}svh` }}>
      <div className="show-stage">
        <canvas ref={canvas} className="show-film" aria-hidden />
        <div className="wrap show-in">
          <div className="show-panels">
            <article className={`show-panel ${step === 0 ? 'on' : ''}`} aria-hidden={step !== 0}>
              <p className="eyebrow on-blue">The product</p>
              <h2>So put the review <span className="hl">on the product.</span></h2>
              <p className="show-body">One line in your site’s HTML adds clear layers over the real thing. Your team works on those layers; your code and your visitors never notice them.</p>
              <div className="demo d-snippet">
                <div className="d-head"><span className="d-dot m" /><span>The whole install</span></div>
                <code><span className="c-dim">&lt;</span>script src=<span className="c-str">"…/vibe.js"</span> data-project=<span className="c-str">"my-app"</span> defer<span className="c-dim">&gt;&lt;/</span>script<span className="c-dim">&gt;</span></code>
              </div>
              <p className="fine on-blue show-hint">Keep scrolling: five layers, one at a time ↓</p>
            </article>
            {FEATURES.map((f, i) => (
              <article key={f.id} className={`show-panel ${step === i + 1 ? 'on' : ''}`} aria-hidden={step !== i + 1}>
                <p className="eyebrow on-blue">Layer {i + 1} of {FEATURES.length} · {f.name}</p>
                <h3>{f.title}</h3>
                <p className="show-body">{f.body}</p>
                <p className="show-answers"><span>Answers</span>“{f.answers}”</p>
                <Demo id={f.id} />
              </article>
            ))}
          </div>
          <nav className="show-rail" aria-label="Features">
            {FEATURES.map((f, i) => (
              <button key={f.id} className={step === i + 1 ? 'on' : step > i + 1 ? 'past' : ''} onClick={() => go(i + 1)} aria-current={step === i + 1}>
                <i aria-hidden />{f.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  )
}
