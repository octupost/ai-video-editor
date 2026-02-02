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
} from '@tabler/icons-react';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from './status-badge';
import { useStudioStore } from '@/stores/studio-store';
import { addMediaToCanvas } from '@/lib/editor-utils';
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
          className="object-cover"
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

function VoiceoverPlayButton({
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
}

function ExpandedContent({
  voiceover,
  displayVoiceover,
  displayVisualPrompt,
  playingVoiceoverId,
  setPlayingVoiceoverId,
}: ExpandedContentProps) {
  const isPlaying = voiceover ? playingVoiceoverId === voiceover.id : false;

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
        </div>
        <p className="text-[11px] text-foreground/80 leading-relaxed pl-5">
          {displayVoiceover || (
            <span className="italic text-muted-foreground">No voiceover</span>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <IconEye size={12} className="text-purple-400" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Visual
          </span>
        </div>
        <p className="text-[11px] text-foreground/60 leading-relaxed pl-5">
          {displayVisualPrompt || (
            <span className="italic text-muted-foreground">
              No visual prompt
            </span>
          )}
        </p>
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
}: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { studio } = useStudioStore();
  const firstFrame = scene.first_frames?.[0] ?? null;
  const voiceover = scene.voiceovers?.[0] ?? null;
  const imageUrl =
    firstFrame?.final_url ??
    firstFrame?.url ??
    firstFrame?.out_padded_url ??
    null;
  const displayVoiceover = voiceover?.text;
  const displayVisualPrompt = firstFrame?.visual_prompt;

  const handleAddToCanvas = async () => {
    if (!studio || !firstFrame?.video_url) return;
    try {
      await addMediaToCanvas(studio, {
        url: firstFrame.video_url,
        type: 'video',
      });
    } catch (error) {
      console.error('Failed to add scene video to canvas:', error);
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
      onClick={() => setExpanded(!expanded)}
    >
      {showSelection && (
        <div
          className="flex justify-end mb-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectionChange(checked === true)}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      )}
      <SceneThumbnail
        imageUrl={imageUrl}
        sceneOrder={scene.order}
        firstFrame={firstFrame}
        onAddToCanvas={hasVideo ? handleAddToCanvas : undefined}
      />

      {!expanded && (
        <div className="mt-2 flex items-center gap-1.5">
          <IconMicrophone size={10} className="text-blue-400 flex-shrink-0" />
          <p className="text-[10px] text-foreground/70 truncate flex-1">
            {voiceoverPreview || (
              <span className="italic text-muted-foreground">No voiceover</span>
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
        />
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
