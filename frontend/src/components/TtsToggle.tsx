import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Props = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
};

export function TtsToggle({ enabled, onEnabledChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={enabled}
        onCheckedChange={onEnabledChange}
        aria-keyshortcuts="K"
      />
      <Label htmlFor={id} className="text-xs cursor-pointer flex items-center gap-1">
        Read aloud
        {enabled && (
          <kbd className="text-[10px] font-mono border border-border rounded px-1 py-0.5 text-muted-foreground">
            K
          </kbd>
        )}
      </Label>
    </div>
  );
}