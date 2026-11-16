/**
 * Everything the landing page says, in one place. English only.
 *
 * Honesty rules (from the repository's notes): no invented customers, numbers or testimonials.
 * Every fact below is true of the product as it is built today.
 */

/** The live product. The landing page is standalone, so these are absolute. */
const LIVE = 'https://whatvibecodingcando.vercel.app/'
export const LINKS = {
  demo: `${LIVE}embed-demo.html`,
  start: `${LIVE}#/app/register`,
  login: `${LIVE}#/app/login`,
  guide: `${LIVE}#/guide`,
  privacy: `${LIVE}#/privacy`,
  terms: `${LIVE}#/terms`,
}

export const BRAND = 'Vibe Collab'

/** The six problems, each named by the sentence people actually say when it happens. */
export const PROBLEMS = [
  {
    quote: 'Which button? On which page?',
    title: 'Feedback gets cut off from the product.',
    body: 'It arrives as a cropped screenshot in a chat, without the page, the element, the screen size or the version it was about. Someone has to ask before anyone can fix.',
    cost: 'A round of questions before every fix',
    layer: 'Feedback',
  },
  {
    quote: 'I told the AI that twice already.',
    title: 'Every note is retyped as a prompt.',
    body: 'You become the translator between the people reviewing and the tool building. Each note is rewritten by hand with its context, and a detail is lost on every pass.',
    cost: 'Hours of copy, paste and explain',
    layer: 'Feedback',
  },
  {
    quote: 'It worked when I tried it.',
    title: 'Nobody new has ever used it.',
    body: 'AI-built screens look finished on day one, so nobody checks whether a first-time user can get through them. The first real usability test is the launch.',
    cost: 'Problems found by your customers',
    layer: 'Research',
  },
  {
    quote: 'I just feel the button should be bigger.',
    title: 'Opinions decide, because nothing is measured.',
    body: 'Without evidence the loudest voice wins. The team argues about taste for a week and still doesn’t know where people click or where they give up.',
    cost: 'Decisions made on taste',
    layer: 'Research',
  },
  {
    quote: 'Why do we have nine different blues?',
    title: 'The design drifts with every prompt.',
    body: 'Each prompt invents its own colours, spacing and font sizes. The design system erodes one hard-coded value at a time, and nobody sees it happen.',
    cost: 'A product that stops looking like yours',
    layer: 'Design QA',
  },
  {
    quote: 'That’s three more tools and three more bills.',
    title: 'Reviewing properly needs a stack of its own.',
    body: 'Comments in one tool, heatmaps in another, user tests in a third. Each has its own script, its own login and a price per seat, so small teams skip all of it.',
    cost: 'The review never happens',
    layer: 'All three',
  },
] as const

export type LayerId = 'feedback' | 'research' | 'design'

