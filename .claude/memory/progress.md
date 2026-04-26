# Progress log (newest first)

## 2026-04-28 — Day 7 (3 implementation commits + 1 wrap on main; motor / voice-control)
**Commits 1, 4, 5 deferred per user direction.** Commit 1 (verification
audit) carries forward from Day 6 — still un-done; the session-file
template at `.claude/memory/sessions/2026-04-27-verification-audit.md`
remains ready for transcription when human-driven VO/NVDA/Lighthouse/
axe-core runs happen. Commit 4 (worst-case-stack walk-through) is also
audit-driven and was bundled with Commit 1's deferral. Commit 5
(deploy) was skipped because the user is demoing locally — no Render /
Vercel / Fly.io provisioning. SQLite-in-prod ADR-031 was therefore not
logged.

- **Commit 2 — `01b8cf8`** `feat(motor): voice command state machine + grammar parser`
  - `frontend/src/lib/voice-commands.ts` — 9-intent fixed grammar (recap, send, pacing-slow, pacing-normal, tts-on, tts-off, cancel, minimize-on, minimize-off). `parseCommand` normalizes whitespace + case + drops trailing punctuation, then exact-match → length-sorted prefix-match. "stop reading" beats "stop" because the longer phrase is sorted first. See ADR-032.
  - `frontend/src/hooks/useVoiceCommands.ts` — recognizer lifecycle + state machine: `idle | listening | parsed | dispatched | error`. On final transcript: matched → parsed for 250ms ack → onDispatch fires → dispatched flash 800ms → idle. Unmatched → error 3s → idle. Recognizer error → error with friendly message → 3s reset. Lazy recognizer creation + reuse (300–500ms ctor cost on Chrome).
  - `frontend/src/components/VoiceCommandBanner.tsx` — assertive live region with state-driven label. Distinct visual treatment from `ListeningBanner` (blue/emerald instead of red) so command mode is visually different from STT dictation.
  - `frontend/src/components/VoiceCommandButton.tsx` — click-activated mirror of Shift+V for users without keyboard access.
  - `Chat.tsx` Shift+V keyboard hold listener — activeElement guard inverted from STT (commands fire OUTSIDE text inputs so capital V still types in the composer).
  - 35 new tests (27 grammar + 8 hook). Suite end of commit: 77/77 frontend.
- **Commit 3 — `9a2ee42`** `feat(motor): voice command dispatch + barge-in cancels TTS`
  - `frontend/src/hooks/useVoiceCommandDispatch.ts` — pure 9-branch switch over `CommandIntent`. `tts-on` arms audio first then enables (autoplay-policy ordering); `tts-off` disables AND calls `cancelTts`; `cancel` calls both `cancelTts` + `stopVoice`. `minimize-on/off` route through `setMinimized` (the `useMinimizedUi` setter — ADR-033 single source of truth).
  - `Chat.tsx`: `ChatSession` now receives `setTtsEnabled` + `setMinimized` from outer `Chat()`. `voiceStopRef` carries `voice.stop` into the dispatch (updated in an effect because lint forbids ref writes during render). `useVoiceCommands({ onDispatch, onActivate: cancelTts })` — barge-in fires on every Shift+V keydown so the synth voice silences before the mic opens (mirror of STT-cancels-TTS from Day 4 Commit 5).
  - 15 new tests (9 dispatch + 6 banner). Suite end of commit: 92/92 frontend.
- **ADRs added (in this wrap commit)**: 032 (voice command grammar is fixed-keyword, not freeform — predictable + testable + cheap + safe; prefix-match precedence rules), 033 (voice "minimize" routes through `useMinimizedUi` single source of truth — three activation paths converge on one setter).
- **Commit 6** — docs + memory housekeeping (this entry).

End-of-day suite: 47/47 backend pytest (unchanged from Day 6 — no
backend changes in Day 7), 92/92 frontend vitest (40 prior + 52 new),
tsc + lint + build clean. CLAUDE.md updated to reflect actual
delivered scope (deploy and verification audit explicitly listed as
deferred).

