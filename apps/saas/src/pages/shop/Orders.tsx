import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Package } from 'lucide-react'
import { product } from '../../data/shop'
import { rp } from '../../lib/ai'
import { useStore } from '../../store/store'
import { Empty, Placeholder } from '../../components/ui'

const STEPS = ['Paid', 'Packed', 'Shipped', 'Delivered'] as const
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function OrderDetail() {
  const { id } = useParams()
  const { orders } = useStore()
  const o = orders.find((x) => x.id === id)
  if (!o) return <div className="card" style={{ marginTop: 24 }}><Empty title="Order not found"><Link className="btn sm" to="/orders">All orders</Link></Empty></div>
  return (
    <div style={{ marginTop: 24, maxWidth: 760 }}>
      <div className="card card-body done">
        <CheckCircle2 size={28} />
        <div><h1>Order placed</h1><p className="muted">{o.id} · {when(o.at)} · {o.payment} · {o.shipping} shipping</p></div>
      </div>
      <div className="track">{STEPS.map((s) => <span key={s} className={STEPS.indexOf(s) <= STEPS.indexOf(o.status) ? 'on' : ''}>{s}</span>)}</div>
      <div className="card">
        {o.lines.map((l, i) => { const p = product(l.productId)!; return (
          <div key={i} className="line"><Placeholder label="Photo" /><div><b>{p.title}</b><div className="muted" style={{ fontSize: 12.5 }}>{l.qty} × {rp(p.price)}</div></div><b className="num">{rp(p.price * l.qty)}</b></div>
        ) })}
        <div className="line" style={{ gridTemplateColumns: '1fr auto' }}><b>Total paid</b><b className="num">{rp(o.total)}</b></div>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 16 }}><Link to="/" className="btn primary">Keep shopping</Link><Link to="/orders" className="btn">All orders</Link></div>
    </div>
  )
}

export default function Orders() {
  const { orders } = useStore()
  return (
    <div style={{ marginTop: 24, maxWidth: 760 }}>
      <h1>Orders</h1>
      {orders.length === 0 ? <div className="card" style={{ marginTop: 16 }}><Empty title="No orders yet"><Link className="btn sm primary" to="/">Start shopping</Link></Empty></div> : (
        <div className="stack" style={{ gap: 12, marginTop: 16 }}>
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card card-body order-row">
              <Package size={18} />
              <div style={{ minWidth: 0 }}><b>{o.id}</b><div className="muted" style={{ fontSize: 12.5 }}>{when(o.at)} · {o.lines.reduce((a, l) => a + l.qty, 0)} items</div></div>
              <span className="badge">{o.status}</span>
              <b className="num">{rp(o.total)}</b>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
