import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Id } from '@/types/api';

interface InvestigatorState {
  /** Investigator picked in the header; sent as X-Investigator-Id until access control lands (M8). */
  investigatorId: Id | null;
  setInvestigatorId: (id: Id | null) => void;
}

export const useInvestigatorStore = create<InvestigatorState>()(
  persist(
    (set) => ({
      investigatorId: null,
      setInvestigatorId: (investigatorId) => set({ investigatorId })
    }),
    { name: 'evidentia.investigator' }
  )
);
