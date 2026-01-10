import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GeneratedAsset {
  id: string;
  url: string;
  text: string; // The prompt
  type: 'voiceover' | 'sfx' | 'music' | 'image' | 'video';
  createdAt: number;
}

interface GeneratedState {
  voiceovers: GeneratedAsset[];
  sfx: GeneratedAsset[];
  music: GeneratedAsset[];
  images: GeneratedAsset[];
  videos: GeneratedAsset[];

  // Track in-progress generations
  isGenerating: {
    voiceover: boolean;
    sfx: boolean;
    music: boolean;
    image: boolean;
    video: boolean;
  };

  addAsset: (asset: GeneratedAsset) => void;
  removeAsset: (id: string, type: GeneratedAsset['type']) => void;
  setGenerating: (type: GeneratedAsset['type'], isGenerating: boolean) => void;
}

const getArrayKey = (type: GeneratedAsset['type']) => {
  switch (type) {
    case 'voiceover':
      return 'voiceovers';
    case 'sfx':
      return 'sfx';
    case 'music':
      return 'music';
    case 'image':
      return 'images';
    case 'video':
      return 'videos';
  }
};

export const useGeneratedStore = create<GeneratedState>()(
  persist(
    (set) => ({
      voiceovers: [],
      sfx: [],
      music: [],
      images: [],
      videos: [],
      isGenerating: {
        voiceover: false,
        sfx: false,
        music: false,
        image: false,
        video: false,
      },

      addAsset: (asset) =>
        set((state) => {
          const key = getArrayKey(asset.type);
          return { [key]: [asset, ...state[key]] };
        }),

      removeAsset: (id, type) =>
        set((state) => {
          const key = getArrayKey(type);
          return { [key]: state[key].filter((a) => a.id !== id) };
        }),

      setGenerating: (type, isGenerating) =>
        set((state) => ({
          isGenerating: {
            ...state.isGenerating,
            [type]: isGenerating,
          },
        })),
    }),
    {
      name: 'generated-assets-storage',
      partialize: (state) => ({
        voiceovers: state.voiceovers,
        sfx: state.sfx,
        music: state.music,
        images: state.images,
        videos: state.videos,
      }), // Don't persist isGenerating
    }
  )
);
