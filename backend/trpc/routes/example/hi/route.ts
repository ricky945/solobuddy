import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export default publicProcedure
  .input(z.object({ name: z.string() }))
  .mutation(({ input }) => {
    return {
      hello: input.name,
      date: new Date(),
    };
  });

export const testOpenAIKey = publicProcedure
  .query(async () => {
    const apiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").toString().trim();
    
    console.log("[API Key Test] Starting test...");
    console.log("[API Key Test] Key exists:", !!apiKey);
    console.log("[API Key Test] Key length:", apiKey.length);
    console.log("[API Key Test] Key prefix:", apiKey.substring(0, 10));
    
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      return {
        success: false,
        error: "API key not configured",
        details: "EXPO_PUBLIC_OPENAI_API_KEY is missing or empty"
      };
    }
    
    try {
      console.log("[API Key Test] Testing with OpenAI API...");
      
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });
      
      console.log("[API Key Test] Response status:", response.status);
      
      if (!response.ok) {
        let errorDetails = "Unknown error";
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await response.json();
            errorDetails = JSON.stringify(errorJson, null, 2);
            console.error("[API Key Test] Error response:", errorJson);
          } else {
            errorDetails = await response.text();
          }
        } catch (parseError) {
          console.error("[API Key Test] Error parsing response:", parseError);
        }
        
        return {
          success: false,
          error: `API returned status ${response.status}`,
          details: errorDetails,
          status: response.status
        };
      }
      
      const data = await response.json();
      console.log("[API Key Test] Success! Available models:", data.data?.length || 0);
      
      return {
        success: true,
        message: "API key is valid and working!",
        modelsCount: data.data?.length || 0,
        sampleModels: data.data?.slice(0, 3).map((m: any) => m.id) || []
      };
    } catch (error: any) {
      console.error("[API Key Test] Test failed:", error);
      return {
        success: false,
        error: "Network or API error",
        details: error.message
      };
    }
  });
