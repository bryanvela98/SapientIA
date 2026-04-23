type Props = {
  interim: string;
};

// Rendered while the recognizer is active. The outer region is assertive so
// screen-reader users know the mic is hot (speech output should stop being
// polite when it's reporting active recording). The interim text updates
// live but is wrapped in a polite region nested inside so it doesn't re-read
// as aggressively as the "Listening" status.
export function ListeningBanner({ interim }: Props) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="flex items-center gap-3 rounded-md border border-destructive/60 bg-destructive/5 p-3"
    >
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
      </span>
      <span className="text-sm font-medium">Listening…</span>
      {interim && (
        <span
          className="text-sm text-muted-foreground italic truncate"
          aria-live="polite"
        >
          {interim}
        </span>
      )}
    </div>
  );
}