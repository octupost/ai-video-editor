'use client';

import { TabBar } from './tabbar.js';
import { useMediaPanelStore, type Tab } from './store.js';
import { Separator } from '@/components/ui/separator';
import { PanelUploads } from './panel/uploads-panel.js';
import { PanelVisuals } from './panel/visuals.js';
import PanelEffect from './panel/effects.js';
import PanelTransition from './panel/transition.js';
import PanelText from './panel/text.js';
import PanelCaptions from './panel/captions.js';
import PanelMusic from './panel/music.js';
import PanelVoiceovers from './panel/voiceovers.js';
import PanelSFX from './panel/sfx.js';
import PanelElements from './panel/elements.js';
import { PropertiesPanel } from '../properties-panel.js';
import { IClip } from '@designcombo/video';
import { useEffect, useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { useAssetStore } from '@/stores/asset-store';
import { useProjectId } from '@/contexts/project-context';

const viewMap: Record<Tab, React.ReactNode> = {
  uploads: <PanelUploads />,
  visuals: <PanelVisuals />,
  music: <PanelMusic />,
  voiceovers: <PanelVoiceovers />,
  sfx: <PanelSFX />,
  text: <PanelText />,
  captions: <PanelCaptions />,
  transitions: <PanelTransition />,
  effects: <PanelEffect />,
  elements: <PanelElements />,
};

export function MediaPanel() {
  const { activeTab } = useMediaPanelStore();
  const [selectedClips, setSelectedClips] = useState<IClip[]>([]);
  const { studio, setSelectedClips: setStudioSelectedClips } = useStudioStore();
  const { fetchAssets } = useAssetStore();
  const projectId = useProjectId();

  // Fetch all assets from Supabase on mount
  useEffect(() => {
    if (projectId) {
      fetchAssets(projectId);
    }
  }, [fetchAssets, projectId]);

  useEffect(() => {
    if (!studio) return;

    const handleSelection = (data: any) => {
      setSelectedClips(data.selected);
      setStudioSelectedClips(data.selected);
    };

    const handleClear = () => {
      setSelectedClips([]);
    };

    studio.on('selection:created', handleSelection);
    studio.on('selection:updated', handleSelection);
    studio.on('selection:cleared', handleClear);

    return () => {
      studio.off('selection:created', handleSelection);
      studio.off('selection:updated', handleSelection);
      studio.off('selection:cleared', handleClear);
    };
  }, [studio]);

  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="flex-none">
        <TabBar />
      </div>
      <Separator orientation="horizontal" />
      <div className="flex-1 overflow-hidden" id="panel-content">
        {selectedClips.length > 0 ? (
          <PropertiesPanel selectedClips={selectedClips} />
        ) : (
          <div className="h-full overflow-y-auto">{viewMap[activeTab]}</div>
        )}
      </div>
    </div>
  );
}
