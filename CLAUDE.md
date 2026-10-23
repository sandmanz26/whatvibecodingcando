# Skillhouse — notes for Claude

- Frontend only (React + TypeScript + Vite). No backend; data is seed data in `src/data/seed.ts`, persisted to localStorage by `src/store/store.tsx`.
- Before pushing: `npx tsc -b && npm run build` must pass.
- **Git: always push finished work to `main`** (the owner asked for this explicitly). Push the working branch too if one is in use.
- Internal tools live in `src/tools/` (click insights + review pins). Read the README section "Internal tools" before changing them. Never record typed text or field values; production default for click recording stays OFF until the owner decides on consent.
