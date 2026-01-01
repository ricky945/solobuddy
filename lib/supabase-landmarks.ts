import { supabase } from './supabase';
import type { MapLandmark, LandmarkReview } from '@/types';

/**
 * Supabase-based landmarks service
 * Provides CRUD operations for user-created landmarks stored in Supabase
 */

export interface LandmarkInput {
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  imageUrl?: string;
  category?: string;
  type?: 'unique' | 'touristic' | 'restaurant';
}

export interface LandmarksResponse {
  success: boolean;
  landmarks: MapLandmark[];
}

// Database row type (matches Supabase table schema)
interface LandmarkRow {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  category: string;
  type: string;
  created_by: string;
  created_by_name: string;
  created_by_avatar: string | null;
  created_at: string;
  upvotes: number;
  upvoted_by: string[];
  reviews: any[];
  user_note: string | null;
  user_images: string[];
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles (changed from 6371 km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert database row to MapLandmark
function rowToLandmark(row: LandmarkRow): MapLandmark {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coordinates: {
      latitude: row.latitude,
      longitude: row.longitude,
    },
    imageUrl: row.image_url || undefined,
    category: (row.category || 'historical') as MapLandmark['category'],
    type: (row.type || 'unique') as MapLandmark['type'],
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByAvatar: row.created_by_avatar || undefined,
    createdAt: new Date(row.created_at).getTime(),
    upvotes: row.upvotes || 0,
    upvotedBy: row.upvoted_by || [],
    reviews: row.reviews || [],
    userNote: row.user_note || undefined,
    userImages: row.user_images || [],
  };
}

// Convert MapLandmark to database row format
function landmarkToRow(landmark: MapLandmark): Omit<LandmarkRow, 'created_at'> & { created_at?: string } {
  return {
    id: landmark.id,
    name: landmark.name,
    description: landmark.description,
    latitude: landmark.coordinates.latitude,
    longitude: landmark.coordinates.longitude,
    image_url: landmark.imageUrl || null,
    category: landmark.category || 'historical',
    type: landmark.type || 'unique',
    created_by: landmark.createdBy || 'anonymous',
    created_by_name: landmark.createdByName || 'Anonymous',
    created_by_avatar: landmark.createdByAvatar || null,
    upvotes: landmark.upvotes || 0,
    upvoted_by: landmark.upvotedBy || [],
    reviews: landmark.reviews || [],
    user_note: landmark.userNote || null,
    user_images: landmark.userImages || [],
  };
}

/**
 * Get all landmarks, optionally filtered by region
 * @param params.radius - Search radius in miles (not kilometers)
 */
export async function getAllLandmarks(params?: {
  latitude?: number;
  longitude?: number;
  radius?: number; // in miles
}): Promise<LandmarksResponse> {
  console.log('[SupabaseLandmarks] getAllLandmarks (radius in miles)', params);
  
  try {
    const { data, error } = await supabase
      .from('landmarks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[SupabaseLandmarks] getAllLandmarks error:', error);
      return { success: false, landmarks: [] };
    }
    
    let landmarks = (data || []).map(rowToLandmark);
    
    // Filter by region if coordinates provided
    if (params?.latitude && params?.longitude && params?.radius) {
      landmarks = landmarks.filter((landmark) => {
        const distance = calculateDistance(
          params.latitude!,
          params.longitude!,
          landmark.coordinates.latitude,
          landmark.coordinates.longitude
        );
        return distance <= params.radius!;
      });
    }
    
    console.log('[SupabaseLandmarks] Found', landmarks.length, 'landmarks');
    return { success: true, landmarks };
  } catch (error) {
    console.error('[SupabaseLandmarks] getAllLandmarks error:', error);
    return { success: false, landmarks: [] };
  }
}

/**
 * Get a single landmark by ID
 */
export async function getLandmarkById(id: string): Promise<MapLandmark | null> {
  console.log('[SupabaseLandmarks] getLandmarkById', id);
  
  try {
    const { data, error } = await supabase
      .from('landmarks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.warn('[SupabaseLandmarks] Landmark not found:', id);
      return null;
    }
    
    return rowToLandmark(data);
  } catch (error) {
    console.error('[SupabaseLandmarks] getLandmarkById error:', error);
    return null;
  }
}

/**
 * Create a new user landmark
 */
export async function createLandmark(
  input: LandmarkInput,
  userId: string,
  userName: string
): Promise<MapLandmark> {
  console.log('[SupabaseLandmarks] createLandmark', { input, userId });
  
  const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const landmark: MapLandmark = {
    id,
    name: input.name,
    description: input.description,
    coordinates: input.coordinates,
    imageUrl: input.imageUrl,
    category: (input.category || 'historical') as MapLandmark['category'],
    type: input.type || 'unique',
    createdBy: userId,
    createdByName: userName,
    createdAt: Date.now(),
    upvotes: 0,
    upvotedBy: [],
    reviews: [],
  };
  
  try {
    const row = landmarkToRow(landmark);
    const { error } = await supabase
      .from('landmarks')
      .insert([row]);
    
    if (error) {
      console.error('[SupabaseLandmarks] createLandmark insert error:', error);
      throw new Error(`Failed to save landmark: ${error.message}`);
    }
    
    console.log('[SupabaseLandmarks] Landmark created in Supabase:', id);
    return landmark;
  } catch (error: any) {
    console.error('[SupabaseLandmarks] createLandmark error:', error);
    throw error;
  }
}

