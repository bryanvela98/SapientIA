# 2026-04-24 — AccessibilityProfile onboarding (Day 3 Commit 4/6)

## Done
- `react-router-dom` installed. `main.tsx` wraps `<App />` in `BrowserRouter`.
- `App.tsx` is now a `<Routes>` container with a `Bootstrap` wrapper that
  rehydrates the cached learner on mount (GET /learner/{cached-id}) before
  rendering routes, so landing doesn't flash between onboarding and chat.
- Routes: `/` → `LandingRedirect` (goes to `/chat` if learner present,
  else `/onboarding`), `/onboarding`, `/chat`, `/chat/:sessionId`, plus
  a catch-all `*` → `/`.
- `src/routes/Onboarding.tsx` — a full `<form>` with:
  - `<fieldset>` + `<legend>` per dimension (semantic HTML, not divs).
  - Reusable `RadioField<K>` component wrapping shadcn `RadioGroup`, with
    a per-option description visible below each radio (not a tooltip).
  - `<Select>` for pacing.
  - Live preview card (right column on md+, stacked on mobile) that runs
    `previewSample(draft)` on every profile change to show the tutor's
    actual opening line adapting to the settings. `aria-live="polite"`
    so screen-reader users hear the adaptation.
  - First interactive element focused on mount via a ref-based
    `querySelector('[role="radio"]').focus()` — keyboard users land in
    the form.
  - `aria-live` error region near the submit button.
  - Submit: `updateProfile(learner.id, draft)` when a learner exists
    (profile edit), else `ensureLearner(draft)` (first-time onboard).
    Then `navigate('/chat')`.
- `src/routes/Chat.tsx` is a placeholder today — shows learner id + profile
  summary + a link back to `/onboarding`. Commit 5 fills in the real UI.
- `src/lib/preview.ts` — two helpers:
  - `previewSample(profile)` mirrors the backend `to_prompt_guidance`
    precedence order so what the user sees in onboarding matches what
    the tutor actually does. Highest-priority accommodation wins
    (adhd-focus > plain-language > screen-reader > dyslexia-font >
    slow pacing > default).
  - `profileSummary(profile)` for compact header / chip rendering.

## Broke / gotchas
- **`React.FormEvent` (untyped)** is deprecated in TS 6 / React 19's
  current types. Switched `onSubmit(ev: React.FormEvent)` to
  `React.FormEvent<HTMLFormElement>`.
- **`react-hooks/set-state-in-effect`** flagged a direct `setReady(true)`
  in the bootstrap effect's sync no-cache branch. The rule intent is to
  catch render loops, which a single gated one-shot `cancelled`-guarded
  bootstrap doesn't trigger. Refactored to extract a `finish()` helper
  (called from both the sync branch and the `.finally`) and the rule
  stopped flagging — apparently it's sensitive to call-site shape, not
  just presence.
- **Ref type mismatch** — I wrapped the first RadioField in a `<div>`
  and attached a `useRef<HTMLFieldSetElement>` to it. TS caught it; fixed
  to `HTMLDivElement`. The focus-on-mount logic uses
  `querySelector('[role="radio"]')` so the specific wrapper element
  type doesn't actually matter for the focus behavior.
- **Double-render in dev / StrictMode** — the bootstrap effect runs
  twice in dev. The `cancelled` flag handles it; either call completes
  first and the second either finds the state already set or short-circuits.
  Same-learner fetches are idempotent so there's no harm either way.

## Accessibility notes (baseline — Commit 6 audits deeper)
- Every radio option has a *visible* description (not tooltip-only).
- Each dimension is a `<fieldset>` with a real `<legend>`, so screen
  readers announce the group name when entering it.
- `<Label for={id}>` pairs with every `<RadioGroupItem id={id}>`.
- `aria-describedby` links each radio to its description element for
  verbose announcements.
- Preview card is `aria-live="polite" aria-atomic="true"` so the whole
  adapted sample announces on each change (rather than appending deltas).
- Submit button sets `aria-busy={submitting}` during the API call.
- Error region is `role="alert"` inside an `aria-live="polite"` wrapper.

## Checkpoint 4
Code-level:
- ✅ `npx tsc --noEmit -p tsconfig.app.json` clean.
- ✅ `npm run build` — 1861 modules, 115.8 kB gz JS (the jump from 68
  kB is react-router-dom's tree-shake-resistant footprint + the full
  shadcn Select/RadioGroup graph that Onboarding pulls in).
- ✅ `npm run lint` clean.

Browser-verifiable (deferred to the pause):
- ⏳ Fresh browser (clear localStorage) lands on `/onboarding`.
- ⏳ Keyboard-only picks a profile (Tab, Space, Arrows).
- ⏳ Submit navigates to `/chat`; reload keeps the user on `/chat`.
- ⏳ Returning to `/onboarding` and changing a field fires `PATCH
  /learner/{id}/profile`.
- ⏳ Live preview updates its sentence as radios change.

## Open questions / deferred
- The default-profile → `/chat` redirect vs `/onboarding` for fresh
  users: current behavior is fresh-user → `/onboarding`, which is
  intentional because the whole point is to show "accessibility affects
  phrasing." May revisit if usability testing shows users bounce off it.
- Session picker on `/chat` without `:sessionId` ships in Commit 5; for
  now `/chat` renders the placeholder.

## Next action (pause)
- Agreed pause for browser verification of Commits 2–4 before starting
  Commit 5's chat UI. Run both servers:
  ```bash
  # tab 1
  cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000
  # tab 2
  cd frontend && npm run dev
  ```
  Then in the browser, walk through: `/` → `/onboarding` → keyboard
  fill → `/chat` placeholder → reload stays on `/chat` → back to
  `/onboarding` → PATCH fires. Note anything visual or UX I should
  fix before Commit 5.