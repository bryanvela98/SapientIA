import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createRecognizer,
  supportsStt,
  sttErrorMessage,
  type Recognizer,
  type SttError,
} from '@/lib/stt';

type Options = {
  lang?: string;
  onFinal?: (transcript: string) => void;
};

type SttState = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
};

// Single-shot push-to-talk recognizer lifecycle. The recognizer is created
// lazily on first `start()` and torn down on unmount. Interim results stream
// into `interim` for live preview; finals are passed to `onFinal` and the
// interim buffer is cleared, so the consumer can append to its textarea
// directly rather than diffing the preview.
export function useStt({ lang, onFinal }: Options = {}) {
  const supported = supportsStt();
  const [state, setState] = useState<SttState>({
    supported,
    listening: false,
    interim: '',
    error: null,
  });
  const recRef = useRef<Recognizer | null>(null);
  // Keep onFinal in a ref so changing the callback identity doesn't force us
  // to rebuild the recognizer between renders. Updated in an effect so we
  // don't mutate the ref during render (React 19 strictness).
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const ensureRecognizer = useCallback((): Recognizer | null => {
    if (recRef.current) return recRef.current;
    const rec = createRecognizer({ lang, interim: true, continuous: false });
    if (!rec) return null;

    rec.on('start', () => setState((s) => ({ ...s, listening: true, error: null, interim: '' })));
    rec.on('end', () => setState((s) => ({ ...s, listening: false, interim: '' })));
    rec.on('result', ({ transcript, isFinal }) => {
      if (isFinal) {
        setState((s) => ({ ...s, interim: '' }));
        onFinalRef.current?.(transcript);
      } else {
        setState((s) => ({ ...s, interim: transcript }));
      }
    });
    rec.on('error', (e: SttError) => {
      const message = sttErrorMessage(e.code);
      setState((s) => ({ ...s, listening: false, error: message || null }));
    });

    recRef.current = rec;
    return rec;
  }, [lang]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const rec = ensureRecognizer();
    rec?.start();
  }, [ensureRecognizer]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const clearError = useCallback(() => {
    setState((s) => (s.error ? { ...s, error: null } : s));
  }, []);

  return { ...state, start, stop, clearError };
}