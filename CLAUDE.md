# Marketplace prototype — notes for Claude

- Two parts, kept apart: the product (lo-fi grey-wireframe AI marketplace, buyer side only, `src/pages/shop`, `src/components/Layout.tsx`) and the UX research tools (`src/tools`, research console pages in `src/pages`, the dock). Never link research tools from the product's navigation.
- Third part: the installable collaboration script (`src/embed/`, built to `dist/embed/vibe.js` by `vite.embed.config.ts`; install page `src/pages/Install.tsx`; demo `public/embed-demo.html`). It runs on other people's sites: keep it in its shadow root, never read the host's field values, and store data only through the `Backend` interface in `src/embed/store.ts`.
- Frontend only (React + TypeScript + Vite). No backend: catalogue in `src/data/shop.ts`, simulated AI in `src/lib/ai.ts`, cart/orders in localStorage via `src/store/store.tsx`.
- Before pushing: `npx tsc -b && npm run build` must pass.
- **Git: always push finished work to `main`** (the owner asked for this explicitly). Push the working branch too if one is in use.
- Research tools: read the README section "Research tools" before changing them. Never record typed text or field values; production default for click recording stays OFF until the owner decides on consent.
