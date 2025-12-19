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
import { Topic, AudioLength, TransportMethod, AudioGuide } from "@/types";
import { useTours } from "@/contexts/ToursContext";
import { useUser } from "@/contexts/UserContext";
import { trpc } from "@/lib/trpc";

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
  const { incrementToursCreated } = useUser();
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [tourType, setTourType] = useState<"route" | "immersive" | "landmark" | null>(null);
  const [location, setLocation] = useState<string>("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [audioLength, setAudioLength] = useState<AudioLength>(20);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("walking");
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedLandmarkTopics, setSelectedLandmarkTopics] = useState<string[]>([]);
  
  const generateTTSMutation = trpc.tts.generate.useMutation();
  
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
    setGenerationProgress("");
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
          <View style={[styles.planeIcon, styles.dotTop]}>
            <Plane size={16} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotBottom]}>
            <Plane size={16} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
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
          <View style={[styles.planeIcon, styles.dotTop]}>
            <Plane size={14} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotRight]}>
            <Plane size={14} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotBottom]}>
            <Plane size={14} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
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
          <View style={[styles.planeIcon, styles.dotTop]}>
            <Plane size={12} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotRight]}>
            <Plane size={12} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotBottom]}>
            <Plane size={12} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
          <View style={[styles.planeIcon, styles.dotLeft]}>
            <Plane size={12} color={Colors.light.primary} fill={Colors.light.primary} />
          </View>
        </Animated.View>
      </View>
    );
  };

  const canProceedFromLocation = location.trim() !== "";
  const canProceedFromTopics = selectedTopics.length > 0;
  const canGenerate = tourType === "landmark" 
    ? location.trim() !== "" && selectedLandmarkTopics.length > 0
    : location.trim() !== "" && selectedTopics.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate || !tourType) {
      console.log("[Tour Generation] Cannot generate: missing requirements");
      return;
    }

    goToNextStep("generating");
    setGenerationProgress("Preparing your audio tour...");
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

You are a world-class travel guide creating immersive, fast-paced audio tours. Your narration is energetic, data-driven, and conversational—like a knowledgeable friend who cuts through the fluff.

=== CORE STYLE PRINCIPLES ===

1. GET TO THE POINT FAST
   - Skip lengthy introductions and filler phrases
   - Lead with the most compelling fact or vibe
   - Example: "Barcelona. Founded 15 BC. 1.6 million people. Let's go."

2. USE QUANTITATIVE DATA WITH IMPACT (DISTRIBUTED THROUGHOUT)
   - CRITICAL: DO NOT frontload all numbers and data at the start
   - Weave data naturally throughout the entire tour as you explore each location
   - Sprinkle facts, dates, and measurements where they create the most impact
   - Always include: founding years, population, dates of major events, dimensions
   - Make numbers relatable with comparisons:
     * Heights: "That's 3 Statues of Liberty stacked"
     * Distances: "About 5 football fields"
     * Time spans: "Older than the printing press"
     * Scale: "Could fit 50,000 people—more than a sold-out stadium"
   - Use data that listeners actually care about—skip boring statistics
   - Example: Instead of "The building is 828 meters tall", say "The building stretches 828 meters—nearly twice the height of the Empire State Building"
   - Let the user's selected interests guide where you place emphasis and detailed information

3. SEASONAL & EVENT-AWARE
   - Today's date: ${currentMonth} ${currentDate.getDate()}, ${currentYear} (${season})
   - Mention relevant festivals, events, or traditions happening now or soon
   - Reference seasonal characteristics (weather, crowds, local activities)
   - Example: "You're here in December—perfect timing for the Christmas markets"
   - Include upcoming festivals unique to the area within the next 2-3 months

4. CONVERSATIONAL & DIRECT
   - Use "we'll" and "let's" but skip flowery phrases
   - No "If you're in the mood to surrender to a city's charms"—just "Let's explore"
   - Rhetorical questions are fine but keep them punchy

5. SENSORY BUT EFFICIENT
   - Describe the vibe, sounds, energy—but in one sharp sentence
   - Example: "Narrow alleys echo with street musicians, espresso machines, and motor scooters"

=== STRUCTURE (STREAMLINED) ===

1. HOOK (0:00-0:30)
   - Location name + founding year/key stat
   - One punchy sentence on the vibe
   - What makes it unique (in numbers if possible)

2. QUICK LOGISTICS (0:30-1:00)
   - Where to start, any seasonal considerations
   - Best times based on current season

3. THE TOUR (CORE CONTENT)
   - Each stop: Blend engaging narrative with quantitative facts throughout
   - CRITICAL: Don't dump all data at the beginning—sprinkle facts naturally where they enhance the story
   - Use relatable comparisons for all measurements
   - Connect history to today with specific data points
   - Example: "Built in 1345. That's 200 years before Columbus sailed. Today, 20,000 visitors walk through daily"
   - Let the user's selected interests (${selectedTopics.join(", ")}) deeply influence the content, stories, and facts you include
   - If user selected "food", weave in culinary history, local dishes, and restaurant recommendations
   - If user selected "architecture", focus on building styles, construction techniques, and architectural movements
   - Tailor the narrative to match their interests—this is key to a personalized tour

