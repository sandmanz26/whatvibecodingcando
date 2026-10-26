import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Sparkles, Store, Truck, ShieldCheck, Minus, Plus, MessageCircle } from 'lucide-react'
import { PRODUCTS, category, product, seller } from '../../data/shop'
import { answer, score, suggestedQuestions, understand } from '../../lib/ai'
import { useStore } from '../../store/store'
import { Empty, Placeholder, Price, ProductCard, Stars } from '../../components/ui'

export default function Product() {
  const { id = '' } = useParams()
  const p = product(id)
  const nav = useNavigate()
  const { add, toast, ask } = useStore()
  const [opts, setOpts] = useState<Record<string, string>>({})
  const [qty, setQty] = useState(1)
  const [shot, setShot] = useState(0)
  const [qa, setQa] = useState<{ q: string; a: string }[]>([])
  const [question, setQuestion] = useState('')

  const similar = useMemo(() => {
    if (!p) return []
    const u = understand(p.tags.join(' '))
    return PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category).sort((a, b) => score(b, u) - score(a, u)).slice(0, 5)
  }, [p])

  if (!p) return <div className="card" style={{ marginTop: 24 }}><Empty title="This product isn’t available"><Link className="btn sm" to="/">Back to the shop</Link></Empty></div>

  const s = seller(p.sellerId)!
  const missing = Object.keys(p.options ?? {}).filter((k) => !opts[k])
  const doAdd = (buy: boolean) => {
    if (missing.length) { toast(`Choose a ${missing[0].toLowerCase()} first`, 'error'); return }
    add(p.id, qty, opts)
    if (buy) nav('/cart')
    else toast('Added to cart')
  }
  const ask1 = (q: string) => { if (q.trim()) { setQa((x) => [...x, { q: q.trim(), a: answer(p, q) }]); setQuestion('') } }

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb" style={{ margin: '16px 0' }}>
        <Link to="/">Home</Link> / <Link to={`/search?cat=${p.category}`}>{category(p.category)?.name}</Link> / <span className="here">{p.title}</span>
      </nav>

      <div className="pdp">
        <div className="gallery">
          <Placeholder label={`Product photo ${shot + 1}`} />
          <div className="thumbs">
            {[0, 1, 2, 3].map((i) => <button key={i} className={shot === i ? 'on' : ''} onClick={() => setShot(i)} aria-label={`Photo ${i + 1}`}><Placeholder label={String(i + 1)} /></button>)}
          </div>
        </div>

        <div className="buy">
          <h1>{p.title}</h1>
          <div className="row wrap" style={{ gap: 10 }}><Stars value={p.rating} count={p.reviewCount} /><span className="muted">· {p.sold.toLocaleString('en-US')} sold</span></div>
          <Price p={p} size="lg" />
          {Object.entries(p.options ?? {}).map(([name, values]) => (
            <div key={name} className="opt">
              <b>{name}{opts[name] ? `: ${opts[name]}` : ''}</b>
              <div className="row wrap" style={{ gap: 6 }}>
                {values.map((v) => <button key={v} className="chip" aria-pressed={opts[name] === v} onClick={() => setOpts((o) => ({ ...o, [name]: v }))}>{v}</button>)}
              </div>
            </div>
          ))}
          <div className="opt">
            <b>Quantity</b>
            <div className="qty">
              <button className="btn icon sm" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Fewer"><Minus size={13} /></button>
              <span className="num">{qty}</span>
              <button className="btn icon sm" onClick={() => setQty((n) => Math.min(p.stock, n + 1))} aria-label="More"><Plus size={13} /></button>
              <span className="muted" style={{ fontSize: 12.5 }}>{p.stock} in stock</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary lg" onClick={() => doAdd(true)}>Buy now</button>
            <button id="add-to-cart" className="btn lg" onClick={() => doAdd(false)}>Add to cart</button>
          </div>
          <ul className="perks">
            <li><Truck size={15} /> Ships from {s.city} · 2–4 days</li>
            <li><ShieldCheck size={15} /> Free returns within 7 days</li>
          </ul>
          <div className="seller card">
            <Placeholder label="Logo" />
            <div style={{ minWidth: 0 }}><b className="row" style={{ gap: 6 }}><Store size={14} /> {s.name}</b><span className="muted">{s.city} · ★ {s.rating} · replies {s.reply}</span></div>
            <button className="btn sm" onClick={() => toast(`Message sent to ${s.name} (prototype)`)}><MessageCircle size={13} /> Chat</button>
          </div>
        </div>
      </div>

      <div className="pdp-more">
        <div className="stack" style={{ gap: 16, minWidth: 0 }}>
          <section className="card card-body ai-card" aria-labelledby="sum-h">
            <h2 id="sum-h" className="row" style={{ gap: 8 }}><Sparkles size={16} /> What buyers say <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>AI summary of {p.reviewCount.toLocaleString('en-US')} reviews</span></h2>
            <div className="pc">
              <div><b>Liked</b><ul>{p.pros.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><b>Not so good</b><ul>{p.cons.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
          </section>

          <section className="card card-body ai-card" aria-labelledby="ask-h">
            <h2 id="ask-h" className="row" style={{ gap: 8 }}><Sparkles size={16} /> Ask about this product</h2>
            <p className="muted" style={{ fontSize: 13 }}>Answers come from the listing and its reviews.</p>
            <div className="row wrap" style={{ gap: 6, margin: '10px 0' }}>
              {suggestedQuestions(p).map((q) => <button key={q} className="chip" data-q={q} onClick={() => ask1(q)}>{q}</button>)}
            </div>
            {qa.map((x, i) => (
              <div key={i} className="qa"><b>{x.q}</b><p>{x.a}</p></div>
            ))}
            <form className="row" style={{ gap: 8, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); ask1(question) }}>
              <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type a question…" aria-label="Ask a question about this product" />
              <button className="btn" type="submit">Ask</button>
            </form>
          </section>

          <section className="card card-body">
            <h2>Description</h2>
            <p style={{ marginTop: 6 }}>{p.description}</p>
            <div className="lines" aria-hidden><i /><i /><i style={{ width: '60%' }} /></div>
          </section>

          <section className="card card-body">
            <h2>Reviews</h2>
            {p.reviews.map((r) => (
              <div key={r.author + r.date} className="review">
                <div className="row" style={{ gap: 8 }}><span className="avatar-ph" aria-hidden /> <b>{r.author}</b> <Stars value={r.rating} /> <span className="muted" style={{ fontSize: 12 }}>{r.date}</span></div>
                <p>{r.text}</p>
              </div>
            ))}
          </section>
        </div>

        <aside className="stack" style={{ gap: 16 }}>
          <section className="card card-body">
            <h2>Specifications</h2>
            <dl className="specs">{Object.entries(p.specs).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>
          <section className="card card-body ai-card">
            <b className="row" style={{ gap: 6 }}><Sparkles size={14} /> Not sure it’s the one?</b>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>Get alternatives with the assistant.</p>
            <button className="btn sm" onClick={() => ask(`${p.tags.slice(0, 3).join(' ')} alternatives to ${p.title}`)}>Find alternatives</button>
          </section>
        </aside>
      </div>

      <section className="block">
        <div className="block-head"><h2>Similar products</h2></div>
        <div className="p-grid five">{similar.map((x) => <ProductCard key={x.id} p={x} />)}</div>
      </section>
    </>
  )
}
