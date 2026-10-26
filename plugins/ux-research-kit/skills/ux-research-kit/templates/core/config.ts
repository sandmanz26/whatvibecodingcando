/**
 * UX research kit — configuration shared by every module.
 * Framework-agnostic: works with any router as long as it can tell the current path.
 */

export interface ResearchConfig {
  /** storage prefix, e.g. "acme" → localStorage keys "acme.insights.clicks", … */
  app: string
  /** pages where a recorded session starts counting, e.g. ["/"] */
  mainPages: string[]
  /** the current route path, without query */
  path(): string
  /** the current route query */
  query(): URLSearchParams
  /** selector for the research UI itself — never recorded, never reacted to */
  ignore: string
  /** extra condition under which nothing is recorded (e.g. on the research console) */
  paused(): boolean
  /** query keys that can hold free text and must never be recorded */
  freeTextParams: string[]
}

/** Routing helpers: pick the one that matches the app. */
export const hashRouting = (): Pick<ResearchConfig, 'path' | 'query'> => ({
  path: () => window.location.hash.replace(/^#/, '').split('?')[0] || '/',
  query: () => {
    const h = window.location.hash
    const i = h.indexOf('?')
    return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '')
  },
})

export const historyRouting = (base = ''): Pick<ResearchConfig, 'path' | 'query'> => ({
  path: () => window.location.pathname.slice(base.length) || '/',
  query: () => new URLSearchParams(window.location.search),
})

/** The research UI marks its own elements with this attribute. */
export const RESEARCH_ATTR = 'data-research-ui'

export function defineConfig(c: Partial<ResearchConfig> & { app: string }): ResearchConfig {
  const routing = historyRouting()
  return {
    mainPages: ['/'],
    ignore: `[${RESEARCH_ATTR}]`,
    paused: () => false,
    freeTextParams: ['q', 'query', 'search', 's', 'term', 'email', 'name'],
    ...routing,
    ...c,
  }
}

/** True inside an iframe (e.g. a heatmap viewer). Recording stays quiet there. */
export const isEmbedded = typeof window !== 'undefined' && window.self !== window.top

/**
 * Calls `onChange(path)` whenever the route (path or query) changes — popstate, hashchange,
 * and pushState/replaceState (patched once). Returns a stop function.
 */
export function watchRoutes(cfg: ResearchConfig, onChange: (path: string) => void): () => void {
  const route = () => `${cfg.path()}?${cfg.query()}`
  let last = route()
  const check = () => { const r = route(); if (r !== last) { last = r; onChange(cfg.path()) } }
  const w = window as unknown as { __researchPatched?: boolean }
  if (!w.__researchPatched) {
    w.__researchPatched = true
    for (const m of ['pushState', 'replaceState'] as const) {
      const orig = history[m]
      history[m] = function (this: History, ...args: Parameters<History['pushState']>) {
        const r = orig.apply(this, args)
        window.dispatchEvent(new Event('research:route'))
        return r
      }
    }
  }
  window.addEventListener('popstate', check)
  window.addEventListener('hashchange', check)
  window.addEventListener('research:route', check)
  onChange(cfg.path())
  return () => {
    window.removeEventListener('popstate', check)
    window.removeEventListener('hashchange', check)
    window.removeEventListener('research:route', check)
  }
}
