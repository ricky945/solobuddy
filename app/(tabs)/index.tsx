import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import {
  MapPin,
  Route,
  Headphones,
  BookOpen,
  Landmark,
  Users,
  Utensils,
  TrendingUp,
  Palette,
  Building2,
  Footprints,
  Train,
  Car,
  Clock,
  Navigation,
  X,
  ChevronLeft,
  Plane,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import Colors from "@/constants/colors";
import {
  TOPICS,
  AUDIO_LENGTHS,
  TRANSPORT_METHODS,
} from "@/mocks/tours";
import { Topic, AudioLength, TransportMethod, AudioGuide, SubscriptionTier } from "@/types";
import { useTours } from "@/contexts/ToursContext";
import { useUser } from "@/contexts/UserContext";
import PaywallModal from "@/components/PaywallModal";

import { splitIntoChunks, sanitizeTextForTTS } from "@/lib/text-sanitizer";

const iconMap = {
  BookOpen,
  Users,
  Utensils,
  TrendingUp,
  Palette,
  Building2,
  Footprints,
  Train,
  Car,
};

type FlowStep = "welcome" | "tourType" | "location" | "landmarkDiscovery" | "landmarkTopicsLoading" | "landmarkTopics" | "topics" | "transport" | "travelTime" | "numStops" | "timePerStop" | "audioLength" | "generating";

export default function ExploreScreen() {
  const router = useRouter();
  const { addTour } = useTours();
  const { incrementToursCreated, canCreateTour, upgradeTier } = useUser();
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [tourType, setTourType] = useState<"route" | "immersive" | "landmark" | null>(null);
  const [location, setLocation] = useState<string>("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [audioLength, setAudioLength] = useState<AudioLength>(15);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("walking");
  const [travelTime, setTravelTime] = useState<10 | 20 | 25>(10);
  const [numStops, setNumStops] = useState<3 | 5 | 7>(3);
  const [timePerStop, setTimePerStop] = useState<7 | 15 | 20>(7);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedLandmarkTopics, setSelectedLandmarkTopics] = useState<string[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<{ name: string; placeId: string; types: string[] }[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = useState<boolean>(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim1 = useRef(new Animated.Value(0)).current;
  const rotateAnim2 = useRef(new Animated.Value(0)).current;
  const rotateAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [flowStep, fadeAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim1, {
        toValue: 1,
        duration: 30000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim2, {
        toValue: 1,
        duration: 40000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim3, {
        toValue: 1,
        duration: 50000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateAnim1, rotateAnim2, rotateAnim3]);

  const goToNextStep = (step: FlowStep) => {
    if (step === "generating" || step === "landmarkTopicsLoading") {
      setFlowStep(step);
      fadeAnim.setValue(1);
    } else {
      fadeAnim.setValue(0);
      setFlowStep(step);
    }
  };

  const goToPreviousStep = () => {
    fadeAnim.setValue(0);
    switch (flowStep) {
      case "tourType":
        setFlowStep("welcome");
        break;
      case "location":
        setFlowStep("tourType");
        break;
      case "landmarkDiscovery":
        setFlowStep("tourType");
        break;
      case "landmarkTopics":
        setFlowStep("landmarkDiscovery");
        break;
      case "topics":
        if (tourType === "landmark") {
          setFlowStep("landmarkTopics");
        } else {
          setFlowStep("location");
        }
        break;
      case "transport":
        if (tourType === "route") {
          setFlowStep("topics");
        } else {
          setFlowStep("audioLength");
        }
        break;
      case "travelTime":
        setFlowStep("transport");
        break;
      case "numStops":
        setFlowStep("travelTime");
        break;
      case "timePerStop":
        setFlowStep("numStops");
        break;
      case "audioLength":
        if (tourType === "landmark") {
          setFlowStep("landmarkTopics");
        } else {
          setFlowStep("topics");
        }
        break;
      default:
        break;
    }
  };

  const resetFlow = () => {
    setFlowStep("welcome");
    setTourType(null);
    setLocation("");
    setLocationCoords(null);
    setSelectedTopics([]);
    setAudioLength(15);
    setTransportMethod("walking");
    setTravelTime(10);
    setNumStops(3);
    setTimePerStop(7);
    fadeAnim.setValue(0);
  };

  const handleTourTypeSelection = (type: "route" | "immersive" | "landmark") => {
    setTourType(type);
    if (type === "landmark") {
      goToNextStep("landmarkDiscovery");
    } else {
      goToNextStep("location");
    }
  };

  const toggleTopic = (topicId: Topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((t) => t !== topicId)
        : [...prev, topicId]
    );
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    console.log("[Location] Requesting location permission...");

    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          Alert.alert("Error", "Geolocation is not supported by your browser");
          setIsGettingLocation(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            console.log("[Location] Web location obtained:", { latitude, longitude });
            setLocationCoords({ latitude, longitude });

            try {
              const geocodeResponse = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
              );
              const geocodeData = await geocodeResponse.json();
              console.log("[Location] Geocode data:", geocodeData);
              
              const locationParts = [
                geocodeData.address?.city ||
                  geocodeData.address?.town ||
                  geocodeData.address?.village ||
                  geocodeData.address?.county ||
                  geocodeData.address?.state,
                geocodeData.address?.country,
              ];
              
              const locationString = locationParts.filter(Boolean).join(", ");
              console.log("[Location] Reverse geocoded:", locationString);
              
              if (locationString && locationString !== ", ") {
                setLocation(locationString);
              } else {
                console.log("[Location] No location name found");
                setLocation(`Location near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
              }
            } catch (error) {
              console.error("[Location] Reverse geocode error:", error);
              setLocation(`Location near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
            }
            setIsGettingLocation(false);
          },
          (error) => {
            console.error("[Location] Web geolocation error:", error);
            Alert.alert("Error", `Failed to get location: ${error.message}`);
            setIsGettingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log("[Location] Permission status:", status);

        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required to use your current location."
          );
          setIsGettingLocation(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const { latitude, longitude } = currentLocation.coords;
        console.log("[Location] Native location obtained:", { latitude, longitude });
        setLocationCoords({ latitude, longitude });

        try {
          const geocodeResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const geocodeData = await geocodeResponse.json();
          console.log("[Location] Geocode data:", geocodeData);
          
          const locationParts = [
            geocodeData.address?.city ||
              geocodeData.address?.town ||
              geocodeData.address?.village ||
              geocodeData.address?.county ||
              geocodeData.address?.state,
            geocodeData.address?.country,
          ];
          
          const locationString = locationParts.filter(Boolean).join(", ");
          console.log("[Location] Reverse geocoded:", locationString);
          
          if (locationString && locationString !== ", ") {
            setLocation(locationString);
          } else {
            console.log("[Location] No location name found");
            setLocation(`Location near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
          }
        } catch (error) {
          console.error("[Location] Reverse geocode error:", error);
          setLocation(`Location near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`);
        }
        setIsGettingLocation(false);
      }
    } catch (error) {
      console.error("[Location] Error getting location:", error);
      Alert.alert("Error", "Failed to get your current location. Please try again.");
      setIsGettingLocation(false);
    }
  };

  const clearLocation = () => {
    setLocation("");
    setLocationCoords(null);
    setPlaceSuggestions([]);
    setShowSuggestions(false);
  };

  const searchPlaces = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    console.log("[Place Search] Searching for:", query);

    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || "";
      
      let searchCenter = locationCoords;
      if (!searchCenter && Platform.OS !== "web") {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const currentLocation = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            searchCenter = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            };
          }
        } catch {
          console.log("[Place Search] Could not get location for search");
        }
      }

      const requestBody: any = {
        textQuery: query,
        maxResultCount: 5,
        includedType: "tourist_attraction",
      };

      if (searchCenter) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: searchCenter.latitude,
              longitude: searchCenter.longitude,
            },
            radius: 50000,
          },
        };
      }

      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.types",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();
      const places = data.places || [];

      console.log("[Place Search] Found", places.length, "places");

      const suggestions = places.map((place: any) => ({
        name: place.displayName?.text || "Unknown",
        placeId: place.id,
        types: place.types || [],
      }));

      setPlaceSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error("[Place Search] Error:", error);
      setPlaceSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleLocationTextChange = (text: string) => {
    setLocation(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (text.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(text);
      }, 500);
    } else {
      setPlaceSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion: { name: string; placeId: string; types: string[] }) => {
    setLocation(suggestion.name);
    setShowSuggestions(false);
    setPlaceSuggestions([]);
    console.log("[Place Search] Selected:", suggestion.name);
  };

  const findNearestLandmark = async () => {
    setIsGettingLocation(true);
    console.log("[Landmark Discovery] Finding nearest landmark...");

    try {
      let coords = locationCoords;
      
      if (!coords) {
        if (Platform.OS === "web") {
          const position: any = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 10000,
            });
          });
          coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission Denied", "Location permission is required.");
            setIsGettingLocation(false);
            return;
          }
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          coords = { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude };
        }
        setLocationCoords(coords);
      }

      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || "";
      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.editorialSummary",
          },
          body: JSON.stringify({
            includedTypes: ["museum", "tourist_attraction", "art_gallery", "church", "park", "landmark"],
            maxResultCount: 5,
            locationRestriction: {
              circle: {
                center: { latitude: coords.latitude, longitude: coords.longitude },
                radius: 500,
              },
            },
          }),
        }
      );

      const data = await response.json();
      const places = data.places || [];

      if (places.length > 0) {
        const nearest = places[0];
        const landmarkName = nearest.displayName?.text || "Unknown Landmark";
        setLocation(landmarkName);
        console.log("[Landmark Discovery] Found:", landmarkName);
      } else {
        Alert.alert(
          "No Landmark Found",
          "We couldn't find a major landmark nearby. Please enter one manually."
        );
      }
    } catch (error) {
      console.error("[Landmark Discovery] Error:", error);
      Alert.alert("Error", "Failed to find nearby landmarks. Please try again.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const loadTopicsForLandmark = async () => {
    if (!location.trim()) return;
    
    goToNextStep("landmarkTopicsLoading");
    console.log("[Topic Generation] Loading topics for:", location);

    try {
      const prompt = `You are a travel expert. Generate 8-12 relevant topics for an audio tour about "${location}". 
      
Return ONLY a JSON array of topic strings. Each topic should be:
      - Specific and relevant to this location
      - Suitable for a 20-40 minute audio tour
      - Interesting and educational
      - Written as a short phrase (2-5 words)
      
Examples for British Museum: ["Origins of the Museum", "King Tut's Treasures", "Rosetta Stone Story", "Greek Sculptures", "Egyptian Mummies", "Controversial Acquisitions"]
      
For ${location}, return topics as JSON array:`;

      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const data = await openaiResponse.json();
      const response = data.choices[0]?.message?.content || "";

      console.log("[Topic Generation] Response:", response);

      let topics: string[] = [];
      try {
        const jsonMatch = response.match(/\[([\s\S]*?)\]/);
        if (jsonMatch) {
          topics = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("[Topic Generation] Parse error:", parseError);
        topics = [
          "History and Origins",
          "Architecture",
          "Cultural Significance",
          "Famous Events",
          "Notable Figures",
          "Modern Day",
        ];
      }

      console.log("[Topic Generation] Generated topics:", topics);
      setSuggestedTopics(topics);
      goToNextStep("landmarkTopics");
    } catch (error) {
      console.error("[Topic Generation] Error:", error);
      Alert.alert("Error", "Failed to generate topics. Please try again.");
      goToPreviousStep();
    }
  };

  const toggleLandmarkTopic = (topic: string) => {
    setSelectedLandmarkTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const spin1 = rotateAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = rotateAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin3 = rotateAnim3.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderOrbitalBackground = () => {
    const { width } = Dimensions.get('window');
    const size = Math.min(width * 1.2, 500);

    const counterSpin1 = rotateAnim1.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '-360deg'],
    });

    const counterSpin2 = rotateAnim2.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '-360deg'],
    });

    const counterSpin3 = rotateAnim3.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '-360deg'],
    });

    return (
      <View style={[styles.orbitalContainer, { width: size, height: size }]}>
        <Animated.View
          style={[
            styles.orbit,
            {
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: size * 0.25,
              transform: [{ rotate: spin1 }],
              opacity: 1,
            },
          ]}
        >
          <Animated.View style={[styles.planeIcon, styles.dotTop, { transform: [{ rotate: counterSpin1 }] }]}>
            <Plane size={26} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotBottom, { transform: [{ rotate: counterSpin1 }] }]}>
            <Plane size={26} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.orbit,
            {
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: size * 0.35,
              transform: [{ rotate: spin2 }],
              opacity: 0.7,
            },
          ]}
        >
          <Animated.View style={[styles.planeIcon, styles.dotTop, { transform: [{ rotate: counterSpin2 }] }]}>
            <Plane size={24} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotRight, { transform: [{ rotate: counterSpin2 }] }]}>
            <Plane size={24} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotBottom, { transform: [{ rotate: counterSpin2 }] }]}>
            <Plane size={24} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.orbit,
            {
              width: size,
              height: size,
              borderRadius: size * 0.5,
              transform: [{ rotate: spin3 }],
              opacity: 0.4,
            },
          ]}
        >
          <Animated.View style={[styles.planeIcon, styles.dotTop, { transform: [{ rotate: counterSpin3 }] }]}>
            <Plane size={21} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotRight, { transform: [{ rotate: counterSpin3 }] }]}>
            <Plane size={21} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotBottom, { transform: [{ rotate: counterSpin3 }] }]}>
            <Plane size={21} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
          <Animated.View style={[styles.planeIcon, styles.dotLeft, { transform: [{ rotate: counterSpin3 }] }]}>
            <Plane size={21} color={Colors.light.primary} fill={Colors.light.primary} />
          </Animated.View>
        </Animated.View>
      </View>
    );
  };

  const canProceedFromLocation = location.trim() !== "";
  const canProceedFromTopics = selectedTopics.length > 0;
  const canGenerate = tourType === "landmark" 
    ? location.trim() !== "" && selectedLandmarkTopics.length > 0
    : location.trim() !== "" && selectedTopics.length > 0;



  const checkNetworkConnectivity = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("[Network Check] Testing OpenAI connectivity...");
      
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
      if (!apiKey) {
        console.error("[Network Check] OpenAI API key not configured!");
        return { 
          success: false, 
          error: "OpenAI API key is not configured. Please add it to your .env file."
        };
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch("https://api.openai.com/v1/models", {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      clearTimeout(timeoutId);
      console.log("[Network Check] Response status:", response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          return { 
            success: false, 
            error: "Invalid OpenAI API key. Please check your configuration."
          };
        }
        return { 
          success: false, 
          error: `OpenAI API returned error: ${response.status}. Please try again.`
        };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error("[Network Check] Failed:", error);
      
      if (error?.name === 'AbortError') {
        return { 
          success: false, 
          error: "Connection timeout. Please check your internet connection."
        };
      }
      
      const errorMsg = String(error?.message || '').toLowerCase();
      if (errorMsg.includes('network request failed') || errorMsg.includes('failed to fetch')) {
        return { 
          success: false, 
          error: "Cannot connect to OpenAI. Please check your internet connection."
        };
      }
      
      return { 
        success: false, 
        error: `Connection test failed: ${error?.message || 'Unknown error'}`
      };
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || !tourType) {
      console.log("[Tour Generation] Cannot generate: missing requirements");
      return;
    }

    if (!canCreateTour()) {
      console.log("[Tour Generation] User needs subscription");
      setShowPaywall(true);
      return;
    }

    console.log("[Tour Generation] Checking network connectivity...");
    const connectivityCheck = await checkNetworkConnectivity();
    
    if (!connectivityCheck.success) {
      Alert.alert(
        "Connection Error",
        connectivityCheck.error || "Cannot connect to the AI service. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
      return;
    }
    
    console.log("[Tour Generation] Network connectivity check passed");

    goToNextStep("generating");
    console.log("[Tour Generation] Starting...");

    let isMounted = true;

    try {
      const tourId = `tour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const currentDate = new Date();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentMonth = monthNames[currentDate.getMonth()];
      const currentYear = currentDate.getFullYear();
      const season = currentDate.getMonth() >= 2 && currentDate.getMonth() <= 4 ? "spring" : currentDate.getMonth() >= 5 && currentDate.getMonth() <= 7 ? "summer" : currentDate.getMonth() >= 8 && currentDate.getMonth() <= 10 ? "fall" : "winter";

      const topicsToUse = tourType === "landmark" ? selectedLandmarkTopics : selectedTopics;
      const topicsString = topicsToUse.join(", ");

      const getAreaLabelFromCoords = async (coords: { latitude: number; longitude: number }): Promise<string | null> => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=16&addressdetails=1`;
          console.log("[Geo] Reverse geocoding area label:", url);

          const resp = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          });

          if (!resp.ok) {
            console.log("[Geo] Reverse geocode failed:", resp.status);
            return null;
          }

          const data: unknown = await resp.json();
          const address = (data as any)?.address as Record<string, unknown> | undefined;

          const neighbourhood = (address?.neighbourhood as string | undefined) ?? (address?.quarter as string | undefined);
          const cityDistrict = (address?.city_district as string | undefined) ?? (address?.borough as string | undefined);
          const suburb = (address?.suburb as string | undefined);
          const city = (address?.city as string | undefined) ?? (address?.town as string | undefined) ?? (address?.village as string | undefined);
          const region = (address?.state as string | undefined) ?? (address?.region as string | undefined);
          const country = address?.country as string | undefined;

          const areaBits = [neighbourhood, cityDistrict, suburb, city].filter(Boolean);
          const primary = areaBits[0];

          const labelParts = [primary, city, region, country].filter((v, i, arr) => {
            if (!v) return false;
            if (i > 0 && v === arr[i - 1]) return false;
            return true;
          });

          const label = labelParts.join(", ").trim();
          console.log("[Geo] Area label:", label || null);
          return label.length > 0 ? label : null;
        } catch (e) {
          console.error("[Geo] Reverse geocode error:", e);
          return null;
        }
      };

      const areaLabel = locationCoords ? await getAreaLabelFromCoords(locationCoords) : null;
      const areaLine = areaLabel ? `Right now, you are in ${areaLabel}.` : "";

      // For route tours, each stop gets timePerStop minutes of audio
      const audioLengthForRoute = tourType === "route" ? timePerStop : audioLength;

      const systemPrompt = tourType === "landmark" 
        ? `Expert tour guide: Create ${audioLength}-min audio tour of ${location}. Topics: ${topicsString}. 
Rules: ${selectedLandmarkTopics.length} chapters (one per topic), vivid storytelling, conversational tone, ~${audioLength * 150} words. Season: ${season} ${currentMonth} ${currentYear}.
Return JSON: {title, description, script, chapters: [{title, timestamp(seconds), duration(seconds)}]}`
        : `Expert tour guide: ${location} tour. Topics: ${topicsString}. Season: ${season} ${currentMonth} ${currentYear}.
${tourType === "route" ? `${numStops} stops, ${audioLengthForRoute}min each (~${audioLengthForRoute * 150} words/stop). ${transportMethod === "walking" ? "Walking" : "Walking/transit"}, max ${travelTime}min between stops.` : `${audioLength}min total (~${audioLength * 150} words). Cover diverse areas.`}
Engaging narration, connect to user topics, conversational, NO coords in speech.
Return JSON: {title, description${tourType === "route" ? `, landmarks: [{name, description, coordinates: {latitude, longitude}, script}]` : `, script, chapters: [{title, timestamp, duration}]`}}`;

      // For route tours, use the number of stops selected by the user
      const numLandmarks = tourType === "route" ? numStops : 0;
      const maxLandmarksForTime = numLandmarks;

      const userMessage = tourType === "landmark"
        ? `Create an in-depth audio tour about ${location} covering these specific topics: ${topicsString}.

IMPORTANT: This tour should provide RICH, DETAILED content. Each topic deserves substantial exploration.

Return JSON with:
- title: Engaging title for the landmark tour
- description: 2-3 sentence description
- script: Full detailed spoken script for a ${audioLength}-minute audio tour (~${audioLength * 150} words). Write as if you're standing at ${location} and narrating directly to the visitor. Make it immersive, educational, and comprehensive. DO NOT rush through content - take time to tell complete stories and provide deep context.
- chapters: Array of ${selectedLandmarkTopics.length} chapters, one for each topic. Each chapter needs:
  - title: The topic name or engaging chapter title
  - timestamp: When this chapter starts (in seconds)
  - duration: How long this chapter lasts (in seconds)
  
Make sure chapters align with the selected topics and cover the full ${audioLength}-minute duration with substantial, detailed content.`
            : `Create an audio tour for ${location} covering ${topicsString}.

CRITICAL: This is a ROUTE tour with ${maxLandmarksForTime} stops. EACH STOP must have ${audioLengthForRoute} FULL MINUTES of rich audio content dedicated ONLY to that specific landmark.

${tourType === "route" ? `TRAVEL CONSTRAINTS:
- Transport method: ${transportMethod === "walking" ? "Walking only" : "Walking and/or public transit/car/bus"}
- Maximum travel time between stops: ${travelTime} minutes${transportMethod === "walking_transit" && travelTime === 25 ? " (on train, car, or bus)" : ""}
- Landmarks must be reachable within this time frame
- Consider realistic travel distances for ${transportMethod === "walking" ? "pedestrians" : "someone using public transit or driving"}

` : ""}Return JSON with:
- title: Catchy title
- description: 2-3 sentence description  
${tourType === "route" ? `- landmarks: Array of exactly ${maxLandmarksForTime} real landmarks near ${location}. For EACH landmark you MUST provide:
  * name: Landmark name
  * description: Brief 1-sentence description
  * coordinates: {latitude, longitude}
  * script: A COMPLETE ${audioLengthForRoute}-minute spoken audio script (MINIMUM ${audioLengthForRoute * 150} words, aim for ${audioLengthForRoute * 180} words) that ONLY discusses THIS specific landmark. This needs to be SUBSTANTIAL content - ${audioLengthForRoute} full minutes of narration. Write as if you're the narrator speaking directly to the listener at this location. Include:
    - Rich introduction and welcome to THIS landmark
    - Detailed historical information about THIS place
    - Interesting stories, anecdotes, and facts about THIS landmark
    - Sensory descriptions of what you see/hear/feel HERE
    - Cultural and social significance of THIS specific location
    - A natural conclusion for THIS stop
  The script should be self-contained - don't reference other landmarks or say "next we'll visit..."
  
IMPORTANT: Select landmarks that are within ${travelTime} minutes travel time of each other via ${transportMethod === "walking" ? "walking" : "public transit, car, or bus"}. Consider realistic distances based on the travel method.
${locationCoords ? `- listenerCoordinates: { latitude: ${locationCoords.latitude}, longitude: ${locationCoords.longitude} } (use ONLY for choosing nearby places; do NOT speak or print the numbers)` : ""}
- famousLandmarkRecommendation: OPTIONAL - If there is a world-famous landmark that exists in this city but is far from the user's location, include: {name, reason, estimatedDistance}
- hasFewLandmarks: OPTIONAL - Boolean true if this area has very few actual landmarks (less than ${maxLandmarksForTime})` : "- script: Full detailed spoken script with ~${audioLength * 150} words\n- chapters: Array of chapters with {title, timestamp, duration}"}`;

      console.log("[Tour Generation] Preparing to call OpenAI...");
      console.log("[Tour Generation] Platform:", Platform.OS);
      console.log("[Tour Generation] System prompt length:", systemPrompt.length);
      console.log("[Tour Generation] User message length:", userMessage.length);

      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      let response: string | undefined;
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: any = null;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`[Tour Generation] OpenAI API call attempt ${retryCount + 1}/${maxRetries}`);
          
          const startTime = Date.now();
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "user", content: systemPrompt + "\n\n" + userMessage },
              ],
              temperature: 0.7,
              max_tokens: 4000,
            }),
          });

          if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({}));
            throw new Error(`OpenAI API error (${openaiResponse.status}): ${errorData.error?.message || 'Unknown error'}`);
          }

          const data = await openaiResponse.json();
          response = data.choices[0]?.message?.content || "";
          const duration = Date.now() - startTime;
          
          console.log("[Tour Generation] AI response received successfully");
          console.log("[Tour Generation] Response time:", duration, "ms");
          console.log("[Tour Generation] Response length:", response?.length || 0);
          lastError = null;
          break;
        } catch (aiError: any) {
          lastError = aiError;
          console.error(`[Tour Generation] AI call attempt ${retryCount + 1} failed:`, aiError);
          console.error(`[Tour Generation] Error message:`, aiError?.message || 'Unknown');
          
          retryCount++;
          
          if (retryCount < maxRetries) {
            const delayMs = 1000 * Math.pow(2, retryCount - 1);
            console.log(`[Tour Generation] Retrying after ${delayMs}ms... (${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            if (!isMounted) {
              console.log("[Tour Generation] Component unmounted during retry");
              return;
            }
            
            const recheckResult = await checkNetworkConnectivity();
            if (!recheckResult.success) {
              console.error("[Tour Generation] Network recheck failed:", recheckResult.error);
              throw new Error(
                recheckResult.error || "Connection lost during generation. Please check your internet and try again."
              );
            }
          }
        }
      }
      
      if (lastError && !response) {
        const errorMsg = String(lastError?.message || lastError || '').toLowerCase();
        console.error(`[Tour Generation] All retries exhausted. Final error:`, errorMsg);
        
        if (errorMsg.includes('network request failed') || errorMsg.includes('failed to fetch') || errorMsg.includes('fetch failed')) {
          throw new Error(
            "Network connection failed during AI generation.\n\n" +
            "Troubleshooting steps:\n" +
            "1. Check your internet connection\n" +
            "2. Try switching between WiFi and mobile data\n" +
            "3. Disable VPN or proxy if enabled\n" +
            "4. Try a shorter tour (20 min) with fewer topics\n\n" +
            "If the problem persists, the AI service may be temporarily unavailable."
          );
        } else if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
          throw new Error(
            "Request timed out. The tour generation took too long.\n\n" +
            "Try:\n" +
            "• Selecting a shorter duration (20 minutes)\n" +
            "• Choosing fewer topics (1-2)\n" +
            "• Ensuring you have a stable internet connection"
          );
        } else if (errorMsg.includes('400') || errorMsg.includes('bad request')) {
          throw new Error(
            "Invalid request. Please try:\n" +
            "• Using a different location name\n" +
            "• Selecting different topics\n" +
            "• Trying again in a moment"
          );
        } else {
          throw new Error(
            `AI generation failed: ${lastError?.message || 'Unknown error'}.\n\n` +
            "Please try again. If this persists, try a simpler tour with fewer topics."
          );
        }
      }

      if (!isMounted) {
        console.log("[Tour Generation] Component unmounted, aborting");
        return;
      }

      if (!response || response.trim().length === 0) {
        throw new Error("Empty response from AI");
      }

      let generatedContent;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);        
        generatedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        console.log("[Tour Generation] Parsed content keys:", Object.keys(generatedContent));
      } catch (parseError) {
        console.error("[Tour Generation] JSON parse error:", parseError);
        generatedContent = {};
      }

      // Extract script - handle both string and object formats
      let audioScript = generatedContent.script;
      
      // If script is an object or array, try to extract text from it
      if (typeof audioScript === 'object' && audioScript !== null) {
        console.warn("[Tour Generation] script is an object, trying to extract text");
        console.log("[Tour Generation] script structure:", JSON.stringify(audioScript).substring(0, 200));
        
        // Try common formats
        if (Array.isArray(audioScript)) {
          audioScript = audioScript.join(' ');
        } else if (audioScript.text) {
          audioScript = audioScript.text;
        } else if (audioScript.content) {
          audioScript = audioScript.content;
        } else {
          // Flatten object into text
          audioScript = JSON.stringify(audioScript);
        }
      }
      
      // Final fallback
      if (!audioScript || typeof audioScript !== 'string' || audioScript.length < 50) {
        console.error("[Tour Generation] Invalid or too short audioScript, using fallback");
        audioScript = "Welcome to this audio tour of " + location + ". Unfortunately, we couldn't generate the full content at this time. Please try again.";
      }
      
      console.log("[Tour Generation] audioScript type:", typeof audioScript, "length:", audioScript?.length || 0);
      
      audioScript = audioScript
        .replace(/\b\d+\.\d+\s*(degrees?|°)?\s*(north|south|east|west|N|S|E|W|latitude|longitude|lat|lon|long)?[,\s]*\d+\.\d+\s*(degrees?|°)?\s*(north|south|east|west|N|S|E|W|latitude|longitude|lat|lon|long)?\b/gi, "")
        .replace(/\blatitude[:\s]+[\d\.\-]+[,\s]*longitude[:\s]+[\d\.\-]+\b/gi, "")
        .replace(/\bcoordinates?[:\s]+[\d\.\-,\s°NSEW]+\b/gi, "")
        .replace(/\b[\d\.\-]+\s*,\s*[\d\.\-]+\b/g, (match: string) => {
          if (match.match(/^\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/)) {
            return "";
          }
          return match;
        })
        .replace(/\b(let['’]?s\s+get\s+started)(\s+real\s+quick)?\b/gi, "")
        .replace(/\b(real\s+quick)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      console.log("[Tour Generation] Generating audio from script...");
      console.log("[Tour Generation] Script length:", audioScript.length, "characters");
      console.log("[Tour Generation] Script preview:", audioScript.substring(0, 200) + "...");

      let audioUrl: string = "";

      const OPENAI_TTS_MODEL = "tts-1" as const;
      const OPENAI_TTS_VOICE = "alloy" as const;
      const OPENAI_TTS_SPEED = 1.0 as const;
      
      // For route tours, extract individual landmark scripts
      const routeLandmarksWithScripts = tourType === "route" && generatedContent.landmarks
        ? generatedContent.landmarks.map((lm: any, idx: number) => ({
            ...lm,
            script: typeof lm.script === 'string' ? lm.script : null,
            index: idx,
          })).filter((lm: any) => lm.script && lm.script.length > 50)
        : [];
      
      console.log("[Tour Generation] Route landmarks with scripts:", routeLandmarksWithScripts.length);

      const generateTTSBuffer = async (text: string, attempt = 0): Promise<Uint8Array> => {
        const apiKey = (process.env.EXPO_PUBLIC_OPENAI_API_KEY || "").toString().trim();
        if (!apiKey) {
          throw new Error("OpenAI API key not configured");
        }

        const sanitized = sanitizeTextForTTS(text, 3400);
        if (!sanitized || sanitized.length < 10) {
          throw new Error("Text too short or invalid after sanitization");
        }

        console.log(`[TTS] Requesting OpenAI audio (${sanitized.length} chars), attempt ${attempt + 1}`);

        const controller = new AbortController();
        const timeoutMs = 180000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const resp = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: OPENAI_TTS_MODEL,
              input: sanitized,
              voice: OPENAI_TTS_VOICE,
              speed: OPENAI_TTS_SPEED,
            }),
            signal: controller.signal,
          });

          console.log("[TTS] OpenAI status:", resp.status);

          if (!resp.ok) {
            let msg = "Unknown error";
            try {
              const ct = resp.headers.get("content-type") || "";
              if (ct.includes("application/json")) {
                const j = await resp.json();
                msg = j?.error?.message ? String(j.error.message) : JSON.stringify(j);
              } else {
                msg = await resp.text();
              }
            } catch {}

            if (resp.status === 401) throw new Error("Invalid API key");
            if (resp.status === 429) throw new Error("Rate limit exceeded");
            throw new Error(`TTS API error (${resp.status}): ${msg}`);
          }

          const ab = await resp.arrayBuffer();
          console.log("[TTS] Received audio bytes:", ab.byteLength);
          return new Uint8Array(ab);
        } catch (e: any) {
          const msg = String(e?.message || e || "").toLowerCase();
          const isTimeout = e?.name === "AbortError" || msg.includes("aborted") || msg.includes("timeout");
          const isNetwork = msg.includes("network") || msg.includes("fetch") || msg.includes("failed");

          if ((isTimeout || isNetwork) && attempt < 2) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
            console.log(`[TTS] Retrying after ${delay}ms (timeout/network)`);
            await new Promise((r) => setTimeout(r, delay));
            return generateTTSBuffer(text, attempt + 1);
          }

          throw e;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      try {
        console.log("[Tour Generation] Generating TTS audio (client-direct)...");

        const segmentUris: string[] = [];
        const segmentTimes: { startTime: number; duration: number }[] = [];
        let tCursor = 0;

        // For route tours with landmark scripts, generate separate audio per landmark
        if (tourType === "route" && routeLandmarksWithScripts.length > 0) {
          console.log(`[Tour Generation] Generating separate audio for ${routeLandmarksWithScripts.length} landmarks IN PARALLEL`);
          
          // Generate all TTS audio in parallel for maximum speed
          const ttsPromises = routeLandmarksWithScripts.map(async (landmark: any, i: number) => {
            console.log(`[Tour Generation] Starting TTS for landmark ${i + 1}/${routeLandmarksWithScripts.length}: ${landmark.name}`);
            const bytes = await generateTTSBuffer(landmark.script);
            
            // Convert to base64 data URI
            let binary = '';
            const len = bytes.byteLength;
            for (let j = 0; j < len; j++) {
              binary += String.fromCharCode(bytes[j]);
            }
            const base64 = btoa(binary);
            const dataUri = `data:audio/mpeg;base64,${base64}`;
            
            const estimatedDurationSeconds = Math.max(60, Math.round(landmark.script.length / 12.5));
            console.log(`[TTS] Completed landmark ${i + 1} audio (${Math.round(base64.length / 1024)}KB, ~${estimatedDurationSeconds}s)`);
            
            return { dataUri, estimatedDurationSeconds, index: i };
          });
          
          // Wait for all TTS generation to complete
          const ttsResults = await Promise.all(ttsPromises);
          
          if (!isMounted) {
            console.log("[Tour Generation] Component unmounted, stopping");
            return;
          }
          
          // Sort by index and build segments
          ttsResults.sort((a, b) => a.index - b.index);
          ttsResults.forEach(result => {
            segmentUris.push(result.dataUri);
            segmentTimes.push({ startTime: tCursor, duration: result.estimatedDurationSeconds });
            tCursor += result.estimatedDurationSeconds;
          });
          
          console.log(`[TTS] All ${routeLandmarksWithScripts.length} landmarks generated in parallel!`);
        } else {
          // For non-route tours or route tours without landmark scripts, use old method
          console.log("[Tour Generation] Using combined script audio generation");
          
          const chunks = splitIntoChunks(audioScript, { minChars: 900, maxChars: 3400 });
          console.log(`[Tour Generation] Split script into ${chunks.length} chunk(s)`);

          if (chunks.length === 0) {
            throw new Error("No audio chunks produced from script");
          }

          const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
          const totalSeconds = (tourType === "route" ? audioLengthForRoute : audioLength) * 60;
          console.log(`[Tour Generation] Total tour duration: ${totalSeconds}s`);

          for (let i = 0; i < chunks.length; i++) {
            const ratio = totalChars > 0 ? chunks[i].length / totalChars : 1 / chunks.length;
            const dur = Math.max(5, Math.round(totalSeconds * ratio));
            segmentTimes.push({ startTime: tCursor, duration: dur });
            tCursor += dur;
          }

          if (segmentTimes.length > 0) {
            const last = segmentTimes[segmentTimes.length - 1];
            last.duration = Math.max(5, totalSeconds - last.startTime);
          }

          // Generate all chunks in parallel for maximum speed
          console.log(`[Tour Generation] Generating ${chunks.length} TTS chunks IN PARALLEL`);
          
          const ttsPromises = chunks.map(async (chunk, i) => {
            console.log(`[Tour Generation] Starting TTS chunk ${i + 1}/${chunks.length}`);
            const bytes = await generateTTSBuffer(chunk);

            // Convert to base64 data URI
            let binary = '';
            const len = bytes.byteLength;
            for (let j = 0; j < len; j++) {
              binary += String.fromCharCode(bytes[j]);
            }
            const base64 = btoa(binary);
            const dataUri = `data:audio/mpeg;base64,${base64}`;
            
            console.log(`[TTS] Completed chunk ${i + 1} (${Math.round(base64.length / 1024)}KB)`);
            return { dataUri, index: i };
          });
          
          const ttsResults = await Promise.all(ttsPromises);
          
          if (!isMounted) {
            console.log("[Tour Generation] Component unmounted, stopping");
            return;
          }
          
          // Sort by index to maintain order
          ttsResults.sort((a, b) => a.index - b.index);
          ttsResults.forEach(result => {
            segmentUris.push(result.dataUri);
          });
          
          console.log(`[TTS] All ${chunks.length} chunks generated in parallel!`);
        }

        audioUrl = segmentUris[0] || "";

        console.log("[Tour Generation] Audio generation complete", {
          segments: segmentUris.length,
          firstUri: audioUrl.substring(0, 50),
        });

        (generatedContent as any).__audioSegments = segmentUris.map((uri, idx) => ({
          uri,
          startTime: segmentTimes[idx]?.startTime ?? 0,
          duration: segmentTimes[idx]?.duration ?? Math.floor((audioLength * 60) / Math.max(1, segmentUris.length)),
        }));
      } catch (ttsError: any) {
        console.error("[Tour Generation] TTS failed:", ttsError?.message || ttsError);

        if (!isMounted) return;

        const msg = String(ttsError?.message || ttsError || "").toLowerCase();
        let errorMessage = "Unable to generate audio. Please try again.";
        if (msg.includes("api key") || msg.includes("invalid api")) {
          errorMessage = "API configuration error. Please contact support.";
        } else if (msg.includes("rate limit") || msg.includes("429")) {
          errorMessage = "Too many requests. Please wait a moment and try again.";
        } else if (msg.includes("timeout") || msg.includes("aborted")) {
          errorMessage = "Request timed out. Please try again.";
        } else if (msg.includes("network") || msg.includes("fetch")) {
          errorMessage = "Network connection error. Please check your connection and try again.";
        } else if (ttsError?.message) {
          errorMessage = ttsError.message;
        }

        Alert.alert("Audio Generation Failed", errorMessage, [
          { text: "OK", onPress: resetFlow },
        ]);
        resetFlow();
        return;
      }

      if (!isMounted) {
        console.log("[Tour Generation] Component unmounted after TTS");
        return;
      }

      console.log("[Tour Generation] Audio generated successfully");

      const landmarks = tourType === "route" && generatedContent.landmarks
        ? generatedContent.landmarks.map((landmark: any, index: number) => ({
            id: `landmark_${tourId}_${index}`,
            name: landmark.name,
            description: landmark.description,
            coordinates: landmark.coordinates || {
              latitude: (locationCoords?.latitude || 0) + (Math.random() - 0.5) * 0.01,
              longitude: (locationCoords?.longitude || 0) + (Math.random() - 0.5) * 0.01,
            },
            // Each landmark corresponds to one audio segment with audioLengthForRoute duration
            audioTimestamp: index * (audioLengthForRoute * 60),
            order: index,
          }))
        : undefined;

      const chapters = (tourType === "immersive" || tourType === "landmark") && generatedContent.chapters
        ? generatedContent.chapters.map((chapter: any, index: number) => ({
            id: `chapter_${tourId}_${index}`,
            title: chapter.title || chapter.name || `Chapter ${index + 1}`,
            timestamp: chapter.timestamp || (index * (audioLength * 60) / (generatedContent.chapters.length || 1)),
            duration: chapter.duration || (audioLength * 60 / (generatedContent.chapters.length || 1)),
          }))
        : undefined;

      const cleanLocation = location.replace(/[\d\.\-,]+/g, '').replace(/\s+/g, ' ').trim().replace(/^[,\s]+|[,\s]+$/g, '');

      const finalAudioLength = (tourType === "route" ? audioLengthForRoute : audioLength) as AudioLength;
      
      const audioGuide: AudioGuide = {
        id: tourId,
        type: tourType,
        title: generatedContent.title || `${cleanLocation} ${tourType === "route" ? "Route" : tourType === "landmark" ? "Landmark" : "Immersive"} Tour`,
        description: generatedContent.description || `An engaging ${tourType === "route" ? `${numStops}-stop tour with ${audioLengthForRoute} minutes per stop` : `${audioLength}-minute audio tour`} exploring ${topicsString} in ${cleanLocation}.`,
        script: audioScript,
        location: cleanLocation,
        locationCoords: locationCoords || undefined,
        topics: tourType === "landmark" ? (selectedLandmarkTopics as any) : selectedTopics,
        areaSpecificity: "city",
        audioLength: finalAudioLength,
        transportMethod: tourType === "route" ? transportMethod : undefined,
        audioUrl,
        audioSegments: Array.isArray((generatedContent as any).__audioSegments)
          ? ((generatedContent as any).__audioSegments as any[])
              .map((s) => ({
                uri: String(s?.uri || ""),
                startTime: typeof s?.startTime === "number" ? s.startTime : 0,
                duration: typeof s?.duration === "number" ? s.duration : 0,
              }))
              .filter((s) => !!s.uri && s.duration > 0)
          : undefined,
        duration: tourType === "route" ? audioLengthForRoute * 60 * numStops : audioLength * 60,
        landmarks,
        chapters,
        createdAt: Date.now(),
      };

      console.log("[Tour Generation] Adding tour to library");
      console.log("[Tour Generation] Tour object:", JSON.stringify({
        id: audioGuide.id,
        title: audioGuide.title,
        type: audioGuide.type,
        hasAudio: audioGuide.audioUrl ? 'yes' : 'no',
        audioLength: audioGuide.audioUrl ? audioGuide.audioUrl.length : 0
      }));
      
      await addTour(audioGuide);
      console.log("[Tour Generation] Tour added to library successfully");
      
      incrementToursCreated();
      console.log("[Tour Generation] User tours incremented");
      
      console.log("[Tour Generation] Tour saved successfully");

      if (tourType === "route" && transportMethod === "walking") {
        console.log("[Tour Generation] Navigating to tour-ready screen");
        router.push({ pathname: "/tour-ready" as any, params: { tourId } } as any);
        resetFlow();
        return;
      }

      console.log("[Tour Generation] Navigating to library");
      router.push({ pathname: "/(tabs)/library" as any } as any);
      resetFlow();
    } catch (error) {
      console.error("[Tour Generation] Error:", error);
      console.error("[Tour Generation] Error type:", typeof error);
      console.error("[Tour Generation] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      if (!isMounted) {
        console.log("[Tour Generation] Component unmounted during error handling");
        return;
      }
      
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || JSON.stringify(error);
      }
      
      const lowerMsg = errorMessage.toLowerCase();
      let userMessage = errorMessage;
      
      if (lowerMsg.includes('network request failed') || lowerMsg.includes('failed to fetch')) {
        userMessage = "Network connection failed.\n\nTroubleshooting steps:\n1. Check your internet connection\n2. Try switching between WiFi and mobile data\n3. Disable any VPN or proxy\n4. Try a shorter tour (20 min) with fewer topics\n\nIf this persists, the AI service may be temporarily unavailable.";
      } else if (lowerMsg.includes('cannot reach') || lowerMsg.includes('cannot connect')) {
        userMessage = "Cannot connect to the AI service. Please check your internet connection and try again.";
      } else if (lowerMsg.includes('network') || lowerMsg.includes('connection')) {
        userMessage = "Network error. Please check your connection and try again. If using a restricted network, try mobile data.";
      } else if (lowerMsg.includes('timeout') || lowerMsg.includes('aborted')) {
        userMessage = "Request timed out. Try a shorter tour duration (20 minutes) or fewer topics.";
      }
      
      Alert.alert(
        "Generation Failed",
        userMessage,
        [{ text: "OK" }]
      );
      resetFlow();
    }
  };

  const renderWelcome = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <View style={styles.backgroundOrbital}>
        {renderOrbitalBackground()}
      </View>
      <View style={styles.welcomeContent}>
        <View style={styles.passportMascot}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/renps5x3u8toqdey782pi' }}
            style={styles.passportMascotImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeTitle}>Explore More With Custom AI Tours</Text>
        <Text style={styles.welcomeSubtitle}>Draw from dozens of academic & verified sources</Text>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => goToNextStep("tourType")}
        >
          <Text style={styles.ctaButtonText}>Create Tour Now</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderTourType = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Choose Your Tour Type</Text>
      <View style={styles.optionsVertical}>
        <TouchableOpacity
          style={styles.fullOptionCard}
          activeOpacity={0.85}
          onPress={() => handleTourTypeSelection("route")}
        >
          <View style={styles.fullOptionIcon}>
            <Route size={32} color={Colors.light.primary} />
          </View>
          <Text style={styles.fullOptionTitle}>Create a Custom Walking Tour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fullOptionCard}
          activeOpacity={0.85}
          onPress={() => handleTourTypeSelection("immersive")}
        >
          <View style={styles.fullOptionIcon}>
            <Headphones size={32} color={Colors.light.secondary} />
          </View>
          <Text style={styles.fullOptionTitle}>Create a General Audio Tour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fullOptionCard}
          activeOpacity={0.85}
          onPress={() => handleTourTypeSelection("landmark")}
        >
          <View style={styles.fullOptionIcon}>
            <Landmark size={32} color="#FF6B6B" />
          </View>
          <Text style={styles.fullOptionTitle}>Create a Tour for Your Current Landmark</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderLocation = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim, justifyContent: 'center' }]}>
      <Text style={styles.questionTitle}>Where Are You Exploring?</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <MapPin size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Enter city, region, or country"
            placeholderTextColor={Colors.light.textSecondary}
            value={location}
            onChangeText={setLocation}
            editable={!locationCoords}
            autoFocus
          />
          {locationCoords && (
            <TouchableOpacity onPress={clearLocation} style={styles.clearButton}>
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.currentLocationButton}
          activeOpacity={0.7}
          onPress={getCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <Text style={styles.currentLocationText}>Getting location...</Text>
            </>
          ) : (
            <>
              <Navigation size={18} color={Colors.light.primary} />
              <Text style={styles.currentLocationText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.ctaButton, !canProceedFromLocation && styles.ctaButtonDisabled]}
        activeOpacity={0.85}
        disabled={!canProceedFromLocation}
        onPress={() => goToNextStep("topics")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTopics = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim, justifyContent: 'center' }]}>
      <Text style={styles.questionTitle}>What Interests You?</Text>
      <Text style={styles.questionSubtitle}>Select one or more topics</Text>
      <View style={styles.topicsGrid}>
        {TOPICS.map((topic) => {
          const Icon = iconMap[topic.icon as keyof typeof iconMap];
          const isSelected = selectedTopics.includes(topic.id);
          return (
            <TouchableOpacity
              key={topic.id}
              style={[
                styles.topicChip,
                isSelected && styles.topicChipSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => toggleTopic(topic.id)}
            >
              <Icon
                size={18}
                color={
                  isSelected ? Colors.light.background : Colors.light.text
                }
              />
              <Text
                style={[
                  styles.topicChipText,
                  isSelected && styles.topicChipTextSelected,
                ]}
              >
                {topic.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[styles.ctaButton, !canProceedFromTopics && styles.ctaButtonDisabled]}
        activeOpacity={0.85}
        disabled={!canProceedFromTopics}
        onPress={() => goToNextStep(tourType === "route" ? "transport" : "audioLength")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAudioLength = () => {
    const landmarkLengths = [15, 30, 40].map((min) => ({
      value: min as AudioLength,
      time: `${min} min`,
    }));
    
    const lengthsToShow = tourType === "landmark" ? landmarkLengths : AUDIO_LENGTHS;

    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>
          {tourType === "route" ? "Audio Duration Per Stop" : "How Long Should It Be?"}
        </Text>
        {tourType === "route" && (
          <Text style={styles.questionSubtitle}>
            Each landmark will get this amount of detailed audio content
          </Text>
        )}
        <View style={styles.lengthGrid}>
          {lengthsToShow.map((length) => (
            <TouchableOpacity
              key={length.value}
              style={[
                styles.lengthCard,
                audioLength === length.value && styles.lengthCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => setAudioLength(length.value)}
            >
              <Clock
                size={24}
                color={
                  audioLength === length.value
                    ? Colors.light.primary
                    : Colors.light.textSecondary
                }
              />
              <Text
                style={[
                  styles.lengthText,
                  audioLength === length.value && styles.lengthTextSelected,
                ]}
              >
                {length.time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => {
            if (tourType === "route") {
              goToNextStep("transport");
            } else {
              handleGenerate();
            }
          }}
        >
          <Text style={styles.ctaButtonText}>{tourType === "route" ? "Continue" : "Generate Tour"}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTransport = () => {
    const customTransportOptions = [
      { value: "walking" as TransportMethod, label: "Walking", description: "Walk to all stops", icon: "Footprints" },
      { value: "walking_transit" as TransportMethod, label: "Walking and/or Commuting", description: "Use public transit, car, or bus between stops", icon: "Train" },
    ];
    
    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>How Will You Travel?</Text>
        <View style={styles.optionsVertical}>
          {customTransportOptions.map((method) => {
            const Icon = iconMap[method.icon as keyof typeof iconMap];
            return (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.simpleOptionCard,
                  transportMethod === method.value && styles.simpleOptionCardSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setTransportMethod(method.value)}
              >
                <Icon size={24} color={Colors.light.primary} style={styles.transportIcon} />
                <View style={styles.simpleOptionContent}>
                  <Text style={styles.simpleOptionLabel}>{method.label}</Text>
                  <Text style={styles.simpleOptionDescription}>
                    {method.description}
                  </Text>
                </View>
                {transportMethod === method.value && (
                  <View style={styles.selectedIndicator} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => goToNextStep("travelTime")}
        >
          <Text style={styles.ctaButtonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTravelTime = () => {
    const travelTimeOptions = [
      { value: 10 as const, label: "10 min" },
      { value: 20 as const, label: "20 min" },
      { value: 25 as const, label: "25 min" },
    ];

    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>Most You're Willing to Spend Traveling</Text>
        <Text style={styles.questionSubtitle}>
          {transportMethod === "walking_transit" && travelTime === 25 
            ? "Max 25 minutes on train, car, or bus between stops" 
            : `Maximum travel time between stops${transportMethod === "walking" ? " on foot" : ""}`}
        </Text>
        <View style={styles.lengthGrid}>
          {travelTimeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.lengthCard,
                travelTime === option.value && styles.lengthCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => setTravelTime(option.value)}
            >
              <Clock
                size={24}
                color={
                  travelTime === option.value
                    ? Colors.light.primary
                    : Colors.light.textSecondary
                }
              />
              <Text
                style={[
                  styles.lengthText,
                  travelTime === option.value && styles.lengthTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => goToNextStep("numStops")}
        >
          <Text style={styles.ctaButtonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderNumStops = () => {
    const stopOptions = [
      { value: 3 as const, label: "3 stops" },
      { value: 5 as const, label: "5 stops" },
      { value: 7 as const, label: "7 stops" },
    ];

    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>How Many Stops Do You Want?</Text>
        <View style={styles.lengthGrid}>
          {stopOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.lengthCard,
                numStops === option.value && styles.lengthCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => setNumStops(option.value)}
            >
              <MapPin
                size={24}
                color={
                  numStops === option.value
                    ? Colors.light.primary
                    : Colors.light.textSecondary
                }
              />
              <Text
                style={[
                  styles.lengthText,
                  numStops === option.value && styles.lengthTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => goToNextStep("timePerStop")}
        >
          <Text style={styles.ctaButtonText}>Continue</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTimePerStop = () => {
    const timePerStopOptions = [
      { value: 7 as const, label: "7 min" },
      { value: 15 as const, label: "15 min" },
      { value: 20 as const, label: "20 min" },
    ];

    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>Max Time at Each Stop</Text>
        <Text style={styles.questionSubtitle}>
          How long should the audio content be for each location?
        </Text>
        <View style={styles.lengthGrid}>
          {timePerStopOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.lengthCard,
                timePerStop === option.value && styles.lengthCardSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => setTimePerStop(option.value)}
            >
              <Clock
                size={24}
                color={
                  timePerStop === option.value
                    ? Colors.light.primary
                    : Colors.light.textSecondary
                }
              />
              <Text
                style={[
                  styles.lengthText,
                  timePerStop === option.value && styles.lengthTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={handleGenerate}
        >
          <Text style={styles.ctaButtonText}>Generate Tour</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderLandmarkDiscovery = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim, justifyContent: 'center' }]}>
      <Text style={styles.questionTitle}>Which Landmark Are You At?</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <MapPin size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Enter landmark name (e.g. British Museum)"
            placeholderTextColor={Colors.light.textSecondary}
            value={location}
            onChangeText={handleLocationTextChange}
            autoFocus
          />
          {location && (
            <TouchableOpacity onPress={clearLocation} style={styles.clearButton}>
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {showSuggestions && placeSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {isLoadingSuggestions && (
              <View style={styles.suggestionLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
              </View>
            )}
            {placeSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={suggestion.placeId}
                style={[
                  styles.suggestionItem,
                  index === placeSuggestions.length - 1 && styles.suggestionItemLast,
                ]}
                activeOpacity={0.7}
                onPress={() => selectSuggestion(suggestion)}
              >
                <Landmark size={18} color={Colors.light.primary} />
                <Text style={styles.suggestionText}>{suggestion.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.currentLocationButton}
          activeOpacity={0.7}
          onPress={findNearestLandmark}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <Text style={styles.currentLocationText}>Finding landmark...</Text>
            </>
          ) : (
            <>
              <Navigation size={18} color={Colors.light.primary} />
              <Text style={styles.currentLocationText}>Auto-Detect Nearest Landmark</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.ctaButton, !location.trim() && styles.ctaButtonDisabled]}
        activeOpacity={0.85}
        disabled={!location.trim()}
        onPress={loadTopicsForLandmark}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderLandmarkTopicsLoading = () => (
    <View style={[styles.centeredContainer, { justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.generatingTitle}>Loading All Available Information</Text>
      <Text style={styles.generatingText}>Please do not close the app</Text>
    </View>
  );

  const renderLandmarkTopics = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Here Are Some Topics That May Be Relevant</Text>
      <Text style={styles.questionSubtitle}>Please choose a few to include in your audio tour</Text>
      <ScrollView
        style={styles.landmarkTopicsScroll}
        contentContainerStyle={styles.landmarkTopicsContainer}
        showsVerticalScrollIndicator={false}
      >
        {suggestedTopics.map((topic, index) => {
          const isSelected = selectedLandmarkTopics.includes(topic);
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.landmarkTopicBubble,
                isSelected && styles.landmarkTopicBubbleSelected,
              ]}
              activeOpacity={0.7}
              onPress={() => toggleLandmarkTopic(topic)}
            >
              <Text
                style={[
                  styles.landmarkTopicText,
                  isSelected && styles.landmarkTopicTextSelected,
                ]}
              >
                {topic}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={[
          styles.ctaButton,
          selectedLandmarkTopics.length === 0 && styles.ctaButtonDisabled,
        ]}
        activeOpacity={0.85}
        disabled={selectedLandmarkTopics.length === 0}
        onPress={() => goToNextStep("audioLength")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderGenerating = () => (
    <View style={[styles.centeredContainer, { justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.generatingTitle}>Creating Your Tour</Text>
      <Text style={styles.generatingText}>This may take 30-60 seconds</Text>
      <Text style={styles.generatingHint}>Please do not close the app</Text>
    </View>
  );

  const renderContent = () => {
    switch (flowStep) {
      case "welcome":
        return renderWelcome();
      case "tourType":
        return renderTourType();
      case "location":
        return renderLocation();
      case "landmarkDiscovery":
        return renderLandmarkDiscovery();
      case "landmarkTopicsLoading":
        return renderLandmarkTopicsLoading();
      case "landmarkTopics":
        return renderLandmarkTopics();
      case "topics":
        return renderTopics();
      case "transport":
        return renderTransport();
      case "travelTime":
        return renderTravelTime();
      case "numStops":
        return renderNumStops();
      case "timePerStop":
        return renderTimePerStop();
      case "audioLength":
        return renderAudioLength();
      case "generating":
        return renderGenerating();
      default:
        return renderWelcome();
    }
  };

  const handleSubscribe = (tier: SubscriptionTier) => {
    console.log("[Subscription] User selected tier:", tier);
    setIsProcessingSubscription(true);
    
    setTimeout(() => {
      upgradeTier(tier);
      setIsProcessingSubscription(false);
      setShowPaywall(false);
      
      Alert.alert(
        "Subscription Activated!",
        `Welcome to ${tier === "weekly" ? "Weekly" : "Annual"} Premium! You now have unlimited access to AI tours.`,
        [
          {
            text: "Continue",
            onPress: () => {
              handleGenerate();
            },
          },
        ]
      );
    }, 1500);
  };

  const showBackButton = flowStep !== "welcome" && flowStep !== "generating" && flowStep !== "landmarkTopicsLoading";

  return (
    <LinearGradient
      colors={["#FAFBFC", "#F0F4F8"]}
      locations={[0, 1]}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        {/* TEMPORARY: Button to view onboarding */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 9999,
            backgroundColor: Colors.light.primary,
            padding: 12,
            borderRadius: 8,
          }}
          onPress={() => router.push('/onboarding' as any)}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>View Onboarding</Text>
        </TouchableOpacity>
        
        {showBackButton && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={goToPreviousStep}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.light.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </SafeAreaView>
      
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSubscribe={handleSubscribe}
        isProcessing={isProcessingSubscription}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 32,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 20,
    paddingTop: 8,
  },
  welcomeGlobeContainer: {
    position: "absolute" as const,
    top: -80,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 0,
    opacity: 0.25,
  },
  welcomeGlobeImage: {
    width: 420,
    height: 420,
  },
  welcomeContent: {
    zIndex: 1,
    alignItems: "center",
    width: "100%",
    marginTop: 52,
    paddingHorizontal: 4,
    gap: 4,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: -0.8,
    paddingHorizontal: 18,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 0,
    paddingHorizontal: 32,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  ctaButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  ctaButtonDisabled: {
    backgroundColor: Colors.light.border,
    opacity: 0.4,
  },
  ctaButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  questionTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  questionSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: -4,
    lineHeight: 20,
  },
  optionsVertical: {
    width: "100%",
    gap: 16,
  },
  fullOptionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  fullOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fullOptionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: Colors.light.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  fullOptionSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  inputWrapper: {
    width: "100%",
    gap: 12,
    alignItems: "stretch",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.light.border,
    width: "100%",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  clearButton: {
    padding: 4,
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currentLocationText: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  suggestionsContainer: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "500",
  },
  suggestionLoadingContainer: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.light.card,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  topicChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  topicChipTextSelected: {
    color: Colors.light.background,
  },
  simpleOptionCard: {
    backgroundColor: Colors.light.card,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
    width: "100%",
  },
  simpleOptionCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  simpleOptionContent: {
    flex: 1,
  },
  simpleOptionLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  simpleOptionDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  selectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.primary,
  },
  transportIcon: {
    marginLeft: 4,
  },
  lengthGrid: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    justifyContent: "center",
    alignItems: "stretch",
  },
  lengthCard: {
    flex: 1,
    backgroundColor: Colors.light.card,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  lengthCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  lengthText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  lengthTextSelected: {
    color: Colors.light.primary,
  },
  generatingTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
  },
  generatingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 0,
  },
  generatingProgress: {
    fontSize: 15,
    color: Colors.light.primary,
    textAlign: "center",
    fontWeight: "600",
    marginTop: 0,
  },
  progressBarContainer: {
    width: "100%",
    marginTop: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
    width: "100%",
  },
  generatingHint: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  landmarkTopicsScroll: {
    width: "100%",
    maxHeight: 400,
  },
  landmarkTopicsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  landmarkTopicBubble: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  landmarkTopicBubbleSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  landmarkTopicText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
  landmarkTopicTextSelected: {
    color: Colors.light.background,
  },
  backgroundOrbital: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.1975,
    zIndex: 0,
  },
  orbitalContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  passportMascot: {
    width: 173,
    height: 173,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -8,
  },
  passportMascotImage: {
    width: 173,
    height: 173,
  },
  orbit: {
    position: "absolute" as const,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: "solid" as const,
  },
  planeIcon: {
    position: "absolute" as const,
    alignItems: "center",
    justifyContent: "center",
  },
  dotTop: {
    top: -8,
    left: "50%",
    transform: [{ translateX: -8 }],
  },
  dotBottom: {
    bottom: -8,
    left: "50%",
    transform: [{ translateX: -8 }],
  },
  dotLeft: {
    left: -8,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
  dotRight: {
    right: -8,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
});
