import { useLocation, useNavigate } from 'react-router-dom'
import { isConsole, isEmbedded } from '../tools/shared'

/** The same place in the other version, so switching never loses where you are. */
function counterpart(path: string, toV2: boolean): string {
  if (toV2) {
    if (path === '/skills/new') return '/v2/write'
    const edit = path.match(/^\/skills\/([^/]+)\/edit$/)
    if (edit) return `/v2/write/${edit[1]}`
    const skill = path.match(/^\/skills\/([^/]+)$/)
    if (skill) return `/v2/skills/${skill[1]}`
    if (path.startsWith('/skills')) return '/v2/shelf'
    if (path.startsWith('/pipeline')) return '/v2/review'
    return '/v2'
  }
  const skill = path.match(/^\/v2\/skills\/([^/]+)$/)
  if (skill) return `/skills/${skill[1]}`
  const write = path.match(/^\/v2\/write\/([^/]+)$/)
  if (write) return `/skills/${write[1]}/edit`
  if (path === '/v2/write') return '/skills/new'
  if (path.startsWith('/v2/shelf')) return '/skills'
  if (path.startsWith('/v2/review')) return '/pipeline'
  return '/'
}

/** Floating v1 / v2 switch, bottom-left on every product screen. */
export function VersionSwitch() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  if (isEmbedded || isConsole(pathname) || new URLSearchParams(search).has('heatmap')) return null
  const v2 = pathname === '/v2' || pathname.startsWith('/v2/')
  return (
    <div className={`vswitch ${v2 ? 'in-v2' : ''}`} role="group" aria-label="App version" data-insights-ignore>
      <button aria-pressed={!v2} onClick={() => v2 && nav(counterpart(pathname, false))}>v1 <span>Classic</span></button>
      <button aria-pressed={v2} onClick={() => !v2 && nav(counterpart(pathname, true))}>v2 <span>Shelf</span></button>
    </div>
  )
}
