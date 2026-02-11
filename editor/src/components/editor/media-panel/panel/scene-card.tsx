'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  IconPhoto,
  IconMicrophone,
  IconEye,
  IconChevronDown,
  IconPlayerPlay,
  IconPlayerPause,
  IconLoader2,
  IconVideo,
  IconPencil,
} from '@tabler/icons-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { useStudioStore } from '@/stores/studio-store';
import {
  findCompatibleTrack,
  addSceneToTimeline,
} from '@/lib/scene-timeline-utils';
import type {
  Scene,
  FirstFrame,
  Voiceover,
} from '@/lib/supabase/workflow-service';

interface SceneCardProps {
  scene: Scene;
  onClick?: () => void;
  compact?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  playingVoiceoverId?: string | null;
  setPlayingVoiceoverId?: (id: string | null) => void;
  onRegenerate?: (
    sceneId: string,
    newVoiceoverText: string,
    newVisualPrompt: string
  ) => Promise<void>;
  onSaveVisualPrompt?: (sceneId: string, newPrompt: string) => Promise<void>;
  onSaveVoiceoverText?: (sceneId: string, newText: string) => Promise<void>;
  selectedLanguage?: 'en' | 'tr' | 'ar';
}

interface SceneThumbnailProps {
  imageUrl: string | null;
  sceneOrder: number;
  firstFrame: FirstFrame | null;
  onAddToCanvas?: () => void;
}

function SceneThumbnail({
  imageUrl,
  sceneOrder,
  firstFrame,
  onAddToCanvas,
}: SceneThumbnailProps) {
  const isEnhancing = firstFrame?.enhance_status === 'processing';
  const isGeneratingVideo = firstFrame?.video_status === 'processing';
  const hasVideo =
    firstFrame?.video_status === 'success' && firstFrame?.video_url;

  const handleClick = (e: React.MouseEvent) => {
    if (hasVideo && onAddToCanvas) {
      e.stopPropagation();
      onAddToCanvas();
    }
  };

  return (
    <div
      className={`relative aspect-square rounded overflow-hidden bg-background/50 ${hasVideo ? 'cursor-pointer hover:ring-2 hover:ring-primary/50' : ''}`}
      onClick={handleClick}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`Scene ${sceneOrder + 1}`}
          fill
          className="object-contain"
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <IconPhoto size={16} className="text-muted-foreground/50" />
        </div>
      )}
      {isEnhancing && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
          <IconLoader2 size={20} className="text-purple-400 animate-spin" />
          <span className="text-[10px] text-purple-300 font-medium">
            Enhancing...
          </span>
        </div>
      )}
      {isGeneratingVideo && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
          <IconLoader2 size={20} className="text-cyan-400 animate-spin" />
          <span className="text-[10px] text-cyan-300 font-medium">
            Generating Video...
          </span>
        </div>
      )}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-medium text-white">
        {sceneOrder + 1}
      </div>
      {firstFrame && (
        <div className="absolute top-1 right-1 flex items-center gap-1">
          {hasVideo && (
            <div className="px-1.5 py-0.5 bg-cyan-500/80 rounded text-[10px] font-medium text-white flex items-center gap-0.5">
              <IconVideo size={10} />
            </div>
          )}
          <StatusBadge status={firstFrame.status} size="sm" />
        </div>
      )}
    </div>
  );
}

interface VoiceoverPlayButtonProps {
  voiceover: Voiceover;
  isPlaying: boolean;
  onToggle: () => void;
}

export function VoiceoverPlayButton({
  voiceover,
  isPlaying,
  onToggle,
}: VoiceoverPlayButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && voiceover.audio_url) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [isPlaying, voiceover.audio_url]);

  const handleEnded = () => {
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
    >
      {isPlaying ? (
        <IconPlayerPause size={12} className="text-blue-400" />
      ) : (
        <IconPlayerPlay size={12} className="text-blue-400" />
      )}
      {voiceover.audio_url && (
        <audio
          ref={audioRef}
          src={voiceover.audio_url}
          onEnded={handleEnded}
          preload="none"
        />
      )}
    </button>
  );
}

