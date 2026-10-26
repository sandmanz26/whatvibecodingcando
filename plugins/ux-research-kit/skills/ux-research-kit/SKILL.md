---
name: ux-research-kit
description: Add UX research tooling to an existing web frontend — click tracking with sessions and exact tap replay, click and gaze heatmaps, 5-second (first-click) tests, fake door tests, webcam eye tracking, on-screen comments, and a design-token / UI-library look simulator — plus a research console to read the results. Use when asked to add heatmaps, session recording, click tracking, first-click or 5-second tests, fake doors, eye tracking, design token previews, or to try a Material / Ant / shadcn / Bootstrap look on an app. Frontend only; works with any framework.
---

# UX research kit

Framework-agnostic TypeScript modules in `templates/core/`, plus specs in `reference/`. You copy the modules a project needs, wire them to its router, and build the research console screens in the project's own UI components.

**Keep research tools apart from the product.** They live in their own folder, their own routes (a "research console"), and their own floating controls. The product's navigation never links to them.

## Privacy rules (non-negotiable)

Read `reference/privacy.md` before writing any code. In short:
- **Typed text:** never record it, nor field values, names, emails or page content. For a field, keep only its placeholder, name or type.
- **Identity:** session ids are random, per tab, and not linked to a person.
- **Click tracking default:** OFF outside development until the product owner decides on consent. Don't change this default silently.
- **Eye tracking:** the camera only starts after explicit consent. Video never leaves the browser and is never stored; only gaze points are kept.
- **Fake doors:** count only "seen" and "clicked" per anonymous tab.

## Modules

| Module | File(s) | Spec |
|---|---|---|
| Config, routing, storage, flags | `config.ts`, `storage.ts` (always) | — |
| Click tracking + sessions | `tracker.ts`, `sessions.ts` | `reference/tracking.md` |
| Heatmaps and tap replay | `heatmap.ts` | `reference/heatmap.md` |
| 5-second tests | `five-second.ts` | `reference/five-second.md` |
| Fake doors | `fake-doors.ts` | `reference/fake-doors.md` |
| Eye tracking (webcam) | `gaze-engine.ts`, `gaze-runner.ts` | `reference/eye-tracking.md` |
| Design tokens + UI-library looks | `design-tokens.ts`, `ui-presets.ts` | `reference/design-tokens.md`, `reference/ui-presets.md` |
| One-call install | `index.ts` | — |
| Comments, usability tests | (generate) | `reference/comments.md`, `reference/usability-tests.md` |
| Research console screens | (generate) | `reference/console.md` |

## Workflow

1. **Read the project first.** Check:
   - the framework and router: hash routing or history routing, and where route changes can be observed;
   - where the CSS variables (design tokens) are defined and how dark mode is marked;
   - the component library or class names used;
   - the package manager, and the typecheck, lint and build commands.
2. **Agree on scope.** If the user didn't name modules, propose the smallest set that answers their research question, and say which data each one records.
3. **Copy the modules.** Put `templates/core/` files into the project, e.g. `src/research/`. Always include `config.ts` and `storage.ts`. Delete modules that aren't used, and remove their lines from `index.ts`. Keep the comments at the top of each file: they carry the privacy rules.
4. **Configure.** Call `installResearch({ app, mainPages, ...hashRouting() | ...historyRouting() }, { tracking, heatmap, fakeDoors, fiveSecond, design, gaze })` once at startup:
   - `app` is a short storage prefix.
   - `mainPages` lists where a session starts counting.
   - Set `paused: () => isResearchRoute(path)` so the console itself is never recorded.
   - Add `ignore` if the project's own overlays need excluding. Mark every research UI element with `data-research-ui`.
   - Framework notes:
     - React/Vue/Svelte: call it in the root component's mount effect and return `stop` from cleanup.
     - SSR frameworks (Next, Nuxt, SvelteKit): client-only, behind a dynamic import or `onMount`.
5. **Eye tracking only:**
   - Install the runtime: `npm i -E @mediapipe/tasks-vision@1.1.0`.
   - With Vite, bundle the WASM through `?url` imports (see the top of `gaze-engine.ts`) rather than the CDN.
6. **Design tokens only:**
   - Set `THEME_ATTR` and `EXTRA_SCOPES` in `design-tokens.ts` to match the project.
   - Map `ui-presets.ts` roles to the project's CSS variables.
   - Write component rules for each look against the project's real components, following `reference/ui-presets.md`.
7. **Build the research console** in the project's own UI. Follow `reference/console.md`: one screen per module, a floating research dock, and an iframe screen viewer for heatmaps, replay and previews.
8. **Verify before saying it works:**
   - Run the project's typecheck and build.
   - Drive a browser (Playwright, if available) through the checklist in `reference/verify.md`: session start/end, tap replay landing on the right element, fake door counted, 5-second result saved, design applied and removed, and no console errors.
   - Report what you could not test, e.g. eye tracking with a real face.

## Gotchas

- **Replay accuracy:** replay at the participant's exact window size and with the same safe query (filters, tabs). Elements are found again by selector, and dots are drawn at `ex`/`ey` on the element, never at stale page coordinates.
- **Clickable rows and cards:** rows and cards with click handlers count as controls through `controlOf()` (pointer cursor). Prefer `data-testid` or `aria-label` on important controls, because they make selectors stable.
- **Scrolling inside iframes:** use `window.scrollTo`, never `scrollIntoView`; the latter also scrolls the parent page.
- **Webcam accuracy:** it is coarse (100–200 px). Show gaze as soft areas and always show the calibration error.
- **Storage scope:** everything is localStorage, which means one browser. For many participants, add a collector endpoint (see `reference/console.md`) and say so plainly.
