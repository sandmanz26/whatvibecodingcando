import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/martian-mono'
import '@fontsource-variable/shantell-sans'
import './styles.css'
import App from './App'
import { startAnalytics } from './analytics'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
startAnalytics()
