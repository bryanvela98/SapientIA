import { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type Props = {
  slow: boolean;
  onSlowChange: (v: boolean) => void;
  disabled?: boolean;
};

/**
 * In-chat pacing toggle. ON → profile.pacing='slow', OFF → 'normal'.
 * The caller owns optimistic update + PATCH /learner/{id}/profile; this
 * component is pure presentation.
 *
 * Mid-stream toggles land on the NEXT turn — the current turn's system
 * prompt is already on the wire. We don't try to hot-swap the prompt.
 */
export function PacingToggle({ slow, onSlowChange, disabled }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={slow}
        onCheckedChange={onSlowChange}
        disabled={disabled}
      />
      <Label htmlFor={id} className="text-xs cursor-pointer">
        Slow down
      </Label>
    </div>
  );
}