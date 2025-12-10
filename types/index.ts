export type TourType = "route" | "immersive";

export type Topic =
  | "history"
  | "culture"
  | "food"
  | "economics"
  | "art"
  | "architecture";

export type AreaSpecificity = "city" | "region" | "country";

export type AudioLength = 20 | 40 | 120 | 240;

export type TransportMethod = "walking" | "walking_transit" | "walking_car";

export interface TourConfig {
  id: string;
  type: TourType;
  topics: Topic[];
  areaSpecificity: AreaSpecificity;
  audioLength: AudioLength;
  transportMethod?: TransportMethod;
  location: string;
  locationCoords?: {
    latitude: number;
    longitude: number;
  };
  createdAt: number;
}

export interface AudioGuide extends TourConfig {
  title: string;
  description: string;
  script?: string;
  audioUrl: string;
  duration: number;
  thumbnailUrl?: string;
  landmarks?: Landmark[];
  chapters?: Chapter[];
  isDownloaded?: boolean;
  downloadProgress?: number;
}

export interface Landmark {
  id: string;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  audioTimestamp: number;
  order: number;
}

export interface Chapter {
  id: string;
  title: string;
  timestamp: number;
  duration: number;
}

export interface NavigationStep {
  id: string;
  instruction: string;
  distance: string;
  estimatedTime: string;
  destinationLandmark: Landmark;
}

export interface Route {
  id: string;
  steps: NavigationStep[];
  totalDistance: string;
  totalTime: string;
}

export type SubscriptionTier = "free" | "unlimited" | "premium";

export interface User {
  id: string;
  email?: string;
  subscriptionTier: SubscriptionTier;
  toursCreated: number;
  toursRemaining: number;
  profile?: UserProfile;
}

export interface UserProfile {
  name: string;
  bio: string;
  currentCity: string;
  profilePictureUrl?: string;
  countriesVisited: string[];
}

export interface Report {
  id: string;
  tourId: string;
  location: string;
  bestThingsToDo: string[];
  foodRecommendations: string[];
  playlist: Song[];
  summary: string;
  createdAt: number;
}

export interface Song {
  title: string;
  artist: string;
  reason: string;
}

export type LandmarkType = "touristic" | "unique" | "restaurant";

export interface LandmarkReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface MapLandmark {
  id: string;
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  imageUrl?: string;
  category: "historical" | "cultural" | "religious" | "museum" | "park" | "monument" | "building" | "natural";
  type: LandmarkType;
  userNote?: string;
  userImages?: string[];
  createdBy: string;
  createdByName: string;
  createdByAvatar?: string;
  createdAt: number;
  upvotes: number;
  upvotedBy: string[];
  reviews: LandmarkReview[];
}
