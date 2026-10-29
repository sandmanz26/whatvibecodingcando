/**
 * Comments (review pins) — data shape, validation and the .txt export/import format.
 * The .txt is how notes move between deployments or to people outside them,
 * so it is human-readable and lossless.
 */

export interface PinNote {
  id: string
  page: string
  /** % of the viewport when placed / last dragged */
  x: number
  y: number
  vw: number
  vh: number
  /** window.scrollY when placed / last dragged */
  scrollY: number
  text: string
  createdAt: string
  updatedAt: string
  /** the element it is about: a selector that finds it again, its visible name, and where on it (%) */
  sel?: string
  label?: string
  ex?: number
  ey?: number
  /** who wrote it — the person the app is "viewing as" */
  author?: string
  replies?: Reply[]
  resolved?: boolean
  /** a voice note: the audio lives in this browser's IndexedDB under voiceId(id) */
  voice?: { ms: number }
}

/** Where a comment's voice note is kept (see tools/voice/audio.ts). */
export const voiceId = (noteId: string) => `pin-${noteId}`

export interface Reply { id: string; author: string; text: string; at: string }

export const MAX_NOTES = 500
export const MAX_TEXT = 4000
const MAX_STR = 300

const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null)
const str = (v: unknown, max = MAX_STR) => (typeof v === 'string' && v.length <= max ? v : null)

/** Returns a clean note, or null when the input can't be trusted. */
export function validNote(n: unknown): PinNote | null {
  if (!n || typeof n !== 'object') return null
  const o = n as Record<string, unknown>
  const id = str(o.id, 64), page = str(o.page), text = str(o.text, MAX_TEXT)
  const createdAt = str(o.createdAt, 40), updatedAt = str(o.updatedAt, 40)
  const x = num(o.x, 0, 100), y = num(o.y, 0, 100), vw = num(o.vw, 1, 10000), vh = num(o.vh, 1, 10000), scrollY = num(o.scrollY, 0, 1_000_000)
  if (!id || !page || text === null || !createdAt || !updatedAt || x === null || y === null || vw === null || vh === null || scrollY === null) return null
  const note: PinNote = { id, page, x, y, vw, vh, scrollY, text, createdAt, updatedAt }
  const sel = str(o.sel), label = str(o.label, 120), author = str(o.author, 80)
  const ex = num(o.ex, 0, 100), ey = num(o.ey, 0, 100)
  if (sel) note.sel = sel
  if (label) note.label = label
  if (author) note.author = author
  if (ex !== null && ey !== null) { note.ex = ex; note.ey = ey }
  if (o.resolved === true) note.resolved = true
  const v = o.voice as Record<string, unknown> | undefined
  const vms = v && typeof v === 'object' ? num(v.ms, 0, 3_600_000) : null
  if (vms !== null) note.voice = { ms: vms }
  if (Array.isArray(o.replies)) {
    note.replies = o.replies.slice(0, 100).map((rp) => {
      const q = (rp ?? {}) as Record<string, unknown>
      const rid = str(q.id, 64), ra = str(q.author, 80), rt = str(q.text, MAX_TEXT), rat = str(q.at, 40)
      return rid && ra && rt !== null && rat ? { id: rid, author: ra, text: rt, at: rat } : null
    }).filter((x): x is Reply => !!x)
  }
  return note
}

export const validNotes = (list: unknown): PinNote[] =>
  (Array.isArray(list) ? list : []).map(validNote).filter((n): n is PinNote => !!n).slice(0, MAX_NOTES)

/** Where a pin sits in the document, in px. */
export const pinTop = (n: PinNote) => n.scrollY + (n.y / 100) * n.vh

/** Reading order: page, then top to bottom, then left to right. */
export const readingOrder = (list: PinNote[]) =>
  [...list].sort((a, b) => a.page.localeCompare(b.page) || pinTop(a) - pinTop(b) || a.x - b.x)

