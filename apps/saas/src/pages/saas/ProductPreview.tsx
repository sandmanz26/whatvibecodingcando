/**
 * Short looping clips of each product, recorded from the real product (scripts/record-previews.cjs,
 * files in public/previews). Shown on the product cards of onboarding and Products:
 * - with a mouse: hover or keyboard focus on a card for a moment shows a popover with the clip;
 * - on touch screens: the card's Preview button opens a bottom sheet with the clip and Select.
 * Nothing loads until a preview is first opened. With reduced motion, the poster shows instead.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Play, X } from 'lucide-react'
import type { Product } from '../../saas/products'

/** Products with a recorded clip. */
const CLIPS = new Set(['comments', 'insights', 'heatmap', 'usability', 'fivesec', 'gaze', 'compare', 'tokens', 'inspect', 'dscheck', 'narration', 'report'])
export const hasPreview = (id: string) => CLIPS.has(id)
const src = (id: string, ext: string) => `${import.meta.env.BASE_URL}previews/${id}.${ext}`
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const canHover = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
const HOVER_DELAY = 250

function Clip({ p }: { p: Product }) {
  if (reduced()) return <img className="pv-media" src={src(p.id, 'jpg')} alt="" width={480} height={300} />
  return (
    <video className="pv-media" muted loop playsInline autoPlay preload="none" poster={src(p.id, 'jpg')} width={480} height={300} aria-hidden>
      <source src={src(p.id, 'webm')} type="video/webm" />
      <source src={src(p.id, 'mp4')} type="video/mp4" />
    </video>
  )
}

/**
 * Wraps a product card. The card itself (children) keeps its own click (select / toggle); this adds
 * the hover popover and, on touch screens, the Preview button and its sheet.
 */
export function WithPreview({ p, selected, onSelect, children, className = '' }: { p: Product; selected?: boolean; onSelect?: () => void; children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)
  const [pop, setPop] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const [sheet, setSheet] = useState(false)
  const id = `pv-${p.id}`
  const has = hasPreview(p.id)
  const show = () => {
    if (!has || !canHover()) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = wrap.current?.getBoundingClientRect()
      if (!r) return
      const w = 320, h = 270
      const above = window.innerHeight - r.bottom < h + 16 && r.top > h + 16
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      setPop({ top: above ? r.top - 8 : r.bottom + 8, left, above })
    }, HOVER_DELAY)
  }
  const hide = () => { window.clearTimeout(timer.current); setPop(null) }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (!pop) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    window.addEventListener('keydown', esc); window.addEventListener('scroll', hide, true)
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('scroll', hide, true) }
  }, [pop])
  return (
    <div ref={wrap} className={`pv-wrap ${className}`} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {has && <button type="button" className="pv-open" onClick={(e) => { e.stopPropagation(); hide(); setSheet(true) }} aria-label={`Preview ${p.name}`} aria-haspopup="dialog"><Play size={12} /> Preview</button>}
      {pop && (
        <div id={id} role="tooltip" className={`pv-pop ${pop.above ? 'above' : ''}`} style={{ top: pop.top, left: pop.left }}>
          <Clip p={p} />
          <b>{p.name}</b>
          <span>{p.tagline}</span>
        </div>
      )}
      {sheet && <Sheet p={p} selected={selected} onSelect={onSelect} onClose={() => setSheet(false)} />}
    </div>
  )
}

function Sheet({ p, selected, onSelect, onClose }: { p: Product; selected?: boolean; onSelect?: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key !== 'Tab' || !box.current) return
      const f = Array.from(box.current.querySelectorAll<HTMLElement>('button, [href], video[controls]'))
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); back?.focus() }
  }, [onClose])
  return (
    <div className="pv-backdrop" onClick={onClose}>
      <div ref={box} className="pv-sheet" role="dialog" aria-modal="true" aria-labelledby={`pv-t-${p.id}`} onClick={(e) => e.stopPropagation()}>
        <div className="pv-sheet-head"><b id={`pv-t-${p.id}`}>{p.name}</b><button type="button" className="pv-x" onClick={onClose} aria-label="Close preview"><X size={16} /></button></div>
        <Clip p={p} />
        <p>{p.tagline}</p>
        {onSelect && <button type="button" className="lp-btn primary full" onClick={() => { onSelect(); onClose() }}>{selected ? 'Remove' : 'Select'}</button>}
      </div>
    </div>
  )
}
