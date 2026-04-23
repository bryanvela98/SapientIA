import { useCallback, useEffect, useState } from 'react';

import type { AccessibilityProfile } from './types';

// v2 intentionally discards any value written by the initial implementation,
// which eagerly persisted the profile default on mount and thereby pinned
// existing devs to whatever was current at first load.
const TTS_ENABLED_KEY = 'sapientia.ui.ttsEnabled.v2';
const AUDIO_ARMED_KEY = 'sapientia.ui.audioArmed';

// Profile-driven default for the toggle.
//  - low-vision: learner reads at large scale but expects synth voice as the
//    primary channel; default ON.
//  - screen-reader: SR already announces `aria-live` regions; auto-playing
//    SpeechSynthesis on top causes audio clash. Default OFF, toggle available.
//  - everyone else: default OFF.
export function defaultTtsEnabled(profile: AccessibilityProfile): boolean {
  return profile.visual === 'low-vision';
}

function readStoredTts(): '1' | '0' | null {
  try {
    const v = localStorage.getItem(TTS_ENABLED_KEY);
    if (v === '1' || v === '0') return v;
    return null;
  } catch {
    return null;
  }
}

export function useTtsEnabled(
  profile: AccessibilityProfile,
): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const stored = readStoredTts();
    if (stored === '1') return true;
    if (stored === '0') return false;
    return defaultTtsEnabled(profile);
  });
  // Track the last visual axis we observed so we can detect a profile change
  // *during render* (React's recommended pattern for deriving state from
  // props; see https://react.dev/learn/you-might-not-need-an-effect#adjusting-
  // some-state-when-a-prop-changes). Re-applies the profile default only when
  // the user has not expressed an explicit preference (no value in storage).
  const [prevVisual, setPrevVisual] = useState(profile.visual);
  if (prevVisual !== profile.visual) {
    setPrevVisual(profile.visual);
    if (readStoredTts() === null) {
      setEnabled(defaultTtsEnabled(profile));
    }
  }

  const update = useCallback((v: boolean) => {
    setEnabled(v);
    try {
      localStorage.setItem(TTS_ENABLED_KEY, v ? '1' : '0');
    } catch {
      // private mode — ignore
    }
  }, []);

  return [enabled, update];
}

// Browsers (Safari, Chrome) silently drop speechSynthesis.speak() until the
// tab has received a user gesture. We track whether that gesture has happened
// in sessionStorage so a reload on the same tab keeps it armed, but a fresh
// tab (bookmarked /chat deep-link) re-arms on first interaction.
export function useAudioArmed(): [boolean, () => void] {
  const [armed, setArmed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUDIO_ARMED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const arm = () => {
    setArmed(true);
    try {
      sessionStorage.setItem(AUDIO_ARMED_KEY, '1');
    } catch {
      // private mode — ignore
    }
  };

  // Any user interaction on the page counts as a gesture — pointerdown or
  // keydown. Listen once, arm, remove. Keeps the banner transient even if the
  // user clicks Send before reading it.
  useEffect(() => {
    if (armed) return;
    function onGesture() {
      setArmed(true);
      try {
        sessionStorage.setItem(AUDIO_ARMED_KEY, '1');
      } catch {
        // ignore
      }
    }
    document.addEventListener('pointerdown', onGesture, { once: true });
    document.addEventListener('keydown', onGesture, { once: true });
    return () => {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
    };
  }, [armed]);

  return [armed, arm];
}