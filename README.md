# Marketplace prototype + UX research tools

Two parts, kept apart:

1. **The product**: a lo-fi, grey-wireframe marketplace with AI features, buyer side only. It is deliberately familiar (search, product page, cart, checkout), so anyone watching a research video knows where to look.
2. **The research tools around it**: click tracking and sessions, heatmaps, usability tests, 5-second tests, fake doors, webcam eye tracking, comments, design-token simulation, and the theme switch. They live in the floating dock and the Research console (`#/console/*`).

Frontend only (React + TypeScript + Vite). The catalogue is sample data (`src/data/shop.ts`). The "AI" is simulated and deterministic (`src/lib/ai.ts`), so every participant sees the same answers. The UI says so.

The previous product (Skillhouse, a team skill monitor) is in git history and was handed over as a zip.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/ (hash routing, works on any static host)
```

## The marketplace

| Screen | What's on it |
|---|---|
| Home (`#/`) | "Describe what you need" AI box with example requests, categories, deals, an assistant call-out, popular products |
| Search (`#/search`) | Plain-language search: an "Understood as" bar (category, budget, needs) the filters can override, sort, results that say why they match, "Refine with the assistant" |
| Product (`#/product/:id`) | Gallery placeholders, options (size/colour must be chosen), quantity, Buy now / Add to cart, seller, **AI summary of reviews**, **Ask about this product** (answers from the listing, says when it doesn't know), specs, reviews, similar products |
| Cart, Checkout, Orders | Quantities, "Goes well with your cart", shipping and payment choices (no payment taken), order confirmation with tracking steps |
| Shopping assistant | "Ask AI" opens a side panel: a request becomes three picks; "Cheaper options" / "Best rated" refine it |

Every image is a grey box with a cross labelled with what goes there. Stable ids (`#ask-ai`, `#add-to-cart`, `[data-q]`) keep research targets steady.

## Stack

React 19 · TypeScript · Vite · React Router (hash) · lucide-react · plain CSS with light/dark tokens (greys only).

```
src/
  data/        sample catalogue
  lib/         simulated AI (understand, search, answer, assistant), theme
  store/       cart, orders, assistant panel, toasts (localStorage)
  components/  shop layout, assistant, UI primitives, research layout and dock
  pages/shop/  the marketplace screens
  pages/       research console screens
  tools/       research tools
```

## Research tools (kept apart from the product)

Research tools are not part of the marketplace: click tracking and sessions, heatmaps, usability tests, 5-second tests, fake doors, eye tracking, comments, design tokens and the dark/light theme. (The v1/v2 version switch is off while there is one version.) They live in the floating **research dock** and in the **Research console** (`#/console/*`, its own layout with "Back to the shop"); the product's navigation never links to them.

Two of them sit *around* the product (not features of it). Each has its own flag and neither changes how the app behaves. Click recording pauses on the research console (`/console/*`); comments work on every screen. Each marks its own DOM (`data-insights-ignore`, `data-review-pins`) so neither records nor reacts to the other.

Flags are stored in localStorage (`market.flags.insights`, `market.flags.reviewPins`). Recording is toggled on **Sessions** (`#/console/insights`). Comments are on by default.

### Click insights
- **Recorded:** screen views (with the previous screen), and taps. A tap stores its position, the control's visible name (its aria-label or own text, max 100 chars), its kind, its section, a selector to find it again, where on the element it landed, its aria state, time since the screen opened, scroll depth, rage (3+ taps within 1 s and 40 px), dead (not a control), and its effect within 0.7 s (navigated / changed / nothing), and the screen's filters and tabs (e.g. `scope=shared`; never the search box or any free text). Rows and cards the app made clickable count as controls, so a tap on a table row is recorded as that row.
- **Never recorded:** anything typed, field values, names, emails, or page content. For a field we keep only its placeholder, name or type. The session id is random, per tab (sessionStorage), and not linked to a user.
- **Sessions:** a session starts counting when the main page (`#/`) opens; taps before that aren't kept. It ends when the tab closes (a reload carries on), the participant presses **End session** in the dock, it sits idle for 30 minutes, or recording is switched off. Recording carries on into the next session until it is stopped.
- **Defaults:** on in development; **off in production builds until the product owner decides on consent** (banner / privacy policy).
- **Where to review:** `#/console/insights` (**Sessions**). Pick a session to read it **in time order**: the screens it went through, then every tap — time, element, where it sits, and what happened (opened a page, changed the screen, nothing; rage and dead taps are flagged). **Replay taps** opens each tap on the real screen, at the participant's exact window size and with the same filters, with the tap drawn where it landed on the element and the element ringed; ← → step through. Researchers can tag a session (Confused, Got lost…) and write notes, and export it as CSV. The **Heatmap** tab shows all taps on one screen at one width. Add `?heatmap` (dots) or `?heatmap=elements` to any screen URL to see it outside the console. Only taps from the same page *and* layout bucket are drawn (mobile < 640 px, tablet < 1024 px, desktop).

### Usability tests (task-based)
- Find them at `#/console/tests`. Each test has tasks. A task has a prompt, a start page, a time limit, and a success rule: *reach a page* (a trailing `*` matches any page below it) or *tap an element*. You pick the element by clicking it on the real screen.
- Share the test link (`#/<start>?test=<id>`). The participant gets an intro, then one task at a time with a timer at the bottom of the screen. They can give up at any point.
- Recorded per task: the outcome (success, timed out, gave up), time on task, taps (position and control name only), the pages visited, and whether the first click was right (it hit the target, or it moved toward the target page). The participant name is an optional nickname.
- Open a participant to see their taps for each task in order, and replay any of them on the real screen.
- Results show success rate, median time, average taps, direct success (no backtracking), first-click accuracy, the most common first clicks, and every tap drawn on the real screen (green = hit the target, red = missed).
- Results are stored in the browser where the test was taken (`market.tests`, `market.tests.sessions`).

### 5-second tests
`#/console/fivesec`. A screen shows for five seconds (3–15, configurable) after a short prompt, and the participant's **first click** is kept: where it landed, on which control, and how fast. An optional right answer (picked on the real screen) gives a hit rate. Results: participants, clicked in time, median time to first click, what was clicked first, and the first clicks drawn on the screen. Participant link: any screen with `?fivesec=<id>`.

### Fake doors
`#/console/doors`. A door is either an existing element or a new button added after one (picked on the real screen). While live, clicking it shows a short "coming soon" note instead of doing anything. Counted per anonymous tab: saw it (the door was at least half on screen) and clicked it, giving a click rate. Nothing else is recorded; the click also appears in Sessions when recording is on.

### Eye tracking (webcam)
`#/console/gaze`, participant link `#/?gaze`. Uses [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) (Apache-2.0) running in the browser: iris position inside each eye, eye openness and head direction go into a ridge regression fitted by a 9-dot calibration, then checked on 4 more dots and reported as average error in px (recording is refused when it is too far off). **The camera starts only after the participant agrees; video frames never leave the browser and are never stored** — only the estimated gaze point on the page (about 15 per second). Webcam tracking is coarse (typically 100–200 px), so the heatmap (`?heatmap=gaze`) draws soft areas. The WebAssembly runtime is bundled; the 4 MB face model loads from Google's model storage the first time.

### Design tokens and UI-library looks
`#/console/design`. Edit the app's design tokens as JSON (W3C design-token style: a token is an object with `$value`, its name is the CSS variable it sets; top-level `light` and `dark` say where it applies). The JSON starts from the app's own stylesheets. Pick a UI library look (Material 3, Ant Design, shadcn/ui, Bootstrap 5) to load its tokens and restyle the marketplace's components the way that library draws them; these imitate the look and don't load the library's code. Quick controls edit the main tokens; a live screen viewer previews any screen without saving; **Apply in this browser** puts the variant on the whole app (for example for a usability test) and the dock shows its name until it is turned off. Download/upload JSON; partial files are laid over the app's own tokens.

### Research report
`#/console/report`. One page built from everything the tools collected (sessions, usability tests, 5-second tests, fake doors, eye tracking, researcher notes and comments). It has:
- **In short**: the top findings in one line each.
- **In numbers** and **Journey**: key counts, and how many sessions reached each step from home to order placed.
- **Findings**, ranked by impact, each with its evidence, "Show on screen" (the real screen with the element outlined) and "Keep in repository". Findings include:
  - the biggest drop in the journey;
  - elements people tap that do nothing or aren't clickable;
  - usability tasks with low success or slow completion;
  - 5-second hit rates;
  - fake-door interest;
  - attention above the fold;
  - researcher tags.
- **Usability tasks** and **In their words**: a table of the tasks, then quotes from researcher notes and comments.

The report is made by fixed rules, not an AI model. The same data always gives the same report, and small samples are flagged. You can copy it as Markdown, download it as .md, or print it and save as PDF. **Add sample research data** fills every tool with clearly marked demo data, so the report can be shown without running a study; it is removed again with one click (all its ids start with `demo-`).

### Insight repository
`#/console/repo`. Findings worth keeping, from the report, the design system check, or added by hand:
- **What's kept:** each insight has impact, status (New, Being worked on, Done, Won't act), tags, evidence, and the screen and element it is about.
- **Finding them:** search, and filter by status, impact, source or tag.
- **Using them:** "Show on screen" opens the screen with the element outlined, and export writes Markdown. Insights are stored in `market.repo`.

