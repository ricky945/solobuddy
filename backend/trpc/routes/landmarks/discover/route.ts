import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { TRPCError } from "@trpc/server";

export default publicProcedure
  .input(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().optional().default(5000),
      type: z.enum(["touristic", "restaurant", "unique"]).optional().default("touristic"),
    })
  )
  .query(async ({ input }) => {
    console.log("[Landmarks] Discovery request:", input);

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || "";

    if (!apiKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Google Places API key not configured",
      });
    }

    const typeMap = {
      touristic: ["tourist_attraction", "museum", "church", "park"],
      restaurant: ["restaurant", "cafe", "bar"],
      unique: ["art_gallery", "museum", "park", "landmark"],
    };

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.editorialSummary",
          },
          body: JSON.stringify({
            includedTypes: typeMap[input.type],
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: { latitude: input.latitude, longitude: input.longitude },
                radius: input.radius,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Landmarks] API error:", response.status, errorText);
        
        if (response.status === 429) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
        }
        if (response.status === 403) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Invalid API key" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Google Places API error" });
      }

      const data = await response.json();
      const places = data.places || [];

      console.log("[Landmarks] Found", places.length, "places");

      const landmarks = places.map((place: any) => ({
        id: place.id,
        name: place.displayName?.text || "Unknown",
        description: place.editorialSummary?.text || "A notable location",
        coordinates: {
          latitude: place.location?.latitude || 0,
          longitude: place.location?.longitude || 0,
        },
        imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
        category: "historical" as const,
        type: input.type,
        createdBy: "system",
        createdByName: "System",
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      }));

      return {
        landmarks,
        location: { latitude: input.latitude, longitude: input.longitude },
        source: "google_places" as const,
      };
    } catch (error: any) {
      console.error("[Landmarks] Error:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "Failed to fetch landmarks",
      });
    }
  });
