type Props = {
  summary: string;
  conceptsRecapped?: string[];
  nextFocus?: string;
  streaming?: boolean;
};

/**
 * Visual callout for a `progress_summary` turn — distinct from MessageBubble.
 * Left-accent border, subtle muted tint, "Recap" label, bullet list of the
 * consolidated concepts, and a "Next:" line pointing at the upcoming focus.
 *
 * aria-live is polite (not assertive): the recap is important but should
 * wait for the current live turn to finish announcing. The streaming recap
 * text lands in live.text first; this bubble renders the final persisted
 * recap, potentially enriched with `conceptsRecapped` + `nextFocus` if the
 * matching entry is still in the session's `recaps` store.
 */
export function RecapBubble({ summary, conceptsRecapped, nextFocus, streaming }: Props) {
  return (
    <li className="flex justify-start">
      <div
        role="group"
        aria-label="Progress recap"
        aria-live="polite"
        aria-atomic="false"
        className="w-full max-w-[80%] rounded-md border border-l-[3px] border-l-primary bg-muted/40 p-4 space-y-2"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recap{streaming ? ' · streaming' : ''}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {summary || <span className="italic text-muted-foreground">Summarizing…</span>}
        </p>
        {conceptsRecapped && conceptsRecapped.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
            {conceptsRecapped.map((c, i) => (
              <li key={`${c}-${i}`}>{c}</li>
            ))}
          </ul>
        )}
        {nextFocus && (
          <p className="text-sm">
            <span className="font-medium">Next: </span>
            <span>{nextFocus}</span>
          </p>
        )}
      </div>
    </li>
  );
}