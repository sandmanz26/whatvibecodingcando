/**
 * Review pins — data shape, validation and the .txt export/import format.
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
}

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
  return { id, page, x, y, vw, vh, scrollY, text, createdAt, updatedAt }
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

export function toTxt(list: PinNote[], app = 'Skillhouse', now = new Date()): string {
  const head = [`# ${app} review annotations`, '# version: 1', `# exported: ${now.toISOString()}`, ''].join('\n') + '\n'
  const blocks = readingOrder(list).map((n, i) => [
    `${BLOCK}${i + 1} ${n.id}`,
    `page: ${n.page}`,
    `pos: ${n.x}, ${n.y}`,
    `viewport: ${n.vw}x${n.vh}`,
    `scroll: ${n.scrollY}`,
    `created: ${n.createdAt}`,
    `updated: ${n.updatedAt}`,
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
    const note = validNote({ id, page: meta.page, x, y, vw, vh, scrollY: Number(meta.scroll), text: body.join('\n'), createdAt: meta.created, updatedAt: meta.updated })
    if (note) out.push(note)
  }
  return out
}

export function txtFileName(app = 'skillhouse', d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${app}-annotations-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.txt`
}
