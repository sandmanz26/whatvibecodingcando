/**
 * Product analytics (PostHog) for the website. Off unless the build has VITE_POSTHOG_KEY (a public
 * project key, phc_…). When on: one page view, and named events only (object_action, snake_case):
 *   cta_clicked {location, target: signup|login|demo, products}  a call to action that starts the funnel
 *   pricing_viewed {}                                              the pricing section came into view (once)
 * No autocapture, no session recording, nothing typed on the page (the "Try it" notes stay in the tab).
 * First touch: PostHog keeps the first referrer and UTM tags of the visit in its first-party cookie
 * (path /, this origin) and sets them once on the person ($initial_utm_source, …) when the app at /app,
 * which shares the cookie, identifies the account. The page's own UTM tags also ride on cta_clicked.
 */
const KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? ''
const HOST: string = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export function startAnalytics() {
  if (!/^phc_[A-Za-z0-9]{20,}$/.test(KEY)) return
  // After the page is up, so analytics never slows the first paint.
  const go = () => void import('posthog-js').then(({ default: ph }) => {
    ph.init(KEY, {
      api_host: HOST,
      persistence: 'cookie',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      advanced_disable_flags: true,
      save_referrer: true,
    })
    const utm = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => /^utm_(source|medium|campaign|term|content)$/.test(k)).map(([k, v]) => [k, v.slice(0, 100)]))
    const pricing = document.getElementById('pricing')
    if (pricing && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { ph.capture('pricing_viewed'); io.disconnect() } }, { threshold: 0.3 })
      io.observe(pricing)
    }
    // The funnel's first steps: which call to action, from which part of the page, with which tools.
    document.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      const where = a.closest('section, header, footer, nav')?.id || a.closest('section, header, footer, nav')?.tagName.toLowerCase() || 'page'
      const target = href.startsWith('/app#/app/register') ? 'signup' : href.startsWith('/app#/app/login') ? 'login' : href.startsWith('/embed-demo.html') ? 'demo' : ''
      if (!target) return
      const products = target === 'signup' ? new URLSearchParams(href.split('?')[1] ?? '').get('products') ?? '' : ''
      ph.capture('cta_clicked', { location: where, target, ...(products ? { products: products.split(',') } : {}), ...utm })
    }, { capture: true })
  }).catch(() => { /* analytics never breaks the page */ })
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
