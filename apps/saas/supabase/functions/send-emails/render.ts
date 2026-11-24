/**
 * Every email ourhunch sends from the Edge Function, as plain data → subject, HTML and text. No Deno
 * or Node APIs here, so it can be tested and previewed anywhere (test.ts, preview.ts).
 *
 * The HTML is built for email clients: tables, inline styles, 600px wide, no images (the wordmark is
 * text), web-safe fonts, colours that read in light and dark mode. Every email has a preheader, one
 * primary button, a plain-text part and a footer that says why it was sent and links to the settings.
 * Lifecycle emails also carry a one-click unsubscribe (link and List-Unsubscribe headers).
 * Everything that came from people (names, comments, pages, project names) is escaped.
 */

// ---------- data ----------

export type ItemType = 'comment' | 'reply' | 'approval' | 'result' | 'due' | 'reviewing' | 'live'
/**
 * One thing that happened. type 'approval': author = approver, text = round name.
 * 'result': text = study name. 'due' / 'reviewing': round_name (and author = the reviewer). 'live': host.
 */
export interface DueItem {
  id: number; at: string; type: ItemType; kind: 'comment' | 'compare' | 'voice' | null; page: string; thread_id: string | null
  author: string; text: string; version?: string | null; open_comments?: number | null; round_n?: number | null
  round_name?: string | null; approval_id?: string | null; due?: string | null; host?: string | null
  element?: { sel?: string | null; tag?: string | null; text?: string | null; label?: string | null } | null
  device?: { browser?: string | null; os?: string | null; w?: number | null; h?: number | null } | null
  study_id?: string | null; results_total?: number | null; tasks?: { ok: number; all: number } | null
}
export interface Due { project_id: string; project_name: string; site_url: string | null; outbox_ids: number[]; total: number; recipients: string[]; items: DueItem[] }
export interface Email { to: string; subject: string; html: string; text: string; headers?: Record<string, string>; replyTo?: string }

export type LifecycleKind = 'welcome' | 'day1' | 'day3' | 'day7'
export interface LifecycleDue { user_id: string; email: string; token: string; kind: LifecycleKind; has_project: boolean; installed: boolean | null; project_name: string | null; project_id: string | null }
export interface WeeklyProject { project_id: string; project_name: string; comments: number; resolved: number; results: number; approvals: number }
export interface WeeklyDue { user_id: string; email: string; kind: string; projects: WeeklyProject[] }

/** Settings that come from the function's secrets. */
export interface Brand {
  appUrl: string
  /** EMAIL_POSTAL_ADDRESS: shown in the footer when set */
  postal?: string
  /** EMAIL_FOUNDER_NAME: signs the welcome email */
  founder?: string
  /** where the one-click unsubscribe (List-Unsubscribe-Post) goes: the function's own URL */
  unsubscribeEndpoint?: string
  replyTo?: string
}
/** The beta's prices, from apps/saas/src/saas/products.ts (PRICING). Keep in step with it. */
export const PRICING = { proPerSite: '$4.80', foundingPerSite: '$2', foundingCustomers: 200, freeInBeta: true } as const

// ---------- helpers ----------

const C = { cobalt: '#1535e6', spark: '#e4ff54', ink: '#16130f', paper: '#fffdf8', muted: '#5f594d', line: '#e7e2d6', soft: '#f4f1e8', outer: '#efebe1' }
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export const oneLine = (s: string | null | undefined, n = 280) => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const links = (appUrl: string) => {
  const app = appUrl.replace(/\/$/, '') + '/app#/app'
  return { home: app, inbox: `${app}/comments`, settings: `${app}/settings`, rounds: `${app}/rounds`, research: `${app}/research`, reviewers: `${app}/reviewers`, install: `${app}/install`, onboarding: appUrl.replace(/\/$/, '') + '/app#/app/onboarding' }
}

