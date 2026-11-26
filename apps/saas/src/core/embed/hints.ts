/**
 * The hints the panel puts in a site's address: #vibe_t=<review token>, #vibe_r=<study token>,
 * #vibe_tool=<tool>, #vibe_heat=gaze.
 *
 * Many apps redirect as soon as they load (to /login, or from / to /dashboard), and their router
 * drops the hash before this script runs. The address the browser first opened is still in the
 * page's navigation entry, so a hint is read from the current address or, failing that, from there.
 * Taking a hint removes it from the address (if it is still there) and never reads it again in this
 * page, so a one-time token is used once.
 */
const taken = new Set<string>()

/** The hash of the address this page was first opened at (before any redirect inside the app). */
function openedHash(): string {
  try {
    const e = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return e ? new URL(e.name).hash : ''
  } catch { return '' }
}

const find = (hash: string, name: string, value: string) => new RegExp(`(?:^#|&)vibe_${name}=(${value})(?:&|$)`).exec(hash)?.[1] ?? null

/** A hint's value without taking it (the loader uses this to decide whether the widget is needed). */
export function peekHint(name: string, value = '[^&]+'): string | null {
  return find(window.location.hash, name, value) ?? (taken.has(name) ? null : find(openedHash(), name, value))
}

/** A hint's value, taken: it leaves the address (the page's own hash route stays) and isn't read again. */
export function takeHint(name: string, value = '[^&]+'): string | null {
  const here = find(window.location.hash, name, value)
  const v = here ?? (taken.has(name) ? null : find(openedHash(), name, value))
  if (v === null) return null
  taken.add(name)
  if (here !== null) {
    const rest = window.location.hash.replace(/^#/, '').split('&').filter((x) => !x.startsWith(`vibe_${name}=`)).join('&')
    try { history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`) } catch { /* the address keeps it */ }
  }
  return v
}

/**
 * The panel's "View heatmap" link: #vibe_tool=heatmap&vibe_heat=click|gaze&vibe_study=<id>&vibe_page=<path>.
 * It opens the heatmap report straight away, on that study, kind and page (the page from the link,
 * so it still shows the right map when the site redirected on load). Every part is taken once.
 */
export interface ReportHint { kind: 'click' | 'gaze'; study: string | null; page: string | null }
export function takeReport(): ReportHint | null {
  if (peekHint('tool', 'heatmap') === null) return null
  takeHint('tool', 'heatmap')
  const heat = takeHint('heat', 'gaze|click')
  const study = takeHint('study', '[0-9a-f-]{36}')
  const raw = takeHint('page')
  let page: string | null = null
  try { page = raw ? decodeURIComponent(raw) : null } catch { page = null }
  if (page && (!/^\/(?!\/)/.test(page) || page.length > 300)) page = null
  return { kind: heat === 'gaze' ? 'gaze' : 'click', study, page }
}
/** The hash the panel's "View heatmap" puts on the page's address (with the review token added later). */
export function reportHash(o: { kind: 'click' | 'gaze'; study?: string | null; page?: string | null }): string {
  return ['vibe_tool=heatmap', `vibe_heat=${o.kind}`, ...(o.study ? [`vibe_study=${o.study}`] : []), ...(o.page ? [`vibe_page=${encodeURIComponent(o.page)}`] : [])].join('&')
}
