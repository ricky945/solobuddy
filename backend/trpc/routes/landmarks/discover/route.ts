import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";
import { TRPCError } from "@trpc/server";

export default publicProcedure
  .input(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      radius: z.number().optional().default(10000),  // 10km radius for better coverage
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

    // Define what types to fetch from Google Places
    const typeMap = {
      touristic: [
        "tourist_attraction",
        "museum",
        "art_gallery",
        "historical_landmark",
        "monument",
        "cultural_center",
        "performing_arts_theater",
        "church",  // Includes historic churches like San Agustin
        "park"     // Includes state parks, we'll filter small ones
      ],
      restaurant: ["restaurant", "cafe", "bar"],
      unique: ["art_gallery", "museum", "historical_landmark"],
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
        console.error("[Landmarks] Google Places API error:", response.status, errorText);
        
        throw new TRPCError({ 
          code: "INTERNAL_SERVER_ERROR", 
          message: `Google Places API error: ${response.status}` 
        });
      }

      const data = await response.json();
      const places = data.places || [];

      console.log(`[Landmarks] Found ${places.length} places from Google Places API`);

      // Smart filtering - keep tourist-worthy landmarks only
      const filteredPlaces = places.filter((place: any) => {
        const name = (place.displayName?.text || "").toLowerCase();
        const types = place.types || [];
        
        // Filter out commercial chains
        const chains = ['walmart', 'target', 'mcdonald', 'burger king', 'subway', 'starbucks', 'cvs', 'walgreens'];
        if (chains.some(chain => name.includes(chain))) {
          return false;
        }

        // For parks: only keep if it's a tourist attraction or significant park
        if (types.includes('park')) {
          const isTouristPark = types.includes('tourist_attraction') || 
                               name.includes('state park') || 
                               name.includes('national park') ||
                               name.includes('historic');
          
          const isSmallPark = name.includes('soccer') || 
                             name.includes('baseball') ||
                             name.includes('basketball') ||
                             name.includes('dog park') ||
                             name.includes('skate') ||
                             name.includes('playground') ||
                             name.includes('community park');
          
          if (!isTouristPark || isSmallPark) {
            return false;
          }
        }

        return true;
      });

      console.log(`[Landmarks] After filtering: ${filteredPlaces.length} landmarks`);

      // Convert to app format
      const landmarks = filteredPlaces.map((place: any) => {
        const photoReference = place.photos?.[0]?.name;
        const imageUrl = photoReference
          ? `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`
          : "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800";

        const description = place.editorialSummary?.text || 
          `Discover this ${place.types?.[0]?.replace(/_/g, ' ') || 'interesting'} location. ${place.rating ? `Rated ${place.rating.toFixed(1)}/5.0.` : ''}`;

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
