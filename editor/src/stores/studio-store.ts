import { create } from 'zustand';
import type { Studio, IClip } from 'openvideo';

interface StudioState {
  studio: Studio | null;
  setStudio: (studio: Studio | null) => void;
  selectedClips: IClip[];
  setSelectedClips: (clips: IClip[]) => void;
  selectedTransitionKey: string | null;
  setSelectedTransitionKey: (key: string | null) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  studio: null,
  setStudio: (studio) => set({ studio }),
  selectedClips: [],
  setSelectedClips: (clips) => set({ selectedClips: clips }),
  selectedTransitionKey: null,
  setSelectedTransitionKey: (key) => set({ selectedTransitionKey: key }),
}));
