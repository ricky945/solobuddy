import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AudioGuide } from "@/types";
import { mockAudioGuides } from "@/mocks/tours";

const STORAGE_KEY = "@solobuddy:tours";

export const [ToursProvider, useTours] = createContextHook(() => {
  const queryClient = useQueryClient();

  const toursQuery = useQuery({
    queryKey: ["tours"],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return mockAudioGuides;
        }
        
        const tours = JSON.parse(stored);
        
        const cleanedTours = tours.map((tour: AudioGuide) => {
          if (tour.audioUrl && (tour.audioUrl.startsWith('blob:') || tour.audioUrl.startsWith('data:'))) {
            return { ...tour, audioUrl: '' };
          }
          return tour;
        });
        
        return cleanedTours;
      } catch (error) {
        console.error("[ToursContext] Error loading tours:", error);
        
        if (error instanceof Error && error.message.includes('QuotaExceeded')) {
          console.log("[ToursContext] Storage quota exceeded, clearing old data...");
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
          } catch (clearError) {
            console.error("[ToursContext] Failed to clear storage:", clearError);
          }
        }
        
        return mockAudioGuides;
      }
    },
  });

  const saveToursMutation = useMutation({
    mutationFn: async (tours: AudioGuide[]) => {
      console.log("[ToursContext] Saving tours to AsyncStorage, count:", tours.length);
      
      const toursToSave = tours.map(tour => {
        const tourCopy = { ...tour };
        
        if (tourCopy.audioUrl && (tourCopy.audioUrl.startsWith('blob:') || tourCopy.audioUrl.startsWith('data:'))) {
          console.log("[ToursContext] Skipping audio URL for tour:", tourCopy.id);
          tourCopy.audioUrl = '';
        }
        
        if (tourCopy.script && tourCopy.script.length > 5000) {
          console.log("[ToursContext] Truncating script for tour:", tourCopy.id);
          tourCopy.script = tourCopy.script.substring(0, 5000) + '...';
        }
        
        return tourCopy;
      });
      
      const jsonString = JSON.stringify(toursToSave);
      console.log("[ToursContext] Data size:", Math.round(jsonString.length / 1024), "KB");
      
      try {
        await AsyncStorage.setItem(STORAGE_KEY, jsonString);
        console.log("[ToursContext] Tours saved successfully");
      } catch (error) {
        if (error instanceof Error && error.message.includes('QuotaExceeded')) {
          console.warn("[ToursContext] Storage quota exceeded, keeping only recent tours");
          
          const recentTours = toursToSave.slice(0, 5);
          const reducedJson = JSON.stringify(recentTours);
          console.log("[ToursContext] Reduced data size:", Math.round(reducedJson.length / 1024), "KB");
          
          try {
            await AsyncStorage.setItem(STORAGE_KEY, reducedJson);
            console.log("[ToursContext] Saved with reduced tours");
            return tours.slice(0, 5);
          } catch (retryError) {
            console.error("[ToursContext] Failed to save even with reduced size:", retryError);
            await AsyncStorage.removeItem(STORAGE_KEY);
            throw new Error("Storage quota exceeded. Please delete some tours.");
          }
        }
        throw error;
      }
      
      return tours;
    },
    onSuccess: (data) => {
      console.log("[ToursContext] Mutation success, updating query cache with count:", data.length);
      queryClient.setQueryData(["tours"], data);
      console.log("[ToursContext] Query cache updated");
    },
    onError: (error) => {
      console.error("[ToursContext] Mutation error:", error);
    },
  });

  const addTour = async (tour: AudioGuide) => {
    console.log("[ToursContext] Adding tour:", tour.id, tour.title);
    const currentTours = toursQuery.data || [];
    console.log("[ToursContext] Current tours count:", currentTours.length);
    
    if (!tour.thumbnailUrl && tour.location) {
      const locationQuery = encodeURIComponent(tour.location);
      tour.thumbnailUrl = `https://source.unsplash.com/800x600/?${locationQuery},landmark,city`;
      console.log("[ToursContext] Auto-generated thumbnail URL:", tour.thumbnailUrl);
    }
    
    const updatedTours = [tour, ...currentTours];
    console.log("[ToursContext] Updated tours count:", updatedTours.length);
    await saveToursMutation.mutateAsync(updatedTours);
    console.log("[ToursContext] Tour added successfully");
  };

  const removeTour = (tourId: string) => {
    const currentTours = toursQuery.data || [];
    const updatedTours = currentTours.filter((tour: AudioGuide) => tour.id !== tourId);
    saveToursMutation.mutate(updatedTours);
  };

  const updateTour = (tourId: string, updates: Partial<AudioGuide>) => {
    const currentTours = toursQuery.data || [];
    const updatedTours = currentTours.map((tour: AudioGuide) =>
      tour.id === tourId ? { ...tour, ...updates } : tour
    );
    saveToursMutation.mutate(updatedTours);
  };

  const getTourById = (tourId: string) => {
    const tours = toursQuery.data || [];
    return tours.find((tour: AudioGuide) => tour.id === tourId);
  };

  const clearAllTours = () => {
    saveToursMutation.mutate([]);
  };

  return {
    tours: toursQuery.data || [],
    isLoading: toursQuery.isLoading,
    addTour,
    removeTour,
    updateTour,
    getTourById,
    clearAllTours,
  };
});
