import type { Studio } from 'openvideo';
import { Video, Audio } from 'openvideo';

/**
 * Find a track of the given type that has no clips overlapping [from, to].
 * Returns undefined if all matching tracks have conflicts.
 */
export function findCompatibleTrack(
  studio: Studio,
  clipType: string,
  displayFrom: number,
  displayTo: number
) {
  return studio.tracks.find((track) => {
    if (track.type !== clipType) return false;
    return track.clipIds.every((clipId) => {
      const existing = studio.clips.find((c) => c.id === clipId);
      if (!existing) return true;
      const existingEnd =
        existing.display.to > 0
          ? existing.display.to
          : existing.display.from + existing.duration;
      return displayFrom >= existingEnd || displayTo <= existing.display.from;
    });
  });
}

interface SceneInput {
  videoUrl: string;
  voiceover?: { audioUrl: string } | null;
}

interface AddSceneOptions {
  startTime: number;
  videoTrackId?: string;
  audioTrackId?: string;
}

interface AddSceneResult {
  endTime: number;
  videoTrackId?: string;
  audioTrackId?: string;
}

/**
 * Add a single scene (video + optional audio) to the studio timeline.
 * Returns the end time and track IDs used, for chaining in batch operations.
 */
export async function addSceneToTimeline(
  studio: Studio,
  scene: SceneInput,
  options: AddSceneOptions
): Promise<AddSceneResult> {
  const { startTime, videoTrackId, audioTrackId } = options;
  const canvasWidth = studio.opts.width;
  const canvasHeight = studio.opts.height;

  const videoClip = await Video.fromUrl(scene.videoUrl);
  await videoClip.scaleToFit(canvasWidth, canvasHeight);
  videoClip.centerInScene(canvasWidth, canvasHeight);

  let endTime: number;
  let usedVideoTrackId = videoTrackId;
  let usedAudioTrackId = audioTrackId;

  if (scene.voiceover?.audioUrl) {
    const audioClip = await Audio.fromUrl(scene.voiceover.audioUrl);
    const audioDuration = audioClip.duration;

    // Trim video to match voiceover duration
    videoClip.trim.to = audioDuration;
    videoClip.duration = audioDuration / videoClip.playbackRate;

    videoClip.display.from = startTime;
    videoClip.display.to = startTime + videoClip.duration;

    audioClip.display.from = startTime;
    audioClip.display.to = startTime + audioClip.duration;

    endTime = startTime + videoClip.duration;

    await studio.addClip(videoClip, { trackId: usedVideoTrackId });
    await studio.addClip(audioClip, {
      trackId: usedAudioTrackId,
      audioSource: scene.voiceover.audioUrl,
    });

    // Capture the actual track IDs that were used/created
    if (!usedVideoTrackId) {
      const vTrack = studio.tracks.find(
        (t) => t.type === 'video' && t.clipIds.includes(videoClip.id)
      );
      usedVideoTrackId = vTrack?.id;
    }
    if (!usedAudioTrackId) {
      const aTrack = studio.tracks.find(
        (t) => t.type === 'audio' && t.clipIds.includes(audioClip.id)
      );
      usedAudioTrackId = aTrack?.id;
    }
  } else {
    videoClip.display.from = startTime;
    videoClip.display.to = startTime + videoClip.duration;
    endTime = startTime + videoClip.duration;

    await studio.addClip(videoClip, { trackId: usedVideoTrackId });

    if (!usedVideoTrackId) {
      const vTrack = studio.tracks.find(
        (t) => t.type === 'video' && t.clipIds.includes(videoClip.id)
      );
      usedVideoTrackId = vTrack?.id;
    }
  }

  return {
    endTime,
    videoTrackId: usedVideoTrackId,
    audioTrackId: usedAudioTrackId,
  };
}
