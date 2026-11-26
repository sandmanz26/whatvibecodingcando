/**
 * Whether the widget shows here, for whom, and with what: a pure function of the published
 * configuration and this browser's state (kept apart from the app so it can be tested on its own:
 * tests/embed-compat.ts).
 */
import { anyModule, envFor, type WidgetConfig } from './config'

export type ToolId = 'inspect' | 'dscheck' | 'tokens' | 'heatmap'
export const TOOL_IDS: ToolId[] = ['inspect', 'dscheck', 'tokens', 'heatmap']
/** The research modules a visitor can take part in under "Everyone", each into its default (★) study. */
export type ResearchModule = 'heatmap' | 'gaze' | 'fivesec' | 'usability'
export const RESEARCH_MODULES: ResearchModule[] = ['heatmap', 'gaze', 'fivesec', 'usability']

export type Decision = { show: true; config: WidgetConfig; preview: boolean; comments: boolean; tools: ToolId[]; research: ResearchModule[] } | { show: false; why: string }
/**
 * Whether the widget shows here, and with which settings. Order matters: the off switch first, then
 * where (environment), then what (modules), then who (audience).
 */
export function decide(o: { project: string; config: WidgetConfig | null; draft: WidgetConfig | null; preview: boolean; host: string; hostname: string; demo: boolean; reviewer: boolean; invited: boolean }): Decision {
  const preview = o.preview && o.reviewer && !!o.draft
  const c = preview ? o.draft : o.config
  if (!c) return { show: false, why: 'This project has no published widget settings yet.' }
  if (!c.on) return { show: false, why: 'The widget is switched off for this project.' }
  if (!o.demo) {
    const env = envFor(c, o.host, o.project) ?? envFor(c, o.hostname, o.project)
    if (!env) return { show: false, why: `${o.hostname} isn’t one of this project’s environments (Widget → Where).` }
    if (!env.on) return { show: false, why: env.name ? `The widget is off in the ${env.name} environment.` : `The widget is off for ${o.hostname} (Widget → Where).` }
  }
  if (!anyModule(c.modules)) return { show: false, why: 'No module is turned on.' }
  // Who sees what: "Who sees it" (audience) is for Comments. The design tools are for people opened
  // in with a review link only, whatever the audience: they are the team's tools, not the visitors'.
  const comments = c.modules.comments && (c.audience === 'everyone' || o.reviewer)
  // With the widget for reviewers only, every reviewer came in through a link (or the panel's preview).
  const tools = o.invited || (o.reviewer && c.audience === 'reviewers') ? TOOL_IDS.filter((id) => c.modules[id]) : []
  // Open to everyone: every research module that is on, each with a one-line consent first (people
  // who already record into the heatmap as reviewers don't get the heatmap's button again).
  const research = c.audience === 'everyone' && !preview ? RESEARCH_MODULES.filter((id) => c.modules[id] && !(id === 'heatmap' && tools.includes('heatmap'))) : []
  if (!comments && !tools.length && !research.length) return { show: false, why: 'Only reviewers see it; open the site through a review link.' }
  return { show: true, config: c, preview, comments, tools, research }
}

