'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  IconPhoto,
  IconMicrophone,
  IconEye,
  IconChevronDown,
} from '@tabler/icons-react';
import { StatusBadge } from './status-badge';
import type {
  Scene,
  FirstFrame,
  Voiceover,
} from '@/lib/supabase/workflow-service';

interface SceneCardProps {
  scene: Scene;
  onClick?: () => void;
  compact?: boolean;
}

interface SceneThumbnailProps {
  imageUrl: string | null;
  sceneOrder: number;
  firstFrame: FirstFrame | null;
}

function SceneThumbnail({
  imageUrl,
  sceneOrder,
  firstFrame,
}: SceneThumbnailProps) {
  return (
    <div className="relative aspect-video rounded overflow-hidden bg-background/50">
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
      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-medium text-white">
        {sceneOrder + 1}
      </div>
      {firstFrame && (
        <div className="absolute top-1 right-1">
          <StatusBadge status={firstFrame.status} size="sm" />
        </div>
      )}
    </div>
  );
}

interface ExpandedContentProps {
  voiceover: Voiceover | null;
  displayVoiceover: string | null | undefined;
  displayVisualPrompt: string | null | undefined;
}

function ExpandedContent({
  voiceover,
  displayVoiceover,
  displayVisualPrompt,
}: ExpandedContentProps) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <IconMicrophone size={12} className="text-blue-400" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
            Voiceover
          </span>
          {voiceover && <StatusBadge status={voiceover.status} size="sm" />}
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

export function SceneCard({ scene }: SceneCardProps) {
  const [expanded, setExpanded] = useState(false);
  const firstFrame = scene.first_frames?.[0] ?? null;
  const voiceover = scene.voiceovers?.[0] ?? null;
  const imageUrl = firstFrame?.url ?? firstFrame?.out_padded_url ?? null;
  const displayVoiceover = voiceover?.text;
  const displayVisualPrompt = firstFrame?.visual_prompt;

  const voiceoverPreview = displayVoiceover
    ? displayVoiceover.slice(0, 35) +
      (displayVoiceover.length > 35 ? '...' : '')
    : null;

  return (
    <div
      className="p-2 bg-secondary/30 rounded-md cursor-pointer hover:bg-secondary/50 transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      <SceneThumbnail
        imageUrl={imageUrl}
        sceneOrder={scene.order}
        firstFrame={firstFrame}
      />

      {!expanded && (
        <div className="mt-2 flex items-center gap-1.5">
          <IconMicrophone size={10} className="text-blue-400 flex-shrink-0" />
          <p className="text-[10px] text-foreground/70 truncate flex-1">
            {voiceoverPreview || (
              <span className="italic text-muted-foreground">No voiceover</span>
            )}
          </p>
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
        />
      )}

      {firstFrame?.error_message && (
        <div className="mt-1.5 p-1 bg-destructive/10 rounded text-[9px] text-destructive line-clamp-1">
          {firstFrame.error_message}
        </div>
      )}
    </div>
  );
}
