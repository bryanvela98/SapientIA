import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useVoiceCommandDispatch } from '@/hooks/useVoiceCommandDispatch';

function makeDeps() {
  return {
    onRecap: vi.fn(),
    onSend: vi.fn(),
    setPacing: vi.fn(),
    setTtsEnabled: vi.fn(),
    setMinimized: vi.fn(),
    cancelTts: vi.fn(),
    stopVoice: vi.fn(),
    armAudio: vi.fn(),
  };
}

describe('useVoiceCommandDispatch', () => {
  it('recap → onRecap', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'recap' });
    expect(deps.onRecap).toHaveBeenCalledTimes(1);
  });

  it('send → onSend', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'send' });
    expect(deps.onSend).toHaveBeenCalledTimes(1);
  });

  it('pacing-slow → setPacing(true), pacing-normal → setPacing(false)', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'pacing-slow' });
    result.current({ type: 'pacing-normal' });
    expect(deps.setPacing).toHaveBeenNthCalledWith(1, true);
    expect(deps.setPacing).toHaveBeenNthCalledWith(2, false);
  });

  it('tts-on arms audio THEN enables TTS (autoplay-policy ordering)', () => {
    const deps = makeDeps();
    const order: string[] = [];
    deps.armAudio.mockImplementation(() => order.push('arm'));
    deps.setTtsEnabled.mockImplementation(() => order.push('enable'));
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'tts-on' });
    expect(order).toEqual(['arm', 'enable']);
    expect(deps.setTtsEnabled).toHaveBeenCalledWith(true);
  });

  it('tts-off disables TTS and cancels in-flight utterance', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'tts-off' });
    expect(deps.setTtsEnabled).toHaveBeenCalledWith(false);
    expect(deps.cancelTts).toHaveBeenCalledTimes(1);
  });

  it('cancel → cancelTts + stopVoice', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'cancel' });
    expect(deps.cancelTts).toHaveBeenCalledTimes(1);
    expect(deps.stopVoice).toHaveBeenCalledTimes(1);
  });

  it('minimize-on → setMinimized(true), routes through hook (ADR-033)', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'minimize-on' });
    expect(deps.setMinimized).toHaveBeenCalledWith(true);
  });

  it('minimize-off → setMinimized(false)', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'minimize-off' });
    expect(deps.setMinimized).toHaveBeenCalledWith(false);
  });

  it('does not invoke unrelated deps for a single intent', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useVoiceCommandDispatch(deps));
    result.current({ type: 'recap' });
    expect(deps.onSend).not.toHaveBeenCalled();
    expect(deps.setPacing).not.toHaveBeenCalled();
    expect(deps.setTtsEnabled).not.toHaveBeenCalled();
    expect(deps.cancelTts).not.toHaveBeenCalled();
    expect(deps.stopVoice).not.toHaveBeenCalled();
    expect(deps.setMinimized).not.toHaveBeenCalled();
    expect(deps.armAudio).not.toHaveBeenCalled();
  });
});