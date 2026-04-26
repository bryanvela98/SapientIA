import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no matchMedia; useTheme and other browser-only hooks call it.
if (!window.matchMedia) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  );
}

// Vitest 4's jsdom env ships a partial localStorage that's missing
// `removeItem` (and `clear` is unreliable). Replace it with a complete
// Map-backed Storage so hooks that persist via setItem/removeItem work
// the same in tests as in the browser. Same shim applied to sessionStorage
// for parity (useAudioArmed touches it).
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear() {
      m.clear();
    },
    getItem(k: string) {
      return m.has(k) ? (m.get(k) as string) : null;
    },
    key(i: number) {
      return Array.from(m.keys())[i] ?? null;
    },
    removeItem(k: string) {
      m.delete(k);
    },
    setItem(k: string, v: string) {
      m.set(k, String(v));
    },
  };
}

vi.stubGlobal('localStorage', makeStorage());
vi.stubGlobal('sessionStorage', makeStorage());

afterEach(() => {
  cleanup();
  // Fresh storage between tests so a setItem in one test never leaks into
  // the next (per-file vitest isolation isn't per-test).
  window.localStorage.clear();
  window.sessionStorage.clear();
});