import { useEffect, useState } from 'react';

import type { AccessibilityProfile } from './types';

const TTS_ENABLED_KEY = 'sapientia.ui.ttsEnabled';
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

export function useTtsEnabled(
  profile: AccessibilityProfile,
): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(TTS_ENABLED_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
      return defaultTtsEnabled(profile);
    } catch {
      return defaultTtsEnabled(profile);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TTS_ENABLED_KEY, enabled ? '1' : '0');
    } catch {
      // private mode — ignore
    }
  }, [enabled]);

  return [enabled, setEnabled];
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