## 2026-04-27 — Day 6 (4 implementation commits + 1 wrap on main; LD layer)
**Commit 1 (verification audit) is deferred to the final wrap** — VO/NVDA/
Lighthouse/axe-core runs are user-driven; the audit session-file template
exists at `.claude/memory/sessions/2026-04-27-verification-audit.md` ready
for transcription when the hands-on time happens.

- **Commit 2 — `cb4c6bf`** `chore(fonts): self-host Atkinson Hyperlegible for dyslexia-font mode`
  - Picked Atkinson Hyperlegible over OpenDyslexic and Lexend (ADR-028). Designed by Braille Institute for low-vision; metrics compose cleanly with cognitive's 17px / 1.7; SIL OFL 1.1 license with straightforward redistribution.
  - Self-hosted under `frontend/public/fonts/atkinson-hyperlegible/`: 4 latin woff2 files (Regular ~11 KB, Bold ~11 KB, Italic ~12 KB, BoldItalic ~12 KB) — total ~47 KB, well under the plan's 150 KB estimate.
  - OFL.txt copied verbatim from upstream googlefonts repo, ships alongside the woff2s (license requires it for redistribution).
  - `@font-face` blocks in `index.css` with `font-display: swap` (no FOIT, slight FOUT). `--font-dyslexia: 'Atkinson Hyperlegible', system-ui, …` exposed in `:root` for the LD theme block.
  - `index.html` preloads only Regular (~11 KB unconditional cost). Bold/Italic load on demand.
- **Commit 3 — `49ef2d5`** `feat(a11y): dyslexia-font theme block + useLearningMode hook`
  - `[data-learning='dyslexia-font'] body` switches font-family to var(--font-dyslexia) + 0.02em letter-spacing + 0.06em word-spacing. Atkinson does most of the legibility work; spacing is a light touch.
  - Composition rule resolved (ADR-029): cognitive's 17px stays when stacking with dyslexia. Atkinson runs slightly smaller than system-ui at the same px, so 17px composed is comfortable, not oversized. The compound selector `[data-learning='dyslexia-font'][data-cognitive='plain-language'] body { line-height: 1.75 }` nudges line-height by 0.05 over cognitive alone.
  - `useLearningMode(profile)` hook applies/removes `data-learning` on `<html>` with the value (`dyslexia-font` | `adhd-focus`). Mutually-exclusive schema means one attribute slot suffices. Mirror of `useCognitiveMode` (ADR-027 pattern).
  - 5 hook tests; 30/30 vitest at end of commit.
- **Commit 4 — `7770af4`** `feat(a11y): adhd-focus UI — Shift+M minimize chord + older-turn fade`
  - `useMinimizedUi(profile)` — boolean state with ADR-024 explicit-only-persistence. ADHD-focus profile defaults ON; storage rules after explicit toggle. Shift+M outside text inputs toggles; inside INPUT/TEXTAREA/contentEditable: no-op.
  - `MinimizeToggle` button in chat header (`aria-pressed`, `aria-keyshortcuts="Shift+M"`). Stays visible when minimized.
  - Hideable controls wrap in `<span data-minimize-target>`: ThemeToggle, TtsToggle, DebugPanelToggle, Edit-profile (route header); PacingToggle, RecapButton (session card header). Always visible: app title, ConceptBadges, New-topic, MinimizeToggle, transcript, composer, SkipLink. CSS rule `[data-focus-minimized='true'] [data-minimize-target] { display: none }` does the hiding.
  - `[data-learning='adhd-focus'] ol[role='log'] > li:nth-last-child(n+5)` opacity 0.55 with hover/focus-within restore. ADR-030 codifies the rule: NEVER `aria-hidden` on transcript items — opacity is visual-only; SR users still walk the full log.
  - **setup.ts Storage shim**: vitest 4's jsdom `localStorage.removeItem` is missing (warning: "--localstorage-file was provided without a valid path"). Replaced both localStorage and sessionStorage with a Map-backed Storage in setup.ts; `afterEach` clears both. 10 minimize tests + the existing 30 all green.
