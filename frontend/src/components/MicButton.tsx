import { Mic, MicOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = {
  listening: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function MicButton({ listening, disabled, onToggle }: Props) {
  return (
    <Button
      type="button"
      size="sm"
      variant={listening ? 'default' : 'outline'}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-keyshortcuts="Shift+Space"
      className="gap-1.5"
    >
      {listening ? (
        <MicOff className="size-4" aria-hidden="true" />
      ) : (
        <Mic className="size-4" aria-hidden="true" />
      )}
      <span className="text-xs">{listening ? 'Stop' : 'Dictate'}</span>
    </Button>
  );
}