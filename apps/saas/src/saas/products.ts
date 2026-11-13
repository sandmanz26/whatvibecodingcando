/**
 * The products of the hosted platform. Visitors pick the ones they want on the landing page,
 * and turn them on per project in the user panel.
 *
 * `status` says honestly where a product works today:
 * - 'script': in the installable script (vibe.js), so it works on the customer's own site
 * - 'console': built and usable in the demo console; not in the script yet (early access)
 */
import type { LucideIcon } from 'lucide-react'
import { MessageSquarePlus, MousePointerClick, ListChecks, Timer, DoorOpen, Eye, Columns2, Palette, ScanSearch, Mic, FileText, Sparkles, Flame, SquareDashedMousePointer, GitBranch } from 'lucide-react'

/** Working name, kept in one place so it is easy to change. */
export const BRAND = 'Vibe Collab'

export type Category = 'Feedback' | 'Research' | 'Design' | 'Reporting'
export interface Product {
  id: string
  name: string
  tagline: string
  points: string[]
  category: Category
  status: 'script' | 'console'
  demo: string
  icon: LucideIcon
  hue: string
}

export const PRODUCTS: Product[] = [
  { id: 'comments', name: 'Comments', tagline: 'Pin feedback on the live product, reply, and close the loop.', points: ['Pins stick to elements', 'Draft, post, reply, complete', 'Works on any site'], category: 'Feedback', status: 'script', demo: 'embed-demo.html', icon: MessageSquarePlus, hue: '#e8590c' },
  { id: 'insights', name: 'Session insights', tagline: 'See where people click, where they hesitate, and replay their path.', points: ['Each visit as a path', 'Replay every tap', 'Rage and dead clicks'], category: 'Research', status: 'script', demo: 'embed-demo.html', icon: MousePointerClick, hue: '#1971c2' },
  { id: 'heatmap', name: 'Heatmaps', tagline: 'See where people click (and look) while doing a task, as a heatmap per screen.', points: ['Click and gaze heatmaps', 'Per task, per device', 'Every run listed'], category: 'Research', status: 'script', demo: 'embed-demo.html', icon: Flame, hue: '#e03131' },
  { id: 'usability', name: 'Usability tests', tagline: 'Give people a task, time it, and see where they get lost.', points: ['Task success and time', 'Participant link', 'Replays per task'], category: 'Research', status: 'script', demo: 'embed-demo.html', icon: ListChecks, hue: '#2f9e44' },
  { id: 'fivesec', name: '5-second tests', tagline: 'Show a screen for five seconds and learn what sticks.', points: ['First clicks', 'Recall questions', 'Shareable link'], category: 'Research', status: 'script', demo: 'embed-demo.html', icon: Timer, hue: '#f08c00' },
  { id: 'doors', name: 'Fake doors', tagline: 'Measure demand for a feature before you build it.', points: ['Add a door to any element', 'Clicks vs views', 'No code changes'], category: 'Research', status: 'script', demo: 'embed-demo.html', icon: DoorOpen, hue: '#9c36b5' },
  { id: 'gaze', name: 'Eye tracking', tagline: 'Webcam eye tracking with calibration and a gaze heatmap.', points: ['Runs in the browser', 'Accuracy check', 'Video never leaves the device'], category: 'Research', status: 'console', demo: '#/console/gaze', icon: Eye, hue: '#0c8599' },
  { id: 'compare', name: 'Component review', tagline: 'Put two components side by side and agree on what changes.', points: ['Pick from real screens', 'Rendered style diff', 'Notes about A, B or both'], category: 'Design', status: 'console', demo: '#/console/compare', icon: Columns2, hue: '#c2255c' },
  { id: 'tokens', name: 'Design tokens', tagline: 'Upload token files, simulate them, and compare two sets.', points: ['W3C, Tokens Studio, CSS', 'Live preview', 'Contrast check'], category: 'Design', status: 'script', demo: 'embed-demo.html', icon: Palette, hue: '#5f3dc4' },
  { id: 'inspect', name: 'Inspect', tagline: 'Hover anything to see its colours, font and spacing, and whether they are design tokens.', points: ['On the live product', 'Token or hard-coded', 'Pin to compare'], category: 'Design', status: 'script', demo: 'embed-demo.html', icon: SquareDashedMousePointer, hue: '#1864ab' },
  { id: 'dscheck', name: 'Design system check', tagline: 'Find colours, radii and fonts that aren’t design tokens.', points: ['Scans real screens', 'Suggests the nearest token', 'Per page'], category: 'Design', status: 'script', demo: 'embed-demo.html', icon: ScanSearch, hue: '#364fc7' },
  { id: 'versions', name: 'Versions', tagline: 'Switch the product between releases and see what each one added; feedback stays with its version.', points: ['What changed, outlined', 'Comments per version', 'Compare releases'], category: 'Feedback', status: 'console', demo: '#/', icon: GitBranch, hue: '#2b8a3e' },
  { id: 'narration', name: 'Narration', tagline: 'Walk through the product talking; each screen becomes a chapter.', points: ['Voice per screen', 'Play from the screen', 'Audio stays local'], category: 'Feedback', status: 'console', demo: '#/console/narration', icon: Mic, hue: '#d6336c' },
  { id: 'report', name: 'Reports & insights', tagline: 'Turn all the research into ranked findings you can keep.', points: ['Generated report', 'Insight repository', 'Evidence links'], category: 'Reporting', status: 'console', demo: '#/console/report', icon: FileText, hue: '#495057' },
  { id: 'prompts', name: 'Prompts for Claude', tagline: 'Build any of these tools into your own codebase with Claude.', points: ['One prompt per tool', 'Fits your framework', 'Free'], category: 'Reporting', status: 'console', demo: '#/console/prompts', icon: Sparkles, hue: '#e67700' },
]

export const CATEGORIES: Category[] = ['Feedback', 'Research', 'Design', 'Reporting']
export const productOf = (id: string) => PRODUCTS.find((p) => p.id === id)
/** Product ids from a comma list, keeping only real ones, in catalogue order. */
export const parseProducts = (s: string | null | undefined) => {
  const want = new Set((s ?? '').split(',').map((x) => x.trim()))
  return PRODUCTS.filter((p) => want.has(p.id)).map((p) => p.id)
}

/** The products that run in the script on customers' sites, as a readable list ("Comments, Inspect and Design tokens"). */
export const inScript = () => {
  const n = PRODUCTS.filter((p) => p.status === 'script').map((p) => p.name)
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n[0] ?? ''
}
