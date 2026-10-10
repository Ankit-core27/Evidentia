import { create } from 'zustand';
import { Citation, Id } from '@/types/api';

export interface CopilotTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  followUps?: string[];
  /** Set on an assistant turn when the request failed; the question can be retried. */
  error?: string;
}

interface CopilotState {
  /** Conversations by case, kept for the browser session (the backend stores none). */
  conversations: Record<Id, CopilotTurn[]>;
  /** Cases with a question waiting for its answer. */
  pending: Record<Id, boolean>;
  setPending: (caseId: Id, pending: boolean) => void;
  append: (caseId: Id, turn: CopilotTurn) => void;
  remove: (caseId: Id, turnId: string) => void;
  clear: (caseId: Id) => void;
}

export const useCopilotStore = create<CopilotState>()((set) => ({
  conversations: {},
  pending: {},
  setPending: (caseId, pending) => set((s) => ({ pending: { ...s.pending, [caseId]: pending } })),
  append: (caseId, turn) =>
    set((s) => ({ conversations: { ...s.conversations, [caseId]: [...(s.conversations[caseId] ?? []), turn] } })),
  remove: (caseId, turnId) =>
    set((s) => ({
      conversations: { ...s.conversations, [caseId]: (s.conversations[caseId] ?? []).filter((t) => t.id !== turnId) }
    })),
  clear: (caseId) => set((s) => ({ conversations: { ...s.conversations, [caseId]: [] } }))
}));
