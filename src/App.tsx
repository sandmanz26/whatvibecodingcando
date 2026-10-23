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
import Projects, { ProjectDetail } from './pages/Projects'
import Teams from './pages/Teams'
import Health from './pages/Health'
import { ResearchLayout } from './components/ResearchLayout'
import Sessions from './pages/Sessions'
import UsabilityTests from './pages/UsabilityTests'
import TestEditor from './pages/TestEditor'
import { V2Shell } from './v2/Shell'
import V2Home from './v2/Home'
import V2ShelfPage from './v2/ShelfPage'
import V2SkillPage from './v2/SkillPage'
import V2Projects from './v2/Projects'
import V2Tidy from './v2/Tidy'
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
            <Route path="projects" element={<V2Projects />} />
            <Route path="projects/:id" element={<V2Projects />} />
            <Route path="tidy" element={<V2Tidy />} />
          </Route>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="skills" element={<Library />} />
            <Route path="skills/:id" element={<SkillDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="teams" element={<Teams />} />
            <Route path="health" element={<Health />} />
            <Route path="*" element={<Overview />} />
          </Route>
          {/* Research tools: kept apart from the product they study. */}
          <Route path="console" element={<ResearchLayout />}>
            <Route path="insights" element={<Sessions />} />
            <Route path="tests" element={<UsabilityTests />} />
            <Route path="tests/:id" element={<UsabilityTests />} />
            <Route path="tests/:id/edit" element={<TestEditor />} />
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
