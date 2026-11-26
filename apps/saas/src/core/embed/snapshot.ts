/**
 * A page snapshot: a lightweight picture of the page as this reviewer or participant sees it, taken
 * once per (project, page, layout, device class) so heatmaps and gaze reports in the panel can be
 * drawn on it. Built in this browser from the page itself (no library, no network): the page is
 * cloned, its computed styles are inlined, and the clone is drawn through an SVG foreignObject.
 *
 * Masked before anything is drawn:
 * - every field (input, textarea, select) and anything editable is emptied, never its value;
 * - parts marked private (data-private, data-vibe-private, .private, data-sensitive) become grey boxes;
 * - email addresses and phone or long numbers in the page's text are replaced (redact());
 * - frames, videos and canvases become grey boxes (never another site's content);
 * - images only when this page may read them (same origin or CORS), else grey boxes; CSS
 *   background images are dropped. Our own widget is left out.
 * Width capped at 1280 px (scaled down), height at about three screens (max 4,000 px), WebP or JPEG.
 */
import { redact } from './redact'
import { selectorFor } from './store'

export const PRIVATE = '[data-private], [data-vibe-private], .private, [data-sensitive]'
const BOX_SEL = 'a[href], button, input, select, textarea, label, summary, [role=button], [role=link], [role=tab], h1, h2, h3, img, picture, video, section, nav, header, footer, [data-vibe-id]'
const PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'color', 'background-color', 'opacity', 'visibility', 'overflow', 'z-index',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'white-space', 'vertical-align',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'justify-content', 'align-items', 'align-self', 'gap', 'order',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'list-style-type', 'object-fit', 'box-shadow', 'transform']
const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|VIBE-COLLAB)$/
const GREY = 'background:#d9d9d9 !important;color:transparent !important;'
export const MAX_W = 1280, MAX_H = 4000, MAX_ELEMENTS = 6000, MAX_BYTES = 580_000

export const deviceOf = (vw: number) => (vw < 700 ? 'mobile' : vw < 1100 ? 'tablet' : 'desktop') as 'mobile' | 'tablet' | 'desktop'

/** Size of the picture: the page's width, up to about three screens of height. */
export function snapSize() {
  const vw = document.documentElement.clientWidth || window.innerWidth
  const scrollH = document.documentElement.scrollHeight
  return { vw, scrollH, height: Math.max(200, Math.min(scrollH, MAX_H, Math.max(3 * window.innerHeight, 1200))) }
}

/** Element boxes (page px) by selector, for placing element-anchored points on the picture. */
export function elementBoxes(height: number): Record<string, [number, number, number, number]> {
  const out: Record<string, [number, number, number, number]> = {}
  let n = 0
  for (const el of Array.from(document.querySelectorAll(BOX_SEL))) {
    if (n >= 400) break
    if (el.closest('vibe-collab, [id^=vibe-collab]') || el.closest(PRIVATE)) continue
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const y = r.top + window.scrollY
    if (y > height) continue
    const sel = redact(selectorFor(el)).slice(0, 200)
    if (out[sel]) continue
    out[sel] = [Math.round(r.left + window.scrollX), Math.round(y), Math.round(r.width), Math.round(r.height)]
    n++
  }
  return out
}

