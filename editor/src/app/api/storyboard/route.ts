import { type NextRequest, NextResponse } from 'next/server';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const storyboardSchema = z.object({
  rows: z.number(),
  cols: z.number(),
  grid_image_prompt: z.string(),
  voiceover_list: z.array(z.string()),
  visual_flow: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a professional storyboard generator for video production. Given a voiceover script, generate a realistic storyboard breakdown.

## Rules:

### 1. Voiceover Splitting
- Split the script into segments of roughly 5-15 words each (targeting 2-6 seconds of speech per segment)
- The number of segments determines the grid size

### 2. Grid Size Selection
- Count your voiceover segments, then pick the smallest grid that fits from this list: 3x2(6), 4x3(12), 5x4(20), 6x5(30), 7x6(42), 8x7(56)
- The number of cells MUST exactly equal the number of voiceover segments and visual_flow entries

### 3. Grid Image Prompt
- One single image containing all scenes as cells in a grid
- Each cell represents the first frame of that scene
- Label cells as Cell_R1C1, Cell_R1C2, Cell_R2C1, etc.
- Describe EVERY cell with full visual details including faces when people are shown
- Format: "[style], grid with thin 2px black dividing lines. Cell_R1C1: [full description], Cell_R1C2: [full description], ..."

### 4. Visual Flow (Image-to-Video Prompts)
- One prompt per cell describing how to animate that static frame into video
- Reference what is visible in the first frame and describe the action/movement from there
- DO NOT use character names — describe by appearance/role instead (e.g. "elderly man with grey beard" not "John")
- Each prompt must include that there is no speech, only sound effects

### 5. Real References
- If the voiceover mentions real people, brands, landmarks, or locations, use their actual names and recognizable features in both grid_image_prompt and visual_flow
- Only use generic descriptions for fictional or unspecified subjects

### 6. Language Matching
- Detect the voiceover language
- grid_image_prompt and visual_flow must be in the SAME language as the voiceover

## Output:
Return ONLY valid JSON:
{
  "rows": <number>,
  "cols": <number>,
  "grid_image_prompt": "<string>",
  "voiceover_list": ["<string>", ...],
  "visual_flow": ["<string>", ...]
}

All three arrays (grid cells, voiceover_list, visual_flow) must have the EXACT same count.`;

const VALID_MODELS = [
  'google/gemini-3-pro-preview',
  'anthropic/claude-opus-4.6',
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
        { error: `Invalid model. Must be one of: ${VALID_MODELS.join(', ')}` },
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

    console.log('[Storyboard] LLM request:', {
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    const { object } = await generateObject({
      model: openrouter.chat(model, {
        plugins: [{ id: 'response-healing' }],
      }),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      schema: storyboardSchema,
    });

    console.log('[Storyboard] LLM response:', JSON.stringify(object, null, 2));

    // Validate grid bounds
    if (
      object.rows < 2 ||
      object.rows > 8 ||
      object.cols < 2 ||
      object.cols > 8
    ) {
      return NextResponse.json(
        {
          error: `LLM returned out-of-range grid: ${object.rows}x${object.cols}. rows and cols must be between 2 and 8.`,
        },
        { status: 500 }
      );
    }

    // Validate grid constraint: rows must equal cols + 1
    if (object.rows !== object.cols + 1) {
      return NextResponse.json(
        {
          error: `LLM returned invalid grid: ${object.rows}x${object.cols}. rows must equal cols + 1.`,
        },
        { status: 500 }
      );
    }

    // Validate array lengths match grid dimensions
    const expectedScenes = object.rows * object.cols;
    if (
      object.voiceover_list.length !== expectedScenes ||
      object.visual_flow.length !== expectedScenes
    ) {
      return NextResponse.json(
        {
          error: `Scene count mismatch: grid is ${object.rows}x${object.cols}=${expectedScenes} but voiceover_list has ${object.voiceover_list.length} and visual_flow has ${object.visual_flow.length} items`,
        },
        { status: 500 }
      );
    }

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

    // Validate grid constraint: rows must equal cols + 1
    if (plan.rows !== plan.cols + 1) {
      return NextResponse.json(
        {
          error: `Invalid grid: ${plan.rows}x${plan.cols}. rows must equal cols + 1.`,
        },
        { status: 400 }
      );
    }

    // Validate array lengths match grid dimensions
    const expectedScenes = plan.rows * plan.cols;
    const { voiceover_list, visual_flow } = plan;
    if (
      voiceover_list.length !== expectedScenes ||
      visual_flow.length !== expectedScenes
    ) {
      return NextResponse.json(
        {
          error: `Scene count mismatch: grid is ${plan.rows}x${plan.cols}=${expectedScenes} but voiceover_list has ${voiceover_list.length} and visual_flow has ${visual_flow.length} items`,
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
