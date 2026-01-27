'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconLoader2,
  IconLayoutGrid,
  IconChevronDown,
  IconCheck,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectId } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import { StoryboardCards } from './storyboard-cards';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', width: 1920, height: 1080 },
  { value: '9:16', label: '9:16', width: 1080, height: 1920 },
  { value: '1:1', label: '1:1', width: 1080, height: 1080 },
] as const;

type AspectRatio = (typeof ASPECT_RATIOS)[number]['value'];

const STYLE_OPTIONS = [
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'vlog', label: 'Vlog' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'horror', label: 'Horror' },
  { value: 'warm watercolor illustration', label: 'Watercolor' },
  { value: 'photorealistic', label: 'Photorealistic' },
] as const;

type StyleOption = (typeof STYLE_OPTIONS)[number]['value'];

interface StoryboardResponse {
  rows: number;
  cols: number;
  grid_image_prompt: string;
  voiceover_list: string[];
  visual_flow: string[];
}

export default function PanelStoryboard() {
  const projectId = useProjectId();
  const [voiceoverText, setVoiceoverText] = useState('');
  const [style, setStyle] = useState<StyleOption>('cinematic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoryboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const startWorkflow = async (storyboardData: StoryboardResponse) => {
    const selectedRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio);
    if (!selectedRatio) return;

    setWorkflowLoading(true);
    setWorkflowError(null);

    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke(
        'start-workflow',
        {
          body: {
            project_id: projectId,
            grid_image_prompt: storyboardData.grid_image_prompt,
            rows: storyboardData.rows,
            cols: storyboardData.cols,
            voiceover_list: storyboardData.voiceover_list,
            visual_prompt_list: storyboardData.visual_flow,
            width: selectedRatio.width,
            height: selectedRatio.height,
            // New storyboard fields
            voiceover: voiceoverText,
            style: style,
            aspect_ratio: aspectRatio,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Failed to start workflow');
      }

      setWorkflowStarted(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setWorkflowError(
        err instanceof Error ? err.message : 'An error occurred'
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!voiceoverText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setWorkflowStarted(false);
    setWorkflowError(null);

    try {
      // Step 1: Generate storyboard with AI
      const response = await fetch('/api/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceoverText, style }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate storyboard');
      }

      const data: StoryboardResponse = await response.json();
      setResult(data);
      setLoading(false);

      // Step 2: Automatically start workflow with the generated data
      await startWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Result Section */}
      <ScrollArea className="flex-1 p-4">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {/* Raw JSON - collapsed by default */}
            <details className="p-3 bg-secondary/30 rounded-md">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Raw JSON
              </summary>
              <pre className="mt-2 text-xs overflow-x-auto p-2 bg-background/50 rounded whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>

            {/* Workflow Status */}
            {workflowError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {workflowError}
              </div>
            )}

            {workflowLoading && (
              <div className="p-3 bg-secondary/30 rounded-md flex items-center gap-2">
                <IconLoader2 className="size-4 animate-spin" />
                <span className="text-sm">Starting workflow...</span>
              </div>
            )}

            {workflowStarted && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-center gap-2">
                <IconCheck className="size-4 text-green-500" />
                <span className="text-sm text-green-500">
                  Workflow started successfully
                </span>
              </div>
            )}
          </div>
        )}

        {/* Scene Cards - ALWAYS show when projectId exists */}
        {projectId && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Scenes</div>
            <StoryboardCards
              projectId={projectId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {!result && !error && !loading && !projectId && (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
            <IconLayoutGrid size={32} className="opacity-50" />
            <span className="text-sm text-center">
              Enter your voiceover script and select a style to generate a
              storyboard.
            </span>
          </div>
        )}
      </ScrollArea>

      {/* Input Section - Fixed at Bottom */}
      <div className="flex-none p-4 flex flex-col gap-3 border-t border-border/50">
        {/* Voiceover Text Input */}
        <Textarea
          placeholder="Enter your voiceover script..."
          className="resize-none text-sm min-h-[80px]"
          value={voiceoverText}
          onChange={(e) => setVoiceoverText(e.target.value)}
        />

        {/* Controls Row: Dropdowns + Generate Button */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1">
                {STYLE_OPTIONS.find((s) => s.value === style)?.label}
                <IconChevronDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STYLE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setStyle(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1">
                {aspectRatio}
                <IconChevronDown className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ASPECT_RATIOS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setAspectRatio(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="h-8 rounded-full text-sm flex-1"
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !voiceoverText.trim()}
          >
            {loading ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              'Generate'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
