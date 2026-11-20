import { lazy, Suspense } from 'react'
import { HashRouter, useLocation } from 'react-router-dom'
import { StoreProvider } from './store/store'

/**
 * Two areas, each its own download: the hosted product (website pages, sign-in, the user panel) and
 * the demo marketplace with its research console. Someone opening the panel never loads the demo,
 * its research tools or the eye-tracking model, and the other way round.
 */
const HostedApp = lazy(() => import('./HostedApp'))
const DemoApp = lazy(() => import('./DemoApp'))

/** Addresses of the hosted product; everything else is the demo. */
export const isHosted = (path: string) => path === '/landingpage' || path === '/privacy' || path === '/terms' || path === '/guide' || path.startsWith('/share/') || path === '/app' || path.startsWith('/app/')

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
  return <Suspense fallback={<div className="boot" aria-busy="true" />}>{isHosted(pathname) ? <HostedApp /> : <DemoApp />}</Suspense>
}
