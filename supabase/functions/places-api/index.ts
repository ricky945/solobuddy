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

      // Define what types to fetch from Google Places - ONLY historical & tourist attractions
      const typeMap: Record<string, string[]> = {
        touristic: [
          "tourist_attraction",
          "historical_landmark",
        ],
        restaurant: ["restaurant"],
        unique: ["point_of_interest"],
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

      // Strict filtering - ONLY historical landmarks and tourist attractions
      const filteredPlaces = places.filter((place: any) => {
        const name = (place.displayName?.text || "").toLowerCase()
        const types = place.types || []
        
        // Must be a tourist attraction OR historical landmark
        const isTouristAttraction = types.includes('tourist_attraction')
        const isHistoricalLandmark = types.includes('historical_landmark')
        
        if (!isTouristAttraction && !isHistoricalLandmark) {
          return false
        }
        
        // Filter out commercial chains and stores
        const commercialKeywords = [
          'walmart', 'target', 'mcdonald', 'burger king', 'subway', 'starbucks', 
          'cvs', 'walgreens', 'shop', 'mall', 'store', 'market', 'gas station',
          'hotel', 'motel', 'inn', 'lodging'
        ]
        if (commercialKeywords.some(keyword => name.includes(keyword))) {
          return false
        }
        
        // Filter out generic parks unless they're historic/tourist destinations
        if (types.includes('park')) {
          const isSignificantPark = name.includes('national park') || 
                                   name.includes('state park') ||
                                   name.includes('historic') ||
                                   name.includes('memorial')
          
          const isGenericPark = name.includes('community park') ||
                               name.includes('dog park') ||
                               name.includes('playground') ||
                               name.includes('sports')
          
          if (!isSignificantPark || isGenericPark) {
            return false
          }
        }

        return true
      })

      console.log(`[Places API] After strict filtering: ${filteredPlaces.length} historical/tourist landmarks`)

      // Convert to app format
      const landmarks = filteredPlaces.map((place: any) => {
        const photoReference = place.photos?.[0]?.name
        const imageUrl = photoReference
          ? `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`
          : "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800"

        // Better description focused on historical/tourist value
        const types = place.types || []
        let typeLabel = 'landmark'
        if (types.includes('historical_landmark')) typeLabel = 'historical landmark'
        if (types.includes('monument')) typeLabel = 'monument'
        if (types.includes('museum')) typeLabel = 'museum'
        
        const description = place.editorialSummary?.text || 
          `Visit this ${typeLabel}. ${place.rating ? `Rated ${place.rating.toFixed(1)}/5.0.` : ''}`

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
