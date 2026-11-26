// Layout fingerprints and snapshot alignment (no browser needed).
// Run: node apps/saas/tests/layout.test.ts   (Node 22.18+ runs TypeScript directly)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAME, fingerprintOf, hashOf, matchLayout, similarity, type FpNode } from '../src/core/embed/layout.ts'
import { alignPoint } from '../src/core/snapalign.ts'
import { redact } from '../src/core/embed/redact.ts'

const product = (cards: number, extra: FpNode[] = []): FpNode[] => [
  { tag: 'header', land: 'body' }, { tag: 'nav', land: 'header' }, ...Array.from({ length: 6 }, () => ({ tag: 'a', land: 'nav' })),
  { tag: 'main', land: 'body', id: 'content' }, { tag: 'h1', land: 'main' }, { tag: 'img', land: 'main' }, { tag: 'button', land: 'main', id: 'buy' },
  { tag: 'section', land: 'main' }, { tag: 'h2', land: 'section' }, ...Array.from({ length: cards }, () => ({ tag: 'a', land: 'section' })),
  { tag: 'footer', land: 'body' }, ...Array.from({ length: 8 }, () => ({ tag: 'a', land: 'footer' })), ...extra,
]
const redesign: FpNode[] = [
  { tag: 'header', land: 'body' }, { tag: 'main', land: 'body' }, { tag: 'aside', land: 'main' }, { tag: 'form', land: 'aside' }, { tag: 'input', land: 'form' }, { tag: 'input', land: 'form' },
  { tag: 'article', land: 'main' }, { tag: 'h1', land: 'article' }, ...Array.from({ length: 4 }, () => ({ tag: 'h3', land: 'article' })), ...Array.from({ length: 4 }, () => ({ tag: 'picture', land: 'article' })),
  { tag: 'button', land: 'article', role: 'tab' }, { tag: 'button', land: 'article', role: 'tab' }, { tag: 'dialog', land: 'body' },
]

test('same page, small change (one more card, one extra button) = same layout', () => {
  const a = fingerprintOf(product(12)), b = fingerprintOf(product(14, [{ tag: 'button', land: 'section' }]))
  assert.ok(similarity(a, b) >= SAME, `similarity ${similarity(a, b)}`)
  assert.equal(matchLayout(b, [a]), 0)
})
test('redesign = new layout', () => {
  const a = fingerprintOf(product(12)), c = fingerprintOf(redesign)
  assert.ok(similarity(a, c) < 0.3, `similarity ${similarity(a, c)}`)
  assert.equal(matchLayout(c, [a]), -1)
})
test('text is never part of the fingerprint: changed text gives the same hash', () => {
  // FpNode has no text at all; ids with digits (generated) are dropped too.
  const a = fingerprintOf(product(12)), b = fingerprintOf(product(12).map((n) => (n.tag === 'h1' ? { ...n, id: 'title-8f3a2' } : n)))
  assert.equal(hashOf(a), hashOf(b))
  assert.match(hashOf(a), /^[0-9a-f]{16}$/)
  assert.ok(!JSON.stringify(a).match(/[A-Z][a-z]+ [a-z]+/), 'no prose in keys')
})
test('similarity is symmetric, 1 for identical, 0 for empty', () => {
  const a = fingerprintOf(product(3)), b = fingerprintOf(redesign)
  assert.equal(similarity(a, a), 1)
  assert.ok(Math.abs(similarity(a, b) - similarity(b, a)) < 1e-9)
  assert.equal(similarity({}, {}), 0)
})
test('alignment: element-anchored points follow the element box; others scale by width', () => {
  const snap = { vw: 1280, height: 3000, boxes: { '#buy': [100, 500, 200, 40] as [number, number, number, number] } }
  assert.deepEqual(alignPoint({ sel: '#buy', ex: 0.5, ey: 0.5, x: 9999, y: 9999, vw: 1440 }, snap), { x: 200, y: 520, anchored: true })
  const p = alignPoint({ x: 720, y: 900, vw: 1440 }, snap)!
  assert.equal(p.anchored, false); assert.equal(Math.round(p.x), 640); assert.equal(Math.round(p.y), 800)
  assert.equal(alignPoint({ x: 10, y: 99999, vw: 1280 }, snap), null)
  assert.equal(alignPoint({ x: null, y: 1, vw: 1280 }, snap), null)
})
test('masking: emails and phone numbers in page text are replaced', () => {
  const out = redact('Mail ana.lee+shop@example.co.uk or call +62 812-3456-7890 today')
  assert.ok(!/example|3456/.test(out)); assert.match(out, /\[email\]/); assert.match(out, /\[number\]/)
})
