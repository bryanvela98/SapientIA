import type {
  AccessibilityProfile,
  Learner,
  SessionOut,
  SessionState,
  TurnEvent,
  TurnOut,
} from './types';
import { clearCachedLearnerId, getCachedLearnerId, setCachedLearnerId } from './identity';

export const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? 'http://localhost:8000';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function jsonHeaders(): HeadersInit {
  const id = getCachedLearnerId();
  return id
    ? { 'Content-Type': 'application/json', 'X-Learner-ID': id }
    : { 'Content-Type': 'application/json' };
}

/**
 * Get-or-create the learner. If a cached id exists but the backend 404s it
 * (DB wiped during dev), fall through and create a fresh learner.
 */
export async function ensureLearner(profile: AccessibilityProfile): Promise<Learner> {
  const cached = getCachedLearnerId();
  if (cached) {
    const res = await fetch(`${API_BASE}/learner/${cached}`);
    if (res.ok) return (await res.json()) as Learner;
    if (res.status === 404) clearCachedLearnerId();
  }
  const res = await fetch(`${API_BASE}/learner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessibility_profile: profile }),
  });
  const learner = await json<Learner>(res);
  setCachedLearnerId(learner.id);
  return learner;
}

export async function getLearner(learnerId: string): Promise<Learner> {
  return json<Learner>(await fetch(`${API_BASE}/learner/${learnerId}`));
}

export async function updateProfile(
  learnerId: string,
  profile: AccessibilityProfile,
): Promise<Learner> {
  return json<Learner>(
    await fetch(`${API_BASE}/learner/${learnerId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessibility_profile: profile }),
    }),
  );
}

export async function createSession(topic: string): Promise<SessionOut> {
  return json<SessionOut>(
    await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ topic }),
    }),
  );
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  return json<SessionState>(await fetch(`${API_BASE}/session/${sessionId}/state`));
}

export async function getSessionTurns(sessionId: string): Promise<TurnOut[]> {
  return json<TurnOut[]>(await fetch(`${API_BASE}/session/${sessionId}/turns`));
}

/**
 * Stream one tutor turn. Yields parsed SSE events until the server closes
 * the stream. Uses fetch + ReadableStream because EventSource is GET-only
 * and our turn endpoint is POST-with-body.
 *
 * Parser: SSE events are separated by a blank line ("\n\n"). Each event's
 * `data:` line(s) carry a JSON payload; `event:` is emitted by sse-starlette
 * but our payloads are self-identifying via `type`, so we ignore it.
 */
export async function* streamTurn(
  sessionId: string,
  message: string,
): AsyncGenerator<TurnEvent> {
  const res = await fetch(`${API_BASE}/session/${sessionId}/turn`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`turn failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // SSE event boundary is a blank line, which the spec allows as \r\n\r\n,
  // \n\n, or \r\r. sse-starlette uses \r\n\r\n; match any of the three so
  // the parser works against any SSE-compliant server.
  const EVENT_BOUNDARY = /\r\n\r\n|\n\n|\r\r/;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let match: RegExpExecArray | null;
    while ((match = EVENT_BOUNDARY.exec(buffer)) !== null) {
      const rawEvent = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);

      const dataLines: string[] = [];
      // Lines inside an event are separated by \r\n, \n, or \r per spec.
      for (const line of rawEvent.split(/\r\n|\n|\r/)) {
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;

      try {
        yield JSON.parse(dataLines.join('\n')) as TurnEvent;
      } catch (err) {
        console.warn('[sse] bad JSON payload', dataLines, err);
      }
    }
  }
}