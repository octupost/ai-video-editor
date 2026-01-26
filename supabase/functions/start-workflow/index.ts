import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';

const FAL_API_KEY = Deno.env.get('FAL_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WorkflowInput {
  project_id: string;
  grid_image_prompt: string;
  rows: number;
  cols: number;
  voiceover_list: string[];
  visual_prompt_list: string[];
  width: number;
  height: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, content-type, x-client-info, apikey',
      },
    });
  }

  const log = createLogger();
  log.setContext({ step: 'StartWorkflow' });

  try {
    log.info('Request received', { method: req.method });

    log.startTiming('parse_input');
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
    } = input;

    const numberOfScenes = rows * cols;

    log.info('Input parsed', {
      project_id,
      grid: `${rows}x${cols}`,
      scenes: numberOfScenes,
      dimensions: `${width}x${height}`,
      time_ms: log.endTiming('parse_input'),
    });

    // Validate input
    log.startTiming('validation');
    if (
      !project_id ||
      !grid_image_prompt ||
      !rows ||
      !cols ||
      !voiceover_list ||
      !visual_prompt_list
    ) {
      log.error('Validation failed: missing required fields', {
        has_project_id: !!project_id,
        has_prompt: !!grid_image_prompt,
        has_rows: !!rows,
        has_cols: !!cols,
        has_voiceovers: !!voiceover_list,
        has_visuals: !!visual_prompt_list,
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    if (
      voiceover_list.length !== numberOfScenes ||
      visual_prompt_list.length !== numberOfScenes
    ) {
      log.error('Validation failed: list length mismatch', {
        expected: numberOfScenes,
        voiceover_count: voiceover_list.length,
        visual_count: visual_prompt_list.length,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'voiceover_list and visual_prompt_list must match rows * cols',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    log.success('Validation passed', {
      project_id,
      grid: `${rows}x${cols}`,
      scenes: numberOfScenes,
      time_ms: log.endTiming('validation'),
    });

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Calculate cell dimensions from rows/cols
    const cellWidth = Math.floor(4096 / cols);
    const cellHeight = Math.floor(4096 / rows);

    log.info('Grid dimensions', {
      grid: `${rows}x${cols}`,
      scenes: numberOfScenes,
      cell_size: `${cellWidth}x${cellHeight}`,
    });

    // Step 2: Insert grid_images record
    log.startTiming('insert_grid_image');
    log.db('INSERT', 'grid_images', { project_id, rows, cols });

    const { data: gridImage, error: gridInsertError } = await supabase
      .from('grid_images')
      .insert({
        project_id,
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
        time_ms: log.endTiming('insert_grid_image'),
      });
      log.summary('error', { reason: 'grid_image_insert_failed' });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create grid image record',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const grid_image_id = gridImage.id;
    log.success('grid_images created', {
      id: grid_image_id,
      time_ms: log.endTiming('insert_grid_image'),
    });

    // Step 3: Build webhook URL with encoded data as query params
    // fal.ai requires webhook URL as query parameter, and we encode our data in the URL
    const webhookParams = new URLSearchParams({
      step: 'GenGridImage',
      grid_image_id: grid_image_id,
      width: width.toString(),
      height: height.toString(),
      rows: rows.toString(),
      cols: cols.toString(),
    });
    const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook?${webhookParams.toString()}`;

    // Build fal.ai request URL with webhook as query parameter
    const falUrl = new URL('https://queue.fal.run/fal-ai/z-image/turbo');
    falUrl.searchParams.set('fal_webhook', webhookUrl);

    let requestId: string | null = null;
    try {
      log.api('fal.ai', 'z-image/turbo', {
        prompt_length: grid_image_prompt.length,
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
          prompt: grid_image_prompt,
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
        throw new Error(`fal.ai request failed: ${falResponse.status}`);
      }

      const falResult = await falResponse.json();
      requestId = falResult.request_id;
      log.success('fal.ai request accepted', {
        request_id: requestId,
        time_ms: log.endTiming('fal_request'),
      });
    } catch (falError) {
      log.error('fal.ai request error', {
        error: falError instanceof Error ? falError.message : String(falError),
      });

      // Update grid_images with error
      await supabase
        .from('grid_images')
        .update({ status: 'failed', error_message: 'request_error' })
        .eq('id', grid_image_id);

      log.summary('error', { grid_image_id, reason: 'fal_request_failed' });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send generation request',
          grid_image_id,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Step 4: Update grid_images with processing status and request_id
    log.startTiming('update_processing');
    await supabase
      .from('grid_images')
      .update({ status: 'processing', request_id: requestId })
      .eq('id', grid_image_id);
    log.db('UPDATE', 'grid_images', {
      id: grid_image_id,
      status: 'processing',
      time_ms: log.endTiming('update_processing'),
    });

    // Step 5: Create scene records with first_frames and voiceovers
    log.info('Creating scenes', { count: numberOfScenes });
    log.startTiming('create_scenes');

    const createdScenes: string[] = [];
    for (let i = 0; i < numberOfScenes; i++) {
      // Insert scene
      const { data: scene, error: sceneError } = await supabase
        .from('scenes')
        .insert({
          project_id,
          grid_image_id,
          order: i,
        })
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

      // Insert first_frame (status = processing, will be updated by webhook)
      await supabase.from('first_frames').insert({
        scene_id: scene.id,
        visual_prompt: visual_prompt_list[i],
        status: 'processing',
      });

      // Insert voiceover (status = success for now)
      await supabase.from('voiceovers').insert({
        scene_id: scene.id,
        text: voiceover_list[i],
        status: 'success',
      });
    }

    log.success('Scenes created', {
      count: createdScenes.length,
      time_ms: log.endTiming('create_scenes'),
    });

    log.summary('success', {
      grid_image_id,
      request_id: requestId,
      scenes_created: createdScenes.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        grid_image_id,
        request_id: requestId,
        scenes_created: createdScenes.length,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    log.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    log.summary('error', { reason: 'unexpected_exception' });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
