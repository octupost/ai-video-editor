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

interface GenerateVideoInput {
  scene_ids: string[];
  resolution: '480p' | '720p' | '1080p';
}

interface VideoContext {
  first_frame_id: string;
  scene_id: string;
  final_url: string;
  visual_prompt: string;
  duration: number;
  aspect_ratio: string;
}

type SupabaseClient = ReturnType<typeof createClient>;

async function getVideoContext(
  supabase: SupabaseClient,
  sceneId: string,
  log: ReturnType<typeof createLogger>
): Promise<VideoContext | null> {
  // Fetch the scene with its first_frame, voiceover, and grid_image (for aspect_ratio)
  const { data: scene, error: sceneError } = await supabase
    .from('scenes')
    .select(`
      id,
      grid_image_id,
      first_frames (id, final_url, visual_prompt, video_status),
      voiceovers (duration)
    `)
    .eq('id', sceneId)
    .single();

  if (sceneError || !scene) {
    log.error('Failed to fetch scene', {
      scene_id: sceneId,
      error: sceneError?.message,
    });
    return null;
  }

  const firstFrame = scene.first_frames?.[0];
  if (!firstFrame) {
    log.error('No first_frame found for scene', { scene_id: sceneId });
    return null;
  }

  if (!firstFrame.final_url) {
    log.warn('No final_url for first_frame (enhance required)', {
      first_frame_id: firstFrame.id,
    });
    return null;
  }

  if (firstFrame.video_status === 'processing') {
    log.warn('Video already processing, skipping', {
      first_frame_id: firstFrame.id,
    });
    return null;
  }

  const voiceover = scene.voiceovers?.[0];
  if (!voiceover?.duration) {
    log.warn('No voiceover duration found', { scene_id: sceneId });
    return null;
  }

  // Fetch storyboard to get aspect_ratio
  const { data: gridImage, error: gridError } = await supabase
    .from('grid_images')
    .select(`
      storyboards (aspect_ratio)
    `)
    .eq('id', scene.grid_image_id)
    .single();

  if (gridError || !gridImage) {
    log.error('Failed to fetch grid_image/storyboard', {
      grid_image_id: scene.grid_image_id,
      error: gridError?.message,
    });
    return null;
  }

  const aspectRatio = gridImage.storyboards?.aspect_ratio;
  if (!aspectRatio) {
    log.error('No aspect_ratio found in storyboard', {
      grid_image_id: scene.grid_image_id,
      storyboard: gridImage.storyboards,
    });
    return null;
  }

  // Calculate duration: ceiling of voiceover duration, minimum 4
  const durationInt = Math.max(4, Math.ceil(voiceover.duration));

  return {
    first_frame_id: firstFrame.id,
    scene_id: sceneId,
    final_url: firstFrame.final_url,
    visual_prompt: firstFrame.visual_prompt || '',
    duration: durationInt,
    aspect_ratio: aspectRatio,
  };
}

