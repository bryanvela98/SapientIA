import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { getLearner } from '@/lib/api';
import { getCachedLearnerId } from '@/lib/identity';
import { useApp } from '@/lib/store';
import Onboarding from '@/routes/Onboarding';
import Chat from '@/routes/Chat';

/**
 * On first mount, if there's a cached learner id in localStorage, rehydrate
 * the Zustand store from the server. Until that resolves we render a minimal
 * neutral placeholder so route decisions don't flash.
 *
 * A 404 (DB wiped) is not an error path here — the user lands on /onboarding
 * anyway and ensureLearner creates a fresh one on submit.
 */
function Bootstrap({ children }: { children: React.ReactNode }) {
  const setLearner = useApp((s) => s.setLearner);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedLearnerId();
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    if (!cached) {
      finish();
      return;
    }
    getLearner(cached)
      .then((l) => {
        if (!cancelled) setLearner(l);
      })
      .catch(() => {
        // 404 or network error — stay with a null learner; Onboarding handles it.
      })
      .finally(finish);
    return () => {
      cancelled = true;
    };
  }, [setLearner]);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }
  return <>{children}</>;
}

function LandingRedirect() {
  const learner = useApp((s) => s.learner);
  return <Navigate to={learner ? '/chat' : '/onboarding'} replace />;
}

export default function App() {
  return (
    <Bootstrap>
      <Routes>
        <Route path="/" element={<LandingRedirect />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:sessionId" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Bootstrap>
  );
}