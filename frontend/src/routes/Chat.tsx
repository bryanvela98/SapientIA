import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/lib/store';
import { profileSummary } from '@/lib/preview';

/**
 * Placeholder chat route — Commit 5 fills in the topic picker, transcript,
 * composer, and SSE streaming. Today it just shows that the learner/profile
 * made it here and lets you jump back to /onboarding.
 */
export default function Chat() {
  const learner = useApp((s) => s.learner);
  const profile = useApp((s) => s.profile);

  return (
    <main className="min-h-screen bg-background text-foreground p-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">SapientIA</h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/onboarding">Edit profile</Link>
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ready (chat UI in Commit 5)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Learner:</span>{' '}
              <code className="text-xs">{learner?.id ?? '(none)'}</code>
            </p>
            <p>
              <span className="text-muted-foreground">Profile:</span> {profileSummary(profile)}
            </p>
            <p className="text-muted-foreground">
              Topic picker, streaming transcript, and composer ship in the next commit.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}