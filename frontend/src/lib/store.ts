import { create } from 'zustand';
import type {
  AccessibilityProfile,
  ConceptEarned,
  ConceptTold,
  Learner,
  TextDelta,
  ToolDecision,
  TurnOut,
} from './types';
import { defaultProfile, TEACHING_TOOLS } from './types';

export type LiveTurn = {
  turn_number: number;
  text: string; // primary teaching prose — question / hint / answer
  tool_name: string | null;
  hint_level?: number;
  streaming: boolean;
};

type UIState = {
  // identity
  learner: Learner | null;
  profile: AccessibilityProfile;

  // session
  sessionId: string | null;
  topic: string | null;

  // transcript
  turns: TurnOut[]; // committed, from GET /turns
  live: LiveTurn | null; // in-flight tutor turn

  // pedagogy bookkeeping for this session
  decisions: ToolDecision[];
  earned: ConceptEarned[];
  told: ConceptTold[];

  // actions
  setLearner: (l: Learner) => void;
  setProfile: (p: AccessibilityProfile) => void;
  setSession: (id: string, topic: string) => void;
  setTurns: (t: TurnOut[]) => void;
  startLiveTurn: (n: number) => void;
  applyTextDelta: (d: TextDelta) => void;
  applyDecision: (d: ToolDecision) => void;
  addEarned: (e: ConceptEarned) => void;
  addTold: (t: ConceptTold) => void;
  endLiveTurn: () => void;
  resetSession: () => void;
};

export const useApp = create<UIState>((set) => ({
  learner: null,
  profile: defaultProfile,
  sessionId: null,
  topic: null,
  turns: [],
  live: null,
  decisions: [],
  earned: [],
  told: [],

  setLearner: (l) => set({ learner: l, profile: l.accessibility_profile }),

  setProfile: (p) => set({ profile: p }),

  setSession: (id, topic) =>
    set({
      sessionId: id,
      topic,
      turns: [],
      live: null,
      decisions: [],
      earned: [],
      told: [],
    }),

  setTurns: (t) => set({ turns: t }),

  startLiveTurn: (n) =>
    set({
      live: { turn_number: n, text: '', tool_name: null, streaming: true },
    }),

  // text_delta events (backend Commit 2) stream incremental chars for the
  // primary teaching field. Append to live.text, don't replace. Block_index
  // isn't tracked per-block on the UI side today because tool_choice forces
  // exactly one teaching tool_use per turn; if that ever relaxes, scope the
  // append by block_index.
  applyTextDelta: (d) =>
    set((s) => {
      const live = s.live ?? {
        turn_number: -1,
        text: '',
        tool_name: null,
        streaming: true,
      };
      return { live: { ...live, text: live.text + d.text } };
    }),

  // tool_decision arrives at content_block_stop (backend Commit 2) with the
  // fully-parsed input. We only use it here to record the tool name +
  // hint_level metadata; live.text is owned by the text_delta stream above.
  applyDecision: (d) =>
    set((s) => {
      const live = s.live ?? {
        turn_number: -1,
        text: '',
        tool_name: null,
        streaming: true,
      };
      const isTeaching = (TEACHING_TOOLS as string[]).includes(d.name);
      const hintLevel =
        d.name === 'give_hint' ? Number(d.input.level ?? 0) : live.hint_level;
      return {
        decisions: [...s.decisions, d],
        live: {
          ...live,
          tool_name: isTeaching ? d.name : live.tool_name,
          hint_level: hintLevel,
        },
      };
    }),

  addEarned: (e) => set((s) => ({ earned: [...s.earned, e] })),

  addTold: (t) => set((s) => ({ told: [...s.told, t] })),

  endLiveTurn: () => set({ live: null }),

  resetSession: () =>
    set({
      sessionId: null,
      topic: null,
      turns: [],
      live: null,
      decisions: [],
      earned: [],
      told: [],
    }),
}));