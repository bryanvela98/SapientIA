import { useCallback } from 'react';

import type { CommandIntent } from '@/lib/voice-commands';

export type VoiceDispatchDeps = {
  // Triggers the same force-recap path RecapButton uses (synthetic user
  // turn tagged "[user requested recap]" with force_recap=true).
  onRecap: () => void | Promise<void>;
  // Submits the composer's current contents. The caller decides what
  // happens on empty input — this hook calls it unconditionally; the
  // outer onSend already early-returns on whitespace.
  onSend: () => void | Promise<void>;
  // PATCH profile.pacing through the existing PacingToggle path.
  setPacing: (slow: boolean) => void;
  // Toggle the TTS read-aloud preference (the useTtsEnabled setter).
  setTtsEnabled: (v: boolean) => void;
  // useMinimizedUi setter — voice "minimize" must route through the
  // hook rather than writing localStorage directly, so the toggle stays
  // a single source of truth (next-steps.md rule, ADR-033).
  setMinimized: (v: boolean) => void;
  // Cancel any in-flight TTS utterance.
  cancelTts: () => void;
  // Force-stop the voice recognizer (used by the `cancel` intent).
  stopVoice: () => void;
  // Arm the audio gesture flag so voice-triggered TTS plays on browsers
  // with autoplay-blocked SpeechSynthesis. Voice activation IS a user
  // gesture per the autoplay policy.
  armAudio: () => void;
};

/**
 * Maps each parsed `CommandIntent` to the right outer-component action.
 * Returned callback is stable across renders only if the deps are
 * stable; the consuming `useVoiceCommands` hook stashes it in a ref so
 * identity changes don't rebuild the recognizer.
 */
export function useVoiceCommandDispatch(deps: VoiceDispatchDeps) {
  const {
    onRecap,
    onSend,
    setPacing,
    setTtsEnabled,
    setMinimized,
    cancelTts,
    stopVoice,
    armAudio,
  } = deps;
  return useCallback(
    (intent: CommandIntent) => {
      switch (intent.type) {
        case 'recap':
          void onRecap();
          return;
        case 'send':
          void onSend();
          return;
        case 'pacing-slow':
          setPacing(true);
          return;
        case 'pacing-normal':
          setPacing(false);
          return;
        case 'tts-on':
          armAudio();
          setTtsEnabled(true);
          return;
        case 'tts-off':
          setTtsEnabled(false);
          cancelTts();
          return;
        case 'cancel':
          cancelTts();
          stopVoice();
          return;
        case 'minimize-on':
          setMinimized(true);
          return;
        case 'minimize-off':
          setMinimized(false);
          return;
      }
    },
    [
      onRecap,
      onSend,
      setPacing,
      setTtsEnabled,
      setMinimized,
      cancelTts,
      stopVoice,
      armAudio,
    ],
  );
}