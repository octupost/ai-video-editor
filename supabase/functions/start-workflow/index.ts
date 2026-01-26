import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FAL_API_KEY = Deno.env.get('FAL_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface WorkflowInput {
  project_id: string;
  grid_image_prompt: string;
  number_of_scenes: number;
  voiceover_list: string[];
  visual_prompt_list: string[];
  width: number;
  height: number;
}

function calculateGridDimensions(numberOfScenes: number) {
  const cols = Math.ceil(Math.sqrt(numberOfScenes));
  const rows = Math.ceil(numberOfScenes / cols);
  const cellWidth = Math.floor(4096 / cols);
  const cellHeight = Math.floor(4096 / rows);
  return { rows, cols, cellWidth, cellHeight };
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
    const input: WorkflowInput = await req.json();
    const {
      project_id,
      grid_image_prompt,
      number_of_scenes,
      voiceover_list,
      visual_prompt_list,
      width,
      height,
    } = input;

    // Validate input
    if (
      !project_id ||
      !grid_image_prompt ||
      !number_of_scenes ||
      !voiceover_list ||
      !visual_prompt_list
    ) {
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
      voiceover_list.length !== number_of_scenes ||
      visual_prompt_list.length !== number_of_scenes
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'voiceover_list and visual_prompt_list must match number_of_scenes',
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

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Calculate grid dimensions
    const { rows, cols, cellWidth, cellHeight } =
      calculateGridDimensions(number_of_scenes);

    // Step 2: Insert grid_images record
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
      console.error('Failed to insert grid_images:', gridInsertError);
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
        console.error('fal.ai error response:', errorText);
        throw new Error(`fal.ai request failed: ${falResponse.status}`);
      }

      const falResult = await falResponse.json();
      requestId = falResult.request_id;
      console.log('fal.ai request submitted:', requestId);
    } catch (falError) {
      console.error('fal.ai request error:', falError);
      // Update grid_images with error
      await supabase
        .from('grid_images')
        .update({ status: 'failed', error_message: 'request_error' })
        .eq('id', grid_image_id);

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
    await supabase
      .from('grid_images')
      .update({ status: 'processing', request_id: requestId })
      .eq('id', grid_image_id);

    // Step 5: Create scene records with first_frames and voiceovers
    const createdScenes: string[] = [];
    for (let i = 0; i < number_of_scenes; i++) {
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
        console.error(`Failed to insert scene ${i}:`, sceneError);
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
    console.error('Unexpected error:', error);
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
