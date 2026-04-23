import type { AccessibilityProfile } from './types';

/**
 * Client-side mirror of what `to_prompt_guidance` emits server-side: given a
 * profile, return a sample tutor opener that *demonstrates* the adaptation.
 * Used by the onboarding preview to prove the profile affects phrasing, not
 * just CSS.
 *
 * Order matters — higher-priority accommodations override more general ones.
 * Matches the same order the backend system prompt applies.
 */
export function previewSample(p: AccessibilityProfile): string {
  if (p.learning === 'adhd-focus') {
    return 'One question: what do you think a plant needs from the sun?';
  }
  if (p.cognitive === 'plain-language') {
    return 'Plants use sunlight to make food. Can you tell me what a plant needs from the soil?';
  }
  if (p.visual === 'screen-reader') {
    return 'Imagine a green leaf. Inside the leaf are tiny factories. What do you think those factories do with the sunlight that lands on them?';
  }
  if (p.learning === 'dyslexia-font') {
    return 'Plants take in three things. Water, light, and air. Which of those do you think matters most? Pick one.';
  }
  if (p.pacing === 'slow') {
    return 'Small step first: what comes to mind when I say the word "photosynthesis"? A word or two is plenty.';
  }
  return 'Before we get to photosynthesis itself, can you describe what you think a plant "eats"?';
}

/** Short human-readable summary of a profile — used in headers / chips. */
export function profileSummary(p: AccessibilityProfile): string {
  const parts: string[] = [];
  if (p.visual !== 'none') parts.push(p.visual);
  if (p.hearing !== 'none') parts.push(p.hearing);
  if (p.cognitive !== 'none') parts.push(p.cognitive);
  if (p.learning !== 'none') parts.push(p.learning);
  if (p.pacing !== 'normal') parts.push(p.pacing);
  return parts.length ? parts.join(' · ') : 'no specific accommodations';
}