import { type NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const storyboardSchema = z.object({
  rows: z.number().int(),
  cols: z.number().int(),
  grid_image_prompt: z.string(),
  voiceover_list: z.array(z.string()),
  visual_flow: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a professional storyboard generator for video production.

Given a voiceover script and a visual style, generate a storyboard breakdown.

## Rules:

### 1. Grid Size
- rows × cols = total number of scenes
- Choose based on voiceover length: ~4-8 sec per scene
- Available grid options (in order of scene count):
- 2x2 (4), 3x2 (6), 3x3 (9), 4x3 (12), 4x4 (16), 5x4 (20), 5x5 (25), 6x5 (30), 6x6 (36), 7x6 (42), 7x7 (49), 8x7 (56), 8x8 (64)

### 2. Voiceover Splitting
- Each segment: 4-8 seconds of speech
- Array order = scene order (first item = scene 1)

### 3. Grid Image Prompt
- Single prompt for Nano Banana Pro image generator
- Reading order: left-to-right, top-to-bottom
- Label each cell: Grid1x1, Grid1x2, Grid2x1, etc.
- Describe EVERY cell explicitly with full visual details
- Format: "[style], [rows]x[cols] grid with thin 2px black dividing lines. Grid1x1: [full description], Grid1x2: [full description], ..."

### 4. Visual Flow (Image-to-Video Prompts)
- These are prompts to animate the static grid image into video
- DO NOT use character names - describe by appearance/role instead
  - Bad: "John walks forward"
  - Good: "elderly man with grey beard walks forward"
- Reference what is visible in the first frame
- Describe the action/movement that should happen form the first scene
- Keep prompts clear and specific to the visual content

IMPORTANT: The number of items in voiceover_list and visual_flow must EXACTLY equal rows × cols.

## Required JSON Output Format:
{
  "rows": <number>,
  "cols": <number>,
  "grid_image_prompt": "<string>",
  "voiceover_list": ["<segment1>", "<segment2>", ...],
  "visual_flow": ["<prompt1>", "<prompt2>", ...]
}`;

export async function POST(req: NextRequest) {
  try {
    const { voiceoverText, style } = await req.json();

    if (!voiceoverText) {
      return NextResponse.json(
        { error: 'Voiceover text is required' },
        { status: 400 }
      );
    }

    const userPrompt = `Style: ${style || 'cinematic'}

Voiceover Script:
${voiceoverText}

Generate the storyboard.`;

    const { object } = await generateObject({
      model: openrouter.chat('google/gemini-3-pro-preview'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      schema: storyboardSchema,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Storyboard generation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid response structure from AI', details: error.issues },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove storyboard by ID
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Storyboard ID is required' },
        { status: 400 }
      );
    }

    // RLS policies handle authorization - storyboards link to users via project_id
    const { error } = await supabase.from('storyboards').delete().eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete storyboard' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete storyboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