4. OUTRO (FINAL 30 SECONDS)
   - Summary stat (total years of history, number of landmarks covered)
   - Seasonal/event callout if relevant
   - Quick local phrase or action item

=== TOUR PARAMETERS ===

- Location: ${location}
- Duration: ${audioLength} minutes
- Topics: ${topicsString}
- Type: ${tourType === "route" ? "Route with navigation" : "Immersive listening"}
- Current Season: ${season} (${currentMonth} ${currentYear})
${tourType === "route" ? `- Transport: ${transportMethod}` : ""}

=== CRITICAL RULES ===

- ALWAYS use quantitative data: years, populations, dimensions, dates
- ALWAYS use relatable comparisons for measurements (football fields, buildings, etc.)
- ALWAYS mention current season/month and relevant festivals or events
- NO coordinate numbers, latitude/longitude, or GPS values in the script
- NO boring data points—only stats that create wonder or context
- NO filler words—every sentence must deliver value
- Target length: ~${audioLength * 150} words
- Cite sources naturally ("According to the National Museum...")
- Natural sentence breaks for text-to-speech conversion

=== EXAMPLE (SHORTENED) ===

"Florence. Founded 59 BC by Julius Caesar. Population: 380,000. But 16 million tourists visit yearly—that's 42 visitors for every resident. Let's dive in.

We're starting at the Duomo. Completed in 1436 after 140 years of construction. The dome spans 45 meters—wide enough to park 12 city buses side by side. Brunelleschi engineered it without scaffolding, a feat that stumped architects for decades.

You're here in ${currentMonth}—${season === 'spring' ? 'perfect for the Scoppio del Carro Easter festival' : season === 'summer' ? 'expect crowds but longer days' : season === 'fall' ? 'ideal weather and the wine harvest season' : 'smaller crowds and Christmas markets starting soon'}.

Next, walk 200 meters to the Uffizi..."

=== YOUR MISSION ===

