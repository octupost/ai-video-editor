'use client';

import { useState } from 'react';
import { IconPhoto } from '@tabler/icons-react';
import { Film, Trash2 } from 'lucide-react';
import { useGeneratedStore, GeneratedAsset } from '@/stores/generated-store';
import { useStudioStore } from '@/stores/studio-store';
import { ImageClip, VideoClip, Log } from '@designcombo/video';
import { VisualsChatPanel } from '../visuals-chat-panel';

type FilterType = 'all' | 'images' | 'videos';

export function PanelVisuals() {
  const { studio } = useStudioStore();
  const { images, videos, deleteAsset } = useGeneratedStore();
  const [filter, setFilter] = useState<FilterType>('all');

  // Get filtered visuals based on selection
  const getFilteredVisuals = () => {
    if (filter === 'images') return [...images].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === 'videos') return [...videos].sort((a, b) => b.createdAt - a.createdAt);
    return [...images, ...videos].sort((a, b) => b.createdAt - a.createdAt);
  };

  const visuals = getFilteredVisuals();

  const addItemToCanvas = async (asset: GeneratedAsset) => {
    if (!studio) return;

    try {
      if (asset.type === 'image') {
        const imageClip = await ImageClip.fromUrl(
          asset.url + '?v=' + Date.now()
        );
        imageClip.display = { from: 0, to: 5 * 1e6 };
        imageClip.duration = 5 * 1e6;

        // Scale to fit and center in scene
        await imageClip.scaleToFit(1080, 1920);
        imageClip.centerInScene(1080, 1920);

        await studio.addClip(imageClip);
      } else {
        const videoClip = await VideoClip.fromUrl(asset.url);
        await studio.addClip(videoClip);
      }
    } catch (error) {
      Log.error(`Failed to add ${asset.type}:`, error);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Filter chips */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-border/50">
        {(['all', 'images', 'videos'] as FilterType[]).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {visuals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
            <IconPhoto className="size-7 text-muted-foreground" stroke={1.5} />
            <div className="flex flex-col gap-2 text-center">
              <p className="font-semibold text-white">No Visual Assets</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start building your collection by clicking the generate button
                in the chat panel.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
              {visuals.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative aspect-square rounded-md overflow-hidden bg-secondary/50 cursor-pointer border border-transparent hover:border-primary/50 transition-all"
                  onClick={() => addItemToCanvas(asset)}
                >
                  {asset.type === 'image' ? (
                    <img
                      src={asset.url}
                      alt={asset.text}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black/20">
                      <video
                        src={asset.url}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <Film
                        className="absolute text-white/70 drop-shadow-md"
                        size={24}
                      />
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAsset(asset.id, asset.type);
                    }}
                    className="absolute top-1 right-1 p-1 rounded bg-black/50 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>

                  {/* Overlay info */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate font-medium">
                      {asset.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="h-2 bg-background"></div>
      <div className="h-48">
        <VisualsChatPanel />
      </div>
    </div>
  );
}
