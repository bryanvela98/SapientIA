# 2026-04-24 — Frontend scaffold (Day 3 Commit 2/6)

## Done
- Bootstrapped `frontend/` with Vite's `react-ts` template (`create-vite@9.0.6`).
  Removed the template's demo assets, `App.css`, hero/logos/icons, and the stock
  marketing App.tsx.
- Tailwind v4 via `@tailwindcss/vite` plugin. `src/index.css` uses the v4 flow:
  `@import "tailwindcss";`, `@custom-variant dark`, `:root` / `.dark` CSS-var
  design tokens (oklch), `@theme inline` bridging the vars to Tailwind utility
  names, and `@layer base` for body defaults.
- shadcn/ui wired non-interactively: hand-wrote `components.json` targeting
  `new-york` style with neutral base color + CSS vars, then ran
  `npx shadcn@latest add -y --overwrite button input label textarea card badge
  select radio-group switch dialog skeleton`. That plus `@radix-ui/react-slot`
  + `class-variance-authority` + `clsx` + `tailwind-merge` + `lucide-react`
  is the full component base we'll need this week.
- `src/lib/utils.ts` exports the canonical `cn` helper.
- Path alias `@/* → src/*` set in `vite.config.ts`, `tsconfig.json`, and
  `tsconfig.app.json`.
- ESLint config extended with `eslint-config-prettier` and a per-directory
  override turning off `react-refresh/only-export-components` for
  `src/components/ui/**` — shadcn-generated files export the `*Variants`
  helper alongside the component, which is the canonical shadcn pattern.
- Prettier config at `.prettierrc` (semi, single quotes, trailing comma all,
  printWidth 100).
- `index.html` title updated to "SapientIA" (dropped the Vite "frontend" default).
- Root `.gitignore` now covers `.vite/` and `*.tsbuildinfo`.

## Placeholder App
Renders a centered shadcn `Card` with a `<Button>Placeholder</Button>`. Serves
as a smoke test that Tailwind + shadcn + the path alias all resolve correctly.

## Versions actually landed
- `vite` 8.0.10, `@vitejs/plugin-react` 6.0.1
- `react` 19.2.5, `react-dom` 19.2.5
- `typescript` 6.0.2
- `tailwindcss` v4 via `@tailwindcss/vite`
- `@tailwindcss/vite` latest; shadcn components resolved against current
  `new-york` style
- Node 25.2.1, npm 11.6.2

## Broke / gotchas
- **TS 6.0 deprecated `baseUrl`.** Initial tsconfig used `baseUrl: "."` to
  pair with the `paths` alias; `tsc --noEmit` errored `TS5101`. Fix: drop
  `baseUrl` — `paths` alone resolves relative to the tsconfig directory in
  TS 6+. Both `tsconfig.json` and `tsconfig.app.json` updated.
- **shadcn's `button.tsx` and `badge.tsx` re-export `buttonVariants` /
  `badgeVariants` alongside the component.** `react-refresh/only-export-components`
  flags that. Rewriting shadcn's generated code is a losing game; added a
  scoped ESLint override for `src/components/ui/**` instead. When future
  `shadcn add` runs regenerate those files, the override keeps working.
- **shadcn CLI with `-y --overwrite`** does the right thing on a blank
  project; no interactive prompts surface once `components.json` exists up
  front. Hand-writing `components.json` is the trick that avoids
  `npx shadcn init`'s prompts entirely.

## Checkpoint 2
- ✅ `npm run dev` serves `http://localhost:5173/` — verified via
  `curl -sI` returning `HTTP/1.1 200 OK` plus the React-refresh-instrumented
  HTML.
- ✅ `npm run build` succeeds — 133 modules transformed; final bundle
  0.45 kB HTML + 31.14 kB CSS + 222.66 kB JS (70 kB gzipped).
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run lint` clean.

## Needs human eyes
I can't actually render the browser. The card *should* be vertically centered
with `bg-background`/`text-foreground` from the design tokens and a visible
Button with focus ring — please confirm visually before Commit 3 ships, or
flag anything off.

## Open questions / deferred
- Dark mode toggle — CSS vars exist for both schemes; wire the `.dark` class
  when we add the theme switch (Day 4 or 5).
- Font loading — currently `system-ui` stack. If the design asks for a
  webfont, add it via `@font-face` in index.css.

## Next action (Commit 3/6)
- `src/lib/types.ts` (mirror backend schemas + SSE event shapes)
- `src/lib/identity.ts` (localStorage learner id)
- `src/lib/api.ts` (typed fetch client + `streamTurn` async generator over
  fetch + ReadableStream)
- `src/lib/store.ts` (Zustand: learner / profile / session / turns / live /
  decisions)
- Dev-only console smoke button in `App.tsx` to prove the end-to-end wire.