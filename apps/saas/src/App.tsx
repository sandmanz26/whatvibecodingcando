import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { HeatmapOverlay, InsightsTracker } from './tools/insights/InsightsTools'
import { ReviewPins } from './tools/pins/ReviewPins'
import { UsabilityRunner } from './tools/tests/Runner'
import { VersionSwitch } from './components/VersionSwitch'
import { StoreProvider } from './store/store'
import { Layout } from './components/Layout'
import Home from './pages/shop/Home'
import Search from './pages/shop/Search'
import Product from './pages/shop/Product'
import Cart from './pages/shop/Cart'
import Checkout from './pages/shop/Checkout'
import Orders, { OrderDetail } from './pages/shop/Orders'
import { ResearchLayout } from './components/ResearchLayout'
import FiveSecond from './pages/FiveSecond'
import FakeDoorsPage from './pages/FakeDoorsPage'
import EyeTracking from './pages/EyeTracking'
import DesignTokens from './pages/DesignTokens'
import Report from './pages/Report'
import InsightRepo from './pages/InsightRepo'
import DesignCheck from './pages/DesignCheck'
import Narration from './pages/Narration'
import Prompts from './pages/Prompts'
import Compare from './pages/Compare'
import TokenCompare from './pages/TokenCompare'
import Install from './pages/Install'
import Landing from './pages/saas/Landing'
import Onboarding from './pages/saas/Onboarding'
import { Forgot as LocalForgot, Login as LocalLogin, Register as LocalRegister, Reset as LocalReset } from './pages/saas/Auth'
import { CloudForgot, CloudLogin, CloudRegister, CloudReset, Confirm } from './pages/saas/AuthCloud'
import { cloud } from './saas/supabase'
import { WidgetBuilder } from './pages/saas/WidgetBuilder'
import { Research, StudyResults } from './pages/saas/Research'
import { Dashboard } from './pages/saas/Dashboard'
import SharePage from './pages/saas/SharePage'
import { Privacy, Terms } from './pages/saas/Legal'
import { PanelLayout, Products, Install as PanelInstall, Comments, Team, SettingsPage } from './pages/saas/Panel'
import { NarrationRecorder } from './tools/voice/Narrator'
import { Inspector } from './tools/inspect/Inspector'
import { CompareDock } from './tools/compare/CompareDock'
import { DesignLayer } from './tools/design/DesignLayer'
import { FiveSecRunner } from './tools/fivesec/Runner'
import { FakeDoors } from './tools/doors/FakeDoors'
import { GazeRunner } from './tools/gaze/GazeRunner'
import Sessions from './pages/Sessions'
import Heatmap from './pages/Heatmap'
import HeatmapRuns from './pages/HeatmapRuns'
import UsabilityTests from './pages/UsabilityTests'
import TestEditor from './pages/TestEditor'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          {/* The hosted product's website and user panel: their own look, no research tools. */}
          <Route path="landingpage" element={<Landing />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="share/:token" element={<SharePage />} />
          <Route path="app/register" element={<Register />} />
          <Route path="app/login" element={<Login />} />
          <Route path="app/forgot" element={<Forgot />} />
          <Route path="app/reset" element={<Reset />} />
          <Route path="app/confirm" element={cloud ? <Confirm /> : <Navigate to="/app/login" replace />} />
          <Route path="app/onboarding" element={<Onboarding />} />
          <Route path="app/signup" element={<SignupRedirect />} />
          <Route path="app" element={<PanelLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="install" element={<PanelInstall />} />
            <Route path="widget" element={<WidgetBuilder />} />
            <Route path="comments" element={<Comments />} />
            <Route path="research" element={<Research />} />
            <Route path="research/:id" element={<StudyResults />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="search" element={<Search />} />
            <Route path="product/:id" element={<Product />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="*" element={<Home />} />
          </Route>
          {/* Research tools: kept apart from the product they study. */}
          <Route path="console" element={<ResearchLayout />}>
            <Route path="insights" element={<Navigate to="/console/sessions" replace />} />
            <Route path="sessions" element={<Sessions view="sessions" />} />
            <Route path="heatmap" element={<HeatmapRuns />} />
            <Route path="heatmap/view" element={<Heatmap />} />
            <Route path="tests" element={<UsabilityTests />} />
            <Route path="tests/:id" element={<UsabilityTests />} />
            <Route path="tests/:id/edit" element={<TestEditor />} />
            <Route path="fivesec" element={<FiveSecond />} />
            <Route path="fivesec/:id" element={<FiveSecond />} />
            <Route path="doors" element={<FakeDoorsPage />} />
            <Route path="gaze" element={<EyeTracking />} />
            <Route path="design" element={<DesignTokens />} />
            <Route path="design/compare" element={<TokenCompare />} />
            <Route path="report" element={<Report />} />
            <Route path="repo" element={<InsightRepo />} />
            <Route path="dscheck" element={<DesignCheck />} />
            <Route path="narration" element={<Narration />} />
            <Route path="compare" element={<Compare />} />
            <Route path="prompts" element={<Prompts />} />
            <Route path="install" element={<Install />} />
          </Route>
        </Routes>
        <ResearchTools />
      </HashRouter>
    </StoreProvider>
  )
}

/** Research tools sit around the marketplace and its console; never on the hosted product's own pages. */
function ResearchTools() {
  const { pathname } = useLocation()
  if (pathname === '/landingpage' || pathname === '/privacy' || pathname === '/terms' || pathname.startsWith('/share/') || pathname === '/app' || pathname.startsWith('/app/')) return null
  return (
    <>
      <DesignLayer />
      <InsightsTracker />
      <HeatmapOverlay />
      <ReviewPins />
      <UsabilityRunner />
      <FiveSecRunner />
      <FakeDoors />
      <GazeRunner />
      <NarrationRecorder />
      <Inspector />
      <CompareDock />
      <VersionSwitch />
    </>
  )
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
