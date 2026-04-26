import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks — the factory runs before `@/lib/stt` is imported by the hook.
// We expose a stable `recMock` reference and a `handlers` map so each test can
// drive the recognizer's lifecycle (start/end/result/error events) directly.
const mocks = vi.hoisted(() => {
  const handlers: Record<string, (arg?: unknown) => void> = {};
  let supported = true;
  const recMock = {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    on: vi.fn((event: string, h: (arg?: unknown) => void) => {
      handlers[event] = h;
    }),
  };
  return {
    handlers,
    recMock,
    setSupported: (v: boolean) => {
      supported = v;
    },
    isSupported: () => supported,
  };
});

vi.mock('@/lib/stt', () => ({
  supportsStt: () => mocks.isSupported(),
  createRecognizer: () => (mocks.isSupported() ? mocks.recMock : null),
  sttErrorMessage: (code: string) => (code === 'aborted' ? '' : `STT error: ${code}`),
}));

import { useVoiceCommands } from '@/hooks/useVoiceCommands';

function fireStart() {
  mocks.handlers.start?.();
}
function fireResult(transcript: string, isFinal = true) {
  (mocks.handlers.result as (a: { transcript: string; isFinal: boolean }) => void)?.({
    transcript,
    isFinal,
  });
}
function fireRecError(code: string) {
  (mocks.handlers.error as (a: { code: string; message: string }) => void)?.({
    code,
    message: code,
  });
}

describe('useVoiceCommands', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.setSupported(true);
    Object.keys(mocks.handlers).forEach((k) => delete mocks.handlers[k]);
    mocks.recMock.start.mockClear();
    mocks.recMock.stop.mockClear();
    mocks.recMock.abort.mockClear();
    mocks.recMock.on.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('idle → listening → parsed → dispatched on matched transcript', () => {
    const onDispatch = vi.fn();
    const { result } = renderHook(() => useVoiceCommands({ onDispatch }));
    expect(result.current.state).toBe('idle');
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());
    expect(mocks.recMock.start).toHaveBeenCalledTimes(1);

    act(() => fireStart());
    expect(result.current.state).toBe('listening');

    act(() => fireResult('recap'));
    expect(result.current.state).toBe('parsed');
    expect(result.current.lastIntent).toEqual({ type: 'recap' });
    expect(onDispatch).not.toHaveBeenCalled();

    // Dispatch fires after 250ms.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onDispatch).toHaveBeenCalledWith({ type: 'recap' });
    expect(result.current.state).toBe('dispatched');

    // Returns to idle after the dispatched flash.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.state).toBe('idle');
  });

  it('error path: unmatched transcript → error → idle after 3s', () => {
    const { result } = renderHook(() => useVoiceCommands());

    act(() => result.current.start());
    act(() => fireStart());
    act(() => fireResult('open the pod bay doors'));
    expect(result.current.state).toBe('error');
    expect(result.current.lastError).toBe('no-match');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.lastError).toBeNull();
  });

  it('recognizer error event surfaces a message and resets after 3s', () => {
    const { result } = renderHook(() => useVoiceCommands());
    act(() => result.current.start());
    act(() => fireStart());
    act(() => fireRecError('not-allowed'));
    expect(result.current.state).toBe('error');
    expect(result.current.lastError).toContain('not-allowed');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.state).toBe('idle');
  });

  it('supported=false: start() is a no-op and recognizer is never created', () => {
    mocks.setSupported(false);
    const onDispatch = vi.fn();
    const { result } = renderHook(() => useVoiceCommands({ onDispatch }));
    expect(result.current.supported).toBe(false);

    act(() => result.current.start());
    expect(mocks.recMock.start).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('onActivate fires on start() (used by Commit 3 for TTS barge-in)', () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useVoiceCommands({ onActivate }));
    act(() => result.current.start());
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('end event before final result returns state to idle from listening', () => {
    const { result } = renderHook(() => useVoiceCommands());
    act(() => result.current.start());
    act(() => fireStart());
    expect(result.current.state).toBe('listening');
    act(() => mocks.handlers.end?.());
    expect(result.current.state).toBe('idle');
  });

  it('end event after final result does not override the parsed transition', () => {
    const onDispatch = vi.fn();
    const { result } = renderHook(() => useVoiceCommands({ onDispatch }));
    act(() => result.current.start());
    act(() => fireStart());
    act(() => fireResult('send'));
    act(() => mocks.handlers.end?.());
    expect(result.current.state).toBe('parsed');
  });

  it('unmount aborts the recognizer', () => {
    const { result, unmount } = renderHook(() => useVoiceCommands());
    act(() => result.current.start());
    unmount();
    expect(mocks.recMock.abort).toHaveBeenCalled();
  });
});