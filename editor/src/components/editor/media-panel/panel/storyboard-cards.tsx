'use client';

import { useEffect } from 'react';
import { IconLayoutGrid, IconLoader2 } from '@tabler/icons-react';
import { SceneCard } from './scene-card';
import { useWorkflow } from '@/hooks/use-workflow';
import type { GridImageWithScenes } from '@/lib/supabase/workflow-service';

interface StoryboardCardsProps {
  projectId: string;
  refreshTrigger?: number;
}

export function StoryboardCards({
  projectId,
  refreshTrigger,
}: StoryboardCardsProps) {
  const { gridImage, loading, error, isProcessing, refresh } = useWorkflow(
    projectId,
    {
      realtime: true,
      includeScenes: true,
    }
  );

  // Refresh data when refreshTrigger changes (new storyboard generated)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  const scenes =
    gridImage && 'scenes' in gridImage
      ? (gridImage as GridImageWithScenes).scenes
      : [];

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <IconLayoutGrid size={32} className="opacity-50" />
        <span className="text-sm text-center">
          No scenes yet. Generate a storyboard to see scene cards.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Overall Status */}
      {isProcessing && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md flex items-center gap-2">
          <IconLoader2 className="size-4 animate-spin text-blue-500" />
          <span className="text-sm text-blue-500">
            Processing storyboard...
          </span>
        </div>
      )}

      {/* Scene Cards - 2 column grid */}
      <div className="grid grid-cols-2 gap-2">
        {scenes
          .sort((a, b) => a.order - b.order)
          .map((scene) => (
            <SceneCard key={scene.id} scene={scene} compact />
          ))}
      </div>
    </div>
  );
}
