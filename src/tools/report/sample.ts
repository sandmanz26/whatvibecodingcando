/**
 * Sample research data, for demos only: eight shopping sessions, five usability-test
 * participants, eight 5-second results, fake-door counts and a few researcher notes.
 * Every id starts with "demo-" so it can be removed without touching real data.
 */
import { APP, readJSON, writeJSON } from '../shared'
import type { ClickEvent, InsightEvent } from '../insights/store'
import type { TestSession } from '../tests/store'
import type { FiveSecResult } from '../fivesec/store'
import type { DoorEvent } from '../doors/store'

const K = {
  clicks: `${APP}.insights.clicks`, notes: `${APP}.insights.notes`, tests: `${APP}.tests.sessions`,
  five: `${APP}.fivesec.results`, doors: `${APP}.doors.events`,
}
const isDemo = (id: string) => id.startsWith('demo-')

type Tap = [page: string, sel: string, label: string, fx: ClickEvent['fx'], to?: string, ex?: number, ey?: number, dead?: boolean]
type Step = ['view', string] | ['tap', ...Tap]

const NAV_SPORTS: Tap = ['/', 'a[href="#/search?cat=sports"]', 'Sports', 'navigated', '/search', 48, 52]
const CARD_P1: Tap = ['/search', 'a[href="#/product/p1"]', 'Product photo', 'navigated', '/product/p1', 40, 30]
const PHOTO: Tap = ['/product/p1', 'div.gallery > div.ph', '(not a control) Product photo 1', 'nothing', undefined, 52, 46, true]
const UNDERSTOOD: Tap = ['/search', 'div.understood > span.tag:nth-of-type(2)', '(not a control) Understood: Sports', 'nothing', undefined, 60, 50, true]
const SIZE: Tap = ['/product/p1', 'div.buy > div.opt:nth-of-type(1) button.chip:nth-of-type(4)', '42', 'changed', undefined, 50, 50]
const ADD: Tap = ['/product/p1', '#add-to-cart', 'Add to cart', 'changed', undefined, 45, 55]
const CART: Tap = ['/product/p1', 'a[href="#/cart"]', 'Cart', 'navigated', '/cart', 50, 50]
const CHECKOUT: Tap = ['/cart', 'div.cart > aside > button', 'Check out', 'navigated', '/checkout', 50, 50]
const PLACE: Tap = ['/checkout', 'div.cart > aside > button', 'Place order', 'navigated', '/orders/ORD-10241', 50, 50]
const ASK: Tap = ['/', '#ask-ai', 'Ask AI', 'changed', undefined, 40, 50]
const WATER: Tap = ['/product/p1', 'button[data-q="Is it waterproof?"]', 'Is it waterproof?', 'changed', undefined, 50, 50]

const JOURNEYS: Step[][] = [
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...PHOTO], ['tap', ...PHOTO], ['tap', ...SIZE], ['tap', ...ADD], ['tap', ...CART], ['view', '/cart'], ['tap', ...CHECKOUT], ['view', '/checkout'], ['tap', ...PLACE], ['view', '/orders/ORD-10241']],
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...UNDERSTOOD], ['tap', ...UNDERSTOOD], ['tap', ...UNDERSTOOD], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...PHOTO], ['tap', ...WATER]],
  [['view', '/'], ['tap', ...ASK], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...SIZE], ['tap', ...ADD], ['tap', ...CART], ['view', '/cart'], ['tap', ...CHECKOUT], ['view', '/checkout']],
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...UNDERSTOOD], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...PHOTO]],
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...ADD], ['tap', ...ADD]],
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...CARD_P1], ['view', '/product/p1'], ['tap', ...PHOTO], ['tap', ...SIZE], ['tap', ...ADD], ['tap', ...CART], ['view', '/cart']],
  [['view', '/'], ['tap', ...ASK], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...UNDERSTOOD]],
  [['view', '/'], ['tap', ...NAV_SPORTS], ['view', '/search'], ['tap', ...CARD_P1], ['view', '/product/p1']],
]

function sessionEvents(sid: string, start: number, steps: Step[]): InsightEvent[] {
  const out: InsightEvent[] = []
  let t = start, from: string | undefined
  for (const s of steps) {
    t += 2500 + ((out.length * 7919) % 5000)
    const base = { t: new Date(t).toISOString(), sid, vw: 1440, vh: 900 }
    if (s[0] === 'view') { out.push({ type: 'view', ...base, page: s[1], ...(from ? { from } : {}) }); from = s[1]; continue }
    const [, p, sel, label, fx, to, ex = 50, ey = 50, dead] = s
    out.push({
      type: 'click', ...base, page: p, x: 50, y: 300, docH: 2200, label, tag: dead ? 'div' : 'button', kind: dead ? 'not a control' : 'button',
      section: 'Page', sel, ex, ey, ew: 100, eh: 40, ms: 3000, sy: 40, fx, ...(to ? { to } : {}), ...(dead ? { dead: true } : {}),
    })
  }
  return out
}

export function hasSample() {
  return readJSON<InsightEvent[]>(K.clicks, []).some((e) => isDemo(e.sid)) || readJSON<TestSession[]>(K.tests, []).some((s) => isDemo(s.id))
}

