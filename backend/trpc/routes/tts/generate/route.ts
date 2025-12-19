import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const ttsGenerateSchema = z.object({
  text: z.string().max(3000, "Text too long for TTS (max 3000 chars)"),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("alloy"),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
});

function sanitizeText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>{}\[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default publicProcedure
  .input(ttsGenerateSchema)
  .mutation(async ({ input }) => {
    const sanitizedText = sanitizeText(input.text);
    console.log("[Backend TTS] Generating audio, original length:", input.text.length, "sanitized:", sanitizedText.length);
    
    if (!sanitizedText || sanitizedText.length < 10) {
      throw new Error("Text too short or invalid after sanitization");
    }

    try {
      const apiKey = (process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").toString().trim();
      
      if (!apiKey || apiKey === "undefined" || apiKey === "") {
        console.error("[Backend TTS] OpenAI API key not configured");
        throw new Error("OpenAI API key not configured");
      }

      const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "tts-1",
          input: sanitizedText,
          voice: input.voice,
          speed: input.speed,
        }),
      });

      console.log("[Backend TTS] OpenAI API response status:", ttsResponse.status);

      if (!ttsResponse.ok) {
        let errorText = "Unknown error";
        try {
          const contentType = ttsResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await ttsResponse.json();
            errorText = JSON.stringify(errorJson);
            console.error("[Backend TTS] OpenAI API error response:", errorJson);
          } else {
            errorText = await ttsResponse.text();
          }
        } catch (parseError) {
          console.error("[Backend TTS] Error parsing API error:", parseError);
        }
        
        if (ttsResponse.status === 403 || errorText.includes("Access Denied")) {
          throw new Error("Access denied. The request may contain invalid characters or be too large. Please try with shorter text.");
        }
        
        throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
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
