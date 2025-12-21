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
      unique: ["art_gallery", "museum", "park", "historical_landmark"],
    };

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.editorialSummary,places.photos,places.rating,places.formattedAddress",
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
        console.error("[Landmarks] Google Places API error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        
        let errorMessage = "Google Places API error";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        if (response.status === 429) {
          throw new TRPCError({ 
            code: "TOO_MANY_REQUESTS", 
            message: "Rate limit exceeded. Please try again later." 
          });
        }
        if (response.status === 403) {
          throw new TRPCError({ 
            code: "FORBIDDEN", 
            message: `Google Places API access denied: ${errorMessage}` 
          });
        }
        if (response.status === 400) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `Invalid request: ${errorMessage}` 
          });
        }
        
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: `Google Places API error (${response.status}): ${errorMessage}` 
        });
      }

      const data = await response.json();
      const places = data.places || [];

      console.log("[Landmarks] Found", places.length, "places");

      const landmarks = places.map((place: any) => {
        const photoReference = place.photos?.[0]?.name;
        const imageUrl = photoReference
          ? `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`
          : "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800";

        let description = place.editorialSummary?.text || "";
        
        if (!description) {
          const types = place.types || [];
          const rating = place.rating ? ` Rated ${place.rating.toFixed(1)}/5.0.` : "";
          
          if (types.includes("museum")) {
            description = `A fascinating museum showcasing unique exhibits and cultural artifacts. Perfect for history and art enthusiasts.${rating}`;
          } else if (types.includes("church") || types.includes("place_of_worship")) {
            description = `An architectural marvel with stunning design and rich historical significance. A peaceful place for reflection and cultural appreciation.${rating}`;
          } else if (types.includes("park")) {
            description = `A beautiful outdoor space ideal for relaxation, walking, and enjoying nature. Great for photos and peaceful moments.${rating}`;
          } else if (types.includes("art_gallery")) {
            description = `An inspiring gallery featuring remarkable artworks and exhibitions. A must-visit for art lovers and creative minds.${rating}`;
          } else if (types.includes("tourist_attraction")) {
            description = `A popular destination offering unique experiences and memorable moments. Highly recommended for visitors.${rating}`;
          } else if (types.includes("landmark")) {
            description = `An iconic landmark representing the area's heritage and character. A must-see attraction with photo opportunities.${rating}`;
          } else {
            description = `An interesting location worth exploring. Discover what makes this place special.${rating}`;
          }
        }

        return {
          id: place.id,
          name: place.displayName?.text || "Unknown",
          description,
          coordinates: {
            latitude: place.location?.latitude || 0,
            longitude: place.location?.longitude || 0,
          },
          imageUrl,
          category: "historical" as const,
          type: input.type,
          createdBy: "system",
          createdByName: "System",
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        };
      });

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