export function addSample() {
  removeSample()
  const day = Date.now() - 2 * 24 * 3600 * 1000
  const evs = JOURNEYS.flatMap((j, i) => sessionEvents(`demo-s${i + 1}`, day + i * 3600 * 1000, j))
  writeJSON(K.clicks, [...readJSON<InsightEvent[]>(K.clicks, []), ...evs])

  writeJSON(K.notes, {
    ...readJSON<Record<string, unknown>>(K.notes, {}),
    'demo-s2': { note: 'Tried to tap the “Sports” chip in “Understood as” to remove it. Expected it to work like a filter.', tags: ['Confused'] },
    'demo-s4': { note: 'Looked for a bigger photo; tapped the image twice, then left.', tags: ['Got lost'] },
    'demo-s7': { note: 'Opened the assistant, read the picks, went back to the category instead.', tags: ['Confused', 'Worth a follow-up'] },
  })

  const at = (i: number) => new Date(day + i * 1800 * 1000).toISOString()
  const tap = (page: string, label: string, sel: string, hit: boolean) => ({ t: 4000, page, x: 50, y: 300, docH: 2200, vw: 1440, label, sel, hit, ex: 50, ey: 50 })
  const people: [string, ['success' | 'timeout' | 'gave_up', number, boolean][]][] = [
    ['A', [['success', 31000, true], ['success', 12000, true], ['success', 40000, true]]],
    ['B', [['success', 46000, true], ['timeout', 60000, false], ['success', 52000, false]]],
    ['C', [['success', 28000, false], ['success', 21000, false], ['timeout', 90000, false]]],
    ['D', [['timeout', 90000, false], ['gave_up', 35000, false], ['success', 38000, true]]],
    ['E', [['success', 39000, true], ['timeout', 60000, false], ['gave_up', 44000, false]]],
  ]
  const tasks = ['t1', 't2', 't3']
  const firstTaps: Record<string, [string, string, string]> = {
    t1: ['/', 'Sports', 'a[href="#/search?cat=sports"]'], t2: ['/product/p1', 'Specifications', 'section.card h2'], t3: ['/', 'Ask AI', '#ask-ai'],
  }
  const sessions: TestSession[] = people.map(([who, res], i) => ({
    id: `demo-u${i + 1}`, testId: 'basics', participant: `Participant ${who}`, startedAt: at(i), finishedAt: at(i), vw: 1440,
    attempts: res.map(([outcome, ms, good], j) => {
      const [p, l, s] = firstTaps[tasks[j]]
      const first = good ? tap(p, l, s, true) : tap(p, j === 1 ? 'Specifications' : 'Search or describe what you need', j === 1 ? 'section.card h2' : 'input', false)
      return { taskId: tasks[j], outcome, ms, taps: [first], pages: [p], firstTapCorrect: good }
    }),
  }))
  writeJSON(K.tests, [...readJSON<TestSession[]>(K.tests, []), ...sessions])

  const five: FiveSecResult[] = [
    ...[0, 1, 2].map((i) => ({ id: `demo-f${i}`, testId: 'first-look', t: at(i), vw: 1440, vh: 900, ms: 1800 + i * 400, x: 70, y: 28, docH: 2200, ex: 40, ey: 50, sel: '#ask-ai', label: 'Ask AI', hit: true })),
    ...[3, 4, 5, 6].map((i) => ({ id: `demo-f${i}`, testId: 'first-look', t: at(i), vw: 1440, vh: 900, ms: 1500 + i * 300, x: 40, y: 28, docH: 2200, ex: 30, ey: 50, sel: 'input', label: 'Search or describe what you need', hit: false })),
    { id: 'demo-f7', testId: 'first-look', t: at(7), vw: 1440, vh: 900, missed: true },
  ]
  writeJSON(K.five, [...readJSON<FiveSecResult[]>(K.five, []), ...five])

  const doors: DoorEvent[] = [
    ...Array.from({ length: 10 }, (_, i): DoorEvent => ({ door: 'price-alert', sid: `demo-d${i}`, type: 'seen', t: at(i), vw: 1440 })),
    ...[1, 4, 7].map((i): DoorEvent => ({ door: 'price-alert', sid: `demo-d${i}`, type: 'click', t: at(i), vw: 1440 })),
  ]
  writeJSON(K.doors, [...readJSON<DoorEvent[]>(K.doors, []), ...doors])
}

export function removeSample() {
  writeJSON(K.clicks, readJSON<InsightEvent[]>(K.clicks, []).filter((e) => !isDemo(e.sid)))
  writeJSON(K.notes, Object.fromEntries(Object.entries(readJSON<Record<string, unknown>>(K.notes, {})).filter(([k]) => !isDemo(k))))
  writeJSON(K.tests, readJSON<TestSession[]>(K.tests, []).filter((s) => !isDemo(s.id)))
  writeJSON(K.five, readJSON<FiveSecResult[]>(K.five, []).filter((r) => !isDemo(r.id)))
  writeJSON(K.doors, readJSON<DoorEvent[]>(K.doors, []).filter((e) => !isDemo(e.sid)))
}
