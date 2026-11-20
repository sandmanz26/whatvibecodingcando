/**
 * Product analytics (PostHog) for the website. Off unless the build has VITE_POSTHOG_KEY (a public
 * project key, phc_…). When on: one page view, and the clicks that start the funnel (sign-up, the
 * demo, log in), with the tools picked. No autocapture, no session recording, nothing typed on the
 * page (the "Try it" notes stay in the tab). A first-party cookie keeps the anonymous id, so the
 * visit carries on into the app at /app, which counts the rest of the funnel.
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
    })
    // The funnel's first steps: which call to action, from which part of the page, with which tools.
    document.addEventListener('click', (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      const where = a.closest('section, header, footer, nav')?.id || a.closest('section, header, footer, nav')?.tagName.toLowerCase() || 'page'
      if (href.startsWith('/app#/app/register')) ph.capture('get_started_clicked', { where, products: new URLSearchParams(href.split('?')[1] ?? '').get('products') ?? '' })
      else if (href.startsWith('/app#/app/login')) ph.capture('login_clicked', { where })
      else if (href.startsWith('/embed-demo.html')) ph.capture('demo_opened', { where })
    }, { capture: true })
  }).catch(() => { /* analytics never breaks the page */ })
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
