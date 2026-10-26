import { HashRouter, Route, Routes } from 'react-router-dom'
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
          </Route>
        </Routes>
        {/* Research tools sit around both versions of the app. */}
        <DesignLayer />
        <InsightsTracker />
        <HeatmapOverlay />
        <ReviewPins />
        <UsabilityRunner />
        <FiveSecRunner />
        <FakeDoors />
        <GazeRunner />
        <VersionSwitch />
      </HashRouter>
    </StoreProvider>
  )
}
