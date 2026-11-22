/**
 * The notification emails, as plain data → subject, HTML and text. No Deno or Node APIs here, so it
 * can be tested anywhere. Everything that came from people (names, comments, pages) is escaped.
 */
export interface DueItem { id: number; at: string; type: 'comment' | 'reply'; kind: 'comment' | 'compare' | 'voice' | null; page: string; thread_id: string; author: string; text: string }
export interface Due { project_id: string; project_name: string; site_url: string | null; outbox_ids: number[]; total: number; recipients: string[]; items: DueItem[] }
export interface Email { to: string; subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const oneLine = (s: string, n = 280) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const label = (i: DueItem) => (i.type === 'reply' ? 'replied' : i.kind === 'voice' ? 'left a voice note' : i.kind === 'compare' ? 'compared two elements' : 'commented')

export function render(d: Due, appUrl: string, daily: boolean): Email[] {
  const app = appUrl.replace(/\/$/, '')
  const inbox = `${app}/app#/app/comments`
  const settings = `${app}/app#/app/settings`
  const n = Math.max(d.total, d.items.length)
  const what = n === 1 ? (d.items[0]?.type === 'reply' ? 'a new reply' : 'a new comment') : `${n} new comments and replies`
  const subject = daily ? `Today on ${d.project_name}: ${what}` : `${d.project_name}: ${what}`
  const more = n > d.items.length ? n - d.items.length : 0

  const rowsHtml = d.items.map((i) => `
        <tr><td style="padding:12px 0;border-top:1px solid #eee">
          <div style="font:600 14px/1.4 system-ui,sans-serif;color:#16130f">${esc(oneLine(i.author, 80))} <span style="font-weight:400;color:#6b6558">${label(i)} on</span> <code style="font-size:12px;background:#f3f1ec;padding:1px 5px;border-radius:4px">${esc(oneLine(i.page, 120))}</code></div>
          <div style="font:400 14px/1.5 system-ui,sans-serif;color:#16130f;margin-top:4px">${esc(oneLine(i.text))}</div>
        </td></tr>`).join('')
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4ef;padding:24px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e6e2d9">
    <tr><td style="font:700 18px/1.3 system-ui,sans-serif;color:#16130f;padding-bottom:4px">${esc(subject)}</td></tr>
    <tr><td style="font:400 13px/1.5 system-ui,sans-serif;color:#6b6558;padding-bottom:8px">${daily ? 'Your daily summary' : 'New feedback'} from your reviewers.</td></tr>
    ${rowsHtml}
    ${more ? `<tr><td style="font:400 13px system-ui,sans-serif;color:#6b6558;padding-top:8px">…and ${more} more.</td></tr>` : ''}
    <tr><td style="padding-top:20px"><a href="${esc(inbox)}" style="display:inline-block;background:#e8590c;color:#fff;text-decoration:none;font:600 14px system-ui,sans-serif;padding:10px 18px;border-radius:8px">Open your comments</a></td></tr>
    <tr><td style="font:400 12px/1.5 system-ui,sans-serif;color:#8a8478;padding-top:20px">You get this because you’re on the team of “${esc(d.project_name)}”. <a href="${esc(settings)}" style="color:#8a8478">Change how often</a> (each comment, a daily summary, or off).</td></tr>
  </table></body></html>`
  const text = [
    subject, '',
    ...d.items.map((i) => `- ${oneLine(i.author, 80)} ${label(i)} on ${oneLine(i.page, 120)}: ${oneLine(i.text)}`),
    ...(more ? [`…and ${more} more.`] : []),
    '', `Open your comments: ${inbox}`,
    `Change how often (each comment, a daily summary, or off): ${settings}`,
  ].join('\n')
  return d.recipients.map((to) => ({ to, subject, html, text }))
}
