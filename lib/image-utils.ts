/**
 * Shared utilities for fetching location/city images
 * Prioritizes real images of the actual location over random placeholders
 * 
 * PRODUCTION: Uses Supabase Edge Functions for Google Places API calls
 * This keeps API keys secure on the server side
 */

import { callPlacesApi } from './supabase-functions';

// Cache for images to avoid redundant API calls
const imageCache: Record<string, string> = {};

// Curated list of high-quality city/travel images from Unsplash
// These are actual city, landmark, and travel photos - NOT random
const CITY_TRAVEL_IMAGES = [
  // Cities and skylines
  'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&h=600&fit=crop', // NYC skyline
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop', // Paris Eiffel Tower
  'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop', // London Big Ben
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop', // Tokyo temple
  'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&h=600&fit=crop', // Rome Colosseum
  'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800&h=600&fit=crop', // Barcelona
  'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&h=600&fit=crop', // Paris street
  'https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&h=600&fit=crop', // Sydney Opera
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&h=600&fit=crop', // Rome fountain
  'https://images.unsplash.com/photo-1555109307-f7d9da25c244?w=800&h=600&fit=crop', // San Francisco
  // Landmarks and monuments
  'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800&h=600&fit=crop', // Venice
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop', // Tokyo cityscape
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop', // Dubai
  'https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?w=800&h=600&fit=crop', // London Bridge
  'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=800&h=600&fit=crop', // Amsterdam
  'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&h=600&fit=crop', // Prague
  'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=800&h=600&fit=crop', // Istanbul
  'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&h=600&fit=crop', // Chicago
  'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&h=600&fit=crop', // LA
  'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&h=600&fit=crop', // Germany castle
  // More cities
  'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop', // City aerial
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop', // City night
  'https://images.unsplash.com/photo-1444723121867-7a241cacace9?w=800&h=600&fit=crop', // City bridge
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&h=600&fit=crop', // City street
  'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&h=600&fit=crop', // City architecture
];

/**
 * Get a deterministic hash from a string
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Fetch a photo URL for a location using Google Places API via Supabase Edge Function
 * For landmarks: searches for the exact landmark name
 * For cities: adds context like "city skyline" for better results
 */
export async function fetchLocationImage(
  locationName: string,
  additionalContext?: string
): Promise<string | null> {
  const cacheKey = `google_${locationName}_${additionalContext || ''}`;
  if (imageCache[cacheKey]) {
    console.log("[ImageUtils] Returning cached Google image for:", locationName);
    return imageCache[cacheKey];
  }

  try {
    // Build a search query
    let query = locationName;
    
    if (additionalContext) {
      const isLandmarkSearch = additionalContext.toLowerCase().includes('landmark') || 
                               additionalContext.toLowerCase().includes('monument') ||
                               additionalContext.toLowerCase().includes('museum');
      
      if (!isLandmarkSearch) {
        // For cities, add the context
        query = `${locationName} ${additionalContext}`.trim();
      }
    }
    
    console.log("[ImageUtils] Fetching Google Places image via Edge Function for:", query);
    
    // Use Supabase Edge Function for secure API call
    const result = await callPlacesApi<{
      places?: Array<{
        photos?: Array<{ name: string }>;
        displayName?: { text: string };
      }>;
    }>({
      action: 'textSearch',
      params: {
        query,
      },
    });

    // Handle the response - the edge function may return places or result directly
    const places = result.places || (result as any).results || [];
    const place = places[0];
    
    if (place?.photos?.[0]?.name) {
      // Get photo URL through the edge function
      const photoResult = await callPlacesApi<{ photoUrl: string }>({
        action: 'photoUrl',
        params: {
          photoReference: place.photos[0].name,
          maxWidth: 800,
        },
      });
      
      if (photoResult.photoUrl) {
        imageCache[cacheKey] = photoResult.photoUrl;
        console.log("[ImageUtils] Google Places image found for:", locationName);
        return photoResult.photoUrl;
      }
    }
    
    console.log("[ImageUtils] No Google Places image found for:", locationName);
  } catch (error) {
    console.log("[ImageUtils] Google Places error:", error);
  }

  return null;
}

/**
 * Fetch image from Wikipedia/Wikimedia for a location (free, no API key needed)
 * This provides actual images of the city/landmark
 */
