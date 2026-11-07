# Vibe Collab (SaaS app)

The hosted product: website (`#/landingpage`, the default page), sign-up, user panel (`#/app`), install page and the installable script, plus every research tool built for the content site (dock, research console, heatmaps and eye tracking, sessions, compare reviews, design tokens, inspect, versions). It starts as a copy of `apps/content`; from here it grows on its own (backend, accounts and a database come later).

Shared code lives in `packages/core` (the script's widget and storage interface, the heatmap renderer, the eye-movement analysis), so fixes there reach both apps. Everything else is this app's own copy.

Run: `npm run dev:saas` · build: `npm run build:saas` (output `dist/saas`, served at `/saas/` on the shared Vercel deployment).

The rest of this file is the content app's documentation as it was when the SaaS app was copied from it; it describes the same features.

---

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

Research tools are not part of the marketplace: click tracking and sessions, heatmaps, usability tests, 5-second tests, fake doors, eye tracking, comments, design tokens and more. They live in the floating **research dock** and in the **Research console** (`#/console/*`, its own layout with "Back to the shop"); the product's navigation never links to them.

### The dock
The dock is the set of tools shown to visitors. From left to right:
- **Comment** and **All comments**. The round floating comment button is hidden because it did the same thing.
- **Version** (`v2.0`): switches the shop between its releases. Each release turns product features on. Versions are in `src/lib/version.ts`; the product reads features, never version numbers.
  - **v1.0:** launch.
  - **v1.1:** an Add to cart row on every product card. A product with sizes or colours opens its page instead.
  - **v1.2:** a countdown to the end of today's deals on Home, and a sticky buy bar on product pages that asks for a missing size before adding.
  - **v2.0:** a redesigned Home (a dark band with one big AI search and ready-made requests) and "Pick up where you left off".
  - **What changed:** after a switch, the version's features are outlined and labelled "New in v…" for a few seconds. "Outline what each version added" keeps the outlines on.
  - **Comments belong to a version.** Each comment records the version it was made on. Pins, numbers and the list show the current version; "Show every version" lists all, tagged. Opening one from another version switches to it.
    - A comment being written is discarded, with a message, when the version changes.
    - Comments from before versions existed count as v2.0.
  - **Counts.** The dock's comments button shows how many comments the current version has, and the menu shows the count for each version.
- **Compare components**: opens the compare page.
- **Design tokens** (live, without leaving the page):
  - switch between the app's own look, the UI-library looks and saved sets;
  - tweak primary, accent and corner radius;
  - or open **Use your own tokens**: a template with the app's token names and values, where valid edits apply as you type. It can be downloaded, a .json or .css file can be uploaded, and the result saved as a set for Compare.
  - Opening the template changes nothing until it is edited.
- **Inspect** (or **I**): hover anything to see its font, size, weight, text and background colour (the background a person actually sees, even when it comes from a parent), border, radius and padding.
  - Each value is marked as a design token or "not a token" with the nearest one, to check what a vibe-coded screen really uses.
  - Click pins an element; the click never reaches the app. Esc unpins, Esc again stops.
  - It reads computed styles only, never field values.
- **Sessions**: one person's path, step by step (`#/console/sessions`; `#/console/insights` redirects there).
- **Heatmap** (`#/console/heatmap`): a density heatmap for **usability testing**.
  - **What it shows.** Pick a test and a task to see where participants clicked while doing it, added up over the screen.
  - **Views.** **First clicks** is the main view, because a first click on the right path predicts success; **All clicks** is the other. You can also show only the participants who succeeded, or only those who didn't.
  - **Target.** The task's target is outlined. The ranking marks each element ✓ or ✗ against the target, and the header gives the share of clicks on it, next to the task's participants, success rate, median time and first-click accuracy.
  - **From test results.** Each task in Usability tests has **Open heatmap**. The heatmap's URL uses `ut`/`utask`, because `?test=` starts a participant's run.
  - **Everyday browsing** is a second source: recorded visits, with rage and dead taps.
  - **How it is drawn.** Every click is a soft blob. Blobs add up and are coloured blue → red, and the densest spot reaches red. Each click is placed on the element it hit, on the whole page at one device width, with the fold marked.
  - **Sample data.** With nothing recorded for that task, screen and width, it shows clearly labelled sample data: 12 made-up participants clicking the screen's real controls, more often toward the goal. No statistics are invented for it.

- **Recording from the Heatmap page.** **Record a run here** (or **Record browsing here**) opens the shop in a panel on the same page.
  - **A run.** You do the selected task at the top of the panel, optionally with webcam eye tracking. Clicks (where and on what, never typed text) and the pages visited are recorded exactly as the participant runner does, with the same success, timeout and give-up rules.
  - **When it ends.** The run is saved as a participant result and the heatmap shows it; cancelling saves nothing.
  - **Eye tracking in the panel.** Gaze is mapped from the window onto the framed page, and clicks inside the frame are forwarded to keep the calibration accurate.
  - **Browsing.** Clicks are saved as an everyday session, with what each click did (navigated, changed the screen, or nothing).
  - **Editing tasks.** **Change task** and **New task** edit tasks in place: prompt, start page, time limit, and success as reaching a page or clicking an element picked on the real screen.
  - **Page tabs.** Every page a task touched has a tab, in the order people went, with its click and gaze counts. "First clicks" are the first click on each page, so later pages of a task have a first-click map too.
  - **Other widths.** When a page has data only at another width, the page says so and switches to it.
- **Eyes** (on the Heatmap, the **Eyes** layer): webcam eye tracking read as eye movement, per usability task.
  - **In a test.** With **Eye tracking (webcam)** on in a test, participants are asked before the first task to turn on the camera and calibrate (13 dots, then 5 to measure accuracy in px). Saying no, a camera error, or a poor calibration lets them go on without it. Every gaze sample is tagged with the participant's run, the task and the ms since it started.
  - **Reading the eyes.**
    - MediaPipe Face Landmarker, in the browser, gives where each iris sits in its eye, how open the eyes are, and the head's pose.
    - A ridge regression maps those to the screen. It is refitted with every click while recording, since people look at what they click, so it follows head movement.
    - About 30 samples a second; blinks (eye openness well below the calibration average) are dropped; a One-Euro filter smooths fixations without smearing saccades.
  - **Pattern of movement** (`src/tools/gaze/analysis.ts`):
    - **Fixations** come from I-DT (dispersion threshold, scaled to the measured accuracy, min 100 ms). Adjacent fixations are merged, and a fixation is extended back over samples skipped while it settled.
    - **Saccades** are the jumps between fixations (amplitude, duration, angle).
  - **What it shows.**
    - An **attention heatmap** weighted by fixation duration.
    - The **scanpath** of each person (numbered fixations sized by duration, joined in order), with play and a time slider.
    - **Areas of interest:** the task's target, then the screen's main parts. For each: the share of people who looked, time to first fixation (median from the start of the task), and dwell.
    - For the target: how many looked at it, and how many looked at it yet clicked something else first.
  - **Accuracy.** Webcam tracking is good to about ±100–200 px, so read fixations as areas. The page shows the median accuracy.
  - **Sample data.** With no eye data for that task, screen and width it shows sample gaze: raw webcam-like samples run through the same algorithm, clearly labelled.
  - **Tests.** The algorithms are checked against known fixations (positions within 15 px; durations within a sample or two in 7 of 8 random noise runs).

### Starting from the shop, reviewing on their own pages
Tests and reviews are started from the dock on the shop's own pages. Results live on their own pages: the Heatmap, Sessions and Compare result pages are what a hosted product would show.

- **Heatmap test** (dock, flame):
  - **Starting.** Choose a task (or **Change task** / **New task**, editing in place), optionally a name and webcam eye tracking, then **Start the task here**. The task runs on the page you're on, with the same runner participants get, minus the intro. The dock steps aside meanwhile.
  - **When it ends.** **Run saved** offers **Run again** and **See this run**.
- **Heatmap results** (`#/console/heatmap`):
  - **The list.** It starts as a list of every run, grouped by task: who, when, result, time, clicks and the pages in order, with an eye icon when gaze was recorded.
  - **Managing runs.** Search and filter by result, rename a run, delete one, several (checkboxes) or all runs of a task (their gaze goes too), and export CSV.
  - **Opening runs.** **View** opens one run alone; **All runs as a heatmap** opens the task's combined map (`#/console/heatmap/view`). Everyday browsing has its own entry.
- **Sessions** (dock, pointer): switch recording on or off and end the current session from where you are. `#/console/sessions` shows the results, now with a per-session delete.
- **Compare** (dock): the badge counts comparisons waiting for a review.
  - **Submitting.** **New**, write what the reviewer should decide, then **Pick on the page** for A and B. Hovering outlines elements and a click picks (never presses). **Wider** and **Narrower** adjust the pick, and **Navigate** lets you reach another page first. Then **Send for review**.
  - **Reviewing.** The review opens over the page: both components cropped from the live screens and the style table. **Annotate** pins numbered notes anywhere on A or B. Then a decision (Keep A, Keep B, both are fine, both need changes) with an optional summary.
  - **After the review.** The submitter sees the decision and the notes, and after changing things can **Ask for another review**. That starts a new round, keeps the earlier decision in the history, and puts it back in the count.
  - **Console.** `#/console/compare` lists every comparison with its status and opens the same review.
  - **Names.** Annotations and decisions are signed with the comments name.

The research console's tools are in a grouped sidebar (Behaviour, Tests, Design, Findings, Use it yourself); on a phone it opens from the top bar.

Hidden for now: narration (the microphone and ▶ Explain), the theme switch, and the Prompts and console buttons. Those pages are reached by URL (`#/console/narration`, `#/console/prompts`, `#/console/…`).

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

**Upload & compare** (`#/console/design/compare`, from the Design tokens page).
- **Upload.** Upload or drop token files: W3C design tokens, Tokens Studio JSON, or CSS custom properties. Two sample files are included.
  - Aliases (`{color.brand.500}`) and `var(--x)` references inside a file are resolved.
  - A `dark` set, group or selector becomes the dark-mode value.
  - Composite tokens (typography and similar), unresolved aliases and unsafe values are skipped and counted.
- **Mapping.** A file's names rarely match the app's, so each set keeps a mapping from the app's tokens to the file's.
  - It is filled in by name on upload, and only tokens of the same kind can match.
  - It is editable in **Map tokens**. An upload that matches nothing opens it straight away.
- **Compare.** Choose any two looks (the app's own, the UI-library looks, or uploaded sets). You get:
  - both on the same screen and device, side by side;
  - a WCAG contrast check for the main text and background pairs in light and dark;
  - a table of every token value that differs.
- **Apply.** **Use in this browser** applies either look.
- **Storage.** Sets are stored in `market.tokenSets` (this browser only, 2 MB per file, up to 3,000 tokens).

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
`#/console/narration` (the dock's microphone is hidden for now; recording starts from this page). Press it and explain the screens out loud while you go through the app.
- **While recording:** a bar at the top shows the time, a level meter, the current screen and **Stop**. Leaving the page asks first.
- **Chapters:** each screen you visit becomes a chapter. Screens passed through in under 1.2 s are folded into the next one.
- **Playing back:**
  - **Walkthroughs** plays a recording with its chapters, and the screen beside it follows the narration.
  - **By screen** lists every explanation recorded for each screen.
  - On any screen that has one, the dock shows **▶ Explain** to play it there.
- **Managing recordings:** download the audio, rename, delete.

### Comments
- **Write:** press **Comment** in the dock (or **C**), then click **anywhere** on any screen, the research pages included.
  - **Draft first:** a *New comment* card opens with just the comment box, an optional **voice note**, **Cancel** and **Post**. A draft isn't saved, numbered or given a status, and it has no replies.
  - **Cancel or Esc:** throws the draft away, voice note included.
  - **A draft with content:** must be posted or cancelled before starting another comment or opening another. Leaving the page discards it and says so.
- **Posted comment:** **Post** saves it as **Open** and shows it as a message. Only then do replies and **Set as completed** appear. Its author can **Edit** the text: **Save** marks it *edited*, **Cancel** changes nothing.
- **Reply:** every posted comment has a thread, and a reply can be text, a voice note, or both. Replies show author and time, and you can delete your own while the comment is still open.
- **Status:**
  - A comment is **Open** until someone replies, then **Ongoing**, until someone presses **Set as completed**.
  - A completed comment shows who completed it and when. Its thread is locked (no new replies, no edits, no deleting replies), and it can be **Reopen**ed.
  - Pins on the screen are coloured by status: orange open, blue ongoing, green with a check for completed.
- **All comments:** lists everything with its page, status, author and reply count. Filter with **All / Open / Ongoing / Completed**, each with its count. Choosing one goes to that page, scrolls to the spot and opens it.
- **Commenting as:** comments and replies are signed with a name set in the list, kept per browser, so reviewers sharing a .txt can tell each other apart.
- **The .txt export** is lossless for text, replies, status and who completed what. Voice notes are listed with their length, but the audio stays in the browser that recorded it.

### Component review (A vs B)
`#/console/compare` puts two components from the app side by side, so a reviewer can compare them and keep notes.

1. **New review.** This is a draft, not saved yet. Pick component A and component B.
2. **Picker.** It shows the real screen at mobile, tablet or desktop width, with quick links to the main screens and Navigate mode for others.
   - A click selects the nearest control. **Wider** and **Narrower** step out to the element around it or back in to the part clicked, so a whole card can be chosen.
   - **Use as A/B** confirms. Cancel or Esc keeps the earlier choice.
3. **Snapshot.** On Use, the component's rendered styles are saved. These are size, font, colours, border, radius, padding and shadow, with the design token named when one matches. The page, device, a selector and a short name are saved too.
   - A search query is kept only for the preset demo screen, never one somebody typed. No field values are saved.
4. **Save.** It needs both components, and they can't be the same component on the same screen and device. The same component on two devices is allowed. Cancel with changes asks before discarding.
5. **Saved review.**
   - Each component is shown cropped from the live screen, in a non-clickable frame. If it can't be found (for example, it needs an open menu first), the page says so.
   - A style table highlights what differs.
6. **Notes.** Notes are added to a saved review and saved straight away.
   - Each note is about A, B or both, filtered by those with counts. It shows the author's name (shared with Comments) and time. Authors delete their own.
   - **Edit** renames or replaces a component. A note written before its component was replaced is marked as about the earlier one.

Stored in `market.compare` (this browser only).

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

## Prompts for visitors

`#/console/prompts` ("Prompts" in the console bar) lists every research tool as a prompt a visitor can paste into their own Claude, ideally Claude Code in their project.

- **Personalised:** pick a framework (React, Next.js, Vue, Svelte, plain JS, not sure) and routing (hash, normal URLs, not sure). Every prompt updates. The choice is remembered in `market.prompts.ctx`.
- **Two modes:**
  - **Full prompts** (default, nothing to install) spell out each tool's states, cancel and edge paths, and privacy rules (never record typed text or field values), plus the ground rules and verification steps. The ground rules are: read the project and show a plan first, keep research tools apart from the product, and stay frontend-only. The verification steps are: typecheck, build, and a browser test of the cancel paths, then report what wasn't tested.
  - **Skill mode** gives short prompts that lean on the ux-research-kit skill (below) and shows the install commands.
- Each card has **Copy prompt**, **Show prompt**, and **Try it here** (opens the tool in this demo). **Download all (.md)** saves every prompt in one file.
- The prompts live in `src/tools/prompts/catalog.ts`. When a tool's behaviour changes, update its prompt too.

## Installable script: collaboration on any website (SaaS, version 0.1)

The first step towards a hosted product: one script tag adds comments to any site, whatever it is built with.

```html
<script src="https://YOUR-HOST/embed/vibe.js" data-project="my-app" defer></script>
```

- **Install page.** `#/console/install` builds the snippet: project, button position, the C shortcut and the accent colour.
- **Demo.** `embed-demo.html` is a plain HTML site (its own CSS and a tiny hash router) with the script installed.
- **Behaviour.** It is the same flow as the comments in this app:
  - Comment (or C, ignored while typing) and click. A placing click never reaches the site.
  - A draft is not saved until Post, and a draft with text must be posted or cancelled before anything else. Changing page discards it and says so.
  - Replies make a comment Ongoing; Set as completed locks it until Reopen. Authors edit and delete their own.
  - A list shows this page or all pages, filtered by Open, Ongoing and Completed. A comment on another page opens there.
- **Pins stick to elements.** A pin is anchored to its element by a selector and its position on it, so it follows layout changes and scrolling. If the element is gone, the pin shows where it was, dashed, and says so.
- **Pages.** A page is the path plus a hash route (`#/pricing`). Queries are left out.
- **Isolation.** The UI lives in a shadow root, so the site's CSS can't reach it. Installing twice keeps the first, and the script never reads the site's field values.
- **Build.** `npm run build` also builds `dist/embed/vibe.js` (`vite.embed.config.ts`, one IIFE file with React inside, about 77 kB gzipped).
- **Storage.** Code is in `src/embed/`. For now there is `LocalBackend` (localStorage per project), so teammates don't see each other's comments yet. The widget only talks to a `Backend` interface (`list`, `upsert` one thread, `remove` one, `subscribe` to changes elsewhere). A shared database needs only a new implementation of that interface, plus decisions on accounts, project keys and allowed domains.

## Website and user panel for the hosted product

- **`#/landingpage`** is the product's website (working name in `src/saas/products.ts` → `BRAND`).
  - Visitors pick the tools they want from a catalogue of 12 products, filtered by category, with a running "Your stack" summary.
  - Each product says honestly where it works today: **On your site today** (in the script) or **Early access** (built and usable in the demo console).
  - It also has how it works, a live demo of the script in an iframe, beta pricing and FAQ.
  - The picks carry into sign-up.
- **`#/app/signup`** has three steps: tools, project, you.
  - Nothing is saved until the last step, Back keeps what was entered, and each step validates.
  - There is no password, because there is no server: the page says the account lives in this browser.
- **`#/app`** is the user panel:
  - **Overview:** a setup checklist and comment counts.
  - **Products:** turn tools on or off per project; early-access ones count as requested.
  - **Install:** the project's snippet with `data-products`, widget options, and where to paste it (HTML, Vite, Next.js, CMS, or a prompt for Claude). It warns when the snippet changed since it was last copied.
  - **Comments:** an inbox with filters, search, complete, reopen, delete and "open on site".
  - **Team:** invites, kept as pending because no emails are sent yet.
  - **Settings:** account, project, allowed domains, and deleting a project or the workspace by typing to confirm.
  - Several projects are supported; a project id is fixed once created because the snippet and comments use it.
- **Inbox without a backend.** The inbox reads comments through the script's `Backend` interface, so it shows those saved on this domain. Open `embed-demo.html?project=<id>` (the panel links to it) to see comments arrive in the panel.
- **Code and storage.** Data is in `vibe.saas` (localStorage) and the code in `src/saas/` and `src/pages/saas/`. The research dock and tools are not mounted on these pages.

## Installable skill: ux-research-kit

The research tools are also packaged as a Claude Code skill for other projects, in `plugins/ux-research-kit/`: framework-agnostic TypeScript modules (tracking and sessions, heatmaps and replay, 5-second tests, fake doors, eye tracking, design tokens and UI-library palettes), specs per module, the privacy rules, and a verification checklist. Claude copies what a project needs, wires it to its router, and builds the console screens in that project's own components.

```
/plugin marketplace add sandmanz26/whatvibecodingcando
/plugin install ux-research-kit@whatvibecodingcando
```

Or copy `plugins/ux-research-kit/skills/ux-research-kit/` into `~/.claude/skills/`. The modules were checked in a separate vanilla TypeScript app (strict typecheck, build, and a browser run of every module).