/** "button “Pay now”", "link “Pricing”", or the selector when nothing better is known. */
export function elementLine(e: DueItem['element']): string {
  if (!e) return ''
  const tag = oneLine(e.tag, 20).toLowerCase()
  const name = oneLine(e.label || e.text, 60)
  const word = ({ a: 'link', button: 'button', input: 'field', img: 'image', select: 'menu', textarea: 'text box', h1: 'heading', h2: 'heading', h3: 'heading', p: 'text', li: 'list item', nav: 'navigation', header: 'header', footer: 'footer', form: 'form' } as Record<string, string>)[tag] ?? (tag ? `<${tag}>` : '')
  if (name) return `${word || 'element'} “${name}”`
  return word || oneLine(e.sel, 60)
}
/** "Chrome 131 · macOS · 1280×800" */
export function deviceText(d: DueItem['device']): string {
  if (!d) return ''
  const n = (x: unknown) => (typeof x === 'number' && x > 0 && x < 20000 ? Math.round(x) : 0)
  return [oneLine(d.browser, 40), oneLine(d.os, 40), n(d.w) && n(d.h) ? `${n(d.w)}×${n(d.h)}` : ''].filter(Boolean).join(' · ')
}
const pct = (t: DueItem['tasks']) => (t && t.all > 0 ? Math.round((t.ok / t.all) * 100) : null)

// ---------- the frame every email shares ----------

export interface Frame {
  subject: string
  preheader: string
  heading: string
  /** paragraphs of HTML (already escaped) and their text version */
  intro: { html: string; text: string }[]
  /** optional block between the intro and the button */
  block?: { html: string; text: string }
  button: { label: string; url: string }
  after?: { html: string; text: string }[]
  why: string
  settingsUrl: string
  settingsLabel: string
  unsubscribeUrl?: string
  postal?: string
}

const p = (html: string, text = html) => ({ html, text })
const para = (html: string) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink}">${html}</p>`

