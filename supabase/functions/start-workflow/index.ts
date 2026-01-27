import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const FAL_API_KEY = getRequiredEnv('FAL_KEY');
const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, content-type, x-client-info, apikey',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function corsResponse(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function errorResponse(error: string, status = 500): Response {
  return jsonResponse({ success: false, error }, status);
}

interface WorkflowInput {
  project_id: string;
  grid_image_prompt: string;
  rows: number;
  cols: number;
  voiceover_list: string[];
  visual_prompt_list: string[];
  width: number;
  height: number;
  voiceover: string;
  style: string;
  aspect_ratio: string;
}

function validateInput(input: WorkflowInput): string | null {
  const {
    project_id,
    grid_image_prompt,
    rows,
    cols,
    voiceover_list,
    visual_prompt_list,
    voiceover,
    style,
    aspect_ratio,
  } = input;

  if (
    !project_id ||
    !grid_image_prompt ||
    !rows ||
    !cols ||
    !voiceover_list ||
    !visual_prompt_list ||
    !voiceover ||
    !style ||
    !aspect_ratio
  ) {
    return 'Missing required fields';
  }

  const numberOfScenes = rows * cols;
  if (
    voiceover_list.length !== numberOfScenes ||
    visual_prompt_list.length !== numberOfScenes
  ) {
    return 'voiceover_list and visual_prompt_list must match rows * cols';
  }

  return null;
}

interface FalRequestResult {
  requestId: string | null;
  error: string | null;
}

async function sendFalRequest(
  falUrl: URL,
  prompt: string,
  log: ReturnType<typeof createLogger>
): Promise<FalRequestResult> {
  log.api('fal.ai', 'z-image/turbo', {
    prompt_length: prompt.length,
    aspect_ratio: '1:1',
  });
  log.startTiming('fal_request');

  const falResponse = await fetch(falUrl.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      num_images: 1,
      aspect_ratio: '1:1',
      output_format: 'png',
      safety_tolerance: '6',
    }),
  });

  if (!falResponse.ok) {
    const errorText = await falResponse.text();
    log.error('fal.ai request failed', {
      status: falResponse.status,
      error: errorText,
      time_ms: log.endTiming('fal_request'),
    });
    return {
      requestId: null,
      error: `fal.ai request failed: ${falResponse.status}`,
    };
  }

  const falResult = await falResponse.json();
  log.success('fal.ai request accepted', {
    request_id: falResult.request_id,
    time_ms: log.endTiming('fal_request'),
  });
  return { requestId: falResult.request_id, error: null };
}

type SupabaseClient = ReturnType<typeof createClient>;

async function createScenes(
  supabase: SupabaseClient,
  gridImageId: string,
  numberOfScenes: number,
  visualPromptList: string[],
  voiceoverList: string[],
  log: ReturnType<typeof createLogger>
): Promise<string[]> {
  log.info('Creating scenes', { count: numberOfScenes });
  log.startTiming('create_scenes');

  const createdScenes: string[] = [];
  for (let i = 0; i < numberOfScenes; i++) {
    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .insert({ grid_image_id: gridImageId, order: i })
      .select()
      .single();

    if (sceneError || !scene) {
      log.warn('Failed to insert scene', {
        index: i,
        error: sceneError?.message,
      });
      continue;
    }

    createdScenes.push(scene.id);
    await supabase.from('first_frames').insert({
      scene_id: scene.id,
      visual_prompt: visualPromptList[i],
      status: 'processing',
    });
    await supabase.from('voiceovers').insert({
      scene_id: scene.id,
      text: voiceoverList[i],
      status: 'success',
    });
  }

  log.success('Scenes created', {
    count: createdScenes.length,
    time_ms: log.endTiming('create_scenes'),
  });
  return createdScenes;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const log = createLogger();
  log.setContext({ step: 'StartWorkflow' });

  try {
    log.info('Request received', { method: req.method });

    const input: WorkflowInput = await req.json();
    const {
      project_id,
      grid_image_prompt,
      rows,
      cols,
      voiceover_list,
      visual_prompt_list,
      width,
      height,
      voiceover,
      style,
      aspect_ratio,
    } = input;
    const numberOfScenes = rows * cols;

    const validationError = validateInput(input);
    if (validationError) {
      return errorResponse(validationError, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Create storyboard record
    const { data: storyboard, error: storyboardError } = await supabase
      .from('storyboards')
      .insert({ project_id, voiceover, style, aspect_ratio })
      .select()
      .single();

    if (storyboardError || !storyboard) {
      log.error('Failed to insert storyboard', {
        error: storyboardError?.message,
      });
      return errorResponse('Failed to create storyboard record');
    }

    const storyboard_id = storyboard.id;
    log.success('storyboard created', { id: storyboard_id });

    // Create grid_images record
    const cellWidth = Math.floor(4096 / cols);
    const cellHeight = Math.floor(4096 / rows);

    const { data: gridImage, error: gridInsertError } = await supabase
      .from('grid_images')
      .insert({
        storyboard_id,
        rows,
        cols,
        cell_width: cellWidth,
        cell_height: cellHeight,
        prompt: grid_image_prompt,
        status: 'pending',
      })
      .select()
      .single();

    if (gridInsertError || !gridImage) {
      log.error('Failed to insert grid_images', {
        error: gridInsertError?.message,
      });
      return errorResponse('Failed to create grid image record');
    }

    const grid_image_id = gridImage.id;
    log.success('grid_images created', { id: grid_image_id });

    // Build webhook URL and send fal.ai request
    const webhookParams = new URLSearchParams({
      step: 'GenGridImage',
      grid_image_id,
      width: width.toString(),
      height: height.toString(),
      rows: rows.toString(),
      cols: cols.toString(),
    });
    const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook?${webhookParams.toString()}`;
    const falUrl = new URL('https://queue.fal.run/fal-ai/z-image/turbo');
    falUrl.searchParams.set('fal_webhook', webhookUrl);

    const falResult = await sendFalRequest(falUrl, grid_image_prompt, log);
    if (falResult.error) {
      await supabase
        .from('grid_images')
        .update({ status: 'failed', error_message: 'request_error' })
        .eq('id', grid_image_id);
      log.summary('error', { grid_image_id, reason: 'fal_request_failed' });
      return jsonResponse(
        {
          success: false,
          error: 'Failed to send generation request',
          grid_image_id,
        },
        500
      );
    }

    const requestId = falResult.requestId;
    await supabase
      .from('grid_images')
      .update({ status: 'processing', request_id: requestId })
      .eq('id', grid_image_id);

    // Create scenes
    const createdScenes = await createScenes(
      supabase,
      grid_image_id,
      numberOfScenes,
      visual_prompt_list,
      voiceover_list,
      log
    );

    log.summary('success', {
      storyboard_id,
      grid_image_id,
      request_id: requestId,
      scenes_created: createdScenes.length,
    });

    return jsonResponse({
      success: true,
      storyboard_id,
      grid_image_id,
      request_id: requestId,
      scenes_created: createdScenes.length,
    });
  } catch (error) {
    log.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    log.summary('error', { reason: 'unexpected_exception' });
    return errorResponse('Internal server error');
  }
});
