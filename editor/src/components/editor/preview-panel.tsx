import { useEffect, useRef, useState } from 'react';
import { Player } from './player.js';
import {
  Studio,
  Compositor,
  type IClip,
  fontManager,
} from '@designcombo/video';
import { useStudioStore } from '@/stores/studio-store';
import { editorFont } from './constants.js';
import { loadTimeline, reconstructProjectJSON } from '@/lib/supabase/timeline-service';
import { useProjectId } from '@/contexts/project-context';
const defaultSize = {
  width: 1080,
  height: 1920,
};
interface PreviewPanelProps {
  onReady?: () => void;
}

export function PreviewPanel({ onReady }: PreviewPanelProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<Studio | null>(null);
  const { setStudio, setSelectedClips } = useStudioStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [maxDuration, setMaxDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clips, setClips] = useState<IClip[]>([]);
  const projectId = useProjectId();

  // Initialize Studio
  useEffect(() => {
    if (!previewCanvasRef.current) return;

    // Check support
    (async () => {
      if (!(await Compositor.isSupported())) {
        alert('Your browser does not support WebCodecs');
      }
    })();

    // Create studio instance with initial dimensions
    previewRef.current = new Studio({
      width: defaultSize.width,
      height: defaultSize.height,
      fps: 30,
      bgColor: '#18181b',
      canvas: previewCanvasRef.current,
      interactivity: true,
    });

    const init = async () => {
      await Promise.all([
        fontManager.loadFonts([
          {
            name: editorFont.fontFamily,
            url: editorFont.fontUrl,
          },
        ]),
        previewRef.current?.ready,
      ]);

      // Try to load from Supabase first
      const savedData = await loadTimeline(projectId);
      if (savedData && savedData.length > 0) {
        console.log('Loading from Supabase...');
        const projectJson = reconstructProjectJSON(savedData);

        // DEBUG: Log the reconstructed JSON to verify structure
        console.log('Reconstructed JSON from Supabase:', JSON.stringify(projectJson, null, 2));

        await previewRef.current?.loadFromJSON(projectJson as any);
      } else {
        // Fallback to default JSON
        console.log('No saved data, loading default...');
        const initalData = await import('./timeline/timeline/updated.json');
        await previewRef.current?.loadFromJSON(initalData as any);
      }

      console.log('Studio ready');
      onReady?.();
    };

    init();

    // Set store
    setStudio(previewRef.current);

    // Event listeners
    const onTimeUpdate = (data: { currentTime: number }) => {
      setCurrentTime(data.currentTime);
    };

    const onPlay = (data: { isPlaying: boolean }) => {
      setIsPlaying(data.isPlaying);
    };

    const onPause = (data: { isPlaying: boolean }) => {
      setIsPlaying(data.isPlaying);
    };

    previewRef.current.on('currentTime', onTimeUpdate);
    previewRef.current.on('play', onPlay);
    previewRef.current.on('pause', onPause);

    return () => {
      if (previewRef.current) {
        previewRef.current.off('currentTime', onTimeUpdate);
        previewRef.current.off('play', onPlay);
        previewRef.current.off('pause', onPause);
        previewRef.current.destroy();
        previewRef.current = null;
        setStudio(null);
      }
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col min-h-0 min-w-0 bg-panel rounded-sm relative">
      <Player canvasRef={previewCanvasRef} />
    </div>
  );
}