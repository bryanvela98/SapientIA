import { useEffect } from 'react';

import type { AccessibilityProfile } from './types';

/**
 * Applies `data-cognitive="plain-language"` to <html> when the profile has
 * `cognitive=plain-language` set; removes the attribute otherwise. The
 * attribute gates the cognitive CSS block in index.css (bigger type,
 * chunkier focus rings, narrower bubble max-width, +padding).
 *
 * Orthogonal to `useTheme` — both can be active at once, so a learner in
 * high-contrast + plain-language gets both adaptations composed.
 */
export function useCognitiveMode(profile: AccessibilityProfile): void {
  useEffect(() => {
    const root = document.documentElement;
    if (profile.cognitive === 'plain-language') {
      root.setAttribute('data-cognitive', 'plain-language');
    } else {
      root.removeAttribute('data-cognitive');
    }
    return () => {
      // Best-effort cleanup on unmount — the hook normally lives for the
      // whole app's lifetime; this mostly matters for tests.
      root.removeAttribute('data-cognitive');
    };
  }, [profile.cognitive]);
}