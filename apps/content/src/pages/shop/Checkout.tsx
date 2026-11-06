import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { product } from '../../data/shop'
import { rp } from '../../lib/ai'
import { useStore } from '../../store/store'
import { Empty } from '../../components/ui'

const SHIPPING = [{ id: 'Regular', price: 10000, eta: '2–4 days' }, { id: 'Express', price: 25000, eta: 'Tomorrow' }]
const PAYMENT = ['Bank transfer', 'E-wallet', 'Card', 'Pay on delivery']

export default function Checkout() {
  const { cart, cartTotal, placeOrder } = useStore()
  const nav = useNavigate()
  const [ship, setShip] = useState('Regular')
  const [pay, setPay] = useState('E-wallet')
  if (!cart.length) return <div className="card" style={{ marginTop: 24 }}><Empty title="Nothing to check out"><Link className="btn sm" to="/">Back to the shop</Link></Empty></div>
  const fee = SHIPPING.find((s) => s.id === ship)!.price

  return (
    <div style={{ marginTop: 24 }}>
      <h1>Checkout</h1>
      <div className="cart">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card card-body">
            <h2>Delivery address</h2>
            <div className="addr">
              <b>Rani · 0812-xxxx-xxxx</b>
              <span className="muted">Jl. Contoh No. 12, Jakarta Selatan, 12345</span>
              <span className="muted" style={{ fontSize: 12 }}>Sample address for the prototype</span>
            </div>
          </section>
          <section className="card card-body">
            <h2>Shipping</h2>
            <div className="choices">
              {SHIPPING.map((s) => (
                <label key={s.id} className={`choice ${ship === s.id ? 'on' : ''}`}><input type="radio" name="ship" checked={ship === s.id} onChange={() => setShip(s.id)} /> <span><b>{s.id}</b><span className="muted">{s.eta}</span></span><b>{rp(s.price)}</b></label>
              ))}
            </div>
          </section>
          <section className="card card-body">
            <h2>Payment</h2>
            <div className="choices">
              {PAYMENT.map((p) => (
                <label key={p} className={`choice ${pay === p ? 'on' : ''}`}><input type="radio" name="pay" checked={pay === p} onChange={() => setPay(p)} /> <span><b>{p}</b></span></label>
              ))}
            </div>
          </section>
        </div>
        <aside className="card card-body summary">
          <h2>Your order</h2>
          {cart.map((l, i) => { const p = product(l.productId)!; return <div key={i} className="mini-line"><span>{l.qty} × {p.title}</span><span className="num">{rp(p.price * l.qty)}</span></div> })}
          <dl className="specs"><div><dt>Items</dt><dd>{rp(cartTotal)}</dd></div><div><dt>Shipping</dt><dd>{rp(fee)}</dd></div></dl>
          <div className="sum-total"><span>Total</span><b>{rp(cartTotal + fee)}</b></div>
          <button className="btn primary lg" style={{ width: '100%' }} onClick={() => { const o = placeOrder(ship, pay); nav(`/orders/${o.id}`) }}>Place order</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Prototype — no payment is taken.</p>
        </aside>
      </div>
    </div>
  )
}
