import { Button } from '@/components/ui/button';

type Props = {
  disabled?: boolean;
  onRecap: () => void;
  earnedCount: number;
};

/**
 * In-chat control that explicitly asks the tutor to fire `progress_summary`.
 * Disabled while a turn is streaming (spam-click guard) or before the
 * learner has earned any concepts (nothing to recap yet) — the tooltip
 * below explains the latter so it doesn't look like a random dead button.
 */
export function RecapButton({ disabled, onRecap, earnedCount }: Props) {
  const hasEarned = earnedCount > 0;
  const title = !hasEarned
    ? 'Recaps unlock after your first earned concept'
    : 'Summarize what we’ve covered';
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || !hasEarned}
      onClick={onRecap}
      title={title}
      aria-label="Recap so far"
    >
      Recap so far
    </Button>
  );
}