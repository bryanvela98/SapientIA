import { useEffect } from 'react';

import type { AccessibilityProfile } from './types';

/**
 * Applies `data-learning="dyslexia-font" | "adhd-focus"` to <html> based
 * on `profile.learning`. Removes the attribute when learning is `none`.
 * Mirror of `useCognitiveMode` (ADR-027 pattern) — orthogonal to theme
 * and cognitive, so all three can compose on the same `<html>` element.
 *
 * `dyslexia-font` and `adhd-focus` are mutually exclusive in the schema
 * (Literal[…]), so a single attribute slot suffices. The CSS blocks in
 * index.css use the attribute *value* to scope.
 *
 * Cleanup removes the attribute on unmount so vitest doesn't leak state
 * between tests; in production the hook lives for the route's lifetime
 * and cleanup is mostly a tidiness measure.
 */
export function useLearningMode(profile: AccessibilityProfile): void {
  useEffect(() => {
    const root = document.documentElement;
    if (profile.learning === 'none') {
      root.removeAttribute('data-learning');
    } else {
      root.setAttribute('data-learning', profile.learning);
    }
    return () => {
      root.removeAttribute('data-learning');
    };
  }, [profile.learning]);
}