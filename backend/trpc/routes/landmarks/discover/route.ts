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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(
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
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      console.log("[Landmarks] Response status:", response.status);

      if (!response.ok) {
        let errorText = "Unknown error";
        let errorDetails = null;
        try {
          const responseText = await response.text();
          try {
            errorDetails = JSON.parse(responseText);
            errorText = errorDetails.error?.message || responseText;
          } catch {
            errorText = responseText;
          }
          console.error("[Landmarks] Google Places error:", errorText);
        } catch (e) {
          console.error("[Landmarks] Failed to read error:", e);
        }

        const errorCode = response.status === 429 ? "TOO_MANY_REQUESTS" : 
                         response.status >= 500 ? "INTERNAL_SERVER_ERROR" :
                         response.status === 403 ? "FORBIDDEN" :
                         "BAD_REQUEST";

        throw new TRPCError({
          code: errorCode,
          message: response.status === 429 
            ? "Rate limit exceeded. Please try again in a moment."
            : response.status >= 500
            ? "Google Places service is temporarily unavailable. Please try again."
            : `Google Places error (${response.status}): ${errorText.substring(0, 150)}`,
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
      console.error("[Landmarks] Caught error:", error);
      
      if (error instanceof TRPCError) {
        console.error("[Landmarks] TRPCError:", error.message);
        throw error;
      }

      let errorMessage = "Failed to discover landmarks. Please try again.";
      
      try {
        if (error?.name === 'AbortError') {
          throw new TRPCError({
            code: "TIMEOUT",
            message: "Request timed out. Please check your connection and try again.",
          });
        }

        if (error && typeof error === 'object') {
          if (typeof error.message === 'string' && error.message) {
            errorMessage = error.message;
          } else if (error.message && typeof error.message === 'object') {
            try {
              errorMessage = JSON.stringify(error.message);
            } catch {
              errorMessage = String(error.message);
            }
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
      } catch (parseError) {
        console.error("[Landmarks] Error parsing error:", parseError);
      }

      console.error("[Landmarks] Final error message:", errorMessage);

      const isNetworkError = 
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('fetch') ||
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT';

      throw new TRPCError({
        code: isNetworkError ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
        message: isNetworkError 
          ? "Network error. Please check your internet connection."
          : errorMessage,
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