async function fetchWikipediaImage(locationName: string): Promise<string | null> {
  const cacheKey = `wiki_${locationName}`;
  if (imageCache[cacheKey]) {
    console.log("[ImageUtils] Returning cached Wikipedia image for:", locationName);
    return imageCache[cacheKey];
  }

  try {
    // Clean up the location name for Wikipedia search
    let searchTerm = locationName
      .replace(/,.*$/, '') // Remove everything after comma
      .replace(/\s+(tour|guide)$/i, '') // Only remove tour/guide suffixes
      .trim();
    
    searchTerm = searchTerm.replace(/\s+(city|town|village)$/i, '').trim();
    
    console.log("[ImageUtils] Fetching Wikipedia image for:", searchTerm);
    
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'SoloBuddy/1.0 (Audio Tour App)',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      // Prefer thumbnail over original as it's more reliable
      if (data.thumbnail?.source) {
        // Get a larger version
        const largerUrl = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
        imageCache[cacheKey] = largerUrl;
        console.log("[ImageUtils] Wikipedia thumbnail found for:", locationName);
        return largerUrl;
      }
      
      if (data.originalimage?.source) {
        imageCache[cacheKey] = data.originalimage.source;
        console.log("[ImageUtils] Wikipedia original image found for:", locationName);
        return data.originalimage.source;
      }
    }
    
    // If direct lookup fails, try search
    const searchApiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&format=json&origin=*`;
    const searchResponse = await fetch(searchApiUrl);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const firstResult = searchData.query?.search?.[0]?.title;
      
      if (firstResult) {
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult)}`;
        const summaryResponse = await fetch(summaryUrl, {
          headers: {
            'User-Agent': 'SoloBuddy/1.0 (Audio Tour App)',
          },
        });
        
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          if (summaryData.thumbnail?.source) {
            const largerUrl = summaryData.thumbnail.source.replace(/\/\d+px-/, '/800px-');
            imageCache[cacheKey] = largerUrl;
            console.log("[ImageUtils] Wikipedia search image found for:", locationName);
            return largerUrl;
          }
          if (summaryData.originalimage?.source) {
            imageCache[cacheKey] = summaryData.originalimage.source;
            return summaryData.originalimage.source;
          }
        }
      }
    }
    
    console.log("[ImageUtils] No Wikipedia image found for:", locationName);
  } catch (error) {
    console.log("[ImageUtils] Wikipedia API error:", error);
  }

  return null;
}

/**
 * Get a fallback image - tries Wikipedia first for relevant images
 * Only returns a curated city/travel image as absolute last resort
 */
export async function getFallbackImageUrl(locationName: string, context?: string): Promise<string> {
  // Try Wikipedia for a real image of the location
  const wikiImage = await fetchWikipediaImage(locationName);
  if (wikiImage) {
    return wikiImage;
  }
  
  // If Wikipedia fails, try with additional context
  if (context) {
    const wikiImageWithContext = await fetchWikipediaImage(`${locationName} ${context}`);
    if (wikiImageWithContext) {
      return wikiImageWithContext;
    }
  }
  
  // Absolute last resort - use a CURATED city/travel image (not random!)
  return getCityTravelImage(locationName);
}

/**
 * Synchronous fallback for when we can't await
 * Returns a CURATED city/travel image based on location hash (deterministic)
 */
export function getFallbackImageUrlSync(locationName: string, context?: string): string {
  return getCityTravelImage(locationName, context);
}

/**
 * Get a curated city/travel image - these are actual photos of cities, 
 * landmarks, and travel destinations from Unsplash (NOT random images!)
 * Uses a deterministic hash so the same location always gets the same image
 */
function getCityTravelImage(locationName: string, context?: string): string {
  const text = `${locationName} ${context || 'city'}`;
  const hash = hashString(text);
  const idx = hash % CITY_TRAVEL_IMAGES.length;
  return CITY_TRAVEL_IMAGES[idx];
}

/**
 * Public alias for getCityTravelImage
 * Returns a curated, deterministic city/travel image for a location
 */
export function getCuratedCityImage(locationName: string, context?: string): string {
  return getCityTravelImage(locationName, context);
}

/**
 * Get a themed placeholder - curated images that look like landmarks
 * Uses a hash of the context to always return the SAME image for the same input
 * This ensures consistent images across library and audio player
 */
export function getThemedPlaceholder(context?: string): string {
  const text = context || 'city';
  const hash = hashString(text);
  const idx = hash % CITY_TRAVEL_IMAGES.length;
  return CITY_TRAVEL_IMAGES[idx];
}

/**
 * Get an image for a location - tries multiple sources:
 * 1. Google Places API via Supabase Edge Function (best quality, real photos)
 * 2. Wikipedia/Wikimedia (free, real photos of locations)
 * 3. Curated city/travel image (last resort - still actual city photos!)
 */
export async function getLocationImageWithFallback(
  locationName: string,
  context?: string
): Promise<string> {
  // Try Google Places first (via Edge Function)
  const googleImage = await fetchLocationImage(locationName, context);
  if (googleImage) {
    return googleImage;
  }
  
  // Try Wikipedia
  const wikiImage = await fetchWikipediaImage(locationName);
  if (wikiImage) {
    return wikiImage;
  }
  
  // Last resort fallback - still a real city/travel image
  return await getFallbackImageUrl(locationName, context);
}

/**
 * Clear the image cache (useful for testing or memory management)
 */
export function clearImageCache(): void {
  Object.keys(imageCache).forEach(key => delete imageCache[key]);
}
