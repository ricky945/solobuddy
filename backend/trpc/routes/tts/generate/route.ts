import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const ttsGenerateSchema = z.object({
  // OpenAI TTS API has a 4096 character limit per request
  // Client should chunk text appropriately (max 3400 chars per chunk recommended)
  text: z.string().max(4000, "Text too long for TTS (max 4000 chars)"),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("alloy"),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
});

function sanitizeText(text: string): string {
  let cleaned = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, '')
    .replace(/[\uFFF0-\uFFFF]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[<>{}[\]\\|`$%&*+=~^#@]/g, '')
    .replace(/["''""]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/(select|insert|update|delete|drop|create|alter|exec|execute|script|union|declare)/gi, '')
    .replace(/[^a-zA-Z0-9\s.,!?;:()'"-]/g, '')
    .replace(/([.,!?;:])\1+/g, '$1')
    .replace(/\.{4,}/g, '...')
    .trim();
  
  // Safety truncation to match OpenAI TTS limit
  // Client should chunk text appropriately - if we're truncating here, there's a bug
  if (cleaned.length > 4000) {
    console.warn(`[Backend TTS] WARNING: Text truncated from ${cleaned.length} to 4000 chars - client should chunk properly`);
    cleaned = cleaned.substring(0, 4000);
  }
  
  return cleaned;
}

export default publicProcedure
  .input(ttsGenerateSchema)
  .mutation(async ({ input }) => {
    const sanitizedText = sanitizeText(input.text);
    console.log("[Backend TTS] Generating audio, original length:", input.text.length, "sanitized:", sanitizedText.length);
    console.log("[Backend TTS] First 100 chars:", sanitizedText.substring(0, 100));
    
    if (!sanitizedText || sanitizedText.length < 10) {
      throw new Error("Text too short or invalid after sanitization");
    }

    try {
      const apiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").toString().trim();
      
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        console.error("[Backend TTS] OpenAI API key not configured");
        console.error("[Backend TTS] Available env keys:", Object.keys(process.env).filter(k => k.includes('OPENAI')));
        throw new Error("OpenAI API key not configured. Please check environment variables.");
      }

      console.log("[Backend TTS] API key length:", apiKey.length, "starts with:", apiKey.substring(0, 7));

      const requestBody = {
        model: "tts-1",
        input: sanitizedText,
        voice: input.voice,
        speed: input.speed,
      };

      console.log("[Backend TTS] Request body:", { ...requestBody, input: `${sanitizedText.substring(0, 50)}...` });

      const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Backend TTS] OpenAI API response status:", ttsResponse.status);

      if (!ttsResponse.ok) {
        let errorText = "Unknown error";
        let errorDetails: any = null;
        
        try {
          const contentType = ttsResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            errorDetails = await ttsResponse.json();
            errorText = JSON.stringify(errorDetails);
            console.error("[Backend TTS] OpenAI API error response:", errorDetails);
          } else {
            errorText = await ttsResponse.text();
            console.error("[Backend TTS] OpenAI API error text:", errorText);
          }
        } catch (parseError) {
          console.error("[Backend TTS] Error parsing API error:", parseError);
        }
        
        if (ttsResponse.status === 401) {
          console.error("[Backend TTS] 401 Unauthorized - Invalid API key");
          throw new Error("Invalid API key. Please check your OpenAI API key configuration.");
        }
        
        if (ttsResponse.status === 403) {
          const errorMsg = errorDetails?.error?.message || errorText;
          console.error("[Backend TTS] 403 Forbidden - Access denied:", errorMsg);
          throw new Error("API access denied. Your OpenAI API key may not have TTS access enabled or may be invalid.");
        }
        
        if (ttsResponse.status === 429) {
          console.error("[Backend TTS] 429 Rate limit exceeded");
          throw new Error("Rate limit exceeded. Please try again in a moment.");
        }

        if (ttsResponse.status === 400) {
          const errorMsg = errorDetails?.error?.message || errorText;
          console.error("[Backend TTS] 400 Bad Request:", errorMsg);
          throw new Error(`Invalid request: ${errorMsg}`);
        }
        
        const errorMsg = errorDetails?.error?.message || errorText;
        console.error("[Backend TTS] HTTP", ttsResponse.status, "error:", errorMsg);
        throw new Error(`TTS API error (${ttsResponse.status}): ${errorMsg}`);
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      console.log("[Backend TTS] Audio generated successfully, size:", audioBuffer.byteLength, "bytes");

      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      
      return {
        success: true,
        audioData: base64Audio,
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      console.error("[Backend TTS] Error:", error);
      throw error;
    }
  });
