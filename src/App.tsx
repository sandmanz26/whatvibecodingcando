import { HashRouter, Route, Routes } from 'react-router-dom'
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
import ClickInsights from './pages/ClickInsights'
import UsabilityTests from './pages/UsabilityTests'
import TestEditor from './pages/TestEditor'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
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
            <Route path="console/insights" element={<ClickInsights />} />
            <Route path="console/tests" element={<UsabilityTests />} />
            <Route path="console/tests/:id" element={<UsabilityTests />} />
            <Route path="console/tests/:id/edit" element={<TestEditor />} />
            <Route path="*" element={<Overview />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
