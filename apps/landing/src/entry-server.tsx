// Build-time only: renders the page to HTML so crawlers and link previews see the whole page
// before any JavaScript runs (prerender.mjs puts it into dist/landing/index.html).
import { renderToString } from 'react-dom/server'
import App from './App'

export const render = () => renderToString(<App />)
