'use client';

import { useStudioStore } from '@/stores/studio-store';
import { Log } from '@designcombo/video';
import { useAssetStore } from '@/stores/asset-store';
import { useDeleteConfirmation } from '@/contexts/delete-confirmation-context';
import { IconMusic } from '@tabler/icons-react';
import { AudioItem } from './audio-item.js';
import { useState } from 'react';
import { MusicChatPanel } from '../music-chat-panel.js';
import { addMediaToCanvas } from '@/lib/editor-utils';

export default function PanelMusic() {
  const { studio } = useStudioStore();
  const { music, deleteAsset } = useAssetStore();
  const { confirm } = useDeleteConfirmation();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handleAddToCanvas = async (url: string) => {
    if (!studio) return;

    try {
      await addMediaToCanvas(studio, { url, type: 'audio' });
    } catch (error) {
      Log.error('Failed to add audio:', error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete Music',
      description: 'Are you sure you want to delete this music track? This action cannot be undone.',
    });

    if (confirmed) {
      try {
        await deleteAsset(id, 'music');
      } catch (error) {
        console.error('Failed to delete music:', error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto">
        {music.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] gap-4">
            <IconMusic className="size-7 text-muted-foreground" stroke={1.5} />
            <div className="text-center text-muted-foreground text-sm">
              No music generated yet. Use the chat panel to generate some!
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {music.map((item) => (
              <AudioItem
                key={item.id}
                item={item}
                onAdd={handleAddToCanvas}
                onDelete={() => handleDelete(item.id)}
                playingId={playingId}
                setPlayingId={setPlayingId}
              />
            ))}
          </div>
        )}
      </div>
      <div className="h-2 bg-background"></div>
      <div className="h-48">
        <MusicChatPanel />
      </div>
    </div>
  );
}
