import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ASPECT_RATIOS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storyboardId, gridImageId, rows, cols } = await req.json();

    if (!storyboardId || !gridImageId) {
      return NextResponse.json(
        { error: 'storyboardId and gridImageId are required' },
        { status: 400 }
      );
    }

    if (!rows || !cols || rows < 2 || rows > 8 || cols < 2 || cols > 8) {
      return NextResponse.json(
        { error: 'rows and cols must be between 2 and 8' },
        { status: 400 }
      );
    }

    // Fetch storyboard, validate plan_status === 'grid_ready'
    const { data: storyboard, error: fetchError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', storyboardId)
      .single();

    if (fetchError || !storyboard) {
      return NextResponse.json(
        { error: 'Storyboard not found' },
        { status: 404 }
      );
    }

    if (storyboard.plan_status !== 'grid_ready') {
      return NextResponse.json(
        { error: 'Storyboard is not in grid_ready status' },
        { status: 400 }
      );
    }

    if (!storyboard.plan) {
      return NextResponse.json(
        { error: 'Storyboard has no plan' },
        { status: 400 }
      );
    }

    // Fetch grid image, validate status === 'generated'
    const { data: gridImage, error: gridError } = await supabase
      .from('grid_images')
      .select('*')
      .eq('id', gridImageId)
      .single();

    if (gridError || !gridImage) {
      return NextResponse.json(
        { error: 'Grid image not found' },
        { status: 404 }
      );
    }

    if (gridImage.status !== 'generated') {
      return NextResponse.json(
        { error: 'Grid image is not in generated status' },
        { status: 400 }
      );
    }

    // If rows/cols changed, adjust voiceover_list and visual_flow
    const plan = { ...storyboard.plan };
    const newSceneCount = rows * cols;
    const oldSceneCount = plan.voiceover_list.length;

    if (
      newSceneCount !== oldSceneCount ||
      rows !== plan.rows ||
      cols !== plan.cols
    ) {
      plan.rows = rows;
      plan.cols = cols;

      if (newSceneCount < oldSceneCount) {
        plan.voiceover_list = plan.voiceover_list.slice(0, newSceneCount);
        plan.visual_flow = plan.visual_flow.slice(0, newSceneCount);
      } else if (newSceneCount > oldSceneCount) {
        const lastVo =
          plan.voiceover_list[plan.voiceover_list.length - 1] || '';
        const lastVf = plan.visual_flow[plan.visual_flow.length - 1] || '';
        while (plan.voiceover_list.length < newSceneCount) {
          plan.voiceover_list.push(lastVo);
          plan.visual_flow.push(lastVf);
        }
      }

      // Update plan in DB
      const { error: updatePlanError } = await supabase
        .from('storyboards')
        .update({ plan })
        .eq('id', storyboardId);

      if (updatePlanError) {
        console.error('Failed to update plan:', updatePlanError);
        return NextResponse.json(
          { error: 'Failed to update plan' },
          { status: 500 }
        );
      }
    }

    // Get dimensions from aspect ratio
    const dimensions =
      ASPECT_RATIOS[storyboard.aspect_ratio] || ASPECT_RATIOS['9:16'];

    // Get fresh session for edge function call
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.refreshSession();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Call approve-grid-split edge function
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'approve-grid-split',
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          storyboard_id: storyboardId,
          grid_image_id: gridImageId,
          grid_image_url: gridImage.url,
          rows: plan.rows,
          cols: plan.cols,
          width: dimensions.width,
          height: dimensions.height,
          voiceover_list: plan.voiceover_list,
          visual_prompt_list: plan.visual_flow,
        },
      }
    );

    if (fnError) {
      console.error('Edge function error:', fnError);
      return NextResponse.json(
        { error: 'Failed to start split workflow' },
        { status: 500 }
      );
    }

    if (fnData && fnData.success === false) {
      console.error('Split workflow returned failure:', fnData);
      return NextResponse.json(
        { error: fnData.error || 'Split workflow failed' },
        { status: 500 }
      );
    }

    // Update plan_status to 'approved'
    await supabase
      .from('storyboards')
      .update({ plan_status: 'approved' })
      .eq('id', storyboardId);

    return NextResponse.json({
      success: true,
      storyboard_id: storyboardId,
      grid_image_id: gridImageId,
    });
  } catch (error) {
    console.error('Approve grid error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
