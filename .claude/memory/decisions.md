# Architectural decisions

## ADR-001 — FastAPI over Flask
Date: 2026-04-22
Need async streaming to client (SSE/WebSocket) and clean Pydantic tool schemas. Flask adds friction for both. Decided: FastAPI.

## ADR-002 — No Agent SDK for MVP
The tutor loop is a single tool-use cycle per turn with explicit state in our DB. Agent SDK's orchestration is overkill and adds a dependency we don't need. Decided: use Anthropic Python SDK directly.

## ADR-003 — Skip MCP for week 1
MCP is a great stretch goal (expose learner progress as a server so any Claude client becomes a tutor) but would eat 1-2 days. Decided: defer to post-hackathon or day 7 if on-track.

## ADR-004 — Pedagogy lives in prompting, not content
We are not pre-authoring lessons. The Socratic loop is topic-agnostic. Differentiator is the prompt + tool contract + earned-vs-told tracking.

## ADR-005 — Accessibility profile affects prompt, not just UI
The `AccessibilityProfile` is threaded into the system prompt: reading grade level, chunk size, "always describe visuals verbally", pacing hints. Most teams would treat a11y as CSS only — we go deeper.

## ADR-006 — Model: claude-opus-4-7 for tutor
Date: 2026-04-22
Plan draft referenced `claude-opus-4-6` for the tutor, but the hackathon targets Opus 4.7 and that's the latest/most-capable Opus. Decided: use `claude-opus-4-7` for pedagogy; keep `claude-haiku-4-5-20251001` for the simulated-learner and cheap eval passes.

## ADR-007 — Session files named by implementation, not by day
Date: 2026-04-23
Day-number filenames (`day1.md`, `day2.md`) don't scale when a day produces 3–5 commits on different concerns. Switched to `YYYY-MM-DD-<implementation-title>.md`, one per commit when commits are meaningfully different work. Codified in `CLAUDE.md` and `.claude/memory/README.md`. Also: `.claude/memory/sessions/` plus `progress.md` and `next-steps.md` are gitignored — churny local context, not shared history.

## ADR-008 — SSE over WebSocket
Date: 2026-04-23
The tutor stream is one-way (server → client). SSE is simpler (plain HTTP), works fine with fetch-based clients via `ReadableStream`, and skips WebSocket ceremony. For the POST-with-body shape we use a streaming POST endpoint with `sse-starlette`'s `EventSourceResponse`; the browser side reads with `fetch` + `ReadableStream`, not `EventSource` (which is GET-only).

## ADR-009 — create_all on startup, no Alembic this week
Date: 2026-04-23
Schema churn is expected during a 7-day hackathon; blow away `sapientia.db` as needed. `db.init_db()` calls `Base.metadata.create_all` on FastAPI lifespan startup. Revisit Alembic post-hackathon.

## ADR-010 — Anonymous learners via X-Learner-ID header
Date: 2026-04-23
No auth for MVP. Client generates a UUID on first use and sends it back as `X-Learner-ID`. Server looks up the learner and 404s if unknown — no implicit upsert. The UUID is persisted client-side (localStorage) once Day 3 lands.

## ADR-011 — Server-side hint-level enforcement (pending implementation)
Date: 2026-04-23
Tool schema allows `level` ∈ {1,2,3} and the prompt now instructs the model to escalate 1→2→3. But the model can still jump ranks if prompt adherence slips. Plan: track last hint level per `concept_targeted` in the DB (new column or small table) and reject out-of-order escalations at the server. Deferred to Day 3+ when per-concept state management lands.

## ADR-012 — History stored in API-shaped message blocks
Date: 2026-04-23
`Turn.content` is the exact `content` array the Anthropic API received (user) or returned (assistant). Reconstruction is pure replay — no re-wrapping at request time. `build_user_message` is the only place that *creates* tool_result-paired content, and it runs BEFORE persistence so the DB already holds the correct shape for the next turn. This is the structural fix for Day 1's bug where plain-text learner messages followed tool_use assistant turns and triggered API 400s.

## ADR-013 — Chain-through on bookkeeping-only tool calls
Date: 2026-04-23
If a turn contains only `mark_concept_earned` (and no teaching tool), `stream_turn` extends history with that assistant turn + a synthesized `{"content":"ok"}` user message, then re-calls the model to force a teaching move. Bounded to 2 attempts before yielding an `error` event. This is the structural fix for Day 1's bug where a bookkeeping-only response left the caller with no user-visible teaching action.

