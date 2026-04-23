import { Button } from '@/components/ui/button';

type Props = {
  onArm: () => void;
};

// Browsers block SpeechSynthesis until the tab has received a user gesture.
// This banner surfaces that requirement on cold deep-links to `/chat/:id`
// when TTS is enabled but no gesture has happened yet. One click anywhere
// dismisses it (arm listener in useAudioArmed), but the explicit button
// makes the expectation legible to screen-reader and low-vision users.
export function AudioArmBanner({ onArm }: Props) {
  return (
    <div
      role="region"
      aria-label="Audio permission"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3"
    >
      <p className="text-xs text-muted-foreground">
        Click to enable audio. Your browser blocks speech until you interact with the page.
      </p>
      <Button size="sm" onClick={onArm}>
        Enable audio
      </Button>
    </div>
  );
}