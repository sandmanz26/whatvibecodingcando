/**
 * UX research kit — one call to switch on the modules a project wants.
 * Each module also works on its own; see the individual files.
 */
import { defineConfig, watchRoutes, type ResearchConfig } from './config'
import { getFlag, flagEvent } from './storage'
import { installTracker, loadEvents, type Tracker } from './tracker'
import { heatmapFromUrl } from './heatmap'
import { installFakeDoors } from './fake-doors'
import { loadFiveSec, runFiveSecond } from './five-second'
import { installDesignLayer } from './design-tokens'

export * from './config'
export * from './storage'
export * from './tracker'
export * from './sessions'
export * from './heatmap'
export * from './fake-doors'
export * from './five-second'
export * from './design-tokens'
export * from './ui-presets'

export interface Modules {
  tracking?: boolean
  heatmap?: boolean
  fakeDoors?: boolean
  fiveSecond?: boolean
  design?: boolean | { presetCss: (id: string) => string }
  /** eye tracking loads MediaPipe; it starts from ?gaze when this is on */
  gaze?: boolean
}

export function installResearch(cfgIn: Partial<ResearchConfig> & { app: string }, m: Modules) {
  const cfg = defineConfig(cfgIn)
  const stops: (() => void)[] = []
  let tracker: Tracker | null = null

  if (m.design) stops.push(installDesignLayer(cfg, typeof m.design === 'object' ? m.design.presetCss : undefined))

  if (m.tracking) {
    const sync = () => {
      const on = getFlag(cfg, 'tracking')
      if (on && !tracker) { tracker = installTracker(cfg); tracker.view(cfg.path()) }
      if (!on && tracker) { tracker.endSession('stopped'); tracker.uninstall(); tracker = null }
    }
    sync()
    window.addEventListener(flagEvent(cfg), sync)
    stops.push(() => window.removeEventListener(flagEvent(cfg), sync))
  }

  let heat: ReturnType<typeof heatmapFromUrl> = null
  // Participant links (?fivesec=, ?gaze) start once per page load.
  let fiveDone = false, gazeDone = false
  const doors = m.fakeDoors ? installFakeDoors(cfg) : null
  if (doors) stops.push(doors.uninstall)

  stops.push(watchRoutes(cfg, (path) => {
    tracker?.view(path)
    doors?.refresh()
    if (m.heatmap) { heat?.destroy(); heat = heatmapFromUrl(cfg, { clicks: () => loadEvents(cfg).flatMap((e) => (e.type === 'click' ? [e] : [])) }) }
    const q = cfg.query()
    if (m.fiveSecond && !fiveDone && q.has('fivesec') && !q.has('heatmap')) {
      fiveDone = true
      const t = loadFiveSec(cfg).find((x) => x.id === q.get('fivesec'))
      if (t) runFiveSecond(cfg, t)
    }
    if (m.gaze && !gazeDone && q.has('gaze')) {
      gazeDone = true
      void import('./gaze-runner').then((g) => g.startGaze(cfg))
    }
  }))

  return { cfg, tracker: () => tracker, stop: () => { heat?.destroy(); tracker?.uninstall(); stops.forEach((s) => s()) } }
}
