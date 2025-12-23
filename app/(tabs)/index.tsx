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
import { File, Paths } from "expo-file-system";
import { generateText } from "@rork-ai/toolkit-sdk";

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

import { trpc } from "@/lib/trpc";
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

type FlowStep = "welcome" | "tourType" | "location" | "landmarkDiscovery" | "landmarkTopicsLoading" | "landmarkTopics" | "topics" | "audioLength" | "transport" | "generating";

export default function ExploreScreen() {
  const router = useRouter();
  const { addTour } = useTours();
  const { incrementToursCreated, canCreateTour, upgradeTier } = useUser();
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [tourType, setTourType] = useState<"route" | "immersive" | "landmark" | null>(null);
  const [location, setLocation] = useState<string>("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [audioLength, setAudioLength] = useState<AudioLength>(20);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("walking");
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedLandmarkTopics, setSelectedLandmarkTopics] = useState<string[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<{ name: string; placeId: string; types: string[] }[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = useState<boolean>(false);
  
  const generateTTSMutation = trpc.tts.generate.useMutation();
  const [connectionStatus, setConnectionStatus] = useState<string>("checking");

  useEffect(() => {
    void pingBackend();
  }, []);

  const pingBackend = async (): Promise<boolean> => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
      if (!baseUrl) {
        setConnectionStatus("error");
        return false;
      }

      const response = await fetch(`${baseUrl}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setConnectionStatus("connected");
        console.log("[Connection Check] Backend is reachable");
        return true;
      }

      setConnectionStatus("error");
      console.error("[Connection Check] Backend returned error:", response.status);
      return false;
    } catch (error) {
      setConnectionStatus("error");
      console.error("[Connection Check] Failed to reach backend:", error);
      return false;
    }
  };
  
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
    fadeAnim.setValue(0);
    setFlowStep(step);
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
      case "audioLength":
        if (tourType === "landmark") {
          setFlowStep("landmarkTopics");
        } else {
          setFlowStep("topics");
        }
        break;
      case "transport":
        setFlowStep("audioLength");
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
    setAudioLength(20);
    setTransportMethod("walking");
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

      const response = await generateText({
        messages: [{ role: "user", content: prompt }],
      });

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



  const checkNetworkConnectivity = async (): Promise<boolean> => {
    try {
      console.log("[Network Check] Testing connectivity...");
      const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
      if (!baseUrl) {
        console.error("[Network Check] No base URL configured");
        return false;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${baseUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log("[Network Check] Health check status:", response.status);
      return response.ok;
    } catch (error) {
      console.error("[Network Check] Failed:", error);
      return false;
    }
  };

  const handleGenerate = async () => {
    if (connectionStatus === 'error') {
      Alert.alert(
        'Connection Error',
        'Cannot reach the server. Please check your internet connection and try again.',
        [
          { text: 'Retry', onPress: async () => {
            await pingBackend();
            setTimeout(() => handleGenerate(), 100);
          }},
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
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
    const isConnected = await checkNetworkConnectivity();
    
    if (!isConnected) {
      Alert.alert(
        "Connection Error",
        "Cannot connect to the server. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
      return;
    }

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

      const systemPrompt = tourType === "landmark" 
        ? `=== LANDMARK AUDIO TOUR GENERATION SYSTEM ===

You are a world-class museum guide and historian creating an in-depth, engaging audio tour about a specific landmark. Your narration is passionate, informative, and story-driven.

=== CORE PRINCIPLES ===

1. DEEP DIVE INTO THE LOCATION
   - This is about ONE specific place: ${location}
   - Go deep into its history, architecture, significance, and stories
   - Connect the selected topics to the landmark's narrative
   - Each topic should be a distinct chapter with its own story arc

2. CHAPTER-BASED STRUCTURE
   - Each selected topic becomes a clear chapter
   - Give each chapter a compelling title
   - Include timestamps for chapter transitions
   - Smooth transitions between chapters

3. RICH STORYTELLING
   - Use vivid descriptions and sensory details
   - Share anecdotes, legends, and lesser-known facts
   - Bring historical figures and events to life
   - Include specific dates, measurements, and data points

4. CONVERSATIONAL TONE
   - Direct address to the listener
   - Rhetorical questions to engage
   - "Imagine..." and "Picture this..." to create scenes
   - Balance facts with narrative flow

=== TOUR PARAMETERS ===

- Landmark: ${location}
- Duration: ${audioLength} minutes
- Selected Topics: ${topicsString}
- Current Season: ${season} (${currentMonth} ${currentYear})

=== CRITICAL RULES ===

- Focus ENTIRELY on ${location}
- Each of the ${selectedLandmarkTopics.length} topics should be a clear chapter
- Include specific historical dates, dimensions, and facts
- Reference current season and any relevant events
- NO generic travel advice
- Target length: ~${audioLength * 150} words
- Create natural chapter breaks aligned with topics

=== YOUR MISSION ===

Create an immersive, educational audio tour that makes ${location} come alive through the selected topics.`
        : `=== AUDIO TOUR GENERATION SYSTEM ===

You are a world-class travel guide creating immersive audio tours. Your narration is confident, precise, and story-driven—like a sharp local friend who knows the city beyond the postcard version.

=== CORE PRINCIPLES (NON-NEGOTIABLE) ===

1. PERSONALIZATION BY INTERESTS (THIS IS THE POINT)
   - The user's selected topics are not decoration: they must materially change what you cover, which places you choose, and which stories you tell.
   - For each selected topic (${topicsString}), include at least 2 concrete, location-specific moments (people, places, events, institutions, neighborhoods, or scenes) that directly reflect that interest.

2. GO BEYOND THE OBVIOUS (ESPECIALLY SMALL TOWNS)
   - If ${location} is a smaller town or a city with a compact tourist core, do NOT stay in the same downtown loop.
   - Pull in distinctive narratives that make this place feel singular: industries, migration patterns, border dynamics, ports/logistics, music scenes, university towns, local sports culture, agriculture, manufacturing, faith communities, civic life, or modern development.
   - If tour type is immersive (general/city-wide), deliberately cover multiple parts of the city: historic core + at least one residential/affluent district + at least one economic hub (malls, markets, industrial zones, campuses, ports, warehouses) + one everyday "third place" (park, plaza, riverside, neighborhood strip).

3. USE DATA PEOPLE CARE ABOUT (NO TRIVIA)
   - Use numbers only when they add meaning: growth, scale, money, people, time, trade, cultural impact.
   - Do NOT include random stats like temperature, latitude/longitude, or throwaway measurements.
   - Weave quantitative facts throughout, not all at the start.
   - Make numbers relatable with comparisons (stadiums, football fields, city blocks, time periods).

4. SOURCE AWARENESS (LIGHT TOUCH, NATURAL)
   - Use real, varied sources as inspiration for unique details: census/ACS, local economic development reports, port/trade/industry reports, major employers, recent local news themes, museum placards, city planning language, university publications.
   - Cite lightly and naturally: "According to the city’s economic report...", "Local reporting has focused on...", "Census estimates suggest...".

5. TONE: DIRECT, NOT RUSHED, NOT FLOWERY
   - Avoid phrases like "let's get started real quick" or anything that sounds like rushing.
   - Skip flowery travel-blog language.
   - Use crisp sensory details sparingly (one sharp line beats a paragraph).

=== STRUCTURE (STREAMLINED) ===

1. HOOK (0:00-0:30)
   - Location name + one high-signal fact or tension (history, identity, economy, culture).

2. ORIENTATION (0:30-1:00)
   - Set the mental map: what areas we'll cover and why, based on the user's interests.

3. THE TOUR (CORE CONTENT)
   - Each stop/segment should: (a) name the place/area, (b) give a story, (c) drop one high-impact data point (if relevant), (d) connect back to the user's interests.
   - For route tours: stops must be realistic and reachable via ${transportMethod}.

4. OUTRO (FINAL 30 SECONDS)
   - One memorable takeaway tied to the user's interests + a final "where to next" suggestion.

=== TOUR PARAMETERS ===

- Location: ${location}
- Duration: ${audioLength} minutes
- Topics (user interests): ${topicsString}
- Type: ${tourType === "route" ? "Route with navigation" : "Immersive listening"}
- Current Season: ${season} (${currentMonth} ${currentYear})
${tourType === "route" ? `- Transport: ${transportMethod}` : ""}

=== CRITICAL RULES ===

- NO coordinate numbers, latitude/longitude, or GPS values in the script
- NO random weather/temperature stats
- NO filler / no "real quick" / no rushed phrasing
- Target length: ~${audioLength * 150} words
- Natural sentence breaks for text-to-speech conversion

=== YOUR MISSION ===

Create a tour that feels custom-made for this user in this place, using their interests to choose what matters, and covering more than the obvious tourist core.`;

      const numLandmarks = tourType === "route" ? Math.floor(audioLength / 5) : 0;
      const maxLandmarksForTime = Math.min(Math.max(numLandmarks, 4), 10);

      const userMessage = tourType === "landmark"
        ? `Create an in-depth audio tour about ${location} covering these specific topics: ${topicsString}.

Return JSON with:
- title: Engaging title for the landmark tour
- description: 2-3 sentence description
- script: Full detailed spoken script for a ${audioLength}-minute audio tour (~${audioLength * 150} words). Write as if you're standing at ${location} and narrating directly to the visitor. Make it immersive and educational.
- chapters: Array of ${selectedLandmarkTopics.length} chapters, one for each topic. Each chapter needs:
  - title: The topic name or engaging chapter title
  - timestamp: When this chapter starts (in seconds)
  - duration: How long this chapter lasts (in seconds)
  
Make sure chapters align with the selected topics and cover the full ${audioLength}-minute duration.`
        : `Create an audio tour for ${location} covering ${topicsString}.

Return JSON with:
- title: Catchy title
- description: 2-3 sentence description  
- script: Full detailed spoken script for a ${audioLength}-minute audio tour (~${audioLength * 150} words). Write it as if you're the narrator speaking directly to the listener. Include an engaging introduction, detailed information about each topic, interesting stories and facts, and a memorable conclusion. Make it flow naturally as spoken narration.
${tourType === "route" ? `- landmarks: Array of ${maxLandmarksForTime} real landmarks near ${location} with {name, description, coordinates: {latitude, longitude}, timestamp}. These should be actual places reachable via ${transportMethod}.\n- famousLandmarkRecommendation: OPTIONAL - If there is a world-famous landmark (like Sagrada Familia in Barcelona or Eiffel Tower in Paris) that exists in this city but is far from the user's current location coordinates, include: {name, reason, estimatedDistance}\n- hasFewLandmarks: OPTIONAL - Boolean true if this area has very few actual landmarks (less than ${maxLandmarksForTime}) and you'd recommend an immersive tour instead` : "- chapters: Array of chapters with {title, timestamp, duration}"}`;

      console.log("[Tour Generation] Calling AI...");

      const response = await generateText({
        messages: [
          { role: "user", content: systemPrompt + "\n\n" + userMessage },
        ],
      });

      if (!isMounted) {
        console.log("[Tour Generation] Component unmounted, aborting");
        return;
      }

      console.log("[Tour Generation] AI response received");

      if (!response || response.trim().length === 0) {
        throw new Error("Empty response from AI");
      }

      let generatedContent;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);        
        generatedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch (parseError) {
        console.error("[Tour Generation] JSON parse error:", parseError);
        generatedContent = {};
      }

      let audioScript = generatedContent.script || "Welcome to this audio tour of " + location + ". Unfortunately, we couldn't generate the full content at this time. Please try again.";
      
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

      let audioUrl: string = '';
      
      const generateAudioChunk = async (text: string, retryCount = 0): Promise<string> => {
        try {
          console.log(`[TTS] Generating audio chunk, text length: ${text.length}, attempt: ${retryCount + 1}`);
          
          if (retryCount === 0) {
            const ok = await pingBackend();
            if (!ok) {
              throw new Error("Cannot reach backend server. Please check your internet connection.");
            }
          }
          
          const sanitized = sanitizeTextForTTS(text);
          console.log(`[TTS] Text length after sanitization: ${sanitized.length}`);
          
          const result = await generateTTSMutation.mutateAsync({
            text: sanitized,
            voice: 'alloy',
            speed: 1.0,
          });
          
          if (!result.success || !result.audioData) {
            throw new Error('Failed to generate audio');
          }
          
          console.log(`[TTS] Chunk generated successfully`);
          return result.audioData;
        } catch (error: any) {
          console.error(`[TTS] Error generating chunk (attempt ${retryCount + 1}):`, error);
          
          const errorMsg = error?.message || String(error);
          const isNetworkError = errorMsg.toLowerCase().includes('network') || 
                                errorMsg.toLowerCase().includes('fetch') || 
                                errorMsg.toLowerCase().includes('connection') ||
                                errorMsg.toLowerCase().includes('failed to reach');
          
          const isTimeout = errorMsg.toLowerCase().includes('timeout') ||
                           errorMsg.toLowerCase().includes('aborted');
          
          if ((isNetworkError || isTimeout) && retryCount < 3) {
            const delay = Math.min(3000 * Math.pow(2, retryCount), 10000);
            console.log(`[TTS] ${isTimeout ? 'Timeout' : 'Network error'} detected, retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return generateAudioChunk(text, retryCount + 1);
          }
          
          if (isNetworkError) {
            throw new Error('Network connection lost. Please check your internet connection and try again.');
          }
          
          if (isTimeout) {
            throw new Error('Request timed out. The server may be busy. Please try again in a moment.');
          }
          
          throw error;
        }
      };
      
      try {
        console.log("[Tour Generation] Generating TTS audio...");
        
        const chunks = splitIntoChunks(audioScript, { minChars: 200, maxChars: 300 });
        console.log(`[Tour Generation] Split script into ${chunks.length} chunks`);
        
        const audioBlobs: string[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          if (!isMounted) {
            console.log("[Tour Generation] Component unmounted, stopping");
            return;
          }
          
          console.log(`[Tour Generation] Processing chunk ${i + 1}/${chunks.length}`);
          
          try {
            const audioData = await generateAudioChunk(chunks[i]);
            audioBlobs.push(audioData);
            console.log(`[Tour Generation] Chunk ${i + 1}/${chunks.length} completed`);
          } catch (chunkError: any) {
            const errorMsg = chunkError?.message || String(chunkError);
            console.error(`[Tour Generation] Chunk ${i + 1} failed:`, errorMsg);
            
            if (errorMsg.toLowerCase().includes('network')) {
              throw new Error(`Network connection lost during audio generation. Please check your internet connection and try again.`);
            } else if (errorMsg.toLowerCase().includes('timeout')) {
              throw new Error(`Request timed out. The server may be overloaded. Please try again in a moment.`);
            } else {
              throw new Error(`Audio generation failed at chunk ${i + 1}: ${errorMsg}`);
            }
          }
        }
        
        console.log("[Tour Generation] All chunks generated, creating audio file...");
        
        const base64ToBytes = (b64: string): Uint8Array => {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        };

        const totalBytes = audioBlobs.reduce((sum, b64) => {
          try {
            const padded = b64.replace(/\s+/g, "").replace(/=+$/g, "");
            const len = Math.floor((padded.length * 3) / 4);
            return sum + len;
          } catch {
            return sum;
          }
        }, 0);

        console.log("[Tour Generation] Estimated combined audio size:", Math.round(totalBytes / 1024), "KB");

        const combinedBytes: number[] = [];
        for (const b64 of audioBlobs) {
          const cleanB64 = b64.replace(/\s+/g, "");
          const bytes = base64ToBytes(cleanB64);
          for (let i = 0; i < bytes.length; i++) combinedBytes.push(bytes[i]);
        }

        const finalBytes = Uint8Array.from(combinedBytes);

        if (Platform.OS === "web") {
          const blob = new Blob([finalBytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          audioUrl = url;
          console.log("[Tour Generation] Web audio blob URL created");
        } else {
          const file = new File(Paths.cache, `tour_${tourId}.mp3`);
          file.create({ overwrite: true });
          file.write(finalBytes);
          audioUrl = file.uri;
          console.log("[Tour Generation] Native audio file saved:", file.uri);
        }
        
        console.log("[Tour Generation] Audio generation complete");
      } catch (ttsError: any) {
        console.error("[Tour Generation] TTS failed:", ttsError?.message || ttsError);
        
        if (!isMounted) return;
        
        let errorMessage = "Unable to generate audio. Please try again.";
        if (ttsError?.message) {
          const msg = ttsError.message.toLowerCase();
          if (msg.includes('api key')) {
            errorMessage = "API configuration error. Please contact support.";
          } else if (msg.includes('rate limit') || msg.includes('429')) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
          } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
            errorMessage = "Network connection error. Please check your internet connection and try again.";
          } else if (msg.includes('timeout')) {
            errorMessage = "Request timed out. Please try again with a shorter tour or better connection.";
          } else if (msg.includes('chunk') || msg.includes('audio generation failed')) {
            errorMessage = ttsError.message;
          }
        }
        
        Alert.alert(
          "Audio Generation Failed",
          errorMessage,
          [{ text: "OK", onPress: resetFlow }]
        );
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
            audioTimestamp: landmark.timestamp || (index * (audioLength * 60) / generatedContent.landmarks.length),
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

      const audioGuide: AudioGuide = {
        id: tourId,
        type: tourType,
        title: generatedContent.title || `${cleanLocation} ${tourType === "route" ? "Route" : tourType === "landmark" ? "Landmark" : "Immersive"} Tour`,
        description: generatedContent.description || `An engaging ${audioLength}-minute audio tour exploring ${topicsString} in ${cleanLocation}.`,
        script: audioScript,
        location: cleanLocation,
        locationCoords: locationCoords || undefined,
        topics: tourType === "landmark" ? (selectedLandmarkTopics as any) : selectedTopics,
        areaSpecificity: "city",
        audioLength,
        transportMethod: tourType === "route" ? transportMethod : undefined,
        audioUrl,
        duration: audioLength * 60,
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
        Alert.alert(
          "Tour Created!",
          "Your walking tour is ready.",
          [
            {
              text: "Start Tour",
              onPress: () => router.push(`/tour-ready?tourId=${tourId}`),
            },
            {
              text: "View Library",
              onPress: () => router.push("/library"),
            },
          ]
        );

        resetFlow();
        return;
      }

      Alert.alert(
        "Tour Created!",
        "Your audio tour has been generated and added to your library.",
        [
          {
            text: "View Library",
            onPress: () => router.push("/library"),
          },
          {
            text: "Create Another",
            onPress: resetFlow,
          },
        ]
      );
      
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
      
      if (lowerMsg.includes('network request failed')) {
        userMessage = "Network connection failed. Please check your internet connection and try again. If you're on mobile, try switching between WiFi and cellular data.";
      } else if (lowerMsg.includes('cannot reach backend')) {
        userMessage = "Cannot connect to the server. Please check your internet connection and try again.";
      } else if (lowerMsg.includes('network') || lowerMsg.includes('connection')) {
        userMessage = "Network error occurred. Please check your connection and try again. If the problem persists, try restarting the app.";
      } else if (lowerMsg.includes('timeout')) {
        userMessage = "Request timed out. The server may be busy. Please try again in a moment or choose a shorter tour duration.";
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
        onPress={() => goToNextStep("audioLength")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAudioLength = () => {
    const landmarkLengths = [20, 30, 40].map((min) => ({
      value: min as AudioLength,
      time: `${min} min`,
    }));
    
    const lengthsToShow = tourType === "landmark" ? landmarkLengths : AUDIO_LENGTHS;

    return (
      <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
        <Text style={styles.questionTitle}>How Long Should It Be?</Text>
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

  const renderTransport = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>How Will You Travel?</Text>
      <View style={styles.optionsVertical}>
        {TRANSPORT_METHODS.map((method) => {
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
        onPress={handleGenerate}
      >
        <Text style={styles.ctaButtonText}>Generate Tour</Text>
      </TouchableOpacity>
    </Animated.View>
  );

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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.generatingTitle}>Loading All Available Information</Text>
      <Text style={styles.generatingText}>Please do not close the app</Text>
    </Animated.View>
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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim, justifyContent: 'center' }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.generatingTitle}>Creating Your Tour</Text>
      <Text style={styles.generatingHint}>Please do not close the app</Text>
    </Animated.View>
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
      case "audioLength":
        return renderAudioLength();
      case "transport":
        return renderTransport();
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
