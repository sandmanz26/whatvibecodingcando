/**
 * No impact on existing installs: published configurations from before per-module default studies
 * still parse unchanged, and the widget decides exactly as before for them (audience reviewers:
 * nothing for visitors; team and reviewers keep Comments and their tools, no research buttons).
 * Under "Everyone" every research module that is on is offered. Run: npm run test:compat (apps/saas).
 */
import { parseConfig, parseRelease } from '../src/core/embed/config'
import { decide } from '../src/core/embed/decide'

let failed = 0
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++ }
const base = { project: 'old-shop', draft: null, preview: false, host: 'shop.example', hostname: 'shop.example', demo: true }

// Configs exactly as older panels published them (no new fields exist; none are needed).
const oldComments = { v: 1, on: true, modules: { comments: true }, theme: { accent: '#e8590c', mode: 'light' }, launcher: { kind: 'floating', position: 'right', label: 'Comment', shortcut: true }, audience: 'reviewers', envs: [] }
const oldHeat = { ...oldComments, modules: { comments: true, heatmap: true, usability: true, fivesec: true } }
const oldEveryone = { ...oldComments, audience: 'everyone' }
for (const [name, raw] of [['comments only', oldComments], ['heatmap + studies', oldHeat], ['everyone, comments', oldEveryone]] as const) {
  const c = parseConfig(JSON.parse(JSON.stringify(raw)))
  check(!!c && JSON.stringify(c) === JSON.stringify(raw), `old config (${name}) parses unchanged`)
}
check(!!parseRelease({ version: 7, config: oldHeat, at: '2026-11-20T00:00:00Z', by: 'Owner' }), 'old release file parses')

const c = parseConfig(oldHeat)!
const visitor = decide({ ...base, config: c, reviewer: false, invited: false })
check(!visitor.show, 'audience reviewers: a visitor sees nothing (as before)')
const team = decide({ ...base, config: c, reviewer: true, invited: true })
check(team.show && team.comments && team.tools.join() === 'heatmap' && team.research.length === 0, 'audience reviewers: team/reviewers get Comments + Heatmap tool, no visitor research buttons (as before)')
const ev = parseConfig(oldEveryone)!
const evVisitor = decide({ ...base, config: ev, reviewer: false, invited: false })
check(evVisitor.show && evVisitor.comments && evVisitor.research.length === 0 && evVisitor.tools.length === 0, 'old Everyone + Comments only: visitors get Comments, nothing else (as before)')

// New: Everyone with research modules.
const all = parseConfig({ ...oldHeat, audience: 'everyone', modules: { comments: true, heatmap: true, gaze: true, fivesec: true, usability: true, inspect: true } })!
const v2 = decide({ ...base, config: all, reviewer: false, invited: false })
check(v2.show && v2.research.join() === 'heatmap,gaze,fivesec,usability' && v2.tools.length === 0, 'Everyone: a visitor gets every research module that is on, never the tools or results')
const r2 = decide({ ...base, config: all, reviewer: true, invited: true })
check(r2.show && r2.tools.includes('heatmap') && !r2.research.includes('heatmap'), 'Everyone: an invited reviewer keeps the Heatmap results tool (records automatically), no duplicate button')
const noComments = parseConfig({ ...oldHeat, audience: 'everyone', modules: { comments: false, fivesec: true } })!
const v3 = decide({ ...base, config: noComments, reviewer: false, invited: false })
check(v3.show && !v3.comments && v3.research.join() === 'fivesec', 'Everyone without Comments: the widget still shows for its research module (never hidden)')

console.log(failed ? `${failed} FAILED` : 'ALL PASS')
if (failed) process.exit(1)
