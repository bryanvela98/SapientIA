import { useCallback, useEffect, useState } from 'react';

import type { AccessibilityProfile } from './types';

const MINIMIZED_KEY = 'sapientia.ui.minimized';

/**
 * Profile-driven default for the minimize toggle. ADHD-focus learners
 * benefit from a quieter chrome by default; everyone else sees the full
 * toolbar so they can discover the controls.
 */
export function defaultMinimized(profile: AccessibilityProfile): boolean {
  return profile.learning === 'adhd-focus';
}

function readStored(): '1' | '0' | null {
  try {
    const v = localStorage.getItem(MINIMIZED_KEY);
    if (v === '1' || v === '0') return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Tracks the "minimize UI" boolean that hides non-essential header
 * controls and applies `data-focus-minimized="true"` to <html>. CSS in
 * index.css does the actual hiding via `display: none`.
 *
 * Persistence semantics mirror ADR-024 (TTS): explicit user toggles win
 * forever; the profile default applies only when no stored preference
 * exists. A profile change to/from `learning=adhd-focus` re-applies the
 * default only if the user has not yet expressed a preference.
 *
 * Keyboard shortcut: `Shift+M` toggles, but only when the active element
 * is NOT inside a text input — same guard pattern as `useTtsKeyboard`,
 * so typing capital M in the composer doesn't accidentally hide the
 * toolbar.
 */
export function useMinimizedUi(
  profile: AccessibilityProfile,
): [boolean, (v: boolean) => void] {
  const [minimized, setMinimized] = useState<boolean>(() => {
    const stored = readStored();
    if (stored === '1') return true;
    if (stored === '0') return false;
    return defaultMinimized(profile);
  });

  // React 19 "adjust state during render" pattern: when profile.learning
  // flips, re-apply the default IF the user hasn't expressed an explicit
  // preference yet. After explicit toggle, the stored value rules.
  const [prevLearning, setPrevLearning] = useState(profile.learning);
  if (prevLearning !== profile.learning) {
    setPrevLearning(profile.learning);
    if (readStored() === null) {
      setMinimized(defaultMinimized(profile));
    }
  }

  const update = useCallback((v: boolean) => {
    setMinimized(v);
    try {
      localStorage.setItem(MINIMIZED_KEY, v ? '1' : '0');
    } catch {
      // private mode — ignore
    }
  }, []);

  // Apply the data-attribute on <html>. CSS in index.css consumes it.
  // Keep this side-effect inside the hook so callers don't have to
  // remember to wire it; symmetric with useCognitiveMode / useLearningMode.
  useEffect(() => {
    const root = document.documentElement;
    if (minimized) {
      root.setAttribute('data-focus-minimized', 'true');
    } else {
      root.removeAttribute('data-focus-minimized');
    }
    return () => {
      root.removeAttribute('data-focus-minimized');
    };
  }, [minimized]);

  // Shift+M outside text inputs toggles. Inside text inputs (composer,
  // topic input, search), capital M should still type a capital M.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'M' && e.key !== 'm') return;
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const ae = document.activeElement;
      if (ae) {
        const tag = ae.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae as HTMLElement).isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      update(!minimized);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [minimized, update]);

  return [minimized, update];
}