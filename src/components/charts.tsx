import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { compact, fmt } from '../lib/logic'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function niceMax(v: number, ticks = 4) {
  if (v <= 0) return { max: ticks, step: 1 }
  const raw = v / ticks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  return { max: step * ticks, step }
}

export interface Series {
  id: string
  label: string
  color: string
  values: number[]
}

/* ---------- Line chart with crosshair ---------- */

export function LineChart({ series, labels, height = 240, area = false }: { series: Series[]; labels: string[]; height?: number; area?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { t: 12, r: series.length > 1 ? 44 : 16, b: 26, l: 40 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const n = labels.length
  const { max, step } = niceMax(Math.max(1, ...series.flatMap((s) => s.values)))
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => pad.t + ih - (v / max) * ih
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

  // End labels only where they don't collide (≥14px apart); the legend carries the rest.
  const ends = series.map((s) => ({ s, y: y(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y)
  const showEnd = new Set<string>()
  ends.forEach((e, i) => {
    const prev = ends[i - 1], next = ends[i + 1]
    if ((!prev || e.y - prev.y >= 14) && (!next || next.y - e.y >= 14)) showEnd.add(e.s.id)
  })

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const px = e.clientX - r.left
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / r.width) * (n - 1)))))
  }

  const labelEvery = Math.ceil(n / Math.max(2, Math.floor(iw / 64)))

  return (
    <div className="chart" ref={ref}>
      <svg height={height} role="img" aria-label={`Line chart: ${series.map((s) => s.label).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'baseline' : 'gridline'} x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end">{compact(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i === n - 1 || (i % labelEvery === 0 && x(n - 1) - x(i) > 72)) && (
          <text key={i} className="tick" x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{l}</text>
        ))}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
          return (
            <g key={s.id}>
              {area && <path d={`${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              {series.length > 1 && showEnd.has(s.id) && (
                <text className="endlabel num" x={x(n - 1) + 9} y={y(s.values[n - 1] ?? 0)} dy="0.32em">{compact(s.values[n - 1] ?? 0)}</text>
              )}
            </g>
          )
        })}
        {hover !== null && (
          <g>
            <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />
            {series.map((s) => <circle key={s.id} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: Math.min(x(hover) + 12, width - 170), top: pad.t }}>
          <div className="t-title">Week of {labels[hover]}</div>
          {[...series].sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0)).map((s) => (
            <div className="t-row" key={s.id}><i style={{ background: s.color }} /><b>{fmt(s.values[hover] ?? 0)}</b><span>{s.label}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Legend({ items, kind = 'line' }: { items: { id: string; label: string; color: string }[]; kind?: 'line' | 'box' }) {
  return (
    <div className="legend">
      {items.map((i) => <span key={i.id}><i className={kind === 'box' ? 'box' : ''} style={{ background: i.color }} />{i.label}</span>)}
    </div>
  )
}

/* ---------- Sparkline ---------- */

export function Sparkline({ values, width = 96, height = 28, color = 'var(--s1)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values)
  const min = Math.min(...values)
  const range = Math.max(1, max - min)
  const x = (i: number) => 2 + (i / Math.max(1, values.length - 1)) * (width - 6)
  const y = (v: number) => 3 + (height - 6) - ((v - min) / range) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')
  const last = values.length - 1
  return (
    <svg width={width} height={height} aria-hidden style={{ overflow: 'visible', flex: 'none' }}>
      <path d={d} fill="none" stroke="var(--axis)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d={values.slice(-2).map((v, i) => `${i ? 'L' : 'M'}${x(last - 1 + i)},${y(v)}`).join('')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill={color} />
    </svg>
  )
}

/* ---------- Bar list (horizontal bars, value at the tip) ---------- */

export function BarList({ rows, color = 'var(--s1)', format = fmt }: {
  rows: { id: string; label: ReactNode; value: number; onClick?: () => void }[]; color?: string; format?: (n: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div key={r.id} className="barlist-row" onClick={r.onClick} style={{ cursor: r.onClick ? 'pointer' : undefined }} role={r.onClick ? 'link' : undefined} tabIndex={r.onClick ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && r.onClick?.()}>
          <div style={{ minWidth: 0 }}>
            <div className="name">{r.label}</div>
            <div className="track"><div className="fill" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: color }} /></div>
          </div>
          <div className="val">{format(r.value)}</div>
        </div>
      ))}
    </div>
  )
}

