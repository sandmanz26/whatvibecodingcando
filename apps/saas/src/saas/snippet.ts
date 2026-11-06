/** The install snippet for the script, shared by the console's Install page and the user panel. */

const here = () => window.location.href.split('#')[0]
export const scriptUrl = () => new URL('embed/vibe.js', here()).href
/** The demo site; with a project id, comments made there belong to that project. */
export const demoUrl = (project?: string) => new URL(`embed-demo.html${project && validProjectId(project) ? `?project=${project}` : ''}`, here()).href
export const DEFAULT_COLOR = '#e8590c'
export const validProjectId = (id: string) => /^[\w-]{1,64}$/.test(id)

export interface SnippetOptions {
  project: string; position: 'right' | 'left'; shortcut: boolean; color: string
  /** products the script should run; left out, it runs everything it has */
  products?: string[]
}

export function snippet(o: SnippetOptions) {
  return [
    `<script src="${scriptUrl()}"`,
    `  data-project="${validProjectId(o.project) ? o.project : 'my-app'}"`,
    o.products ? `  data-products="${o.products.join(',')}"` : '',
    o.position === 'left' ? '  data-position="left"' : '',
    o.shortcut ? '' : '  data-shortcut="off"',
    o.color.toLowerCase() !== DEFAULT_COLOR ? `  data-color="${o.color}"` : '',
    '  defer></script>',
  ].filter(Boolean).join('\n')
}

/** Copies text, falling back to a hidden textarea where the Clipboard API isn't allowed. */
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back */ }
  const ta = Object.assign(document.createElement('textarea'), { value: text })
  ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  return ok
}
