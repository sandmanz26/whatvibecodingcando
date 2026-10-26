import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Star, X } from 'lucide-react'
import { useStore } from '../store/store'
import { rp } from '../lib/ai'
import type { Product } from '../data/shop'

/** Wireframe image: a grey box with a cross, labelled with what goes there. */
export function Placeholder({ label = 'Image', ratio = '1 / 1', className = '' }: { label?: string; ratio?: string; className?: string }) {
  return <div className={`ph ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={label}><span>{label}</span></div>
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5${count ? `, ${count} reviews` : ''}`}>
      <Star size={13} fill="currentColor" /> {value.toFixed(1)}{count !== undefined && <span className="muted"> ({count.toLocaleString('en-US')})</span>}
    </span>
  )
}

export function Price({ p, size }: { p: Pick<Product, 'price' | 'oldPrice'>; size?: 'lg' }) {
  return (
    <span className={`price ${size ?? ''}`}>
      <b>{rp(p.price)}</b>
      {p.oldPrice && <><s>{rp(p.oldPrice)}</s><span className="off">−{Math.round((1 - p.price / p.oldPrice) * 100)}%</span></>}
    </span>
  )
}

const soldLabel = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k sold` : `${n} sold`)

export function ProductCard({ p, why }: { p: Product; why?: string }) {
  return (
    <Link to={`/product/${p.id}`} className="pcard">
      <Placeholder label="Product photo" />
      <div className="pcard-body">
        <span className="pcard-title">{p.title}</span>
        <Price p={p} />
        <span className="pcard-meta"><Stars value={p.rating} /> · {soldLabel(p.sold)}</span>
        {why && <span className="pcard-why">{why}</span>}
      </div>
    </Link>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={onChange} />
}

export function Modal({ title, description, onClose, children, footer }: {
  title: string; description?: string; onClose: () => void; children?: ReactNode; footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus() }
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'error' && <CircleAlert size={15} />}
          {t.text}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
