/**
 * Example reviews, so the Compare page shows what it does before anyone picks a component.
 * Each component is captured from the real screen, in a hidden frame at its device width,
 * exactly as a picked one would be: the styles in the table are what the app renders.
 */
import { DEVICES, type Device } from '../insights/ScreenViewer'
import { APP } from '../shared'
import { rid, snapshot, type About, type Choice, type Review, type Slot } from './store'

const SEEDED = `${APP}.compare.seeded`
export const wasSeeded = () => { try { return localStorage.getItem(SEEDED) === '1' } catch { return true } }
export const markSeeded = () => { try { localStorage.setItem(SEEDED, '1') } catch { /* ignore */ } }

interface Spec { page: string; device: Device; sel: string }
const SAMPLES: { title: string; question: string; a: Spec; b: Spec; notes: { about: About; text: string }[]; reviewed?: { choice: Choice; summary: string; pins: { side: 'A' | 'B'; x: number; y: number; text: string }[] } }[] = [
  {
    title: 'Product card · Home (desktop) vs Search (mobile)',
    question: 'Is this the same card on both screens, or should one change?',
    a: { page: '/', device: 'desktop', sel: '.p-grid.six .pcard' },
    b: { page: '/search?q=running%20shoes', device: 'mobile', sel: '.pcard' },
    notes: [
      { about: 'both', text: 'Sample review: the same product card on two screens and two widths. Its size follows the screen; colours, font and corner radius should match. Check the table.' },
      { about: 'A', text: 'On Home this card sits in “Deals today”.' },
    ],
  },
  {
    title: 'Primary buttons · header Search vs Buy now',
    question: 'Should page-level actions be bigger than the header’s?',
    reviewed: { choice: 'both', summary: 'Intended: Buy now is the page’s main action, so the larger size is right. Keep both.', pins: [{ side: 'A', x: 50, y: 50, text: 'Default size works in the header.' }, { side: 'B', x: 50, y: 50, text: 'Large size is right for the main action.' }] },
    a: { page: '/', device: 'desktop', sel: '.sh-search .btn.primary' },
    b: { page: '/product/p1', device: 'desktop', sel: '.buy .btn.primary' },
    notes: [{ about: 'both', text: 'Sample review: two primary actions. “Buy now” uses the large button size and the header Search button the default size. Decide whether that difference is intended.' }],
  },
  {
    title: 'Chips · search ideas vs product options',
    question: 'Should a chosen option look different from a search idea?',
    a: { page: '/', device: 'desktop', sel: '.hero .chip, .hero2-ideas button' },
    b: { page: '/product/p1', device: 'desktop', sel: '.opt .chip' },
    notes: [{ about: 'both', text: 'Sample review: these look alike but do different jobs. One starts a search, the other selects a size. Should a chosen option look different from an idea?' }],
  },
]

function capture(spec: Spec): Promise<Slot | null> {
  const d = DEVICES[spec.device]
  const [path, q] = spec.page.split('?')
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  f.tabIndex = -1
  f.style.cssText = `position:fixed;left:-${d.w + 200}px;top:0;width:${d.w}px;height:${d.h}px;border:0;visibility:hidden;pointer-events:none`
  f.src = `${window.location.pathname}${window.location.search}#${path}?${[q, 'embed'].filter(Boolean).join('&')}`
  document.body.appendChild(f)
  return new Promise((resolve) => {
    let tries = 0
    const done = (s: Slot | null) => { f.remove(); resolve(s) }
    const look = () => {
      const doc = f.contentDocument
      let el: Element | undefined
      try { el = doc ? Array.from(doc.querySelectorAll(spec.sel)).find((e) => e.getBoundingClientRect().width > 0) : undefined } catch { /* bad selector */ }
      if (el) { done(snapshot(el, spec.device)); return }
      if (++tries > 40) { done(null); return }
      window.setTimeout(look, 150)
    }
    f.addEventListener('load', look, { once: true })
  })
}

/** Builds the example reviews; those whose components can't be found are left out. */
export async function buildSamples(author: string): Promise<Review[]> {
  const out: Review[] = []
  for (const s of SAMPLES) {
    const a = await capture(s.a)
    const b = a && await capture(s.b)
    if (!a || !b) continue
    out.push({
      id: rid(), title: s.title, question: s.question, a, b, sample: true, createdAt: '', updatedAt: '', submittedBy: author, round: 1,
      notes: s.notes.map((n) => ({ id: rid(), author, text: n.text, about: n.about, at: '' })),
      status: s.reviewed ? 'done' : 'pending',
      annotations: (s.reviewed?.pins ?? []).map((p) => ({ id: rid(), ...p, author: 'Sample reviewer', at: '', round: 1 })),
      ...(s.reviewed ? { decision: { by: 'Sample reviewer', at: '', choice: s.reviewed.choice, summary: s.reviewed.summary, round: 1 } } : {}),
    })
  }
  // Times are set once every component is captured: notes are never older than their components,
  // and the first sample gets the latest time so it heads the newest-first list.
  const end = Date.now()
  out.forEach((r, i) => {
    const at = new Date(end - i).toISOString()
    r.createdAt = at; r.updatedAt = at
    r.notes.forEach((n) => { n.at = new Date(end).toISOString() })
    r.annotations?.forEach((a) => { a.at = new Date(end).toISOString() })
    if (r.decision) r.decision.at = new Date(end).toISOString()
  })
  return out
}
