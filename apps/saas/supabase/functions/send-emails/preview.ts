// Writes every email as an HTML file (sample data) so they can be looked at and screenshotted, and
// (re)writes the Supabase Auth templates in supabase/email-templates/ from the same frame.
// Not deployed. Run from apps/saas:
//   npx esbuild supabase/functions/send-emails/preview.ts --bundle --platform=node --format=esm --outfile=/tmp/se-preview.mjs && node /tmp/se-preview.mjs /tmp/email-previews
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { frame, render, renderLifecycle, renderWeekly, type Brand, type Due, type DueItem } from './render.ts'

const out = process.argv[2] ?? 'email-previews'
mkdirSync(out, { recursive: true })
const APP = 'https://ourhunch.com'
const brand: Brand = { appUrl: APP, founder: 'Your name', postal: 'Business address, City, Country', replyTo: 'you@ourhunch.com', unsubscribeEndpoint: 'https://project.supabase.co/functions/v1/send-emails' }
const base = { id: 1, at: '', kind: null, page: '', thread_id: null, author: '', text: '' }
const due = (items: Partial<DueItem>[], total = items.length): Due => ({ project_id: 'acme-site', project_name: 'Acme website', site_url: 'https://acme.example', outbox_ids: [], total, recipients: ['team@acme.example'],
  items: items.map((i, k) => ({ ...base, id: k + 1, ...i })) as DueItem[] })
const comment: Partial<DueItem> = { type: 'comment', kind: 'comment', page: '/pricing', thread_id: 't1', author: 'Maya', text: 'The yearly toggle is easy to miss. I only saw the monthly prices the first time and thought it was more expensive than we agreed.', round_n: 2, round_name: 'Round 2',
  element: { tag: 'button', text: 'Yearly' }, device: { browser: 'Safari 18', os: 'iOS 18', w: 390, h: 844 } }

const files: Record<string, { subject: string; html: string; text: string }> = {
  '01-new-comment': render(due([comment]), brand, false)[0],
  '02-new-reply': render(due([{ type: 'reply', kind: 'comment', page: '/pricing', thread_id: 't1', author: 'Maya', text: 'Looks better now, thanks. Can the badge say “2 months free” instead?' }]), brand, false)[0],
  '03-research-results': render(due([1, 2, 3].map(() => ({ type: 'result', text: 'Checkout test', study_id: 's1', results_total: 8, tasks: { ok: 13, all: 16 } }))), brand, false)[0],
  '04-round-approved': render(due([{ type: 'approval', author: 'Maya', text: 'Round 2', approval_id: 'a1', version: '1.4', open_comments: 2, round_n: 2 }]), brand, false)[0],
  '05-round-reminders': render(due([{ type: 'reviewing', author: 'Maya', text: 'Round 3', round_name: 'Round 3', round_n: 3 }, { type: 'due', text: 'Round 3', round_name: 'Round 3', round_n: 3, due: '2026-12-02' }]), brand, false)[0],
  '06-script-live': render(due([{ type: 'live', host: 'acme.example', text: 'acme.example' }]), brand, false)[0],
  '07-daily-digest': render(due([comment, { type: 'comment', kind: 'voice', page: '/', author: 'Jon', text: 'Voice note', element: { tag: 'h1', text: 'Build faster' } },
    { type: 'result', text: 'Checkout test', study_id: 's1', results_total: 8, tasks: { ok: 13, all: 16 } }], 4), brand, true)[0],
  '08-weekly-summary': renderWeekly({ user_id: 'u', email: 'you@example.com', kind: 'weekly-2026-48', projects: [
    { project_id: 'a', project_name: 'Acme website', comments: 12, resolved: 9, results: 8, approvals: 1 },
    { project_id: 'b', project_name: 'Studio portfolio', comments: 3, resolved: 0, results: 0, approvals: 0 }] }, brand),
}
const life = (kind: 'welcome' | 'day1' | 'day3' | 'day7') => renderLifecycle({ user_id: 'u', email: 'you@example.com', token: 'a'.repeat(64), kind, has_project: kind !== 'welcome', installed: kind === 'day3' || kind === 'day7', project_name: 'Acme website', project_id: 'acme-site' }, brand)
files['10-welcome'] = life('welcome')
files['11-day1-install'] = life('day1')
files['12-day3-invite'] = life('day3')
files['13-day7-research'] = life('day7')