- **Commit 5 — `19c1700`** `feat(enforcement): max-questions-exceeded violation for adhd-focus`
  - Mirror of Day 5's `max-sentences-exceeded` pattern. When `learning=adhd-focus` AND a tool in `_QUESTIONING_TOOLS = {diagnose, ask_socratic_question, give_hint, check_understanding}` has primary prose with > 1 `?`, append `max-questions-exceeded` to violations. Soft check — log only.
  - Pure helper `_count_questions_in_primary(input_obj)` walks `PRIMARY_TEXT_FIELDS` for the first populated field and counts literal `?`. False positives from quoted/rhetorical question marks accepted (rare in tutor prose; metric is non-blocking).
  - `progress_summary` and `deliver_answer` excluded from the rule — recap and answer prose can legitimately quote `?`.
  - 9 new pure-helper tests in `test_violations.py`. 47/47 backend pytest at end of commit.
  - `docs/pedagogy.md` gains a "Violations surfaced by the server" table enumerating all three soft violations and their gating rules.
- **ADRs added**: 028 (Atkinson Hyperlegible), 029 (cap body font-size when stacking cognitive + dyslexia), 030 (opacity-only soft-fade, never aria-hidden on transcript items).
- **Commit 6** — docs + memory housekeeping (this entry).

End-of-day suite: 47/47 backend pytest, 40/40 frontend vitest, tsc + lint
+ build clean. The verification audit (Commit 1) carries forward to the
Day 7 wrap.

## 2026-04-26 — Day 5 (5 commits on main; cognitive layer end-to-end)
- **Commit 1 — `5214e9c`** `chore(frontend): vitest + testing-library + first dual-live-region test`
  - vitest 4.1.5 + @testing-library/react 16.3 + @testing-library/jest-dom + @testing-library/user-event + jsdom. Orthogonal `vitest.config.ts` (react plugin + `@/` alias only; tailwind plugin intentionally not loaded in jsdom).
  - `src/test/setup.ts` stubs `matchMedia` (jsdom lacks it; `useTheme` needs it) and runs `cleanup` after each test. `src/test/render.tsx` wraps `render` in `<MemoryRouter>` for future routed-component tests.
  - `LiveAnnouncer.test.tsx` — paid back the ADR-022 DOM-assertion item deferred from Day 4. Covers role=alert + aria-live=assertive + aria-atomic=true, announce-on-earned, 4s clear, and the watermark-rebase-after-resetSession regression guard.
  - Extracted `findLastSentenceEnd` from `useTtsForLiveTurn` into `src/lib/sentence.ts` so it's testable as a pure function; `sentence.test.ts` covers `". "`, `".\n"`, trailing period, e.g.-mid-word, closing quotes, `!`/`?`, and multi-sentence pick-the-last.
- **Commit 2 — `eae20dc`** `feat(prompts): structured fragments + plain-language register/chunking/vocab`
  - `AccessibilityProfile` gained `PromptFragments` (dataclass) + `to_fragments()`; flat bullets replaced by named slots `register / chunking / vocabulary / interaction_style / pacing` rendered as `- **Slot:** text`.
  - `cognitive=plain-language` contributes 4 fragments: grade-5 register (≤15 w/sent, Anglo-Saxon vocab), 3-short-sentence chunking cap, define-on-first-use vocabulary, simple-question interaction style.
  - Composition rule: `cognitive=plain-language + learning=adhd-focus` emits ONE merged `chunking` fragment ("3 short sentences AND at most one question"), not two contradictory bullets. Multi-contributor `interaction_style` concatenates cleanly (screen-reader + plain-language).
  - Jargon rule promoted from `## Anti-patterns` into the `vocabulary` fragment; anti-patterns is now only profile-agnostic rules. Backward-compat: `to_prompt_guidance` keeps its string return type, single call site unchanged.
  - `validate_loop.py --profile {none, cognitive-plain-language}` + per-turn sentence-length stats (avg words/sentence, count over 20). Didn't execute against real API — credit budget preserved; user can run when desired.
  - `docs/pedagogy.md`: slot × contributor table + composition rules replace the old flat list. 11 profile tests (4 existing + 7 new) including composition merges + full-combo snapshot. See ADR-025.
