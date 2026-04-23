// Mirrors backend/app/schemas/profile.py AccessibilityProfile
export type AccessibilityProfile = {
  visual: 'screen-reader' | 'low-vision' | 'none';
  hearing: 'deaf' | 'hoh' | 'none';
  cognitive: 'plain-language' | 'none';
  learning: 'dyslexia-font' | 'adhd-focus' | 'none';
  pacing: 'slow' | 'normal';
};

export const defaultProfile: AccessibilityProfile = {
  visual: 'none',
  hearing: 'none',
  cognitive: 'none',
  learning: 'none',
  pacing: 'normal',
};

export type Learner = { id: string; accessibility_profile: AccessibilityProfile };

export type SessionOut = { id: string; learner_id: string; topic: string };

export type SessionState = {
  id: string;
  topic: string;
  turn_count: number;
  earned: { concept: string; evidence: string }[];
  told: { concept: string; justification: string }[];
  ratio: number;
};

export type TurnOut = {
  turn_number: number;
  role: 'user' | 'assistant';
  display_text: string;
  tool_used: string | null;
  created_at: string;
};

// SSE event shapes — must match stream_turn in backend/app/tutor/async_loop.py
export type TurnStart = { type: 'turn_start'; turn_number: number };

export type ToolName =
  | 'diagnose'
  | 'ask_socratic_question'
  | 'give_hint'
  | 'check_understanding'
  | 'mark_concept_earned'
  | 'deliver_answer';

export type ToolDecision = {
  type: 'tool_decision';
  name: ToolName;
  input: Record<string, unknown>;
  id: string;
};

export type ConceptEarned = { type: 'concept_earned'; concept: string; evidence: string };
export type ConceptTold = {
  type: 'concept_told';
  concept: string;
  justification: string;
  answer?: string;
};
export type TurnEnd = { type: 'turn_end'; violations: string[]; assistant_content?: unknown };
export type TurnError = { type: 'error'; message: string };

export type TurnEvent =
  | TurnStart
  | ToolDecision
  | ConceptEarned
  | ConceptTold
  | TurnEnd
  | TurnError;

export const TEACHING_TOOLS: ToolName[] = [
  'diagnose',
  'ask_socratic_question',
  'give_hint',
  'check_understanding',
  'deliver_answer',
];