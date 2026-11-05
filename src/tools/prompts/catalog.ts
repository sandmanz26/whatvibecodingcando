/**
 * Prompts a visitor can copy into their own Claude (Claude Code in their project, or claude.ai)
 * to build the research tools shown in this demo. Each prompt has two forms:
 * - with the ux-research-kit skill installed: short, the skill carries the details;
 * - without it: self-contained, with the behaviour, states and privacy rules spelled out,
 *   so Claude builds the same logic rather than guessing.
 */

export type Framework = 'react' | 'next' | 'vue' | 'svelte' | 'plain' | 'unsure'
export type Routing = 'hash' | 'history' | 'unsure'
export interface PromptContext { framework: Framework; routing: Routing; skill: boolean }

export const FRAMEWORKS: Record<Framework, string> = {
  react: 'React (Vite)', next: 'Next.js', vue: 'Vue', svelte: 'Svelte / SvelteKit', plain: 'Plain HTML + JS', unsure: 'Not sure — let Claude check',
}
export const ROUTINGS: Record<Routing, string> = { hash: 'Hash URLs (#/page)', history: 'Normal URLs (/page)', unsure: 'Not sure — let Claude check' }

const stack = (c: PromptContext) => {
  const fw = c.framework === 'unsure' ? 'Find out which framework this project uses.' : `The app uses ${FRAMEWORKS[c.framework]}.`
  const rt = c.routing === 'unsure' ? 'Find out how it routes (hash URLs or normal URLs).' : `It routes with ${c.routing === 'hash' ? 'hash URLs (#/page)' : 'normal URLs (/page)'}.`
  const mount = {
    react: 'Start the tools once in the root component (in an effect, cleaned up on unmount).',
    next: 'The tools run in the browser only: load them client-side (a client component or dynamic import with ssr: false).',
    vue: 'Start the tools once in App.vue (onMounted, cleaned up in onUnmounted).',
    svelte: 'Start the tools once in the root layout (onMount, browser only).',
    plain: 'Start the tools once when the page has loaded.',
    unsure: 'Start the tools once at app start, in the browser only.',
  }[c.framework]
  return `${fw} ${rt} ${mount}`
}

const GROUND_RULES = `Ground rules:
- Read the project first (framework, router, where the CSS variables/design tokens live, the component library) and tell me your plan before writing code.
- Keep research tools apart from the product: their own folder (e.g. src/research), their own routes (a "research console"), their UI marked with a data-research-ui attribute so it is never recorded, and never linked from the product's navigation.
- Frontend only unless I say otherwise: keep data in localStorage (audio in IndexedDB) and say plainly that it lives in one browser.
- Privacy: never record what anyone types, field values, names, emails or page content. Session ids are random and per tab. Click recording stays OFF in production builds until I decide on consent.`

const VERIFY = `When you're done: run the project's typecheck and build, then test it in a real browser (Playwright if available) — the cancel and edge paths too, not only the happy path. Tell me plainly what you could not test.`

export interface PromptEntry {
  id: string
  title: string
  group: 'Research' | 'Feedback' | 'Design' | 'Reporting' | 'Everything'
  summary: string
  needs: string[]
  /** short ask when the ux-research-kit skill is installed */
  skill: string
  /** the behaviour to build, spelled out */
  spec: string
}