// ---------- Supabase Auth templates (Go template variables stay as they are) ----------
const link = (type: string) => `${APP}/app#/app/confirm?token_hash={{ .TokenHash }}&type=${type}`
const authFoot = { why: 'You get this because this address was used on ourhunch. If that wasn’t you, ignore this email: nothing changes.', settingsUrl: `${APP}/app#/app/settings`, settingsLabel: 'Account settings' }
const t = (x: string) => ({ html: x, text: x })
const auth: Record<string, { subject: string; f: ReturnType<typeof frame> }> = {
  'confirm-signup': { subject: 'Confirm your email for ourhunch', f: frame({ ...authFoot, subject: 'Confirm your email for ourhunch', preheader: 'One click and your account is ready.', heading: 'Confirm your email',
    intro: [t('Thanks for signing up for ourhunch. Confirm this address and you’re in.')], button: { label: 'Confirm your email', url: link('email') }, after: [t('The link works once and expires after a while. If it has expired, sign up or log in again to get a new one.')] }) },
  'reset-password': { subject: 'Set a new password for ourhunch', f: frame({ ...authFoot, subject: 'Set a new password for ourhunch', preheader: 'Someone asked to reset the password for this address.', heading: 'Set a new password',
    intro: [t('Someone (hopefully you) asked to reset the password for your ourhunch account.')], button: { label: 'Set a new password', url: link('recovery') }, after: [t('If you didn’t ask, ignore this email. Your password stays the same.')] }) },
  'magic-link': { subject: 'Your ourhunch login link', f: frame({ ...authFoot, subject: 'Your ourhunch login link', preheader: 'Log in with one click. The link works once.', heading: 'Log in to ourhunch',
    intro: [t('Here’s the link you asked for. It logs you in once, on any device.')], button: { label: 'Log in', url: link('magiclink') } }) },
  'change-email': { subject: 'Confirm your new email for ourhunch', f: frame({ ...authFoot, subject: 'Confirm your new email for ourhunch', preheader: 'Confirm the change to {{ .NewEmail }}.', heading: 'Confirm your new email',
    intro: [t('You asked to change the email of your ourhunch account from {{ .Email }} to {{ .NewEmail }}. Until you confirm, you log in with the old one.')], button: { label: 'Confirm the change', url: link('email_change') } }) },
  'invite': { subject: 'You’re invited to ourhunch', f: frame({ ...authFoot, subject: 'You’re invited to ourhunch', preheader: 'Join the team and see the feedback on your site.', heading: 'You’re invited to ourhunch',
    intro: [t('You’ve been invited to join a team on ourhunch, where feedback is pinned right on the website it’s about. Accept to set up your account.')], button: { label: 'Accept the invite', url: link('invite') } }) },
}
const tplDir = join('supabase', 'email-templates')
mkdirSync(tplDir, { recursive: true })
for (const [name, a] of Object.entries(auth)) {
  // esc() turned the template's quotes and ampersands into entities; Go templates need {{ .X }} intact (they are).
  writeFileSync(join(tplDir, `${name}.html`), `<!-- Supabase Auth → Email Templates. Subject: ${a.subject} -->\n` + a.f.html)
  files[`20-auth-${name}`] = { subject: a.subject, ...a.f }
}

for (const [name, e] of Object.entries(files)) {
  writeFileSync(join(out, `${name}.html`), e.html)
  writeFileSync(join(out, `${name}.txt`), `Subject: ${e.subject}\n\n${e.text}`)
}
console.log(`wrote ${Object.keys(files).length} emails to ${out} and ${Object.keys(auth).length} templates to ${tplDir}`)