- **Commit 3 — `74f3177`** `feat(pedagogy): progress_summary tool + recap nudge after N earned`
  - New `progress_summary` tool (summary / concepts_recapped / next_focus). Added to `TEACHING_TOOLS` so recap-only turns don't trigger chain-through; `summary` joined `PRIMARY_TEXT_FIELDS` for token streaming; `extract_primary` falls through to summary so display_text persists the recap.
  - `maybe_recap_nudge(unrecapped, threshold=3, max_over_threshold=6)` appends a soft `## Pacing nudge` block to the system prompt when earned concepts pile up past threshold; suppressed past `threshold + max_over` so the nag has a ceiling.
  - `routers/session.py` computes unrecapped by walking `session.turns` for the newest `tool_used='progress_summary'` timestamp, counting `earned.created_at > that`. Zero extra queries. Threaded into `stream_turn(..., unrecapped=...)`.
  - Soft `max-sentences-exceeded` violation when plain-language is set and a teaching turn exceeds 3 sentences — surfaces drift in telemetry, doesn't block.
  - Frontend: `progress_summary` tool name + SSE event variant + `Recap` type; `recaps: Recap[]` store + `addRecap` action; `Chat.tsx` pipes the event. Visual treatment deferred to Commit 4. See ADR-026.
  - 9 new backend tests (threshold, cap, prompt slot placement, TEACHING_TOOLS membership, PRIMARY_TEXT_FIELDS, extract_primary for recap, sentence counter parity).
