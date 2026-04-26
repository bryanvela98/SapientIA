import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createRecognizer,
  supportsStt,
  sttErrorMessage,
  type Recognizer,
  type SttError,
} from '@/lib/stt';
import { parseCommand, type CommandIntent } from '@/lib/voice-commands';

export type VoiceState = 'idle' | 'listening' | 'parsed' | 'dispatched' | 'error';

type Options = {
  lang?: string;
  // Fired on the listening → parsed → dispatched transition. Left undefined
  // in Commit 2 (infrastructure only); Commit 3 wires the dispatch table.
  onDispatch?: (intent: CommandIntent) => void;
  // Fired the instant the recognizer is asked to start. Used by Commit 3 for
  // barge-in (cancel any in-flight TTS — same rule as STT-cancels-TTS from
  // Day 4 Commit 5). Safe no-op if undefined.
  onActivate?: () => void;
};

const DISPATCH_DELAY_MS = 250;
const ERROR_TIMEOUT_MS = 3000;
const DISPATCHED_FLASH_MS = 800;

/**
 * Push-to-activate voice command lifecycle.
 *
 * State machine (see `plan/DAY7_PLAN.md` Commit 2):
 *   idle ─start()→ listening ─final transcript matched─→ parsed ─250ms→ (dispatch) → dispatched ─800ms→ idle
 *                              └─unmatched transcript ──→ error ─3s→ idle
 *                              └─recognizer error ──────→ error ─3s→ idle
 *
 * Recognizer is created lazily on first start() and reused across sessions to
 * avoid the 300–500ms ctor cost on Chrome. `interim: false, continuous: false`
 * because commands are a single utterance — we don't render an interim preview
 * and the lifecycle ends on the first final.
 */
export function useVoiceCommands({ lang, onDispatch, onActivate }: Options = {}) {
  const supported = supportsStt();
  const [state, setState] = useState<VoiceState>('idle');
  const [lastIntent, setLastIntent] = useState<CommandIntent | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string>('');

  const recRef = useRef<Recognizer | null>(null);
  const timerRef = useRef<number | null>(null);
  const onDispatchRef = useRef(onDispatch);
  const onActivateRef = useRef(onActivate);

  // Keep callback refs current without forcing recognizer rebuilds.
  useEffect(() => {
    onDispatchRef.current = onDispatch;
  });
  useEffect(() => {
    onActivateRef.current = onActivate;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleErrorReset = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setState('idle');
      setLastError(null);
      timerRef.current = null;
    }, ERROR_TIMEOUT_MS);
  }, [clearTimer]);

  const ensureRecognizer = useCallback((): Recognizer | null => {
    if (recRef.current) return recRef.current;
    const rec = createRecognizer({ lang, interim: false, continuous: false });
    if (!rec) return null;

    rec.on('start', () => setState('listening'));
    rec.on('end', () => {
      // Recognizer ended without a final result (rare — usually a quick stop()
      // before audio captured). Drop back to idle from listening only; never
      // override a parsed/dispatched/error transition that already fired.
      setState((prev) => (prev === 'listening' ? 'idle' : prev));
    });
    rec.on('result', ({ transcript, isFinal }) => {
      if (!isFinal) return;
      setLastTranscript(transcript);
      const intent = parseCommand(transcript);
      if (intent) {
        setLastIntent(intent);
        setLastError(null);
        setState('parsed');
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          onDispatchRef.current?.(intent);
          setState('dispatched');
          timerRef.current = window.setTimeout(() => {
            setState('idle');
            timerRef.current = null;
          }, DISPATCHED_FLASH_MS);
        }, DISPATCH_DELAY_MS);
      } else {
        setLastError('no-match');
        setState('error');
        scheduleErrorReset();
      }
    });
    rec.on('error', (e: SttError) => {
      const msg = sttErrorMessage(e.code);
      setLastError(msg || e.code);
      setState('error');
      scheduleErrorReset();
    });

    recRef.current = rec;
    return rec;
  }, [lang, clearTimer, scheduleErrorReset]);

  useEffect(() => {
    return () => {
      clearTimer();
      recRef.current?.abort();
      recRef.current = null;
    };
  }, [clearTimer]);

  const start = useCallback(() => {
    if (!supported) return;
    onActivateRef.current?.();
    const rec = ensureRecognizer();
    rec?.start();
  }, [supported, ensureRecognizer]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  return { state, lastIntent, lastError, lastTranscript, start, stop, supported };
}