/** Which sidebar link is the page being shown (pure; tested in tests/nav.test.ts). */
/** The params that make a different page of the same path (others, like ?status, are filters). */
export const PAGE_KEYS = ['kind', 'tab', 'module'] as const
const OLD_MODULE: Record<string, string> = { browse: 'heatmap', eyes: 'gaze', heatmap: 'heatmap', gaze: 'gaze', fivesec: 'fivesec', usability: 'usability' }
/** The page params of an address; Research's older ?kind=… spelling counts as its ?module=…. */
function pageParams(pathname: string, search: string) {
  const q = new URLSearchParams(search)
  const out: Record<string, string> = {}
  for (const k of PAGE_KEYS) out[k] = q.get(k) ?? ''
  if (pathname === '/app/research' && !out.module && out.kind) { out.module = OLD_MODULE[out.kind] ?? ''; out.kind = '' }
  return out
}
/** The one active link: an exact match (path and page params), else the closest parent path (a study's results → Research overview). */
export function activeOf(all: string[], pathname: string, search: string): string | null {
  const have = pageParams(pathname, search)
  const match = (keys: readonly string[]) => all.find((to) => {
    const [path, q = ''] = to.split('?')
    if (path !== pathname) return false
    const want = pageParams(path, q)
    return keys.every((k) => want[k] === have[k])
  })
  // Exact first; then a module's own tab (?module=gaze&tab=sessions) stays on its module's link.
  const exact = match(PAGE_KEYS) ?? (have.module ? match(PAGE_KEYS.filter((k) => k !== 'tab')) : undefined)
  if (exact) return exact
  const parents = all.filter((to) => !to.includes('?') && to !== '/app' && pathname.startsWith(`${to}/`)).sort((a, b) => b.length - a.length)
  return parents[0] ?? null
}


/** The address params of a Research tab: the module always stays (?module=gaze&tab=sessions). */
export const researchTabParams = (module: string | null, tab: 'studies' | 'sessions'): Record<string, string> => ({ ...(module ? { module } : {}), ...(tab === 'sessions' ? { tab: 'sessions' } : {}) })
