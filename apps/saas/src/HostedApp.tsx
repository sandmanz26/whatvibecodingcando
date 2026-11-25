// The hosted product (website pages, sign-in and the user panel), loaded only on its own addresses.
import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Onboarding from './pages/saas/Onboarding'
import { Forgot as LocalForgot, Login as LocalLogin, Register as LocalRegister, Reset as LocalReset } from './pages/saas/Auth'
import { CloudForgot, CloudLogin, CloudRegister, CloudReset, Confirm } from './pages/saas/AuthCloud'
import { cloud } from './saas/supabase'
import { WidgetBuilder } from './pages/saas/WidgetBuilder'
import { Research, StudyResults } from './pages/saas/Research'
import { Report as PanelReport } from './pages/saas/Report'
import { Dashboard } from './pages/saas/Dashboard'
import SharePage from './pages/saas/SharePage'
import { Privacy, Terms } from './pages/saas/Legal'
import { Guide } from './pages/saas/Guide'
import { Unsubscribe } from './pages/saas/Unsubscribe'
import { RoundsPage, RoundRecord } from './pages/saas/Rounds'
import { BillingPage } from './pages/saas/Billing'
import { openPendingCheckout } from './saas/billing'
import { PanelLayout, Products, Install as PanelInstall, Comments, ReviewersPage, SettingsPage } from './pages/saas/Panel'

// Internal ops panel (founder only): its own download, never linked for normal users.
const Ops = lazy(() => import('./pages/saas/ops/Ops'))

/** The hosted product: website pages (guide, legal, share links), sign-in and the user panel. */
export default function HostedApp() {
  // Paddle's checkout comes back to /app?_ptxn=…: only then is Paddle.js loaded (src/saas/billing.ts).
  useEffect(() => { openPendingCheckout() }, [])
  return (
    <Routes>
      {/* The hosted product's website and user panel: their own look, no research tools. */}
      <Route path="landingpage" element={<ToWebsite />} />
      <Route path="privacy" element={<Privacy />} />
      <Route path="terms" element={<Terms />} />
      <Route path="guide" element={<Guide />} />
      <Route path="unsubscribe" element={<Unsubscribe />} />
      <Route path="share/:token" element={<SharePage />} />
      <Route path="app/register" element={<Register />} />
      <Route path="app/login" element={<Login />} />
      <Route path="app/forgot" element={<Forgot />} />
      <Route path="app/reset" element={<Reset />} />
      <Route path="app/confirm" element={cloud ? <Confirm /> : <Navigate to="/app/login" replace />} />
      <Route path="app/onboarding" element={<Onboarding />} />
      <Route path="app/signup" element={<SignupRedirect />} />
      <Route path="admin" element={<Suspense fallback={null}><Ops /></Suspense>} />
      <Route path="app" element={<PanelLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="install" element={<PanelInstall />} />
        <Route path="widget" element={<WidgetBuilder />} />
        <Route path="comments" element={<Comments />} />
        <Route path="research" element={<Research />} />
        <Route path="research/:id" element={<StudyResults />} />
        <Route path="report" element={<PanelReport />} />
        <Route path="rounds" element={<RoundsPage />} />
        <Route path="rounds/:id/record" element={<RoundRecord />} />
        <Route path="prompts" element={<Navigate to="/app" replace />} />
        <Route path="reviewers" element={<ReviewersPage />} />
        <Route path="team" element={<Navigate to="/app/reviewers" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      {/* The app's root and unknown addresses open the panel (its guards send signed-out people to log in). */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

/** The website lives at the site's root now (apps/landing); the old #/landingpage address goes there. */
function ToWebsite() {
  useEffect(() => { window.location.replace('/') }, [])
  return null
}

/** The old sign-up address: registering is now first, and the picked products carry on to onboarding. */
function SignupRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/app/register${search}`} replace />
}

// With a Supabase project in the build: real accounts and emails. Without: the browser-only demo.
const Register = cloud ? CloudRegister : LocalRegister
const Login = cloud ? CloudLogin : LocalLogin
const Forgot = cloud ? CloudForgot : LocalForgot
const Reset = cloud ? CloudReset : LocalReset
