import { useCallback, useId, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/lib/store';
import type { ToolDecision, ToolName } from '@/lib/types';

export function DebugPanelToggle({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={open}
        onCheckedChange={onOpenChange}
        aria-controls="tutor-reasoning-panel"
      />
      <Label htmlFor={id} className="text-xs cursor-pointer">
        Show tutor reasoning
      </Label>
    </div>
  );
}

function toolLabel(d: ToolDecision): string {
  const name = d.name.replace(/_/g, ' ');
  if (d.name === 'give_hint') {
    const level = (d.input as { level?: number }).level;
    return level ? `${name} · L${level}` : name;
  }
  return name;
}

function conceptLabel(d: ToolDecision): string | null {
  const input = d.input as { concept?: string; concept_targeted?: string };
  return input.concept ?? input.concept_targeted ?? null;
}

function isTeaching(name: ToolName): boolean {
  return name !== 'mark_concept_earned';
}

type Props = {
  open: boolean;
  topic: string;
};

export function DebugPanel({ open, topic }: Props) {
  const decisions = useApp((s) => s.decisions);
  const earned = useApp((s) => s.earned);
  const told = useApp((s) => s.told);
  const turns = useApp((s) => s.turns);
  const [copied, setCopied] = useState(false);

  const ratio =
    earned.length + told.length === 0
      ? 0
      : earned.length / (earned.length + told.length);

  const copy = useCallback(async () => {
    const payload = {
      topic,
      turns: turns.map((t) => ({
        turn_number: t.turn_number,
        role: t.role,
        display_text: t.display_text,
        tool_used: t.tool_used,
      })),
      earned,
      told,
      decisions,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn('clipboard write failed', err);
    }
  }, [topic, turns, earned, told, decisions]);

  if (!open) return null;

  return (
    <Card
      id="tutor-reasoning-panel"
      role="region"
      aria-label="Tutor reasoning"
      className="border-dashed"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-sm">Tutor reasoning</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Live tool decisions for this session (cleared on refresh).
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={copy} aria-live="polite">
          {copied ? 'Copied' : 'Copy transcript as JSON'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="font-normal">
            earned {earned.length}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            told {told.length}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            ratio {ratio.toFixed(2)}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {decisions.length} decision{decisions.length === 1 ? '' : 's'}
          </Badge>
        </div>

        {decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No decisions yet. Send a reply to see the tutor's reasoning trace.
          </p>
        ) : (
          <ol className="space-y-1.5 text-xs font-mono">
            {decisions.map((d, i) => {
              const concept = conceptLabel(d);
              const teaching = isTeaching(d.name);
              return (
                <li
                  key={`${i}-${d.id}`}
                  className={`flex flex-wrap items-baseline gap-2 ${
                    teaching ? '' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-muted-foreground w-8 shrink-0">#{i + 1}</span>
                  <span className="uppercase tracking-wide">{toolLabel(d)}</span>
                  {concept && (
                    <span className="text-muted-foreground">· {concept}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}