Create an audio tour that's data-rich, fast-paced, seasonally aware, and uses relatable comparisons. Cut the fluff. Get to the good stuff immediately.`;

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

      setGenerationProgress("Creating tour content...");
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
      
      audioScript = audioScript.replace(/\b\d+\.\d+\s*(degrees?|°)?\s*(north|south|east|west|N|S|E|W|latitude|longitude|lat|lon|long)?[,\s]*\d+\.\d+\s*(degrees?|°)?\s*(north|south|east|west|N|S|E|W|latitude|longitude|lat|lon|long)?\b/gi, '').replace(/\blatitude[:\s]+[\d\.\-]+[,\s]*longitude[:\s]+[\d\.\-]+\b/gi, '').replace(/\bcoordinates?[:\s]+[\d\.\-,\s°NSEW]+\b/gi, '').replace(/\b[\d\.\-]+\s*,\s*[\d\.\-]+\b/g, (match: string) => {
        if (match.match(/^\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/)) {
          return '';
        }
        return match;
      }).replace(/\s+/g, ' ').trim();

      setGenerationProgress("Generating audio narration...");
      console.log("[Tour Generation] Generating audio from script...");
      console.log("[Tour Generation] Script length:", audioScript.length, "characters");
      console.log("[Tour Generation] Script preview:", audioScript.substring(0, 200) + "...");

      let audioUrl: string = '';
      
      const splitTextIntoChunks = (text: string, maxChars: number = 4000): string[] => {
        const chunks: string[] = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChars) {
            currentChunk += sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            if (sentence.length > maxChars) {
              const words = sentence.split(' ');
              let wordChunk = '';
              for (const word of words) {
                if ((wordChunk + ' ' + word).length <= maxChars) {
                  wordChunk += (wordChunk ? ' ' : '') + word;
                } else {
                  if (wordChunk) chunks.push(wordChunk.trim());
                  wordChunk = word;
                }
              }
              if (wordChunk) currentChunk = wordChunk;
            } else {
              currentChunk = sentence;
            }
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        
        return chunks;
      };
      
      try {
        console.log("[Tour Generation] Generating TTS audio...");
        
        const chunks = splitTextIntoChunks(audioScript);
        console.log(`[Tour Generation] Split script into ${chunks.length} chunks`);
        
        const audioBlobs: (Blob | string)[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          setGenerationProgress(`Generating audio (${i + 1}/${chunks.length})...`);
          console.log(`[Tour Generation] Processing chunk ${i + 1}/${chunks.length}, length: ${chunks[i].length} chars`);
          
          const ttsResult = await generateTTSMutation.mutateAsync({
            text: chunks[i],
            voice: "alloy",
            speed: 1.0,
          });

          console.log(`[Tour Generation] TTS response for chunk ${i + 1}: success=${ttsResult.success}`);

          if (!ttsResult.success || !ttsResult.audioData) {
            throw new Error(`Failed to generate audio for chunk ${i + 1}`);
          }

          audioBlobs.push(ttsResult.audioData);
        }
        
        setGenerationProgress("Merging audio files...");
        console.log("[Tour Generation] Merging", audioBlobs.length, "audio chunks");
        
        console.log("[Tour Generation] Creating audio URL...");
        
        if (audioBlobs.length === 1 && typeof audioBlobs[0] === 'string') {
          const base64Audio = audioBlobs[0];
          
          if (Platform.OS === 'web') {
            audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
            console.log("[Tour Generation] Web data URL created (single chunk)");
          } else {
            const file = new File(Paths.cache, `tour_${tourId}.mp3`);
            console.log("[Tour Generation] Saving to file:", file.uri);
            
            const bytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
            file.create({ overwrite: true });
            file.write(bytes);
            
            audioUrl = file.uri;
            console.log("[Tour Generation] Native file saved:", file.uri);
          }
        } else if (audioBlobs.length > 1) {
          const combinedBase64 = (audioBlobs as string[]).join('');
          
          if (Platform.OS === 'web') {
            audioUrl = `data:audio/mpeg;base64,${combinedBase64}`;
            console.log("[Tour Generation] Web data URL created (multiple chunks merged)");
          } else {
            const file = new File(Paths.cache, `tour_${tourId}.mp3`);
            console.log("[Tour Generation] Saving to file:", file.uri);
            
            const bytes = Uint8Array.from(atob(combinedBase64), c => c.charCodeAt(0));
            file.create({ overwrite: true });
            file.write(bytes);
            
            audioUrl = file.uri;
            console.log("[Tour Generation] Native file saved:", file.uri);
          }
        }
        
        console.log("[Tour Generation] TTS audio generated successfully");
      } catch (ttsError: any) {
        console.error("[Tour Generation] TTS generation failed:", ttsError);
        console.error("[Tour Generation] Error details:", ttsError?.message);
        
        if (!isMounted) {
          console.log("[Tour Generation] Component unmounted during TTS error");
          return;
        }
        
        const errorMsg = ttsError?.message || "Unknown TTS error";
        
        Alert.alert(
          "Audio Generation Failed",
          `Unable to generate audio narration: ${errorMsg}. The tour will be saved without audio. You can try generating it again later.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => { resetFlow(); } },
            { text: "Save Without Audio", onPress: () => { audioUrl = ''; } }
          ]
        );
        
        if (!audioUrl) {
          setGenerationProgress("");
          resetFlow();
          return;
        }
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

      setGenerationProgress("Finalizing your tour...");
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
      
      if (!isMounted) {
        console.log("[Tour Generation] Component unmounted during error handling");
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(
        "Generation Failed",
        `We couldn't generate your tour: ${errorMessage}. Please check your connection and try again.`,
        [{ text: "OK" }]
      );
      resetFlow();
    } finally {
      if (isMounted) {
        setGenerationProgress("");
      }
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
            source={{ uri: 'https://r2-pub.rork.com/generated-images/0b053cc8-ad50-435d-bd48-406d9822595f.png' }}
            style={styles.passportMascotImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeTitle}>Create Your Custom AI Audio Tour</Text>
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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Where are you exploring?</Text>
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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>What interests you?</Text>
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
        <Text style={styles.questionTitle}>How long should it be?</Text>
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
      <Text style={styles.questionTitle}>How will you travel?</Text>
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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Which landmark are you at?</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.inputContainer}>
          <MapPin size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Enter landmark name (e.g. British Museum)"
            placeholderTextColor={Colors.light.textSecondary}
            value={location}
            onChangeText={setLocation}
            autoFocus
          />
          {location && (
            <TouchableOpacity onPress={() => setLocation("")} style={styles.clearButton}>
              <X size={18} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
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
      <Text style={styles.generatingText}>Please wait...</Text>
    </Animated.View>
  );

  const renderLandmarkTopics = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Here are some topics that may be relevant</Text>
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
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <ActivityIndicator size="large" color={Colors.light.primary} />
      <Text style={styles.generatingTitle}>Creating Your Tour</Text>
      {generationProgress && (
        <Text style={styles.generatingProgress}>{generationProgress}</Text>
      )}
      <Text style={styles.generatingText}>Please do not close the app</Text>
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
    justifyContent: "flex-start",
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
    gap: 16,
    width: "100%",
    marginTop: 200,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: -0.8,
    paddingHorizontal: 20,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: -12,
    paddingHorizontal: 40,
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
    marginTop: 12,
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
    fontWeight: "600",
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
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
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
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.light.border,
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
  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
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
    gap: 16,
    borderWidth: 2,
    borderColor: Colors.light.border,
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
    marginTop: -12,
  },
  generatingProgress: {
    fontSize: 15,
    color: Colors.light.primary,
    textAlign: "center",
    fontWeight: "600",
    marginTop: -8,
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
    opacity: 0.0975,
    zIndex: 0,
  },
  orbitalContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  passportMascot: {
    marginBottom: 8,
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  passportMascotImage: {
    width: 140,
    height: 140,
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
