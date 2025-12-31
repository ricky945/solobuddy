import { AudioGuide } from "@/types";

export const mockAudioGuides: AudioGuide[] = [];

export const TOPICS = [
  { id: "history" as const, name: "History", icon: "BookOpen" },
  { id: "culture" as const, name: "Culture", icon: "Users" },
  { id: "food" as const, name: "Food", icon: "Utensils" },
  { id: "economics" as const, name: "Economics", icon: "TrendingUp" },
  { id: "art" as const, name: "Art", icon: "Palette" },
  { id: "architecture" as const, name: "Architecture", icon: "Building2" },
];

export const AUDIO_LENGTHS = [
  { value: 15 as const, label: "15 minutes", time: "15 min" },
  { value: 30 as const, label: "30 minutes", time: "30 min" },
  { value: 40 as const, label: "40 minutes", time: "40 min" },
];

export const AREA_SPECIFICITY = [
  { value: "city" as const, label: "City", description: "Focus on a specific city" },
  { value: "region" as const, label: "Region", description: "Cover a broader region" },
  { value: "country" as const, label: "Country", description: "Explore an entire country" },
];

export const TRANSPORT_METHODS = [
  { value: "walking" as const, label: "Walking", description: "Walking only", icon: "Footprints" },
  { value: "walking_transit" as const, label: "Walking & Transit", description: "Walking with subway, bus, train, or car", icon: "Train" },
];