/* ---------- Heatmap (sequential, one hue) ---------- */

const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)', 'var(--seq-7)']

export function Heatmap({ rows, cols, values, format = fmt, unit = 'runs' }: {
  rows: { id: string; label: ReactNode }[]; cols: string[]; values: number[][]; format?: (n: number) => string; unit?: string
}) {
  const [tip, setTip] = useState<{ r: number; c: number; x: number; y: number } | null>(null)
  const max = Math.max(1, ...values.flat())
  const step = (v: number) => (v <= 0 ? -1 : Math.min(SEQ.length - 1, Math.floor((v / max) * SEQ.length)))
  const ref = useRef<HTMLDivElement>(null)
  const show = (r: number, c: number, el: HTMLElement) => {
    const box = ref.current!.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setTip({ r, c, x: b.left - box.left + b.width / 2, y: b.top - box.top })
  }
  return (
    <div className="chart" ref={ref}>
      <div className="heat" style={{ gridTemplateColumns: `max-content repeat(${cols.length}, minmax(0, 1fr))` }} onPointerLeave={() => setTip(null)}>
        {rows.map((row, r) => (
          <div key={row.id} style={{ display: 'contents' }}>
            <div className="rowlabel">{row.label}</div>
            {cols.map((_, c) => {
              const v = values[r][c]
              const s = step(v)
              return (
                <div
                  key={c}
                  className="cell"
                  tabIndex={0}
                  aria-label={`${typeof row.label === 'string' ? row.label : ''} ${cols[c]}: ${format(v)} ${unit}`}
                  style={{ background: s < 0 ? 'var(--surface-2)' : SEQ[s] }}
                  onPointerEnter={(e) => show(r, c, e.currentTarget)}
                  onFocus={(e) => show(r, c, e.currentTarget)}
                  onBlur={() => setTip(null)}
                />
              )
            })}
          </div>
        ))}
        <div />
        {cols.map((c, i) => <div key={i} className="collabel">{i % 2 === 0 || cols.length < 8 ? c : ''}</div>)}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
        Fewer
        {SEQ.map((c) => <span key={c} style={{ width: 14, height: 10, borderRadius: 3, background: c }} />)}
        More {unit}
      </div>
      {tip && (
        <div className="tooltip" style={{ left: Math.max(0, tip.x - 80), top: tip.y - 62, minWidth: 160 }}>
          <div className="t-title">{rows[tip.r].label} · {cols[tip.c]}</div>
          <div className="t-row"><b>{format(values[tip.r][tip.c])}</b><span>{unit}</span></div>
        </div>
      )}
    </div>
  )
}

/* ---------- Score ring ---------- */

export function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const color = value >= 0.85 ? 'var(--good)' : value >= 0.5 ? 'var(--warning)' : 'var(--critical)'
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      </svg>
      <span>{Math.round(value * 100)}</span>
    </div>
  )
}

/* ---------- Segmented meter (stacked, 2px gaps) ---------- */

export function SegMeter({ parts }: { parts: { id: string; label: string; value: number; color: string }[] }) {
  const total = Math.max(1, parts.reduce((a, b) => a + b.value, 0))
  return (
    <div>
      <div className="meter" style={{ height: 10, background: 'transparent' }}>
        {parts.filter((p) => p.value > 0).map((p, i, arr) => (
          <span key={p.id} title={`${p.label}: ${p.value}`} style={{
            width: `${(p.value / total) * 100}%`, background: p.color,
            borderRadius: `${i === 0 ? 999 : 2}px ${i === arr.length - 1 ? 999 : 2}px ${i === arr.length - 1 ? 999 : 2}px ${i === 0 ? 999 : 2}px`,
          }} />
        ))}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {parts.map((p) => <span key={p.id}><i className="box" style={{ background: p.color }} />{p.label} <b className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.value}</b></span>)}
      </div>
    </div>
  )
}
