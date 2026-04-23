import { useEffect } from 'react';

import { pause, resume, ttsStatus } from '@/lib/tts';

// Binds `K` (outside of text inputs) to pause/resume in-flight speech. We
// skip the shortcut while the user is typing so `k` in prose isn't stolen.
export function useTtsKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'k' && e.key !== 'K') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || active?.isContentEditable) return;
      const status = ttsStatus();
      if (status === 'speaking') {
        e.preventDefault();
        pause();
      } else if (status === 'paused') {
        e.preventDefault();
        resume();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}