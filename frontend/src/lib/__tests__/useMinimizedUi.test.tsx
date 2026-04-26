import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useMinimizedUi } from '@/lib/useMinimizedUi';
import type { AccessibilityProfile } from '@/lib/types';
import { defaultProfile } from '@/lib/types';

const STORAGE_KEY = 'sapientia.ui.minimized';

function profileWith(overrides: Partial<AccessibilityProfile>): AccessibilityProfile {
  return { ...defaultProfile, ...overrides };
}

describe('useMinimizedUi', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-focus-minimized');
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-focus-minimized');
  });

  it('defaults to ON for adhd-focus profile', () => {
    const { result } = renderHook(() =>
      useMinimizedUi(profileWith({ learning: 'adhd-focus' })),
    );
    expect(result.current[0]).toBe(true);
    expect(document.documentElement.getAttribute('data-focus-minimized')).toBe('true');
  });

  it('defaults to OFF for non-adhd profiles', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    expect(result.current[0]).toBe(false);
    expect(document.documentElement.hasAttribute('data-focus-minimized')).toBe(false);
  });

  it('explicit toggle persists across rerenders', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');

    // Re-mount: stored value rules.
    const second = renderHook(() => useMinimizedUi(defaultProfile));
    expect(second.result.current[0]).toBe(true);
  });

  it('explicit user choice outranks profile default on rerender', () => {
    // User has expressed preference OFF; profile flips to adhd-focus.
    // Default would say ON — but user said OFF, so honor user.
    localStorage.setItem(STORAGE_KEY, '0');
    const { result, rerender } = renderHook(
      ({ profile }: { profile: AccessibilityProfile }) => useMinimizedUi(profile),
      { initialProps: { profile: defaultProfile } },
    );
    expect(result.current[0]).toBe(false);

    rerender({ profile: profileWith({ learning: 'adhd-focus' }) });
    expect(result.current[0]).toBe(false);
  });

  it('profile flip applies new default when no stored preference', () => {
    const { result, rerender } = renderHook(
      ({ profile }: { profile: AccessibilityProfile }) => useMinimizedUi(profile),
      { initialProps: { profile: defaultProfile } },
    );
    expect(result.current[0]).toBe(false);

    rerender({ profile: profileWith({ learning: 'adhd-focus' }) });
    expect(result.current[0]).toBe(true);
  });

  it('Shift+M outside inputs toggles', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    expect(result.current[0]).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', shiftKey: true }));
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', shiftKey: true }));
    });
    expect(result.current[0]).toBe(false);
  });

  it('Shift+M inside an INPUT does nothing', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', shiftKey: true }));
    });
    expect(result.current[0]).toBe(false);

    document.body.removeChild(input);
  });

  it('Shift+M inside a TEXTAREA does nothing', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', shiftKey: true }));
    });
    expect(result.current[0]).toBe(false);

    document.body.removeChild(ta);
  });

  it('plain M without Shift does nothing (no accidental toggling while typing)', () => {
    const { result } = renderHook(() => useMinimizedUi(defaultProfile));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M' }));
    });
    expect(result.current[0]).toBe(false);
  });

  it('removes data-attribute on unmount', () => {
    const { unmount } = renderHook(() =>
      useMinimizedUi(profileWith({ learning: 'adhd-focus' })),
    );
    expect(document.documentElement.getAttribute('data-focus-minimized')).toBe('true');
    unmount();
    expect(document.documentElement.hasAttribute('data-focus-minimized')).toBe(false);
  });
});