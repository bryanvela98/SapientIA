import { HelpCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  COMMAND_LABELS,
  COMMAND_PHRASES,
  type CommandIntent,
} from '@/lib/voice-commands';

type Props = {
  voiceSupported: boolean;
  sttSupported: boolean;
  ttsSupported: boolean;
};

type ChordRow = {
  chord: string;
  action: string;
  // When false, the row renders dimmed with a "(unsupported)" tag so the
  // learner knows why the chord isn't doing anything in their browser.
  enabled: boolean;
};

const VOICE_ORDER: CommandIntent['type'][] = [
  'recap',
  'send',
  'pacing-slow',
  'pacing-normal',
  'tts-on',
  'tts-off',
  'cancel',
  'minimize-on',
  'minimize-off',
];

function formatPhrases(phrases: readonly string[]): string {
  return phrases.map((p) => `"${p}"`).join(' / ');
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}

export function HelpDialog({ voiceSupported, sttSupported, ttsSupported }: Props) {
  const chords: ChordRow[] = [
    { chord: 'Cmd/Ctrl + Enter', action: 'Send the message', enabled: true },
    {
      chord: 'Shift + Space (hold)',
      action: 'Dictate into the composer',
      enabled: sttSupported,
    },
    {
      chord: 'Shift + V (hold)',
      action: 'Issue a voice command (outside the composer)',
      enabled: voiceSupported,
    },
    { chord: 'Shift + M', action: 'Minimize / restore the toolbar', enabled: true },
    {
      chord: 'K',
      action: 'Pause / resume read-aloud (when speaking)',
      enabled: ttsSupported,
    },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Keyboard shortcuts and voice commands"
          className="gap-1.5"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          <span className="text-xs">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts &amp; voice commands</DialogTitle>
          <DialogDescription>
            Hands-free actions and chords available throughout the app.
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby="help-keyboard" className="space-y-2">
          <h3 id="help-keyboard" className="text-sm font-semibold">
            Keyboard
          </h3>
          <ul className="space-y-1.5 text-sm">
            {chords.map((c) => (
              <li
                key={c.chord}
                className={`flex items-baseline justify-between gap-3 ${
                  c.enabled ? '' : 'opacity-60'
                }`}
              >
                <span className="shrink-0">
                  <Kbd>{c.chord}</Kbd>
                </span>
                <span className="text-right text-muted-foreground">
                  {c.action}
                  {!c.enabled && (
                    <span className="ml-1 text-xs italic">(not available in this browser)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="help-voice" className="space-y-2">
          <h3 id="help-voice" className="text-sm font-semibold">
            Voice commands
          </h3>
          {voiceSupported ? (
            <p className="text-xs text-muted-foreground">
              Hold <Kbd>Shift + V</Kbd> outside the composer and speak. Voice
              activation cancels in-flight read-aloud.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Voice commands aren't available in this browser. Try Chrome,
              Edge, or Safari for Web Speech API support.
            </p>
          )}
          <ul className="space-y-1.5 text-sm">
            {VOICE_ORDER.map((type) => (
              <li
                key={type}
                className={`flex items-baseline justify-between gap-3 ${
                  voiceSupported ? '' : 'opacity-60'
                }`}
              >
                <span className="shrink-0 font-medium">{COMMAND_LABELS[type]}</span>
                <span className="text-right text-muted-foreground">
                  {formatPhrases(COMMAND_PHRASES[type])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}