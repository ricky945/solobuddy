import { supabase } from './supabase';
import { trpcClient } from './trpc';

/**
 * Supabase Edge Functions client
 * These functions call your Supabase Edge Functions securely
 * Replaces the local Hono/tRPC backend
 */

// Helper function to convert string to proper title case
const toTitleCase = (str: string): string => {
  if (!str) return str;
  const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'of', 'in', 'with'];
  
  let afterColon = false;
  return str
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      const startsNewPhrase = index === 0 || afterColon;
      afterColon = word.endsWith(':');
      const lowerWord = word.toLowerCase();
      if (startsNewPhrase || !minorWords.includes(lowerWord)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return lowerWord;
    })
    .join(' ');
};

type MessageContent = string | Array<{ type: string; text?: string; image?: string }>;

type GenerateTextRequest = {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: MessageContent;
  }>;
};

type GenerateTTSRequest = {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number;
};

type GenerateTTSResponse = {
  success: boolean;
  audioData: string;
  mimeType: string;
};

type PlacesApiRequest = {
  action: 'nearbySearch' | 'placeDetails' | 'textSearch' | 'photoUrl' | 'autocomplete' | 'discoverLandmarks';
  params: Record<string, any>;
};

type LandmarkType = 'touristic' | 'restaurant' | 'unique';

export type DiscoveredLandmark = {
  id: string;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  imageUrl: string;
  category: 'historical';
  type: LandmarkType;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  upvotes: number;
  upvotedBy: string[];
  reviews: any[];
};

type DiscoverLandmarksResponse = {
  landmarks: DiscoveredLandmark[];
  location: { latitude: number; longitude: number };
  source: 'google_places';
};

/**
 * Generate text using OpenAI via Edge Function
 * Compatible with @rork-ai/toolkit-sdk interface
 */
export async function generateText(request: GenerateTextRequest): Promise<string> {
  console.log('[SupabaseFunctions] Calling generate-text...');
  
  const { data, error } = await supabase.functions.invoke('generate-text', {
    body: request,
  });

  if (error) {
    console.error('[SupabaseFunctions] generate-text error:', error);
    throw new Error(error.message || 'Text generation failed');
  }

  if (!data?.completion) {
    throw new Error('Empty response from AI');
  }

  console.log('[SupabaseFunctions] generate-text success, length:', data.completion.length);
  return data.completion;
}

/**
 * Generate a complete audio tour with proper length
 * OPTIMIZED: Parallel generation for speed + reliability
 */
