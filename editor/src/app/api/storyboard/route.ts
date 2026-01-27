import { type NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { z } from 'zod';

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

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

const SYSTEM_PROMPT = `You are a professional storyboard generator for video production.

Given a voiceover script and a visual style, generate a storyboard breakdown.

## Rules:

### 1. Grid Size
- Grid fits within 4096x4096 pixels
- rows × cols = total number of scenes
- Choose based on voiceover length: ~4-6 sec per scene
- Available grid options (in order of scene count):
  - 2x2 (4), 2x3 (6), 3x3 (9), 3x4 (12), 4x4 (16), 4x5 (20), 5x5 (25), 5x6 (30), 6x6 (36), 6x7 (42), 7x7 (49), 7x8 (56), 8x8 (64), 8x9 (72), 9x9 (81), 9x10 (90), 10x10 (100), 10x11 (110), 11x11 (121), 11x12 (132), 12x12 (144)

### 2. Voiceover Splitting
- Each segment: 4-6 seconds of speech (~10-15 words)
- Be conservative - shorter is better
- Split purely by timing, not by sentence breaks
- Array order = scene order (first item = scene 1)

### 3. Grid Image Prompt
- Single prompt for Nano Banana Pro image generator
- Reading order: left-to-right, top-to-bottom
- Label each cell: Grid1x1 (top-left), Grid1x2 (next), Grid2x1 (second row left), etc.
- Specify: "thin 2px black lines separating each grid cell"
- Describe EVERY cell explicitly with full visual details
- Format: "[style], [rows]x[cols] grid with thin 2px black dividing lines. Grid1x1: [full description], Grid1x2: [full description], ..."

### 4. Visual Flow (Image-to-Video Prompts)
- These are prompts to animate the static grid image into video
- Array order = scene order (first item = scene 1)
- DO NOT use character names - describe by appearance/role instead
  - Bad: "John walks forward"
  - Good: "elderly man with grey beard walks forward"
- Reference what is visible in the first frame
- Describe the action/movement that should happen
- Keep prompts clear and specific to the visual content

IMPORTANT: The number of items in voiceover_list and visual_flow must EXACTLY equal rows × cols.`;

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

    const result = await generateText({
      model: openrouter.chat('anthropic/claude-sonnet-4.5'),
      system: `${SYSTEM_PROMPT}\n\nRespond with valid JSON only. No markdown, no code blocks, just raw JSON.`,
      prompt: userPrompt,
    });

    const parsed = storyboardSchema.parse(JSON.parse(extractJSON(result.text)));
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Storyboard generation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
