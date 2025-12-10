import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { TRPCError } from "@trpc/server";

export default publicProcedure
  .input(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().optional().default(2),
    })
  )
  .query(async ({ input }) => {
    try {
      const apiKey = (process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").toString().trim();

      console.log("[Landmarks] Discovering landmarks at:", input);

      if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
        console.error("[Landmarks] OpenAI API key not configured");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OpenAI API key not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your environment variables.",
        });
      }

      console.log("[Landmarks] Making request to OpenAI...");
      console.log("[Landmarks] API Key present:", !!apiKey, "Length:", apiKey.length);
      
      const requestBody = {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable tour guide assistant. Given a location's coordinates, identify the 10-15 most significant landmarks within the specified radius. Return ONLY a valid JSON array with no additional text or markdown formatting.

Each landmark should include:
- id: unique identifier (use lowercase name with dashes)
- name: landmark name
- description: 2-3 sentence description of the landmark's significance
- coordinates: {latitude, longitude} (as accurate as possible)
- imageUrl: a relevant Unsplash URL (use format: https://images.unsplash.com/photo-[id]?w=800&fit=crop)
- category: one of: historical, cultural, religious, museum, park, monument, building, natural
- type: must be "touristic" (this is an AI-generated landmark)

Return ONLY the JSON array, no other text.`,
          },
          {
            role: "user",
            content: `Find landmarks near coordinates: ${input.latitude}, ${input.longitude} within ${input.radius}km radius. Include major tourist attractions, historical sites, museums, parks, and culturally significant locations.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Landmarks] Response status:", response.status);
      console.log("[Landmarks] Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorText = "Unknown error";
        try {
          errorText = await response.text();
          console.error("[Landmarks] OpenAI API error response:", errorText);
        } catch (e) {
          console.error("[Landmarks] Failed to read error response:", e);
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`,
        });
      }

      const data = await response.json();
      console.log("[Landmarks] OpenAI response received successfully");

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("[Landmarks] No content in OpenAI response:", data);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No content in OpenAI response",
        });
      }

      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      console.log("[Landmarks] Parsing landmarks from cleaned content");
      
      let landmarks;
      try {
        landmarks = JSON.parse(cleanContent);
      } catch (parseError: any) {
        console.error("[Landmarks] JSON parse error:", parseError);
        console.error("[Landmarks] Content was:", cleanContent.substring(0, 500));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to parse OpenAI response: ${parseError.message}`,
        });
      }
      
      if (!Array.isArray(landmarks)) {
        console.error("[Landmarks] Response is not an array:", landmarks);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid landmarks format: expected array",
        });
      }

      console.log("[Landmarks] Successfully discovered", landmarks.length, "landmarks");

      const landmarksWithType = landmarks.map((landmark: any) => ({
        ...landmark,
        type: "touristic" as const,
      }));

      return {
        landmarks: landmarksWithType,
        location: {
          latitude: input.latitude,
          longitude: input.longitude,
        },
      };
    } catch (error: any) {
      console.error("[Landmarks] Error discovering landmarks:", error);
      console.error("[Landmarks] Error message:", error?.message);
      console.error("[Landmarks] Error stack:", error?.stack);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "Failed to discover landmarks",
      });
    }
  });
