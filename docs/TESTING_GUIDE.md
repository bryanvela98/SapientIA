# SapientIA — Manual testing guide

A walk-through to exercise every shipped feature: the backend pedagogy
loop, the four delivered a11y layers (visual, cognitive, learning
disabilities, motor/voice-control), and the soft enforcement violations.

This guide assumes the repo at HEAD of Day 7 (commits through `9a2ee42`).
Backend 47/47 pytest, Frontend 92/92 vitest, all green.

---

## 0. Prerequisites

- **macOS or Windows** with a modern Chromium-based browser (Chrome,
  Edge, Brave). Some features fall back gracefully on Firefox/Safari but
  STT and SpeechRecognition need Chromium.
- **Anthropic API key** with access to `claude-opus-4-7` and
  `claude-haiku-4-5-20251001`.
- **Python 3.11+** and **Node 20+**.
- A working microphone (for TTS/STT/voice-command tests).

---

## 1. One-time setup

### Backend

```bash
cd SapientIA/backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
```

### Frontend

```bash
cd SapientIA/frontend
npm install
```

---

## 2. Run the automated test suites first

Confirm a clean baseline before touching the UI.

```bash
# Backend
cd SapientIA/backend
source .venv/bin/activate
pytest tests -q
# Expected: 47 passed in <ms>
```

```bash
# Frontend
cd SapientIA/frontend
npm run test:ci
# Expected: 92 passed
npx tsc --noEmit            # clean
npm run lint                 # clean
npm run build                # clean
```

If any of the four steps above fails, stop and investigate before
running the manual UI tests — a regression in the suite usually points
at the same defect the manual checks would surface.

---

## 3. Optional — run the offline pedagogy validator

`validate_loop.py` runs a simulated learner against the real model,
useful for sanity-checking prompt changes without a UI.

```bash
cd SapientIA/backend
source .venv/bin/activate

# Cooperative learner, default profile, 3 topics
python scripts/validate_loop.py

# Stubborn persona — should escalate hint level + eventually deliver_answer
python scripts/validate_loop.py --persona stubborn

# Misconceived persona — should diagnose then correct
python scripts/validate_loop.py --persona misconceived

# Cognitive plain-language profile — capture per-turn avg words/sentence
python scripts/validate_loop.py --persona cooperative --profile cognitive-plain-language
```

Look at the per-turn telemetry: `tool_used`, `hint_level`, `delivered`,
average words per sentence. Plain-language target is ≤ 15 w/s; if
`max-sentences-exceeded` fires on > 20% of turns, register-fragment
tightening goes on the backlog.

This step costs Anthropic API credits — skip if budget is tight.

---

## 4. Start the app for manual testing

Two terminals.

```bash
# Terminal 1 — backend
cd SapientIA/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend
cd SapientIA/frontend
npm run dev
# Vite serves at http://localhost:5173
```

Open `http://localhost:5173` in Chrome.

---

## 5. Smoke tests (default profile)

The first time you load the app:

