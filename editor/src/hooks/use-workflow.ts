import { useState, useEffect, useCallback } from 'react';
import {
  getLatestGridImageWithScenes,
  getLatestGridImage,
  subscribeToGridImageStatus,
  subscribeToFirstFrameUpdates,
  type GridImage,
  type GridImageWithScenes,
  type FirstFrame,
} from '@/lib/supabase/workflow-service';

interface UseWorkflowOptions {
  /** Whether to subscribe to real-time updates */
  realtime?: boolean;
  /** Whether to include scenes data */
  includeScenes?: boolean;
}

interface UseWorkflowResult {
  /** The latest grid image data */
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
  const { realtime = false, includeScenes = true } = options;

  const [gridImage, setGridImage] = useState<
    GridImageWithScenes | GridImage | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setGridImage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = includeScenes
        ? await getLatestGridImageWithScenes(projectId)
        : await getLatestGridImage(projectId);
      setGridImage(data);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to fetch workflow')
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, includeScenes]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !gridImage?.id) return;

    const unsubscribeGrid = subscribeToGridImageStatus(
      gridImage.id,
      (updated) => {
        setGridImage((prev) => {
          if (!prev) return updated;
          // Merge with existing scenes if we have them
          if ('scenes' in prev) {
            return { ...updated, scenes: prev.scenes };
          }
          return updated;
        });
      }
    );

    const unsubscribeFrames = subscribeToFirstFrameUpdates(
      gridImage.id,
      (updatedFrame) => {
        setGridImage((prev) => {
          if (!prev || !('scenes' in prev)) return prev;
          // Update the first_frame in the appropriate scene
          const updatedScenes = prev.scenes.map((scene) => ({
            ...scene,
            first_frames: scene.first_frames.map((ff) =>
              ff.id === updatedFrame.id ? updatedFrame : ff
            ),
          }));
          return { ...prev, scenes: updatedScenes };
        });
      }
    );

    return () => {
      unsubscribeGrid();
      unsubscribeFrames();
    };
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
