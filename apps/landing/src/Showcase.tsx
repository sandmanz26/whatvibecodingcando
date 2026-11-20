import { useEffect, useRef, useState } from 'react'
import { FEATURES } from './content'
import Demo from './Demos'

/**
 * The scroll film. The section is tall and its stage is pinned; scrolling plays a short film of
 * the product's layers lifting off a site, one per feature, drawn frame by frame on a canvas.
 *
 * The frames (public/frames) were made once with AI image and video models: six still "key"
 * images (the site alone, then one more layer each) and five short clips that move from one key
 * to the next. Every HOLD frame is the sharp key image itself, so the film is crisp whenever it
 * rests. The film is atmosphere; what each feature really looks like is the demo beside it.
 */
const PER = 30 // frames from one key to the next
const HOLD = [0, 1, 2, 3, 4, 5].map((i) => i * PER)
const FRAMES = HOLD[HOLD.length - 1] + 1
const STEPS = HOLD.length
const src = (i: number) => `${import.meta.env.BASE_URL}frames/f-${String(i).padStart(3, '0')}.webp`
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = (t: number) => t * t * (3 - 2 * t)

/** Frame for a scroll position: travel to the step's key during the first part of it, then rest. */
function frameAt(p: number) {
  const x = clamp(p) * STEPS
  const i = Math.min(STEPS - 1, Math.floor(x))
  if (i === 0) return 0
  return HOLD[i - 1] + (HOLD[i] - HOLD[i - 1]) * ease(clamp((x - i) / 0.6))
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
    let target = 0, shown = -1, pos = 0, raf = 0, alive = true, started = false, near = true

    const ready = (i: number) => i >= 0 && i < FRAMES && !!imgs[i]?.complete && imgs[i]!.naturalWidth > 0
    const draw = (n: number) => {
      // The nearest frame that has arrived, so scrubbing never shows a hole.
      let k = -1
      for (let d = 0; d < FRAMES && k < 0; d++) k = ready(n - d) ? n - d : ready(n + d) ? n + d : -1
      if (k < 0) return
      const im = imgs[k]!
      const w = cv.width, h = cv.height
      const s = Math.min(w / im.naturalWidth, h / im.naturalHeight)
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s
      ctx.clearRect(0, 0, w, h)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh)
      shown = k === n ? n : -1
    }
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr)
      shown = -1
    }
    const load = (i: number) => { if (imgs[i]) return; const im = new Image(); im.decoding = 'async'; im.src = src(i); imgs[i] = im }
    // The keys first (they are what people rest on), then everything between them.
    const start = () => {
      if (started) return
      started = true
      HOLD.forEach(load)
      window.setTimeout(() => { for (let i = 0; i < FRAMES; i++) load(i) }, 200)
    }
    const onScroll = () => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 2.5 && r.bottom > -window.innerHeight) start()
      // The loop only runs while the film is on or near the screen (it stops once it has settled elsewhere).
      near = r.top < window.innerHeight * 1.5 && r.bottom > -window.innerHeight * 0.5
      if (near && !raf && alive) raf = requestAnimationFrame(tick)
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight))
      target = frameAt(p)
      setStep(Math.min(STEPS - 1, Math.floor(p * STEPS)))
    }
    const tick = () => {
      if (!alive) return
      pos = calm ? target : pos + (target - pos) * 0.16
      const n = Math.round(pos)
      if (n !== shown) draw(n)
      raf = near || Math.abs(target - pos) > 0.5 ? requestAnimationFrame(tick) : 0
    }

    load(0); size(); onScroll()
    if (!raf) raf = requestAnimationFrame(tick)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', size)
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', size) }
  }, [])

  const go = (i: number) => {
    const el = section.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + ((i + 0.72) / STEPS) * (el.offsetHeight - window.innerHeight), behavior: 'smooth' })
  }

  return (
    <section id="layer" ref={section} className="show" style={{ height: `${STEPS * 110 + 100}svh` }}>
      <div className="show-stage">
        <div className="show-film"><canvas ref={canvas} aria-hidden /></div>
        <div className="wrap show-in">
          <div className="show-panels">
            <article className={`show-panel intro ${step === 0 ? 'on' : ''}`} aria-hidden={step !== 0}>
              <p className="eyebrow on-blue">The product</p>
              <h2>So put the review <span className="hl">on the product.</span></h2>
              <p className="show-body">One line in your site’s HTML adds clear layers over the real thing. Your team works on those layers; your code and your visitors never notice them.</p>
              <div className="snip">
                <span className="snip-label">The whole install</span>
                <code><span className="c-dim">&lt;</span>script src=<span className="c-str">"…/vibe.js"</span> data-project=<span className="c-str">"my-app"</span> defer<span className="c-dim">&gt;&lt;/</span>script<span className="c-dim">&gt;</span></code>
              </div>
              <p className="fine on-blue show-hint">Keep scrolling: five layers, one at a time ↓</p>
            </article>
            {FEATURES.map((f, i) => (
              <article key={f.id} className={`show-panel ${step === i + 1 ? 'on' : ''}`} aria-hidden={step !== i + 1}>
                <p className="eyebrow on-blue">Layer {i + 1} of {FEATURES.length} · {f.name}</p>
                <h3>{f.title}</h3>
                <p className="show-body">{f.body}</p>
                <div className="show-demo"><Demo id={f.id} /></div>
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
