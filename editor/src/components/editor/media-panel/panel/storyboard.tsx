'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  IconLoader2,
  IconLayoutGrid,
  IconChevronDown,
  IconCheck,
  IconPlus,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectId } from '@/contexts/project-context';
import { createClient } from '@/lib/supabase/client';
import {
  getStoryboardsForProject,
  type Storyboard,
} from '@/lib/supabase/workflow-service';
import { StoryboardCards } from './storyboard-cards';

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', width: 1920, height: 1080 },
  { value: '9:16', label: '9:16', width: 1080, height: 1920 },
  { value: '1:1', label: '1:1', width: 1080, height: 1080 },
] as const;

type AspectRatio = (typeof ASPECT_RATIOS)[number]['value'];

const STYLE_OPTIONS = [
  { value: 'anime-2d', label: 'Anime 2D' },
  { value: 'pixar-art-3d', label: 'Pixar Art 3D' },
  { value: 'hollywood', label: 'Hollywood' },
] as const;

const STYLE_PROMPTS: Record<string, string> = {
  'anime-2d':
    'Render in anime 2D art style with vibrant colors, clean linework, and expressive characters. Maintain the exact grid layout and number of images - only transform the visual style.',
  'pixar-art-3d':
    'Render in Pixar-style 3D animation with soft lighting, rounded forms, and rich textures. Maintain the exact grid layout and number of images - only transform the visual style.',
  hollywood:
    'Render in cinematic Hollywood style with realistic lighting, dramatic composition, and film-quality visuals. Maintain the exact grid layout and number of images - only transform the visual style.',
};

type StyleOption = (typeof STYLE_OPTIONS)[number]['value'];

interface StoryboardResponse {
  rows: number;
  cols: number;
  grid_image_prompt: string;
  voiceover_list: string[];
  visual_flow: string[];
}

type ViewMode = 'view' | 'create';

// Helper functions
const getStyleLabel = (value: string) =>
  STYLE_OPTIONS.find((s) => s.value === value)?.label || value;

const getValidSession = async () => {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();
  if (error || !session) {
    throw new Error('Please log in again to continue');
  }
  return { supabase, session };
};