export const LAYERS: {
  id: LayerId
  label: string
  verb: string
  title: string
  body: string
  answers: string[]
  tools: { name: string; what: string; tag?: string }[]
}[] = [
  {
    id: 'feedback',
    label: 'Feedback',
    verb: 'Hear it',
    title: 'Feedback that knows where it lives.',
    body: 'Reviewers click the thing they mean. The comment keeps its page, element, screen size and version, so nobody has to ask. When it’s time to fix, copy it as a prompt for your AI coding tool.',
    answers: ['Which button? On which page?', 'I told the AI that twice already.'],
    tools: [
      { name: 'Comments', what: 'Pins that stick to the element, with replies, voice notes and a done state.' },
      { name: 'Copy fix prompt', what: 'One comment or the whole open list, written out for your AI coding tool.' },
      { name: 'Component review', what: 'Two components side by side, with the style differences listed.' },
      { name: 'Narration', what: 'Talk through the product; each screen becomes a chapter.' },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    verb: 'Prove it',
    title: 'Watch real people try it.',
    body: 'Send a link, give a task, and see what happens on the real product, not on a prototype. You get success rates, times and heatmaps where there used to be opinions.',
    answers: ['It worked when I tried it.', 'I just feel the button should be bigger.'],
    tools: [
      { name: 'Usability tests', what: 'A task, a timer, and where each person got lost.' },
      { name: '5-second tests', what: 'Show a screen for five seconds and learn what sticks.' },
      { name: 'Heatmaps', what: 'Where people click during a task, per screen and per device.' },
      { name: 'Participant paths', what: 'Each participant’s pages and clicks, with rage and dead clicks marked.' },
      { name: 'Eye tracking', what: 'Webcam gaze heatmaps. The video never leaves the device.', tag: 'Labs' },
      { name: 'Reports', what: 'The research as ranked findings, each linked to its evidence.' },
    ],
  },
  {
    id: 'design',
    label: 'Design QA',
    verb: 'Keep it',
    title: 'Catch the drift before it ships.',
    body: 'Point at anything to see its real colours, type and spacing, and whether each one is a design token or a value somebody’s prompt made up.',
    answers: ['Why do we have nine different blues?'],
    tools: [
      { name: 'Inspect', what: 'Hover any element: its styles, and token or hard-coded for each.' },
      { name: 'Design system check', what: 'Scans a page for off-system values and suggests the nearest token.' },
      { name: 'Design tokens', what: 'Upload token files, preview them live and compare two sets.' },
    ],
  },
]

/** The loop is a real sequence, so it is numbered. */
export const LOOP = [
  { title: 'Paste one line', body: 'Add the script tag to your site, or ask your AI coding tool to add it. Nothing else changes in your code.' },
  { title: 'Send a review link', body: 'Reviewers open your real site from the link. They don’t need an account, and your visitors see nothing.' },
  { title: 'Review on the real thing', body: 'People comment, take a test or check the design on the product itself. Everything lands in one panel.' },
  { title: 'Copy the fix, ship again', body: 'Open comments become one prompt with page, element, device and version. Paste, ship, and go round again.' },
]

/** The specification, as a drawing's title block. Facts only. */
export const SPEC = [
  { k: 'Install', v: 'One script tag', d: 'React, Next.js, Vue, Svelte, Webflow, WordPress or plain HTML.' },
  { k: 'Who sees it', v: 'Reviewers only', d: 'By default the widget opens only from a review link you send.' },
  { k: 'Visitors load', v: 'About 5 kB', d: 'A small check. The widget itself loads only for people reviewing.' },
  { k: 'Your CSS', v: 'Untouched', d: 'The widget lives in a shadow root: its styles and yours never meet.' },
  { k: 'Form fields', v: 'Never read', d: 'Typed text and field values are never recorded, in any tool.' },
  { k: 'Your data', v: 'Yours to take', d: 'Download comments as CSV or delete them whenever you want.' },
]

export const PRICES = [
  {
    name: 'Free',
    price: '$0',
    unit: '',
    note: 'For one site and a few reviewers.',
    items: ['1 site', 'Comments, voice notes, component review', 'Inspect, design system check, design tokens', 'Up to 3 reviewers'],
    cta: 'Start free',
  },
  {
    name: 'Pro',
    price: '$2',
    unit: 'per site, per month',
    note: 'Every tool, for every site you add. Rp 29.000 in Indonesia.',
    items: ['Usability tests, 5-second tests, heatmaps', 'Participant paths and eye tracking (Labs)', 'Reports, CSV downloads, share links', 'No price per seat'],
    cta: 'Get Pro free during the beta',
  },
]

export const SHEETS = [
  { id: 'top', name: 'Start' },
  { id: 'problem', name: 'The problem' },
  { id: 'layer', name: 'The layer' },
  { id: 'loop', name: 'The loop' },
  { id: 'try', name: 'Try it' },
  { id: 'spec', name: 'The spec' },
  { id: 'pricing', name: 'Pricing' },
]
