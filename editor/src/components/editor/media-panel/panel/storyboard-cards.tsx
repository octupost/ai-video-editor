'use client';

import { useEffect, useState } from 'react';
import {
  IconLayoutGrid,
  IconLoader2,
  IconMicrophone,
  IconPlayerTrackNext,
  IconSparkles,
  IconVideo,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { SceneCard } from './scene-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkflow } from '@/hooks/use-workflow';
import { useStudioStore } from '@/stores/studio-store';
import { createClient } from '@/lib/supabase/client';
import {
  addSceneToTimeline,
  findCompatibleTrack,
} from '@/lib/scene-timeline-utils';
import type { GridImageWithScenes } from '@/lib/supabase/workflow-service';

interface StoryboardCardsProps {
  projectId: string;
  storyboardId?: string | null;
  refreshTrigger?: number;
}

export function StoryboardCards({
  projectId,
  storyboardId,
  refreshTrigger,
}: StoryboardCardsProps) {
  const { gridImage, loading, error, isProcessing, refresh } = useWorkflow(
    projectId,
    {
      realtime: true,
      includeScenes: true,
      storyboardId,
    }
  );

  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(
    new Set()
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoResolution, setVideoResolution] = useState<
    '480p' | '720p' | '1080p'
  >('720p');
  const [isAddingToTimeline, setIsAddingToTimeline] = useState(false);
  const [playingVoiceoverId, setPlayingVoiceoverId] = useState<string | null>(
    null
  );
  const { studio } = useStudioStore();

  // Refresh data when refreshTrigger changes (new storyboard generated)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  const scenes =
    gridImage && 'scenes' in gridImage
      ? (gridImage as GridImageWithScenes).scenes
      : [];

  const sortedScenes = scenes.sort((a, b) => a.order - b.order);

  const toggleScene = (sceneId: string, selected: boolean) => {
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(sceneId);
      } else {
        next.delete(sceneId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSceneIds(new Set(sortedScenes.map((s) => s.id)));
  };

  const clearSelection = () => {
    setSelectedSceneIds(new Set());
  };

  const allSelected =
    sortedScenes.length > 0 && selectedSceneIds.size === sortedScenes.length;

  const handleGenerateVoiceovers = async () => {
    if (selectedSceneIds.size === 0) return;

    setIsGenerating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('generate-tts', {
        body: { scene_ids: Array.from(selectedSceneIds) },
      });

      if (error) throw error;

      toast.success(
        `Voiceover generation started for ${data.summary.queued} scene(s)`
      );
      clearSelection();
      refresh(); // Fetch updated voiceover statuses to show "Generating..." state
    } catch (err) {
      console.error('Failed to generate voiceovers:', err);
      toast.error('Failed to generate voiceovers');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhanceImages = async () => {
    if (selectedSceneIds.size === 0) return;

    setIsEnhancing(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('enhance-image', {
        body: { scene_ids: Array.from(selectedSceneIds) },
      });

      if (error) throw error;

      toast.success(
        `Image enhancement started for ${data.summary.queued} scene(s)`
      );
      clearSelection();
      refresh(); // Fetch updated enhance statuses
    } catch (err) {
      console.error('Failed to enhance images:', err);
      toast.error('Failed to enhance images');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (selectedSceneIds.size === 0) return;

    setIsGeneratingVideo(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        'generate-video',
        {
          body: {
            scene_ids: Array.from(selectedSceneIds),
            resolution: videoResolution,
          },
        }
      );

      if (error) throw error;

      toast.success(
        `Video generation started for ${data.summary.queued} scene(s)`
      );
      clearSelection();
      refresh(); // Fetch updated video statuses
    } catch (err) {
      console.error('Failed to generate videos:', err);
      toast.error('Failed to generate videos');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Check if any selected scenes have videos ready
  const selectedScenesWithVideo = sortedScenes.filter(
    (s) =>
      selectedSceneIds.has(s.id) &&
      s.first_frames?.[0]?.video_status === 'success' &&
      s.first_frames?.[0]?.video_url
  );

  const handleAddAllToTimeline = async () => {
    if (!studio || selectedScenesWithVideo.length === 0) return;

    setIsAddingToTimeline(true);
    try {
      // Compute initial start time from existing clips
      let runningEnd = studio.clips.reduce((max, c) => {
        const end =
          c.display.to > 0 ? c.display.to : c.display.from + c.duration;
        return end > max ? end : max;
      }, 0);

      // Try to reuse existing tracks if they don't have overlapping clips
      const estimatedEnd = runningEnd + 10;
      let videoTrackId: string | undefined = findCompatibleTrack(
        studio,
        'Video',
        runningEnd,
        estimatedEnd
      )?.id;
      let audioTrackId: string | undefined = findCompatibleTrack(
        studio,
        'Audio',
        runningEnd,
        estimatedEnd
      )?.id;

      // Sort selected scenes by order and add sequentially
      const scenesToAdd = [...selectedScenesWithVideo].sort(
        (a, b) => a.order - b.order
      );

      for (const scene of scenesToAdd) {
        const firstFrame = scene.first_frames[0];
        const voiceover = scene.voiceovers?.[0];

        const result = await addSceneToTimeline(
          studio,
          {
            videoUrl: firstFrame.video_url!,
            voiceover:
              voiceover?.status === 'success' && voiceover?.audio_url
                ? { audioUrl: voiceover.audio_url }
                : null,
          },
          {
            startTime: runningEnd,
            videoTrackId,
            audioTrackId,
          }
        );

        runningEnd = result.endTime;
        videoTrackId = result.videoTrackId;
        audioTrackId = result.audioTrackId;
      }

      toast.success(`Added ${scenesToAdd.length} scene(s) to timeline`);
      clearSelection();
    } catch (err) {
      console.error('Failed to add scenes to timeline:', err);
      toast.error('Failed to add scenes to timeline');
    } finally {
      setIsAddingToTimeline(false);
    }
  };

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

  if (sortedScenes.length === 0) {
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
      {/* Selection Action Bar */}
      <div className="flex items-center justify-between gap-2 p-2 bg-secondary/20 rounded-md">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => {
              if (checked) {
                selectAll();
              } else {
                clearSelection();
              }
            }}
          />
          <span className="text-xs text-muted-foreground">
            {allSelected ? 'Deselect All' : 'Select All'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedSceneIds.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedSceneIds.size} selected
            </span>
          )}
          <Button
            size="sm"
            variant="default"
            disabled={selectedSceneIds.size === 0 || isGenerating}
            onClick={handleGenerateVoiceovers}
            className="h-7 text-xs"
          >
            {isGenerating ? (
              <IconLoader2 className="size-3 animate-spin mr-1" />
            ) : (
              <IconMicrophone className="size-3 mr-1" />
            )}
            Voiceover
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedSceneIds.size === 0 || isEnhancing}
            onClick={handleEnhanceImages}
            className="h-7 text-xs"
          >
            {isEnhancing ? (
              <IconLoader2 className="size-3 animate-spin mr-1" />
            ) : (
              <IconSparkles className="size-3 mr-1" />
            )}
            Enhance
          </Button>
          <Select
            value={videoResolution}
            onValueChange={(value: '480p' | '720p' | '1080p') =>
              setVideoResolution(value)
            }
          >
            <SelectTrigger className="h-7 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="480p">480p</SelectItem>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedSceneIds.size === 0 || isGeneratingVideo}
            onClick={handleGenerateVideo}
            className="h-7 text-xs"
          >
            {isGeneratingVideo ? (
              <IconLoader2 className="size-3 animate-spin mr-1" />
            ) : (
              <IconVideo className="size-3 mr-1" />
            )}
            Video
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              selectedScenesWithVideo.length === 0 || isAddingToTimeline
            }
            onClick={handleAddAllToTimeline}
            className="h-7 text-xs"
            title={
              selectedScenesWithVideo.length === 0
                ? 'Select scenes with generated videos'
                : `Add ${selectedScenesWithVideo.length} scene(s) to timeline`
            }
          >
            {isAddingToTimeline ? (
              <IconLoader2 className="size-3 animate-spin mr-1" />
            ) : (
              <IconPlayerTrackNext className="size-3 mr-1" />
            )}
            Timeline
          </Button>
        </div>
      </div>

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
        {sortedScenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            compact
            isSelected={selectedSceneIds.has(scene.id)}
            onSelectionChange={(selected) => toggleScene(scene.id, selected)}
            playingVoiceoverId={playingVoiceoverId}
            setPlayingVoiceoverId={setPlayingVoiceoverId}
          />
        ))}
      </div>
    </div>
  );
}
