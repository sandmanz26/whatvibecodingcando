import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
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
import Signup from './pages/saas/Signup'
import { PanelLayout, Overview, Products, Install as PanelInstall, Comments, Team, SettingsPage } from './pages/saas/Panel'
import { NarrationRecorder } from './tools/voice/Narrator'
import { DesignLayer } from './tools/design/DesignLayer'
import { FiveSecRunner } from './tools/fivesec/Runner'
import { FakeDoors } from './tools/doors/FakeDoors'
import { GazeRunner } from './tools/gaze/GazeRunner'
import Sessions from './pages/Sessions'
import UsabilityTests from './pages/UsabilityTests'
import TestEditor from './pages/TestEditor'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          {/* The hosted product's website and user panel: their own look, no research tools. */}
          <Route path="landingpage" element={<Landing />} />
          <Route path="app/signup" element={<Signup />} />
          <Route path="app" element={<PanelLayout />}>
            <Route index element={<Overview />} />
            <Route path="products" element={<Products />} />
            <Route path="install" element={<PanelInstall />} />
            <Route path="comments" element={<Comments />} />
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
            <Route path="insights" element={<Sessions />} />
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
  if (pathname === '/landingpage' || pathname === '/app' || pathname.startsWith('/app/')) return null
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
      <VersionSwitch />
    </>
  )
}