const buildWorkflowBody = (
  storyboardData: StoryboardResponse,
  projectId: string | null,
  selectedRatio: (typeof ASPECT_RATIOS)[number],
  formVoiceover: string,
  formStyle: StyleOption,
  formAspectRatio: AspectRatio
) => ({
  project_id: projectId,
  grid_image_prompt: storyboardData.grid_image_prompt,
  rows: storyboardData.rows,
  cols: storyboardData.cols,
  voiceover_list: storyboardData.voiceover_list,
  visual_prompt_list: storyboardData.visual_flow,
  width: selectedRatio.width,
  height: selectedRatio.height,
  voiceover: formVoiceover,
  style: formStyle,
  style_prompt: STYLE_PROMPTS[formStyle],
  aspect_ratio: formAspectRatio,
});

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'An error occurred';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function PanelStoryboard() {
  const projectId = useProjectId();

  // Storyboard navigation state
  const [viewMode, setViewMode] = useState<ViewMode>('create');
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<
    string | null
  >(null);

  // Form state (for create mode)
  const [formVoiceover, setFormVoiceover] = useState('');
  const [formStyle, setFormStyle] = useState<StyleOption>('cinematic');
  const [formAspectRatio, setFormAspectRatio] = useState<AspectRatio>('16:9');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoryboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowStarted, setWorkflowStarted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Derived state
  const selectedStoryboard = storyboards.find(
    (sb) => sb.id === selectedStoryboardId
  );

  // Fetch storyboards on mount and when projectId changes
  useEffect(() => {
    if (!projectId) return;

    getStoryboardsForProject(projectId).then((data) => {
      setStoryboards(data);
      // Auto-select most recent storyboard if exists
      if (data.length > 0) {
        setSelectedStoryboardId(data[0].id);
        setViewMode('view');
      } else {
        setViewMode('create');
      }
    });
  }, [projectId]);

  const refreshStoryboardsAfterCreate = async () => {
    if (!projectId) return;
    const newStoryboards = await getStoryboardsForProject(projectId);
    setStoryboards(newStoryboards);
    if (newStoryboards.length > 0) {
      setSelectedStoryboardId(newStoryboards[0].id);
      setViewMode('view');
    }
  };

  const startWorkflow = async (storyboardData: StoryboardResponse) => {
    const selectedRatio = ASPECT_RATIOS.find(
      (r) => r.value === formAspectRatio
    );
    if (!selectedRatio) return;

    setWorkflowLoading(true);
    setWorkflowError(null);

    try {
      const { supabase, session } = await getValidSession();

      const body = buildWorkflowBody(
        storyboardData,
        projectId,
        selectedRatio,
        formVoiceover,
        formStyle,
        formAspectRatio
      );
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'start-workflow',
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body,
        }
      );

      console.log('Edge function result:', { data: fnData, error: fnError });
      if (fnError) {
        throw new Error(fnError.message || 'Failed to start workflow');
      }

      setWorkflowStarted(true);
      setRefreshTrigger((prev) => prev + 1);
      await refreshStoryboardsAfterCreate();
    } catch (err) {
      setWorkflowError(getErrorMessage(err));
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!formVoiceover.trim()) return;

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
        body: JSON.stringify({
          voiceoverText: formVoiceover,
          style: formStyle,
        }),
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
      {/* Storyboard Navigation Header */}
      <div className="flex-none border-b border-border/50 p-3">
        <div className="flex items-center gap-2">
          <Select
            value={selectedStoryboardId || ''}
            onValueChange={(value) => {
              setSelectedStoryboardId(value);
              setViewMode('view');
            }}
            disabled={storyboards.length === 0}
          >
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="No storyboards yet" />
            </SelectTrigger>
            <SelectContent>
              {storyboards.map((sb) => (
                <SelectItem key={sb.id} value={sb.id}>
                  {formatDate(sb.created_at)} - {getStyleLabel(sb.style)} (
                  {sb.aspect_ratio})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => {
              setSelectedStoryboardId(null);
              setViewMode('create');
              setFormVoiceover('');
              setFormStyle('cinematic');
              setFormAspectRatio('16:9');
              setResult(null);
              setError(null);
              setWorkflowStarted(false);
            }}
          >
            <IconPlus className="size-3" />
            New
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="flex-1 p-4">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {/* Workflow Status Messages */}
        {result && (
          <div className="flex flex-col gap-4 mb-4">
            {/* Raw JSON - collapsed by default */}
            <details className="p-3 bg-secondary/30 rounded-md">
              <summary className="text-xs text-muted-foreground cursor-pointer">
                Raw JSON
              </summary>
              <pre className="mt-2 text-xs overflow-x-auto p-2 bg-background/50 rounded whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>

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

        {/* Scene Cards - show when we have a selected storyboard or projectId */}
        {projectId && (viewMode === 'view' || storyboards.length > 0) && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Scenes</div>
            <StoryboardCards
              projectId={projectId}
              storyboardId={selectedStoryboardId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        )}

        {/* Empty State */}
        {!projectId && (
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
      <div className="flex-none border-t border-border/50">
        {viewMode === 'view' && selectedStoryboard ? (
          /* View Mode - Read-only display of saved storyboard settings */
          <div className="p-4 flex flex-col gap-3 bg-secondary/10">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-secondary rounded-md">
                {getStyleLabel(selectedStoryboard.style)}
              </span>
              <span className="text-xs px-2 py-1 bg-secondary rounded-md">
                {selectedStoryboard.aspect_ratio}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Voiceover Script
              </span>
              <div className="p-2 bg-background/50 rounded-md text-sm max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                {selectedStoryboard.voiceover || (
                  <span className="text-muted-foreground italic">
                    No voiceover
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Create Mode - Editable form */
          <div className="p-4 flex flex-col gap-3">
            {/* Voiceover Text Input */}
            <Textarea
              placeholder="Enter your voiceover script..."
              className="resize-none text-sm min-h-[80px] max-h-[200px] overflow-y-auto"
              value={formVoiceover}
              onChange={(e) => setFormVoiceover(e.target.value)}
            />

            {/* Controls Row: Dropdowns + Generate Button */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1">
                    {getStyleLabel(formStyle)}
                    <IconChevronDown className="size-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {STYLE_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setFormStyle(option.value)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1">
                    {formAspectRatio}
                    <IconChevronDown className="size-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ASPECT_RATIOS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setFormAspectRatio(option.value)}
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
                disabled={loading || !formVoiceover.trim()}
              >
                {loading ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  'Generate'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
