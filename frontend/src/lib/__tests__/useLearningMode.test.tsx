import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useLearningMode } from '@/lib/useLearningMode';
import type { AccessibilityProfile } from '@/lib/types';
import { defaultProfile } from '@/lib/types';

function profileWith(overrides: Partial<AccessibilityProfile>): AccessibilityProfile {
  return { ...defaultProfile, ...overrides };
}

describe('useLearningMode', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-learning');
  });

  it('applies data-learning="dyslexia-font" on <html> when set', () => {
    renderHook(() => useLearningMode(profileWith({ learning: 'dyslexia-font' })));
    expect(document.documentElement.dataset.learning).toBe('dyslexia-font');
  });

  it('applies data-learning="adhd-focus" on <html> when set', () => {
    renderHook(() => useLearningMode(profileWith({ learning: 'adhd-focus' })));
    expect(document.documentElement.dataset.learning).toBe('adhd-focus');
  });

  it('does not apply the attribute for the default profile', () => {
    renderHook(() => useLearningMode(defaultProfile));
    expect(document.documentElement.dataset.learning).toBeUndefined();
  });

  it('removes the attribute when the hook unmounts', () => {
    const { unmount } = renderHook(() =>
      useLearningMode(profileWith({ learning: 'dyslexia-font' })),
    );
    expect(document.documentElement.dataset.learning).toBe('dyslexia-font');
    unmount();
    expect(document.documentElement.dataset.learning).toBeUndefined();
  });

  it('replaces the attribute value when profile.learning changes', () => {
    const { rerender } = renderHook(
      ({ profile }: { profile: AccessibilityProfile }) => useLearningMode(profile),
      { initialProps: { profile: profileWith({ learning: 'dyslexia-font' }) } },
    );
    expect(document.documentElement.dataset.learning).toBe('dyslexia-font');

    rerender({ profile: profileWith({ learning: 'adhd-focus' }) });
    expect(document.documentElement.dataset.learning).toBe('adhd-focus');

    rerender({ profile: defaultProfile });
    expect(document.documentElement.dataset.learning).toBeUndefined();
  });
});