### Design system check
`#/console/dscheck`. Opens each marketplace screen in a hidden frame, reads the computed styles of every visible element, and flags:
- colours (text, background, border) that aren't tokens;
- corner radii that aren't tokens;
- fonts that aren't tokens;
- font sizes off the type scale (editable);
- inline styles that set these by hand.

Inherited properties are judged only where they're set. Each off-token value comes with how often it's used, on which screens, the closest token, an example, "Show on screen" and "Keep in repository". The results also give a consistency score overall and per screen. If a design variant is applied in this browser, that variant is what gets checked.

### Narration (voice walkthroughs)
`#/console/narration`, and the microphone button in the dock. Press it and explain the screens out loud while you go through the app.
- **While recording:** a bar at the top shows the time, a level meter, the current screen and **Stop**. Leaving the page asks first.
- **Chapters:** each screen you visit becomes a chapter. Screens passed through in under 1.2 s are folded into the next one.
- **Playing back:**
  - **Walkthroughs** plays a recording with its chapters, and the screen beside it follows the narration.
  - **By screen** lists every explanation recorded for each screen.
  - On any screen that has one, the dock shows **▶ Explain** to play it there.
- **Managing recordings:** download the audio, rename, delete.

### Comments
- **Voice notes:** a comment can be a voice note as well as (or instead of) text: **Record voice note** in its card, with a live level meter. The list marks it with 🎙 and its length. The .txt export notes the voice note's length, but the audio stays in the browser that recorded it.
- **How to comment** (works on every screen, the research pages included): press **Comment** in the dock (or press **C**, or click the round comment button), then click **anywhere** on the screen — the comment is placed on that spot, not tied to an element. Type, then Close.
- **All comments** (the speech-bubbles icon in the dock, or ⋯ beside the comment button) lists every comment with its page; choosing one goes to that page, scrolls to the spot and opens it. No replies or statuses: a comment is a note on a spot.
- Comments made with the earlier element-pinned version still load and still follow their element.
- The `.txt` export is human-readable and lossless. Importing merges notes by id, and the file wins.