/* ---------- .txt ---------- */

const BLOCK = '--- #'
const escapeLine = (l: string) => (l.startsWith(BLOCK) || l.startsWith('\\') ? `\\${l}` : l)
const unescapeLine = (l: string) => (l.startsWith('\\') ? l.slice(1) : l)

export function toTxt(list: PinNote[], app = 'Marketplace', now = new Date()): string {
  const head = [`# ${app} review annotations`, '# version: 1', `# exported: ${now.toISOString()}`, ''].join('\n') + '\n'
  const blocks = readingOrder(list).map((n, i) => [
    `${BLOCK}${i + 1} ${n.id}`,
    `page: ${n.page}`,
    `pos: ${n.x}, ${n.y}`,
    `viewport: ${n.vw}x${n.vh}`,
    `scroll: ${n.scrollY}`,
    `created: ${n.createdAt}`,
    `updated: ${n.updatedAt}`,
    ...(n.label ? [`element: ${n.label}`] : []),
    ...(n.sel ? [`selector: ${n.sel}`] : []),
    ...(n.ex !== undefined ? [`anchor: ${n.ex}, ${n.ey}`] : []),
    ...(n.author ? [`author: ${n.author}`] : []),
    `status: ${n.resolved ? 'resolved' : 'open'}`,
    // Replies as one JSON line: still readable, and lossless for multi-line text.
    ...(n.replies?.length ? [`replies: ${JSON.stringify(n.replies)}`] : []),
    // The audio itself stays in the browser that recorded it; the .txt notes that there was one.
    ...(n.voice ? [`voice: ${Math.round(n.voice.ms / 1000)} s (audio not included)`] : []),
    'note:',
    ...n.text.split('\n').map(escapeLine),
  ].join('\n') + '\n')
  return head + blocks.join('\n')
}

export function fromTxt(txt: string): PinNote[] {
  const lines = txt.split(/\r?\n/)
  const out: PinNote[] = []
  let i = lines.findIndex((l) => l.startsWith(BLOCK))
  while (i >= 0 && i < lines.length) {
    const id = lines[i].slice(BLOCK.length).trim().split(/\s+/)[1] ?? ''
    const meta: Record<string, string> = {}
    i++
    while (i < lines.length && lines[i] !== 'note:' && !lines[i].startsWith(BLOCK)) {
      const m = lines[i].match(/^(\w+):\s?(.*)$/)
      if (m) meta[m[1]] = m[2]
      i++
    }
    const body: string[] = []
    if (lines[i] === 'note:') {
      i++
      while (i < lines.length && !lines[i].startsWith(BLOCK)) body.push(unescapeLine(lines[i++]))
      // Every block ends with one newline of its own (the separator, or the file's last newline).
      if (body.length && body[body.length - 1] === '') body.pop()
    }
    const [x, y] = (meta.pos ?? '').split(',').map((s) => Number(s.trim()))
    const [vw, vh] = (meta.viewport ?? '').split('x').map(Number)
    const [ex, ey] = (meta.anchor ?? '').split(',').map((v) => Number(v.trim()))
    let replies: unknown = undefined
    try { replies = meta.replies ? JSON.parse(meta.replies) : undefined } catch { /* skip broken replies */ }
    const note = validNote({ id, page: meta.page, x, y, vw, vh, scrollY: Number(meta.scroll), text: body.join('\n'), createdAt: meta.created, updatedAt: meta.updated,
      sel: meta.selector, label: meta.element, author: meta.author, ex: meta.anchor ? ex : undefined, ey: meta.anchor ? ey : undefined, resolved: meta.status === 'resolved', replies,
      voice: meta.voice ? { ms: (parseInt(meta.voice, 10) || 0) * 1000 } : undefined })
    if (note) out.push(note)
  }
  return out
}

export function txtFileName(app = 'market', d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${app}-annotations-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`
}
