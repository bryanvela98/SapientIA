# 2026-04-24 — API client + learner identity + SSE consumer + Zustand (Day 3 Commit 3/6)

## Done
- `src/lib/types.ts` mirrors backend schemas 1:1 (`AccessibilityProfile`,
  `Learner`, `SessionOut`, `SessionState`, `TurnOut`) and the SSE event
  discriminated union (`TurnStart` | `ToolDecision` | `ConceptEarned` |
  `ConceptTold` | `TurnEnd` | `TurnError`). Exports `defaultProfile` and
  a `TEACHING_TOOLS` const so the store can tell teaching from bookkeeping.
- `src/lib/identity.ts` — `getCachedLearnerId` / `setCachedLearnerId` /
  `clearCachedLearnerId` against `localStorage` key `sapientia.learnerId`.
  All three swallow `localStorage` exceptions (private-mode resilience).
- `src/lib/api.ts`:
  - `API_BASE` from `VITE_API_BASE` env or `http://localhost:8000`.
  - `ensureLearner(profile)` — GETs the cached id; on 404 clears cache and
    POSTs a fresh learner (handles `sapientia.db` wipes during dev).
  - `getLearner`, `updateProfile`, `createSession`, `getSessionState`,
    `getSessionTurns`.
  - `streamTurn(sessionId, message)` — async generator over `fetch` +
    `ReadableStream`. Hand-rolled SSE parser splits on `\n\n`, drops
    `event:` headers (our payloads self-identify via `type`), parses
    `data:` payloads as JSON, degrades gracefully on malformed JSON with a
    `console.warn`.
- `zustand` installed. `src/lib/store.ts` holds learner / profile / session
  / turns / live turn / decisions / earned / told with narrow mutators
  (`startLiveTurn`, `applyDecision`, `addEarned`, `addTold`, `endLiveTurn`,
  `resetSession`). `applyDecision` extracts the primary teaching prose
  from `input.question ?? input.hint ?? input.answer`, tracks `hint_level`
  when `give_hint` fires, and appends every decision to `decisions` for
  the Commit 6 debug panel.
- `src/App.tsx` dev-only smoke button (hidden outside `import.meta.env.DEV`):
  runs `ensureLearner → createSession → streamTurn` and logs events to
  the browser console. Button has an `aria-describedby` helper describing
  what it does.

## Parser tradeoffs (ADR-016 candidate)
Considered `@microsoft/fetch-event-source` (handles reconnect, retry, last-id
semantics). Rejected for now:
- Our stream is one-shot per turn. On `turn_end` the server closes the
  connection — there's nothing to reconnect to.
- The dependency pulls a few hundred lines and its own semantics.
- A 40-line async generator is easier to audit and keeps us close to the
  underlying primitives if we ever need to fiddle with the framing.
If we ever need resumption across flaky networks, revisit.

## Store shape choices
- `turns` is the canonical committed transcript (sourced from
  `GET /session/{id}/turns` on mount and after each live turn completes).
- `live` is the in-flight assistant turn, collapsing multi-`tool_decision`
  sequences into a single primary prose string. When `streaming` flips to
  false on `turn_end`, the UI should either leave it in place briefly OR
  re-fetch `turns` and clear `live`. Chat UI (Commit 5) will pick that
  approach.
- `decisions` is the raw event log — keeps the debug panel honest even
  when `live.text` collapses multiple calls.

## Identity flow
- First load: no cached id → `ensureLearner` POSTs a new learner, caches
  the UUID.
- Reload: cached id → GET 200 → learner rehydrated.
- DB wiped (common in dev): cached id → GET 404 → cache cleared, POST
  creates fresh. Zero user-visible error.

## Broke / gotchas
- None material this commit. The `LiveTurn` type lives in the store
  module; couldn't cleanly put it in `types.ts` without splitting
  pedagogy-event shapes (backend-defined) from UI state shapes
  (frontend-internal), so `types.ts` stays faithful to the API and
  `store.ts` owns the UI-only projection.

## Checkpoint 3
Passable in code but only verifiable with a browser:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run build` — 136 modules, 68.9 kB gz JS.
- ✅ `npm run lint` clean.
- ⏳ Browser-verified "click smoke button → see `turn_start` →
  `tool_decision` → `turn_end` in console" — deferred to the pause after
  Commit 4 per the agreed cadence.
- ⏳ `localStorage.sapientia.learnerId` populated after first smoke run;
  reload keeps same id without 404 — also deferred to the pause.

## Next action (Commit 4/6)
- Install `react-router-dom`.
- `/onboarding` route with AccessibilityProfile picker (shadcn RadioGroup
  per dimension, Select for pacing), live preview sample, keyboard-first
  flow, `PATCH`/`POST` via `updateProfile`/`ensureLearner`.
- Default landing logic: fresh user → `/onboarding`, returning user →
  `/chat` (placeholder for now; fills out in Commit 5).