import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, useLocation } from 'react-router-dom'
import { StoreProvider } from './store/store'
import { pageview } from './lib/analytics'

/**
 * Two areas, each its own download: the hosted product (website pages, sign-in, the user panel) and
 * the demo marketplace with its research console. Someone opening the panel never loads the demo,
 * its research tools or the eye-tracking model, and the other way round.
 */
const HostedApp = lazy(() => import('./HostedApp'))
const DemoApp = lazy(() => import('./DemoApp'))

/**
 * Addresses of the demo marketplace and its research console: only these explicit paths, never
 * linked from the product. Everything else (the empty hash, unknown addresses) is the hosted product.
 */
export const isDemo = (path: string) => path === '/shop' || path === '/search' || path === '/cart' || path === '/checkout' || path === '/orders' || path.startsWith('/orders/') || path.startsWith('/product/') || path === '/console' || path.startsWith('/console/')

/** Addresses of the hosted product. */
export const isHosted = (path: string) => path === '/landingpage' || path === '/privacy' || path === '/terms' || path === '/guide' || path === '/unsubscribe' || path === '/admin' || path.startsWith('/share/') || path === '/app' || path.startsWith('/app/')

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Area />
      </HashRouter>
    </StoreProvider>
  )
}

function Area() {
  const { pathname } = useLocation()
  // One page view per screen (the app routes by hash, so the browser's own page views miss them).
  useEffect(() => { pageview() }, [pathname])
  return <Suspense fallback={<div className="boot" aria-busy="true" />}>{isDemo(pathname) ? <DemoApp /> : <HostedApp />}</Suspense>
}