## ADR-014 — Non-streaming API calls under the hood for Day 2
Date: 2026-04-23
`stream_turn` emits SSE events but calls `messages.create` without `stream=True` under the hood — tool-use assembly stays simple and robust across SDK versions. Day 3 can upgrade to token-level streaming with `messages.stream` and partial-block accumulation once a React UI can actually benefit from progressive rendering.

## ADR-015 — GET /session/{id}/turns for hydration, display-shaped not API-shaped
Date: 2026-04-24
Page refresh in the React UI needs to rebuild the transcript. Shipped a dedicated endpoint that returns `TurnOut[]` — `{turn_number, role, display_text, tool_used, created_at (ISO)}` — instead of leaking the API-shaped `content` blocks to the browser. The browser doesn't need the raw blocks (server rebuilds history from DB on every turn), and the display shape is leaner, less coupled to model internals, and easier to redact later if needed.

## ADR-016 — Hand-rolled SSE parser on the client
Date: 2026-04-24
`EventSource` is GET-only; our turn endpoint is POST-with-body. Considered `@microsoft/fetch-event-source` and a small async generator over `fetch` + `ReadableStream`. Chose the latter: ~40 lines, zero dependency, one-shot semantics (no reconnect, which we don't want on a completed turn). Event-boundary matches `\r\n\r\n` / `\n\n` / `\r\r` per spec — our first browser run silently swallowed every event because we only matched `\n\n` and sse-starlette emits `\r\n\r\n`.

## ADR-017 — Zustand for cross-route UI state
Date: 2026-04-24
Need cross-route state (learner, profile, session, live turn, debug decisions). Redux is overkill, `Context + useReducer` is more boilerplate than Zustand, TanStack Query doesn't fit (we have a streaming mutation, not a cacheable query). Zustand's `create` gives a single store with minimal ceremony; not load-bearing, trivial to migrate later. Store setters are stable references so selectors don't thrash effects.

## ADR-018 — Event-level streaming in Day 3; token streaming in Day 4
Date: 2026-04-24
`stream_turn` currently emits at `tool_decision` granularity (inherited from ADR-014). In the UI that produces "announcement bursts" — the whole tutor question appears and is announced in one go — rather than progressive reveal. Acceptable as a Day 3 baseline because `aria-live="polite" aria-atomic="false"` renders both cleanly. Day 4 upgrades to `messages.stream` with partial-block accumulation for token-level streaming, at which point the `applyDecision` reducer needs to append rather than replace on deltas.

## ADR-019 — AccessibilityProfile is edited, not just set once
Date: 2026-04-24
Users will toggle settings mid-session (turn on plain-language when a topic feels too dense, switch to ADHD-focus when scaffolding feels busy, etc.). `/onboarding` is reachable at any time from the chat header. `PATCH /learner/{id}/profile` has overwrite semantics — the whole profile is sent; partial-merge was considered and rejected as fiddly for a small profile where the UI always has the full state anyway. Driven client-side by shadcn RadioGroup per dimension + a live preview card that mirrors backend `to_prompt_guidance` so users see *what* changes before committing.

## ADR-020 — No auto-focus on form mount
Date: 2026-04-24
Removed the focus-on-first-radio effect from `/onboarding`. Caught during the VoiceOver sanity pass: auto-focus landed screen-reader users mid-form without hearing the h1 ("Tell me how you learn best") or the "accessibility is not a skin" description — exactly the preamble that justifies the form. Sighted keyboard users pay one extra Tab to reach the first control; screen-reader users get the context they need to understand what they're filling out. Rule going forward: don't steal focus away from document top on route mount unless there's a specific reason tied to keyboard-driven workflows (e.g., a modal opening).

## ADR-021 — Drop `hearing` profile dimension, reserve slot for motor / voice-control stretch
Date: 2026-04-25
The Day 1 scaffold included a `hearing: 'deaf' | 'hoh' | 'none'` field in `AccessibilityProfile`. By Day 4, nothing on the backend branched on it — `to_prompt_guidance` had no hearing-specific clause — and the UI layer only needed visible captions, which the app already provides by being text-first and fully on-screen. Deaf/HoH learners already have parity without a dedicated layer.

Removed the field from `backend/app/schemas/profile.py`, `frontend/src/lib/types.ts` (+ `defaultProfile`), `frontend/src/lib/preview.ts`, and the `RadioField` in `Onboarding.tsx`. Added `ConfigDict(extra="ignore")` to `AccessibilityProfile` so existing dev-DB learner rows with `{"hearing": "deaf"}` JSON still round-trip without raising. Added `backend/tests/test_profile.py` covering defaults, extra-ignore, round-trip, and `to_prompt_guidance` flags.

The slot was reallocated to a **motor / voice-control stretch** (users who cannot use a keyboard or mouse). This is explicitly a Day 7 scope item: full-page voice navigation is a different UX problem — command grammar, state machine, barge-in — that would derail Day 4–6 if undertaken now. Day 4 still adds STT push-to-talk in the composer, which is a narrower slice of the same space but doesn't claim to be motor-accessible overall.

## ADR-022 — Dual ARIA live regions (polite transcript, assertive milestones)
Date: 2026-04-25
Screen-reader learners need both the streaming tutor text *and* pedagogy milestones (`concept_earned`, `concept_told`) announced, but with different priorities. Originally both went through polite regions (`<ol role="log">` for the transcript, `aria-live="polite"` on `EarnedFlash`) which caused the milestone to queue *behind* the rest of the sentence — by the time "Concept earned: derivatives" landed, the user had moved on.

Shipped `src/components/LiveAnnouncer.tsx` — a single sr-only `role="alert" aria-live="assertive"` node mounted once in `Chat.tsx`. A Zustand subscription watches `earned`/`told` and writes a short 8-word-ish sentence into the node when a new item arrives; the text clears after ~4s so the DOM doesn't accumulate stale announcements that AT might re-read on focus changes. `EarnedFlash` lost its `aria-live` (now `aria-hidden="true"`) — it stays visible for sighted users, SRs get the announcement via `LiveAnnouncer` without double-firing. Transcript stays `<ol role="log">` (implicit polite) for the streaming text.

Same watermark-rebase pattern as the TTS earned/told hook: shrinking the array (resetSession on new topic) rebases the count so the first announcement of a new session still fires.

## ADR-023 — Shift+Space for push-to-talk, not bare Space + 200ms
Date: 2026-04-25
The Day 4 plan offered two STT keyboard shortcuts: bare Space held for ≥200ms (with a timer gate), or a modifier like Alt+Space. Chose **Shift+Space** (same modifier family as the plan's alternative). Reason: bare Space-hold requires either delaying every typed space via `preventDefault`-then-maybe-insert (noticeable typing latency in prose) or retroactively deleting the already-inserted space when the 200ms fires (race-prone and cursor-position-sensitive with controlled textarea inputs). Shift+Space has no typing conflict, its `preventDefault` keeps the space out of the value cleanly, and the walkie-talkie mental model is preserved.

Global `keydown`/`keyup` listeners with an `activeElement === composerRef.current` guard — rather than composer-scoped — so out-of-order release (user lifts Shift before Space or vice versa) doesn't leave the mic hot. Click-toggle on the MicButton remains the primary interaction; the keyboard shortcut is for power users. Firefox (no `SpeechRecognition`) hides the button and the shortcut is a no-op.

## ADR-024 — Profile-default TTS, persisted only on explicit toggle
Date: 2026-04-25
`useTtsEnabled(profile)` defaults to `true` for `visual=low-vision` and `false` otherwise (screen-reader users already have SR audio; auto-playing `SpeechSynthesis` on top causes clash, so they opt in). First impl eagerly wrote the initial value to localStorage on mount, which pinned first-time users to whatever the profile default was at boot and prevented later profile edits from flipping the toggle.

Fixed pattern: only persist on explicit calls to the setter. On mount, seed state from stored value if present, else from `defaultTtsEnabled(profile)`. Detect profile changes during render (React's "adjust state during render" pattern, not useEffect) and re-apply the profile default if the user has never expressed a preference. Storage key bumped to `sapientia.ui.ttsEnabled.v2` to discard the buggy values written by the v1 implementation.

Same principle extends to future a11y toggles: profile-driven default + explicit-only persistence so stored user choices outrank profile defaults, but the default path stays live for fresh setups.

## ADR-025 — Structured prompt fragments instead of a flat bulleted a11y block
Date: 2026-04-26
`AccessibilityProfile.to_prompt_guidance` used to append one-line bullets per axis into a flat list. That worked through Day 4 because each axis was mostly orthogonal (visual = describe-verbally, learning = sentence length, pacing = cadence). Day 5 tightened the demands on `cognitive=plain-language` — grade-5 register, define-on-first-use vocabulary, sentence cap, simple interaction style — and stacking those against `learning=adhd-focus` (one question per turn) started to produce contradictory instructions: "3 short sentences" on one bullet, "one question per turn" on another, no acknowledgement that they combine.

Refactored into named slots: `register`, `chunking`, `vocabulary`, `interaction_style`, `pacing`. Each profile axis contributes fragments into slots; multi-contributor slots (e.g., `interaction_style` fed by both `visual=screen-reader` and `cognitive=plain-language`) concatenate. The one slot where contributors genuinely conflict — `chunking` between plain-language and adhd-focus — has an explicit composition rule that emits **one merged fragment** ("Cap each turn at 3 short sentences AND at most one question. No multi-part questions.") instead of two contradictory bullets. Rendered as `- **Slot:** text` with a fixed slot order so snapshot tests stay stable. The jargon rule moved from the global anti-patterns block into the `vocabulary` fragment for symmetry; global anti-patterns are now only profile-agnostic rules. `to_prompt_guidance()` kept its string return type for backward compat, so the single call site in `build_system_prompt` is unchanged.

## ADR-026 — Soft prompt nudge for `progress_summary`, not hard tool injection
Date: 2026-04-26
When the learner has accumulated N unrecapped earned concepts, the tutor should consolidate via `progress_summary` before moving on. Two designs considered:

- **Hard tool injection**: swap `tool_choice` from `{"type": "any"}` to `{"type": "tool", "name": "progress_summary"}` on the next `messages.stream` call. Deterministic, but brittle — if the learner just said "I'm confused, wait", we'd force a recap anyway. Rejected.
- **Soft prompt nudge** (shipped): when `unrecapped >= threshold`, append a `## Pacing nudge` block to the system prompt for that turn only. Model still chooses freely; the nudge gives permission + a concept count + a reminder.

`maybe_recap_nudge(unrecapped, threshold=3, max_over_threshold=6)` returns the block; the threshold is exposed as a param so Commit 5's "Recap so far" button can call it with `force=True` to switch to a stronger directive ("learner EXPLICITLY asked, do it now"). There's a cap: if the model ignores the nudge past `threshold + max_over_threshold` earnings, suppress — we don't nag forever. The unrecapped count comes from the session router walking already-loaded `session.turns` for the newest `tool_used='progress_summary'` timestamp and counting `earned.created_at > that`. No extra queries; watermark survives DB wipes only if the session does, which is fine for the hackathon.

`progress_summary` joined `TEACHING_TOOLS` in `async_loop.py` so a recap-only turn doesn't trigger chain-through (ADR-013) — recap IS a valid terminal teaching move. `PRIMARY_TEXT_FIELDS` got `summary` so the text_delta stream surfaces recap prose the same way it surfaces question/hint/answer, and `extract_primary` falls through to `summary` so the persisted `Turn.display_text` carries the recap verbatim. A soft `max-sentences-exceeded` violation fires for `cognitive=plain-language` teaching turns whose prose exceeds 3 sentences — surfaces drift in the existing violations channel without blocking the turn.

## ADR-027 — Cognitive theme is orthogonal to the high-contrast theme
Date: 2026-04-26
`[data-theme='high-contrast']` and `[data-cognitive='plain-language']` compose cleanly — a learner with `cognitive=plain-language` in high-contrast should get AAA colors + big-type layout, not one or the other. Both live in `index.css` as independent attribute selectors on `<html>`, set by independent hooks (`useTheme` tri-state and `useCognitiveMode`). No CSS variable is overridden in both blocks; `data-cognitive` only touches `font-size`, `line-height`, `*:focus-visible`, and transcript-bubble geometry (max-width 60ch + vertical padding). `data-theme` only touches the palette variables.

Rule going forward: accessibility layers land as orthogonal data attributes + CSS blocks. If a future axis needs to override a variable also touched by another layer (e.g. a dyslexia-font layer that needs to raise line-height further), we'll document the precedence (last-selector-wins under equal specificity) and keep the blocks colocated in `index.css` so the cascade order is auditable in one place. The `useCognitiveMode` hook cleanup removes the attribute on unmount so tests don't leak state between renders — mirroring the pattern `useTheme` uses, with the caveat that in prod the hook lives for the whole app's lifetime and cleanup matters mostly for vitest.

## ADR-028 — Atkinson Hyperlegible as the dyslexia-font choice
Date: 2026-04-27
Three candidates were on the table: OpenDyslexic, Lexend, and Atkinson Hyperlegible. **Atkinson Hyperlegible** wins.

- **OpenDyslexic** is the recognizable "dyslexia font" but it's polarizing — some dyslexic readers find it *harder* to read, the heavy bottom weight reads as cartoonish at smaller sizes, and the typeface is less actively maintained than the other two. Strong visual differentiation ("I switched it on") doesn't outweigh those drawbacks for a tool that's meant to actually help.
- **Lexend** has real research backing on reading proficiency and ships as a variable font, but the variable-axis flow is overkill for our single-toggle UX, and the wider default glyph set adds bytes we don't need.
- **Atkinson Hyperlegible** was designed by the Braille Institute for low-vision readers. Its glyph distinctions (mirror-image letters, similar-shaped digits) help dyslexic readers too, the metrics compose cleanly with the cognitive-mode 17px / 1.7 type scale (it runs slightly smaller than system-ui — see ADR-029), and the SIL OFL 1.1 license has straightforward redistribution terms.

We self-host (one woff2 per weight/style — Regular, Bold, Italic, BoldItalic — under `frontend/public/fonts/atkinson-hyperlegible/`) instead of using Google Fonts at runtime. Self-hosting avoids the privacy footprint of a third-party CDN, keeps the fonts loadable offline, and makes the build artifact self-contained. OFL.txt ships alongside the woff2 files (license requirement). Latin-only subset; non-Latin content falls back to the next family in `--font-dyslexia`. Only Regular is preloaded in `index.html`; Bold and Italic load on demand. OpenDyslexic remains a candidate for a post-hackathon user-selectable option.

## ADR-029 — Cap body font-size at 17px when cognitive + dyslexia stack
Date: 2026-04-27
`cognitive=plain-language` bumps body to `font-size: 17px; line-height: 1.7`. `learning=dyslexia-font` swaps `font-family` to Atkinson + adds light letter/word spacing. The open question from Day 5 next-steps was: when both axes fire, does Atkinson's metrics + cognitive's 17px push composed text into oversized territory?

**Resolution: cap body at 17px regardless of layer.** Atkinson runs slightly smaller than system-ui at the same `font-size`, so the composed experience at 17px is comfortable, not oversized. The dyslexia layer therefore does NOT add another `font-size` bump on top — it only nudges `line-height` from 1.7 → 1.75 to accommodate Atkinson's slightly different vertical metrics. The CSS expresses this with a compound selector `[data-learning='dyslexia-font'][data-cognitive='plain-language'] body { line-height: 1.75; }` — the compound selector beats either single-attribute selector under cascade tie-breaking, so the rule lands last and wins.

If a third layer ever wants to bump the type scale further (e.g. `learning=large-print` someday), it joins the same compound-selector chain rather than fighting either component. Document precedence inline in `index.css`; future contributors should not need to read the whole file to understand which line-height wins.

## ADR-030 — Opacity-only soft-fade for ADHD-focus, never aria-hidden on transcript items
Date: 2026-04-27
`learning=adhd-focus` fades transcript items older than the most-recent four (`ol[role='log'] > li:nth-last-child(n+5)`) to 0.55 opacity, restoring full opacity on hover/focus-within. The fade is **purely visual** — it reduces cognitive load for sighted ADHD learners reviewing the live exchange.

**Critical access rule, codified here so future contributors don't accidentally regress it:** `aria-hidden` MUST NEVER be applied to transcript items, no matter how well-meaning the change. CSS `opacity` does not hide content from screen readers; sighted ADHD users get the visual filter while blind / low-vision users still walk the full conversation log. Combining opacity with `aria-hidden` would silently strip half the transcript from SR users to make a sighted-only feature "consistent" — that's exactly the trap an a11y-conscious team has to refuse explicitly.

The `:hover, :focus-within` opacity restore is also load-bearing: a sighted keyboard user who tabs into an older bubble (say, to copy text) gets full visibility back. Same principle as the ADHD-focus chord (Shift+M minimize): the layer reduces noise, never information access. If we ever want to actually omit older turns from the rendered DOM (rather than fade them), that's a different feature — it would need a "Show full history" toggle and a different commit.

## ADR-032 — Voice command grammar is fixed-keyword, not freeform
Date: 2026-04-28
The motor / voice-control layer (Day 7 Commit 2) ships a 9-intent grammar — `recap`, `send`, `pacing-slow`, `pacing-normal`, `tts-on`, `tts-off`, `cancel`, `minimize-on`, `minimize-off` — parsed by `lib/voice-commands.ts:parseCommand` via normalize → exact-match → length-sorted prefix-match. Each intent has 1–3 phrases (`stop` / `cancel`, `slow down` / `slower`, etc.) so the learner can pick the wording that feels natural without hitting a parser cliff.

**Why fixed grammar instead of freeform NLU:**
- **Predictable.** Learners learn the vocabulary in 30 seconds; "what can I say?" is answered by a 7-item list in the no-match banner.
- **Testable.** `parseCommand` is a pure function with deterministic inputs and outputs. The hook lifecycle is mocked at the recognizer boundary; we don't need to test against a model or a corpus.
- **Cheap.** No second model call to interpret transcripts. The Web Speech API gives us free transcription; a 60-line lookup turns it into actions.
- **Safe.** The grammar can't accidentally fire a destructive action — every phrase maps to a known reversible UI state change. A freeform parser could mis-route "delete my session" to a real endpoint.

**Why prefix-match, not just exact-match:** real speech recognition transcripts often have trailing fillers ("stop please", "recap quickly"). The length-sorted prefix-match table guarantees longer phrases win — `stop reading` (tts-off) beats `stop` (cancel) because it's sorted first. Exact-match runs first to avoid the prefix table firing for a phrase that's both a complete utterance AND a prefix of another (e.g. `stop` is exact-match cancel; `stop reading` is exact-match tts-off; the prefix loop only catches `stop please`).

If a future session shows users hitting the no-match path repeatedly with paraphrases ("read it back to me" instead of "read aloud"), expand the phrase list — don't pivot to NLU. The post-hackathon backlog calls out freeform parsing + multi-step intents (`go back two turns`) as a Day 7+1 problem.

## ADR-033 — Voice "minimize" routes through useMinimizedUi (single source of truth)
Date: 2026-04-28
The minimize-UI toggle has three activation paths: the `MinimizeToggle` button click, the `Shift+M` keyboard chord (handled in `useMinimizedUi` itself), and now the `minimize-on` / `minimize-off` voice commands (Day 7 Commit 3). All three MUST converge on the same setter — `useMinimizedUi`'s `update` callback — and never write to `localStorage` directly.

**Why this matters:** the hook's persistence rule is non-trivial (ADR-024 explicit-only-persistence — profile sets the default; storage rules after explicit toggle; profile flips re-apply default only when no stored preference exists). If the voice path bypassed the hook and wrote `localStorage.setItem('sapientia.ui.minimized', '1')` directly, three things break:
1. **State desync.** React doesn't observe the localStorage write; the hook's internal `minimized` state stays stale until something forces a re-read.
2. **Persistence semantics drift.** The hook decides when to persist (only on explicit toggles); a voice path that always persists turns "voice-driven minimize" into a pinned preference even if the user wanted it ephemeral.
3. **CSS-attribute lag.** The hook's `useEffect` is what applies/removes `data-focus-minimized` on `<html>`. Bypass the hook, the attribute never updates, the CSS hide doesn't trigger.

The `useVoiceCommandDispatch` hook receives `setMinimized` (the hook's `update` fn) as a dep and calls it directly for both `minimize-on` and `minimize-off` intents. The voice path is now structurally indistinguishable from the chord and the click — same call site, same persistence, same render. If we ever add a fourth path (gesture, remote command), it joins the same convergence point.

This rule is structurally identical to the React philosophy of "lift state up": the toggle's truth lives in the hook, and every actuator must dial *that* dial, not its own. It's stated as an ADR rather than a code comment because the failure mode (silent desync) is exactly the kind of regression that gets re-introduced when a future contributor "helpfully" inlines a localStorage write to "skip the boilerplate."
