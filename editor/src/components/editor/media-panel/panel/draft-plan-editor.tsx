'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  IconChevronDown,
  IconChevronUp,
  IconLoader2,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import type { StoryboardPlan } from '@/lib/supabase/workflow-service';

const GRID_OPTIONS = [
  { value: '2x2', rows: 2, cols: 2, scenes: 4 },
  { value: '3x2', rows: 3, cols: 2, scenes: 6 },
  { value: '3x3', rows: 3, cols: 3, scenes: 9 },
  { value: '4x3', rows: 4, cols: 3, scenes: 12 },
  { value: '4x4', rows: 4, cols: 4, scenes: 16 },
  { value: '5x4', rows: 5, cols: 4, scenes: 20 },
  { value: '5x5', rows: 5, cols: 5, scenes: 25 },
  { value: '6x5', rows: 6, cols: 5, scenes: 30 },
  { value: '6x6', rows: 6, cols: 6, scenes: 36 },
] as const;

interface DraftPlanEditorProps {
  plan: StoryboardPlan;
  onPlanChange: (plan: StoryboardPlan) => void;
  onApprove: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isApproving: boolean;
  error: string | null;
}

export function DraftPlanEditor({
  plan,
  onPlanChange,
  onApprove,
  onRegenerate,
  onCancel,
  isApproving,
  error,
}: DraftPlanEditorProps) {
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [isGridPromptOpen, setIsGridPromptOpen] = useState(false);

  const currentGridValue = `${plan.rows}x${plan.cols}`;
  const sceneCount = plan.rows * plan.cols;

  const toggleSceneExpanded = (index: number) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedScenes(newExpanded);
  };

  const handleGridSizeChange = (value: string) => {
    const option = GRID_OPTIONS.find((o) => o.value === value);
    if (!option) return;

    const newSceneCount = option.rows * option.cols;
    const currentSceneCount = plan.voiceover_list.length;

    let newVoiceovers = [...plan.voiceover_list];
    let newVisualFlow = [...plan.visual_flow];

    if (newSceneCount > currentSceneCount) {
      // Add empty items
      for (let i = currentSceneCount; i < newSceneCount; i++) {
        newVoiceovers.push('');
        newVisualFlow.push('');
      }
    } else if (newSceneCount < currentSceneCount) {
      // Truncate
      newVoiceovers = newVoiceovers.slice(0, newSceneCount);
      newVisualFlow = newVisualFlow.slice(0, newSceneCount);
    }

    onPlanChange({
      ...plan,
      rows: option.rows,
      cols: option.cols,
      voiceover_list: newVoiceovers,
      visual_flow: newVisualFlow,
    });
  };

  const handleVoiceoverChange = (index: number, value: string) => {
    const newList = [...plan.voiceover_list];
    newList[index] = value;
    onPlanChange({ ...plan, voiceover_list: newList });
  };

  const handleVisualFlowChange = (index: number, value: string) => {
    const newList = [...plan.visual_flow];
    newList[index] = value;
    onPlanChange({ ...plan, visual_flow: newList });
  };

  const handleGridPromptChange = (value: string) => {
    onPlanChange({ ...plan, grid_image_prompt: value });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with grid size selector */}
      <div className="flex-none p-3 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Grid Size:</span>
            <Select
              value={currentGridValue}
              onValueChange={handleGridSizeChange}
            >
              <SelectTrigger className="h-7 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRID_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value} ({option.scenes})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            {sceneCount} scenes
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="p-3 flex flex-col gap-3">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Grid Image Prompt (collapsible) */}
          <Collapsible
            open={isGridPromptOpen}
            onOpenChange={setIsGridPromptOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Grid Image Prompt
                {isGridPromptOpen ? (
                  <IconChevronUp className="size-3" />
                ) : (
                  <IconChevronDown className="size-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Textarea
                value={plan.grid_image_prompt}
                onChange={(e) => handleGridPromptChange(e.target.value)}
                className="text-xs min-h-[100px] mt-1"
                placeholder="Grid image generation prompt..."
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Scene List */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Scenes
            </span>
            {plan.voiceover_list.map((voiceover, index) => {
              const isExpanded = expandedScenes.has(index);
              return (
                <div
                  key={index}
                  className="border border-border/50 rounded-md overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleSceneExpanded(index)}
                    className="w-full flex items-center justify-between p-2 hover:bg-secondary/30 transition-colors"
                  >
                    <span className="text-xs font-medium">
                      Scene {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {voiceover.slice(0, 30)}
                        {voiceover.length > 30 ? '...' : ''}
                      </span>
                      {isExpanded ? (
                        <IconChevronUp className="size-3" />
                      ) : (
                        <IconChevronDown className="size-3" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-2 pt-0 flex flex-col gap-2 border-t border-border/30">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          Voiceover
                        </label>
                        <Textarea
                          value={voiceover}
                          onChange={(e) =>
                            handleVoiceoverChange(index, e.target.value)
                          }
                          className="text-xs min-h-[60px]"
                          placeholder="Voiceover text for this scene..."
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">
                          Visual Prompt
                        </label>
                        <Textarea
                          value={plan.visual_flow[index] || ''}
                          onChange={(e) =>
                            handleVisualFlowChange(index, e.target.value)
                          }
                          className="text-xs min-h-[60px]"
                          placeholder="Visual/motion prompt for video generation..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <div className="flex-none p-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isApproving}
            className="h-8"
          >
            <IconX className="size-3 mr-1" />
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isApproving}
            className="h-8"
          >
            <IconRefresh className="size-3 mr-1" />
            Regenerate
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isApproving}
            className="h-8 flex-1"
          >
            {isApproving ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              'Generate Scenes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
