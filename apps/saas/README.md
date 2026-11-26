# ourhunch (SaaS app)

The hosted product, at `/app` (`app.html`; the website is `apps/landing`, at `/`): register, login, forgot/reset password, onboarding, user panel (`#/app`), install page and the installable script, plus every research tool built for the content site (dock, research console, heatmaps and eye tracking, sessions, compare reviews, design tokens, inspect, versions). It starts as a copy of `apps/content`; from here it grows on its own (backend, accounts and a database come later).

This is a separate system from the content site. It has its own code (including `src/core`: the script's widget and storage interface, the heatmap renderer and the eye-movement analysis), its own dependencies and its own browser data (`saas:` storage prefix, `saas:vibe:` for the script, its own voice database). Changes made here stay here.

Run: `npm run dev:saas` · build: `npm run build:saas` (output: the root of `dist`, served at `/` on the shared Vercel deployment, https://whatvibecodingcando.vercel.app/; old `/saas/…` addresses redirect there).

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
  - **The menu.** It lists the latest 3 runs (who, task, time, result). Each opens that run, and **See all** opens the results page, both in a new tab.
  - **Starting.** Choose a task (or **Change task** / **New task**, editing in place), then **Start** or **Start with eye tracking**. There are no checkboxes and no name field: runs from the dock are named Run 1, Run 2, and so on. The task runs on the page you're on, with the same runner participants get, minus the intro.
  - **While it runs.** The dock is hidden and the task bar's only action is **Stop**, so nothing else can mix into the run. A stopped run is saved as "Stopped".
  - **When it ends.** **Run saved** offers **Run again** and **See this run**.
- **Heatmap results** (`#/console/heatmap`):
  - **The list.** It starts as a list of every run, grouped by task: who, when, result, time, clicks and the pages in order, with an eye icon when gaze was recorded.
  - **Managing runs.** Search and filter by result, rename a run, delete one, several (checkboxes) or all runs of a task (their gaze goes too), and export CSV.
  - **Opening runs.** **View** opens one run alone; **All runs as a heatmap** opens the task's combined map (`#/console/heatmap/view`). Everyday browsing has its own entry.
- **Sessions** (dock, pointer):
  - **The menu.** It lists the latest 3 sessions (pages, taps, length, problems). Each opens that session (`#/console/sessions?sid=…`), and **See all** opens the list, both in a new tab.
  - **Starting.** **Start recording here** starts a session at once, on the page you're on.
  - **While it records.** The dock becomes a recording bar (● Recording session · time · **Stop**). The other tools, their shortcuts (C, I) and comment pins wait until it stops, so they can't mix into the session. Inspect switches off when recording starts.
  - **Stop.** It ends the session and switches recording off.
  - **Results.** `#/console/sessions` shows the results, with a per-session delete.
- **Compare** (dock): the badge counts comparisons waiting for a review.
  - **Submitting.** **New**, write what the reviewer should decide, then **Pick on the page** for A and B. Hovering outlines elements and a click picks (never presses). **Wider** and **Narrower** adjust the pick, and **Navigate** lets you reach another page first. Then **Send for review**.
  - **Reviewing.** The review opens over the page: both components cropped from the live screens and the style table. **Annotate** pins numbered notes anywhere on A or B. Then a decision (Keep A, Keep B, both are fine, both need changes) with an optional summary.
  - **After the review.** The submitter sees the decision and the notes, and after changing things can **Ask for another review**. That starts a new round, keeps the earlier decision in the history, and puts it back in the count.
  - **Console.** `#/console/compare` lists every comparison with its status and opens the same review.
  - **Names.** Annotations and decisions are signed with the comments name.

The research console's tools are in a grouped sidebar (Behaviour, Tests, Design, Findings, Use it yourself); on a phone it opens from the top bar.

Hidden for now: narration (the microphone and ▶ Explain), the theme switch, and the Prompts and console buttons. Those pages are reached by URL (`#/console/narration`, `#/console/prompts`, `#/console/…`).

Two of them sit *around* the product (not features of it). Each has its own flag and neither changes how the app behaves. Click recording pauses on the research console (`/console/*`); comments work on every screen. Each marks its own DOM (`data-insights-ignore`, `data-review-pins`) so neither records nor reacts to the other.

Flags are stored in localStorage (`market.flags.insights`, `market.flags.reviewPins`). Recording is off by default, in dev and production, until the owner decides on consent. It is started and stopped from the dock's **Sessions** menu. Comments are on by default.

### Click insights
- **Recorded:** screen views (with the previous screen), and taps. A tap stores its position, the control's visible name (its aria-label or own text, max 100 chars), its kind, its section, a selector to find it again, where on the element it landed, its aria state, time since the screen opened, scroll depth, rage (3+ taps within 1 s and 40 px), dead (not a control), and its effect within 0.7 s (navigated / changed / nothing), and the screen's filters and tabs (e.g. `scope=shared`; never the search box or any free text). Rows and cards the app made clickable count as controls, so a tap on a table row is recorded as that row.
- **Never recorded:** anything typed, field values, names, emails, or page content. For a field we keep only its placeholder, name or type. The session id is random, per tab (sessionStorage), and not linked to a user.
- **Sessions:** a session starts when **Start recording here** is pressed, on that page.
  - **When it ends.** When **Stop** is pressed, when the tab closes (a reload carries on), or after 30 idle minutes.
  - **After an idle end.** Recording stays on, and the next session starts when the main page (`#/`) opens.
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
`#/console/design`. Edit the app's design tokens as JSON (W3C design-token style: a token is an object with `$value`, its name is the CSS variable it sets; top-level `light` and `dark` say where it applies). The JSON starts from the app's own stylesheets. The dock's **Design tokens** popover switches looks live.

**Sample looks** (`src/tools/design/looks.ts`) are seven plain token sets, built to look clearly different from each other. Each changes only tokens: colour, contrast, corners, shadows, type and placeholders.

| Look | Character |
|---|---|
| Midnight Neon | Dark, electric teal and magenta |
| Paper Press | Editorial cream, serif, sharp corners |
| Candy Pop | Pastel pink, pill buttons, playful |
| Terminal | Green monospace on black, no corners |
| Forest Calm | Natural greens with amber, soft corners |
| Brutal Mono | Black, white and yellow, hard shadows |
| Luxe Noir | Black and gold, serif, quiet |

They also appear in **Compare sets**.

Pick a UI library look (Material 3, Ant Design, shadcn/ui, Bootstrap 5) to load its tokens and restyle the marketplace's components the way that library draws them; these imitate the look and don't load the library's code. Quick controls edit the main tokens; a live screen viewer previews any screen without saving; **Apply in this browser** puts the variant on the whole app (for example for a usability test) and the dock shows its name until it is turned off. Download/upload JSON; partial files are laid over the app's own tokens.

**Upload & compare** (`#/console/design/compare`, from the Design tokens page).
- **Upload.** Upload or drop token files: W3C design tokens, Tokens Studio JSON, or CSS custom properties. Two sample files are included: `aurora.tokens.json` (W3C with aliases, violet and teal, pill buttons, dark mode) and `retro-arcade.css` (cream, teal and orange, slab serif, hard offset shadows).
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

`#/console/prompts` ("Prompts" in the console bar) lists every research tool as a prompt a visitor can paste into their own AI coding assistant, opened in their project.

- **Personalised:** pick a framework (React, Next.js, Vue, Svelte, plain JS, not sure) and routing (hash, normal URLs, not sure). Every prompt updates. The choice is remembered in `market.prompts.ctx`.
- **Two modes:**
  - **Full prompts** (default, nothing to install) spell out each tool's states, cancel and edge paths, and privacy rules (never record typed text or field values), plus the ground rules and verification steps. The ground rules are: read the project and show a plan first, keep research tools apart from the product, and stay frontend-only. The verification steps are: typecheck, build, and a browser test of the cancel paths, then report what wasn't tested.
- Each card has **Copy prompt**, **Show prompt**, and **Try it here** (opens the tool in this demo). **Download all (.md)** saves every prompt in one file.
- The prompts live in `src/tools/prompts/catalog.ts`. When a tool's behaviour changes, update its prompt too.

## Installable script: collaboration on any website (SaaS, version 0.2)

**The install journey (what a new customer does).** Register → onboarding: tools → project and *Where will you add it?* (a local dev address such as `localhost:3000` / `127.0.0.1:5173`, with suggestions, and/or the live site; checked with `hostProblem`) → *Create project* saves them as the project's environments and publishes the widget settings (the same `publish()` as Update site), so the snippet works as soon as it is pasted → *Put it on your site*: the snippet, Copy, and three steps (① paste before `</body>`, framework tabs ② **Open my site**: the address with a one-time team token and `vibe_from=panel` ③ visitors see nothing: only the team and invited reviewers). Under it the live check (`src/pages/saas/InstallFlow.tsx`, also on Setup → Install): *Waiting for your site…* polls the install reports while the tab is visible (3 s, slowing to 20 s), then *Installed on <host>* with Open my site and *Next: invite a reviewer*; after two minutes without a report, a troubleshooting card (snippet in the page, project id, the project's addresses with an Add field, the exact CSP hosts, ad-blockers). A team member who opens the site with *Open my site* gets a one-time tip in the widget ("You're seeing ourhunch because you opened it from your panel. Visitors don't see it."), stored per project; the loader itself shows nothing to visitors.
- **Addresses the project doesn't have.** On the server, `report_seen` still ignores places outside the project, except local dev addresses (`localhost`/`127.0.0.1`, any port), which go to `install_strays` (at most 5 per project, never counted as installs, removed once the address is added and reports again; migration `20261127000000_install_flow.sql`, one-paste `supabase/catch-up/2026-11-27-install-flow.sql`, test `tests/install_flow_test.sql`). The panel shows "ourhunch saw your script on localhost:3001, which isn't in this project — Add it" (every page; the Install page in its check); one click adds the address and publishes (`addAddress()` in `src/saas/widget.ts`, on top of what is live). Each browser's first installation report is sent unsampled, so the live check sees a plain first visit.
- **Browser-only demo on another address.** Without a server the panel (say `localhost:5173`) and the customer's app (`localhost:3000`) can't share storage, so the script reaches the panel's published settings, its one-time token and the installation check through the hidden `embed/session.html` frame on its own address (`src/core/embed/demo-bridge.ts`). With a server none of that runs.

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
- **Build: a small loader and the app.** `npm run build` also builds the script in two files, both ASCII only (so host pages without a UTF-8 charset show its text correctly):
  - `dist/embed/vibe.js` (`vite.embed.config.ts`, from `src/core/embed/main.ts`, about 5 kB gzipped, no React) is what the snippet loads. It reads the project's published settings (the cached CDN file) and decides whether this browser needs the widget at all.
  - `dist/embed/vibe-app.js` (`vite.embed-app.config.ts`, from `src/core/embed/app.tsx`, about 110 kB gzipped) is the widget itself. The loader adds it from the same folder only when it's needed: a review, study or tool link in the address; a browser that is already a reviewer or is taking part in a study; a widget open to everyone; a project with no published settings; the browser-only demo build; the session frame.
  - Everyone else (most visitors, since the default audience is reviewers) downloads only the loader, which sends the sampled installation check and stops.
  - On sites that enforce Trusted Types, the loader passes the app's address through a policy named `vibe-collab`; a site with a `trusted-types` allow list has to add that name.
  - The version is in `src/core/embed/version.ts`.
- **Safe on other people's sites.** Each case was checked against a host page built to cause it.
  - **Placement.** The widget is a `<vibe-collab>` element on `<html>`, not a `div` in `body`, with its box set inline with `!important`. Host CSS (even `!important`), a `transform` on `body`, and frameworks that redraw `body` can't hide or move it, and it is put back if removed.
  - **CSS and CSP.** Its CSS is a constructed stylesheet (`adoptedStyleSheets`), so a strict `style-src` policy doesn't strip it. The host's CSP must still allow the script's own address in `script-src` (the loader and the app come from the same place).
  - **Stored data.** It is checked before use. Malformed threads, selectors over 400 characters, and page addresses that would leave the site (`//evil.com`, `@evil.com/x`) are refused, in the widget and in the panel's "open on site" link. Saving reads the data back, and survives hosts that patch `Array.prototype.toJSON` (Prototype.js).
  - **Focus traps.** A host dialog that traps the keyboard (Radix, MUI, Headless UI) can't be overridden from outside. The widget says so instead of leaving a field that ignores typing.
  - **Comment text** is rendered as text only (no `innerHTML`).
- **Storage.** Code is in `src/embed/`. For now there is `LocalBackend` (localStorage per project), so teammates don't see each other's comments yet. The widget only talks to a `Backend` interface (`list`, `upsert` one thread, `remove` one, `subscribe` to changes elsewhere). A shared database needs only a new implementation of that interface, plus decisions on accounts, project keys and allowed domains.

### Pins that survive redeploys

The script's pins find their element again after the customer's site changes (`src/core/embed/anchor.ts`).

- **Saved with every new comment** (inside the anchor JSON, as `anchor.fp`): tag, stable attributes (`data-hunch`, `data-testid`/`data-test`/`data-cy`, id unless it looks generated, `aria-label`, `name`, `role`, link path, `alt`, `title`, `type`), up to 80 characters of visible text (masked; never from form fields, editable areas or anything marked private), four ancestors (tag + stable id/role/test id + one stable class), the index among same-tag siblings, the nearest landmark or heading, and the position on the page. Generated ids and classes (React `:r1:`, hashes, CSS modules, styled-components/emotion `css-…`, Tailwind arbitrary values) are ignored. The old selector and click position stay as they were.
- **On load, on route changes and after DOM changes** (debounced, when the browser is idle, at most 400 candidates per tag): same-tag elements are scored (`data-hunch` decides alone, then test ids, id, labels, text, ancestors, sibling index, position). Three outcomes:
  - **confident** (score ≥ 0.72 and clearly ahead of the next): a normal pin;
  - **uncertain** (≥ 0.42, or two candidates tie): a dashed pin labelled **Moved?**; its card offers **Yes, this one** and **Pick element**;
  - **not found**: a grey pin at its last position, "Element changed or removed" and what it was on (button “Buy now”), with **Pick element**.
  A pin never jumps silently to a doubtful element (two buttons with the same label are told apart by ancestors, index and position, and a tie is "Moved?").
- **Saved state:** the widget reports moved/gone (and ok again) once per comment, and a confirmation or re-pick saves the new anchor, through the Backend: in the browser demo the stored thread, on the server `set_anchor` (migration `20261124000000_anchor_state.sql`; any reviewer of the project, own rate limit; the server sets the site version the state was first seen in, `anchor.st`). Comments made before this keep the old selector behaviour.
- **Panel:** Comments → **Needs re-pin** lists open comments whose pin was last seen moved or gone ("was on: button “Buy now” · not found since v2.3"); close them, or re-pin on the site (Open on site).
- **Tip for customers:** `data-hunch="name"` on important elements keeps pins 100% stable (Install page and Guide).
- **Tests:** `node apps/saas/tests/anchor.test.ts` (Node 22.18+, no dependencies) checks the pure scoring and fingerprint helpers; the database side is `supabase/tests/anchor_test.sql`.

### Widget settings (0.2)

The snippet carries only the project, so it never has to change:

```html
<script src=".../embed/vibe.js" data-project="toko-budi" defer></script>
```

Everything else is the project's **published configuration**, built in the panel (**Widget**) and read by the script when it starts. The format is in `src/core/embed/config.ts`; the panel side is in `src/saas/widget.ts`.

- **Data only.** Every field is checked, unknown fields are dropped, and an invalid configuration is refused whole (the widget then stays off).
- **Off switch.** Publishing it off hides the widget everywhere without touching the site.
- **Where (environments).** Host names or patterns (`*.example.com`, `shop-git-*.vercel.app`). Wildcards over shared hosts (`*.vercel.app`) or top-level domains are refused. The hosted demo site always works.
- **Who sees it.**
  - **Reviewers only** (the default) needs a review link: `#vibe_t=<one-time token>`, valid 2 minutes. The script trades it for an 8-hour reviewer session and removes it from the address at once. This works on page load and when the hash changes on an open page.
  - **Everyone** is for open betas.
- **Modules.** Comments today, and only while the product is on in Products.
- **Launcher.** Floating, or **your own buttons**:
  - `data-vibe="comment"` / `data-vibe="comments"` on any element;
  - `window.VibeCollab.open('comment' | 'list')` from code (calls made before the script loads can be queued in `window.VibeCollab.q`).
- **Look.** Accent colour, light or dark panels.
- **Draft, preview, publish, rollback.**
  - Edits are a draft. The builder's preview opens the demo site as a reviewer in preview mode, which shows the draft live as you edit, with a "Preview · draft" badge and Exit.
  - **Publish** makes a numbered release that sites follow without a reload. **Roll back** republishes an earlier release as a new version.
- **Older installs.** Projects that never published keep the 0.1 snippet options (`data-color`, `data-position`, `data-shortcut`, `data-products`).
- **Deleted projects** are marked gone, so their snippet shows nothing (it does not fall back to the 0.1 behaviour).
- **The script on the page.**
  - `data-disabled` loads nothing.
  - A crash inside the widget removes only the widget.
  - It says in the console why it isn't shown (off, environment, audience).
  - It reports itself for the panel's **Installation check**.
- **No server yet.** The configuration endpoint, review tokens and the installation check use this browser's storage (`saas:vibe:config:*`, `saas:vibe:handoff:*`, `saas:vibe:seen:*`). That works where the panel and the site share an origin, which is the hosted demo site. On a customer's own domain, review links and previews need the server; the panel says so.

### Products in the script (0.3)

- **Modules.** Each product that runs in the script is a module of the published settings (`SCRIPT_MODULES` in `src/core/embed/config.ts`): today Comments, Inspect, Design system check and Design tokens.
  - A module is on in a release only when its product is on for the project (Products, or the Modules switches in Widget). Publishing applies it; the snippet never changes.
  - The script drops modules it doesn't know, so an older cached script stays safe.
- **One project, one website.** Widget → *Website* is the project's site (its first environment): the host, or with *Also its subdomains* `*.example.com`, which covers `example.com` and one level below (`www.`, `blog.`), as the server matches it. Every page (path) of the site works. Settings shows the website read-only. Staging and preview addresses are optional, below it.
- **The public settings file** (`widget-config/<project>.json` on the CDN) is written by `publicConfig()`: exact site names are SHA-256 hashes keyed by the project (`hostKey`), `*.example.com` becomes `#*<hash of example.com>`, environment names and the publisher's name are left out; `*` patterns stay. The script hashes the page's host to match. The database keeps the full settings for the panel and the server's checks.
- **Research** (Heatmaps, Usability tests, 5-second tests; `src/core/embed/research.ts`, `Research.tsx`, panel `#/app/research`). Participants only:
  - A study has a participant link (`#vibe_r=<token>`, on the project's website). The person sees a consent screen first (what is recorded, what never is); nothing is recorded before "I agree". Other visitors are never recorded.
  - **One default (★) study per module** (Heatmap → "Site heatmap", Eye tracking → "Eye tracking", 5-second test → "First impression" on the page the person is on, Usability test → "Usability test" with one built-in task), made by the server when a release with the module is published and for existing projects by `20261129000000_default_studies.sql`; in the demo by `localheat.ts`. Only the ★ study gets the widget's traffic; other studies of a module are reached only through their own link; "Make default" (`make_default_study`) moves the ★, data stays with each study. Pausing the ★ stops the module's collection (visitors don't see it). The panel's Research page is organised by module (★ first, "Add another study" per module); it is the only place that makes studies.
  - **Audience "Everyone"**: every visitor sees every module that is on (`decide.ts`); a research module asks first with one line and OK / No thanks (`VisitorConsent` in `Research.tsx`, no name). After OK the run goes into the module's ★ study (`start_visitor_run`, source `visitor`). Visitors never read results: the server refuses heatmap reads and invite links to people who only joined an open widget (`reviewers.visitor`). A module that can't run here (no camera, not set up) shows with a short reason. With "Reviewers only" nothing changed. Compatibility test: `npm run test:compat` (old configs parse unchanged and decide as before).
  - Usability tests: tasks with a start page, a time limit, and done when a page is reached, an element clicked, or the participant says so. 5-second tests: a page for a few seconds, then questions. Heatmap visits: free browsing for a few minutes.
  - Recorded: clicks (page path without query, position, selector, a short label of what the element shows; a field by its tag and label only), pages opened, task outcomes and times, answers to the study's questions. Rage clicks (3 quick clicks in one spot) and clicks on nothing clickable are marked.
  - Clicks go to the server in batches; clicks a page couldn't send before the next page of the tab opened are sent by that page. A study carries on across page loads (sessionStorage).
  - Results in the panel: task success, time, first click, answers, clicks by page, each participant's path. Reviewers see the heatmap over the real page (dock → Heatmap; the panel's Heatmap button opens it).
- **Session insights** (Research → Session insights): every participant's session across studies, with where people got stuck (rage clicks and clicks on nothing clickable, by page and element) and each path.
- **Fake doors** (in a study, product *Fake doors* on): a button of ours beside an element, or an element of the page, offering a feature that doesn't exist yet. Only the study's participants see them; seeing and clicking are recorded, and a click says it is coming soon. Doors live in the study (on the server), not in the public settings file, so a roadmap isn't published.
- **Eye tracking** (a study option; product *Eye tracking* on). Participants are asked separately and can say no. The face model is a separate module (`dist/embed/gaze.js`, from `src/core/embed/gaze-entry.ts` by `vite.gaze.config.ts`, with MediaPipe's WebAssembly copied beside it in `mediapipe/`), loaded only for a participant who agreed; `vibe.js` stays small. Calibration: 13 dots, then 5 to measure accuracy (a quick second click on a dot doesn't count twice). While a task runs, five gaze points a second go to the server as `gaze` events (page coordinates and the element under the point), smoothed with a One-Euro filter; every click is also a calibration point and refits the model, so it keeps up when the head moves; with no face for three seconds the task bar says so and nothing is recorded meanwhile. Video never leaves the browser. Results show where people looked (element, seconds, people) and open the reviewer's heatmap on gaze. Tested end to end with Chromium's fake camera playing a still portrait (calibration, recording, results, heatmap); accuracy with a real moving face needs a real camera. The camera needs a secure (https) page. The heatmap tool shows clicks or where people looked. The gaze math (`src/core/gaze-model.ts`) is shared with the research console's eye tracking.
- **How heatmaps are computed** (`src/core/density.ts`, pure and tested by `node apps/saas/tests/heatmap.test.ts`; used by the script's Heatmap tool and the console's `#/console/heatmap`):
  - **Capture.** Only real clicks (`isTrusted`; programmatic clicks and the widget itself are ignored). Each click keeps page coordinates, window width, page height, the element (selector and a redacted label, never field values) and where on the element it landed, so it is redrawn on the element wherever the layout puts it; without the element it falls back to page coordinates scaled by width. Rage: 3+ clicks within 1 s and 30 px. Dead: a click on nothing clickable after which nothing on the page (DOM or address) changed within 1 s (only *whether* something changed is noted).
  - **Clean-up.** One page and one device class (desktop / tablet / mobile) at a time, never mixed. Repeats (same person, same spot, < 80 ms) dropped; at most 60 clicks per person per page, on the server (`heatmap_points`) and again in the script; each person counts the same by default. Gaze: fixations (I-DT) weighted by duration; runs calibrated worse than 220 px left out by default.
  - **Density.** A Gaussian kernel density estimate: points are binned onto a coarse grid and blurred with a separable Gaussian, so 100,000 points draw in about 0.2 s. The width starts from Silverman's rule and is kept between 0.4× and 0.6× of the precision floor (26 px for clicks; the median eye-tracking accuracy for gaze, so a webcam map is never sharper than the webcam). It is adaptive: lone points spread wider, dense clusters stay sharp (0.6–1.6×).
  - **Colour.** Inferno (perceptually even, readable in greyscale), square-root scaled, topped at the 99th-percentile density so one hot spot doesn't wash out the rest; the faintest heat is left transparent so noise isn't painted. The legend gives the top of the scale in people (or clicks) per 50 px square.
  - **Honesty.** Under 10 people the map says "Early signal". The tool lists the most clicked elements with % of people and first-click share. Limits: raw points are at most 20,000 per map (bigger studies use the server's bins of every click, below); webcam eye tracking is Labs and approximate (often 100–200 px); a click whose element no longer matches is left off the map and counted (v4).
  - **v4: right in meaning** (`src/core/heatstats.ts`, `src/core/embed/heatsummary.ts`, migration `20261126100000_heatmap_v4.sql`; screenshots in `docs/heatmap/v4/`):
    - **Exposure.** The script records which elements each participant actually saw (an element ≥ 50% visible for ≥ 500 ms, IntersectionObserver; its selector only, at most 300 watched and 150 sent per page visit) and the deepest point of each page they reached. No content, no field values. Element tables show the click rate of everyone *and* **per view** (people who clicked ÷ people who saw it), so a button below the fold isn't unfairly cold. **Adjust for how many people saw it** weights each click by 1 ÷ the share of people who scrolled that far (capped at 5×, only where at least 5 people got there). **How far people scrolled** shows the reach curve (% of people who reached each tenth of the page).
    - **Placement.** A click whose element can't be found again on this layout (or is now a different kind of element) is left off the map and counted: "N clicks couldn't be placed on this version of the page". Clicks on bare page are scaled by width. Every event carries the site's version label (as comments do); a map and its numbers show one version at a time, chosen by the reviewer, never mixed.
    - **Every click, big studies.** `study_heatmap` (panel, project members) and `heatmap_summary` (script, invited reviewer on an allowed site, rate limited) aggregate **all** of a page's events on the server: bins of 1/80 of the layout width (16 px at 1280) per device and version with counts and distinct people, per-element clicks, people, first clicks, rage, dead and exposures, and each person's deepest row. Output is bounded (20,000 bins, 400 elements). Above 20,000 clicks the script draws the map from these bins (weights = people or clicks) instead of the newest 20,000 points; smaller studies keep the raw points (which follow their elements). Binned and point density differ by about 1% (test).
    - **Confidence.** Shares carry Wilson 95% intervals ("38% ± 9"); rows seen by fewer than 5 people are greyed. **Compare with** another version runs a two-proportion z-test per element and says it in words ("likely a real difference (p = 0.012)" or "it could be chance").
    - **Eye tracking (Labs).** Samples off the page, blinks (0,0) and low-confidence samples are dropped, the rest smoothed (One-Euro) before fixations (I-DT). **Drift correction:** gaze just before a click (50–800 ms) should be on the click, so each run with at least 5 such pairs gets an offset from the median of click − gaze, refitted once without outliers (beyond 2.5× the median deviation, ≥ 60 px), applied only when it lowers the error. Each run is then drawn with its own error (residual after correction, else its calibration accuracy) as bandwidth. The tool shows "Drift-corrected … error after ≈ N px". All in the reviewer's browser; only gaze points are stored.
    - **Limits.** Exposure starts with this version of the script (older runs have none: per-view rates then fall back to clickers). The binned map can't follow elements to a new layout (it is per version and device, scaled by width). Drift correction assumes people look at what they click; it is an offset, not a full affine fit. Webcam eye tracking stays approximate.
- `/embed/*` is served with `Access-Control-Allow-Origin: *` (root `vercel.json`), so customers' pages can load the module and its files.
- **Versions, Component review, Narration** (products in the script, for reviewers, with Comments on):
  - *Versions:* Widget → Version is the site's current version; comments made after publishing carry it (set by the server). The widget's list and the panel's inbox filter by version.
  - *Component review:* the dock's A vs B button: click two elements, pick a verdict (A is better, B is better, both need work), add a note. Saved as a comment of kind `compare` with both anchors.
  - *Narration:* the dock's voice note button records up to two minutes in the reviewer's browser; it is uploaded to the project's private bucket only when posted, and played with a ten-minute signed link. Deleting the comment deletes the audio.
- **Reports & insights, Build-it prompts** are panel features (`status: 'panel'`, "In your panel"): `#/app/report` (`src/pages/saas/Report.tsx`) pulls comments and studies into ranked key findings (low task success, where people got stuck, the page with most open comments, fake door interest), with copy as Markdown, download and print; `#/app/prompts` lists the prompts to build each tool into your own code with an AI coding assistant. They show in the panel's menu when their product is on.
- **Products, grouped.** Three groups (Feedback, Research, Design QA, with one line each) on the landing page, in onboarding and in Products. Build-it prompts and teammate invites were removed (prompts taught customers to rebuild the product; invites weren't real yet). Versions is no longer a product: **Site version** is a field of the widget (shown with Comments), and the server records it on every comment whenever it is set (`…_comment_context.sql`). Session insights is **Participant paths** (what it is: study participants' paths). Eye tracking has a **Labs** badge (`labs: true`).
- **Coming soon.** A product with `soon: true` (today: Fake doors) shows a Coming soon badge on the website, in onboarding and in Products, and can't be picked, turned on or published (`releasable` drops it; the study editor and Results hide it). The script still has the fake-door code for when it ships to live traffic.
- **Reviewers page** (`#/app/reviewers`, old `#/app/team` redirects): review links and the reviewer list; in the demo, a button to try it on the demo site.
- **Comment context and AI prompts.** New comments carry `anchor.device` (browser and system names with major versions, window size, pixel ratio; from the user agent, nothing personal), shown under the comment, in the CSV and in prompts. **Copy fix prompt** (one comment) and **Copy open as AI prompt** (the open comments shown) build a prompt for an AI coding tool (`fixPrompt` in `src/saas/stats.ts`): page address, CSS selector(s), device, version and replies, without reviewers' names. The server refuses anchors that aren't a JSON object or are over 4,000 characters.
- **Pricing on the website:** Free (1 site; Comments, voice notes, A vs B and the design tools; 3 reviewers) and Pro at $4.80 a site a month with everything and unlimited reviewers (founding price $2 a site, Rp 29.000, locked for the first 200 customers; values in `PRICING`, `src/saas/products.ts`); Pro is free for everyone during the beta. Billing isn't built yet.
- **The panel's sidebar** (`src/pages/saas/Nav.tsx`) has two levels so it stays short however many tools are on: Overview; **Setup** (Products, Install, Widget, Build-it prompts); **Results**, one entry per tool that collects data and only for tools that are on (Comments, Component reviews and Voice notes are `#/app/comments?kind=…`; Usability tests, 5-second tests, Heatmaps and Eye tracking are `#/app/research?module=…` (old `?kind=` links still work); Sessions is `#/app/research?tab=sessions`; Report); then Team, Settings and the User guide. Groups fold, remember it, and open by themselves on the page you're on; on a phone they flatten into one scrolling row.
- **Updating the site, not "publishing versions".** The builder's button is **Update site**; it says whether the site is up to date, and History lists earlier settings by date with **Restore**. Release numbers still exist (the server orders and syncs by them) but the owner never sees them.
- **Seeing it on your own site.** With the default audience (reviewers only), opening the site normally shows nothing, even to its owner. **Open my site** on Install (a card that explains this) and on Overview opens the site with a review token, so the owner's browser becomes a reviewer. The installation check offers the same button when it last saw the widget hidden for that reason.
- **Deleting and downloading results.** Comments: the bin on one, or **Delete these/all** for the filtered list (with the voice notes' audio on the server); `?kind=compare|voice` filters to component reviews or voice notes. Studies: **Clear results** on a study (its runs, so its heatmap too; the study and link stay), the bin on one participant, **Participants (CSV)** and **Clicks, pages and gaze (CSV)** on its results, and the same two files for all Sessions. Settings → Data clears everything of one kind. Every CSV goes through `toCsv` in `src/saas/stats.ts`, which keeps cells starting with `= + - @` as text so they can't run as spreadsheet formulas.
- **User guide** at `#/guide` (`src/pages/saas/Guide.tsx`), public like the legal pages and linked from the website and the panel: getting started, concepts, reviewers, comments, design tools, studies, heatmaps and eye tracking, where results are, privacy, troubleshooting. Keep it in step with the product when a flow changes.
- **Heatmap quality** (`src/core/embed/heatmath.ts`, `core/heat.ts`): one device at a time (default: the reviewer's); each person counts the same (option, on); gaze turned into fixations (I-DT sized to each person's accuracy) weighted by duration, eye tracking worse than 220 px left out by default, blob size from the accuracy; the colour scale at the 95th percentile; gaze points kept relative to the element looked at. Page paths fold ids (`/product/123` → `/product/:id`) so pages of one kind share a map and ids aren't kept.
- **Reviewer sessions** live in our session frame (`/embed/session.html`, `src/core/embed/frame.ts`), loaded hidden only for reviewers. It signs up (with Turnstile CAPTCHA when `VITE_TURNSTILE_SITE_KEY` is set), keeps the refresh token on our domain, per asking site, and gives the page only the short-lived access token. Database calls still come from the page, so the server keeps checking its real Origin. Where a site's CSP blocks the frame, the page keeps the session itself, as before.
- **Who sees what.** Widget → *Who sees it* (default: reviewers only) is for Comments. The design tools are always for people who came in through a review link (or the panel's preview), even when Comments are open to every visitor.
- **Reviewer tools** (`src/core/embed/Tools.tsx`, `design.ts`): buttons in the dock beside Comments.
  - **Inspect:** hover an element to see its font, size, colours, radius and padding, and whether each is one of the page's tokens. While it is on, clicks pick elements and never press the page's buttons or follow links.
  - **Design system check:** scans the page (up to 5,000 elements) for colours, radii, font sizes and fonts that aren't tokens; click a finding to show it on the page.
  - **Design tokens:** drop a token file (W3C, Tokens Studio or CSS variables, up to 2 MB). Use it as the reference for the two tools above, or apply it to the page: only custom properties the page already defines are set, in the reviewer's tab only, removed when unticked.
  - The page's tokens are its CSS custom properties on `:root`, `html`, `body` or a theme selector, read from its same-origin stylesheets.
  - **Safety:** everything runs in the reviewer's browser and is sent nowhere. Only computed styles are read; a form field is named by its tag and label, never its value. Token values with `url()`, braces, semicolons or markup are refused.
  - With Comments off, the script doesn't ask the server for comments at all.

## Website and user panel for the hosted product

- **The website is `apps/landing`**, at the site's root. Its sign-up links carry the picked tools as `?products=` into registering, then onboarding. The old in-app website (`#/landingpage`) is gone: that address sends people to `/` (`WEBSITE` in `src/saas/products.ts`; every "Website" link and the logo use it).
- **Trying the picks before publishing.** Onboarding's *Try it on the demo site* opens `embed-demo.html?project=<id>&products=<picked>`. The project isn't published yet, so the script falls back to the snippet's own options; the demo page passes the picks as `data-products`, and the script runs exactly those modules (`app.tsx`, the `legacy` settings). On our own demo site, with picks and no published settings, the visitor is treated as the project's reviewer so the reviewers' tools (Inspect, Design system check, Design tokens, Heatmap) show too. A note on the demo page says where each pick lives: in the widget, a study started from the panel (Participant paths, Usability tests, 5-second tests, Eye tracking), the panel (Reports), or needing the server (Narration's voice notes). Once published, the demo follows the project's settings (Products → Update site).
- **Product previews.** Hovering or focusing a product card (onboarding, Products) shows, after 250 ms, a popover with a 5-second muted looping clip, the name and tagline; on touch screens each card has a **Preview** button that opens a bottom sheet with the clip and **Select** (Esc closes; focus stays in the sheet). With reduced motion, the poster shows instead. Nothing loads until a preview opens (`preload="none"`). Code: `src/pages/saas/ProductPreview.tsx`; files: `public/previews/<product>.{webm,mp4,jpg}` (480×300, VP9 and H.264, about 7–60 KB each). To record them again from the real product (demo site and demo console, made-up data only; eye tracking uses Chromium's fake camera and shows calibration only):
  ```
  npm run build                                  # at the root, without Supabase keys (demo mode)
  (cd dist && python3 -m http.server 4173) &
  node apps/saas/scripts/record-previews.cjs     # or: … record-previews.cjs comments inspect
  ```
  It needs Playwright with Chromium and ffmpeg. A new product needs a clip in `CLIPS` there and its id in `ProductPreview.tsx`.
- **Two download areas.** `src/App.tsx` loads `HostedApp.tsx` (website pages, sign-in, panel, share links, guide, legal) or `DemoApp.tsx` (demo shop, research console and its tools, with their CSS) by address, each as its own chunk: opening the panel doesn't download the demo, its research tools or the eye-tracking model.
- **Product analytics (PostHog)** in `src/lib/analytics.ts`, for `/app` only, never in the script (`src/core/embed`). Off unless the build has `VITE_POSTHOG_KEY` (`phc_…`; host `VITE_POSTHOG_HOST`, default US). PostHog loads after the page as its own chunk; no autocapture, session recording, surveys or flags; a first-party cookie shares the anonymous id with the website at `/`; addresses are cleaned of share tokens and sign-in codes (`cleanUrl`) before sending; signed-in accounts are identified by id only. Events: a page view per screen, `signup_completed`, `login_completed`, `onboarding_completed`, `snippet_copied`, `site_updated`, `open_my_site`, `script_detected` and `first_comment_received` (once per project), `review_link_created`, `study_created`, `comments_exported`, `fix_prompt_copied`. The privacy policy names PostHog only when it is on.
- **Email notifications.** Settings → Project → *Email me about new feedback*: when feedback arrives (grouped, at most every 5 minutes), one summary a day (08:00 WIB), or off (`projects.notify`). Server only; the demo shows the choice disabled. How they're sent and how to set them up: `supabase/README.md` → "Email notifications".
- **Large projects.** Supabase returns at most 1,000 rows a request, so long lists are read in pages (`paged()` in `src/saas/cloud.ts`): the comment inbox shows the newest 5,000 (`MAX_LIST`, with a note past it), study results and participant paths up to 20,000 events, oldest first. The panel polls every 20 seconds and only while the tab is visible; the widget gets the newest 1,000 comments (`list_threads`). Projects load only their newest 50 releases.
- **Two modes.** The build picks one (`src/saas/supabase.ts`).
  - **With a Supabase project** (`VITE_SUPABASE_URL` and the anon key, or Vercel's Supabase integration; see `supabase/README.md`), the panel uses it:
    - real accounts: register with email confirmation, login, forgot and reset password by email (`src/pages/saas/AuthCloud.tsx`);
    - one workspace per account;
    - projects, invites, drafts and releases in the database;
    - publish also writes `widget-config/<project>.json` to Storage for the script.
  - **How the cloud panel stays in sync** (`src/saas/cloud.ts`):
    - it keeps the same state shape as before, cached under `vibe.saas.cloud`;
    - every change is sent as the difference, in order;
    - a change the server refuses is shown, and the panel reloads from the server;
    - it reloads on sign-in and when the tab regains focus.
  - **Project ids** get a short random part (`toko-budi-x7k2`): they are unique across customers.
  - **The script runs on the server too** (`src/core/embed/server.ts`). When the project's settings file is on the CDN:
    - reviewers come in through review links and get an anonymous session;
    - comments go through the database functions;
    - the panel's inbox, Reviewers (Team page: invite links for clients) and installation check read the server.
  - **Projects without a settings file on the CDN** (the website's demo, 0.1 installs) keep the browser stand-in.
  - **Without one**, everything below runs as a demo in this browser.
- **Signing in, demo mode** (`src/pages/saas/Auth.tsx`, helpers in `src/saas/account.ts`). There is no server, so the account lives in this browser, one workspace per browser. Each page says so.
  - **`#/app/register`:** name, work email, password and confirmation.
    - Password: at least 8 characters, not a common one, not the email. A strength meter and show/hide are shown.
    - Storage: only a salted PBKDF2-SHA-256 hash is kept, never the password.
    - If the browser already has a workspace, the page offers Log in instead.
    - `#/app/signup` redirects here, keeping `?products=`.
  - **`#/app/onboarding`:** after registering, three steps (tools, first project, install snippet with Copy).
    - Nothing is saved until **Finish** or **Skip for now**.
    - The panel sends you back here until onboarding is done.
  - **`#/app/login`:** email (any case) and password.
    - A wrong email and a wrong password get the same message.
    - After 5 misses in a row, logging in pauses for 30 s, doubling per further miss up to 15 min. The pause survives a reload.
    - `?next=` returns you to the panel page you came from (only `/app` paths are accepted).
  - **`#/app/forgot`:** always answers "Check your email". No email is sent, so a **Demo inbox** shows the email that would arrive, with its reset link, or says that nothing would arrive.
  - **`#/app/reset?token=`:** sets a new password and logs you in. Reset links:
    - work once and expire after 30 minutes;
    - stop working when a newer link is asked for;
    - clear the login pause.
  - **Log out** is in the panel's sidebar and in Settings. **Settings → Password** changes the password (current one first).
  - **Workspaces from before login:** they stay signed in and set up. They can set a password in Settings, or through Forgot password.
- **`#/app`** is the user panel:
  - **Overview** (`src/pages/saas/Dashboard.tsx`) is the project's dashboard:
    - **Widget status** with a one-click on/off switch. It publishes a new version with only the off switch changed and keeps the draft's other edits.
    - **Numbers:** open, ongoing, completed, replies, reviewers (and active this week).
    - **Activity:** comments per day over 14 days (one series, hover tooltip, and a table for screen readers).
    - **Pages** with the most comments.
    - **Latest comments.**
    - **Sites** where the script ran.
    - **Setup checklist**, until it is done.
    - On the server, the numbers come from one `project_stats` call, counted in the database.
  - **Products:** turn tools on or off per project; early-access ones count as requested.
  - **Install:**
    - the project's snippet (script and project only) and where to paste it (HTML, Vite, Next.js, CMS, or a prompt for an AI coding assistant);
    - an **Installation check** (last seen, shown or why not);
    - developer notes: CSP, own buttons and API, `data-disabled`, environments.
  - **Widget:** the widget builder (see "Widget settings").
  - **Comments:** an inbox with filters, search, complete, reopen, delete and "open on site".
    - **CSV** download.
    - **Share list** makes a read-only link, `#/share/<token>`, that anyone can open without an account. The link can be:
      - limited to all, not completed, or completed comments;
      - set to expire after 7, 30 or 90 days, or never;
      - counted and revoked.

      The shared page (`SharePage.tsx`) groups comments by page, with replies, CSV and print. In the demo, the list travels inside the link.
  - **Rounds** (`#/app/rounds`, `src/pages/saas/Rounds.tsx`, data in `src/saas/rounds.ts`), shown under Results when **Settings → Review rounds** is on (`projects.rounds_on`, off by default; *Rounds included in your quote* 1–20 or unlimited, default 2, `projects.rounds_included`):
    - the state (No round open / Round N open / Approved), "Round N of M" or "Extra round", and **Start round N** (name, optional "What changed" note and due date; one open round at a time; a warning when it is past the included number; ourhunch never bills);
    - after starting: **Copy review link** and a ready-to-send message (reviewers are anonymous and get no email);
    - the rounds, newest first: status, dates, comments in the round (open/completed), approvals; **Close round**, **Reopen** (latest only), **Edit**;
    - **Approvals** with a printable record (`#/app/rounds/<approval id>/record`: project, site origin, round, version, approver, time with time zone, the statement confirmed, open comments at that moment);
    - Comments show a round chip and filter by round (`?round=`); the CSV has a `round` column.
    - In the widget (only with rounds on): a compact bar at the top of the window, inside the shadow root ("Round 2 of 2 · due 28 Nov", the note, **Approve this version**; collapsible, collapsed on phones). The approve dialog asks for a name and the checkbox "I've reviewed this version and approve it.", shows how many comments are still open, and says it is a record, not a legal signature. With no round open, reviewers read and reply but can't add comments; browsers the team opened with its own one-time link (`reviewers.team`) always can.
    - Server: `review_rounds` and `round_approvals` (members under row level security; reviewers only through `current_round` and `approve_round`, which check origin, reviewer and a rate limit), `threads.round_id` set by a trigger, an approval email through the outbox (`supabase/migrations/20261124100000_review_rounds.sql`, tests in `supabase/tests/rounds_test.sql`). Demo: the same in this browser (`saas:vibe:<project>:rounds`, read by the demo site's widget).
  - **Team:** invites, kept as pending because no emails are sent yet.
  - **Settings:** account, password, log out, project, **Data** (clear comments, remove all reviewers, revoke review links, clear installation reports; each after typing the project id), and deleting a project or the workspace by typing to confirm (their published settings go too, so the snippet shows nothing). Where the widget runs is set per environment in Widget.
  - Several projects are supported; a project id is fixed once created because the snippet and comments use it.
- **Inbox without a backend.** The inbox reads comments through the script's `Backend` interface, so it shows those saved on this domain. Open `embed-demo.html?project=<id>` (the panel links to it) to see comments arrive in the panel.
- **Code and storage.** Data is in `vibe.saas` (localStorage) and the code in `src/saas/` and `src/pages/saas/`. The research dock and tools are not mounted on these pages.

### Results in the panel, participation on the site

- Sidebar (`src/pages/saas/Nav.tsx`): Overview · Setup · Feedback (Comments, Component reviews, Voice notes, Rounds, Report) · Research (All studies, Usability tests, 5-second tests, Heatmaps, Eye tracking, Participant paths) · Reviewers · Settings · guide. Exactly one item is active (`activeOf`: path plus `?kind`/`?tab`/`?module`, old `?kind=eyes|browse` included; a study's results page lights *All studies*). Tools that are off are left out (Products turns them on; the Research page lists them as Off). Groups remember open/closed (`saas:nav:open`).
- Eye-tracking report (Labs): `src/saas/gaze-report.ts` (pure; uses `cleanGaze`, `smoothGaze`, `pairsOf`/`driftOf`, `fixationsOf`/`idtFor` as they are) and `src/pages/saas/GazeReport.tsx`, shown in a study's results when it has gaze. Demo: `#/app/research/sample-gaze` (labelled sample data).
- "View heatmap" from the panel opens the site with `#vibe_tool=heatmap&vibe_heat=click|gaze&vibe_study=<id>&vibe_page=<path>` (+ review token); `takeReport()` in `src/core/embed/hints.ts` reads it once (also after a redirect) and the widget opens the report at once, for the team only. The dock's Heatmap button opens `HeatmapInfo` (recording switch, invite link, take part in eye tracking, Open results in your panel), never results.

## Reusable research modules

The research tools are also packaged for other projects in `plugins/ux-research-kit/` at the repository root (outside this app): framework-agnostic TypeScript modules (tracking and sessions, heatmaps and replay, 5-second tests, fake doors, eye tracking, design tokens and UI-library palettes), specs per module, the privacy rules, and a verification checklist. That folder's README says how to add them to a project.
