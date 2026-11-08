import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles/app.css'
import './styles/shop.css'
import './tools/tools.css'
import App from './App'
import { ResetPage, isResetUrl } from './reset'

// Going to or from #/__reset changes only the hash, without a reload. Reload, so the reset page
// starts with no tool running, and the site starts fresh after it.
const showingReset = isResetUrl()
window.addEventListener('hashchange', () => { if (isResetUrl() !== showingReset) window.location.reload() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showingReset ? <ResetPage /> : <App />}
  </StrictMode>,
)
