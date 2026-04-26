import { Megaphone } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

// Click-activated mirror of the Shift+V hold for users without keyboard
// access. Click starts the recognizer; click again (or release on mobile)
// stops. Same toggle pattern as MicButton, but a distinct icon + label so
// learners can tell command mode from dictation mode.
export function VoiceCommandButton({ active, disabled, onToggle }: Props) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-keyshortcuts="Shift+V"
      className="gap-1.5"
    >
      <Megaphone className="size-4" aria-hidden="true" />
      <span className="text-xs">{active ? 'Listening' : 'Command'}</span>
    </Button>
  );
}