import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/martian-mono'
import '@fontsource-variable/shantell-sans'
import './styles.css'
import App from './App'
import { startAnalytics } from './analytics'

const root = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>
// The build puts the page's HTML in #root (prerender.mjs): take it over; in development it's empty.
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
startAnalytics()
