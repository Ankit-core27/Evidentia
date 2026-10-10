import { create } from 'zustand';
import { Id, RecordType } from '@/types/api';

export interface SelectedRecord {
  type: RecordType;
  id: Id;
}

interface SelectionState {
  /** The record open in a detail panel, such as a canvas node or timeline event. */
  selected: SelectedRecord | null;
  select: (record: SelectedRecord | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selected: null,
  select: (selected) => set({ selected })
}));
