import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createLogger, type Logger } from '../_shared/logger.ts';
import * as musicMetadata from 'npm:music-metadata@10';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface FalAudioOutput {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}

interface FalWebhookPayload {
  status: 'OK' | 'ERROR';
  request_id?: string;
  error?: string;
  images?: Array<{ url: string }>;
  audio?: FalAudioOutput;
  video?: Array<{ url: string }> | { url: string };
  // deno-lint-ignore no-explicit-any
  outputs?: any;
  payload?: {
    images?: Array<{ url: string }>;
    audio?: FalAudioOutput;
    video?: Array<{ url: string }> | { url: string };
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

// Helper to get images from a specific ComfyUI node ID
function getImagesFromNode(
  payload: FalWebhookPayload,
  nodeId: string
): Array<{ url: string }> | undefined {
  const outputs = payload.payload?.outputs || payload.outputs;
  if (outputs && typeof outputs === 'object' && !Array.isArray(outputs)) {
    const nodeOutput = outputs[nodeId];
    if (
      nodeOutput?.images &&
      Array.isArray(nodeOutput.images) &&
      nodeOutput.images[0]?.url
    ) {
      return nodeOutput.images;
    }
  }
  return undefined;
}

async function handleGenGridImage(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const grid_image_id = params.get('grid_image_id')!;
  const storyboard_id = params.get('storyboard_id')!;
  const rows = parseInt(params.get('rows') || '0', 10);
  const cols = parseInt(params.get('cols') || '0', 10);
  const width = parseInt(params.get('width') || '1920', 10);
  const height = parseInt(params.get('height') || '1080', 10);

  log.info('Processing GenGridImage', {
    grid_image_id,
    dimensions: `${width}x${height}`,
    fal_status: falPayload.status,
  });

  log.startTiming('extract_images');
  const images = getImages(falPayload);
  const extractTime = log.endTiming('extract_images');

  // Determine where images were found
  const imageSource = images
    ? falPayload.payload?.images
      ? 'payload.images'
      : falPayload.images
        ? 'root.images'
        : 'outputs'
    : 'none';

  log.info('Image extraction', {
    source: imageSource,
    count: images?.length || 0,
    time_ms: extractTime,
  });

  // Check if generation failed
  if (falPayload.status === 'ERROR' || !images?.[0]?.url) {
    log.error('Grid image generation failed', {
      fal_error: falPayload.error,
      has_images: !!images,
    });

    log.startTiming('db_update_failed');
    await supabase
      .from('grid_images')
      .update({ status: 'failed', error_message: 'generation_error' })
      .eq('id', grid_image_id);
    log.db('UPDATE', 'grid_images', {
      id: grid_image_id,
      status: 'failed',
      time_ms: log.endTiming('db_update_failed'),
    });

    log.summary('error', { grid_image_id, reason: 'generation_failed' });
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

  log.success('Grid image generated', {
    url: gridImageUrl,
    has_prompt: !!prompt,
  });

  // Step 1: Validate grid dimensions from params
  if (rows < 2 || cols < 2 || rows !== cols + 1) {
    log.error('Invalid grid dimensions from params', { rows, cols });

    await supabase
      .from('grid_images')
      .update({
        status: 'failed',
        url: gridImageUrl,
        error_message: `Invalid grid dimensions: ${rows}x${cols}`,
      })
      .eq('id', grid_image_id);

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid grid dimensions' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  log.info('Grid dimensions from plan', { rows, cols });

  // Step 2: Update grid_images with 'generated' status (awaiting user review)
  log.startTiming('db_update_generated');
  await supabase
    .from('grid_images')
    .update({
      status: 'generated',
      url: gridImageUrl,
    })
    .eq('id', grid_image_id);
  log.db('UPDATE', 'grid_images', {
    id: grid_image_id,
    status: 'generated',
    rows,
    cols,
    time_ms: log.endTiming('db_update_generated'),
  });

  // Step 3: Update storyboard plan_status to 'grid_ready' for user review
  log.startTiming('db_update_plan_status');
  await supabase
    .from('storyboards')
    .update({ plan_status: 'grid_ready' })
    .eq('id', storyboard_id);
  log.db('UPDATE', 'storyboards', {
    id: storyboard_id,
    plan_status: 'grid_ready',
    time_ms: log.endTiming('db_update_plan_status'),
  });

  // Scene creation and split request are now triggered by user approval
  // via the approve-grid-split edge function

  log.summary('success', { grid_image_id, next_step: 'AwaitingUserReview' });
  return new Response(JSON.stringify({ success: true, step: 'GenGridImage' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSplitGridImage(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const grid_image_id = params.get('grid_image_id')!;

  log.info('Processing SplitGridImage', {
    grid_image_id,
    fal_status: falPayload.status,
  });

  // Fetch scenes in order
  log.startTiming('fetch_scenes');
  const { data: scenes, error: scenesError } = await supabase
    .from('scenes')
    .select(`
      id,
      order,
      first_frames (id)
    `)
    .eq('grid_image_id', grid_image_id)
    .order('order', { ascending: true });

  log.db('SELECT', 'scenes', {
    grid_image_id,
    count: scenes?.length || 0,
    time_ms: log.endTiming('fetch_scenes'),
  });

  if (scenesError || !scenes) {
    log.error('Failed to fetch scenes', { error: scenesError?.message });
    log.summary('error', { grid_image_id, reason: 'scenes_fetch_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch scenes' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get images from specific ComfyUI nodes
  // Node 30 = url (split images), Node 11 = out_padded_url (padded images)
  log.startTiming('extract_node_images');
  const urlImages = getImagesFromNode(falPayload, '30');
  const outPaddedImages = getImagesFromNode(falPayload, '11');

  log.info('Node images extracted', {
    node_30_count: urlImages?.length || 0,
    node_11_count: outPaddedImages?.length || 0,
    time_ms: log.endTiming('extract_node_images'),
  });

  // Check if split failed (need at least one set of images)
  if (falPayload.status === 'ERROR' || (!urlImages && !outPaddedImages)) {
    log.error('Grid split failed', {
      fal_error: falPayload.error,
      has_node_30: !!urlImages,
      has_node_11: !!outPaddedImages,
    });

    log.startTiming('mark_all_failed');
    for (const scene of scenes) {
      await supabase
        .from('first_frames')
        .update({ status: 'failed', error_message: 'split_error' })
        .eq('scene_id', scene.id);
    }
    log.warn('Marked all first_frames as failed', {
      count: scenes.length,
      time_ms: log.endTiming('mark_all_failed'),
    });

    log.summary('error', { grid_image_id, reason: 'split_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'Split failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Update first_frames for each scene
  log.info('Updating first_frames', {
    scenes_count: scenes.length,
    url_images: urlImages?.length || 0,
    padded_images: outPaddedImages?.length || 0,
  });

  log.startTiming('update_first_frames');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const firstFrame = scene.first_frames?.[0];

    if (!firstFrame) {
      log.warn('No first_frame for scene', {
        scene_id: scene.id,
        order: scene.order,
      });
      failCount++;
      continue;
    }

    const imageUrl = urlImages?.[i]?.url || null;
    const outPaddedUrl = outPaddedImages?.[i]?.url || null;
    const status = imageUrl || outPaddedUrl ? 'success' : 'failed';

    await supabase
      .from('first_frames')
      .update({
        url: imageUrl,
        out_padded_url: outPaddedUrl,
        status,
        error_message: status === 'failed' ? 'split_error' : null,
      })
      .eq('id', firstFrame.id);

    if (status === 'success') successCount++;
    else failCount++;
  }

  log.success('first_frames updated', {
    success: successCount,
    failed: failCount,
    time_ms: log.endTiming('update_first_frames'),
  });

  log.summary('success', {
    grid_image_id,
    scenes_updated: scenes.length,
    success_count: successCount,
    fail_count: failCount,
  });

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

// Helper to get videos from various possible locations
function getVideos(
  payload: FalWebhookPayload
): Array<{ url: string }> | undefined {
  // Check all possible locations where fal.ai might put videos
  const candidates = [
    payload.payload?.video,
    payload.video,
    payload.payload?.outputs?.video,
    payload.outputs?.video,
  ];

  for (const candidate of candidates) {
    // Handle both array and single object formats
    if (Array.isArray(candidate) && candidate.length > 0 && candidate[0]?.url) {
      return candidate;
    }
    if (candidate && !Array.isArray(candidate) && candidate.url) {
      return [candidate];
    }
  }

  // Check ComfyUI node outputs
  const outputs = payload.payload?.outputs || payload.outputs;
  if (outputs && typeof outputs === 'object' && !Array.isArray(outputs)) {
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutput = outputs[nodeId];
      if (nodeOutput?.video) {
        if (Array.isArray(nodeOutput.video) && nodeOutput.video[0]?.url) {
          return nodeOutput.video;
        }
        if (nodeOutput.video.url) {
          return [nodeOutput.video];
        }
      }
    }
  }

  return undefined;
}

// Helper to get audio from various possible locations
function getAudio(payload: FalWebhookPayload): FalAudioOutput | undefined {
  // Check all possible locations where fal.ai might put audio
  const candidates = [payload.payload?.audio, payload.audio];

  for (const candidate of candidates) {
    if (candidate?.url) {
      return candidate;
    }
  }

  return undefined;
}

async function handleEnhanceImage(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const first_frame_id = params.get('first_frame_id')!;

  log.info('Processing EnhanceImage', {
    first_frame_id,
    fal_status: falPayload.status,
  });

  log.startTiming('extract_images');
  const images = getImages(falPayload);
  const extractTime = log.endTiming('extract_images');

  log.info('Image extraction', {
    count: images?.length || 0,
    has_url: !!images?.[0]?.url,
    time_ms: extractTime,
  });

  // Check if enhancement failed
  if (falPayload.status === 'ERROR' || !images?.[0]?.url) {
    log.error('Image enhancement failed', {
      fal_error: falPayload.error,
      has_images: !!images,
    });

    log.startTiming('db_update_failed');
    await supabase
      .from('first_frames')
      .update({
        enhance_status: 'failed',
        enhance_error_message: 'generation_error',
      })
      .eq('id', first_frame_id);
    log.db('UPDATE', 'first_frames', {
      id: first_frame_id,
      enhance_status: 'failed',
      time_ms: log.endTiming('db_update_failed'),
    });

    log.summary('error', { first_frame_id, reason: 'enhancement_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'Enhancement failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const finalUrl = images[0].url;

  log.success('Image enhanced', {
    final_url: finalUrl,
  });

  // Update first_frame with success and final_url
  log.startTiming('db_update_success');
  await supabase
    .from('first_frames')
    .update({
      enhance_status: 'success',
      final_url: finalUrl,
    })
    .eq('id', first_frame_id);
  log.db('UPDATE', 'first_frames', {
    id: first_frame_id,
    enhance_status: 'success',
    time_ms: log.endTiming('db_update_success'),
  });

  log.summary('success', { first_frame_id, final_url: finalUrl });
  return new Response(
    JSON.stringify({
      success: true,
      step: 'EnhanceImage',
      first_frame_id,
      final_url: finalUrl,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

async function handleGenerateTTS(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const voiceover_id = params.get('voiceover_id')!;

  log.info('Processing GenerateTTS', {
    voiceover_id,
    fal_status: falPayload.status,
  });

  log.startTiming('extract_audio');
  const audio = getAudio(falPayload);
  const extractTime = log.endTiming('extract_audio');

  // Determine where audio was found
  const audioSource = audio
    ? falPayload.payload?.audio
      ? 'payload.audio'
      : falPayload.audio
        ? 'root.audio'
        : 'none'
    : 'none';

  log.info('Audio extraction', {
    source: audioSource,
    has_url: !!audio?.url,
    time_ms: extractTime,
  });

  // Check if generation failed
  if (falPayload.status === 'ERROR' || !audio?.url) {
    log.error('TTS generation failed', {
      fal_error: falPayload.error,
      has_audio: !!audio,
    });

    log.startTiming('db_update_failed');
    await supabase
      .from('voiceovers')
      .update({ status: 'failed', error_message: 'generation_error' })
      .eq('id', voiceover_id);
    log.db('UPDATE', 'voiceovers', {
      id: voiceover_id,
      status: 'failed',
      time_ms: log.endTiming('db_update_failed'),
    });

    log.summary('error', { voiceover_id, reason: 'generation_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'TTS generation failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const audioUrl = audio.url;

  log.success('TTS audio generated', {
    url: audioUrl,
    content_type: audio.content_type,
    file_size: audio.file_size,
  });

  // Fetch and decode audio to get duration
  let duration: number | null = null;
  try {
    log.startTiming('calculate_duration');
    const audioResponse = await fetch(audioUrl);
    const arrayBuffer = await audioResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const metadata = await musicMetadata.parseBuffer(uint8Array);
    duration = metadata.format.duration ?? null;
    log.info('Audio duration calculated', {
      duration,
      format: metadata.format.codec,
      time_ms: log.endTiming('calculate_duration'),
    });
  } catch (err) {
    log.error('Failed to calculate audio duration', {
      error: err instanceof Error ? err.message : String(err),
      time_ms: log.endTiming('calculate_duration'),
    });

    // Mark as failed - duration is required
    await supabase
      .from('voiceovers')
      .update({
        status: 'failed',
        error_message: 'duration_error',
      })
      .eq('id', voiceover_id);

    log.summary('error', {
      voiceover_id,
      reason: 'duration_calculation_failed',
    });
    return new Response(
      JSON.stringify({ success: false, error: 'Duration calculation failed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Update voiceover with success, audio URL, and duration
  log.startTiming('db_update_success');
  await supabase
    .from('voiceovers')
    .update({
      status: 'success',
      audio_url: audioUrl,
      duration: duration,
    })
    .eq('id', voiceover_id);
  log.db('UPDATE', 'voiceovers', {
    id: voiceover_id,
    status: 'success',
    duration,
    time_ms: log.endTiming('db_update_success'),
  });

  log.summary('success', { voiceover_id, audio_url: audioUrl, duration });
  return new Response(
    JSON.stringify({
      success: true,
      step: 'GenerateTTS',
      voiceover_id,
      duration,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

async function handleGenerateVideo(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const first_frame_id = params.get('first_frame_id')!;

  log.info('Processing GenerateVideo', {
    first_frame_id,
    fal_status: falPayload.status,
  });

  log.startTiming('extract_videos');
  const videos = getVideos(falPayload);
  const extractTime = log.endTiming('extract_videos');

  // Determine where video was found
  const videoSource = videos
    ? falPayload.payload?.video
      ? 'payload.video'
      : falPayload.video
        ? 'root.video'
        : 'outputs'
    : 'none';

  log.info('Video extraction', {
    source: videoSource,
    count: videos?.length || 0,
    has_url: !!videos?.[0]?.url,
    time_ms: extractTime,
  });

  // Check if generation failed
  if (falPayload.status === 'ERROR' || !videos?.[0]?.url) {
    log.error('Video generation failed', {
      fal_error: falPayload.error,
      has_videos: !!videos,
    });

    log.startTiming('db_update_failed');
    await supabase
      .from('first_frames')
      .update({
        video_status: 'failed',
        video_error_message: 'generation_error',
      })
      .eq('id', first_frame_id);
    log.db('UPDATE', 'first_frames', {
      id: first_frame_id,
      video_status: 'failed',
      time_ms: log.endTiming('db_update_failed'),
    });

    log.summary('error', { first_frame_id, reason: 'generation_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'Video generation failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get first video URL only
  const videoUrl = videos[0].url;

  log.success('Video generated', {
    video_url: videoUrl,
  });

  // Update first_frame with success and video_url
  log.startTiming('db_update_success');
  await supabase
    .from('first_frames')
    .update({
      video_status: 'success',
      video_url: videoUrl,
    })
    .eq('id', first_frame_id);
  log.db('UPDATE', 'first_frames', {
    id: first_frame_id,
    video_status: 'success',
    time_ms: log.endTiming('db_update_success'),
  });

  log.summary('success', { first_frame_id, video_url: videoUrl });
  return new Response(
    JSON.stringify({
      success: true,
      step: 'GenerateVideo',
      first_frame_id,
      video_url: videoUrl,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

async function handleGenerateSFX(
  supabase: ReturnType<typeof createClient>,
  falPayload: FalWebhookPayload,
  params: URLSearchParams,
  log: Logger
): Promise<Response> {
  const first_frame_id = params.get('first_frame_id')!;

  log.info('Processing GenerateSFX', {
    first_frame_id,
    fal_status: falPayload.status,
  });

  log.startTiming('extract_videos');
  const videos = getVideos(falPayload);
  const extractTime = log.endTiming('extract_videos');

  log.info('Video extraction (SFX)', {
    count: videos?.length || 0,
    has_url: !!videos?.[0]?.url,
    time_ms: extractTime,
  });

  // Check if generation failed
  if (falPayload.status === 'ERROR' || !videos?.[0]?.url) {
    log.error('SFX generation failed', {
      fal_error: falPayload.error,
      has_videos: !!videos,
    });

    log.startTiming('db_update_failed');
    await supabase
      .from('first_frames')
      .update({
        sfx_status: 'failed',
        sfx_error_message: 'generation_error',
      })
      .eq('id', first_frame_id);
    log.db('UPDATE', 'first_frames', {
      id: first_frame_id,
      sfx_status: 'failed',
      time_ms: log.endTiming('db_update_failed'),
    });

    log.summary('error', { first_frame_id, reason: 'sfx_generation_failed' });
    return new Response(
      JSON.stringify({ success: false, error: 'SFX generation failed' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get first video URL only (SFX result overwrites video_url)
  const videoUrl = videos[0].url;

  log.success('SFX generated', {
    video_url: videoUrl,
  });

  // Update first_frame with success and overwrite video_url
  log.startTiming('db_update_success');
  await supabase
    .from('first_frames')
    .update({
      sfx_status: 'success',
      video_url: videoUrl,
    })
    .eq('id', first_frame_id);
  log.db('UPDATE', 'first_frames', {
    id: first_frame_id,
    sfx_status: 'success',
    time_ms: log.endTiming('db_update_success'),
  });

  log.summary('success', { first_frame_id, video_url: videoUrl });
  return new Response(
    JSON.stringify({
      success: true,
      step: 'GenerateSFX',
      first_frame_id,
      video_url: videoUrl,
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

  const log = createLogger();

  try {
    // Get step and other params from URL query parameters
    const url = new URL(req.url);
    const params = url.searchParams;
    const step = params.get('step');
    const gridImageId = params.get('grid_image_id');

    log.setContext({ step: step || 'Unknown' });

    log.info('Webhook received', {
      step,
      grid_image_id: gridImageId,
      params: Object.fromEntries(params),
    });

    if (!step) {
      log.error('Missing step parameter');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing step parameter' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the fal.ai payload from body
    log.startTiming('parse_payload');
    const falPayload = await req.json();
    log.info('Payload parsed', {
      fal_status: falPayload.status,
      has_images: !!falPayload.images || !!falPayload.payload?.images,
      request_id: falPayload.request_id,
      time_ms: log.endTiming('parse_payload'),
    });

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Store raw payload for debugging
    log.startTiming('debug_log_insert');
    await supabase.from('debug_logs').insert({
      step: step,
      payload: falPayload,
    });
    log.info('Debug payload stored', {
      time_ms: log.endTiming('debug_log_insert'),
    });

    // Route to appropriate handler
    switch (step) {
      case 'GenGridImage':
        return await handleGenGridImage(supabase, falPayload, params, log);
      case 'SplitGridImage':
        return await handleSplitGridImage(supabase, falPayload, params, log);
      case 'GenerateTTS':
        return await handleGenerateTTS(supabase, falPayload, params, log);
      case 'EnhanceImage':
        return await handleEnhanceImage(supabase, falPayload, params, log);
      case 'GenerateVideo':
        return await handleGenerateVideo(supabase, falPayload, params, log);
      case 'GenerateSFX':
        return await handleGenerateSFX(supabase, falPayload, params, log);
      default:
        log.error('Unknown step', { step });
        return new Response(
          JSON.stringify({ success: false, error: `Unknown step: ${step}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    log.error('Unhandled exception', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
