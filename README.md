# Skillhouse

A front-end-only React demo of a **Claude skill management system for teams** — built to show what vibe coding can do for *management*: dashboards, approval workflows, role-based permissions, live policy checks and ROI models.

No backend. All data is fictional seed data stored in your browser (`localStorage`); use the reset button in the sidebar to start over.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/ (hash routing, works on any static host)
```

## What's inside

| Page | Management pattern it demonstrates |
|---|---|
| Overview | Executive dashboard — hours saved, adoption by team, personal action inbox, activity feed |
| Skill library | Searchable catalog with filters stored in the URL, grid / table views |
| Skill detail | Single source of truth — SKILL.md export, version history, per-team access, discussion |
| New / edit skill | Guided authoring — live quality score, trigger simulator, auto-generated SKILL.md, auto versioning |
| Review pipeline | Drag-and-drop approval workflow that enforces approvals, evals and role permissions |
| Team & access | RBAC, editable roles, team × skill access matrix, permission table |
| Governance | Policy engine re-evaluating the catalog live, one-click fixes, audit log |
| Insights | ROI what-if calculator, adoption heatmap, funnel |
| Playbook | The demo script and ideas to explore next |

Try **“Viewing as”** in the sidebar (or ⌘K → “view as”) to switch between Admin, Maintainer, Member and Viewer and watch permissions change everywhere. The **Lens** toggle shows/hides the per-page notes explaining what each screen demonstrates.

## Stack

React 19 · TypeScript · Vite · React Router (hash) · lucide-react · hand-rolled SVG charts · plain CSS with light/dark tokens.

```
src/
  data/      seed data, types, lens copy
  lib/       permissions, policy engine, quality checks, trigger matcher, formatting
  store/     React context + reducer, persisted to localStorage, toasts
  components/ layout, command palette, charts, UI primitives
  pages/     one file per screen
