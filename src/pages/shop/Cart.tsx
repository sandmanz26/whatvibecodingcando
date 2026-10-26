import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, Sparkles } from 'lucide-react'
import { PRODUCTS, product } from '../../data/shop'
import { rp } from '../../lib/ai'
import { useStore } from '../../store/store'
import { Empty, Placeholder, ProductCard } from '../../components/ui'

export default function Cart() {
  const { cart, cartTotal, setQty, remove } = useStore()
  const nav = useNavigate()
  // "Goes well with": same category as what's in the cart, not already in it.
  const cats = new Set(cart.map((l) => product(l.productId)?.category))
  const extras = PRODUCTS.filter((p) => cats.has(p.category) && !cart.some((l) => l.productId === p.id)).sort((a, b) => b.sold - a.sold).slice(0, 4)

  if (!cart.length) return (
    <div style={{ marginTop: 24 }}>
      <h1>Cart</h1>
      <div className="card" style={{ marginTop: 16 }}><Empty title="Your cart is empty"><Link className="btn sm primary" to="/">Start shopping</Link></Empty></div>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <h1>Cart <span className="muted" style={{ fontWeight: 400, fontSize: 16 }}>· {cart.reduce((a, l) => a + l.qty, 0)} items</span></h1>
      <div className="cart">
        <div className="card">
          {cart.map((l, i) => {
            const p = product(l.productId)!
            return (
              <div key={i} className="line">
                <Placeholder label="Photo" />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/product/${p.id}`}><b>{p.title}</b></Link>
                  {Object.keys(l.options).length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
                  <div className="qty" style={{ marginTop: 8 }}>
                    <button className="btn icon sm" onClick={() => setQty(i, l.qty - 1)} aria-label="Fewer"><Minus size={13} /></button>
                    <span className="num">{l.qty}</span>
                    <button className="btn icon sm" onClick={() => setQty(i, l.qty + 1)} aria-label="More"><Plus size={13} /></button>
                    <button className="btn ghost sm" onClick={() => remove(i)}><Trash2 size={13} /> Remove</button>
                  </div>
                </div>
                <b className="num">{rp(p.price * l.qty)}</b>
              </div>
            )
          })}
        </div>
        <aside className="card card-body summary">
          <h2>Summary</h2>
          <dl className="specs"><div><dt>Items</dt><dd>{rp(cartTotal)}</dd></div><div><dt>Shipping</dt><dd>From {rp(10000)}</dd></div></dl>
          <div className="sum-total"><span>Total</span><b>{rp(cartTotal + 10000)}</b></div>
          <button className="btn primary lg" style={{ width: '100%' }} onClick={() => nav('/checkout')}>Check out</button>
        </aside>
      </div>
      {extras.length > 0 && (
        <section className="block">
          <div className="block-head"><h2 className="row" style={{ gap: 8 }}><Sparkles size={16} /> Goes well with your cart</h2></div>
          <div className="p-grid four">{extras.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  )
}
