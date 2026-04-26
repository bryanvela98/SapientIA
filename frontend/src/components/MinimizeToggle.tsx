import { Button } from '@/components/ui/button';

type Props = {
  minimized: boolean;
  onToggle: (v: boolean) => void;
};

/**
 * Header control that hides non-essential chrome (theme/TTS/pacing/
 * recap/debug toggles + Edit profile link) so the composer + transcript
 * dominate the viewport. Stays visible itself when minimized so the
 * learner has an obvious way to restore the toolbar.
 *
 * `aria-pressed` exposes the on/off state. `aria-keyshortcuts="Shift+M"`
 * tells AT verbose modes about the keyboard shortcut.
 */
export function MinimizeToggle({ minimized, onToggle }: Props) {
  const label = minimized ? 'Restore UI' : 'Minimize UI';
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={minimized}
      aria-keyshortcuts="Shift+M"
      onClick={() => onToggle(!minimized)}
      title={label}
    >
      {label}
    </Button>
  );
}