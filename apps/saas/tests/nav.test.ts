// The sidebar's active link on every Research module page and tab (owner report: Eye tracking's
// "Participant paths" tab jumped to All studies). Run: node apps/saas/tests/nav.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeOf, researchTabParams } from '../src/saas/nav-active.ts'

const LINKS = ['/app', '/app/reviewers', '/app/settings', '/guide', '/app/research', '/app/research?module=usability', '/app/research?module=fivesec', '/app/research?module=heatmap', '/app/research?module=gaze', '/app/research?tab=sessions']

test('each module page and each of its tabs keeps its own link', () => {
  for (const m of ['usability', 'fivesec', 'heatmap', 'gaze']) {
    assert.equal(activeOf(LINKS, '/app/research', `?module=${m}`), `/app/research?module=${m}`)
    assert.equal(activeOf(LINKS, '/app/research', `?module=${m}&tab=sessions`), `/app/research?module=${m}`, `${m} Participant paths`)
  }
})
test('All studies, every module’s Participant paths, older ?kind= and a study page', () => {
  assert.equal(activeOf(LINKS, '/app/research', ''), '/app/research')
  assert.equal(activeOf(LINKS, '/app/research', '?tab=sessions'), '/app/research?tab=sessions')
  assert.equal(activeOf(LINKS, '/app/research', '?kind=eyes'), '/app/research?module=gaze')
  assert.equal(activeOf(LINKS, '/app/research/abc', ''), '/app/research')
})
test('tab switching keeps the module, and lands on the same link', () => {
  for (const m of ['usability', 'fivesec', 'heatmap', 'gaze']) {
    for (const t of ['studies', 'sessions'] as const) {
      const q = '?' + new URLSearchParams(researchTabParams(m, t)).toString()
      assert.ok(q.includes(`module=${m}`))
      assert.equal(activeOf(LINKS, '/app/research', q), `/app/research?module=${m}`)
    }
  }
  assert.deepEqual(researchTabParams(null, 'sessions'), { tab: 'sessions' })
})
