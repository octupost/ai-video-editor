import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getLatestStoryboardWithScenes,
  getLatestStoryboard,
  getStoryboardWithScenesById,
  subscribeToSceneUpdates,
  type GridImage,
  type GridImageWithScenes,
  type Storyboard,
  type StoryboardWithGridImage,
} from '@/lib/supabase/workflow-service';

const fetchStoryboardData = async (
  storyboardId: string | null | undefined,
  projectId: string | null,
  includeScenes: boolean
): Promise<StoryboardWithGridImage | Storyboard | null> => {
  if (storyboardId) {
    return getStoryboardWithScenesById(storyboardId);
  }
  if (includeScenes && projectId) {
    return getLatestStoryboardWithScenes(projectId);
  }
  if (projectId) {
    return getLatestStoryboard(projectId);
  }
  return null;
};

interface UseWorkflowOptions {
  /** Whether to subscribe to real-time updates */
  realtime?: boolean;
  /** Whether to include scenes data */
  includeScenes?: boolean;
  /** Optional specific storyboard ID to fetch. If provided, fetches that storyboard instead of latest */
  storyboardId?: string | null;
}

interface UseWorkflowResult {
  /** The latest storyboard data */
  storyboard: StoryboardWithGridImage | Storyboard | null;
  /** The latest grid image data (derived from storyboard for backward compatibility) */
  gridImage: GridImageWithScenes | GridImage | null;
  /** Whether data is being loaded */
  loading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Manually refresh the data */
  refresh: () => Promise<void>;
  /** Whether the workflow is complete (all first_frames are success/failed) */
  isComplete: boolean;
  /** Whether the workflow is in progress */
  isProcessing: boolean;
}

/**
 * Hook to fetch and optionally subscribe to the latest workflow for a project
 */
export function useWorkflow(
  projectId: string | null,
  options: UseWorkflowOptions = {}
): UseWorkflowResult {
  const { realtime = false, includeScenes = true, storyboardId } = options;

  const [storyboard, setStoryboard] = useState<
    StoryboardWithGridImage | Storyboard | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasFetchedRef = useRef(false);

  // Derive gridImage from storyboard for backward compatibility
  const gridImage = useMemo((): GridImageWithScenes | GridImage | null => {
    if (!storyboard) return null;
    if ('grid_images' in storyboard && storyboard.grid_images?.[0]) {
      return storyboard.grid_images[0];
    }
    return null;
  }, [storyboard]);

  const fetchData = useCallback(async () => {
    // If storyboardId is provided, use it; otherwise require projectId
    if (!storyboardId && !projectId) {
      setStoryboard(null);
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial fetch, not on refreshes
    if (!hasFetchedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchStoryboardData(
        storyboardId,
        projectId,
        includeScenes
      );
      setStoryboard(data);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch workflow')
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, includeScenes, storyboardId]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for grid_images, first_frames, and voiceovers
  useEffect(() => {
    if (!realtime || !gridImage?.id) return;

    const unsubscribe = subscribeToSceneUpdates(gridImage.id, {
      onGridImageUpdate: (updated) => {
        setStoryboard((prev) => {
          if (!prev || !('grid_images' in prev)) return prev;
          // Update the grid_image in the storyboard
          const updatedGridImages = prev.grid_images.map((gi) =>
            gi.id === updated.id ? { ...updated, scenes: gi.scenes } : gi
          );
          return { ...prev, grid_images: updatedGridImages };
        });
      },
      onFirstFrameUpdate: (updatedFrame) => {
        setStoryboard((prev) => {
          if (!prev || !('grid_images' in prev)) return prev;
          // Update the first_frame in the appropriate scene
          const updatedGridImages = prev.grid_images.map((gi) => ({
            ...gi,
            scenes: gi.scenes.map((scene) => ({
              ...scene,
              first_frames: scene.first_frames.map((ff) =>
                ff.id === updatedFrame.id ? updatedFrame : ff
              ),
            })),
          }));
          return { ...prev, grid_images: updatedGridImages };
        });
      },
      onVoiceoverUpdate: (updatedVoiceover) => {
        setStoryboard((prev) => {
          if (!prev || !('grid_images' in prev)) return prev;
          // Update or add the voiceover in the appropriate scene
          const updatedGridImages = prev.grid_images.map((gi) => ({
            ...gi,
            scenes: gi.scenes.map((scene) => {
              // Check if this voiceover belongs to this scene
              const existingIndex = scene.voiceovers.findIndex(
                (vo) => vo.id === updatedVoiceover.id
              );
              if (existingIndex >= 0) {
                // Update existing voiceover
                return {
                  ...scene,
                  voiceovers: scene.voiceovers.map((vo) =>
                    vo.id === updatedVoiceover.id ? updatedVoiceover : vo
                  ),
                };
              } else if (scene.id === updatedVoiceover.scene_id) {
                // Add new voiceover to this scene
                return {
                  ...scene,
                  voiceovers: [...scene.voiceovers, updatedVoiceover],
                };
              }
              return scene;
            }),
          }));
          return { ...prev, grid_images: updatedGridImages };
        });
      },
    });

    return unsubscribe;
  }, [realtime, gridImage?.id]);

  // Compute derived state
  const isProcessing =
    gridImage?.status === 'pending' || gridImage?.status === 'processing';

  const isComplete = (() => {
    if (!gridImage) return false;
    if (gridImage.status === 'failed') return true;
    if (gridImage.status !== 'success') return false;

    // If we have scenes, check all first_frames
    if ('scenes' in gridImage && gridImage.scenes) {
      return gridImage.scenes.every((scene) =>
        scene.first_frames.every(
          (ff) => ff.status === 'success' || ff.status === 'failed'
        )
      );
    }

    return gridImage.status === 'success';
  })();

  return {
    storyboard,
    gridImage,
    loading,
    error,
    refresh: fetchData,
    isComplete,
    isProcessing,
  };
}

/**
 * Hook to poll for workflow completion
 * Useful when real-time subscriptions are not available or desired
 */
export function useWorkflowPolling(
  projectId: string | null,
  options: { pollInterval?: number; enabled?: boolean } = {}
) {
  const { pollInterval = 3000, enabled = true } = options;
  const workflow = useWorkflow(projectId, { includeScenes: true });

  useEffect(() => {
    if (!enabled || !projectId || workflow.isComplete) return;

    const interval = setInterval(() => {
      workflow.refresh();
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, projectId, workflow.isComplete, pollInterval, workflow.refresh]);

  return workflow;
}
