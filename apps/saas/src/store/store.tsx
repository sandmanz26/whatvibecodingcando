import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEMO_NOW, product } from '../data/shop'

/*
 * The shopper's state for the prototype: cart, orders and the assistant panel.
 * Kept in this browser (localStorage) so a participant can reload without losing it.
 */

export interface CartLine { productId: string; qty: number; options: Record<string, string> }
export interface Order {
  id: string
  at: string
  lines: CartLine[]
  total: number
  shipping: string
  payment: string
  status: 'Paid' | 'Packed' | 'Shipped' | 'Delivered'
}
export interface Toast { id: string; text: string; tone: 'default' | 'error' }

const KEY = 'shop:v1'
interface Saved { cart: CartLine[]; orders: Order[] }
const load = (): Saved => {
  try { return { cart: [], orders: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { cart: [], orders: [] } }
}
const uid = () => Math.random().toString(36).slice(2, 9)
const sameLine = (a: CartLine, id: string, o: Record<string, string>) => a.productId === id && JSON.stringify(a.options) === JSON.stringify(o)

interface Ctx {
  /** the signed-in shopper (sample) — also signs research comments */
  me: { name: string }
  cart: CartLine[]
  cartCount: number
  cartTotal: number
  orders: Order[]
  add: (productId: string, qty?: number, options?: Record<string, string>) => void
  setQty: (i: number, qty: number) => void
  remove: (i: number) => void
  placeOrder: (shipping: string, payment: string) => Order
  assistant: { open: boolean; prompt?: string; at?: number }
  ask: (prompt?: string) => void
  closeAssistant: () => void
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(load)
  const [assistant, setAssistant] = useState<Ctx['assistant']>({ open: false })
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* ignore */ } }, [saved])

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((text: string, tone: Toast['tone'] = 'default') => {
    const id = uid()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => dismissToast(id), 4200)
  }, [dismissToast])

  const add = useCallback((productId: string, qty = 1, options: Record<string, string> = {}) => {
    setSaved((s) => {
      const i = s.cart.findIndex((l) => sameLine(l, productId, options))
      const cart = i >= 0 ? s.cart.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l)) : [...s.cart, { productId, qty, options }]
      return { ...s, cart }
    })
  }, [])
  const setQty = useCallback((i: number, qty: number) => setSaved((s) => ({ ...s, cart: s.cart.map((l, j) => (j === i ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l)) })), [])
  const remove = useCallback((i: number) => setSaved((s) => ({ ...s, cart: s.cart.filter((_, j) => j !== i) })), [])

  const total = (lines: CartLine[]) => lines.reduce((a, l) => a + (product(l.productId)?.price ?? 0) * l.qty, 0)

  const placeOrder = useCallback((shipping: string, payment: string) => {
    const order: Order = {
      id: `ORD-${String(10241 + saved.orders.length)}`,
      at: new Date(DEMO_NOW.getTime() + saved.orders.length * 60000).toISOString(),
      lines: saved.cart, total: total(saved.cart) + (shipping === 'Express' ? 25000 : 10000), shipping, payment, status: 'Paid',
    }
    setSaved((s) => ({ cart: [], orders: [order, ...s.orders] }))
    return order
  }, [saved])

  const ask = useCallback((prompt?: string) => setAssistant({ open: true, prompt, at: Date.now() }), [])
  const closeAssistant = useCallback(() => setAssistant({ open: false }), [])

  const value = useMemo<Ctx>(() => ({
    me: { name: 'Rani' },
    cart: saved.cart,
    cartCount: saved.cart.reduce((a, l) => a + l.qty, 0),
    cartTotal: total(saved.cart),
    orders: saved.orders,
    add, setQty, remove, placeOrder,
    assistant, ask, closeAssistant,
    toasts, toast, dismissToast,
  }), [saved, add, setQty, remove, placeOrder, assistant, ask, closeAssistant, toasts, toast, dismissToast])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const c = useContext(StoreContext)
  if (!c) throw new Error('useStore outside provider')
  return c
}
