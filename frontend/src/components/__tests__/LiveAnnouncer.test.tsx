import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveAnnouncer } from '@/components/LiveAnnouncer';
import { useApp } from '@/lib/store';

// Zustand stores are module singletons — reset between tests so one test's
// `earned` / `told` doesn't leak into the next. The store exposes a
// `resetSession` action that wipes exactly those slices.
function resetStore() {
  act(() => {
    useApp.getState().resetSession();
  });
}

describe('<LiveAnnouncer />', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  it('renders an assertive, atomic sr-only alert region', () => {
    render(<LiveAnnouncer />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert).toHaveClass('sr-only');
    expect(alert.textContent).toBe('');
  });

  it('announces a newly earned concept and clears after ~4s', () => {
    render(<LiveAnnouncer />);
    const alert = screen.getByRole('alert');

    act(() => {
      useApp.getState().addEarned({
        type: 'concept_earned',
        concept: 'derivatives',
        evidence: 'learner reasoned through slope-of-tangent',
      });
    });

    expect(alert.textContent).toMatch(/Concept earned: derivatives/);

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(alert.textContent).toBe('');
  });

  it('announces a told concept with "we\'ll revisit it" framing', () => {
    render(<LiveAnnouncer />);
    const alert = screen.getByRole('alert');

    act(() => {
      useApp.getState().addTold({
        type: 'concept_told',
        concept: 'chain rule',
        justification: 'session running long',
      });
    });

    expect(alert.textContent).toMatch(/Concept told: chain rule/);
    expect(alert.textContent).toMatch(/revisit/);
  });

  // ADR-022 regression guard: on `resetSession` the earned array shrinks
  // back to []. The watermark ref must rebase so the first concept_earned
  // of the *new* session still fires. The bug before the watermark fix was
  // that `earned.length > earnedCountRef.current` stayed false forever.
  it('re-announces after resetSession clears and a new concept arrives', () => {
    render(<LiveAnnouncer />);
    const alert = screen.getByRole('alert');

    act(() => {
      useApp.getState().addEarned({
        type: 'concept_earned',
        concept: 'first',
        evidence: 'e',
      });
    });
    expect(alert.textContent).toMatch(/Concept earned: first/);

    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(alert.textContent).toBe('');

    // Simulate new topic: resetSession wipes earned/told.
    act(() => {
      useApp.getState().resetSession();
    });

    act(() => {
      useApp.getState().addEarned({
        type: 'concept_earned',
        concept: 'second',
        evidence: 'e',
      });
    });
    expect(alert.textContent).toMatch(/Concept earned: second/);
  });
});