export function frame(f: Frame): { html: string; text: string } {
  const pre = esc(f.preheader)
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(f.subject)}</title>
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%}
  a{color:${C.cobalt}}
  @media (max-width:620px){.oh-card{padding:24px 20px!important}.oh-outer{padding:12px!important}}
  @media (prefers-color-scheme:dark){
    .oh-outer{background:#0f0d0a!important}
    .oh-card{background:#1c1914!important;border-color:#332e25!important}
    .oh-ink,.oh-card p,.oh-card td{color:#f3efe6!important}
    .oh-muted{color:#b8b1a2!important}
    .oh-soft{background:#26221b!important;border-color:#3a3429!important}
    .oh-link{color:#9fb0ff!important}
  }
</style>
<!--[if mso]><style>table,td,p,a{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.outer}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.outer}">${pre}${'&#8199;&#65279;&#847; '.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="oh-outer" style="background:${C.outer};padding:28px 12px">
<tr><td align="center">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto">
    <tr><td style="padding:0 4px 14px;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-0.3px;color:${C.ink}" class="oh-ink">
      <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${C.cobalt};margin-right:7px;vertical-align:1px"></span>ourhunch
    </td></tr>
    <tr><td class="oh-card" style="background:${C.paper};border:1px solid ${C.line};border-radius:14px;padding:32px 36px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:0 0 16px"><div style="width:40px;height:4px;background:${C.spark};border-radius:2px;font-size:0;line-height:0">&nbsp;</div></td></tr>
        <tr><td class="oh-ink" style="font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};padding:0 0 14px">${esc(f.heading)}</td></tr>
        <tr><td>${f.intro.map((x) => para(x.html)).join('')}</td></tr>
        ${f.block ? `<tr><td style="padding:2px 0 8px">${f.block.html}</td></tr>` : ''}
        <tr><td style="padding:14px 0 6px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="${C.cobalt}" style="border-radius:9px">
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(f.button.url)}" style="height:44px;v-text-anchor:middle;width:240px" arcsize="20%" stroke="f" fillcolor="${C.cobalt}"><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${esc(f.button.label)}</center></v:roundrect><![endif]-->
              <!--[if !mso]><!--><a href="${esc(f.button.url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;background:${C.cobalt}">${esc(f.button.label)}</a><!--<![endif]-->
            </td></tr></table>
        </td></tr>
        ${f.after?.length ? `<tr><td style="padding-top:18px">${f.after.map((x) => para(x.html)).join('')}</td></tr>` : ''}
      </table>
    </td></tr>
    <tr><td class="oh-muted" style="padding:18px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">
      ${esc(f.why)}<br>
      <a class="oh-link" href="${esc(f.settingsUrl)}" style="color:${C.muted};text-decoration:underline">${esc(f.settingsLabel)}</a>${f.unsubscribeUrl ? ` · <a class="oh-link" href="${esc(f.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline">Unsubscribe</a>` : ''}
      ${f.postal ? `<br>ourhunch · ${esc(f.postal)}` : ''}
    </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
  const text = [
    f.heading, '',
    ...f.intro.map((x) => x.text + '\n'),
    ...(f.block ? [f.block.text, ''] : []),
    `${f.button.label}: ${f.button.url}`, '',
    ...(f.after ?? []).map((x) => x.text + '\n'),
    '--',
    f.why,
    `${f.settingsLabel}: ${f.settingsUrl}`,
    ...(f.unsubscribeUrl ? [`Unsubscribe: ${f.unsubscribeUrl}`] : []),
    ...(f.postal ? [`ourhunch · ${f.postal}`] : []),
  ].join('\n')
  return { html, text }
}

/** A list of rows inside a soft box: each row a title line, optional chips, and an optional quote. */
function rows(list: { title: string; meta?: string[]; quote?: string; textTitle: string }[]): { html: string; text: string } {
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="oh-soft" style="background:${C.soft};border:1px solid ${C.line};border-radius:10px">
${list.map((r, i) => `<tr><td style="padding:14px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font-family:${FONT}">
  <div class="oh-ink" style="font-size:14px;line-height:1.45;color:${C.ink}">${r.title}</div>
  ${r.meta?.length ? `<div class="oh-muted" style="font-size:12px;line-height:1.5;color:${C.muted};padding-top:3px">${r.meta.map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ''}
  ${r.quote ? `<div class="oh-ink" style="font-size:14px;line-height:1.55;color:${C.ink};padding:8px 0 0 10px;border-left:3px solid ${C.cobalt};margin-top:8px">${esc(r.quote)}</div>` : ''}
</td></tr>`).join('\n')}
</table>`
  const text = list.map((r) => [`- ${r.textTitle}`, ...(r.meta?.length ? [`  ${r.meta.join(' · ')}`] : []), ...(r.quote ? [`  “${r.quote}”`] : [])].join('\n')).join('\n')
  return { html, text }
}
const b = (s: string) => `<b>${esc(s)}</b>`
const code = (s: string) => `<code style="font-family:Menlo,Consolas,monospace;font-size:12px;background:#ffffff;border:1px solid ${C.line};padding:1px 5px;border-radius:4px;color:${C.ink}">${esc(s)}</code>`

// ---------- activity: comments, replies, results, rounds, install ----------

const verb = (i: DueItem) => (i.type === 'reply' ? 'replied' : i.kind === 'voice' ? 'left a voice note' : i.kind === 'compare' ? 'compared two elements' : 'commented')

function itemRow(i: DueItem) {
  const round = i.round_n ? `Round ${i.round_n}${i.round_name && i.round_name !== `Round ${i.round_n}` ? ` · ${oneLine(i.round_name, 40)}` : ''}` : ''
  switch (i.type) {
    case 'comment': case 'reply': {
      const meta = [elementLine(i.element), deviceText(i.device), i.kind === 'voice' ? 'Voice note' : '', round].filter(Boolean)
      const who = oneLine(i.author, 80)
      return { title: `${b(who)} ${verb(i)} on ${code(oneLine(i.page, 120))}`, textTitle: `${who} ${verb(i)} on ${oneLine(i.page, 120)}`, meta, quote: i.kind === 'voice' && /^voice note$/i.test(oneLine(i.text)) ? undefined : oneLine(i.text, 280) }
    }
    case 'approval': {
      const meta = [i.version ? `Site version ${oneLine(i.version, 20)}` : '', i.open_comments ? `${plural(i.open_comments, 'comment')} still open` : 'No open comments'].filter(Boolean)
      return { title: `${b(oneLine(i.author, 80))} approved ${b(oneLine(i.text, 80))}`, textTitle: `${oneLine(i.author, 80)} approved ${oneLine(i.text, 80)}`, meta: [...meta, 'A record of approval, not a legal signature'] }
    }
    case 'due': return { title: `${b(oneLine(i.round_name ?? i.text, 80))} is due tomorrow and isn’t approved yet`, textTitle: `${oneLine(i.round_name ?? i.text, 80)} is due tomorrow and isn’t approved yet`, meta: i.due ? [`Due ${i.due}`] : [] }
    case 'reviewing': return { title: `${b(oneLine(i.author, 80))} opened ${b(oneLine(i.round_name ?? 'the current round', 80))}`, textTitle: `${oneLine(i.author, 80)} opened ${oneLine(i.round_name ?? 'the current round', 80)}`, meta: ['Your client started reviewing'] }
    case 'live': return { title: `The script reported from ${b(oneLine(i.host ?? i.text, 120))}`, textTitle: `The script reported from ${oneLine(i.host ?? i.text, 120)}`, meta: ['First install detected'] }
    case 'result': default: return { title: '', textTitle: '', meta: [] }
  }
}

/** Results are grouped by study: "3 new results in “Checkout test”". */
function resultRows(items: DueItem[]) {
  const by = new Map<string, DueItem[]>()
  for (const i of items) { const k = i.study_id ?? i.text; by.set(k, [...(by.get(k) ?? []), i]) }
  return [...by.values()].map((g) => {
    const last = g[g.length - 1]
    const rate = pct(last.tasks)
    const meta = [last.results_total ? `${plural(last.results_total, 'result')} so far` : '', rate !== null ? `${rate}% of tasks completed so far` : ''].filter(Boolean)
    const name = oneLine(last.text, 80)
    return { title: `${b(plural(g.length, 'new result'))} in ${b(`“${name}”`)}`, textTitle: `${plural(g.length, 'new result')} in “${name}”`, meta }
  })
}

export function render(d: Due, appUrlOrBrand: string | Brand, daily: boolean): Email[] {
  const brand: Brand = typeof appUrlOrBrand === 'string' ? { appUrl: appUrlOrBrand } : appUrlOrBrand
  const L = links(brand.appUrl)
  const by = (t: ItemType) => d.items.filter((i) => i.type === t)
  const approvals = by('approval'), results = by('result'), dues = by('due'), reviewing = by('reviewing'), live = by('live')
  const others = approvals.length + results.length + dues.length + reviewing.length + live.length
  const n = Math.max(d.total, d.items.length)
  const feedback = Math.max(0, n - others)
  const feedbackItems = d.items.filter((i) => i.type === 'comment' || i.type === 'reply')
  const project = d.project_name

  const feedbackWhat = feedback === 1 ? (feedbackItems[0]?.type === 'reply' ? 'a new reply' : 'a new comment') : `${feedback} new comments and replies`
  const studyNames = [...new Set(results.map((i) => oneLine(i.text, 60)))]
  const parts: string[] = []
  if (feedback) parts.push(feedbackWhat)
  if (results.length) parts.push(studyNames.length === 1 ? `${plural(results.length, 'new result')} in “${studyNames[0]}”` : plural(results.length, 'new result'))
  if (reviewing.length) parts.push('your client started reviewing')
  if (dues.length) parts.push(`${oneLine(dues[0].round_name, 60) || 'a round'} is due tomorrow`)

  let subject: string
  if (approvals.length) {
    const a = approvals[approvals.length - 1]
    const approved = `${oneLine(a.author, 80)} approved ${oneLine(a.text, 80)}${approvals.length > 1 ? ` (+${approvals.length - 1} more approval${approvals.length > 2 ? 's' : ''})` : ''}`
    subject = `${project}: ${approved}${feedback > 0 ? `, and ${feedback} new comment${feedback === 1 ? '' : 's'} or repl${feedback === 1 ? 'y' : 'ies'}` : ''}`
  } else if (live.length && !parts.length) subject = `ourhunch is live on ${oneLine(live[0].host ?? live[0].text, 80)}`
  else if (!parts.length) subject = `${project}: an update`
  else {
    const what = parts.join(', ')
    subject = daily ? `Today on ${project}: ${what}` : `${project}: ${what}`
  }

  // One primary action: the most important thing in this batch.
  const button = approvals.length
    ? { label: 'View approval record', url: approvals[approvals.length - 1].approval_id ? `${L.rounds}/${approvals[approvals.length - 1].approval_id}/record` : L.rounds }
    : live.length && !feedback && !results.length ? { label: 'Send your first review link', url: L.reviewers }
    : results.length && !feedback ? { label: 'See results', url: L.research }
    : (dues.length || reviewing.length) && !feedback ? { label: 'Open Rounds', url: L.rounds }
    : { label: feedback === 1 ? 'Open comment' : 'Open your comments', url: L.inbox }

  const list = [
    ...approvals.map(itemRow), ...live.map(itemRow), ...dues.map(itemRow), ...reviewing.map(itemRow),
    ...resultRows(results), ...feedbackItems.map(itemRow),
  ]
  const more = feedback > feedbackItems.length ? feedback - feedbackItems.length : 0
  const heading = approvals.length ? `${oneLine(approvals[approvals.length - 1].author, 60)} approved ${oneLine(approvals[approvals.length - 1].text, 60)}`
    : live.length && !parts.length ? `ourhunch is live on ${oneLine(live[0].host ?? live[0].text, 80)}`
    : daily ? `Today on ${project}` : `New on ${project}`
  const intro = approvals.length
    ? [p(`A reviewer approved a version of ${b(project)}. The record keeps the time, the site version and the comments that were still open.`, `A reviewer approved a version of ${project}. The record keeps the time, the site version and the comments that were still open.`)]
    : live.length && !parts.length
      ? [p(`The script on ${b(project)} just reported in for the first time. Next step: send a review link to the person whose opinion you need. They open your site and comment right on it, no account needed.`,
           `The script on ${project} just reported in for the first time. Next step: send a review link to the person whose opinion you need. They open your site and comment right on it, no account needed.`)]
      : [p(`${daily ? 'Here’s what happened today' : 'Here’s what just came in'} on ${b(project)}.`, `${daily ? 'Here’s what happened today' : 'Here’s what just came in'} on ${project}.`)]
  const block = rows(list)
  const preheader = list.length ? list.map((r) => r.textTitle).filter(Boolean).slice(0, 2).join(' · ') : subject
  const f = frame({
    subject, preheader, heading, intro, block,
    button,
    after: more ? [p(`…and ${more} more.`)] : undefined,
    why: `You get this because you’re on the team of “${project}”.`,
    settingsUrl: L.settings, settingsLabel: 'Change how often (each update, a daily summary, or off)',
    postal: brand.postal,
  })
  return d.recipients.map((to) => ({ to, subject, html: f.html, text: f.text }))
}

// ---------- lifecycle ----------

const snippet = (appUrl: string, project: string | null) => `<script src="${appUrl.replace(/\/$/, '')}/embed/vibe.js" data-project="${project && /^[a-z0-9][a-z0-9-]{2,63}$/.test(project) ? project : 'your-project'}" defer></script>`

export function renderLifecycle(x: LifecycleDue, brand: Brand): Email {
  const L = links(brand.appUrl)
  const signer = oneLine(brand.founder, 60) || 'The ourhunch team'
  const unsubPage = `${brand.appUrl.replace(/\/$/, '')}/app#/unsubscribe?t=${encodeURIComponent(x.token)}`
  const common = {
    why: 'You get this because you signed up for ourhunch. Tips and product updates are on in your settings.',
    settingsUrl: L.settings, settingsLabel: 'Email settings', unsubscribeUrl: unsubPage, postal: brand.postal,
  }
  const sign = p(`${esc(signer)}<br><span class="oh-muted" style="color:${C.muted}">ourhunch</span>`, `${signer}\nourhunch`)
  let f: ReturnType<typeof frame>, subject: string
  if (x.kind === 'welcome') {
    subject = 'Welcome to ourhunch'
    const price = PRICING.freeInBeta
      ? `Pro is free while we’re in beta. When billing starts, the first ${PRICING.foundingCustomers} customers keep a founding price of ${PRICING.foundingPerSite} per site a month (normally ${PRICING.proPerSite}).`
      : ''
    const steps = rows([
      { title: `${b('1. Add the script.')} One line in your site’s HTML.`, textTitle: '1. Add the script. One line in your site’s HTML.' },
      { title: `${b('2. Send a review link.')} Your client opens your site, no account needed.`, textTitle: '2. Send a review link. Your client opens your site, no account needed.' },
      { title: `${b('3. Read feedback where it happened.')} Comments are pinned to the exact element.`, textTitle: '3. Read feedback where it happened. Comments are pinned to the exact element.' },
    ])
    f = frame({
      ...common, subject, preheader: 'Three steps from a script tag to feedback pinned on your site.',
      heading: 'Welcome to ourhunch',
      intro: [p('Hi,'), p('Thanks for signing up. ourhunch puts comments, voice notes and user tests right on your website, so feedback lands on the thing it’s about.'), p('Getting started takes three steps:')],
      block: steps,
      button: x.has_project ? { label: 'Add the script', url: L.install } : { label: 'Set up your first site', url: L.onboarding },
      after: [...(price ? [p(esc(price), price)] : []), p('If anything is unclear or missing, reply to this email. I read every one.'), sign],
    })
  } else if (x.kind === 'day1') {
    subject = 'Add ourhunch in 2 minutes'
    f = frame({
      ...common, subject, preheader: 'One line of HTML, or ask your AI builder to add it for you.',
      heading: 'Add ourhunch in 2 minutes',
      intro: [
        p(`We haven’t seen the script on ${x.project_name ? b(oneLine(x.project_name, 60)) : 'your site'} yet. It’s one line, pasted before ${code('</body>')}:`, `We haven’t seen the script on ${x.project_name ? oneLine(x.project_name, 60) : 'your site'} yet. It’s one line, pasted before </body>:`),
      ],
      block: { html: `<div class="oh-soft" style="background:${C.soft};border:1px solid ${C.line};border-radius:10px;padding:12px 14px;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:${C.ink};word-break:break-all">${esc(snippet(brand.appUrl, x.project_id))}</div>`, text: snippet(brand.appUrl, x.project_id) },
      button: { label: 'Open the install page', url: L.install },
      after: [p(`Built with Lovable, Bolt, v0 or another AI builder? Ask it: ${b('“Add this script tag before </body> on every page,”')} and paste the line ${x.project_id ? 'above' : 'from the install page'}.`,
                `Built with Lovable, Bolt, v0 or another AI builder? Ask it: “Add this script tag before </body> on every page,” and paste the line ${x.project_id ? 'above' : 'from the install page'}.`),
              p('The install page shows when the script reports in.')],
    })
  } else if (x.kind === 'day3') {
    subject = 'Invite your first client'
    f = frame({
      ...common, subject, preheader: 'A one-time link, no account for them. They comment right on your site.',
      heading: 'Invite your first client',
      intro: [p('The script is on your site. Now the useful part: get someone else’s eyes on it.'),
              p('Create a review link and send it to your client. It works once, they don’t need an account, and they leave comments pinned to the exact spot on the page. You see them in your panel, and by email.')],
      button: { label: 'Create a review link', url: L.reviewers },
    })
  } else {
    subject = 'Test with real users, not just opinions'
    f = frame({
      ...common, subject, preheader: 'Tasks, 5-second tests and click heatmaps, on the same script.',
      heading: 'Test with real users, not just opinions',
      intro: [p('You’re getting comments. Next: watch how people actually use the page.'),
              p('With the same script you can run a study and share its link:')],
      block: rows([
        { title: `${b('Tasks')}: “Find the pricing page”. See who succeeds, how long it takes and where they click.`, textTitle: 'Tasks: “Find the pricing page”. See who succeeds, how long it takes and where they click.' },
        { title: `${b('5-second test')}: what people remember after a quick look.`, textTitle: '5-second test: what people remember after a quick look.' },
        { title: `${b('Click heatmap')}: where clicks land, including on things that aren’t clickable.`, textTitle: 'Click heatmap: where clicks land, including on things that aren’t clickable.' },
      ]),
      button: { label: 'Create a study', url: L.research },
    })
  }
  const endpoint = brand.unsubscribeEndpoint ? `${brand.unsubscribeEndpoint}${brand.unsubscribeEndpoint.includes('?') ? '&' : '?'}unsubscribe=${encodeURIComponent(x.token)}` : unsubPage
  return {
    to: x.email, subject, html: f.html, text: f.text,
    headers: { 'List-Unsubscribe': `<${endpoint}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    ...(x.kind === 'welcome' && brand.replyTo ? { replyTo: brand.replyTo } : {}),
  }
}

// ---------- weekly summary ----------

export function renderWeekly(x: WeeklyDue, brand: Brand): Email {
  const L = links(brand.appUrl)
  const ps = x.projects
  const sum = (k: keyof Omit<WeeklyProject, 'project_id' | 'project_name'>) => ps.reduce((s, q) => s + (q[k] || 0), 0)
  const subject = ps.length === 1 ? `Your week on ${ps[0].project_name}` : `Your week on ourhunch: ${plural(ps.length, 'project')}`
  const line = (q: WeeklyProject) => [
    q.comments ? plural(q.comments, 'new comment') : '', q.resolved ? `${q.resolved} resolved` : '',
    q.results ? plural(q.results, 'result') : '', q.approvals ? plural(q.approvals, 'approval') : '',
  ].filter(Boolean)
  const f = frame({
    subject,
    preheader: [sum('comments') ? plural(sum('comments'), 'new comment') : '', sum('resolved') ? `${sum('resolved')} resolved` : '', sum('results') ? plural(sum('results'), 'result') : ''].filter(Boolean).join(', ') || 'Your last 7 days',
    heading: 'Your last 7 days',
    intro: [p('Here’s what happened on your projects this week.')],
    block: rows(ps.map((q) => ({ title: b(oneLine(q.project_name, 60)), textTitle: oneLine(q.project_name, 60), meta: line(q) }))),
    button: { label: 'Open ourhunch', url: L.home },
    why: 'You get this weekly summary because you own these projects and their emails are on.',
    settingsUrl: L.settings, settingsLabel: 'Change email settings (set a project to off to stop it)', postal: brand.postal,
  })
  return { to: x.email, subject, html: f.html, text: f.text }
}