export async function generateLongFormScript(params: {
  location: string;
  topics: string[];
  durationMinutes: number;
  tourType: 'immersive' | 'landmark' | 'route';
  additionalContext?: string;
  locationCoords?: { latitude: number; longitude: number };
}): Promise<{
  title: string;
  description: string;
  script: string;
  chapters: Array<{ title: string; timestamp: number; duration: number }>;
  landmarks?: Array<{
    name: string;
    description: string;
    coordinates: { latitude: number; longitude: number };
    timestamp: number;
  }>;
}> {
  const { location, topics, durationMinutes } = params;
  const cityName = location.split(',')[0].trim();
  
  // Actual requirement: 150 words = 1 minute of speech
  const actualWordsNeeded = durationMinutes * 150;
  
  // Request just what we need - expansion loop will fill gaps
  const targetWords = actualWordsNeeded;
  
  // Divide equally among topics
  const wordsPerTopic = Math.floor(targetWords / topics.length);
  
  // Define acceptable range: 95-110% of actual needed
  const minAcceptableWords = Math.floor(actualWordsNeeded * 0.95);
  const maxAcceptableWords = Math.floor(actualWordsNeeded * 1.10);
  
  console.log(`[LongFormScript] Generating ${durationMinutes} min tour for ${cityName}`);
  console.log(`[LongFormScript] Target: ${actualWordsNeeded} words | Range: ${minAcceptableWords}-${maxAcceptableWords} words (${wordsPerTopic} per topic)`);
  
  const startTime = Date.now();
  let title = `Discovering ${cityName}`;
  let description = `A ${durationMinutes}-minute audio journey through ${cityName}, exploring ${topics.join(' and ')}.`;
  
  // Build prompts
  const prompts = topics.map((topic, i) => {
    const isFirst = i === 0;
    const isLast = i === topics.length - 1;
    
    const minutes = Math.round(wordsPerTopic / 150);
    
    return `Write ${wordsPerTopic} words of audio tour narration about ${topic} in ${cityName}.

CRITICAL: Write ONLY the narration text - no JSON, no formatting, no structure labels.
TARGET: ${wordsPerTopic} words minimum.

${isFirst ? `Line 1: Title like "Discovering ${cityName}"
Line 2 onwards: Start "Welcome to ${cityName}..." and introduce the city.` : `Continue from ${topics[i-1]}.`}

Include ${wordsPerTopic} words covering:
• 8-10 detailed stories, facts, anecdotes about ${topic}
• Specific names, dates, places, events
• Vivid sensory descriptions
• Local legends, traditions, culture
• Historical context mixed with modern life
• Warm tour guide voice
${isLast ? '• Memorable conclusion thanking listeners' : `• Smooth transition to ${topics[i+1]}`}

Write ${wordsPerTopic} words of pure narration text now (no JSON):`;
  });
  
  console.log(`[LongFormScript] Launching ${topics.length} parallel API calls...`);
  
  // Helper to clean AI response
  const cleanResponse = (text: string): string => {
    let cleaned = text;
    
    // If AI returned JSON, extract the narration
    if (cleaned.includes('"narration"') || cleaned.includes('"text"') || cleaned.includes('"content"')) {
      try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          cleaned = parsed.narration || parsed.text || parsed.content || cleaned;
        }
      } catch (e) {
        const narrationMatch = cleaned.match(/"(?:narration|text|content)":\s*"([^"]+)"/);
        if (narrationMatch) {
          cleaned = narrationMatch[1];
        }
      }
    }
    
    // Clean up formatting
    return cleaned
      .replace(/^```[a-z]*\n/gm, '')
      .replace(/^```$/gm, '')
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/^#{1,6}\s+(.*)$/gm, '$1')
      .replace(/^\*\*(.*)\*\*$/gm, '$1')
      .trim();
  };

  // Generate sections with expansion loop if needed
  const sectionPromises = prompts.map(async (prompt, i) => {
    let cleaned = cleanResponse(await generateText({ messages: [{ role: 'user', content: prompt }] }));
    let words = cleaned.split(/\s+/).filter(w => w.length > 0).length;
    
    console.log(`[LongFormScript] ${topics[i]}: ${words}/${wordsPerTopic} words (${Math.round(words/wordsPerTopic*100)}%)`);
    
    // EXPANSION LOOP: Add content until we hit 95-110% of target per topic
    let expansionRound = 0;
    const maxExpansions = 3;
    const minThreshold = Math.floor(wordsPerTopic * 0.95); // Must hit at least 95%
    const maxThreshold = Math.floor(wordsPerTopic * 1.10); // Stop if we hit 110%
    
    while (words < minThreshold && expansionRound < maxExpansions && words < maxThreshold) {
      expansionRound++;
      const needed = Math.floor((minThreshold - words) * 1.2); // Ask for 120% of what's missing to reach min
      
      console.log(`[LongFormScript] ${topics[i]} expansion ${expansionRound}: need ~${needed} more words`);
      
      const expansionPrompt = `Continue the audio tour narration about ${topics[i]} in ${cityName}.

CURRENT CONTENT (${words} words):
${cleaned.slice(-400)}...

Add approximately ${needed} more words continuing this narration. Include:
• 2-3 more detailed stories about ${topics[i]}
• Additional historical facts and context
• More vivid descriptions

Write ${needed} words of narration (plain text, no JSON):`;

      const expansion = cleanResponse(await generateText({ messages: [{ role: 'user', content: expansionPrompt }] }));
      cleaned = cleaned + '\n\n' + expansion;
      words = cleaned.split(/\s+/).filter(w => w.length > 0).length;
      
      console.log(`[LongFormScript] ${topics[i]} after expansion ${expansionRound}: ${words} words (${Math.round(words/wordsPerTopic*100)}%)`);
      
      // Stop if we've exceeded the max threshold
      if (words >= maxThreshold) {
        console.log(`[LongFormScript] ${topics[i]} hit max threshold, stopping expansion`);
        break;
      }
    }
    
    if (words === 0) {
      console.error(`[LongFormScript] ERROR: ${topics[i]} returned 0 words!`);
    }
    
    return { index: i, text: cleaned };
  });
  
  const results = await Promise.all(sectionPromises);
  
  // Sort and extract
  results.sort((a, b) => a.index - b.index);
  const sections = results.map(r => r.text);
  
  // Extract title from first section (more carefully)
  const firstLines = sections[0].split('\n').filter(line => line.trim().length > 0);
  if (firstLines.length > 0) {
    const potentialTitle = firstLines[0].trim();
    // Check if first line looks like a title (short, no periods in middle, not a full sentence)
    const wordCount = potentialTitle.split(/\s+/).length;
    if (wordCount <= 8 && !potentialTitle.match(/\.\s+\w/) && potentialTitle.length < 100) {
      title = potentialTitle.replace(/^["'#*]+|["'#*]+$/g, '').replace(/^title:\s*/i, '').trim();
      sections[0] = firstLines.slice(1).join('\n').trim();
    }
  }
  
  const fullScript = sections.join('\n\n');
  const duration = Date.now() - startTime;
  const wordCount = fullScript.split(/\s+/).filter((w: string) => w.length > 0).length;
  const estimatedMinutes = Math.round(wordCount / 150);
  
  console.log(`[LongFormScript] Complete in ${duration}ms`);
  console.log(`[LongFormScript] Requested: ${targetWords} words | Received: ${wordCount} words (${Math.round(wordCount/targetWords*100)}%)`);
  console.log(`[LongFormScript] Target duration: ${durationMinutes} min | Actual: ~${estimatedMinutes} min`);
  
  // Build chapters
  const chaptersWithTimestamps: Array<{ title: string; timestamp: number; duration: number }> = [];
  const chapterDuration = Math.round((durationMinutes * 60) / topics.length);
  
  for (let i = 0; i < topics.length; i++) {
    chaptersWithTimestamps.push({
      title: toTitleCase(topics[i]),
      timestamp: i * chapterDuration,
      duration: chapterDuration,
    });
  }
  
  if (!title || title === cityName || title.length < 5) {
    title = `Discovering ${cityName}`;
  }
  
  // Generate landmarks for route tours
  let landmarks: Array<{
    name: string;
    description: string;
    coordinates: { latitude: number; longitude: number };
    timestamp: number;
  }> | undefined;
  
  if (params.tourType === 'route') {
    console.log('[LongFormScript] Generating landmarks for route tour...');
    const numLandmarks = Math.floor(durationMinutes / 5); // ~1 landmark per 5 minutes
    const maxLandmarks = Math.min(Math.max(numLandmarks, 4), 10);
    
    const landmarkPrompt = `You are creating a walking/transit route tour of ${cityName}.

Generate a JSON array of ${maxLandmarks} real, specific landmarks or points of interest in ${cityName} that form a logical walking route.

REQUIREMENTS:
- Each landmark must be a real, specific place (e.g., "Lincoln Center", "Central Park")
- Include accurate GPS coordinates
- Keep landmarks in a walkable cluster (don't jump across the city)
- Order them in a logical route sequence
${params.locationCoords ? `- Start near: ${params.locationCoords.latitude}, ${params.locationCoords.longitude}` : ''}
- Focus on topics: ${topics.join(', ')}

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "name": "Landmark Name",
    "description": "Brief 1-2 sentence description of what makes this place special",
    "latitude": 0.000000,
    "longitude": 0.000000
  }
]

Generate ${maxLandmarks} landmarks now:`;

    try {
      const landmarkResponse = await generateText({ messages: [{ role: 'user', content: landmarkPrompt }] });
      
      // Clean and parse response
      let cleanedResponse = landmarkResponse.trim();
      
      // Remove markdown code fences if present
      cleanedResponse = cleanedResponse.replace(/^```json?\n?/gm, '').replace(/^```\n?/gm, '');
      
      // Try to extract JSON array
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedLandmarks = JSON.parse(jsonMatch[0]);
        
        if (Array.isArray(parsedLandmarks) && parsedLandmarks.length > 0) {
          // Calculate timestamps evenly across the tour duration
          const timePerLandmark = (durationMinutes * 60) / parsedLandmarks.length;
          
          landmarks = parsedLandmarks.map((lm: any, idx: number) => ({
            name: lm.name || `Stop ${idx + 1}`,
            description: lm.description || '',
            coordinates: {
              latitude: typeof lm.latitude === 'number' ? lm.latitude : (params.locationCoords?.latitude || 0),
              longitude: typeof lm.longitude === 'number' ? lm.longitude : (params.locationCoords?.longitude || 0),
            },
            timestamp: Math.floor(idx * timePerLandmark),
          }));
          
          console.log(`[LongFormScript] Generated ${landmarks.length} landmarks`);
        }
      }
    } catch (error) {
      console.error('[LongFormScript] Failed to generate landmarks:', error);
      // Continue without landmarks - tour will still work
    }
  }
  
  return {
    title: toTitleCase(title),
    description,
    script: fullScript,
    chapters: chaptersWithTimestamps,
    ...(landmarks && { landmarks }),
  };
}

