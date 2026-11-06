import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, Timer, Footprints, Headphones, Gift, Sun } from 'lucide-react'
import { CATEGORIES, PRODUCTS, product } from '../../data/shop'
import { featureMark, recentlyViewed, useFeature } from '../../lib/version'
import { useStore } from '../../store/store'
import { Placeholder, ProductCard } from '../../components/ui'

const IDEAS = ['Running shoes for a beginner under 500k', 'Quiet headphones for working from home', 'A gift for a coffee lover', 'Sunscreen for oily skin']
const IDEA_ICONS = [Footprints, Headphones, Gift, Sun]

/** v1.2: today's deals end at local midnight. */
function DealTimer() {
  const left = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return Math.max(0, m.getTime() - n.getTime()) }
  const [ms, setMs] = useState(left)
  useEffect(() => { const t = window.setInterval(() => setMs(left()), 1000); return () => clearInterval(t) }, [])
  const p = (n: number) => String(n).padStart(2, '0')
  const s = Math.floor(ms / 1000)
  return (
    <div className="deal-timer" {...featureMark('dealTimer')}>
      <Timer size={16} /> <b>Today’s deals end in</b>
      <span className="deal-clock num" aria-label={`${Math.floor(s / 3600)} hours ${Math.floor(s / 60) % 60} minutes left`}>{p(Math.floor(s / 3600))}<i>:</i>{p(Math.floor(s / 60) % 60)}<i>:</i>{p(s % 60)}</span>
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const { ask } = useStore()
  const [text, setText] = useState('')
  const deals = PRODUCTS.filter((p) => p.oldPrice).slice(0, 6)
  const forYou = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 10)
  const showRecent = useFeature('recentlyViewed')
  const newHero = useFeature('newHero')
  const dealTimer = useFeature('dealTimer')
  const recent = showRecent ? recentlyViewed().map(product).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 5) : []

  return (
    <>
      {newHero ? (
        <section className="hero2" {...featureMark('newHero')}>
          <span className="eyebrow"><Sparkles size={13} /> AI shopping</span>
          <h1>What are you shopping for today?</h1>
          <form className="hero2-ask" onSubmit={(e) => { e.preventDefault(); if (text.trim()) nav(`/search?q=${encodeURIComponent(text.trim())}`) }}>
            <Sparkles size={20} aria-hidden />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe it: who it’s for, what for, your budget" aria-label="Describe what you need" />
            <button className="btn primary lg" type="submit">Find it</button>
          </form>
          <div className="hero2-ideas">
            {IDEAS.map((i, k) => { const Icon = IDEA_ICONS[k]; return <button key={i} onClick={() => nav(`/search?q=${encodeURIComponent(i)}`)}><Icon size={18} /><span>{i}</span><ArrowRight size={14} /></button> })}
          </div>
        </section>
      ) : (
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">New · AI shopping</span>
          <h1>Describe what you need. We’ll find it.</h1>
          <p className="muted">Type it the way you’d say it to a friend: what it’s for, who it’s for, your budget.</p>
          <form className="hero-ask" onSubmit={(e) => { e.preventDefault(); if (text.trim()) nav(`/search?q=${encodeURIComponent(text.trim())}`) }}>
            <Sparkles size={18} aria-hidden />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. waterproof speaker for the beach under 600k" aria-label="Describe what you need" />
            <button className="btn primary" type="submit">Find it</button>
          </form>
          <div className="row wrap" style={{ gap: 6 }}>
            {IDEAS.map((i) => <button key={i} className="chip" onClick={() => nav(`/search?q=${encodeURIComponent(i)}`)}>{i}</button>)}
          </div>
        </div>
        <Placeholder label="Hero banner" ratio="4 / 3" className="hero-img" />
      </section>
      )}

      {recent.length > 0 && (
        <section className="block" {...featureMark('recentlyViewed')}>
          <div className="block-head"><h2>Pick up where you left off</h2></div>
          <div className="p-grid five">{recent.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <section className="block">
        <div className="block-head"><h2>Shop by category</h2></div>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/search?cat=${c.id}`} className="cat-tile"><Placeholder label="Icon" /><span>{c.name}</span></Link>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head"><h2>Deals today</h2><Link to="/search?deals=1" className="btn ghost sm">See all <ArrowRight size={13} /></Link></div>
        {dealTimer && <DealTimer />}
        <div className="p-grid six">{deals.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>

      <section className="block ai-band">
        <div>
          <h2 className="row" style={{ gap: 8 }}><Sparkles size={18} /> Not sure what to get?</h2>
          <p className="muted">The shopping assistant asks what it’s for and narrows it down to three picks.</p>
        </div>
        <button className="btn primary" onClick={() => ask()}>Ask the assistant</button>
      </section>

      <section className="block">
        <div className="block-head"><h2>Popular right now</h2></div>
        <div className="p-grid">{forYou.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>
    </>
  )
}
