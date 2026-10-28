import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { CATEGORIES, category } from '../../data/shop'
import { rp, search, understand } from '../../lib/ai'
import { useStore } from '../../store/store'
import { Empty, ProductCard } from '../../components/ui'

const PRICES = [100000, 300000, 500000, 1000000, 2000000]

export default function Search() {
  const [params, setParams] = useSearchParams()
  const { ask } = useStore()
  const q = params.get('q') ?? ''
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v === null || v === '') p.delete(k); else p.set(k, v)
    setParams(p, { replace: true })
  }
  const u = useMemo(() => understand(q), [q])
  // What the AI understood can be overridden by the filters on the left.
  const cat = params.get('cat') ?? (params.has('nocat') ? undefined : u.category)
  const max = params.get('max') ? Number(params.get('max')) : params.has('nomax') ? undefined : u.maxPrice
  const minRating = params.get('rating') ? Number(params.get('rating')) : undefined
  const sort = params.get('sort') ?? undefined
  const deals = params.get('deals') === '1'

  const results = useMemo(() => {
    const base = q ? search(u, { category: cat, maxPrice: max, minRating, sort }) : search({ text: '', needs: [] }, { category: cat, maxPrice: max, minRating, sort: sort ?? 'popular' })
    const list = deals ? base.filter((p) => p.oldPrice) : base
    return sort === 'popular' || (!q && !sort) ? [...list].sort((a, b) => b.sold - a.sold) : list
  }, [q, u, cat, max, minRating, sort, deals])

  const title = q ? `“${q}”` : deals ? 'Deals today' : cat ? category(cat)?.name : 'All products'

  return (
    <div className="search">
      <aside className="filters" aria-label="Filters">
        <div className="f-group">
          <b>Category</b>
          <label><input type="radio" name="cat" checked={!cat} onChange={() => { set('cat', null); if (u.category) set('nocat', '1') }} /> Any</label>
          {CATEGORIES.map((c) => <label key={c.id}><input type="radio" name="cat" checked={cat === c.id} onChange={() => set('cat', c.id)} /> {c.name}</label>)}
        </div>
        <div className="f-group">
          <b>Price up to</b>
          <label><input type="radio" name="max" checked={!max} onChange={() => { set('max', null); if (u.maxPrice) set('nomax', '1') }} /> Any price</label>
          {PRICES.map((p) => <label key={p}><input type="radio" name="max" checked={max === p} onChange={() => set('max', String(p))} /> {rp(p)}</label>)}
        </div>
        <div className="f-group">
          <b>Rating</b>
          {[0, 4.5, 4.7].map((r) => <label key={r}><input type="radio" name="rating" checked={(minRating ?? 0) === r} onChange={() => set('rating', r ? String(r) : null)} /> {r ? `${r} and up` : 'Any rating'}</label>)}
        </div>
      </aside>

      <section style={{ minWidth: 0 }}>
        {q && (u.category || u.maxPrice || u.needs.length > 0) && (
          <div className="understood" aria-label="What the AI understood">
            <span className="row" style={{ gap: 6 }}><Sparkles size={14} /> <b>Understood as</b></span>
            {u.category && <span className="tag" aria-label={`Understood: ${category(u.category)?.name}`}>{category(u.category)?.name}</span>}
            {u.maxPrice && <span className="tag" aria-label={`Understood: under ${rp(u.maxPrice)}`}>Under {rp(u.maxPrice)}</span>}
            {u.minPrice && <span className="tag">Over {rp(u.minPrice)}</span>}
            {u.needs.map((n) => <span key={n} className="tag" aria-label={`Understood: ${n}`}>{n}</span>)}
            <span className="muted" style={{ fontSize: 12.5 }}>Change it with the filters.</span>
          </div>
        )}
        <div className="res-head">
          <div><h1>{title}</h1><span className="muted">{results.length} result{results.length === 1 ? '' : 's'}</span></div>
          <select className="select" style={{ width: 180 }} value={sort ?? (q ? 'match' : 'popular')} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            {q && <option value="match">Best match</option>}
            <option value="popular">Most popular</option>
            <option value="price">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Best rated</option>
          </select>
        </div>
        {(params.get('cat') || params.get('max') || params.get('rating')) && (
          <button className="btn ghost sm" style={{ marginBottom: 12 }} onClick={() => { const p = new URLSearchParams(); if (q) p.set('q', q); setParams(p, { replace: true }) }}><X size={13} /> Clear filters</button>
        )}
        {results.length === 0 ? (
          <div className="card"><Empty title="Nothing matches yet">
            <span>Try fewer filters, or describe it to the assistant.</span>
            <button className="btn sm primary" onClick={() => ask(q || undefined)}><Sparkles size={13} /> Ask the assistant</button>
          </Empty></div>
        ) : (
          <div className="p-grid four">{results.map((p) => <ProductCard key={p.id} p={p} why={q && u.needs.length ? matchWhy(p.tags, u.needs) : undefined} />)}</div>
        )}
        {results.length > 0 && q && (
          <div className="ai-band" style={{ marginTop: 24 }}>
            <span className="muted">Not quite right?</span>
            <button className="btn" onClick={() => ask(q)}><Sparkles size={14} /> Refine with the assistant</button>
          </div>
        )}
      </section>
    </div>
  )
}

function matchWhy(tags: string[], needs: string[]) {
  const hit = needs.filter((n) => tags.includes(n))
  return hit.length ? `Matches: ${hit.slice(0, 3).join(', ')}` : undefined
}

