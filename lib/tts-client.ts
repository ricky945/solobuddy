/**
 * TTS Client - Production Ready
 * Uses Supabase Edge Functions for secure API calls
 * Never exposes API keys in client-side code
 */

import { generateTTS as supabaseGenerateTTS } from './supabase-functions';

export async function generateTTS({
  text,
  voice = "alloy",
  speed = 1.0,
}: {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number;
}): Promise<{ success: boolean; audioData: string; mimeType: string }> {
  console.log("[TTS Client] Generating audio via Supabase Edge Function, text length:", text.length);

  try {
    // Use Supabase Edge Function for secure API calls
    const result = await supabaseGenerateTTS({
      text,
      voice,
      speed,
    });

    console.log("[TTS Client] Audio generated successfully");
    return result;
  } catch (error) {
    console.error("[TTS Client] Error:", error);
    throw error;
  }
}