- **Commit 4 — `7fdb75f`** `feat(a11y): cognitive theme — type/density/focus shift + RecapBubble`
  - `[data-cognitive='plain-language']` block in `index.css`: body 17px + 1.7 line-height, `*:focus-visible` 3px outline + 3px offset, transcript bubble max-width 60ch + extra vertical padding. Orthogonal to `[data-theme='high-contrast']` — both compose.
  - `useCognitiveMode(profile)` hook applies/removes `data-cognitive` on `<html>`. Wired into Chat route root.
  - `RecapBubble` component — distinct callout with left-accent border, muted tint, "Recap" label, concepts bullet list, "Next:" line. `role=group` + `aria-live=polite` (not assertive; recap is important but shouldn't interrupt mid-sentence). Chat transcript branches on `tool_used='progress_summary'` to render RecapBubble instead of AssistantBubble; enriched with store.recaps by turn_number when available. Live bubble also routes to RecapBubble when the streaming tool is progress_summary.
  - `Onboarding`: selecting `cognitive=plain-language` auto-bumps `pacing` to `slow` (only when currently `normal`) with a polite inline note. Any explicit pacing change clears the note. See ADR-027.
  - 10 new vitest tests: RecapBubble (role + label + list + next-focus + streaming fallback), useCognitiveMode (apply / remove / unmount / re-render toggle).
- **Commit 5 — `f49de44`** `feat(chat): in-chat pacing toggle + manual "Recap so far" trigger`
  - Backend: `TurnRequest.force_recap: bool = False` threaded through `stream_turn` → `build_system_prompt` → `maybe_recap_nudge(force=True)`. Strong directive ("learner EXPLICITLY asked, do it now") bypasses the unrecapped counter. 3 new backend tests covering force path + precedence over soft nudge.
  - Frontend: `streamTurn(sid, msg, { forceRecap? })` extended. New `RecapButton` (disabled until earned > 0 with explanatory tooltip; disabled while streaming; click fires synthetic `[user requested recap]` user turn with `force_recap=true`, persisting intent). New `PacingToggle` Switch (optimistic flip + PATCH /learner/{id}/profile; revert on failure).
  - RecapButton.test.tsx: disabled-empty, enabled-after-earn, disabled-streaming, click-invokes-callback.
  - 25/25 frontend vitest, 36/36 backend pytest at end of Commit 5.
- **ADRs added**: 025 (structured prompt fragments), 026 (soft recap nudge, not hard tool injection), 027 (cognitive theme orthogonal to high-contrast).
- **Commit 6** — docs + memory housekeeping (this entry). Carried the Day 4 user-driven verification checklist forward; ran cognitive-mode focus audit notes in the session file.

## 2026-04-25 — Day 4 (6 commits + 1 fix on main; visual impairment layer end-to-end)
- **Commit 1** `refactor(profile): drop hearing dimension, reserve slot for motor/voice stretch (ADR-021)`
  - Removed `hearing` from backend `AccessibilityProfile` + frontend types + `defaultProfile` + `/onboarding` fieldset.
  - Added `ConfigDict(extra="ignore")` on Pydantic so dev-DB rows with stale `{"hearing": "deaf"}` still round-trip.
  - `backend/tests/test_profile.py` covers defaults, extra-ignore, round-trip, `to_prompt_guidance` flags. Full backend suite 13/13 green.
  - Slot reallocated to a Day 7 motor/voice-control stretch. See ADR-021.
- **Commit 2** `feat(tutor): token-level streaming via messages.stream + text_delta SSE`
  - `backend/app/tutor/async_loop.py` rewritten around `client.messages.stream(...)` as an async context manager.
  - Synthesizes `text_delta` SSE events from `input_json_delta` chunks; `_extract_primary_text(partial_json)` walks the partial-JSON buffer for `question`/`hint`/`answer` with JSON-escape awareness and a `json.loads('"'+raw+'"')` fallback that tolerates mid-escape.
  - `tool_decision` fires at `content_block_stop` with the full parsed input (preserves Day 3 UI compat — one `tool_decision` per turn, not two).
  - Chain-through retry (ADR-013) also streams — never falls back to `messages.create`.
  - New test `test_text_delta_events_assemble_primary_text` asserts ≥2 text_delta events per turn and their concat matches the final tool input.
- **Commit 3 — `d4b3783`** `feat(frontend): token-delta append, skip links, high-contrast theme`
  - `applyTextDelta` appends to `live.text` per token; `applyDecision` stops touching `live.text` (metadata-only) so delta and decision streams don't race.
  - `src/components/SkipLink.tsx` (sr-only / focus:not-sr-only); composer `<form id="composer" tabIndex={-1}>`; onboarding first RadioField wrapped for `#first-field` target.
  - `[data-theme='high-contrast']` block in `index.css` overriding oklch palette (black/white/saturated-yellow ring, WCAG AAA); `src/lib/useTheme.ts` tri-state with dual `.dark` class + `data-theme` attribute application so shadcn `dark:` utilities still fire in high-contrast.
  - `src/components/ThemeToggle.tsx` shadcn Select in the chat header.
- **Commit 4 — `8b10e94`** `feat(a11y): TTS for tutor turns with sentence-buffered SpeechSynthesis`
  - `src/lib/tts.ts`: async voice cache (Chrome's lazy `voiceschanged` with 2s fallback), `pickVoice` locale-exact → prefix → default chain, `speak / pause / resume / cancel / ttsStatus`.
  - `src/lib/useTts.ts`: profile-aware `useTtsEnabled` (low-vision=on, screen-reader=off), `useAudioArmed` sessionStorage-tracked autoplay-gesture flag with global `pointerdown`/`keydown` auto-arm.
  - `src/hooks/useTtsForLiveTurn.ts`: sentence-buffered `text_delta` → speak on `. ! ? \n + whitespace`; flush on turn_end; cancel on turn boundary; discrete queued utterances for `concept_earned` / `concept_told`.
  - `src/components/TtsToggle.tsx` (Switch + visible K hint + `aria-keyshortcuts`), `src/components/AudioArmBanner.tsx`, `src/hooks/useTtsKeyboard.ts` (K pause/resume outside inputs).
- **Fix — `7d64180`** `fix(tts): apply profile default on visual change; survive session reset`
  - `useTtsEnabled` now persists *only* on explicit toggle and re-derives from `profile.visual` during render (React 19 "adjust state during render" pattern). Storage key bumped to `.v2` so buggy `'0'` values from the first impl are discarded cleanly.
  - `useTtsForLiveTurn`: `earnedCountRef`/`toldCountRef` now rebase when the arrays shrink (e.g., `resetSession` on new topic), so first earned/told of a new session still announces.
- **Commit 5 — `0c6dfae`** `feat(a11y): push-to-talk STT via Web Speech API with Shift+Space hold`
  - `src/lib/stt.ts`: `supportsStt` + `createRecognizer` wrapper; minimal inline `SpeechRecognition` types (no `@types/dom-speech-recognition`); swallow `InvalidStateError` on `start`/`stop`; `sttErrorMessage` maps the common codes.
  - `src/hooks/useStt.ts`: single-shot recognizer lifecycle; lazy creation on first start; interim buffer for preview, finals via `onFinal`.
  - `src/components/MicButton.tsx` (lucide Mic/MicOff; `aria-pressed`; `aria-keyshortcuts="Shift+Space"`; click-toggle), `src/components/ListeningBanner.tsx` (pulsing red + `aria-live="assertive"`).
  - Chat.tsx: global `keydown/keyup` Shift+Space hold with `activeElement === composer` guard; cancel TTS on dictation start; interim preview below textarea; error banner with Dismiss. Chose Shift+Space over bare-Space+200ms (ADR-023) to avoid typing-latency or retroactive-deletion tradeoffs.
- **Commit 6** `feat(a11y): dual live regions, role=log transcript, screen-reader audit`
  - `src/components/LiveAnnouncer.tsx`: sr-only `role="alert" aria-live="assertive"` region for earned/told milestones so they jump the polite transcript queue (ADR-022). Watermark rebase on session reset.
  - `<ol role="log">` on transcript (was `<ul>` inside `<section role="log">`) — ordered list matches the chronological semantic.
  - `EarnedFlash` lost `aria-live` and gained `aria-hidden="true"` — visible-only badges; SR announcements come exclusively through `LiveAnnouncer`.
  - `cancelTts()` on every composer `keydown` — typing is a signal to stop competing with the synth voice.
  - Audit rubric for VoiceOver + NVDA + Lighthouse + axe-core captured in session file for user-driven execution.
- **ADRs added**: 021 (drop hearing), 022 (dual live regions), 023 (Shift+Space for STT), 024 (profile-default TTS persistence semantics).

## 2026-04-24 — Day 3 (6 commits + 3 fixes on main)
- **Commit 1 — `95755d2`** `feat(api): GET /session/{id}/turns for hydration + timezone-aware timestamps`
  - `TurnOut` schema (display_text + tool_used + role + turn_number + ISO created_at)
  - `datetime.utcnow` → `datetime.now(timezone.utc)` across all 4 model files; pytest DeprecationWarnings gone
  - Integration test: 2-turn flow + 404 unknown; full suite 12/12 in 62s
- **Commit 2 — `6d47042`** `feat(frontend): vite + react + ts + tailwind + shadcn baseline`
  - Vite 8 + React 19 + TS 6 (baseUrl dropped — deprecated in TS 6)
  - Tailwind v4 via `@tailwindcss/vite`; oklch design tokens; shadcn/ui components non-interactively via hand-written `components.json`
  - ESLint scoped override for `src/components/ui/**` (shadcn exports `*Variants` alongside components)
- **Commit 3 — `7504c3f`** `feat(frontend): typed API client + SSE streaming + zustand store`
  - `lib/types.ts` mirrors backend schemas + SSE event union
  - `lib/api.ts`: typed fetch client; `ensureLearner` recovers from 404 (DB wipes); `streamTurn` async generator hand-rolls SSE parsing on fetch + ReadableStream
  - `lib/store.ts`: zustand store for learner/profile/session/turns/live/decisions/earned/told
- **Commit 4 — `5ed1be8`** `feat(frontend): AccessibilityProfile onboarding route`
  - React Router wired; Bootstrap rehydrates cached learner before routes render
  - `/onboarding` with `<fieldset><legend>` per dimension, shadcn RadioGroup + Select, `aria-describedby` descriptions, aria-live preview card proving profile affects tutor phrasing
  - `lib/preview.ts` mirrors backend `to_prompt_guidance` precedence so UI preview matches server behavior
- **Commit 5 — `e7715f5`** `feat(frontend): chat route with SSE streaming + hydration`
  - Topic picker (text + 3 presets) + transcript + composer with Cmd/Ctrl+Enter; live bubble `aria-live="polite" aria-atomic="false"`
  - Hydration via parallel `getSessionTurns` + `getSessionState`; optimistic user bubble; focus returns to composer after each turn
  - SSE parser fix: event-boundary regex matches `\r\n\r\n` (sse-starlette default), `\n\n`, or `\r\r` — previous browser-side parser silently buffered CRLF streams forever and yielded zero events
- **Fix — `44a9a82`** `fix(frontend): endLiveTurn clears live bubble entirely`
  - Caught in browser verification: live bubble duplicated the canonical row after refresh because endLiveTurn was only flipping `streaming: false`. Now sets `live: null`.
- **Fix (implicit in Commit 6 pipeline)** — store-clearing bug in `setSession` during hydration: `TopicPicker` no longer pre-seeds store; hydration effect no longer calls `setSession` after `setTurns` (would wipe the turns). Turn counter switched from row count to `max(turn_number)` (user+assistant pair share one turn_number). Nested `<li>` collapsed.
- **Commit 6 — `0eee60b`** `feat(frontend): keyboard audit + tutor-reasoning debug panel + a11y baseline`
  - `DebugPanel` + `DebugPanelToggle` Switch-gated via `useDebugOpen` hook (localStorage-persisted); panel role=region aria-label="Tutor reasoning"; per-decision list, stats, Copy-as-JSON button
  - Static a11y audit: no positive tabindex, every button labeled, all inputs have `<Label htmlFor>`, aria-describedby on composer + radios, aria-busy on Send/Save/Start
- **Fix — `975fada`** `fix(a11y): drop focus-on-mount in onboarding so VoiceOver hears the preamble`
  - Caught during live VoiceOver sanity pass: auto-focus landed screen-reader users mid-form without hearing h1 or description
- ADRs 015–020 logged in `decisions.md`
- Session files under `.claude/memory/sessions/` (gitignored, local-only):
  - `2026-04-24-turns-hydration.md`
  - `2026-04-24-frontend-scaffold.md`
  - `2026-04-24-api-client-sse.md`
  - `2026-04-24-profile-onboarding.md`
  - `2026-04-24-chat-ui.md`
  - `2026-04-24-a11y-baseline.md`

## 2026-04-23 — Day 2 (5 commits on main)
- **Commit 1 — `98d81e4`** `feat(pedagogy): stubborn + misconceived personas, tighter earning + deliver_answer rules`
  - `validate_loop.py --persona {cooperative,stubborn,misconceived,all}` with persona × topic matrix, per-turn tool/hint-level tracking, `deliver_answer` flag
  - `prompts.py`: earning rules require "just demonstrated"; explicit L1→L2→L3 escalation; deliver_answer fires on earned prereqs OR 3+ verbatim "just tell me" requests
- **Commit 2 — `a965634`** `feat(backend): fastapi skeleton, async sqlite, domain models`
  - `pydantic-settings` config; async SQLAlchemy + aiosqlite + greenlet; 5 tables (learners/sessions/turns/earned_concepts/told_concepts); `/health`; CORS for 5173 & 3000
- **Commit 3 — `56436aa`** `feat(backend): learner and session CRUD endpoints`
  - POST/GET/PATCH learner, POST session (via `X-Learner-ID` header), GET `/session/{id}/state`; PATCH = overwrite semantics
- **Commit 4 — `8d1e8fe`** `feat(tutor): async loop with tool_result history + bookkeeping chain-through`
  - `history.build_user_message` / `rebuild_history` — pure replay from API-shaped blocks
  - `async_loop.stream_turn` yields `turn_start`/`tool_decision`/`concept_earned`/`concept_told`/`turn_end`; chain-through on bookkeeping-only responses
  - 5 unit tests (history) + 3 integration tests (async loop)
- **Commit 5 — `1d48da5`** `feat(api): SSE /session/{id}/turn + smoke + integration tests`
  - `EventSourceResponse` wrapper; per-event DB writes; user turn persisted before model call, assistant turn after `turn_end`
  - `scripts/smoke.sh`; `test_session_flow.py` with ASGITransport in-process; cooperative + scripted-stubborn asserting deliver_answer OR L3
- ADRs 007–014 logged in `decisions.md`

## 2026-04-22 — Day 1 scaffold
- Monorepo structure created
- CLAUDE.md and memory system seeded
- `socratic-tutor` skill drafted
- Socratic prompt + tool schemas written
- `validate_loop.py` runs the loop on 3 topics against Claude API
- First commit landed