import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ensureLearner, updateProfile } from '@/lib/api';
import { previewSample } from '@/lib/preview';
import { useApp } from '@/lib/store';
import type { AccessibilityProfile } from '@/lib/types';
import { defaultProfile } from '@/lib/types';

type RadioFieldProps<K extends keyof AccessibilityProfile> = {
  legend: string;
  description: string;
  name: K;
  value: AccessibilityProfile[K];
  options: { value: AccessibilityProfile[K]; label: string; description: string }[];
  onChange: (value: AccessibilityProfile[K]) => void;
};

function RadioField<K extends keyof AccessibilityProfile>(props: RadioFieldProps<K>) {
  const { legend, description, name, value, options, onChange } = props;
  const groupId = `field-${String(name)}`;
  return (
    <fieldset className="space-y-3" aria-describedby={`${groupId}-desc`}>
      <legend className="text-sm font-medium">{legend}</legend>
      <p id={`${groupId}-desc`} className="text-xs text-muted-foreground">
        {description}
      </p>
      <RadioGroup
        value={String(value)}
        onValueChange={(v) => onChange(v as AccessibilityProfile[K])}
        aria-label={legend}
      >
        {options.map((opt) => {
          const id = `${groupId}-${String(opt.value)}`;
          return (
            <div key={String(opt.value)} className="flex items-start space-x-3">
              <RadioGroupItem
                value={String(opt.value)}
                id={id}
                aria-describedby={`${id}-desc`}
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <Label htmlFor={id} className="cursor-pointer">
                  {opt.label}
                </Label>
                <p id={`${id}-desc`} className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const learner = useApp((s) => s.learner);
  const storedProfile = useApp((s) => s.profile);
  const setLearner = useApp((s) => s.setLearner);
  const setProfile = useApp((s) => s.setProfile);

  const [draft, setDraft] = useState<AccessibilityProfile>(storedProfile ?? defaultProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Move focus to the first field on mount so keyboard users start there.
    firstFieldRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
  }, []);

  const sample = useMemo(() => previewSample(draft), [draft]);

  function patch<K extends keyof AccessibilityProfile>(key: K, value: AccessibilityProfile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (learner) {
        const updated = await updateProfile(learner.id, draft);
        setLearner(updated);
      } else {
        const fresh = await ensureLearner(draft);
        setLearner(fresh);
      }
      setProfile(draft);
      navigate('/chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground p-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Tell me how you learn best</h1>
          <p className="text-sm text-muted-foreground">
            These settings change how the tutor talks to you — not just colors. Live preview on the
            right shows how a tutor opener adapts to your current choices. You can change these any
            time from the chat header.
          </p>
        </header>

        <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accessibility profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div ref={firstFieldRef}>
                <RadioField
                  legend="Visual"
                  description="Screen-reader users get verbal descriptions and linear prose instead of diagrams."
                  name="visual"
                  value={draft.visual}
                  options={[
                    { value: 'none', label: 'No accommodation', description: 'Default phrasing.' },
                    {
                      value: 'screen-reader',
                      label: 'Screen reader',
                      description: 'Verbal image descriptions; no ASCII diagrams; linear prose.',
                    },
                    {
                      value: 'low-vision',
                      label: 'Low vision',
                      description: 'Reserved for UI adaptations in a later milestone.',
                    },
                  ]}
                  onChange={(v) => patch('visual', v)}
                />
              </div>

              <RadioField
                legend="Hearing"
                description="Reserved — deeper hearing support lands in a later milestone."
                name="hearing"
                value={draft.hearing}
                options={[
                  { value: 'none', label: 'No accommodation', description: 'Default phrasing.' },
                  {
                    value: 'hoh',
                    label: 'Hard of hearing',
                    description: 'Captions and visual cues prioritized.',
                  },
                  {
                    value: 'deaf',
                    label: 'Deaf',
                    description: 'Captions and visual cues prioritized.',
                  },
                ]}
                onChange={(v) => patch('hearing', v)}
              />

              <RadioField
                legend="Cognitive"
                description="Plain language mode asks the tutor to use grade-5 reading level and define jargon on first use."
                name="cognitive"
                value={draft.cognitive}
                options={[
                  { value: 'none', label: 'No accommodation', description: 'Default phrasing.' },
                  {
                    value: 'plain-language',
                    label: 'Plain language',
                    description: 'Short sentences, everyday words, one idea at a time.',
                  },
                ]}
                onChange={(v) => patch('cognitive', v)}
              />

              <RadioField
                legend="Learning"
                description="ADHD-focus forces the tutor to ask exactly one question per turn. Dyslexia-font keeps sentences short."
                name="learning"
                value={draft.learning}
                options={[
                  { value: 'none', label: 'No accommodation', description: 'Default phrasing.' },
                  {
                    value: 'adhd-focus',
                    label: 'ADHD focus',
                    description: 'One question per turn. No compound questions.',
                  },
                  {
                    value: 'dyslexia-font',
                    label: 'Dyslexia',
                    description: 'Short sentences, extra line spacing, avoid dense paragraphs.',
                  },
                ]}
                onChange={(v) => patch('learning', v)}
              />

              <div className="space-y-2">
                <Label htmlFor="pacing-select">Pacing</Label>
                <p className="text-xs text-muted-foreground">
                  "Slow" takes smaller steps and checks in more often.
                </p>
                <Select
                  value={draft.pacing}
                  onValueChange={(v) => patch('pacing', v as AccessibilityProfile['pacing'])}
                >
                  <SelectTrigger id="pacing-select" className="w-full">
                    <SelectValue placeholder="Pacing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="slow">Slow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview: how the tutor will open</CardTitle>
              </CardHeader>
              <CardContent>
                <blockquote
                  className="border-l-2 pl-4 italic text-sm leading-relaxed"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {sample}
                </blockquote>
              </CardContent>
            </Card>

            <div className="space-y-2" aria-live="polite">
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? 'Saving…' : 'Save and continue'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}