import { useEffect, useRef } from 'react';

import { cancel, getVoices, speak } from '@/lib/tts';
import { useApp } from '@/lib/store';

// Returns the last index (inclusive) in `buf` where a sentence ends and the
// following char is whitespace or the buffer ends. A sentence ender is one
// of `. ! ? \n`, optionally followed by a closing quote/bracket. Per-token
// speech is choppy; sentence-buffered speech sounds natural.
function findLastSentenceEnd(buf: string): number {
  let idx = -1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c !== '.' && c !== '!' && c !== '?' && c !== '\n') continue;
    let after = i + 1;
    const next = buf[after];
    if (next === '"' || next === "'" || next === ')' || next === ']') after += 1;
    const tail = buf[after];
    if (tail === undefined || /\s/.test(tail)) idx = after - 1;
  }
  return idx;
}

type Options = {
  enabled: boolean;
  armed: boolean;
  lang?: string;
};

// Subscribes to the live tutor turn and emits sentence-boundary utterances
// as text_delta events arrive. Flushes any residual buffer on turn_end.
// Also announces concept_earned / concept_told as discrete short utterances.
export function useTtsForLiveTurn({ enabled, armed, lang }: Options) {
  const live = useApp((s) => s.live);
  const earned = useApp((s) => s.earned);
  const told = useApp((s) => s.told);

  const bufferRef = useRef('');
  const spokenOffsetRef = useRef(0);
  const lastTurnRef = useRef<number | null>(null);
  const earnedCountRef = useRef(earned.length);
  const toldCountRef = useRef(told.length);

  useEffect(() => {
    if (enabled) void getVoices();
  }, [enabled]);

  // Disabling the toggle must silence an in-flight utterance immediately.
  useEffect(() => {
    if (!enabled) {
      cancel();
      bufferRef.current = '';
      spokenOffsetRef.current = 0;
    }
  }, [enabled]);

  // Drive the live-turn stream.
  useEffect(() => {
    if (!enabled || !armed) return;

    // Turn ended: flush whatever's buffered and reset.
    if (!live) {
      if (bufferRef.current.trim()) {
        speak(bufferRef.current.trim(), { lang });
      }
      bufferRef.current = '';
      spokenOffsetRef.current = 0;
      lastTurnRef.current = null;
      return;
    }

    // New turn starting — cancel any previous speech and reset.
    if (live.turn_number !== lastTurnRef.current) {
      cancel();
      bufferRef.current = '';
      spokenOffsetRef.current = 0;
      lastTurnRef.current = live.turn_number;
    }

    const text = live.text;
    if (text.length <= spokenOffsetRef.current) return;
    const fresh = text.slice(spokenOffsetRef.current);
    spokenOffsetRef.current = text.length;
    bufferRef.current += fresh;

    const end = findLastSentenceEnd(bufferRef.current);
    if (end >= 0) {
      const toSpeak = bufferRef.current.slice(0, end + 1).trim();
      bufferRef.current = bufferRef.current.slice(end + 1);
      if (toSpeak) speak(toSpeak, { lang });
    }
  }, [live, enabled, armed, lang]);

  // Discrete earned announcements — queued, not interrupting the turn voice.
  useEffect(() => {
    if (!enabled || !armed) {
      earnedCountRef.current = earned.length;
      return;
    }
    if (earned.length > earnedCountRef.current) {
      for (let i = earnedCountRef.current; i < earned.length; i++) {
        speak(`Concept earned: ${earned[i].concept}.`, { lang });
      }
      earnedCountRef.current = earned.length;
    }
  }, [earned, enabled, armed, lang]);

  useEffect(() => {
    if (!enabled || !armed) {
      toldCountRef.current = told.length;
      return;
    }
    if (told.length > toldCountRef.current) {
      for (let i = toldCountRef.current; i < told.length; i++) {
        speak(`Concept told: ${told[i].concept}.`, { lang });
      }
      toldCountRef.current = told.length;
    }
  }, [told, enabled, armed, lang]);
}