const styleOf = (cs: CSSStyleDeclaration) => PROPS.map((p) => { const v = cs.getPropertyValue(p); return v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' ? `${p}:${v};` : p === 'display' && v === 'none' ? 'display:none;' : '' }).join('')

/** A picture's pixels as a data URL, if this page may read them; null otherwise. */
function readable(img: HTMLImageElement): string | null {
  try {
    if (!img.complete || !img.naturalWidth) return null
    const k = Math.min(1, 400 / img.naturalWidth)
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.6)
  } catch { return null }
}

/** The masked page as an SVG document (exported for tests: it must never hold a field's value). */
export function serialisePage(): { svg: string; vw: number; height: number; scrollH: number } | null {
  const { vw, height, scrollH } = snapSize()
  const body = document.body
  if (!body || body.getElementsByTagName('*').length > MAX_ELEMENTS) return null
  const clone = body.cloneNode(true) as HTMLElement
  const orig = [body, ...Array.from(body.getElementsByTagName('*'))]
  const copy = [clone, ...Array.from(clone.getElementsByTagName('*'))]
  if (orig.length !== copy.length) return null
  let images = 0
  const drop: Element[] = []
  for (let i = 0; i < orig.length; i++) {
    const o = orig[i] as HTMLElement, c = copy[i] as HTMLElement
    if (SKIP.test(o.tagName) || o.id?.startsWith('vibe-collab')) { drop.push(c); continue }
    const cs = getComputedStyle(o)
    let st = styleOf(cs)
    for (const a of Array.from(c.attributes)) if (/^on/i.test(a.name) || a.name === 'srcset' || a.name === 'style' || a.name === 'value' || a.name === 'href') c.removeAttribute(a.name)
    const bg = cs.getPropertyValue('background-image')
    if (/gradient/.test(bg) && !/url\(/.test(bg)) st += `background-image:${bg};`
    const tag = o.tagName
    if (o.matches(PRIVATE)) { c.textContent = ''; st += GREY }
    else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      c.removeAttribute('value'); c.removeAttribute('placeholder'); c.textContent = ''
      if (c instanceof HTMLInputElement) { c.removeAttribute('checked'); c.setAttribute('value', '') }
    } else if (o.isContentEditable && o.getAttribute('contenteditable') !== null) { c.textContent = '' }
    else if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'OBJECT' || tag === 'EMBED') {
      const d = document.createElement('div'); d.setAttribute('style', `${st}${GREY}width:${o.offsetWidth}px;height:${o.offsetHeight}px;`); c.replaceWith(d); copy[i] = d; continue
    } else if (tag === 'IMG') {
      const url = images < 40 ? readable(o as HTMLImageElement) : null
      if (url) { images++; c.setAttribute('src', url) } else { c.removeAttribute('src'); st += `${GREY}width:${o.offsetWidth}px;height:${o.offsetHeight}px;display:inline-block;` }
    } else if (tag === 'svg' || tag === 'use' || tag === 'image') { c.removeAttribute('href'); c.removeAttribute('xlink:href') }
    c.setAttribute('style', st)
  }
  for (const d of drop) d.remove()
  // The page's own text: emails and phone or long numbers replaced.
  const tw = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeValue = redact(n.nodeValue ?? '')
  const wrap = document.createElement('div')
  wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const bodyBg = getComputedStyle(body).backgroundColor
  const pageBg = getComputedStyle(document.documentElement).backgroundColor
  const bg = bodyBg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bodyBg) ? bodyBg : pageBg && !/rgba\(0, 0, 0, 0\)|transparent/.test(pageBg) ? pageBg : '#fff'
  wrap.setAttribute('style', `width:${vw}px;height:${height}px;overflow:hidden;background:${bg};`)
  const inner = document.createElement('div')
  inner.setAttribute('style', `${clone.getAttribute('style') ?? ''}margin:0;`)
  inner.append(...Array.from(clone.childNodes))
  wrap.appendChild(inner)
  const xml = new XMLSerializer().serializeToString(wrap)
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`, vw, height, scrollH }
}

/** Draws the masked page into a WebP (or JPEG) of at most MAX_W px wide and MAX_BYTES. */
export async function rasterise(svg: string, vw: number, height: number, ext: 'webp' | 'jpg' = 'webp'): Promise<{ blob: Blob; ext: 'webp' | 'jpg'; width: number; height: number } | null> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  try { await img.decode() } catch { return null }
  const k = Math.min(1, MAX_W / vw)
  const c = document.createElement('canvas'); c.width = Math.round(vw * k); c.height = Math.round(height * k)
  const g = c.getContext('2d'); if (!g) return null
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  for (const q of [0.72, 0.55, 0.4]) {
    const type = ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const b = await new Promise<Blob | null>((res) => { try { c.toBlob(res, type, q) } catch { res(null) } })
    if (!b || b.type !== type) return null
    if (b.size <= MAX_BYTES) return { blob: b, ext, width: c.width, height: c.height }
  }
  return null
}