export const PROMPTS: PromptEntry[] = [
  {
    id: 'sessions', title: 'Click tracking & sessions', group: 'Research',
    summary: 'Records screen views and taps per session, and replays each tap on the real screen.',
    needs: ['Frontend only'],
    skill: 'Add click tracking with sessions and tap replay.',
    spec: `Build click tracking with sessions and a replay view.

Record:
- Screen views (path, previous path) and taps.
- A tap stores: position (% of window width, px from page top), the control's own visible name (aria-label or the first line of its text, max 100 chars), its kind, a CSS selector that finds it again, where on the element it landed (% x/y), time since the screen opened, and its effect within 0.7 s (navigated / changed the screen / nothing).
- Flag rage taps (3+ within 1 s and 40 px) and dead taps (not a control). Elements with a pointer cursor (clickable rows, cards) count as controls.
- Keep the screen's filters and tabs from the URL query, but drop free-text keys (search boxes) and any value that isn't a short token.

Sessions:
- A session starts counting when the main page opens; taps before that are not kept.
- It ends when the tab closes (a reload continues it), when the participant presses "End session", after 30 minutes idle, or when recording is switched off. Recording continues into the next session until switched off.
- Show a visible "● End session" indicator while a session is active.

Research console screen "Sessions":
- A list of sessions (length, layout, how it ended), and the selected one as a journey (screens in order) and a step-by-step timeline.
- Researcher notes and tags, and CSV export.
- "Replay taps": show each tap on the real screen in an iframe at the participant's exact window size and with the same filters, with the dot drawn at the recorded spot on the recorded element (not at old page coordinates). Use ← → to step through.`,
  },
  {
    id: 'heatmap', title: 'Heatmaps', group: 'Research',
    summary: 'Tap dots and per-element boxes drawn on the real screen, filtered by page and layout.',
    needs: ['Click tracking', 'Frontend only'],
    skill: 'Add tap heatmaps (dots and per-element counts) with a screen viewer in the research console.',
    spec: `Build tap heatmaps on top of the click data (build click tracking first if it doesn't exist).

- An overlay activated by ?heatmap (dots) or ?heatmap=elements on any screen URL.
- Draw each tap on its element at the recorded position within it, re-measured on scroll, resize and every second, so sticky sidebars and different layouts stay accurate. Fall back to the old page position (greyed) only if the element is gone.
- Only draw taps from the same page AND the same layout bucket (mobile < 640, tablet < 1024, desktop).
- Elements mode: a box per tapped element with its count, coloured by how often taps did nothing (green < 20%, amber < 50%, red ≥ 50%).
- In the research console: a screen viewer (the app in a same-origin iframe at mobile 390 / tablet 820 / desktop 1280, scaled to fit) with a page picker and a "most tapped here" list. Inside an iframe, scroll with window.scrollTo, never scrollIntoView (it would scroll the console too).`,
  },
  {
    id: 'usability', title: 'Usability tests', group: 'Research',
    summary: 'Timed tasks for participants, with success, time, first-tap and a task heatmap.',
    needs: ['Frontend only'],
    skill: 'Add timed, task-based usability tests with a participant link and results.',
    spec: `Build task-based usability tests.

- A test is a name, an intro, and tasks. Each task has a prompt, a start page, a time limit, and a success rule: reach a page (a trailing * accepts sub-pages), or tap an element picked on the real screen.
- Participant link ?test=<id>. Flow: intro, optional nickname, then for each task a "Ready" card, then the task running with a small timer and the prompt, ending in success, timeout or "give up".
- Record per task: outcome, time, pages visited, and taps (position, control name, selector, position on the element, hit or not). The first tap counts as correct when it moves toward the target. Never record typed text. A reload mid-run continues it.
- Results: per task success rate, median time, timeouts, gave up, direct success, first-tap correctness with the first taps listed. Participant rows expand into a per-task timeline with replay. A task heatmap shows misses as idle.
- An editor where the target element is picked in the screen viewer.`,
  },
  {
    id: 'fivesec', title: '5-second test', group: 'Research',
    summary: 'Shows a screen for five seconds and records the first click and how fast.',
    needs: ['Frontend only'],
    skill: 'Add 5-second (first-click) tests with a participant link and results.',
    spec: `Build 5-second (first-click) tests.

- A test is a name, a question, a screen, a duration (3–15 s), and an optional "right answer" element picked on the real screen.
- Participant link <page>?fivesec=<id>. Flow: a cover hides the screen and shows the question with "Show the screen"; then the screen appears with a countdown bar and a transparent layer that catches the first click; then a thank-you card.
- Record the first click: the element underneath (elementsFromPoint), its position on the element, the time, and whether it hit the target. Running out of time records "missed".
- Results: participants, % clicked in time, median time to first click, % on target, what was clicked first, and the first clicks drawn on the screen (green on target, red elsewhere). "Copy participant link" and "Clear results".`,
  },
  {
    id: 'doors', title: 'Fake doors', group: 'Research',
    summary: 'A button for something not built yet; counts who saw it and who tried it.',
    needs: ['Frontend only'],
    skill: 'Add fake-door tests with a research console screen for their numbers.',
    spec: `Build fake-door tests.

- A door is either an existing element (picked on the real screen) or a new button added after one. The new button copies its neighbour's classes so it looks native, and is put back if the framework re-renders.
- While a door is live, clicking it shows a short "coming soon" note and does nothing else: stop the click before the app sees it (capture listener + stopPropagation), but let the click tracker still record it.
- Count per anonymous tab: "seen" (the door was at least half on screen once per visit, via IntersectionObserver) and "clicked". Nothing else. Count nothing inside an iframe or on heatmap URLs.
- Research console: a table of doors with live switch, saw it, clicked, click rate (clicked ÷ saw it), total clicks, edit, reset counts, delete; an editor with the element picker, the kind of door, button text and message.`,
  },
  {
    id: 'gaze', title: 'Eye tracking (webcam)', group: 'Research',
    summary: 'Webcam eye tracking per usability task: fixations, scanpaths and areas of interest.',
    needs: ['Camera', '@mediapipe/tasks-vision (Apache-2.0)'],
    skill: 'Add webcam eye tracking with calibration, an accuracy check and a gaze heatmap.',
    spec: `Build webcam eye tracking with MediaPipe Face Landmarker (@mediapipe/tasks-vision, Apache-2.0, runs in the browser). Don't use WebGazer (GPL-3.0).

- Consent first, in plain language: video stays in the browser and is never saved or sent; only the estimated point on the page is kept; stop any time. The camera starts only after "Turn on the camera".
- Features per frame: where each iris sits between the eye corners and lids (divided by eye width), eye openness, and the head's direction from the facial transformation matrix.
- Calibration: 13 dots (3×3 plus 4 between), visited in a spread-out order. Look at a dot and click it, then collect about 900 ms of frames (skip the first 150 ms); if fewer than 6 frames had a face, ask again. Fit a ridge regression (standardised features) for x and y.
- Accuracy check: 5 more dots; report the mean error in px. Refuse recording if it's too far off (over ~220 px) and offer to recalibrate.
- Recording: about 30 samples/s as {page, x %, y page px, window size, epoch ms}, only while the tab is visible. Drop blinks (eye openness well below the calibration average). Smooth with a One-Euro filter, not a moving average, so saccades aren't smeared. Refit the model with every click (the click point is where they looked), keeping the latest 30, so it follows head movement. Show a small pill with "±N px" and a Stop button.
- Eye movement, not just points:
  - fixations with I-DT (dispersion threshold scaled to the measured accuracy, about 0.9 × accuracy, at least 100 ms, a gap over 150 ms ends one); merge adjacent fixations (gap ≤ 75 ms, ≤ half the dispersion apart); extend a fixation back over samples skipped while it settled;
  - saccades between fixations; the scanpath per person (numbered circles sized by duration, joined in order, with playback);
  - areas of interest with % of people who looked, time to first fixation and dwell;
  - a heatmap weighted by fixation duration.
- In usability tests: an option per test asks participants before the first task (they may decline and still do the test), and every sample carries the run and task, so all of the above can be read per task, next to where they clicked.
- Unit-test the fixation code on synthetic gaze with known fixations, blinks and sweeps before trusting it.
- Test without a face using Chromium's fake camera flags; check the consent, "looking for your face", retry and Cancel paths.`,
  },
  {
    id: 'comments', title: 'Comments with replies & voice notes', group: 'Feedback',
    summary: 'Reviewers drop comments anywhere, write or record, reply, and set them as completed.',
    needs: ['Microphone for voice notes', 'Frontend only'],
    skill: 'Add on-screen comments with a draft → post flow, replies, voice notes, completion and status filters.',
    spec: `Build on-screen comments for reviewers. Work out the states first; the flow must follow them.

1. Placing: a "Comment" button (and the C key, ignored inside fields) turns on a crosshair; one click anywhere drops a pin there (not tied to an element). Esc cancels.
2. Draft: a "New comment" card with only the comment box, an optional voice note, Cancel and Post. Post is enabled only when there is text or a voice note. A draft is NOT saved, numbered or given a status, and shows no replies and no "completed" button. Cancel/Esc discard it and its voice note. A draft with content must be posted or cancelled before starting or opening another comment; leaving the page discards it and says so.
3. Posted: the comment shows as a message (no longer an input), with status Open. Only now do replies and "Set as completed" appear. Its author can Edit (Save marks it "edited", Cancel changes nothing).
4. Replies: each reply can be text, a voice note, or both; authors can delete their own. The first reply makes the comment Ongoing. A recorded but unsent reply voice note is thrown away.
5. Completed: "Set as completed" records who and when, and locks the thread (no replies, edits or reply deletes). "Reopen" undoes it.

- Pins are coloured by status.
- An "All comments" list filters All / Open / Ongoing / Completed with counts, shows status, author and reply count, and jumps to the page and spot.
- A "Commenting as" name is kept per browser.
- Voice notes:
  - the microphone starts only on "Record voice note", with a live level meter;
  - audio goes in IndexedDB, nothing is uploaded or transcribed;
  - deleting a comment deletes its audio.
- Export and import a lossless .txt; voice notes are listed by length only.`,
  },
  {
    id: 'compare', title: 'Component review (A vs B)', group: 'Feedback',
    summary: 'Pick two components from the real screens, compare their rendered styles side by side, and keep notes.',
    needs: ['Frontend only'],
    skill: 'Add a component review: pick two components from the real screens, compare their rendered styles side by side, and keep notes about A, B or both.',
    spec: `Build a component review screen in the research console. Work out the states first; the flow must follow them.

1. New review (a draft, NOT saved yet): two slots, A and B, and an optional title. Each slot has "Pick component".
2. Picking: a dialog shows the real app in an iframe at a chosen device width (mobile / tablet / desktop), with quick links to the main screens and a Navigate mode to reach others. Hover outlines, a click selects (snapping to the nearest control), and the selection stays marked. "Wider" / "Narrower" step to the parent or back to the part clicked, so a whole card can be chosen. "Use as A/B" confirms; Cancel or Esc keeps the earlier choice. If the screen changed after the click, say so and ask to pick again.
3. On "Use", take a snapshot: page (keep only non-free-text filters, never a typed search), device, a stable selector, a short name, and the computed styles: size, font size/weight/line height/family, text colour, background, border, corner radius, padding, shadow. Name the design token behind a colour or radius when one matches.
4. Save is enabled only when both slots are filled and they are not the same component on the same screen and device (the same component on two devices is allowed). The title defaults to "A name vs B name". Cancel with changes asks before discarding.
5. Saved review: both components shown cropped from the live screen (load the page in a non-interactive iframe at the slot's device width, find the selector, scroll the frame — not the page — and clip to its box; if it isn't found, say it may need an action first instead of showing the wrong area). Below, a style table A | B with differing rows highlighted and a count, from the snapshots.
6. Notes: only on a saved review, saved as they are added. Each note is about A, B or both, with author ("writing as" name kept per browser) and time; authors can delete their own. Filter All / A / B / Both with counts.
7. Edit renames or replaces a component; notes stay, and a note written before its component was replaced is marked as about the earlier one. Delete asks first.

- Store reviews in localStorage. Never store field values or typed text from the screens.`,
  },
  {
    id: 'narration', title: 'Narrated walkthroughs', group: 'Feedback',
    summary: 'Explain screens out loud while browsing; each screen becomes a playable chapter.',
    needs: ['Microphone', 'Frontend only'],
    skill: 'Add narrated walkthroughs: record my voice while I go through the screens, chaptered per screen.',
    spec: `Build narrated walkthroughs.

- A microphone button (in the research tools' floating controls) starts recording with MediaRecorder. A bar at the top shows elapsed time, a level meter, the current screen and Stop. Warn before the page is closed while recording.
- Each screen visited becomes a chapter {page, filters, ms into the recording}. A screen passed through in under ~1.2 s is folded into the next.
- On Stop, save the audio in IndexedDB and the chapters in localStorage, and confirm with a link to the narration page.
- Research console "Narration":
  - "Walkthroughs" plays a recording with its chapter list; clicking a chapter seeks to it, and a screen viewer beside it follows the chapter being played.
  - "By screen" lists every explanation per screen.
  - Rename, download the audio, and delete.
- On any screen that has an explanation, the floating controls show "▶ Explain" to play just that chapter there; leaving the screen stops it.
- Privacy: the mic starts only on the button, with a visible indicator; audio stays in the browser.`,
  },
  {
    id: 'design-tokens', title: 'Design tokens & UI-library looks', group: 'Design',
    summary: 'Edit tokens as JSON, upload token files and compare two sets side by side, or try a Material / Ant / shadcn / Bootstrap look.',
    needs: ['Frontend only'],
    skill: 'Add a design-token simulator with live preview and Material 3 / Ant Design / shadcn/ui / Bootstrap 5 looks.',
    spec: `Build a design-token simulator in the research console.

- Read the app's own tokens from its stylesheets (the :root block for light, the dark-mode block for dark) into W3C design-token JSON: a token is an object with $value, its name (the last key) is the CSS variable it sets, and top-level keys "light" and "dark" say where it applies.
- A JSON editor with plain-language validation (bad JSON, unknown scope, a name that can't be a CSS variable, values containing ; { }), format, reset, download, and upload (partial files are laid over the app's own tokens).
- Quick controls for the main tokens (primary, on-primary, accent, page, surface, text, control and card radius).
- Generate CSS that applies only the changed tokens. A light token that dark mode doesn't redefine applies in both modes. Use selectors with html:root so they win.
- Live preview: the app in a same-origin iframe, receiving the design by postMessage (the iframe answers "ready"); nothing is saved until "Apply in this browser", which puts the variant on the whole app (for a usability test) until "Turn off".
- UI-library looks: Material 3, Ant Design, shadcn/ui, Bootstrap 5. Each is a token palette plus component rules under html[data-uilib="…"] that restyle the app's real components (buttons, inputs, chips, segmented controls, switches, tabs, cards, nav, dialogs) and use var(--primary) rather than hard-coded colours. Say clearly these imitate the look and don't install the library.
- Show a table of what changes (token, scope, from, to, with swatches).
- Upload & compare:
  - Accept W3C tokens, Tokens Studio JSON and CSS variable files, keeping each as a named set. Resolve aliases ({a.b}) and var() references within the file. A whole path segment or selector named "dark" means dark mode; skip and count composite values, broken aliases and unsafe values.
  - Map the app's tokens to the file's: filled in by name, same kind only, editable, and opened straight away when nothing matched.
  - Compare any two looks (the app's own, a library look, an upload) on the same screen side by side, with WCAG contrast for the main text/background pairs and a table of differing tokens.
  - A preview frame must ignore storage events once the console has sent it a design.`,
  },
  {
    id: 'ds-check', title: 'Design system check', group: 'Design',
    summary: 'Scans every screen for colours, radii, fonts and sizes that aren’t design tokens.',
    needs: ['Frontend only'],
    skill: 'Add a design system check that scans each screen for off-token colours, radii, fonts and font sizes.',
    spec: `Build a design system check in the research console.

- Open each chosen screen in a hidden same-origin iframe (off-screen, not visibility:hidden, so styles compute), wait for it to render and for fonts, then walk every visible element and read its computed styles.
- Resolve the tokens as that document renders them (a probe element with color: var(--token)), so var() chains and the current theme are handled.
- Flag:
  - text, background and border colours that aren't tokens (alpha-aware, ±1 per channel);
  - corner radii that aren't tokens (allow 0, 50% and pills);
  - fonts that aren't tokens;
  - font sizes off an editable type scale;
  - inline styles that set these by hand.
- Judge inherited properties (colour, size, family) only where they're set, not on every child. Skip the research tools' own UI and SVG internals.
- Results: a consistency score overall and per screen, and a table of each off-token value with uses, screens, the closest token, an example element, "Show on screen" (the element outlined), and "Keep in the insight repository". If a design variant is applied, check the variant.`,
  },
  {
    id: 'report', title: 'Research report', group: 'Reporting',
    summary: 'A one-page summary of all research data, with findings ranked by impact and evidence.',
    needs: ['Other research tools'],
    skill: 'Add a research report that summarises all the research data into ranked findings with evidence.',
    spec: `Build a one-page research report generated from the research tools' data. Use fixed rules, not an AI model, so the same data always gives the same report and every finding says what it rests on.

- Sections:
  - "In short" (top 3 findings);
  - "In numbers";
  - the journey funnel (sessions reaching each step from home to order, or your app's equivalent);
  - findings ranked by impact;
  - a usability task table;
  - quotes from researcher notes and comments.
- Findings to detect:
  - the biggest funnel drop (≥ 40%);
  - elements people tap that do nothing or aren't clickable (name them by their accessible name, never their text content);
  - usability tasks under 70% success or slow;
  - 5-second hit rates;
  - fake-door interest;
  - attention above the fold from eye tracking;
  - frequent researcher tags.
  Mark the ones that confirm something works.
- Each finding: impact, source, title, what it means, evidence ("4 taps in 3 sessions"), "Show on screen", and "Keep in the insight repository".
- Flag small samples (under 5 participants). Copy as Markdown, download .md, print/PDF (hide controls in print).
- Offer "Add sample research data" (every id prefixed demo-) and "Remove sample data", so the report can be shown before a study.`,
  },
  {
    id: 'repo', title: 'Insight repository', group: 'Reporting',
    summary: 'Keep findings, tag them, track what happens to them, and jump to the screen.',
    needs: ['Frontend only'],
    skill: 'Add an insight repository for kept findings, with tags, status, search and links to the screen.',
    spec: `Build an insight repository in the research console.

- An insight: title, what it means, evidence, source (report, design check, usability test, … or added by hand), impact (high/medium/low), status (New, Being worked on, Done, Won't act), tags, and optionally the screen and element it's about.
- Add from the research report and the design system check (skip duplicates by title and screen), or by hand.
- Search, filter by status (with counts), impact, source and tag; change status inline; edit; delete; "Show on screen" with the element outlined; export Markdown.`,
  },
  {
    id: 'everything', title: 'The whole research console', group: 'Everything',
    summary: 'All of the above, separate from your product, with a floating research dock.',
    needs: ['Camera & microphone for some tools'],
    skill: 'Set up the whole research console: click tracking and sessions, heatmaps, usability tests, 5-second tests, fake doors, eye tracking, comments with voice, component review, narration, design tokens, design system check, research report and insight repository.',
    spec: `Set up a full UX research console around this app.

- The tools: click tracking with sessions and replay, heatmaps, usability tests, 5-second tests, fake doors, webcam eye tracking, comments with a draft → post flow and voice notes, a component review (A vs B with notes), narrated walkthroughs, a design-token simulator with UI-library looks, a design system check, a research report and an insight repository.
- Build it in stages and check with me after each: tracking and sessions first, then feedback tools, then design tools, then reporting.
- Give the research tools their own routes with a top bar ("Research console", a tab per tool, "Back to the app").
- Add a floating, draggable research dock (position remembered, arrow keys move it). It holds the session indicator, Comment and All comments, the microphone, the active design variant's name, and a link to the console. Hide it inside iframes.
- Each tool's behaviour is specified below; ask me if a step is unclear rather than guessing.`,
  },
]

