# Skillhouse

A front-end-only React app for **keeping a company's Claude skills tidy**. Teams lean on skills with very different intensity in their AI workflows; Skillhouse shows which skills exist, which teams and projects run them, which could be shared, and where things are getting messy (duplicates, edited copies, version drift, skills nobody owns).

No backend. The data is sample data (`src/data/seed.ts`). In a real deployment the inventory would come from reading each repository's `.claude/skills/` folder and the runs from Claude Code usage logs; nothing in the app edits skills, because skills live in git and a fix is a change in the repository.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/ (hash routing, works on any static host)
```

## What's inside

| Page | Question it answers |
|---|---|
| Overview | How much does each team use skills (runs per person per week)? What to fix first? Who uses what (skills × teams matrix)? |
| Skills | Every skill: owning team and owner, which teams run it, how many projects, how many versions, edited copies, findings |
| Skill detail | Where it runs (project, version, runs), runs by team, similar skills, SKILL.md, versions and which projects are on each |
| Projects | Each repository, its team, what it has installed and what it borrows from other teams |
| Teams | Intensity compared across teams; per team: what they run, borrow, own and lend out |
| Health | Findings with a suggested action: duplicates, edited copies, no owner, external skills, retired-but-installed, version drift, unused installs. "Leave as is" sets one aside (stored in this browser). |

Duplicates are found by comparing what skills say they do (description and trigger phrases, word overlap ≥ 30%).

## Stack

React 19 · TypeScript · Vite · React Router (hash) · lucide-react · hand-rolled SVG charts · plain CSS with light/dark tokens.

```
src/
  data/      sample inventory: teams, people, projects, skills, installs with weekly runs
  lib/       usage maths, overlap detection, health findings, formatting
  store/     read-only inventory + findings set aside, persisted to localStorage
  components/ layouts, command palette, charts, UI primitives, research dock
  pages/     one file per screen (research console pages included)
  v2/        the second design of the same product
  tools/     research tools
```

## Research tools (kept apart from the product)

Research tools are not part of Skillhouse: click tracking and sessions, heatmaps, usability tests, comments, the v1/v2 version switcher and the dark/light theme. They live in the floating **research dock** and in the **Research console** (`#/console/*`, its own layout with "Back to Skillhouse"); the product's navigation never links to them.

Two of them sit *around* the product (not features of it). Each has its own flag and neither changes how the app behaves. Click recording pauses on the research console (`/console/*`); comments work on every screen. Each marks its own DOM (`data-insights-ignore`, `data-review-pins`) so neither records nor reacts to the other.

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
- **How to comment** (works on every screen, v1, v2 and the research pages): press **Comment** in the dock (or press **C**, or click the round comment button), then click **anywhere** on the screen — the comment is placed on that spot, not tied to an element. Type, then Close.
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

A second design of the same product, made with [taste-skill](https://github.com/Leonxlnx/taste-skill) (`draw.mjs --app`, style **editorial-greeting**, seed 1825630831; the sheet is saved in `.taste-skill/direction.json`):

- **Home**: a typeset greeting with today's one fact ("Three jobs have two skills each"), four counts, the busiest team's shelf, what to tidy first, how hard each team leans on skills, and the most widely shared skills.
- **Shelves**: one shelf per team, on one scale. Each book is a skill the team has installed; height is that team's runs in four weeks. The team's own skills stand, borrowed ones lean, unused or retired ones gather dust, teal marks something to tidy.
- **Projects**, **Skill page** and **Tidy up** carry the same information as v1 in this style.

The style's tokens are Instrument Sans with Instrument Serif for the greeting only, one teal on data, and tonal panels with no shadows. It lives in `src/v2/`. The classic UI stays at `#/`.

## External skills

Skills from outside (Anthropic's [skills repository](https://github.com/anthropics/skills), or a community repo such as [taste-skill](https://github.com/Leonxlnx/taste-skill)) appear in the inventory with their source and licence. Health flags the ones without a security review, and the ones where upstream has a newer version than ours.
