// Thin wrapper over window.speechSynthesis. Adds:
//  - voice cache with async-loading fallback (Chrome populates voices lazily
//    via the `voiceschanged` event; calling getVoices() too early returns []).
//  - null-safe API for browsers without SpeechSynthesis (older mobile Safari,
//    Firefox ESR builds) so callers don't need to guard every invocation.

export function isTtsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([]);
  if (cachedVoices && cachedVoices.length > 0) return Promise.resolve(cachedVoices);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const synth = window.speechSynthesis;
    const initial = synth.getVoices();
    if (initial.length > 0) {
      cachedVoices = initial;
      resolve(initial);
      return;
    }
    let settled = false;
    const handler = () => {
      if (settled) return;
      const voices = synth.getVoices();
      if (voices.length > 0) {
        settled = true;
        cachedVoices = voices;
        synth.removeEventListener('voiceschanged', handler);
        resolve(voices);
      }
    };
    synth.addEventListener('voiceschanged', handler);
    // Safety net: resolve after 2s with whatever is available so callers
    // never hang on a browser that never fires voiceschanged.
    window.setTimeout(() => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', handler);
      cachedVoices = synth.getVoices();
      resolve(cachedVoices);
    }, 2000);
  });
  return voicesPromise;
}

export function pickVoice(
  locale: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const exact = voices.find((v) => v.lang === locale && v.default);
  if (exact) return exact;
  const lang = voices.find((v) => v.lang === locale);
  if (lang) return lang;
  const prefix = locale.split('-')[0];
  const prefixMatch = voices.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase()));
  if (prefixMatch) return prefixMatch;
  return voices.find((v) => v.default) ?? voices[0];
}

export type SpeakOpts = {
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onEnd?: () => void;
};

export function speak(text: string, opts: SpeakOpts = {}): void {
  if (!isTtsSupported()) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  const synth = window.speechSynthesis;
  if (opts.interrupt) synth.cancel();
  const utt = new SpeechSynthesisUtterance(trimmed);
  utt.rate = opts.rate ?? 1.0;
  utt.pitch = opts.pitch ?? 1.0;
  utt.volume = opts.volume ?? 1.0;
  const lang = opts.lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  utt.lang = lang;
  if (opts.onEnd) utt.onend = () => opts.onEnd?.();
  if (cachedVoices) {
    const voice = pickVoice(lang, cachedVoices);
    if (voice) utt.voice = voice;
  }
  synth.speak(utt);
}

export function pause(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.pause();
}

export function resume(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.resume();
}

export function cancel(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}

export function ttsStatus(): 'idle' | 'speaking' | 'paused' {
  if (!isTtsSupported()) return 'idle';
  const synth = window.speechSynthesis;
  if (synth.paused) return 'paused';
  if (synth.speaking || synth.pending) return 'speaking';
  return 'idle';
}