/**
 * Generate TTS audio using OpenAI via Edge Function
 * Returns format compatible with local backend's tts.generate
 */
export async function generateTTS(request: GenerateTTSRequest): Promise<GenerateTTSResponse> {
  console.log('[SupabaseFunctions] Calling generate-tts...', { textLength: request.text.length });
  
  const { data, error } = await supabase.functions.invoke('generate-tts', {
    body: {
      text: request.text,
      voice: request.voice || 'alloy',
    },
  });

  if (error) {
    // Try to get more details from the error
    let errorDetails = '';
    try {
      if (error.context) {
        const response = error.context as Response;
        if (response && typeof response.text === 'function') {
          errorDetails = await response.text();
        } else if (response && response.status) {
          errorDetails = `Status: ${response.status}`;
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
    console.error('[SupabaseFunctions] generate-tts error:', {
      message: error.message,
      name: error.name,
      details: errorDetails,
    });
    throw new Error(errorDetails || error.message || 'TTS generation failed');
  }

  // Check if the response contains an error message
  if (data?.error) {
    console.error('[SupabaseFunctions] generate-tts returned error:', data.error);
    throw new Error(data.error);
  }

  if (!data?.audio) {
    console.error('[SupabaseFunctions] generate-tts no audio data:', data);
    throw new Error('No audio data received');
  }

  console.log('[SupabaseFunctions] generate-tts success, size:', data.size);
  
  // Convert Supabase response format to local backend format
  return {
    success: true,
    audioData: data.audio,
    mimeType: 'audio/mpeg',
  };
}

/**
 * Call Google Places API via Edge Function
 */
export async function callPlacesApi<T = any>(request: PlacesApiRequest): Promise<T> {
  console.log('[SupabaseFunctions] Calling places-api:', request.action);
  
  const { data, error } = await supabase.functions.invoke('places-api', {
    body: request,
  });

  if (error) {
    console.error('[SupabaseFunctions] places-api error:', error);
    throw new Error(error.message || 'Places API request failed');
  }

  console.log('[SupabaseFunctions] places-api success');
  return data as T;
}

/**
 * Discover landmarks using Google Places API via Edge Function
 * Replaces trpc.landmarks.discover
 * Falls back to empty results if the API fails
 */
// Mock landmarks for development when API is not available
function getMockLandmarks(latitude: number, longitude: number): DiscoverLandmarksResponse {
  // San Francisco area landmarks (if near SF)
  const isSanFrancisco = Math.abs(latitude - 37.7749) < 0.1 && Math.abs(longitude - (-122.4194)) < 0.1;
  
  if (isSanFrancisco) {
    return {
      landmarks: [
        {
          id: 'mock_golden_gate',
          name: 'Golden Gate Bridge',
          description: 'Iconic suspension bridge spanning the Golden Gate strait. A symbol of San Francisco and one of the most photographed bridges in the world.',
          coordinates: { latitude: 37.8199, longitude: -122.4783 },
          imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_alcatraz',
          name: 'Alcatraz Island',
          description: 'Historic federal penitentiary turned national park. Once home to notorious criminals like Al Capone and Machine Gun Kelly.',
          coordinates: { latitude: 37.8267, longitude: -122.4230 },
          imageUrl: 'https://images.unsplash.com/photo-1611212166534-cea2fd6ece01?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_coit_tower',
          name: 'Coit Tower',
          description: 'Historic Art Deco tower offering panoramic views of San Francisco and the bay. Built in 1933.',
          coordinates: { latitude: 37.8024, longitude: -122.4058 },
          imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_palace_fine_arts',
          name: 'Palace of Fine Arts',
          description: 'Monumental structure built for the 1915 Panama-Pacific Exposition. Beautiful example of Greco-Roman architecture.',
          coordinates: { latitude: 37.8029, longitude: -122.4486 },
          imageUrl: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_ferry_building',
          name: 'Ferry Building',
          description: 'Historic terminal and marketplace built in 1898. Famous for its 245-foot clock tower modeled after the Giralda bell tower in Seville.',
          coordinates: { latitude: 37.7956, longitude: -122.3933 },
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_painted_ladies',
          name: 'Painted Ladies',
          description: 'Row of colorful Victorian houses built between 1892 and 1896. One of the most iconic views of San Francisco.',
          coordinates: { latitude: 37.7762, longitude: -122.4330 },
          imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_lombard_street',
          name: 'Lombard Street',
          description: 'The "crookedest street in the world" with eight hairpin turns. Built in the 1920s to reduce the hill\'s natural steep grade.',
          coordinates: { latitude: 37.8021, longitude: -122.4187 },
          imageUrl: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_fishermans_wharf',
          name: "Fisherman's Wharf",
          description: 'Historic waterfront neighborhood and popular tourist attraction. Home to seafood restaurants, sea lions at Pier 39, and historic ships.',
          coordinates: { latitude: 37.8080, longitude: -122.4177 },
          imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_chinatown_gate',
          name: 'Chinatown Dragon Gate',
          description: 'Iconic gateway to the oldest Chinatown in North America, established in the 1840s. The gate was built in 1970.',
          coordinates: { latitude: 37.7908, longitude: -122.4056 },
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_cable_car_museum',
          name: 'Cable Car Museum',
          description: 'Working museum displaying the city\'s historic cable car system. Houses the powerhouse and machinery that drives the entire cable car system.',
          coordinates: { latitude: 37.7946, longitude: -122.4115 },
          imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_transamerica_pyramid',
          name: 'Transamerica Pyramid',
          description: 'Iconic 48-story skyscraper completed in 1972. The second-tallest building in San Francisco skyline.',
          coordinates: { latitude: 37.7952, longitude: -122.4028 },
          imageUrl: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_city_hall',
          name: 'San Francisco City Hall',
          description: 'Beaux-Arts style building completed in 1915. Its dome is taller than the US Capitol and is a masterpiece of civic architecture.',
          coordinates: { latitude: 37.7790, longitude: -122.4195 },
          imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_mission_dolores',
          name: 'Mission San Francisco de Asís',
          description: 'Oldest surviving structure in San Francisco, founded in 1776. Also known as Mission Dolores.',
          coordinates: { latitude: 37.7637, longitude: -122.4262 },
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_presidio',
          name: 'The Presidio',
          description: 'Former military post dating back to 1776, now a national park. Rich in history from Spanish colonial times through World Wars.',
          coordinates: { latitude: 37.7989, longitude: -122.4662 },
          imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_exploratorium',
          name: 'Exploratorium',
          description: 'Museum of science, technology, and arts founded in 1969. Located at historic Pier 15 on the Embarcadero.',
          coordinates: { latitude: 37.8013, longitude: -122.3975 },
          imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_lands_end',
          name: "Land's End",
          description: 'Rugged coastal trail with spectacular views of the Golden Gate Bridge. Home to the historic Sutro Baths ruins.',
          coordinates: { latitude: 37.7857, longitude: -122.5085 },
          imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_twin_peaks',
          name: 'Twin Peaks',
          description: 'Two prominent hills with 360-degree views of San Francisco. Offers one of the best panoramic viewpoints in the city.',
          coordinates: { latitude: 37.7544, longitude: -122.4477 },
          imageUrl: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_fort_point',
          name: 'Fort Point',
          description: 'Historic fort completed in 1861, located directly beneath the Golden Gate Bridge. Played key defensive role during Civil War.',
          coordinates: { latitude: 37.8107, longitude: -122.4770 },
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_japanese_tea_garden',
          name: 'Japanese Tea Garden',
          description: 'Oldest public Japanese garden in the United States, created in 1894 for the California Midwinter International Exposition.',
          coordinates: { latitude: 37.7701, longitude: -122.4701 },
          imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
        {
          id: 'mock_haight_ashbury',
          name: 'Haight-Ashbury',
          description: 'Historic neighborhood and birthplace of the 1960s counterculture movement. Famous for its Victorian houses and Summer of Love history.',
          coordinates: { latitude: 37.7692, longitude: -122.4481 },
          imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
          category: 'historical',
          type: 'touristic',
          createdBy: 'system',
          createdByName: 'System',
          createdAt: Date.now(),
          upvotes: 0,
          upvotedBy: [],
          reviews: [],
        },
      ],
      location: { latitude, longitude },
      source: 'google_places',
    };
  }
  
  // Generic landmarks for other locations
  return {
    landmarks: [
      {
        id: 'mock_landmark_1',
        name: 'Historic Downtown Square',
        description: 'Historic central square featuring beautiful architecture and rich local history.',
        coordinates: { latitude: latitude + 0.01, longitude: longitude + 0.01 },
        imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
      {
        id: 'mock_landmark_2',
        name: 'City Hall Historic Building',
        description: 'Landmark government building showcasing impressive architecture and civic history.',
        coordinates: { latitude: latitude - 0.01, longitude: longitude - 0.01 },
        imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
      {
        id: 'mock_landmark_3',
        name: 'Historic Memorial Park',
        description: 'Beautiful park with monuments commemorating important local history.',
        coordinates: { latitude: latitude + 0.005, longitude: longitude - 0.005 },
        imageUrl: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
      {
        id: 'mock_landmark_4',
        name: 'Old Town Historic District',
        description: 'Preserved historic district featuring original buildings and cultural heritage.',
        coordinates: { latitude: latitude - 0.008, longitude: longitude + 0.008 },
        imageUrl: 'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
      {
        id: 'mock_landmark_5',
        name: 'Veterans Memorial',
        description: 'Monument honoring local veterans with historical significance and beautiful grounds.',
        coordinates: { latitude: latitude + 0.012, longitude: longitude + 0.003 },
        imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
      {
        id: 'mock_landmark_6',
        name: 'Historic Train Station',
        description: 'Beautifully restored train station showcasing architectural heritage from the golden age of rail travel.',
        coordinates: { latitude: latitude - 0.006, longitude: longitude - 0.009 },
        imageUrl: 'https://images.unsplash.com/photo-1564407983879-8ad0eed472b9?w=800',
        category: 'historical',
        type: 'touristic',
        createdBy: 'system',
        createdByName: 'System',
        createdAt: Date.now(),
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      },
    ],
    location: { latitude, longitude },
    source: 'google_places',
  };
}

/**
 * Discover landmarks using Google Places API
 * @param params.radius - Search radius in METERS (Google API requirement)
 */
export async function discoverLandmarks(params: {
  latitude: number;
  longitude: number;
  radius?: number; // in meters (for Google Places API)
  type?: LandmarkType;
}): Promise<DiscoverLandmarksResponse> {
  console.log('[SupabaseFunctions] Discovering landmarks (radius in meters)...', params);
  
  try {
    const { data, error } = await supabase.functions.invoke('places-api', {
      body: {
        action: 'discoverLandmarks',
        params: {
          latitude: params.latitude,
          longitude: params.longitude,
          radius: params.radius || 5000,
          type: params.type || 'touristic',
        },
      },
    });

    if (error) {
      console.warn('[SupabaseFunctions] Supabase edge function error:', error.message);
      console.log('[SupabaseFunctions] Using mock data for development...');
      return getMockLandmarks(params.latitude, params.longitude);
    }

    // Check if data contains an error from the edge function
    if (data?.error) {
      console.warn('[SupabaseFunctions] Edge function returned error:', data.error);
      console.log('[SupabaseFunctions] Using mock data for development...');
      return getMockLandmarks(params.latitude, params.longitude);
    }

    console.log('[SupabaseFunctions] discoverLandmarks success, count:', data?.landmarks?.length || 0);
    return data as DiscoverLandmarksResponse;
  } catch (err) {
    console.error('[SupabaseFunctions] discoverLandmarks unexpected error:', err);
    // Return empty results on any error
    return {
      landmarks: [],
      location: { latitude: params.latitude, longitude: params.longitude },
      source: 'google_places',
    };
  }
}

// Convenience functions for common Places API operations
export async function nearbySearch(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  type?: string;
}) {
  return callPlacesApi({
    action: 'nearbySearch',
    params,
  });
}

export async function getPlaceDetails(placeId: string, fields?: string) {
  return callPlacesApi({
    action: 'placeDetails',
    params: { placeId, fields },
  });
}

export async function textSearch(params: {
  query: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}) {
  return callPlacesApi({
    action: 'textSearch',
    params,
  });
}

export async function getPlacePhotoUrl(photoReference: string, maxWidth?: number) {
  const result = await callPlacesApi<{ photoUrl: string }>({
    action: 'photoUrl',
    params: { photoReference, maxWidth },
  });
  return result.photoUrl;
}

export async function autocomplete(params: {
  input: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}) {
  return callPlacesApi({
    action: 'autocomplete',
    params,
  });
}

/**
 * Upload an image to Supabase Storage
 * Returns the public URL of the uploaded image
 * Works in React Native by reading file as base64 using expo-file-system
 */
export async function uploadImage(
  imageUri: string,
  bucket: string = 'landmark-images'
): Promise<string> {
  console.log('[SupabaseFunctions] Uploading image...');
  
  try {
    // Import legacy FileSystem API (for SDK 54+ compatibility)
    const FileSystem = await import('expo-file-system/legacy');
    
    // Read file as base64 (React Native compatible)
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Determine content type from extension
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 
                        fileExt === 'gif' ? 'image/gif' : 
                        fileExt === 'webp' ? 'image/webp' : 'image/jpeg';
    
    // Generate a unique filename
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;
    
    // Convert base64 to Uint8Array for upload
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('[SupabaseFunctions] Upload error:', error);
      throw new Error(error.message || 'Failed to upload image');
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    console.log('[SupabaseFunctions] Image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[SupabaseFunctions] uploadImage error:', error);
    throw error;
  }
}

