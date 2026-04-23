import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSession, ensureLearner, streamTurn } from '@/lib/api';
import { defaultProfile } from '@/lib/types';

async function runSmoke() {
  console.group('[sapientia smoke]');
  try {
    const learner = await ensureLearner(defaultProfile);
    console.log('learner:', learner);
    const session = await createSession('Photosynthesis');
    console.log('session:', session);
    console.log('--- streaming turn ---');
    for await (const ev of streamTurn(session.id, 'What is photosynthesis?')) {
      console.log(ev.type, ev);
    }
    console.log('--- done ---');
  } catch (err) {
    console.error(err);
  } finally {
    console.groupEnd();
  }
}

export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>SapientIA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            An inclusive Socratic tutor. API client + SSE consumer wired; routes land in Commit 4.
          </p>
          {import.meta.env.DEV && (
            <Button onClick={runSmoke} aria-describedby="smoke-help">
              Run smoke (open console)
            </Button>
          )}
          {import.meta.env.DEV && (
            <p id="smoke-help" className="text-xs text-muted-foreground">
              Creates learner → session → streams one tutor turn. Open DevTools console first.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}