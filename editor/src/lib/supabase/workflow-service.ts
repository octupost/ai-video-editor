import { createClient } from '@/lib/supabase/client';

// Types for workflow data
export interface GridImage {
  id: string;
  project_id: string;
  rows: number;
  cols: number;
  cell_width: number;
  cell_height: number;
  url: string | null;
  prompt: string | null;
  status: 'pending' | 'processing' | 'success' | 'failed';
  request_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface FirstFrame {
  id: string;
  scene_id: string;
  visual_prompt: string | null;
  url: string | null;
  out_padded_url: string | null;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Voiceover {
  id: string;
  scene_id: string;
  text: string | null;
  status: 'pending' | 'processing' | 'success' | 'failed';
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  grid_image_id: string;
  order: number;
  created_at: string;
  first_frames: FirstFrame[];
  voiceovers: Voiceover[];
}

export interface GridImageWithScenes extends GridImage {
  scenes: Scene[];
}

/**
 * Get the latest grid_image for a project
 * Orders by created_at DESC and returns the most recent one
 */
export async function getLatestGridImage(
  projectId: string
): Promise<GridImage | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('grid_images')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // PGRST116 means no rows returned, which is not an error for our use case
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to fetch latest grid_image:', error);
    return null;
  }

  return data as GridImage;
}

/**
 * Get the latest successful grid_image for a project
 * Useful when you only want completed workflows
 */
export async function getLatestSuccessfulGridImage(
  projectId: string
): Promise<GridImage | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('grid_images')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to fetch latest successful grid_image:', error);
    return null;
  }

  return data as GridImage;
}

/**
 * Get all grid_images for a project, ordered by creation time (newest first)
 */
export async function getGridImagesForProject(
  projectId: string
): Promise<GridImage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('grid_images')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch grid_images:', error);
    return [];
  }

  return (data as GridImage[]) || [];
}

/**
 * Get the latest grid_image with its scenes, first_frames, and voiceovers
 * This is the main function for loading workflow data
 */
export async function getLatestGridImageWithScenes(
  projectId: string
): Promise<GridImageWithScenes | null> {
  const supabase = createClient();

  // First get the latest grid_image
  const { data: gridImage, error: gridError } = await supabase
    .from('grid_images')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (gridError) {
    if (gridError.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to fetch latest grid_image:', gridError);
    return null;
  }

  // Then get scenes with their first_frames and voiceovers
  const { data: scenes, error: scenesError } = await supabase
    .from('scenes')
    .select(
      `
      *,
      first_frames (*),
      voiceovers (*)
    `
    )
    .eq('grid_image_id', gridImage.id)
    .order('order', { ascending: true });

  if (scenesError) {
    console.error('Failed to fetch scenes:', scenesError);
    return { ...gridImage, scenes: [] } as GridImageWithScenes;
  }

  return {
    ...gridImage,
    scenes: (scenes as Scene[]) || [],
  } as GridImageWithScenes;
}

/**
 * Subscribe to grid_image status changes
 * Useful for real-time updates when waiting for workflow completion
 */
export function subscribeToGridImageStatus(
  gridImageId: string,
  onUpdate: (gridImage: GridImage) => void
) {
  const supabase = createClient();

  const channel = supabase
    .channel(`grid_image_${gridImageId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'grid_images',
        filter: `id=eq.${gridImageId}`,
      },
      (payload) => {
        onUpdate(payload.new as GridImage);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to first_frame status changes for a grid_image
 * Useful for tracking individual scene progress
 */
export function subscribeToFirstFrameUpdates(
  gridImageId: string,
  onUpdate: (firstFrame: FirstFrame) => void
) {
  const supabase = createClient();

  // We need to join through scenes to filter by grid_image_id
  // For simplicity, we'll subscribe to all first_frames changes
  // and filter client-side, or you can use a database function
  const channel = supabase
    .channel(`first_frames_${gridImageId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'first_frames',
      },
      (payload) => {
        onUpdate(payload.new as FirstFrame);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
