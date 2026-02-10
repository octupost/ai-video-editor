'use client';

import { useEffect, useState } from 'react';
import {
  IconChevronDown,
  IconChevronUp,
  IconFileText,
  IconLayoutGrid,
  IconLoader2,
  IconMicrophone,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconSparkles,
  IconVideo,
  IconVolume,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { SceneCard, VoiceoverPlayButton } from './scene-card';
import { StatusBadge } from './status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVoicePreview } from '@/hooks/use-voice-preview';
import { useWorkflow } from '@/hooks/use-workflow';
import { useStudioStore } from '@/stores/studio-store';
import { createClient } from '@/lib/supabase/client';
import {
  addSceneToTimeline,
  findCompatibleTrack,
} from '@/lib/scene-timeline-utils';
import type {
  GridImage,
  GridImageWithScenes,
  Scene,
  Storyboard,
} from '@/lib/supabase/workflow-service';
import { GridImageReview } from './grid-image-review';

const VOICES = [
  {
    value: 'pNInz6obpgDQGcFmaJgB',
    label: 'Adam',
    description: 'American, middle-aged male',
  },
  {
    value: 'Xb7hH8MSUJpSbSDYk0k2',
    label: 'Alice',
    description: 'British, middle-aged female',
  },
  {
    value: 'hpp4J3VqNfWAUOO0d1Us',
    label: 'Bella',
    description: 'American, middle-aged female',
  },
  {
    value: 'pqHfZKP75CvOlQylNhV4',
    label: 'Bill',
    description: 'American, older male',
  },
  {
    value: 'nPczCjzI2devNBz1zQrb',
    label: 'Brian',
    description: 'American, middle-aged male',
  },
  {
    value: 'N2lVS1w4EtoT3dr4eOWO',
    label: 'Callum',
    description: 'American, middle-aged male',
  },
  {
    value: 'IKne3meq5aSn9XLyUdCD',
    label: 'Charlie',
    description: 'Australian, young male',
  },
  {
    value: 'iP95p4xoKVk53GoZ742B',
    label: 'Chris',
    description: 'American, middle-aged male',
  },
  {
    value: 'onwK4e9ZLuTAKqWW03F9',
    label: 'Daniel',
    description: 'British, middle-aged male',
  },
  {
    value: 'cjVigY5qzO86Huf0OWal',
    label: 'Eric',
    description: 'American, middle-aged male',
  },
  {
    value: 'JBFqnCBsd6RMkjVDRZzb',
    label: 'George',
    description: 'British, middle-aged male',
  },
  {
    value: 'SOYHLrjzK2X1ezoPC6cr',
    label: 'Harry',
    description: 'American, young male',
  },
  {
    value: 'cgSgspJ2msm6clMCkdW9',
    label: 'Jessica',
    description: 'American, young female',
  },
  {
    value: 'FGY2WhTYpPnrIDTdsKH5',
    label: 'Laura',
    description: 'American, young female',
  },
  {
    value: 'TX3LPaxmHKxFdv7VOQHJ',
    label: 'Liam',
    description: 'American, young male',
  },
  {
    value: 'pFZP5JQG7iQjIQuC4Bku',
    label: 'Lily',
    description: 'British, middle-aged female',
  },
  {
    value: 'XrExE9yKIg1WjnnlVkGX',
    label: 'Matilda',
    description: 'American, middle-aged female',
  },
  {
    value: 'SAz9YHcvj6GT2YYXdXww',
    label: 'River',
    description: 'American, middle-aged neutral',
  },
  {
    value: 'CwhRBWXzGAHq8TQ4Fs17',
    label: 'Roger',
    description: 'American, middle-aged male',
  },
  {
    value: 'EXAVITQu4vr4xnSDxMaL',
    label: 'Sarah',
    description: 'American, young female',
  },
  {
    value: 'bIHbv24MWmeRgasZH58o',
    label: 'Will',
    description: 'American, young male',
  },
] as const;

const TTS_MODELS = {
  'turbo-v2.5': { label: 'Turbo v2.5', description: 'Fast' },
  'multilingual-v2': {
    label: 'Multilingual v2',
    description: 'Better languages',
  },
} as const;

type TTSModelKey = keyof typeof TTS_MODELS;

const ENHANCE_MODELS = {
  kling: { label: 'Kling' },
  banana: { label: 'Banana' },
  fibo: { label: 'Fibo' },
} as const;

const VIDEO_MODELS = {
  'wan2.6': { label: 'Wan 2.6', resolutions: ['720p', '1080p'] as const },
  'bytedance1.5pro': {
    label: 'ByteDance 1.5 Pro',
    resolutions: ['480p', '720p', '1080p'] as const,
  },
  grok: {
    label: 'Grok',
    resolutions: ['720p', '480p'] as const,
  },
} as const;

type VideoModelKey = keyof typeof VIDEO_MODELS;

function ScriptViewRow({
  scene,
  playingVoiceoverId,
  setPlayingVoiceoverId,
  onSave,
}: {
  scene: Scene;
  playingVoiceoverId: string | null;
  setPlayingVoiceoverId: (id: string | null) => void;
  onSave: (sceneId: string, newText: string) => Promise<void>;
}) {
  const voiceover = scene.voiceovers?.[0] ?? null;
  const isPlaying = voiceover ? playingVoiceoverId === voiceover.id : false;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const handleStartEdit = () => {
    setEditText(voiceover?.text ?? '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed === (voiceover?.text ?? '').trim()) return;
    await onSave(scene.id, trimmed);
  };

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-secondary/30 transition-colors">
      <span className="text-[10px] font-medium text-muted-foreground w-5 flex-shrink-0 pt-0.5 text-right">
        {scene.order + 1}.
      </span>
      {isEditing ? (
        <Textarea
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="text-[11px] min-h-[40px] resize-none p-1.5 bg-background/50 border-blue-400/30 focus-visible:border-blue-400/50 flex-1"
          placeholder="Voiceover text..."
        />
      ) : (
        <p
          className="text-[11px] text-foreground/80 leading-relaxed flex-1 min-w-0 cursor-pointer hover:text-foreground hover:bg-secondary/30 rounded px-1 -mx-1 transition-colors"
          onClick={handleStartEdit}
          title="Click to edit"
        >
          {voiceover?.text || (
            <span className="italic text-muted-foreground">No voiceover</span>
          )}
        </p>
      )}
      <div className="flex-shrink-0 pt-0.5">
        {voiceover?.status === 'processing' && (
          <IconLoader2 size={10} className="animate-spin text-blue-400" />
        )}
        {voiceover?.status === 'success' && voiceover?.audio_url && (
          <VoiceoverPlayButton
            voiceover={voiceover}
            isPlaying={isPlaying}
            onToggle={() =>
              setPlayingVoiceoverId(isPlaying ? null : voiceover.id)
            }
          />
        )}
        {voiceover?.status === 'pending' && (
          <StatusBadge status="pending" size="sm" />
        )}
        {voiceover?.status === 'failed' && (
          <StatusBadge status="failed" size="sm" />
        )}
      </div>
    </div>
  );
}

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
  const { gridImage, storyboard, loading, error, isProcessing, refresh } =
    useWorkflow(projectId, {
      realtime: true,
      includeScenes: true,
      storyboardId,
    });

  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(
    new Set()
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceModel, setEnhanceModel] =
    useState<keyof typeof ENHANCE_MODELS>('kling');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoModel, setVideoModel] =
    useState<VideoModelKey>('bytedance1.5pro');
  const [videoResolution, setVideoResolution] = useState<
    '480p' | '720p' | '1080p'
  >('720p');
  const [isGeneratingSfx, setIsGeneratingSfx] = useState(false);
  const [isAddingToTimeline, setIsAddingToTimeline] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('pNInz6obpgDQGcFmaJgB');
  const [ttsModel, setTtsModel] = useState<TTSModelKey>('turbo-v2.5');
  const [playingVoiceoverId, setPlayingVoiceoverId] = useState<string | null>(
    null
  );
  const [isScriptViewOpen, setIsScriptViewOpen] = useState(false);
  const { studio } = useStudioStore();
  const {
    previewUrls,
    playingVoiceId: previewPlayingId,
    togglePreview,
    stopPreview,
  } = useVoicePreview();

  // Refresh data when refreshTrigger changes (new storyboard generated)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh();
    }
  }, [refreshTrigger, refresh]);

  // Auto-correct resolution when model changes
  useEffect(() => {
    const allowed = VIDEO_MODELS[videoModel].resolutions as readonly string[];
    if (!allowed.includes(videoResolution)) {
      setVideoResolution(allowed[0] as '480p' | '720p' | '1080p');
    }
  }, [videoModel, videoResolution]);

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
        body: {
          scene_ids: Array.from(selectedSceneIds),
          voice: selectedVoice,
          model: ttsModel,
        },
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
        body: { scene_ids: Array.from(selectedSceneIds), model: enhanceModel },
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
            model: videoModel,
            aspect_ratio:
              storyboard && 'aspect_ratio' in storyboard
                ? storyboard.aspect_ratio
                : '16:9',
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

  const handleGenerateSfx = async () => {
    if (selectedSceneIds.size === 0) return;

    setIsGeneratingSfx(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('generate-sfx', {
        body: { scene_ids: Array.from(selectedSceneIds) },
      });

      if (error) throw error;

      toast.success(
        `SFX generation started for ${data.summary.queued} scene(s)`
      );
      clearSelection();
      refresh();
    } catch (err) {
      console.error('Failed to generate SFX:', err);
      toast.error('Failed to generate SFX');
    } finally {
      setIsGeneratingSfx(false);
    }
  };

  // Check if any selected scenes have videos ready (for SFX and timeline)
  const selectedScenesWithVideoForSfx = sortedScenes.filter(
    (s) =>
      selectedSceneIds.has(s.id) &&
      s.first_frames?.[0]?.video_status === 'success' &&
      s.first_frames?.[0]?.video_url
  );

  // Check if any selected scenes have videos ready
  const selectedScenesWithVideo = sortedScenes.filter(
    (s) =>
      selectedSceneIds.has(s.id) &&
      s.first_frames?.[0]?.video_status === 'success' &&
      s.first_frames?.[0]?.video_url
  );

  const handleSaveVoiceoverText = async (sceneId: string, newText: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('voiceovers')
      .update({ text: newText })
      .eq('scene_id', sceneId);

    if (error) {
      console.error('Failed to save voiceover text:', error);
      toast.error('Failed to save voiceover text');
      throw error;
    }
    refresh();
  };

  const handleSaveVisualPrompt = async (sceneId: string, newPrompt: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('first_frames')
      .update({ visual_prompt: newPrompt })
      .eq('scene_id', sceneId);

    if (error) {
      console.error('Failed to save visual prompt:', error);
      toast.error('Failed to save visual prompt');
      throw error;
    }
  };

  const handleRegenerateScene = async (
    sceneId: string,
    newVoiceoverText: string,
    newVisualPrompt: string
  ) => {
    const supabase = createClient();

    // Update voiceover text and reset status
    const { error: voiceoverError } = await supabase
      .from('voiceovers')
      .update({
        text: newVoiceoverText,
        status: 'pending',
        audio_url: null,
        duration: null,
      })
      .eq('scene_id', sceneId);

    if (voiceoverError) {
      toast.error('Failed to update voiceover text');
      throw voiceoverError;
    }

    // Update visual prompt and reset video status
    const { error: frameError } = await supabase
      .from('first_frames')
      .update({
        visual_prompt: newVisualPrompt,
        video_status: null,
        video_url: null,
        video_request_id: null,
        video_error_message: null,
      })
      .eq('scene_id', sceneId);

    if (frameError) {
      toast.error('Failed to update visual prompt');
      throw frameError;
    }

    // Trigger TTS regeneration
    const { error: ttsError } = await supabase.functions.invoke(
      'generate-tts',
      {
        body: {
          scene_ids: [sceneId],
          voice: selectedVoice,
          model: ttsModel,
        },
      }
    );

    if (ttsError) {
      console.error('TTS generation failed:', ttsError);
      toast.error('Failed to start voiceover generation');
    }

    // Trigger video regeneration only if the scene has an enhanced image
    const scene = sortedScenes.find((s) => s.id === sceneId);
    const finalUrl = scene?.first_frames?.[0]?.final_url;
    if (finalUrl) {
      const { error: videoError } = await supabase.functions.invoke(
        'generate-video',
        {
          body: {
            scene_ids: [sceneId],
            resolution: videoResolution,
            model: videoModel,
            aspect_ratio:
              storyboard && 'aspect_ratio' in storyboard
                ? storyboard.aspect_ratio
                : '16:9',
          },
        }
      );

      if (videoError) {
        console.error('Video generation failed:', videoError);
        toast.error('Failed to start video generation');
      }
    } else {
      toast.info(
        'Video generation skipped — enhance the image first to generate video.'
      );
    }

    toast.success('Scene regeneration started');
    refresh();
  };

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

  // Grid image review: show when grid is generated but not yet split into scenes
  if (
    gridImage?.status === 'generated' &&
    sortedScenes.length === 0 &&
    storyboard &&
    'plan' in storyboard &&
    storyboard.plan
  ) {
    return (
      <GridImageReview
        gridImage={gridImage as GridImage}
        storyboard={storyboard as Storyboard}
        onApproveComplete={() => refresh()}
        onRegenerateComplete={() => refresh()}
      />
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
      <div className="flex flex-col gap-1.5">
        {/* Row 1: Selection */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-secondary/20 rounded-md">
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
          {selectedSceneIds.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedSceneIds.size} selected
            </span>
          )}
        </div>

        {/* Row 2: Actions (scrollable) */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 bg-secondary/20 rounded-md overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Audio group */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Select
              value={selectedVoice}
              onValueChange={(value) => {
                stopPreview();
                setSelectedVoice(value);
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    <span>{v.label}</span>
                    <span className="ml-1 text-muted-foreground">
                      {v.description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ttsModel}
              onValueChange={(v) => setTtsModel(v as TTSModelKey)}
            >
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TTS_MODELS) as TTSModelKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span>{TTS_MODELS[key].label}</span>
                    <span className="ml-1 text-muted-foreground">
                      {TTS_MODELS[key].description}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  disabled={!previewUrls.has(selectedVoice)}
                  onClick={() => togglePreview(selectedVoice)}
                >
                  {previewPlayingId === selectedVoice ? (
                    <IconPlayerPause className="size-3.5" />
                  ) : (
                    <IconPlayerPlay className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {previewPlayingId === selectedVoice
                  ? 'Stop preview'
                  : 'Preview voice'}
              </TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              variant="default"
              disabled={selectedSceneIds.size === 0 || isGenerating}
              onClick={handleGenerateVoiceovers}
              className="h-8 text-xs"
            >
              {isGenerating ? (
                <IconLoader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <IconMicrophone className="size-3.5 mr-1" />
              )}
              Voiceover
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={
                selectedScenesWithVideoForSfx.length === 0 || isGeneratingSfx
              }
              onClick={handleGenerateSfx}
              className="h-8 text-xs"
              title={
                selectedScenesWithVideoForSfx.length === 0
                  ? 'Select scenes with generated videos'
                  : `Add SFX to ${selectedScenesWithVideoForSfx.length} scene(s)`
              }
            >
              {isGeneratingSfx ? (
                <IconLoader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <IconVolume className="size-3.5 mr-1" />
              )}
              SFX
            </Button>
          </div>

          {/* Divider */}
          <div className="h-5 border-l border-border/40 flex-shrink-0" />

          {/* Visual group */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Select
              value={enhanceModel}
              onValueChange={(v) =>
                setEnhanceModel(v as keyof typeof ENHANCE_MODELS)
              }
            >
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(ENHANCE_MODELS) as (keyof typeof ENHANCE_MODELS)[]
                ).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ENHANCE_MODELS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedSceneIds.size === 0 || isEnhancing}
              onClick={handleEnhanceImages}
              className="h-8 text-xs"
            >
              {isEnhancing ? (
                <IconLoader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <IconSparkles className="size-3.5 mr-1" />
              )}
              Enhance
            </Button>
          </div>

          {/* Divider */}
          <div className="h-5 border-l border-border/40 flex-shrink-0" />

          {/* Output group */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Select
              value={videoModel}
              onValueChange={(value: string) =>
                setVideoModel(value as VideoModelKey)
              }
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VIDEO_MODELS) as VideoModelKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {VIDEO_MODELS[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={videoResolution}
              onValueChange={(value: '480p' | '720p' | '1080p') =>
                setVideoResolution(value)
              }
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_MODELS[videoModel].resolutions.map((res) => (
                  <SelectItem key={res} value={res}>
                    {res}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedSceneIds.size === 0 || isGeneratingVideo}
              onClick={handleGenerateVideo}
              className="h-8 text-xs"
            >
              {isGeneratingVideo ? (
                <IconLoader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <IconVideo className="size-3.5 mr-1" />
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
              className="h-8 text-xs"
              title={
                selectedScenesWithVideo.length === 0
                  ? 'Select scenes with generated videos'
                  : `Add ${selectedScenesWithVideo.length} scene(s) to timeline`
              }
            >
              {isAddingToTimeline ? (
                <IconLoader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <IconPlayerTrackNext className="size-3.5 mr-1" />
              )}
              Timeline
            </Button>
          </div>
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

      {/* Script View - Collapsible voiceover list */}
      <Collapsible open={isScriptViewOpen} onOpenChange={setIsScriptViewOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <IconFileText className="size-3.5" />
              Script View
              <span className="text-[10px] text-muted-foreground/60">
                ({sortedScenes.length} scenes)
              </span>
            </span>
            {isScriptViewOpen ? (
              <IconChevronUp className="size-3" />
            ) : (
              <IconChevronDown className="size-3" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 py-2 px-1 bg-secondary/10 rounded-md max-h-[400px] overflow-y-auto">
            {sortedScenes.map((scene) => (
              <ScriptViewRow
                key={scene.id}
                scene={scene}
                playingVoiceoverId={playingVoiceoverId}
                setPlayingVoiceoverId={setPlayingVoiceoverId}
                onSave={handleSaveVoiceoverText}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

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
            onRegenerate={handleRegenerateScene}
            onSaveVisualPrompt={handleSaveVisualPrompt}
            onSaveVoiceoverText={handleSaveVoiceoverText}
          />
        ))}
      </div>
    </div>
  );
}
