import {
  COMMAND_HELP_LIST,
  COMMAND_LABELS,
  type CommandIntent,
} from '@/lib/voice-commands';

type VoiceState = 'idle' | 'listening' | 'parsed' | 'dispatched' | 'error';

type Props = {
  state: VoiceState;
  lastIntent: CommandIntent | null;
  lastError: string | null;
};

// Distinct visual treatment from ListeningBanner (red pulse for STT) — voice
// command mode uses blue/emerald so sighted learners can tell at a glance
// which mode the mic is in. assertive live-region so SR users hear the state
// transitions; the listening pulse is hidden from AT (decorative).
export function VoiceCommandBanner({ state, lastIntent, lastError }: Props) {
  if (state === 'idle') return null;

  let label: string;
  let tone: 'listening' | 'parsed' | 'dispatched' | 'error';

  if (state === 'listening') {
    label = 'Voice command — speak now';
    tone = 'listening';
  } else if (state === 'parsed') {
    label = `Heard: ${lastIntent ? COMMAND_LABELS[lastIntent.type] : '…'}`;
    tone = 'parsed';
  } else if (state === 'dispatched') {
    label = `✓ ${lastIntent ? COMMAND_LABELS[lastIntent.type] : 'Done'}`;
    tone = 'dispatched';
  } else {
    label =
      lastError === 'no-match'
        ? `Didn't catch that. Try: ${COMMAND_HELP_LIST.join(', ')}.`
        : lastError || 'Voice command error';
    tone = 'error';
  }

  const wrapClass = {
    listening: 'border-blue-500/60 bg-blue-500/5',
    parsed: 'border-blue-500/60 bg-blue-500/10',
    dispatched: 'border-emerald-500/60 bg-emerald-500/10',
    error: 'border-destructive/60 bg-destructive/5',
  }[tone];

  const dotClass = {
    listening: 'bg-blue-500',
    parsed: 'bg-blue-500',
    dispatched: 'bg-emerald-500',
    error: 'bg-destructive',
  }[tone];

  const showPulse = tone === 'listening';

  return (
    <div
      role="status"
      aria-live="assertive"
      data-voice-state={state}
      className={`flex items-center gap-3 rounded-md border p-3 ${wrapClass}`}
    >
      <span className="relative flex size-2.5" aria-hidden="true">
        {showPulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`}
          />
        )}
        <span className={`relative inline-flex size-2.5 rounded-full ${dotClass}`} />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}