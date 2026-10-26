/**
 * The marketplace's "AI", simulated for the prototype: no model, no server.
 * It reads a plain-language request into filters, ranks products, answers questions
 * from a listing's specs, and writes short assistant replies. Deterministic, so a
 * usability test shows every participant the same thing.
 */
import { CATEGORIES, PRODUCTS, type CategoryId, type Product } from '../data/shop'

export interface Understood {
  text: string
  category?: CategoryId
  maxPrice?: number
  minPrice?: number
  /** words that matched product tags */
  needs: string[]
  sort?: 'price' | 'rating'
}

const STOP = new Set('a an the for to of and or with in on my me i want need looking something some under below less than over above more cheap good best buy cari mau yang untuk dan atau di bawah dengan murah bagus'.split(' '))

/** "500k", "500rb", "1jt", "1.5 juta", "Rp 300.000", "300000" → rupiah */
function money(raw: string): number | undefined {
  const m = raw.toLowerCase().replace(/rp\.?\s*/, '').match(/^([\d.,]+)\s*(k|rb|ribu|jt|juta|m)?$/)
  if (!m) return undefined
  const unit = m[2]
  const n = unit ? Number(m[1].replace(',', '.')) : Number(m[1].replace(/[.,]/g, ''))
  if (!Number.isFinite(n)) return undefined
  return Math.round(unit === 'k' || unit === 'rb' || unit === 'ribu' ? n * 1000 : unit === 'jt' || unit === 'juta' || unit === 'm' ? n * 1_000_000 : n)
}

const ALL_TAGS = [...new Set(PRODUCTS.flatMap((p) => p.tags))]