/**
 * Update an existing landmark
 */
export async function updateLandmark(
  id: string,
  updates: Partial<LandmarkInput>
): Promise<MapLandmark | null> {
  console.log('[SupabaseLandmarks] updateLandmark', { id, updates });
  
  try {
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.description) updateData.description = updates.description;
    if (updates.imageUrl) updateData.image_url = updates.imageUrl;
    if (updates.category) updateData.category = updates.category;
    if (updates.type) updateData.type = updates.type;
    if (updates.coordinates) {
      updateData.latitude = updates.coordinates.latitude;
      updateData.longitude = updates.coordinates.longitude;
    }
    
    const { data, error } = await supabase
      .from('landmarks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      console.warn('[SupabaseLandmarks] Landmark not found or update failed:', id);
      return null;
    }
    
    console.log('[SupabaseLandmarks] Landmark updated:', id);
    return rowToLandmark(data);
  } catch (error) {
    console.error('[SupabaseLandmarks] updateLandmark error:', error);
    return null;
  }
}

/**
 * Delete a landmark
 */
export async function deleteLandmark(id: string): Promise<boolean> {
  console.log('[SupabaseLandmarks] deleteLandmark', id);
  
  try {
    const { error } = await supabase
      .from('landmarks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[SupabaseLandmarks] deleteLandmark error:', error);
      return false;
    }
    
    console.log('[SupabaseLandmarks] Landmark deleted:', id);
    return true;
  } catch (error) {
    console.error('[SupabaseLandmarks] deleteLandmark error:', error);
    return false;
  }
}

/**
 * Toggle upvote on a landmark
 */
export async function toggleUpvote(
  landmarkId: string,
  userId: string
): Promise<MapLandmark | null> {
  console.log('[SupabaseLandmarks] toggleUpvote', { landmarkId, userId });
  
  try {
    // Get current landmark
    const { data: current, error: fetchError } = await supabase
      .from('landmarks')
      .select('*')
      .eq('id', landmarkId)
      .single();
    
    if (fetchError || !current) {
      console.warn('[SupabaseLandmarks] Landmark not found:', landmarkId);
      return null;
    }
    
    const upvotedBy = current.upvoted_by || [];
    let newUpvotedBy: string[];
    let newUpvotes: number;
    
    if (upvotedBy.includes(userId)) {
      newUpvotedBy = upvotedBy.filter((id: string) => id !== userId);
      newUpvotes = Math.max(0, (current.upvotes || 0) - 1);
    } else {
      newUpvotedBy = [...upvotedBy, userId];
      newUpvotes = (current.upvotes || 0) + 1;
    }
    
    const { data, error } = await supabase
      .from('landmarks')
      .update({ upvotes: newUpvotes, upvoted_by: newUpvotedBy })
      .eq('id', landmarkId)
      .select()
      .single();
    
    if (error || !data) {
      console.error('[SupabaseLandmarks] toggleUpvote update error:', error);
      return null;
    }
    
    console.log('[SupabaseLandmarks] Upvote toggled:', landmarkId, 'New count:', newUpvotes);
    return rowToLandmark(data);
  } catch (error) {
    console.error('[SupabaseLandmarks] toggleUpvote error:', error);
    return null;
  }
}

/**
 * Add a review to a landmark
 */
export async function addReview(
  landmarkId: string,
  review: LandmarkReview
): Promise<MapLandmark | null> {
  console.log('[SupabaseLandmarks] addReview', { landmarkId, reviewerId: review.userId });
  
  try {
    // Get current landmark
    const { data: current, error: fetchError } = await supabase
      .from('landmarks')
      .select('*')
      .eq('id', landmarkId)
      .single();
    
    if (fetchError || !current) {
      console.warn('[SupabaseLandmarks] Landmark not found:', landmarkId);
      return null;
    }
    
    const reviews = [...(current.reviews || []), review];
    
    const { data, error } = await supabase
      .from('landmarks')
      .update({ reviews })
      .eq('id', landmarkId)
      .select()
      .single();
    
    if (error || !data) {
      console.error('[SupabaseLandmarks] addReview update error:', error);
      return null;
    }
    
    console.log('[SupabaseLandmarks] Review added:', landmarkId, 'Total reviews:', reviews.length);
    return rowToLandmark(data);
  } catch (error) {
    console.error('[SupabaseLandmarks] addReview error:', error);
    return null;
  }
}

/**
 * Get landmarks created by a specific user
 */
export async function getLandmarksByUser(userId: string): Promise<MapLandmark[]> {
  console.log('[SupabaseLandmarks] getLandmarksByUser', userId);
  
  try {
    const { data, error } = await supabase
      .from('landmarks')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[SupabaseLandmarks] getLandmarksByUser error:', error);
      return [];
    }
    
    const landmarks = (data || []).map(rowToLandmark);
    console.log('[SupabaseLandmarks] Found', landmarks.length, 'landmarks by user');
    return landmarks;
  } catch (error) {
    console.error('[SupabaseLandmarks] getLandmarksByUser error:', error);
    return [];
  }
}
