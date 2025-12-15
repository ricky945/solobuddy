import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { TRPCError } from "@trpc/server";

interface GooglePlaceResult {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  types?: string[];
  primaryTypeDisplayName?: { text: string };
  editorialSummary?: { text: string };
  photos?: {
    name: string;
    widthPx: number;
    heightPx: number;
  }[];
}

interface GooglePlacesResponse {
  places: GooglePlaceResult[];
}

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
    try {
      const apiKey = (
        process.env.GOOGLE_PLACES_API_KEY ||
        process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
        ""
      ).toString().trim();

      console.log("[Landmarks] Discovering landmarks via Google Places:", input);

      if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
        console.error("[Landmarks] Google Places API key not configured");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google Places API key not configured.",
        });
      }

      const includedTypes = input.type === "restaurant" 
        ? ["restaurant", "cafe", "bar"]
        : input.type === "unique"
        ? ["art_gallery", "museum", "park", "shopping_mall", "landmark"]
        : ["tourist_attraction", "museum", "church", "park", "monument", "landmark"];

      const requestBody = {
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: input.latitude,
              longitude: input.longitude,
            },
            radius: input.radius,
          },
        },
        languageCode: "en",
      };

      console.log("[Landmarks] Google Places request:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryTypeDisplayName,places.editorialSummary,places.photos",
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("[Landmarks] Response status:", response.status);

      if (!response.ok) {
        let errorText = "Unknown error";
        try {
          errorText = await response.text();
          console.error("[Landmarks] Google Places error:", errorText);
        } catch (e) {
          console.error("[Landmarks] Failed to read error:", e);
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Google Places error (${response.status}): ${errorText.substring(0, 200)}`,
        });
      }

      const data = (await response.json()) as GooglePlacesResponse;
      console.log("[Landmarks] Found", data.places?.length || 0, "places");

      const landmarks = (data.places || []).map((place) => {
        const category = getCategoryFromTypes(place.types || []);
        const photoUrl = place.photos?.[0]
          ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=800&key=${apiKey}`
          : `https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&fit=crop`;

        return {
          id: place.id,
          name: place.displayName.text,
          description:
            place.editorialSummary?.text ||
            place.primaryTypeDisplayName?.text ||
            `A notable ${category} location`,
          coordinates: {
            latitude: place.location.latitude,
            longitude: place.location.longitude,
          },
          imageUrl: photoUrl,
          category,
          type: input.type,
          createdBy: "google-places",
          createdByName: "Google Places",
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        };
      });

      console.log("[Landmarks] Successfully mapped", landmarks.length, "landmarks");

      return {
        landmarks,
        location: {
          latitude: input.latitude,
          longitude: input.longitude,
        },
        source: "google_places" as const,
      };
    } catch (error: any) {
      console.error("[Landmarks] Error:", error);
      console.error("[Landmarks] Message:", error?.message);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error?.message || "Failed to discover landmarks",
      });
    }
  });

function getCategoryFromTypes(
  types: string[]
): "historical" | "cultural" | "religious" | "museum" | "park" | "monument" | "building" | "natural" {
  if (types.includes("church") || types.includes("mosque") || types.includes("synagogue") || types.includes("hindu_temple")) {
    return "religious";
  }
  if (types.includes("museum") || types.includes("art_gallery")) {
    return "museum";
  }
  if (types.includes("park") || types.includes("national_park")) {
    return "park";
  }
  if (types.includes("monument")) {
    return "monument";
  }
  if (types.includes("natural_feature")) {
    return "natural";
  }
  if (types.includes("tourist_attraction")) {
    return "historical";
  }
  if (types.includes("cultural_center")) {
    return "cultural";
  }
  return "building";
}
