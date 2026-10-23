import { HashRouter, Route, Routes } from 'react-router-dom'
import { HeatmapOverlay, InsightsTracker } from './tools/insights/InsightsTools'
import { ReviewPins } from './tools/pins/ReviewPins'
import { UsabilityRunner } from './tools/tests/Runner'
import { VersionSwitch } from './components/VersionSwitch'
import { StoreProvider } from './store/store'
import { Layout } from './components/Layout'
import Overview from './pages/Overview'
import Library from './pages/Library'
import SkillDetail from './pages/SkillDetail'
import SkillEditor from './pages/SkillEditor'
import Pipeline from './pages/Pipeline'
import Team from './pages/Team'
import Governance from './pages/Governance'
import Insights from './pages/Insights'
import Playbook from './pages/Playbook'
import Sessions from './pages/Sessions'
import UsabilityTests from './pages/UsabilityTests'
import TestEditor from './pages/TestEditor'
import { V2Shell } from './v2/Shell'
import V2Home from './v2/Home'
import V2ShelfPage from './v2/ShelfPage'
import V2SkillPage from './v2/SkillPage'
import V2ReviewDesk from './v2/ReviewDesk'
import V2Write from './v2/Write'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-serif/400.css'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="v2" element={<V2Shell />}>
            <Route index element={<V2Home />} />
            <Route path="shelf" element={<V2ShelfPage />} />
            <Route path="skills/:id" element={<V2SkillPage />} />
            <Route path="review" element={<V2ReviewDesk />} />
            <Route path="review/:id" element={<V2ReviewDesk />} />
            <Route path="write" element={<V2Write key="new" />} />
            <Route path="write/:id" element={<V2Write />} />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="skills" element={<Library />} />
            <Route path="skills/new" element={<SkillEditor key="new" />} />
            <Route path="skills/:id" element={<SkillDetail />} />
            <Route path="skills/:id/edit" element={<SkillEditor />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="team" element={<Team />} />
            <Route path="governance" element={<Governance />} />
            <Route path="insights" element={<Insights />} />
            <Route path="playbook" element={<Playbook />} />
            <Route path="console/insights" element={<Sessions />} />
            <Route path="console/tests" element={<UsabilityTests />} />
            <Route path="console/tests/:id" element={<UsabilityTests />} />
            <Route path="console/tests/:id/edit" element={<TestEditor />} />
            <Route path="*" element={<Overview />} />
          </Route>
        </Routes>
        {/* Research tools sit around both versions of the app. */}
        <InsightsTracker />
        <HeatmapOverlay />
        <ReviewPins />
        <UsabilityRunner />
        <VersionSwitch />
      </HashRouter>
    </StoreProvider>
  )
}