1. You land on `/onboarding`. Page should announce the h1 ("Tell me how
   you learn best") and the description before any radio is focused —
   no auto-focus on form mount (ADR-020).
2. Leave every dimension at its default. Click **Save**. You should be
   redirected to `/chat`.
3. **Topic picker.** Type a topic (e.g., "derivatives in calculus") or
   click one of the three preset buttons. Click **Start**.
4. **First tutor turn.** A live bubble should appear and stream
   token-by-token (not in one burst — token-level streaming via Day 4
   Commit 2). The text should be a Socratic question, not an answer.
5. **Answer the question** in the composer. Send with Cmd/Ctrl+Enter.
6. Continue the dialogue for ~6–8 turns. Check:
   - Bubbles never duplicate after streaming (no orphan live bubble).
   - Concept badges appear in the header when the tutor calls
     `mark_concept_earned`.
   - The transcript persists if you refresh the page (hydration via
     `GET /session/{id}/turns`).
7. **Open the DebugPanel.** Toggle the "Tutor reasoning" Switch in the
   header. Each turn shows: tool used, hint level, concept targeted,
   raw input. Click **Copy as JSON** — clipboard should hold the
   per-turn list.
8. **New topic.** Click "New topic" link. Earned/told badges clear.
   Live announcer's watermark rebases — first earned of the new
   session still announces.

If steps 1–8 work, baseline pedagogy + UI are healthy.

---

## 6. Visual impairment layer (Day 4)

### 6a. High-contrast theme

1. In the chat header, click the **Theme** select → "High contrast".
2. Page recolors to black/white/saturated-yellow rings (WCAG AAA).
3. `*:focus-visible` outlines remain visible against the new palette.
4. Switch back to "System".

### 6b. Skip link

1. Reload the page.
2. Press **Tab** as the very first key. A "Skip to composer" link
   appears at the top-left.
3. Press **Enter** — focus jumps to the composer textarea.

### 6c. TTS (synthesized speech)

1. In the **Visual** dimension on `/onboarding`, pick **Low vision**.
   Save.
2. The chat header now shows the TTS toggle ON (profile default per
   ADR-024).
3. **AudioArmBanner** appears the first time, asking you to interact
   with the page so the browser autoplay policy unlocks
   `SpeechSynthesis`. Click anywhere or press a key — the banner
   dismisses.
4. Send a message. The tutor's response should be **spoken** as it
   streams, sentence by sentence (not one big burst — sentence-buffered
   per `useTtsForLiveTurn`).
5. **Press K** outside the composer. TTS pauses. Press **K** again — it
   resumes (`useTtsKeyboard`).
6. Toggle the TTS Switch off mid-sentence — speech should cancel
   immediately.
7. **Concept earned audio.** When the tutor fires
   `mark_concept_earned`, you should hear "Concept earned: [name]"
   queued after the current utterance.

### 6d. STT (push-to-talk)

1. In the composer, **hold Shift+Space** (Chromium only — Firefox
   hides the mic button).
2. The pulsing red **ListeningBanner** appears with `aria-live=
   "assertive"`.
3. Speak a sentence. Interim results preview below the textarea.
4. Release Shift+Space — final transcript inserts at the cursor in the
   composer.
5. **TTS-cancels-STT.** With TTS playing, hold Shift+Space — TTS
   silences immediately so the mic doesn't pick up the synth voice.
6. Click the MicButton (no keyboard) — same lifecycle as the chord.
7. **Out-of-order release.** Hold Shift+Space, release Shift first —
   recognizer still stops cleanly (the listener uses
   `activeElement === composer` rather than scoped events).

### 6e. Screen reader (VoiceOver / NVDA)

This is the deferred verification audit. The session-file template
lives at `.claude/memory/sessions/2026-04-27-verification-audit.md`.
Capture results there.

1. **macOS VoiceOver:** Cmd+F5. Walk `/onboarding` then `/chat`.
   - Confirm h1 + description announce before any radio.
   - Confirm `<ol role="log">` walks each turn chronologically.
   - Confirm `LiveAnnouncer` announces "Concept earned: derivatives"
     assertively when a concept fires (interrupts the polite
     transcript).
2. **Windows NVDA + Firefox:** STT button hidden (Firefox lacks
   SpeechRecognition); everything else parity with macOS.
3. **Lighthouse desktop accessibility ≥ 95** on `/onboarding` and
   `/chat` for both default and `cognitive=plain-language` profiles.
4. **axe-core zero violations.** Use the browser extension on both
   routes.

---

## 7. Cognitive layer (Day 5)

### 7a. Plain-language prompt

1. On `/onboarding`, set **Cognitive** → "Plain language". Save.
2. Pacing auto-bumps to **Slow** (only when previously Normal) with an
   inline note. Override pacing manually — note clears.
3. Start a chat session. The tutor's prose should now be **noticeably
   shorter** (≤ 15 words/sentence target, grade-5 register, define-on-
   first-use vocabulary).
4. Open the DebugPanel. The system prompt now contains a `## How this
   learner needs information delivered` block with the 5 named slots
   (`register`, `chunking`, `vocabulary`, `interaction_style`,
   `pacing`).

### 7b. Soft `max-sentences-exceeded` violation

1. Drive the session toward a complex topic where the model is tempted
   to over-explain (e.g., "explain how mitochondria produce ATP").
2. If the assistant turn exceeds 3 sentences, the DebugPanel should
   show a `violations: ["max-sentences-exceeded"]` entry on that
   decision row. Telemetry only — turn still rendered.

### 7c. Recap nudge after 3 earned

1. Continue until the **earned-concept counter ≥ 3** without a recap.
2. The next system prompt gains a `## Pacing nudge` block (visible in
   DebugPanel).
3. The tutor should call `progress_summary` within 1–2 turns. The
   recap renders as a **RecapBubble** (left-accent border, "Recap"
   label, concept bullet list, "Next:" line).
4. RecapBubble has `aria-live="polite"` (not assertive) — VoiceOver
   waits for the current sentence before reading.

### 7d. Manual "Recap so far" trigger

1. Click the **RecapButton** in the session card header.
2. The button is **disabled until earned > 0** (with explanatory
   tooltip on hover) and disabled while streaming.
3. Click forces a recap mid-session — the system prompt that turn
   carries a strong directive ("learner EXPLICITLY asked, do it now").
4. Click fires a synthetic `[user requested recap]` user turn so the
   intent is persisted in the transcript.

### 7e. Pacing toggle

1. Toggle the **PacingToggle** Switch in the session card header.
2. Optimistic UI flip + `PATCH /learner/{id}/profile` fires.
3. Verify in DebugPanel the next system prompt's `pacing` slot
   reflects the new value.

### 7f. Cognitive theme orthogonal to high-contrast (ADR-027)

1. Set Cognitive = plain-language AND Theme = high-contrast
   simultaneously.
2. Body should be 17px / 1.7 line-height **and** AAA black/white/yellow
   palette. Both compose.
3. Bubble max-width is 60ch with extra vertical padding.
4. `*:focus-visible` shows the 3px outline + 3px offset against the
   high-contrast palette.

---

## 8. Learning disabilities layer (Day 6)

### 8a. Atkinson Hyperlegible dyslexia font

1. On `/onboarding`, set **Learning** → "Dyslexia-friendly". Save.
2. Open DevTools → Network → Fonts. Reload.
3. **`/fonts/atkinson-hyperlegible/Regular.woff2`** should fetch with
   200 status (preloaded). Bold and Italic load on demand.
4. Body font is **Atkinson Hyperlegible** with 0.02em letter-spacing
   and 0.06em word-spacing.
5. Stack Cognitive = plain-language + Learning = dyslexia-font:
   - Body stays at **17px** (cap from ADR-029).
   - Line-height nudges from 1.7 → **1.75** (compound selector).
6. Bubble overflow at 60ch max-width — line count grows but no
   truncation.

### 8b. ADHD-focus older-turn fade

1. On `/onboarding`, set **Learning** → "ADHD focus". Save.
2. The MinimizeToggle button is now visible AND the ADHD-focus minimize
   default is ON (per profile default + ADR-024).
3. Drive the session past **5 turns**.
4. List items 5+ from the bottom should **fade to opacity 0.55** with
   a 0.3s transition.
5. **Hover** an old bubble — opacity restores to 1.0.
6. **Tab** into an old bubble (focus-within) — opacity restores.
7. **Critical access check:** with VoiceOver on, walk the transcript.
   The faded bubbles **must still announce** — opacity is visual-only,
   no `aria-hidden` (ADR-030). If SR skips the older turns, that's a
   regression.

### 8c. Shift+M minimize chord

1. Press **Shift+M** outside the composer. Header chrome collapses:
   ThemeToggle, TtsToggle, DebugPanelToggle, Edit-profile,
   PacingToggle, RecapButton — all hidden.
2. Always visible: app title, ConceptBadges, New-topic, MinimizeToggle,
   transcript, composer, SkipLink.
3. Press **Shift+M** again — chrome restores.
4. Click the MinimizeToggle button — same toggle. `aria-pressed`
   reflects state.
5. **Inside the composer**, press Shift+M — capital "M" types
   normally; UI does NOT toggle (activeElement guard).
6. Plain "m" (no Shift) — also no-op everywhere.
7. **Refresh the page.** State persists per ADR-024 explicit-only-
   persistence rules.

### 8d. Soft `max-questions-exceeded` violation

1. With Learning = adhd-focus active, drive the tutor toward
   multi-question turns ("explain X, but also tell me Y").
2. If a teaching tool's primary prose exceeds **1 question mark**, the
   DebugPanel should show a `violations: ["max-questions-exceeded"]`
   entry. `progress_summary` and `deliver_answer` are excluded.

---

## 9. Motor / voice-control layer (Day 7)

This is the ADR-021 reallocated slot. **Chromium-only** (uses Web
Speech `SpeechRecognition`).

### 9a. Activation

1. Outside the composer, **hold Shift+V**. The recognizer arms; the
   blue/emerald **VoiceCommandBanner** appears with an assertive live
   region.
2. Voice activation **cancels in-flight TTS immediately** (barge-in
   per Day 4 Commit 5 mirror). If TTS was playing, it silences before
   the mic opens.
3. Inside the composer, Shift+V types capital "V" normally — guard
   inverted from STT (commands fire OUTSIDE inputs).
4. Click the **VoiceCommandButton** for click-driven activation.

### 9b. The 9-intent grammar (ADR-032)

Hold Shift+V, speak each phrase, release. After release the parser
runs; on success the banner shows the heard intent + a check, then
returns to idle.

| Intent | Phrases | Effect |
|---|---|---|
| `recap` | "recap" / "summarize" / "summary" | Forces `progress_summary` (mirror of RecapButton). |
| `send` | "send" / "submit" | Submits whatever's in the composer. |
| `pacing-slow` | "slow down" / "slower" | PATCHes profile pacing → slow. |
| `pacing-normal` | "speed up" / "faster" / "normal speed" | PATCHes profile pacing → normal. |
| `tts-on` | "read aloud" / "start reading" | Arms audio THEN enables TTS (autoplay-policy ordering). |
| `tts-off` | "stop reading" / "quiet" / "silent" | Disables TTS AND calls `cancelTts`. |
| `cancel` | "stop" / "cancel" / "never mind" | Cancels TTS + stops recognizer. |
| `minimize-on` | "minimize" / "hide controls" | Routes through `useMinimizedUi` (ADR-033). |
| `minimize-off` | "restore" / "show controls" / "maximize" | Same hook setter. |

### 9c. Prefix-match precedence

1. Say **"stop reading"** — should fire `tts-off` (longer phrase wins
   length-sorted prefix-match), NOT `cancel`.
2. Say **"stop please"** — should fire `cancel` via prefix-match
   (no exact match for "stop please"; "stop" matches as a prefix).
3. Say **"recap quickly"** — should fire `recap` via prefix-match.
4. Say **"banana"** — banner shows the no-match error with the help
   list of valid phrases for ~3s, then returns to idle.

### 9d. Single-source-of-truth check (ADR-033)

1. Activate adhd-focus profile. UI is minimized by default.
2. Hold Shift+V, say **"restore"** — chrome restores.
3. Press **Shift+M** — chrome minimizes again.
4. Click the **MinimizeToggle** button — chrome restores.
5. All three paths flow through the same `setMinimized` hook setter;
   `data-focus-minimized` attribute on `<html>` updates each time;
   localStorage persistence rule from ADR-024 stays consistent.

### 9e. State-machine timing

1. After a successful parse, the banner flashes "parsed" for ~250ms,
   then "dispatched" with a check for ~800ms, then returns to idle.
2. After an unmatched phrase, the error banner stays for ~3s with the
   help list, then idle.
3. Recognizer error (mic permission denied, no-speech timeout) shows
   the friendly message verbatim and resets after 3s.

---

## 10. Stacked worst-case profile

The deferred Day 7 Commit 4 walk-through. Manual run:

1. On `/onboarding`, set **all four axes**:
   - Visual = `screen-reader`
   - Cognitive = `plain-language`
   - Learning = `adhd-focus`
   - Pacing = `slow`
2. Save.
3. Drive a 5-turn cooperative session.
4. **Capture in the verification audit session file:**
   - Per-turn `violations` from DebugPanel.
   - Avg words/sentence per assistant turn.
   - Whether `max-sentences-exceeded` or `max-questions-exceeded`
     fired on > 20% of turns.
   - VO + Shift+V interaction — they must not collide. Voice command
     activation cancels TTS *and* doesn't fight VoiceOver's own
     keyboard navigation.
5. If violations exceed the threshold, the fix is to **shrink fragment
   wording** in `backend/app/schemas/profile.py` rather than dropping
   fragments — the prompt structure is load-bearing for the other
   axes.

---

## 11. Backend pedagogy spot-checks

While running the chat, in a third terminal:

```bash
# Watch the SQLite DB grow as you chat
sqlite3 SapientIA/backend/sapientia.db "SELECT id, role, tool_used, turn_number, datetime(created_at) FROM turns ORDER BY id DESC LIMIT 10;"
```

```bash
# Hit the API directly to confirm hydration shape
LEARNER_ID=$(sqlite3 SapientIA/backend/sapientia.db "SELECT id FROM learners ORDER BY rowid DESC LIMIT 1;")
SESSION_ID=$(sqlite3 SapientIA/backend/sapientia.db "SELECT id FROM sessions WHERE learner_id='$LEARNER_ID' ORDER BY rowid DESC LIMIT 1;")

curl http://localhost:8000/session/$SESSION_ID/turns | jq
curl http://localhost:8000/session/$SESSION_ID/state | jq
```

Confirm `display_text` is plain text (not API-shaped content blocks);
`turn_number` shared between user/assistant pairs; ISO timestamps with
Z suffix.

---

## 12. Regression checklist (quick)

After any UI change, run through this 10-item list:

- [ ] Onboarding does not auto-focus first radio (ADR-020).
- [ ] Theme select still has all three states.
- [ ] Tab order: SkipLink → composer (no positive tabindex anywhere).
- [ ] EarnedFlash is `aria-hidden=true`; LiveAnnouncer is
      `role=alert aria-live=assertive` (no double-announce).
- [ ] TTS toggle persists across reload but re-derives from profile
      until first explicit click.
- [ ] STT button hidden in Firefox, present in Chromium.
- [ ] Cognitive 17px / 1.7 stacks correctly with high-contrast palette.
- [ ] Atkinson Regular preloads; Bold/Italic load on demand.
- [ ] ADHD older-turn fade restores on hover/focus AND announces in SR.
- [ ] Shift+M / Shift+V respect activeElement guards (don't fire
      inside text inputs).

---

## 13. Known carry-forwards (NOT bugs)

These are explicit deferrals, not regressions:

- **Verification audit** — VO/NVDA/Lighthouse/axe-core not yet
  transcribed. Template at
  `.claude/memory/sessions/2026-04-27-verification-audit.md`.
- **Cloud deploy** — Render / Vercel / Fly.io not provisioned;
  hackathon demos locally.
- **Worst-case-stack walk-through** — manual run, audit-flavored,
  bundled with the deferred audit.
- **Recap concepts/next_focus hydration** — lost across page reload
  (currently session-scoped only).
- **ADR-011 server-side hint-level enforcement** — soft escalation
  via prompt only; no DB-level rejection of out-of-order escalations.
- **Cross-tab profile sync** — open the app in two tabs, change
  profile in one — the other tab keeps stale state until refresh.

If any of these surface during testing, that's expected per the
post-hackathon backlog in `.claude/memory/next-steps.md`.
