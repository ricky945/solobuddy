import { MapLandmark, LandmarkReview } from "@/types";

const globalLandmarks = new Map<string, MapLandmark>();

export const landmarksDB = {
  getAll: (): MapLandmark[] => {
    return Array.from(globalLandmarks.values());
  },

  getById: (id: string): MapLandmark | undefined => {
    return globalLandmarks.get(id);
  },

  getByRegion: (latitude: number, longitude: number, radiusKm: number): MapLandmark[] => {
    const all = Array.from(globalLandmarks.values());
    return all.filter((landmark) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        landmark.coordinates.latitude,
        landmark.coordinates.longitude
      );
      return distance <= radiusKm;
    });
  },

  create: (landmark: MapLandmark): MapLandmark => {
    globalLandmarks.set(landmark.id, landmark);
    console.log("[DB] Landmark created:", landmark.id, "Total landmarks:", globalLandmarks.size);
    return landmark;
  },

  update: (id: string, updates: Partial<MapLandmark>): MapLandmark | null => {
    const existing = globalLandmarks.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    globalLandmarks.set(id, updated);
    console.log("[DB] Landmark updated:", id);
    return updated;
  },

  delete: (id: string): boolean => {
    const deleted = globalLandmarks.delete(id);
    console.log("[DB] Landmark deleted:", id, "Success:", deleted);
    return deleted;
  },

  addUpvote: (landmarkId: string, userId: string): MapLandmark | null => {
    const landmark = globalLandmarks.get(landmarkId);
    if (!landmark) return null;

    if (landmark.upvotedBy.includes(userId)) {
      landmark.upvotedBy = landmark.upvotedBy.filter(id => id !== userId);
      landmark.upvotes = Math.max(0, landmark.upvotes - 1);
    } else {
      landmark.upvotedBy.push(userId);
      landmark.upvotes += 1;
    }

    globalLandmarks.set(landmarkId, landmark);
    console.log("[DB] Upvote toggled for landmark:", landmarkId, "New count:", landmark.upvotes);
    return landmark;
  },

  addReview: (landmarkId: string, review: LandmarkReview): MapLandmark | null => {
    const landmark = globalLandmarks.get(landmarkId);
    if (!landmark) return null;

    landmark.reviews.push(review);
    globalLandmarks.set(landmarkId, landmark);
    console.log("[DB] Review added to landmark:", landmarkId, "Total reviews:", landmark.reviews.length);
    return landmark;
  },

  getByUser: (userId: string): MapLandmark[] => {
    return Array.from(globalLandmarks.values()).filter(
      (landmark) => landmark.createdBy === userId
    );
  },
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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