async function sendVideoRequest(
  context: VideoContext,
  resolution: '480p' | '720p' | '1080p',
  log: ReturnType<typeof createLogger>
): Promise<{ requestId: string | null; error: string | null }> {
  const webhookParams = new URLSearchParams({
    step: 'GenerateVideo',
    first_frame_id: context.first_frame_id,
  });
  const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook?${webhookParams.toString()}`;

  const falUrl = new URL(
    'https://queue.fal.run/workflows/octupost/bytedancepro15'
  );
  falUrl.searchParams.set('fal_webhook', webhookUrl);

  log.api('fal.ai', 'workflows/octupost/bytedancepro15', {
    first_frame_id: context.first_frame_id,
    resolution,
    duration: context.duration,
    aspect_ratio: context.aspect_ratio,
  });
  log.startTiming('fal_video_request');

  try {
    const falResponse = await fetch(falUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: context.visual_prompt,
        image_url: context.final_url,
        resolution: resolution,
        duration: context.duration,
        aspect_ratio: context.aspect_ratio,
      }),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      log.error('fal.ai video request failed', {
        status: falResponse.status,
        error: errorText,
        time_ms: log.endTiming('fal_video_request'),
      });
      return {
        requestId: null,
        error: `fal.ai request failed: ${falResponse.status}`,
      };
    }

    const falResult = await falResponse.json();
    log.success('fal.ai video request accepted', {
      request_id: falResult.request_id,
      time_ms: log.endTiming('fal_video_request'),
    });

    return { requestId: falResult.request_id, error: null };
  } catch (err) {
    log.error('fal.ai video request exception', {
      error: err instanceof Error ? err.message : String(err),
      time_ms: log.endTiming('fal_video_request'),
    });
    return { requestId: null, error: 'Request exception' };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const log = createLogger();
  log.setContext({ step: 'GenerateVideo' });

  try {
    log.info('Request received', { method: req.method });

    const input: GenerateVideoInput = await req.json();
    const { scene_ids, resolution = '720p' } = input;

    if (!scene_ids || !Array.isArray(scene_ids) || scene_ids.length === 0) {
      log.error('Invalid input', { scene_ids });
      return errorResponse('scene_ids must be a non-empty array', 400);
    }

    if (!['480p', '720p', '1080p'].includes(resolution)) {
      log.error('Invalid resolution', { resolution });
      return errorResponse('resolution must be 480p, 720p, or 1080p', 400);
    }

    log.info('Processing video requests', {
      scene_count: scene_ids.length,
      resolution,
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: Array<{
      scene_id: string;
      first_frame_id: string | null;
      request_id: string | null;
      status: 'queued' | 'skipped' | 'failed';
      error?: string;
    }> = [];

    for (let i = 0; i < scene_ids.length; i++) {
      const sceneId = scene_ids[i];

      // Add delay between requests (except for the first one)
      if (i > 0) {
        log.info('Waiting before next request', { delay_ms: 1000, index: i });
        await delay(1000);
      }

      // Get video context
      log.startTiming(`get_context_${i}`);
      const context = await getVideoContext(supabase, sceneId, log);
      log.info('Video context fetched', {
        scene_id: sceneId,
        has_context: !!context,
        time_ms: log.endTiming(`get_context_${i}`),
      });

      if (!context) {
        results.push({
          scene_id: sceneId,
          first_frame_id: null,
          request_id: null,
          status: 'skipped',
          error:
            'Prerequisites not met (need enhanced image and voiceover duration)',
        });
        continue;
      }

      // Update status to processing and store resolution
      await supabase
        .from('first_frames')
        .update({ video_status: 'processing', video_resolution: resolution })
        .eq('id', context.first_frame_id);

      // Send video request
      const { requestId, error } = await sendVideoRequest(
        context,
        resolution,
        log
      );

      if (error || !requestId) {
        // Mark as failed
        await supabase
          .from('first_frames')
          .update({
            video_status: 'failed',
            video_error_message: 'request_error',
          })
          .eq('id', context.first_frame_id);

        results.push({
          scene_id: sceneId,
          first_frame_id: context.first_frame_id,
          request_id: null,
          status: 'failed',
          error: error || 'Unknown error',
        });
        continue;
      }

      // Store request_id
      await supabase
        .from('first_frames')
        .update({ video_request_id: requestId })
        .eq('id', context.first_frame_id);

      results.push({
        scene_id: sceneId,
        first_frame_id: context.first_frame_id,
        request_id: requestId,
        status: 'queued',
      });

      log.success('Video request queued', {
        scene_id: sceneId,
        first_frame_id: context.first_frame_id,
        request_id: requestId,
      });
    }

    const queuedCount = results.filter((r) => r.status === 'queued').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    log.summary('success', {
      total: scene_ids.length,
      queued: queuedCount,
      skipped: skippedCount,
      failed: failedCount,
    });

    return jsonResponse({
      success: true,
      results,
      summary: {
        total: scene_ids.length,
        queued: queuedCount,
        skipped: skippedCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    log.error('Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    log.summary('error', { reason: 'unexpected_exception' });
    return errorResponse('Internal server error');
  }
});
