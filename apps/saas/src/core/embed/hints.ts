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
