// Thin wrapper over the Web Speech API's SpeechRecognition. Not shipped in
// Firefox (and silently missing on some locked-down Safari builds); callers
// must `supportsStt()` before invoking.
//
// Minimal inline types — the Web Speech API isn't in lib.dom.d.ts. Pulling
// @types/dom-speech-recognition for one file isn't worth the dep cost.

type SrResultEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
};

type SrErrorEventLike = {
  error: string;
  message?: string;
};

type SrInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SrResultEventLike) => void) | null;
  onerror: ((e: SrErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SrConstructor = new () => SrInstance;

function getCtor(): SrConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SrConstructor;
    webkitSpeechRecognition?: SrConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function supportsStt(): boolean {
  return getCtor() !== null;
}

export type SttResult = { transcript: string; isFinal: boolean };
export type SttError = { code: string; message: string };

type Handlers = {
  result?: (r: SttResult) => void;
  error?: (e: SttError) => void;
  end?: () => void;
  start?: () => void;
};

export type Recognizer = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  on: <K extends keyof Handlers>(event: K, handler: NonNullable<Handlers[K]>) => void;
};

type CreateOpts = {
  lang?: string;
  interim?: boolean;
  continuous?: boolean;
};

export function createRecognizer(opts: CreateOpts = {}): Recognizer | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = opts.lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  rec.interimResults = opts.interim ?? true;
  // continuous=false returns a single final result then ends; we drive the
  // session lifecycle externally (press/hold, click toggle) so this matches
  // the push-to-talk mental model better than continuous accumulation.
  rec.continuous = opts.continuous ?? false;
  rec.maxAlternatives = 1;

  const handlers: Handlers = {};

  rec.onresult = (e) => {
    if (!handlers.result) return;
    // Walk results from resultIndex forward — older entries have already been
    // emitted. Each has an `isFinal` flag; we pass both interim and final to
    // the handler so the UI can show the dimmed preview.
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const alt = res[0];
      if (!alt) continue;
      handlers.result({ transcript: alt.transcript, isFinal: res.isFinal });
    }
  };

  rec.onerror = (e) => {
    handlers.error?.({ code: e.error, message: e.message ?? e.error });
  };

  rec.onend = () => handlers.end?.();
  rec.onstart = () => handlers.start?.();

  return {
    start: () => {
      try {
        rec.start();
      } catch {
        // `start()` throws if the recognizer is already running — safe to swallow.
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        // ignore — not started yet
      }
    },
    abort: () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    },
    on: (event, handler) => {
      (handlers as Record<string, unknown>)[event] = handler;
    },
  };
}

// Human-readable messages keyed on the spec error codes. Not exhaustive —
// uncommon codes fall back to the raw string.
export function sttErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Enable it in the site permissions (lock icon) and try again.';
    case 'no-speech':
      return 'No speech detected. Try holding Shift+Space again and speaking closer to the mic.';
    case 'audio-capture':
      return 'No microphone found. Check your input device and try again.';
    case 'network':
      return 'Voice input requires an internet connection.';
    case 'aborted':
      return '';
    default:
      return `Speech recognition error: ${code}`;
  }
}