// Fixed-keyword voice command grammar. Parses a recognizer transcript into a
// `CommandIntent` or null. Freeform/multi-step parsing (e.g. "go back two
// turns") is explicitly out of scope — the small fixed grammar is predictable
// for learners and tests cleanly. See ADR-032 (added Day 7).
//
// Matching strategy: normalize whitespace + case + drop trailing punctuation,
// exact-match first, then prefix-match against a length-sorted phrase list so
// "stop reading" wins over the shorter "stop" before falling through to a
// trailing-words match like "stop please" → cancel.

export type CommandIntent =
  | { type: 'recap' }
  | { type: 'send' }
  | { type: 'pacing-slow' }
  | { type: 'pacing-normal' }
  | { type: 'tts-on' }
  | { type: 'tts-off' }
  | { type: 'cancel' }
  | { type: 'minimize-on' }
  | { type: 'minimize-off' };

const GRAMMAR: ReadonlyArray<{ phrases: readonly string[]; intent: CommandIntent }> = [
  { phrases: ['recap', 'recap so far'], intent: { type: 'recap' } },
  { phrases: ['send', 'submit'], intent: { type: 'send' } },
  { phrases: ['slow down', 'slower'], intent: { type: 'pacing-slow' } },
  { phrases: ['normal pace', 'speed up'], intent: { type: 'pacing-normal' } },
  { phrases: ['read aloud', 'turn on voice'], intent: { type: 'tts-on' } },
  { phrases: ['stop reading', 'turn off voice'], intent: { type: 'tts-off' } },
  { phrases: ['stop', 'cancel'], intent: { type: 'cancel' } },
  { phrases: ['minimize', 'hide controls'], intent: { type: 'minimize-on' } },
  { phrases: ['restore', 'show controls', 'maximize'], intent: { type: 'minimize-off' } },
];

const ALL_PHRASES: ReadonlyArray<{ phrase: string; intent: CommandIntent }> = GRAMMAR
  .flatMap((entry) => entry.phrases.map((phrase) => ({ phrase, intent: entry.intent })))
  // Longest first so "stop reading" matches before "stop" in prefix mode.
  .sort((a, b) => b.phrase.length - a.phrase.length);

function normalize(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[.,!?;:]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseCommand(transcript: string): CommandIntent | null {
  const text = normalize(transcript);
  if (!text) return null;
  for (const { phrase, intent } of ALL_PHRASES) {
    if (text === phrase) return intent;
  }
  for (const { phrase, intent } of ALL_PHRASES) {
    if (text.startsWith(`${phrase} `)) return intent;
  }
  return null;
}

// Human-readable label for a parsed intent. Used by VoiceCommandBanner so the
// user sees what was heard before the action fires.
export const COMMAND_LABELS: Record<CommandIntent['type'], string> = {
  recap: 'Recap so far',
  send: 'Send',
  'pacing-slow': 'Slow pacing',
  'pacing-normal': 'Normal pacing',
  'tts-on': 'Read aloud',
  'tts-off': 'Stop reading',
  cancel: 'Stop',
  'minimize-on': 'Minimize UI',
  'minimize-off': 'Restore UI',
};

// Short list shown in the error banner when the recognizer captured speech we
// couldn't parse. Keep tight — long help text reads slowly under SR.
export const COMMAND_HELP_LIST = [
  'recap',
  'send',
  'slow down',
  'read aloud',
  'stop',
  'minimize',
  'restore',
];