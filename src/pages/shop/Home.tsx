import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CATEGORIES, PRODUCTS } from '../../data/shop'
import { useStore } from '../../store/store'
import { Placeholder, ProductCard } from '../../components/ui'

const IDEAS = ['Running shoes for a beginner under 500k', 'Quiet headphones for working from home', 'A gift for a coffee lover', 'Sunscreen for oily skin']

export default function Home() {
  const nav = useNavigate()
  const { ask } = useStore()
  const [text, setText] = useState('')
  const deals = PRODUCTS.filter((p) => p.oldPrice).slice(0, 6)
  const forYou = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 10)

  return (
    <>
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
