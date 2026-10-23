import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
const EVENT = 'skillhouse:theme'

const current = (): Theme => {
  const t = document.documentElement.dataset.theme
  if (t === 'light' || t === 'dark') return t
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** One theme for the whole app; every caller stays in sync through a window event. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)
  useEffect(() => {
    const sync = () => setTheme(current())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  const toggle = () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('skillhouse:theme', next) } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVENT))
  }
  return [theme, toggle] as const
}
