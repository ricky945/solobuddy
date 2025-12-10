import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

const ttsGenerateSchema = z.object({
  text: z.string(),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("alloy"),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
});

export default publicProcedure
  .input(ttsGenerateSchema)
  .mutation(async ({ input }) => {
    console.log("[Backend TTS] Generating audio, text length:", input.text.length);

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
          input: input.text,
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
