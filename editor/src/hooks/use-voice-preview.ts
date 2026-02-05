'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface VoicePreview {
  voice_id: string;
  name: string;
  preview_url: string | null;
}

export function useVoicePreview() {
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(
    new Map()
  );
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch preview URLs on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchVoices() {
      try {
        const res = await fetch('/api/elevenlabs/voices');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const map = new Map<string, string>();
        for (const voice of data.voices as VoicePreview[]) {
          if (voice.preview_url) {
            map.set(voice.voice_id, voice.preview_url);
          }
        }
        setPreviewUrls(map);
      } catch {
        // Silently fail - preview is optional
      }
    }

    fetchVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoiceId(null);
  }, []);

  const togglePreview = useCallback(
    (voiceId: string) => {
      // If already playing this voice, stop
      if (playingVoiceId === voiceId) {
        stopPreview();
        return;
      }

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const url = previewUrls.get(voiceId);
      if (!url) return;

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingVoiceId(voiceId);

      audio.addEventListener('ended', () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      });

      audio.addEventListener('error', () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      });

      audio.play();
    },
    [playingVoiceId, previewUrls, stopPreview]
  );

  return { previewUrls, playingVoiceId, togglePreview, stopPreview };
}
