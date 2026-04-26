# Next steps — post-hackathon backlog

Day 7 closed the implementation arc — Days 1–6 layers landed; Day 7
shipped the motor / voice-control stretch. Two intentionally-deferred
items survive the wrap (verification audit, deploy), plus the standing
backlog. This list is now ordered by "ship quickly post-hackathon" vs
"longer-term."

## Deferred from the hackathon (carry forward as-is)

### Verification audit (Day 6 Commit 1, deferred again on Day 7)
The session-file template lives at
`.claude/memory/sessions/2026-04-27-verification-audit.md`. Run the
combos and transcribe before any external launch:
- VoiceOver (macOS, Safari) on /onboarding + /chat across 5 profile
  combos (default, screen-reader, plain-language, screen-reader+plain-
  language, plain-language+high-contrast).
- NVDA (Windows, Firefox + Chrome). Firefox path: STT UI hidden + voice
  command UI hidden (Web Speech API absence).
- Lighthouse desktop ≥ 95 on /onboarding + /chat (default + cognitive).
- axe-core zero violations.
- `validate_loop.py --persona cooperative --profile cognitive-plain-
  language` (5–8 Opus calls). Capture per-turn avg words/sentence;
  target ≤ 15. If `max-sentences-exceeded` fires on > 20% of turns,
  tighten register fragment wording.
- `validate_loop.py --persona cooperative` (no profile flag) baseline
  regression check vs ADR-025 fragment refactor.
- **Add `--profile worst-case-stack` flag to `validate_loop.py`** —
  visual=screen-reader + cognitive=plain-language + learning=adhd-focus
  + pacing=slow. 5-turn cooperative + 3-turn stubborn run; capture
  violations summary.
- Recap-bubble announcement priority — drive to 3 earned, click "Recap
  so far", verify VO waits for current sentence before reading the
  recap (aria-live=polite is load-bearing).
- Day 6 LD verification: Atkinson font renders on Safari/Firefox/
  Chrome, cognitive+dyslexia stack at 17px/1.75 doesn't overflow 60ch,
  ADHD older-turn fade restores on hover/focus-within, Shift+M with
  composer focus types capital M cleanly, `max-questions-exceeded`
  fires on real model output.
- **NEW Day 7 verification items:**
  - Shift+V hold outside composer activates voice command banner;
    release stops; capital V in composer types V (activeElement guard).
  - Each grammar entry triggers its action correctly (recap, send,
    pacing-slow, pacing-normal, tts-on, tts-off, cancel, minimize-on,
    minimize-off).
  - Voice "minimize" toggles the same Shift+M state (not a parallel
    desync — ADR-033 single source of truth).
  - Voice activation cancels in-flight TTS (barge-in).
  - `tts-on` via voice plays audio on Safari without first clicking
    AudioArmBanner (the voice activation IS the gesture).
  - Firefox: voice command UI hidden (Web Speech API absent), Shift+V
    chord no-ops, dictation also hidden (existing Day 4 behavior).

### Deploy (Day 7 Commit 5, skipped per user direction — local demo)
The codebase is deploy-ready in shape (single-process, SQLite-backed,
no auth) but no Dockerfile or hosting was provisioned. When picking
this up:
- **Render single-box** is the recommended path (one URL for judges,
  same-origin so no CORS, persistent disk for SQLite, Docker build).
- Vercel + Fly.io is the right answer for production but needs a CORS
  config update (`backend/app/config.py` `cors_origins`) + a frontend
  env-var pointing at the Fly.io API origin.
- Architecture deferred items to document either way: Postgres + Alembic
  migration, real auth (current path is anonymous via X-Learner-ID),
  multi-region, custom domain, multi-worker safety (SQLite + workers
  > 1 = lock contention).

## Quick-win post-hackathon work

- **Voice command grammar expansion** — paraphrases users hit in
  practice ("read it back to me" → tts-on; "wait, go back" → ?).
  Stay fixed-keyword (ADR-032) but enrich the phrase list. Freeform
  parsing + multi-step intents are a separate project.
- **`tool_input` on TurnOut for recap hydration** — `concepts_recapped`
  + `next_focus` currently lost across reload (only `display_text`
  comes back from `/turns`). Add `tool_input` to TurnOut (or a
  dedicated `GET /session/{id}/recaps`). Day 5 follow-up.
- **Cross-tab pacing-toggle sync** — storage-event relay (~20 lines).
- **Cursor-position-aware STT insertion** — fiddly with controlled
  textarea. Day 4 follow-up.
- **TTS voice picker + rate/pitch controls** — disclosure under the
  Read-aloud toggle.
- **OpenDyslexic as a user-selectable alternative font** — some
  dyslexic readers prefer OpenDyslexic over Atkinson; "user picks the
  face" via a small dropdown alongside the dyslexia-font toggle.
- **Conditional font preload** — currently ~11 KB Atkinson Regular
  preload on every page load benefiting only dyslexia-font users.
  Lighthouse may flag; swap to dynamic `<link>` injection if it does.
- **Mobile drawer for DebugPanel** — Sheet swap if mobile testers ask.
- **`voice-state` data-attribute on body** — decorative pulse styling
  could move to a CSS-driven state machine if voice gains more states.

## Pedagogy / backend follow-ups

- **ADR-011 server-side hint-level enforcement** — model can still
  jump 1→3. Track last hint level per concept_targeted in the DB and
  reject out-of-order escalations.
- **Hard-cap on consecutive pacing nudges** — current
  `max_over_threshold=6` is a proxy for "consecutive nudges"; if a
  tester finds it annoying, track `last_N_nudges_fired` on Session.
- **`worst-case-stack` validate_loop flag** — listed under audit but
  the implementation itself (the flag wiring, not running it) is a
  small backend change. Trivial to land alongside the audit.

## Production / infra readiness

- **Postgres + Alembic migration** — SQLite is fine for hackathon /
  local demo / single-process Render box. Real production wants
  Postgres + migrations.
- **Real authentication** — current path is anonymous via
  X-Learner-ID; localStorage-only identity. Swap to OAuth / magic
  links when launching publicly.
- **Concept_earned / told / decisions hydration from API** — store is
  session-scope; refresh clears. Add `/session/{id}/state-full` if
  cross-refresh continuity is wanted beyond the current `state`
  endpoint.
- **Real CI** — GitHub Actions running `pytest -q` + `npm run test:ci`
  + `npx tsc --noEmit` + `npm run build` on every push, plus
  Lighthouse + axe-core gating on the deployed preview.
- **`worst-case-stack` register fragment trims** — if validate_loop
  shows oxygen running out when 4 axes stack, shrink fragment
  wording rather than dropping fragments. Document the original
  wording in a code comment so reviewers see the choice was deliberate.

## Standing open questions

- **Lots of TTS voices vs the right TTS voice.** Picker UX vs
  defaulting per-locale. Pick a default that's "boring and correct"
  unless data says otherwise.
- **Voice command vs STT dictation chord conflict** — Shift+V vs
  Shift+Space. activeElement guards differentiate them; verify on
  real hardware that one chord doesn't fire while the other is
  active. Especially on mechanical keyboards with key-rollover.
- **Recap-on-first-load** — a returning learner with 5 earned
  concepts already might want a recap *before* the first user turn,
  not after. Currently the soft nudge requires a turn to trigger.
- **Profile preview vs profile preset.** Currently each axis is an
  independent toggle; an "ADHD friendly" preset would pre-select
  multiple axes at once. Discoverability vs ceremony tradeoff.