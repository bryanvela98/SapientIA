import { useEffect, useRef, useState } from 'react';

import { useApp } from '@/lib/store';

// Dedicated assertive live region for significant pedagogy events
// (concept_earned, concept_told). The transcript uses a polite region
// (role="log" + aria-live="polite" on the list) for the streaming text;
// milestones need to jump the queue so screen-reader users hear
// "Concept earned: derivatives" even when the tutor is mid-sentence.
//
// Single sr-only node, rendered once at the top of the chat route. We
// update the node's text content whenever a new earned or told item
// arrives and clear it after ~4s so the DOM doesn't accumulate stale
// announcements that AT might re-read on focus changes.
export function LiveAnnouncer() {
  const earned = useApp((s) => s.earned);
  const told = useApp((s) => s.told);
  const [message, setMessage] = useState('');
  const earnedCountRef = useRef(earned.length);
  const toldCountRef = useRef(told.length);

  useEffect(() => {
    if (earned.length < earnedCountRef.current) {
      earnedCountRef.current = earned.length;
      return;
    }
    if (earned.length > earnedCountRef.current) {
      const next = earned[earned.length - 1];
      setMessage(`Concept earned: ${next.concept}.`);
      earnedCountRef.current = earned.length;
    }
  }, [earned]);

  useEffect(() => {
    if (told.length < toldCountRef.current) {
      toldCountRef.current = told.length;
      return;
    }
    if (told.length > toldCountRef.current) {
      const next = told[told.length - 1];
      setMessage(`Concept told: ${next.concept}. We'll revisit it.`);
      toldCountRef.current = told.length;
    }
  }, [told]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(t);
  }, [message]);

  return (
    <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}