export function understand(text: string): Understood {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9.,\s-]/g, ' ')} `
  const u: Understood = { text, needs: [] }
  const price = t.match(/(?:under|below|less than|max|budget|up to|di ?bawah|maks(?:imal)?|<)\s*(rp\.?\s*)?([\d.,]+\s*(?:k|rb|ribu|jt|juta|m)?)\b/)
  if (price) u.maxPrice = money(price[2])
  const over = t.match(/(?:over|above|more than|di ?atas|>)\s*(rp\.?\s*)?([\d.,]+\s*(?:k|rb|ribu|jt|juta|m)?)\b/)
  if (over) u.minPrice = money(over[2])
  const words = t.split(/\s+/).filter(Boolean)
  // Needs: multi-word tags first ("noise cancelling"), then single words.
  for (const tag of ALL_TAGS.filter((x) => x.includes(' '))) if (t.includes(` ${tag} `)) u.needs.push(tag)
  for (const w of words) {
    const s = w.replace(/s$/, '')
    if (STOP.has(w) || w.length < 3 || /\d/.test(w)) continue
    const hit = ALL_TAGS.find((tag) => !tag.includes(' ') && (tag === w || tag === s))
    if (hit && !u.needs.includes(hit)) u.needs.push(hit)
  }
  // Category: words that name it, plus how well its products fit the needs, so
  // "running shoes" lands in Sports (running products) rather than Fashion (sneakers).
  let best = 0
  for (const c of CATEGORIES) {
    const named = c.words.filter((w) => words.some((x) => x === w || x === `${w}s`)).length
    if (!named) continue
    const fit = Math.max(0, ...PRODUCTS.filter((p) => p.category === c.id).map((p) => u.needs.filter((n) => p.tags.includes(n)).length))
    const n = named * 2 + fit
    if (n > best) { best = n; u.category = c.id }
  }
  if (/\b(cheapest|termurah|lowest price)\b/.test(t)) u.sort = 'price'
  if (/\b(best rated|top rated|terbaik)\b/.test(t)) u.sort = 'rating'
  return u
}

/** How well a product fits what was understood: tag hits first, then rating and sales. */
export function score(p: Product, u: Understood) {
  const hits = u.needs.filter((n) => p.tags.includes(n) || p.title.toLowerCase().includes(n)).length
  return hits * 10 + p.rating + Math.log10(p.sold + 1) / 4
}

export function search(u: Understood, opts: { category?: string; maxPrice?: number; minRating?: number; sort?: string } = {}) {
  const cat = opts.category ?? u.category
  const max = opts.maxPrice ?? u.maxPrice
  const sort = opts.sort ?? u.sort ?? 'match'
  const list = PRODUCTS.filter((p) =>
    (!cat || p.category === cat) && (!max || p.price <= max) && (!u.minPrice || p.price >= u.minPrice) &&
    (!opts.minRating || p.rating >= opts.minRating) &&
    (!u.needs.length || u.needs.some((n) => p.tags.includes(n) || p.title.toLowerCase().includes(n))))
  // With nothing understood, fall back to plain word matching on titles.
  const plain = !u.needs.length && !u.category && u.text.trim()
    ? PRODUCTS.filter((p) => u.text.toLowerCase().split(/\s+/).some((w) => w.length > 2 && p.title.toLowerCase().includes(w)))
    : null
  const base = plain ?? list
  return [...base].sort((a, b) =>
    sort === 'price' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'rating' ? b.rating - a.rating : score(b, u) - score(a, u))
}

/* ---------- questions about one product ---------- */

const ASK: { words: string[]; keys: string[] }[] = [
  { words: ['waterproof', 'water', 'rain', 'hujan', 'air'], keys: ['Waterproof', 'Leakproof'] },
  { words: ['battery', 'baterai', 'charge', 'last'], keys: ['Battery'] },
  { words: ['size', 'fit', 'ukuran', 'small', 'big'], keys: ['Fit', 'Size', 'Capacity'] },
  { words: ['weight', 'heavy', 'light', 'berat'], keys: ['Weight'] },
  { words: ['warranty', 'garansi', 'guarantee'], keys: ['Warranty'] },
  { words: ['material', 'made', 'bahan'], keys: ['Material', 'Upper', 'Coating'] },
  { words: ['noise', 'anc', 'quiet'], keys: ['Noise cancelling'] },
  { words: ['beginner', 'pemula', 'use', 'for', 'good'], keys: ['Use', 'Skin type'] },
  { words: ['skin', 'kulit', 'sensitive'], keys: ['Skin type', 'Fragrance'] },
]

export function suggestedQuestions(p: Product): string[] {
  const q: string[] = []
  if (p.specs.Waterproof) q.push('Is it waterproof?')
  if (p.specs.Battery) q.push('How long does the battery last?')
  if (p.specs.Fit || p.options?.Size) q.push('Does it run small or large?')
  if (p.specs.Warranty) q.push('Is there a warranty?')
  if (p.specs['Skin type']) q.push('Is it OK for my skin type?')
  if (p.specs.Use) q.push('Is it good for beginners?')
  q.push('What do buyers complain about?')
  return q.slice(0, 4)
}

/** Answers from the listing only; says so when the listing doesn't cover it. */
export function answer(p: Product, question: string): string {
  const q = question.toLowerCase()
  if (/complain|negative|bad|cons|kurang|minus/.test(q)) return `Buyers mostly mention: ${p.cons.join('; ').toLowerCase()}.`
  if (/beginner|pemula/.test(q) && p.tags.includes('beginner')) return `Yes — reviewers who are beginners like it: “${p.pros[0]}”.`
  for (const a of ASK) {
    if (!a.words.some((w) => q.includes(w))) continue
    const key = a.keys.find((k) => p.specs[k])
    if (key) return `${key}: ${p.specs[key]}.`
  }
  if (/price|harga|discount|diskon/.test(q)) return p.oldPrice ? `It’s ${Math.round((1 - p.price / p.oldPrice) * 100)}% off right now.` : 'There’s no discount on it right now.'
  return 'The listing doesn’t say. You can ask the seller from this page.'
}

/* ---------- the shopping assistant ---------- */

export interface Reply { text: string; products: Product[]; understood: Understood; follow: string[] }

export function assistantReply(message: string): Reply {
  const u = understand(message)
  const found = search(u).slice(0, 3)
  const bits: string[] = []
  if (u.category) bits.push(CATEGORIES.find((c) => c.id === u.category)!.name.toLowerCase())
  if (u.needs.length) bits.push(u.needs.slice(0, 3).join(', '))
  if (u.maxPrice) bits.push(`under Rp ${u.maxPrice.toLocaleString('id-ID')}`)
  const text = !found.length
    ? 'I couldn’t find a good match. Try describing what it’s for, or a budget.'
    : bits.length
      ? `Here ${found.length === 1 ? 'is the best match' : `are ${found.length} good matches`} for ${bits.join(' · ')}.`
      : `Here ${found.length === 1 ? 'is something' : 'are a few things'} you might like.`
  const follow = found.length ? ['Cheaper options', 'Best rated'] : ['Running shoes for beginners', 'Gift under 300k']
  return { text, products: found, understood: u, follow }
}

export const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
