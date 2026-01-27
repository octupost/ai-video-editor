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

interface EnhanceImageInput {
  scene_ids: string[];
}

interface FirstFrameContext {
  first_frame_id: string;
  scene_id: string;
  out_padded_url: string;
}

type SupabaseClient = ReturnType<typeof createClient>;

async function getFirstFrameContext(
  supabase: SupabaseClient,
  sceneId: string,
  log: ReturnType<typeof createLogger>
): Promise<FirstFrameContext | null> {
  const { data: firstFrame, error: ffError } = await supabase
    .from('first_frames')
    .select('id, scene_id, out_padded_url, enhance_status')
    .eq('scene_id', sceneId)
    .single();

  if (ffError || !firstFrame) {
    log.error('Failed to fetch first_frame', {
      scene_id: sceneId,
      error: ffError?.message,
    });
    return null;
  }

  if (!firstFrame.out_padded_url) {
    log.warn('No out_padded_url for first_frame', {
      first_frame_id: firstFrame.id,
    });
    return null;
  }

  if (firstFrame.enhance_status === 'processing') {
    log.warn('Enhance already processing, skipping', {
      first_frame_id: firstFrame.id,
    });
    return null;
  }

  return {
    first_frame_id: firstFrame.id,
    scene_id: sceneId,
    out_padded_url: firstFrame.out_padded_url,
  };
}

async function sendEnhanceRequest(
  context: FirstFrameContext,
  log: ReturnType<typeof createLogger>
): Promise<{ requestId: string | null; error: string | null }> {
  const webhookParams = new URLSearchParams({
    step: 'EnhanceImage',
    first_frame_id: context.first_frame_id,
  });
  const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook?${webhookParams.toString()}`;

  const falUrl = new URL(
    'https://queue.fal.run/workflows/octupost/enhanceimage'
  );
  falUrl.searchParams.set('fal_webhook', webhookUrl);

  log.api('fal.ai', 'workflows/octupost/enhanceimage', {
    first_frame_id: context.first_frame_id,
    has_out_padded_url: !!context.out_padded_url,
  });
  log.startTiming('fal_enhance_request');

  try {
    const falResponse = await fetch(falUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_urls: [context.out_padded_url],
      }),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      log.error('fal.ai enhance request failed', {
        status: falResponse.status,
        error: errorText,
        time_ms: log.endTiming('fal_enhance_request'),
      });
      return {
        requestId: null,
        error: `fal.ai request failed: ${falResponse.status}`,
      };
    }

    const falResult = await falResponse.json();
    log.success('fal.ai enhance request accepted', {
      request_id: falResult.request_id,
      time_ms: log.endTiming('fal_enhance_request'),
    });

    return { requestId: falResult.request_id, error: null };
  } catch (err) {
    log.error('fal.ai enhance request exception', {
      error: err instanceof Error ? err.message : String(err),
      time_ms: log.endTiming('fal_enhance_request'),
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
  log.setContext({ step: 'EnhanceImage' });

  try {
    log.info('Request received', { method: req.method });

    const input: EnhanceImageInput = await req.json();
    const { scene_ids } = input;

    if (!scene_ids || !Array.isArray(scene_ids) || scene_ids.length === 0) {
      log.error('Invalid input', { scene_ids });
      return errorResponse('scene_ids must be a non-empty array', 400);
    }

    log.info('Processing enhance requests', { scene_count: scene_ids.length });

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

      // Get first_frame context
      log.startTiming(`get_context_${i}`);
      const context = await getFirstFrameContext(supabase, sceneId, log);
      log.info('First frame context fetched', {
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
          error: 'First frame not found or already processing',
        });
        continue;
      }

      // Update status to processing
      await supabase
        .from('first_frames')
        .update({ enhance_status: 'processing' })
        .eq('id', context.first_frame_id);

      // Send enhance request
      const { requestId, error } = await sendEnhanceRequest(context, log);

      if (error || !requestId) {
        // Mark as failed with request_error
        await supabase
          .from('first_frames')
          .update({
            enhance_status: 'failed',
            enhance_error_message: 'request_error',
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
        .update({ enhance_request_id: requestId })
        .eq('id', context.first_frame_id);

      results.push({
        scene_id: sceneId,
        first_frame_id: context.first_frame_id,
        request_id: requestId,
        status: 'queued',
      });

      log.success('Enhance request queued', {
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
