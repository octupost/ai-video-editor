import { create } from 'zustand';
import { Asset, AssetType } from '@/types/media';

// Re-export Asset type for convenience
export type { Asset, AssetType };

// Generation types (excludes 'upload' which is user-uploaded)
type GenerationType = Exclude<AssetType, 'upload'>;

// Helper to get the array key for a given asset type
const getArrayKey = (type: AssetType): keyof Pick<AssetState, 'voiceovers' | 'sfx' | 'music' | 'images' | 'videos' | 'uploads'> => {
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
    case 'upload':
      return 'uploads';
  }
};

interface AssetState {
  // Separate arrays for each asset type (stable references)
  voiceovers: Asset[];
  sfx: Asset[];
  music: Asset[];
  images: Asset[];
  videos: Asset[];
  uploads: Asset[];

  // Track in-progress generations
  isGenerating: Record<GenerationType, boolean>;

  // Loading state for fetching from Supabase
  isLoading: boolean;
  hasFetched: boolean;
  currentProjectId: string | null;

  // Asset operations
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string, type: AssetType) => void;
  setGenerating: (type: GenerationType, isGenerating: boolean) => void;

  // Supabase integration
  fetchAssets: (projectId: string) => Promise<void>;
  deleteAsset: (id: string, type: AssetType) => Promise<void>;
  setCurrentProject: (projectId: string) => void;
  resetForProject: (projectId: string) => void;
}

export const useAssetStore = create<AssetState>()((set, get) => ({
  voiceovers: [],
  sfx: [],
  music: [],
  images: [],
  videos: [],
  uploads: [],
  isGenerating: {
    voiceover: false,
    sfx: false,
    music: false,
    image: false,
    video: false,
  },
  isLoading: false,
  hasFetched: false,
  currentProjectId: null,

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

  // Fetch all assets from Supabase for a project
  fetchAssets: async (projectId: string) => {
    const state = get();
    // Don't fetch if already fetched for this project
    if (state.hasFetched && state.currentProjectId === projectId) return;

    set({ isLoading: true, currentProjectId: projectId });
    try {
      const response = await fetch(`/api/assets?project_id=${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }
      const { assets: rawAssets } = await response.json();

      // Categorize assets into separate arrays
      const voiceovers: Asset[] = [];
      const sfx: Asset[] = [];
      const music: Asset[] = [];
      const images: Asset[] = [];
      const videos: Asset[] = [];
      const uploads: Asset[] = [];

      for (const raw of rawAssets) {
        const asset: Asset = {
          id: raw.id,
          url: raw.url,
          type: raw.type,
          name: raw.prompt || raw.name, // Use prompt as name for generated, filename for uploads
          prompt: raw.prompt,
          size: raw.size,
          createdAt: new Date(raw.created_at).getTime(),
        };

        switch (raw.type) {
          case 'voiceover':
            voiceovers.push(asset);
            break;
          case 'sfx':
            sfx.push(asset);
            break;
          case 'music':
            music.push(asset);
            break;
          case 'image':
            images.push(asset);
            break;
          case 'video':
            videos.push(asset);
            break;
          case 'upload':
            uploads.push(asset);
            break;
        }
      }

      // Sort each array by createdAt (newest first)
      const sortByDate = (a: Asset, b: Asset) => b.createdAt - a.createdAt;
      
      set({
        voiceovers: voiceovers.sort(sortByDate),
        sfx: sfx.sort(sortByDate),
        music: music.sort(sortByDate),
        images: images.sort(sortByDate),
        videos: videos.sort(sortByDate),
        uploads: uploads.sort(sortByDate),
        hasFetched: true,
      });
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Delete asset from Supabase
  deleteAsset: async (id, type) => {
    try {
      const response = await fetch(`/api/assets?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete asset');
      }

      // Remove from local state
      const key = getArrayKey(type);
      set((state) => ({
        [key]: state[key].filter((a) => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete asset:', error);
      throw error;
    }
  },

  // Set current project without fetching
  setCurrentProject: (projectId: string) => {
    set({ currentProjectId: projectId });
  },

  // Reset store for a new project
  resetForProject: (projectId: string) => {
    set({
      voiceovers: [],
      sfx: [],
      music: [],
      images: [],
      videos: [],
      uploads: [],
      hasFetched: false,
      currentProjectId: projectId,
    });
  },
}));