interface ExpandedContentProps {
  voiceover: Voiceover | null;
  displayVoiceover: string | null | undefined;
  displayVisualPrompt: string | null | undefined;
  playingVoiceoverId?: string | null;
  setPlayingVoiceoverId?: (id: string | null) => void;
  sceneId: string;
  onSaveVisualPrompt?: (sceneId: string, newPrompt: string) => Promise<void>;
  onSaveVoiceoverText?: (sceneId: string, newText: string) => Promise<void>;
}

function ExpandedContent({
  voiceover,
  displayVoiceover,
  displayVisualPrompt,
  playingVoiceoverId,
  setPlayingVoiceoverId,
  sceneId,
  onSaveVisualPrompt,
  onSaveVoiceoverText,
}: ExpandedContentProps) {
  const isPlaying = voiceover ? playingVoiceoverId === voiceover.id : false;
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingVoiceover, setIsEditingVoiceover] = useState(false);
  const [editedVoiceover, setEditedVoiceover] = useState('');
  const [isSavingVoiceover, setIsSavingVoiceover] = useState(false);

  const handleSaveVoiceover = async () => {
    const trimmed = editedVoiceover.trim();
    setIsEditingVoiceover(false);

    if (trimmed === (displayVoiceover || '').trim()) return;
    if (!onSaveVoiceoverText) return;

    setIsSavingVoiceover(true);
    try {
      await onSaveVoiceoverText(sceneId, trimmed);
    } catch (err) {
      console.error('Failed to save voiceover:', err);
    } finally {
      setIsSavingVoiceover(false);
    }
  };

  const handleSavePrompt = async () => {
    const trimmed = editedPrompt.trim();
    setIsEditingPrompt(false);

    if (trimmed === (displayVisualPrompt || '').trim()) return;
    if (!onSaveVisualPrompt) return;

    setIsSaving(true);
    try {
      await onSaveVisualPrompt(sceneId, trimmed);
    } catch (err) {
      console.error('Failed to save visual prompt:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePlay = () => {
    if (!voiceover || !setPlayingVoiceoverId) return;
    setPlayingVoiceoverId(isPlaying ? null : voiceover.id);
  };

  const renderVoiceoverStatus = () => {
    if (!voiceover) return null;

    if (voiceover.status === 'processing') {
      return (
        <span className="flex items-center gap-1 text-[9px] text-blue-400">
          <IconLoader2 size={10} className="animate-spin" />
          Generating...
        </span>
      );
    }

    if (voiceover.status === 'success' && voiceover.audio_url) {
      return (
        <VoiceoverPlayButton
          voiceover={voiceover}
          isPlaying={isPlaying}
          onToggle={handleTogglePlay}
        />
      );
    }

    if (voiceover.status === 'pending' || voiceover.status === 'failed') {
      return <StatusBadge status={voiceover.status} size="sm" />;
    }

    return null;
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <IconMicrophone size={12} className="text-blue-400" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Voiceover
          </span>
          {renderVoiceoverStatus()}
          {isSavingVoiceover && (
            <IconLoader2 size={10} className="animate-spin text-blue-400" />
          )}
        </div>
        {isEditingVoiceover ? (
          <div className="pl-5" onClick={(e) => e.stopPropagation()}>
            <Textarea
              autoFocus
              value={editedVoiceover}
              onChange={(e) => setEditedVoiceover(e.target.value)}
              onBlur={handleSaveVoiceover}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditingVoiceover(false);
                }
              }}
              className="text-[11px] min-h-[40px] resize-none p-1.5 bg-background/50 border-blue-400/30 focus-visible:border-blue-400/50"
              placeholder="Voiceover text..."
            />
          </div>
        ) : (
          <p
            className={`text-[11px] text-foreground/80 leading-relaxed pl-5 ${onSaveVoiceoverText ? 'cursor-pointer hover:text-foreground hover:bg-secondary/30 rounded transition-colors' : ''}`}
            onClick={(e) => {
              if (!onSaveVoiceoverText) return;
              e.stopPropagation();
              setEditedVoiceover(displayVoiceover || '');
              setIsEditingVoiceover(true);
            }}
            title={onSaveVoiceoverText ? 'Click to edit' : undefined}
          >
            {displayVoiceover || (
              <span className="italic text-muted-foreground">No voiceover</span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <IconEye size={12} className="text-purple-400" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Visual
          </span>
          {isSaving && (
            <IconLoader2 size={10} className="animate-spin text-purple-400" />
          )}
        </div>
        {isEditingPrompt ? (
          <div className="pl-5" onClick={(e) => e.stopPropagation()}>
            <Textarea
              autoFocus
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              onBlur={handleSavePrompt}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsEditingPrompt(false);
                }
              }}
              className="text-[11px] min-h-[40px] resize-none p-1.5 bg-background/50 border-purple-400/30 focus-visible:border-purple-400/50"
              placeholder="Visual prompt..."
            />
          </div>
        ) : (
          <p
            className={`text-[11px] text-foreground/60 leading-relaxed pl-5 ${onSaveVisualPrompt ? 'cursor-pointer hover:text-foreground/80 hover:bg-secondary/30 rounded transition-colors' : ''}`}
            onClick={(e) => {
              if (!onSaveVisualPrompt) return;
              e.stopPropagation();
              setEditedPrompt(displayVisualPrompt || '');
              setIsEditingPrompt(true);
            }}
            title={onSaveVisualPrompt ? 'Click to edit' : undefined}
          >
            {displayVisualPrompt || (
              <span className="italic text-muted-foreground">
                No visual prompt
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex justify-center">
        <IconChevronDown
          size={12}
          className="text-muted-foreground rotate-180"
        />
      </div>
    </div>
  );
}

export function SceneCard({
  scene,
  isSelected,
  onSelectionChange,
  playingVoiceoverId,
  setPlayingVoiceoverId,
  onRegenerate,
  onSaveVisualPrompt,
  onSaveVoiceoverText,
  selectedLanguage = 'en',
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedVoiceover, setEditedVoiceover] = useState('');
  const [editedVisualPrompt, setEditedVisualPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { studio } = useStudioStore();
  const firstFrame = scene.first_frames?.[0] ?? null;
  const voiceover =
    scene.voiceovers?.find((v) => v.language === selectedLanguage) ?? null;
  const imageUrl =
    firstFrame?.final_url ??
    firstFrame?.url ??
    firstFrame?.out_padded_url ??
    null;
  const displayVoiceover = voiceover?.text;
  const displayVisualPrompt = firstFrame?.visual_prompt;

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedVoiceover(displayVoiceover ?? '');
    setEditedVisualPrompt(displayVisualPrompt ?? '');
    setIsEditing(true);
    setExpanded(true);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleRegenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(scene.id, editedVoiceover, editedVisualPrompt);
      setIsEditing(false);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAddToCanvas = async () => {
    if (!studio || !firstFrame?.video_url) return;
    try {
      // Calculate where the next clip should start (after all existing clips)
      const lastClipEnd = studio.clips.reduce((max, c) => {
        const end =
          c.display.to > 0 ? c.display.to : c.display.from + c.duration;
        return end > max ? end : max;
      }, 0);

      // Estimate clip duration for overlap check (will be refined by addSceneToTimeline)
      const estimatedEnd = lastClipEnd + 10; // conservative estimate
      const existingVideoTrack = findCompatibleTrack(
        studio,
        'Video',
        lastClipEnd,
        estimatedEnd
      );
      const existingAudioTrack = findCompatibleTrack(
        studio,
        'Audio',
        lastClipEnd,
        estimatedEnd
      );

      await addSceneToTimeline(
        studio,
        {
          videoUrl: firstFrame.video_url,
          voiceover:
            voiceover?.status === 'success' && voiceover?.audio_url
              ? { audioUrl: voiceover.audio_url }
              : null,
        },
        {
          startTime: lastClipEnd,
          videoTrackId: existingVideoTrack?.id,
          audioTrackId: existingAudioTrack?.id,
        }
      );
    } catch (error) {
      console.error('Failed to add scene media to canvas:', error);
    }
  };

  const hasVideo =
    firstFrame?.video_status === 'success' && firstFrame?.video_url;

  const voiceoverPreview = displayVoiceover
    ? displayVoiceover.slice(0, 35) +
      (displayVoiceover.length > 35 ? '...' : '')
    : null;

  const showSelection = onSelectionChange !== undefined;
  const isPlaying = voiceover ? playingVoiceoverId === voiceover.id : false;

  const handleTogglePlay = () => {
    if (!voiceover || !setPlayingVoiceoverId) return;
    setPlayingVoiceoverId(isPlaying ? null : voiceover.id);
  };

  const renderCollapsedVoiceoverStatus = () => {
    if (!voiceover) return null;

    if (voiceover.status === 'processing') {
      return (
        <span className="flex items-center gap-1 text-[9px] text-blue-400 flex-shrink-0">
          <IconLoader2 size={10} className="animate-spin" />
          Generating...
        </span>
      );
    }

    if (voiceover.status === 'success' && voiceover.audio_url) {
      return (
        <VoiceoverPlayButton
          voiceover={voiceover}
          isPlaying={isPlaying}
          onToggle={handleTogglePlay}
        />
      );
    }

    return null;
  };

  return (
    <div
      className={`p-2 bg-secondary/30 rounded-md cursor-pointer hover:bg-secondary/50 transition-all ${
        isSelected
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
          : ''
      }`}
      onClick={() => !isEditing && setExpanded(!expanded)}
    >
      <div className="flex justify-between items-center mb-1">
        {showSelection && (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectionChange(checked === true)}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        )}
        {onRegenerate && !isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="ml-auto p-0.5 rounded hover:bg-secondary/80 transition-colors"
            title="Edit & Regenerate"
          >
            <IconPencil size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
      <SceneThumbnail
        imageUrl={imageUrl}
        sceneOrder={scene.order}
        firstFrame={firstFrame}
        onAddToCanvas={hasVideo ? handleAddToCanvas : undefined}
      />

      {isEditing ? (
        <div
          className="mt-2 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <IconMicrophone size={12} className="text-blue-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                Voiceover
              </span>
            </div>
            <Textarea
              value={editedVoiceover}
              onChange={(e) => setEditedVoiceover(e.target.value)}
              className="text-[11px] min-h-[60px] resize-none"
              placeholder="Voiceover text..."
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <IconEye size={12} className="text-purple-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
                Visual Prompt
              </span>
            </div>
            <Textarea
              value={editedVisualPrompt}
              onChange={(e) => setEditedVisualPrompt(e.target.value)}
              className="text-[11px] min-h-[60px] resize-none"
              placeholder="Visual prompt..."
            />
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={handleCancelEdit}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <IconLoader2 size={12} className="animate-spin mr-1" />
              ) : null}
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!expanded && (
            <div className="mt-2 flex items-center gap-1.5">
              <IconMicrophone
                size={10}
                className="text-blue-400 flex-shrink-0"
              />
              <p className="text-[10px] text-foreground/70 truncate flex-1">
                {voiceoverPreview || (
                  <span className="italic text-muted-foreground">
                    No voiceover
                  </span>
                )}
              </p>
              {renderCollapsedVoiceoverStatus()}
              <IconChevronDown
                size={12}
                className="text-muted-foreground flex-shrink-0"
              />
            </div>
          )}

          {expanded && (
            <ExpandedContent
              voiceover={voiceover}
              displayVoiceover={displayVoiceover}
              displayVisualPrompt={displayVisualPrompt}
              playingVoiceoverId={playingVoiceoverId}
              setPlayingVoiceoverId={setPlayingVoiceoverId}
              sceneId={scene.id}
              onSaveVisualPrompt={onSaveVisualPrompt}
              onSaveVoiceoverText={onSaveVoiceoverText}
            />
          )}
        </>
      )}

      <SceneErrors firstFrame={firstFrame} />
    </div>
  );
}

function SceneErrors({ firstFrame }: { firstFrame: FirstFrame | null }) {
  if (!firstFrame?.error_message && !firstFrame?.video_error_message) {
    return null;
  }
  return (
    <>
      {firstFrame.error_message && (
        <div className="mt-1.5 p-1 bg-destructive/10 rounded text-[9px] text-destructive line-clamp-1">
          {firstFrame.error_message}
        </div>
      )}
      {firstFrame.video_error_message && (
        <div className="mt-1.5 p-1 bg-destructive/10 rounded text-[9px] text-destructive line-clamp-1">
          Video: {firstFrame.video_error_message}
        </div>
      )}
    </>
  );
}
