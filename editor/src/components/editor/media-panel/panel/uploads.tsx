/**
 * @deprecated This component is deprecated as of January 2026.
 *
 * REASON: Asset types have been unified into a single Asset interface.
 * The VisualAsset type and local state management in this file have been
 * replaced by the unified asset-store.ts which uses the Asset type from
 * src/types/media.ts.
 *
 * NEW COMPONENT: Use uploads-panel.tsx instead, which uses the unified
 * useAssetStore hook for consistent asset management across the application.
 *
 * This file is kept for reference purposes only. Do not use in new code.
 *
 * Key differences in the new implementation:
 * - Uses Asset type instead of VisualAsset
 * - Uses useAssetStore instead of local useState
 * - Asset.name field is used for display (was also .name here)
 * - No need to filter by type='upload' separately, store handles it
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStudioStore } from '@/stores/studio-store';
import { Log } from 'openvideo';
import { Upload, Search } from 'lucide-react';
import { uploadFile } from '@/lib/upload-utils';
import { useProjectId } from '@/contexts/project-context';
import { addMediaToCanvas } from '@/lib/editor-utils';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

/** @deprecated Use Asset from '@/types/media' instead */
interface VisualAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  preview?: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
}

// Asset card component
function AssetCard({
  asset,
  onAdd,
  onDelete: _onDelete,
}: {
  asset: VisualAsset;
  onAdd: (asset: VisualAsset) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 group cursor-pointer"
      onClick={() => onAdd(asset)}
    >
      {asset.type === 'image' ? (
        <img
          src={asset.url}
          alt={asset.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black/20">
          <video
            src={asset.url}
            className="w-full h-full object-cover pointer-events-none"
          />
        </div>
      )}
    </div>
  );
}

/** @deprecated Use PanelUploads from './uploads-panel' instead */
export default function PanelUploads() {
  const { studio } = useStudioStore();
  const projectId = useProjectId();
  const [searchQuery, setSearchQuery] = useState('');
  const [uploads, setUploads] = useState<VisualAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load uploads from Supabase on mount
  useEffect(() => {
    if (!projectId) return;

    const fetchUploads = async () => {
      try {
        const response = await fetch(
          `/api/assets?type=upload&project_id=${projectId}`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch uploads');
        }
        const { assets } = await response.json();

        // Transform Supabase assets to VisualAsset format
        const visualAssets: VisualAsset[] = assets.map(
          (asset: {
            id: string;
            url: string;
            name: string;
            size?: number;
          }) => ({
            id: asset.id,
            type: asset.name.match(/\.(mp4|webm|mov|avi)$/i)
              ? 'video'
              : 'image',
            url: asset.url,
            name: asset.name,
            size: asset.size,
          })
        );

        setUploads(visualAssets);
      } catch (error) {
        console.error('Failed to fetch uploads:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchUploads();
  }, [projectId]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const type: 'image' | 'video' = file.type.startsWith('video/')
          ? 'video'
          : 'image';

        // Upload to R2
        const result = await uploadFile(file);

        // Save to Supabase
        const saveResponse = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'upload',
            url: result.url,
            name: result.fileName,
            size: file.size,
            project_id: projectId,
          }),
        });

        if (!saveResponse.ok) {
          throw new Error('Failed to save upload to database');
        }

        const { asset } = await saveResponse.json();

        const newAsset: VisualAsset = {
          id: asset.id,
          type,
          url: result.url,
          name: result.fileName,
          size: file.size,
        };

        setUploads((prev) => [newAsset, ...prev]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddToCanvas = async (asset: VisualAsset) => {
    if (!studio) return;

    try {
      await addMediaToCanvas(studio, { url: asset.url, type: asset.type });
    } catch (error) {
      Log.error(`Failed to add ${asset.type}:`, error);
    }
  };

  // Delete from Supabase
  const removeUpload = async (id: string) => {
    try {
      const response = await fetch(`/api/assets?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      setUploads((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete upload:', error);
    }
  };

  const filteredAssets = uploads.filter((asset) => {
    const matchesSearch = asset.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        multiple
        onChange={handleFileUpload}
      />
      {/* Search input */}
      {uploads.length > 0 ? (
        <div>
          <div className="flex-1 p-4 flex gap-2">
            <InputGroup>
              <InputGroupAddon className="bg-secondary/30 pointer-events-none text-muted-foreground w-8 justify-center">
                <Search size={14} />
              </InputGroupAddon>

              <InputGroupInput
                placeholder="Search uploads..."
                className="bg-secondary/30 border-0 h-full text-xs box-border pl-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant={'outline'}
            >
              <Upload size={14} />
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex-1 p-4 flex gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant={'outline'}
              className="w-full"
            >
              <Upload size={14} /> Upload
            </Button>
          </div>
        </div>
      )}

      {/* Assets grid */}
      <ScrollArea className="flex-1 px-4">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <Upload size={32} className="opacity-50" />
            <span className="text-sm">
              {uploads.length === 0 ? 'No uploads yet' : 'No matches found'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-x-3 gap-y-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onAdd={handleAddToCanvas}
                  onDelete={removeUpload}
                />
              ))}
            </div>
        )}
      </ScrollArea>
      <div className="h-2 bg-background"></div>
    </div>
  );
}
