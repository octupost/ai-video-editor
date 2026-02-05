import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const baseUrl = process.env.ELEVENLABS_URL;

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: 'ElevenLabs configuration missing' },
        { status: 500 }
      );
    }

    const response = await fetch(`${baseUrl}/v1/voices`, {
      headers: { 'xi-api-key': apiKey },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs voices API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch voices' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const voices = (data.voices ?? []).map(
      (v: { voice_id: string; name: string; preview_url?: string }) => ({
        voice_id: v.voice_id,
        name: v.name,
        preview_url: v.preview_url ?? null,
      })
    );

    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Voices fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
