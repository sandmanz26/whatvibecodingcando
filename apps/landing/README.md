# Landing page (apps/landing)

The standalone landing page for Vibe Collab, made for the proposal. React + Vite, front end only, no backend, English only. The site's front page: served at `/` (built into `dist/landing`, whose `index.html` the root build copies to `dist/index.html`; hence `base: '/landing/'`). Links to the product are root-relative (`/app#/…`, `LINKS` in `src/content.ts`). `index.html` forwards the app's old addresses (`/#/…`, sign-in returns `?code=…`) to `/app`.

- **Run:** `npm run dev:landing` at the root, or `npm run dev` here.
- **Nothing is shared.** Own `package.json`, lockfile and `node_modules`; no imports from `apps/saas` or `apps/content`.

## The story, top to bottom

| Sheet | What the visitor learns |
|---|---|
| Start | The thesis: AI output always *looks* finished. The headline is reviewed live to show the product in five seconds. |
| The problem | Six problems, each named by the sentence people say when it happens, with what it costs. One cause: the review happens somewhere other than the product. |
| The product | The scroll film. One script tag, then five features, one layer at a time: Comments, Voice notes, Heatmaps, Copy fix prompt, Design system check. Each has a small demo drawn in code. |
| The toolbox | Every other tool the same script carries, grouped by layer (Feedback, Research, Design QA). |
| The loop | Paste, send a link, review, copy the fix as a prompt, ship again. |
| Try it | The page itself can be commented on (press C). Notes stay in memory; nothing is stored or sent. |
| The spec | Why it is safe on a real site, as facts. |
| Pricing | Free, and Pro at $2 a site; free during the beta. |

## Rules

- All copy is in `src/content.ts`. No invented customers, numbers or testimonials. A product claim must match `apps/saas/src/saas/products.ts` and the SaaS README.
- Look (`src/styles.css`): cobalt blueprint = the product, marker yellow = the review, heat orange only for pins and heatmaps. Type: Archivo (wide, heavy) for display and body, Shantell Sans for what people say, Martian Mono for labels.
- Keep it working at phone width, with keyboard focus visible and reduced motion respected.

## The scroll film

`src/Showcase.tsx` pins a stage and plays `public/frames/f-000…150.webp` on a canvas as the page scrolls. The frames were made once with Higgsfield:

- Six key images (GPT Image): the site alone, then one more layer each (Comments, Voice notes, Heatmaps, Copy fix prompt, Design system check). The full stack was made first and the others are edits of it, so they line up.
- Five 3-second clips (Kling 3.0), each from one key image to the next, so the layers always arrive in order.
- Every 30th frame (`HOLD` in `Showcase.tsx`) is the key image itself at 1440 px, so the film is sharp whenever it rests; the 29 frames between are taken from the clip at 960 px.

To replace the film, keep that layout (`PER` frames per step) or change `PER` and `HOLD`. The film is atmosphere only: what a feature really looks like is the demo beside it.

## Product UI on the page

`src/Widget.tsx` is a drawing of the product's widget (dock, pin, new-comment card, thread), written here from scratch in the product's own colours; nothing is imported from `apps/saas`. It is used in the hero, the five demos (`src/Demos.tsx`), the loop, the visitor/reviewer flip (`src/Audience.tsx`) and the page's own comment mode (`src/Notes.tsx`). If the real widget's look changes, update `Widget.tsx` and the `.w-` rules to match.

The toolbox is a skill list with a preview screen (`src/Previews.tsx`): pointing at, focusing or tapping a tool plays a three-step loop of how it works, the way a game's skill menu plays a clip of the selected move. Each of the 13 tools has a scene and three step captions (`STEPS`). Beside each scene plays a 3-second clip of the tool's layer (`public/clips/<id>.mp4` with a `.webp` poster, 640 px, made with Higgsfield in the style of the scroll film: one key image per tool, animated from the bare site with Kling 3.0; five tools reuse the scroll film's clips). Scenes are animated drawings and clips are AI-made illustrations, not recordings, and the screen says so. A new tool needs a scene, its steps and a clip.

Everything interactive is a demo and says so where it could mislead: comments stay in the tab, the voice note uses no microphone, the heatmap is example data. The toolbox switches only build the sign-up link (`?products=`).
