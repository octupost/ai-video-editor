import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FAL_API_KEY = Deno.env.get('FAL_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface FalWebhookPayload {
  status: 'OK' | 'ERROR';
  request_id?: string;
  error?: string;
  // Images can be at various locations depending on fal.ai endpoint type
  images?: Array<{ url: string; filename?: string; content_type?: string }>;
  // deno-lint-ignore no-explicit-any
  outputs?: any;
  payload?: {
    images?: Array<{ url: string; filename?: string; content_type?: string }>;
    // deno-lint-ignore no-explicit-any
    outputs?: any;
    prompt?: string;
  };
}

// Helper to get images from various possible locations
function getImages(
  payload: FalWebhookPayload
): Array<{ url: string }> | undefined {
  // Check all possible locations where fal.ai might put images
  const candidates = [
    payload.payload?.images,
    payload.images,
    payload.payload?.outputs?.images,
    payload.outputs?.images,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0 && candidate[0]?.url) {
      return candidate;
    }
  }

  // Check ComfyUI node outputs (keyed by node ID like "11", "12", etc.)
  const outputs = payload.payload?.outputs || payload.outputs;
  if (outputs && typeof outputs === 'object' && !Array.isArray(outputs)) {
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (
        nodeOutput?.images &&
        Array.isArray(nodeOutput.images) &&
        nodeOutput.images[0]?.url
      ) {
        return nodeOutput.images;
      }
    }
  }

  return undefined;
}

async function handleGenGridImage(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams
): Promise<Response> {
  const grid_image_id = params.get('grid_image_id')!;
  const width = parseInt(params.get('width') || '1920');
  const height = parseInt(params.get('height') || '1080');
  const rows = parseInt(params.get('rows') || '2');
  const cols = parseInt(params.get('cols') || '2');

  console.log(
    'GenGridImage webhook received for grid_image_id:',
    grid_image_id
  );

  const images = getImages(falPayload);

  // Check if generation failed
  if (falPayload.status === 'ERROR' || !images?.[0]?.url) {
    console.error('Grid image generation failed:', falPayload.error);
    await supabase
      .from('grid_images')
      .update({ status: 'failed', error_message: 'generation_error' })
      .eq('id', grid_image_id);

    return new Response(
      JSON.stringify({ success: false, error: 'Generation failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const gridImageUrl = images[0].url;
  const prompt = falPayload.payload?.prompt;

  console.log('Grid image generated successfully:', gridImageUrl);

  // Step 1: Update grid_images with success and URL
  await supabase
    .from('grid_images')
    .update({
      status: 'success',
      url: gridImageUrl,
      prompt: prompt || null,
    })
    .eq('id', grid_image_id);

  // Step 2: Send split request to ComfyUI
  const splitWebhookParams = new URLSearchParams({
    step: 'SplitGridImage',
    grid_image_id: grid_image_id,
  });
  const splitWebhookUrl = `${SUPABASE_URL}/functions/v1/webhook?${splitWebhookParams.toString()}`;

  const falUrl = new URL('https://queue.fal.run/comfy/octupost/splitgridimage');
  falUrl.searchParams.set('fal_webhook', splitWebhookUrl);

  try {
    console.log('Sending split request to:', falUrl.toString());
    const splitResponse = await fetch(falUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loadimage_1: gridImageUrl,
        rows: rows,
        cols: cols,
        width: width,
        height: height,
      }),
    });

    if (!splitResponse.ok) {
      const errorText = await splitResponse.text();
      console.error('Split request failed:', errorText);
      throw new Error(`Split request failed: ${splitResponse.status}`);
    }

    const splitResult = await splitResponse.json();
    console.log('Split request sent successfully:', splitResult.request_id);
  } catch (splitError) {
    console.error('Failed to send split request:', splitError);
    // Mark all first_frames as failed
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id')
      .eq('grid_image_id', grid_image_id);

    if (scenes) {
      for (const scene of scenes) {
        await supabase
          .from('first_frames')
          .update({ status: 'failed', error_message: 'internal_error' })
          .eq('scene_id', scene.id);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, step: 'GenGridImage' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSplitGridImage(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams
): Promise<Response> {
  const grid_image_id = params.get('grid_image_id')!;

  console.log(
    'SplitGridImage webhook received for grid_image_id:',
    grid_image_id
  );

  // Fetch scenes in order
  const { data: scenes, error: scenesError } = await supabase
    .from('scenes')
    .select(`
      id,
      order,
      first_frames (id)
    `)
    .eq('grid_image_id', grid_image_id)
    .order('order', { ascending: true });

  if (scenesError || !scenes) {
    console.error('Failed to fetch scenes:', scenesError);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch scenes' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const images = getImages(falPayload);

  // Check if split failed
  if (falPayload.status === 'ERROR' || !images) {
    console.error(
      'Grid split failed:',
      falPayload.error,
      'payload:',
      JSON.stringify(falPayload)
    );
    for (const scene of scenes) {
      await supabase
        .from('first_frames')
        .update({ status: 'failed', error_message: 'split_error' })
        .eq('scene_id', scene.id);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Split failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(
    `Updating ${scenes.length} first_frames with ${images.length} images`
  );

  // Update first_frames for each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const firstFrame = scene.first_frames?.[0];

    if (!firstFrame) {
      console.error(`No first_frame found for scene ${scene.id}`);
      continue;
    }

    const imageUrl = images[i]?.url || null;

    await supabase
      .from('first_frames')
      .update({
        url: imageUrl,
        status: imageUrl ? 'success' : 'failed',
        error_message: imageUrl ? null : 'split_error',
      })
      .eq('id', firstFrame.id);
  }

  console.log('SplitGridImage completed successfully');

  return new Response(
    JSON.stringify({
      success: true,
      step: 'SplitGridImage',
      scenes_updated: scenes.length,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
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

  try {
    // Get step and other params from URL query parameters
    const url = new URL(req.url);
    const params = url.searchParams;
    const step = params.get('step');

    console.log(
      'Webhook received - step:',
      step,
      'params:',
      Object.fromEntries(params)
    );

    if (!step) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing step parameter' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the fal.ai payload from body
    const falPayload = await req.json();

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store raw payload for debugging
    await supabase.from('debug_logs').insert({
      step: step,
      payload: falPayload,
    });

    // Route to appropriate handler
    switch (step) {
      case 'GenGridImage':
        return await handleGenGridImage(supabase, falPayload, params);
      case 'SplitGridImage':
        return await handleSplitGridImage(supabase, falPayload, params);
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown step: ${step}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
