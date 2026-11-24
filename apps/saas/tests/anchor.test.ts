// Pins that survive redeploys: the pure scoring and fingerprint helpers (no browser needed).
// Run: node apps/saas/tests/anchor.test.ts   (Node 22.18+ runs TypeScript directly)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HIGH, MED, decide, describe, generatedClass, generatedId, mask, normText, score, segment, stableAttrs, type Fp } from '../src/core/embed/anchor.ts'

const buy: Fp = { t: 'button', a: { type: 'button' }, x: 'Buy now', p: ['div.product-actions', 'section[role=region].product', 'main'], i: 0, n: 2, l: 'section:Green tea', px: 0.3, py: 0.4 }

test('generated ids and classes are recognised', () => {
  for (const id of [':r1:', '«r3»', 'radix-12', 'id-12345', 'x7k2p9q', '3f2a9c1e-77aa']) assert.equal(generatedId(id), true, id)
  for (const id of ['checkout', 'buy-now', 'main-nav', 'plan-team']) assert.equal(generatedId(id), false, id)
  for (const c of ['css-1x2y3z', 'sc-bdVaJa', 'Button_root__x7k2p', 'w-[37px]', 'md:flex', 'e1q2w3e4']) assert.equal(generatedClass(c), true, c)
  for (const c of ['card', 'btn-primary', 'hero']) assert.equal(generatedClass(c), false, c)
})

test('text is normalised, short and masked', () => {
  assert.equal(mask('mail ani@example.com or +62 812 3456 7890'), 'mail [email] or [number]')
  assert.equal(normText('  Buy\n   now  '), 'Buy now')
  assert.equal(normText('x'.repeat(200)).length, 80)
})

test('stable attributes: generated ids dropped, href reduced to its path, values masked', () => {
  const attrs: Record<string, string> = { id: ':r5:', 'aria-label': 'Email ani@example.com', href: '/shop/tea?utm=1#top', 'data-hunch': 'buy', type: 'submit' }
  const a = stableAttrs('a', (n) => attrs[n] ?? null)
  assert.deepEqual(a, { 'data-hunch': 'buy', 'aria-label': 'Email [email]', href: '/shop/tea' })
  assert.equal(segment('section', { id: 'css-x7k2p9', role: 'region' }, ['css-1abcde', 'product']), 'section[role=region].product')
})

test('the same element scores 1 and is confident', () => {
  assert.equal(score(buy, buy, true), 1)
  assert.equal(decide([score(buy, buy, true), 0.2]).state, 'ok')
})

test('renamed classes and a small move keep the pin confident', () => {
  const after: Fp = { ...buy, p: ['div.actions-v2', 'section[role=region].product-x', 'main'], px: 0.32, py: 0.45 }
  const s = score(buy, after)
  assert.ok(s >= HIGH, `score ${s}`)
  assert.equal(decide([s]).state, 'ok')
})

test('data-hunch decides on its own', () => {
  const fp: Fp = { t: 'button', a: { 'data-hunch': 'buy' }, x: 'Buy now' }
  assert.equal(score(fp, { t: 'button', a: { 'data-hunch': 'buy' }, x: 'Purchase' }), 1)
  assert.equal(score(fp, { t: 'button', a: { 'data-hunch': 'other' }, x: 'Buy now' }), 0)
})

test('another button with the same label is not a silent jump (the known failure)', () => {
  // The original was removed; a "Buy now" in another section, elsewhere on the page, remains.
  const other: Fp = { t: 'button', a: { type: 'button' }, x: 'Buy now', p: ['div.upsell', 'aside', 'main'], i: 1, n: 2, l: 'aside:You may also like', px: 0.8, py: 0.9 }
  const s = score(buy, other)
  assert.ok(s < HIGH, `score ${s} must stay below confident`)
  assert.notEqual(decide([s]).state, 'ok')
})

test('the right one of two same-label buttons wins by path, index and position', () => {
  const same = { ...buy }
  const twin: Fp = { ...buy, i: 1, px: 0.3, py: 0.7 }
  const d = decide([score(buy, twin), score(buy, same)])
  assert.equal(d.state, 'ok')
  assert.equal(d.index, 1)
})

test('two candidates that tie are uncertain, never confident', () => {
  const a: Fp = { ...buy, p: ['div', 'section', 'main'], px: undefined, py: undefined }
  const s = score(buy, a)
  const d = decide([s, s])
  assert.notEqual(d.state, 'ok')
})

test('nothing similar: gone', () => {
  const d = decide([score(buy, { t: 'button', x: 'Sign up', p: ['nav'], px: 0.9, py: 0.05 })])
  assert.equal(d.state, 'gone')
  assert.equal(decide([]).state, 'gone')
  assert.ok(MED < HIGH)
})

test('an id dropped by the build counts less than a changed one', () => {
  const fp: Fp = { t: 'h1', a: { id: 'headline' }, x: 'A plain website', p: ['div', 'section.hero'], px: 0.2, py: 0.1 }
  assert.ok(score(fp, { ...fp, a: undefined }) >= HIGH)
  assert.ok(score(fp, { ...fp, a: { id: 'other' } }) < score(fp, { ...fp, a: undefined }))
})

test('a moved element with a unique label is "Moved?", not lost', () => {
  const moved: Fp = { t: 'button', x: 'Start free trial', p: ['main#app'], px: 0.5, py: 0.8 }
  const fp: Fp = { t: 'button', a: { id: 'cta' }, x: 'Start free trial', p: ['div', 'section.hero', 'main#app'], px: 0.2, py: 0.4 }
  assert.equal(decide([score(fp, moved, false, true)]).state, 'moved')
})

test('a description for people', () => {
  assert.equal(describe(buy), 'button “Buy now”')
  assert.equal(describe({ t: 'div' }), 'div')
  assert.equal(describe(null), '')
})
