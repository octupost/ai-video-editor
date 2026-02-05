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

Given a voiceover script, generate a storyboard breakdown. We want the end video to be realistic.

## Rules:

### 1. Grid Size
- rows × cols = total number of scenes
- Choose based on voiceover length: ~2-6 sec per scene
- Available grid options (in order of scene count):
- 2x2 (4), 3x2 (6), 3x3 (9), 4x3 (12), 4x4 (16), 5x4 (20), 5x5 (25), 6x5 (30), 6x6 (36), 7x6 (42), 7x7 (49), 8x7 (56), 8x8 (64)

### 2. Voiceover Splitting
- Each segment: 2 to 6 seconds of speech
- Array order = scene order (first item = scene 1)
- Break at natural pauses (punctuation, sentence boundaries)
- Try to keep the segments short and concise

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
- Include that there won't be any speech only sfx 

NOTE: You should think what to be in the first frame and what action to be done starting from that first frame for the scne to be engaging visually.

### 5. Real References
- If the voiceover mentions real people (celebrities, politicians, athletes), specific brands, landmarks, or locations, use their actual names and recognizable features in both grid_image_prompt and visual_flow
  - Example: "Elon Musk in a black suit standing at a podium" NOT "a businessman standing at a podium"
- Only use generic descriptions when the subject is fictional or unspecified

### 6. Language Matching
- Detect the language of the voiceover script
- grid_image_prompt and visual_flow must be written in the SAME language as the voiceover
- voiceover_list naturally stays in the original language since it's split from the input

IMPORTANT: The number of items in voiceover_list and visual_flow must EXACTLY equal rows × cols.

## Required JSON Output Format:
{
  "rows": <number>,
  "cols": <number>,
  "grid_image_prompt": "<string>",
  "voiceover_list": ["<segment1>", "<segment2>", ...],
  "visual_flow": ["<prompt1>", "<prompt2>", ...]
}`;

const VALID_MODELS = [
  'google/gemini-3-pro-preview',
  'anthropic/claude-opus-4.5',
  'openai/gpt-5.2-pro',
] as const;

export async function POST(req: NextRequest) {
  try {
    const { voiceoverText, model, projectId, aspectRatio } = await req.json();

    if (!voiceoverText) {
      return NextResponse.json(
        { error: 'Voiceover text is required' },
        { status: 400 }
      );
    }

    if (!model || !(VALID_MODELS as readonly string[]).includes(model)) {
      return NextResponse.json(
        { error: 'Invalid model. Must be one of: ' + VALID_MODELS.join(', ') },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!aspectRatio) {
      return NextResponse.json(
        { error: 'Aspect ratio is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPrompt = `Voiceover Script:
${voiceoverText}

Generate the storyboard.`;

    const { object } = await generateObject({
      model: openrouter.chat(model),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      schema: storyboardSchema,
    });

    // Create draft storyboard record with the generated plan
    const { data: storyboard, error: dbError } = await supabase
      .from('storyboards')
      .insert({
        project_id: projectId,
        voiceover: voiceoverText,
        aspect_ratio: aspectRatio,
        plan: object,
        plan_status: 'draft',
      })
      .select()
      .single();

    if (dbError || !storyboard) {
      console.error('Failed to create draft storyboard:', dbError);
      return NextResponse.json(
        { error: 'Failed to save storyboard draft' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...object,
      storyboard_id: storyboard.id,
    });
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

// PATCH - Update draft storyboard plan
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storyboardId, plan } = await req.json();

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'Storyboard ID is required' },
        { status: 400 }
      );
    }

    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    }

    // Validate plan structure
    const planValidation = storyboardSchema.safeParse(plan);
    if (!planValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid plan structure',
          details: planValidation.error.issues,
        },
        { status: 400 }
      );
    }

    // Validate array lengths match grid size
    const { rows, cols, voiceover_list, visual_flow } = plan;
    const expectedScenes = rows * cols;
    if (
      voiceover_list.length !== expectedScenes ||
      visual_flow.length !== expectedScenes
    ) {
      return NextResponse.json(
        {
          error: `voiceover_list and visual_flow must have exactly ${expectedScenes} items (${rows}x${cols})`,
        },
        { status: 400 }
      );
    }

    // Only update if plan_status is 'draft'
    const { data: storyboard, error: fetchError } = await supabase
      .from('storyboards')
      .select('plan_status')
      .eq('id', storyboardId)
      .single();

    if (fetchError || !storyboard) {
      return NextResponse.json(
        { error: 'Storyboard not found' },
        { status: 404 }
      );
    }

    if (storyboard.plan_status !== 'draft') {
      return NextResponse.json(
        { error: 'Can only update storyboards with draft status' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('storyboards')
      .update({ plan })
      .eq('id', storyboardId);

    if (updateError) {
      console.error('Failed to update storyboard plan:', updateError);
      return NextResponse.json(
        { error: 'Failed to update storyboard' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update storyboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