### Voice privacy
The microphone starts only when someone presses a record button, and a visible indicator shows while it is on. Audio is kept in this browser's IndexedDB (`market-voice`). Nothing is uploaded or transcribed.

### Storage and sync
This project ships **no backend**. By default both tools are *local only* and keep their data in this browser (`market.insights.clicks`, newest 3,000 events; `market.reviewPins`). The UI says which mode it is in.

To share data between browsers, build with `VITE_TOOLS_API=/api` and provide two endpoints that follow this contract:

| Endpoint | Calls |
|---|---|
| `/api/clicks` | `GET → { configured, scope, events }` · `POST { events } (≤ 200) → { configured, scope, stored }` · `POST { clear: true }` |
| `/api/review-pins` | `GET → { configured, scope, annotations }` · `POST { annotations }` replaces the whole set (≤ 500 notes, text ≤ 4,000 chars). Last write wins. |

Rules for those endpoints:
- When their key-value store is missing they must answer HTTP 200 `{ configured: false }`. The client then falls back to localStorage, so you never get an error screen.
- Scope keys per deployment: production uses the bare key; every other deployment appends its branch. Return that key as `scope`.
- Validate every POST.
- Send `Cache-Control: no-store`.
- **The endpoints are unauthenticated.** Anyone who can reach them can read or clear the data. That is acceptable only because they store nothing personal.

## Installable skill: ux-research-kit

The research tools are also packaged as a Claude Code skill for other projects, in `plugins/ux-research-kit/`: framework-agnostic TypeScript modules (tracking and sessions, heatmaps and replay, 5-second tests, fake doors, eye tracking, design tokens and UI-library palettes), specs per module, the privacy rules, and a verification checklist. Claude copies what a project needs, wires it to its router, and builds the console screens in that project's own components.

```
/plugin marketplace add sandmanz26/whatvibecodingcando
/plugin install ux-research-kit@whatvibecodingcando
```

Or copy `plugins/ux-research-kit/skills/ux-research-kit/` into `~/.claude/skills/`. The modules were checked in a separate vanilla TypeScript app (strict typecheck, build, and a browser run of every module).
