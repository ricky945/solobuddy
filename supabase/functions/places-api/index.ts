import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, params } = await req.json()
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle discoverLandmarks action
    if (action === 'discoverLandmarks') {
      const { latitude, longitude, radius = 10000, type = 'touristic' } = params

      // Define what types to fetch from Google Places
      const typeMap: Record<string, string[]> = {
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
      }

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
            includedTypes: typeMap[type] || typeMap.touristic,
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius,
              },
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Places API] Error:', response.status, errorText)
        return new Response(
          JSON.stringify({ error: `Google Places API error: ${response.status}` }),
          { 
            status: response.status, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const data = await response.json()
      const places = data.places || []

      console.log(`[Places API] Found ${places.length} places from Google Places API`)

      // Smart filtering - keep tourist-worthy landmarks only
      const filteredPlaces = places.filter((place: any) => {
        const name = (place.displayName?.text || "").toLowerCase()
        const types = place.types || []
        
        // Filter out commercial chains
        const chains = ['walmart', 'target', 'mcdonald', 'burger king', 'subway', 'starbucks', 'cvs', 'walgreens']
        if (chains.some(chain => name.includes(chain))) {
          return false
        }

        // For parks: only keep if it's a tourist attraction or significant park
        if (types.includes('park')) {
          const isTouristPark = types.includes('tourist_attraction') || 
                               name.includes('state park') || 
                               name.includes('national park') ||
                               name.includes('historic')
          
          const isSmallPark = name.includes('soccer') || 
                             name.includes('baseball') ||
                             name.includes('basketball') ||
                             name.includes('dog park') ||
                             name.includes('skate') ||
                             name.includes('playground') ||
                             name.includes('community park')
          
          if (!isTouristPark || isSmallPark) {
            return false
          }
        }

        return true
      })

      console.log(`[Places API] After filtering: ${filteredPlaces.length} landmarks`)

      // Convert to app format
      const landmarks = filteredPlaces.map((place: any) => {
        const photoReference = place.photos?.[0]?.name
        const imageUrl = photoReference
          ? `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`
          : "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"

        const description = place.editorialSummary?.text || 
          `Discover this ${place.types?.[0]?.replace(/_/g, ' ') || 'interesting'} location. ${place.rating ? `Rated ${place.rating.toFixed(1)}/5.0.` : ''}`

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
          type,
          createdBy: "system",
          createdByName: "System",
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        }
      })

      return new Response(
        JSON.stringify({
          landmarks,
          location: { latitude, longitude },
          source: "google_places",
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Handle other actions
    return new Response(
      JSON.stringify({ error: 'Action not implemented' }),
      { 
        status: 501, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[Places API] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
