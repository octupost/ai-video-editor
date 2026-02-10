'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface DraftPlanEditorProps {
  plan: StoryboardPlan;
  onPlanChange?: (plan: StoryboardPlan) => void;
  onApprove?: () => void;
  onRegenerate?: () => void;
  onCancel?: () => void;
  isApproving?: boolean;
  error?: string | null;
  readOnly?: boolean;
}

export function DraftPlanEditor({
  plan,
  onPlanChange,
  onApprove,
  onRegenerate,
  onCancel,
  isApproving,
  error,
  readOnly,
}: DraftPlanEditorProps) {
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [isGridPromptOpen, setIsGridPromptOpen] = useState(false);

  const sceneCount = plan.voiceover_list.length;

  const toggleSceneExpanded = (index: number) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedScenes(newExpanded);
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
      {/* Header */}
      <div className="flex-none p-3 border-b border-border/50">
        <span className="text-xs text-muted-foreground">
          {plan.rows}x{plan.cols} grid · {sceneCount} scenes
        </span>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="p-3 flex flex-col gap-3">
          {/* Error display */}
          {error && !readOnly && (
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
                readOnly={readOnly}
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
                          readOnly={readOnly}
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
                          readOnly={readOnly}
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

      {/* Action buttons (hidden in read-only mode) */}
      {!readOnly && (
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
      )}
    </div>
  );
}
