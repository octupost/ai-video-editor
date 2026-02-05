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

    const { storyboardId } = await req.json();

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'Storyboard ID is required' },
        { status: 400 }
      );
    }

    // Fetch the draft storyboard
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

    if (storyboard.plan_status !== 'draft') {
      return NextResponse.json(
        { error: 'Storyboard is not in draft status' },
        { status: 400 }
      );
    }

    if (!storyboard.plan) {
      return NextResponse.json(
        { error: 'Storyboard has no plan' },
        { status: 400 }
      );
    }

    // Update status to 'generating'
    const { error: updateError } = await supabase
      .from('storyboards')
      .update({ plan_status: 'generating' })
      .eq('id', storyboardId);

    if (updateError) {
      console.error('Failed to update storyboard status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update storyboard status' },
        { status: 500 }
      );
    }

    // Get dimensions from aspect ratio
    const dimensions =
      ASPECT_RATIOS[storyboard.aspect_ratio] || ASPECT_RATIOS['9:16'];

    // Get a fresh session for the edge function call
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.refreshSession();

    if (sessionError || !session) {
      // Revert status on auth failure
      await supabase
        .from('storyboards')
        .update({ plan_status: 'draft' })
        .eq('id', storyboardId);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Call start-workflow edge function with storyboard_id
    const workflowBody = {
      storyboard_id: storyboardId,
      project_id: storyboard.project_id,
      grid_image_prompt: storyboard.plan.grid_image_prompt,
      rows: storyboard.plan.rows,
      cols: storyboard.plan.cols,
      voiceover_list: storyboard.plan.voiceover_list,
      visual_prompt_list: storyboard.plan.visual_flow,
      width: dimensions.width,
      height: dimensions.height,
      voiceover: storyboard.voiceover,
      aspect_ratio: storyboard.aspect_ratio,
    };

    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      'start-workflow',
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: workflowBody,
      }
    );

    if (fnError) {
      console.error('Edge function error:', fnError);
      // Revert status on failure
      await supabase
        .from('storyboards')
        .update({ plan_status: 'draft' })
        .eq('id', storyboardId);
      return NextResponse.json(
        { error: 'Failed to start workflow' },
        { status: 500 }
      );
    }

    if (fnData && fnData.success === false) {
      console.error('Workflow returned failure:', fnData);
      // Revert status on failure
      await supabase
        .from('storyboards')
        .update({ plan_status: 'draft' })
        .eq('id', storyboardId);
      return NextResponse.json(
        { error: fnData.error || 'Workflow failed' },
        { status: 500 }
      );
    }

    // Update status to 'approved' on success
    await supabase
      .from('storyboards')
      .update({ plan_status: 'approved' })
      .eq('id', storyboardId);

    return NextResponse.json({
      success: true,
      storyboard_id: storyboardId,
      grid_image_id: fnData?.grid_image_id,
    });
  } catch (error) {
    console.error('Approve storyboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
