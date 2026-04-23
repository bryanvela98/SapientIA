import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DebugPanel, DebugPanelToggle } from '@/components/DebugPanel';
import { useDebugOpen } from '@/lib/useDebugOpen';
import {
  createSession,
  getSessionState,
  getSessionTurns,
  streamTurn,
} from '@/lib/api';
import { profileSummary } from '@/lib/preview';
import { useApp } from '@/lib/store';
import type { SessionState } from '@/lib/types';

const PRESET_TOPICS = [
  'Photosynthesis',
  'Recursion in programming',
  "The meaning of the poem 'Stopping by Woods on a Snowy Evening'",
];

function TopicPicker() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We don't seed the store here — ChatSession's hydration effect owns
  // sessionId/topic/turns state so there's a single source of truth.
  async function start(chosen: string) {
    if (!chosen.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await createSession(chosen.trim());
      navigate(`/chat/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What do you want to learn?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start(topic);
          }}
          className="space-y-2"
        >
          <Label htmlFor="topic-input">Topic</Label>
          <div className="flex gap-2">
            <Input
              id="topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. the citric acid cycle"
              autoFocus
              disabled={submitting}
            />
            <Button type="submit" disabled={submitting || !topic.trim()} aria-busy={submitting}>
              {submitting ? 'Starting…' : 'Start'}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Or pick a preset:</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TOPICS.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="sm"
                onClick={() => void start(t)}
                disabled={submitting}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ConceptBadges({ count }: { count: number }) {
  // One light indicator in the header; the full list is the transcript itself.
  return (
    <Badge variant="secondary" className="font-normal">
      {count} turn{count === 1 ? '' : 's'}
    </Badge>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap">
        {text}
      </div>
    </li>
  );
}

function AssistantBubble({
  text,
  tool,
  hintLevel,
}: {
  text: string;
  tool?: string | null;
  hintLevel?: number;
}) {
  return (
    <li className="flex justify-start">
      <div className="max-w-[80%] space-y-1">
        <div className="rounded-lg bg-muted text-foreground px-4 py-2 text-sm whitespace-pre-wrap">
          {text}
        </div>
        {tool && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground pl-1">
            {tool.replace(/_/g, ' ')}
            {hintLevel ? ` · L${hintLevel}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}

function LiveAssistantBubble() {
  const live = useApp((s) => s.live);
  if (!live) return null;
  return (
    <li className="flex justify-start">
      <div className="max-w-[80%] space-y-1">
        <div
          className="rounded-lg bg-muted text-foreground px-4 py-2 text-sm whitespace-pre-wrap"
          aria-live="polite"
          aria-atomic="false"
          role="status"
        >
          {live.text || (
            <span className="text-muted-foreground italic">Thinking…</span>
          )}
        </div>
        {live.tool_name && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground pl-1">
            {live.tool_name.replace(/_/g, ' ')}
            {live.hint_level ? ` · L${live.hint_level}` : ''}
            {live.streaming ? ' · streaming' : ''}
          </p>
        )}
      </div>
    </li>
  );
}

function EarnedFlash() {
  const earned = useApp((s) => s.earned);
  const told = useApp((s) => s.told);
  if (earned.length === 0 && told.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pt-1" aria-live="polite">
      {earned.map((e, i) => (
        <Badge key={`e-${i}`} variant="default" className="text-[10px]">
          ✓ earned: {e.concept}
        </Badge>
      ))}
      {told.map((t, i) => (
        <Badge key={`t-${i}`} variant="outline" className="text-[10px]">
          told: {t.concept}
        </Badge>
      ))}
    </div>
  );
}

function ChatSession({ sessionId, debugOpen }: { sessionId: string; debugOpen: boolean }) {
  const turns = useApp((s) => s.turns);
  const setTurns = useApp((s) => s.setTurns);
  const startLiveTurn = useApp((s) => s.startLiveTurn);
  const applyDecision = useApp((s) => s.applyDecision);
  const addEarned = useApp((s) => s.addEarned);
  const addTold = useApp((s) => s.addTold);
  const endLiveTurn = useApp((s) => s.endLiveTurn);
  const resetSession = useApp((s) => s.resetSession);

  const [message, setMessage] = useState('');
  const [state, setState] = useState<SessionState | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Hydrate whenever the session id changes. We don't bail out on a matching
  // storeSessionId because TopicPicker no longer pre-seeds the store — the
  // hydration fetch is the only thing that establishes session state.
  useEffect(() => {
    let cancelled = false;
    resetSession();
    void (async () => {
      try {
        const [fetchedTurns, fetchedState] = await Promise.all([
          getSessionTurns(sessionId),
          getSessionState(sessionId),
        ]);
        if (cancelled) return;
        setTurns(fetchedTurns);
        setState(fetchedState);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'failed to load session');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, resetSession, setTurns]);

  // Keep the transcript scrolled to the latest content as turns arrive.
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, pendingUser]);

  const onSend = useCallback(
    async (outgoing: string) => {
      if (!outgoing.trim() || streaming) return;
      setError(null);
      setMessage('');
      setPendingUser(outgoing);
      setStreaming(true);
      const nextNum = (turns[turns.length - 1]?.turn_number ?? 0) + 1;
      startLiveTurn(nextNum);

      try {
        for await (const ev of streamTurn(sessionId, outgoing)) {
          if (ev.type === 'tool_decision') applyDecision(ev);
          else if (ev.type === 'concept_earned') addEarned(ev);
          else if (ev.type === 'concept_told') addTold(ev);
          else if (ev.type === 'error') setError(ev.message);
          // turn_start / turn_end are structural — no UI side-effects here.
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'turn failed');
      } finally {
        endLiveTurn();
        setStreaming(false);
        setPendingUser(null);
        // Refresh canonical state — turns + earned/told counters.
        try {
          const [fresh, freshState] = await Promise.all([
            getSessionTurns(sessionId),
            getSessionState(sessionId),
          ]);
          setTurns(fresh);
          setState(freshState);
        } catch {
          // Best-effort refresh; keep UI live state if refresh fails.
        }
        // Move focus back to the composer so the user can reply immediately.
        composerRef.current?.focus();
      }
    },
    [sessionId, streaming, turns, startLiveTurn, applyDecision, addEarned, addTold, endLiveTurn, setTurns],
  );

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void onSend(message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base truncate">{state?.topic ?? 'Loading…'}</CardTitle>
          <ConceptBadges
            count={turns.length === 0 ? 0 : Math.max(...turns.map((t) => t.turn_number))}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <section
            aria-label="Lesson transcript"
            role="log"
            className="max-h-[60vh] overflow-y-auto border rounded-md p-3 bg-background"
          >
            <ul className="space-y-3">
              {turns.map((t) =>
                t.role === 'user' ? (
                  <UserBubble key={`u-${t.turn_number}`} text={t.display_text} />
                ) : (
                  <AssistantBubble
                    key={`a-${t.turn_number}`}
                    text={t.display_text}
                    tool={t.tool_used}
                  />
                ),
              )}
              {pendingUser && <UserBubble key="pending-user" text={pendingUser} />}
              <LiveAssistantBubble />
            </ul>
            <div ref={transcriptEndRef} />
          </section>

          <EarnedFlash />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSend(message);
            }}
            className="space-y-2"
          >
            <Label htmlFor="message">Your reply</Label>
            <Textarea
              id="message"
              ref={composerRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="Reply — Cmd/Ctrl + Enter to send"
              rows={3}
              aria-describedby="composer-help"
            />
            <div className="flex items-center justify-between">
              <p id="composer-help" className="text-xs text-muted-foreground">
                {streaming ? 'Tutor is replying…' : 'Cmd/Ctrl + Enter to send'}
              </p>
              <Button
                type="submit"
                disabled={streaming || !message.trim()}
                aria-busy={streaming}
              >
                {streaming ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {state && (
        <p className="text-xs text-muted-foreground text-right">
          Earned {state.earned.length} · Told {state.told.length} · Ratio{' '}
          {state.ratio.toFixed(2)}
        </p>
      )}

      <DebugPanel open={debugOpen} topic={state?.topic ?? ''} />
    </div>
  );
}

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const profile = useApp((s) => s.profile);
  const [debugOpen, setDebugOpen] = useDebugOpen();

  return (
    <main className="min-h-screen bg-background text-foreground p-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">SapientIA</h1>
          <div className="flex flex-wrap items-center gap-3">
            {sessionId && (
              <DebugPanelToggle open={debugOpen} onOpenChange={setDebugOpen} />
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {profileSummary(profile)}
            </span>
            {sessionId && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/chat">New topic</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/onboarding">Edit profile</Link>
            </Button>
          </div>
        </header>

        {sessionId ? (
          <ChatSession sessionId={sessionId} debugOpen={debugOpen} />
        ) : (
          <TopicPicker />
        )}
      </div>
    </main>
  );
}