```

## Internal tools: click insights & review pins

Two tools that sit *around* the product (not features of it). Each has its own flag and neither changes how the app behaves. Both are switched off on the console route (`/console/*`), and each marks its own DOM (`data-insights-ignore`, `data-review-pins`) so neither records nor reacts to the other.

Flags are stored in localStorage (`skillhouse.flags.insights`, `skillhouse.flags.reviewPins`). Recording is toggled on **Sessions** (`#/console/insights`); both can be toggled from the ⌘K palette. Comments are on by default.

### Click insights
- **Recorded:** screen views (with the previous screen), and taps. A tap stores its position, the control's visible name (its aria-label or own text, max 100 chars), its kind, its section, a selector to find it again, where on the element it landed, its aria state, time since the screen opened, scroll depth, rage (3+ taps within 1 s and 40 px), dead (not a control), and its effect within 0.7 s (navigated / changed / nothing).
- **Never recorded:** anything typed, field values, names, emails, or page content. For a field we keep only its placeholder, name or type. The session id is random, per tab (sessionStorage), and not linked to a user.
- **Defaults:** on in development; **off in production builds until the product owner decides on consent** (banner / privacy policy).
- **Where to review:** `#/console/insights` (**Sessions**). Pick a session to read it **in time order**: the screens it went through, then every tap — time, element, where it sits, and what happened (opened a page, changed the screen, nothing; rage and dead taps are flagged). **Replay taps** opens each tap on the real screen with the tap drawn and the element ringed; ← → step through. Researchers can tag a session (Confused, Got lost…) and write notes, and export it as CSV. The **Heatmap** tab shows all taps on one screen at one width. Add `?heatmap` (dots) or `?heatmap=elements` to any screen URL to see it outside the console. Only taps from the same page *and* layout bucket are drawn (mobile < 640 px, tablet < 1024 px, desktop).

### Usability tests (task-based)
- Find them at `#/console/tests`. Each test has tasks. A task has a prompt, a start page, a time limit, and a success rule: *reach a page* (a trailing `*` matches any page below it) or *tap an element*. You pick the element by clicking it on the real screen.
- Share the test link (`#/<start>?test=<id>`). The participant gets an intro, then one task at a time with a timer at the bottom of the screen. They can give up at any point.
- Recorded per task: the outcome (success, timed out, gave up), time on task, taps (position and control name only), the pages visited, and whether the first click was right (it hit the target, or it moved toward the target page). The participant name is an optional nickname.
- Open a participant to see their taps for each task in order, and replay any of them on the real screen.
- Results show success rate, median time, average taps, direct success (no backtracking), first-click accuracy, the most common first clicks, and every tap drawn on the real screen (green = hit the target, red = missed).
- Results are stored in the browser where the test was taken (`skillhouse.tests`, `skillhouse.tests.sessions`).

### Comments
- **How to comment:** press **Comment** in the dock (or press **C**, or click the round comment button), then click **anywhere** on the screen — the comment is placed on that spot, not tied to an element. Type, then Close.
- **All comments** (the speech-bubbles icon in the dock, or ⋯ beside the comment button) lists every comment with its page; choosing one goes to that page, scrolls to the spot and opens it. No replies or statuses: a comment is a note on a spot.
- Comments made with the earlier element-pinned version still load and still follow their element.
- The `.txt` export is human-readable and lossless. Importing merges notes by id, and the file wins.

### Storage and sync
This project ships **no backend**. By default both tools are *local only* and keep their data in this browser (`skillhouse.insights.clicks`, newest 3,000 events; `skillhouse.reviewPins`). The UI says which mode it is in.

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

## Skillhouse v2 (`#/v2`)

A second take on the same data and store, designed with [taste-skill](https://github.com/Leonxlnx/taste-skill) (`draw.mjs --app`, style **editorial-greeting**, seed 1825630831; the sheet is saved in `.taste-skill/direction.json`). It is less of an admin panel and more of a team's home:

- **Home**: a typeset greeting that names the team and today's one fact ("Two skills are waiting on your review"), four plain counts, **the shelf**, what's waiting on you, hours saved each week, and what happened lately.
- **The shelf**: this product's own element. Every skill is a book spine. Its height is runs in the last four weeks. Books waiting for review lean at the end (outlined in teal when the next step is yours), drafts are hatched, and retired or unused skills gather dust. Hover or focus a spine for its numbers; click it to open the skill.
- **Review desk**: inbox-style triage. The waiting list sits beside the open skill, with approve, publish and send-back actions. Each action states why it is blocked for your role.
- **Skill page**: the SKILL.md set as the page Claude reads, with runs, lending, versions and conversation in a rail beside it.
- **Write a skill**: you type the skill as a document. Readiness checks, a "would it trigger?" simulator and team lending sit beside it.

The style's tokens are Instrument Sans with Instrument Serif for the greeting only, one teal on data, and tonal panels with no shadows. It lives in `src/v2/`. Checks run on all five screens at 1440, 768 and 390 px: taste-skill `lint.mjs` gives 0 FAIL and 0 WARN, and `inspect.mjs --app` gives 0 FAIL. One WARN is kept on purpose: the 48px serif greeting, which is the dealt style's move. The classic UI stays at `#/`.

## External skills

Skills can come from outside: Anthropic's [skills repository](https://github.com/anthropics/skills) or a community repo such as [taste-skill](https://github.com/Leonxlnx/taste-skill).

- Each external skill records where it comes from, its license, and the version it is **pinned** at. When upstream has a newer version, the skill shows "Update upstream".
- **Pull vX for review** turns that update into a new version that goes back through review. Until then, the team keeps running the pinned version.
- Importing (**Bring one in**, from a known source or a GitHub link) creates the skill *in review*. The rule "External skills are vetted and pinned" blocks publishing until someone other than the importer marks the security review passed.
- No backend: importing records the source and pins the version without downloading files.
