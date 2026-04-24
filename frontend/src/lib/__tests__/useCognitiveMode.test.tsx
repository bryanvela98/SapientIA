import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useCognitiveMode } from '@/lib/useCognitiveMode';
import type { AccessibilityProfile } from '@/lib/types';
import { defaultProfile } from '@/lib/types';

function profileWith(overrides: Partial<AccessibilityProfile>): AccessibilityProfile {
  return { ...defaultProfile, ...overrides };
}

describe('useCognitiveMode', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-cognitive');
  });

  it('applies data-cognitive="plain-language" on <html> when profile is set', () => {
    renderHook(() => useCognitiveMode(profileWith({ cognitive: 'plain-language' })));
    expect(document.documentElement.dataset.cognitive).toBe('plain-language');
  });

  it('does not apply the attribute for the default profile', () => {
    renderHook(() => useCognitiveMode(defaultProfile));
    expect(document.documentElement.dataset.cognitive).toBeUndefined();
  });

  it('removes the attribute when the hook unmounts', () => {
    const { unmount } = renderHook(() =>
      useCognitiveMode(profileWith({ cognitive: 'plain-language' })),
    );
    expect(document.documentElement.dataset.cognitive).toBe('plain-language');
    unmount();
    expect(document.documentElement.dataset.cognitive).toBeUndefined();
  });

  it('flips attribute off when profile.cognitive is set back to none', () => {
    const { rerender } = renderHook(
      ({ profile }: { profile: AccessibilityProfile }) => useCognitiveMode(profile),
      { initialProps: { profile: profileWith({ cognitive: 'plain-language' }) } },
    );
    expect(document.documentElement.dataset.cognitive).toBe('plain-language');

    rerender({ profile: defaultProfile });
    expect(document.documentElement.dataset.cognitive).toBeUndefined();
  });
});