export const SKILL_INSTALL = `/plugin marketplace add sandmanz26/whatvibecodingcando
/plugin install ux-research-kit@whatvibecodingcando`

/** The text a visitor copies. */
export function promptFor(p: PromptEntry, c: PromptContext): string {
  if (c.skill) {
    return [
      `Use the ux-research-kit skill. ${p.skill}`,
      '',
      stack(c),
      'Follow the skill\'s privacy rules, keep the research tools apart from the product, and run its verification checklist before telling me it works.',
    ].join('\n')
  }
  // The all-in-one prompt carries every tool's spec, so it stands on its own.
  const body = p.id === 'everything'
    ? [p.spec, ...PROMPTS.filter((x) => x.id !== 'everything').flatMap((x) => ['', `## ${x.title}`, '', x.spec])].join('\n')
    : p.spec
  return [body, '', stack(c), '', GROUND_RULES, '', VERIFY].join('\n')
}

export function allMarkdown(c: PromptContext) {
  const head = [
    '# Prompts for UX research tools',
    '',
    c.skill ? `These prompts use the ux-research-kit skill. Install it in Claude Code first:\n\n\`\`\`\n${SKILL_INSTALL}\n\`\`\`` : 'Paste a prompt into Claude Code, opened in your project (or into claude.ai).',
    '',
  ]
  return [...head, ...PROMPTS.flatMap((p) => [`## ${p.title}`, '', p.summary, '', '```text', promptFor(p, c), '```', ''])].join('\n')
}
