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
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import {
  MapPin,
  Route,
  Headphones,
  BookOpen,
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
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { File, Paths } from "expo-file-system";
import { generateText } from "@rork-ai/toolkit-sdk";

import Colors from "@/constants/colors";
import {
  TOPICS,
  AUDIO_LENGTHS,
  AREA_SPECIFICITY,
  TRANSPORT_METHODS,
} from "@/mocks/tours";
import { Topic, AreaSpecificity, AudioLength, TransportMethod, AudioGuide } from "@/types";
import { useTours } from "@/contexts/ToursContext";
import { useUser } from "@/contexts/UserContext";
import { generateTTS } from "@/lib/tts-client";

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

type FlowStep = "welcome" | "tourType" | "location" | "topics" | "areaSpecificity" | "audioLength" | "transport" | "generating";

export default function ExploreScreen() {
  const router = useRouter();
  const { addTour } = useTours();
  const { incrementToursCreated } = useUser();
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [tourType, setTourType] = useState<"route" | "immersive" | null>(null);
  const [location, setLocation] = useState<string>("");
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [areaSpecificity, setAreaSpecificity] = useState<AreaSpecificity>("city");
  const [audioLength, setAudioLength] = useState<AudioLength>(20);
  const [transportMethod, setTransportMethod] = useState<TransportMethod>("walking");
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [flowStep, fadeAnim]);

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
      case "topics":
        setFlowStep("location");
        break;
      case "areaSpecificity":
        setFlowStep("topics");
        break;
      case "audioLength":
        setFlowStep("areaSpecificity");
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
    setAreaSpecificity("city");
    setAudioLength(20);
    setTransportMethod("walking");
    setGenerationProgress("");
    fadeAnim.setValue(0);
  };

  const handleTourTypeSelection = (type: "route" | "immersive") => {
    setTourType(type);
    goToNextStep("location");
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

  const canProceedFromLocation = location.trim() !== "";
  const canProceedFromTopics = selectedTopics.length > 0;
  const canGenerate = location.trim() !== "" && selectedTopics.length > 0;

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

      const systemPrompt = `=== AUDIO TOUR GENERATION SYSTEM ===

You are a world-class travel guide creating immersive, fast-paced audio tours. Your narration is energetic, data-driven, and conversational—like a knowledgeable friend who cuts through the fluff.

=== CORE STYLE PRINCIPLES ===

1. GET TO THE POINT FAST
   - Skip lengthy introductions and filler phrases
   - Lead with the most compelling fact or vibe
   - Example: "Barcelona. Founded 15 BC. 1.6 million people. Let's go."

2. USE QUANTITATIVE DATA WITH IMPACT
   - Always include: founding years, population, dates of major events, dimensions
   - Make numbers relatable with comparisons:
     * Heights: "That's 3 Statues of Liberty stacked"
     * Distances: "About 5 football fields"
     * Time spans: "Older than the printing press"
     * Scale: "Could fit 50,000 people—more than a sold-out stadium"
   - Use data that listeners actually care about—skip boring statistics
   - Example: Instead of "The building is 828 meters tall", say "The building stretches 828 meters—nearly twice the height of the Empire State Building"

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
   - Each stop: Lead with a quantitative fact, then context
   - Use relatable comparisons for all measurements
   - Connect history to today with specific data points
   - Example: "Built in 1345. That's 200 years before Columbus sailed. Today, 20,000 visitors walk through daily"

4. OUTRO (FINAL 30 SECONDS)
   - Summary stat (total years of history, number of landmarks covered)
   - Seasonal/event callout if relevant
   - Quick local phrase or action item

=== TOUR PARAMETERS ===

- Location: ${location}
- Duration: ${audioLength} minutes
- Topics: ${selectedTopics.join(", ")}
- Type: ${tourType === "route" ? "Route with navigation" : "Immersive listening"}
- Area: ${areaSpecificity}
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

      const userMessage = `Create an audio tour for ${location} covering ${selectedTopics.join(", ")}.

Return JSON with:
- title: Catchy title
- description: 2-3 sentence description  
- script: Full detailed spoken script for a ${audioLength}-minute audio tour (~${audioLength * 150} words). Write it as if you're the narrator speaking directly to the listener. Include an engaging introduction, detailed information about each topic, interesting stories and facts, and a memorable conclusion. Make it flow naturally as spoken narration.
${tourType === "route" ? `- landmarks: Array of ${maxLandmarksForTime} real landmarks within the user's area (${areaSpecificity}) with {name, description, coordinates: {latitude, longitude}, timestamp}. These should be actual places reachable via ${transportMethod}.\n- famousLandmarkRecommendation: OPTIONAL - If there is a world-famous landmark (like Sagrada Familia in Barcelona or Eiffel Tower in Paris) that exists in this city but is far from the user's current location coordinates, include: {name, reason, estimatedDistance}\n- hasFewLandmarks: OPTIONAL - Boolean true if this area has very few actual landmarks (less than ${maxLandmarksForTime}) and you'd recommend an immersive tour instead` : "- chapters: Array of chapters with {title, timestamp, duration}"}`;

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
          
          const ttsResult = await generateTTS({
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

      const chapters = generatedContent.chapters
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
        title: generatedContent.title || `${cleanLocation} ${tourType === "route" ? "Route" : "Immersive"} Tour`,
        description: generatedContent.description || `An engaging ${audioLength}-minute audio tour exploring ${selectedTopics.join(", ")} in ${cleanLocation}.`,
        script: audioScript,
        location: cleanLocation,
        locationCoords: locationCoords || undefined,
        topics: selectedTopics,
        areaSpecificity,
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
      <Image 
        source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/laveu4s1oij0t2h4rsl79" }} 
        style={styles.welcomeImage}
        resizeMode="contain"
      />
      <Text style={styles.welcomeTitle}>Create Your Custom AI Audio Tour</Text>
      <Text style={styles.welcomeSubtitle}>Draw from dozens of academic & verified sources</Text>
      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => goToNextStep("tourType")}
      >
        <Text style={styles.ctaButtonText}>Create Tour Now</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTourType = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>Do you want to:</Text>
      <View style={styles.optionsVertical}>
        <TouchableOpacity
          style={styles.fullOptionCard}
          activeOpacity={0.85}
          onPress={() => handleTourTypeSelection("route")}
        >
          <View style={styles.fullOptionIcon}>
            <Route size={32} color={Colors.light.primary} />
          </View>
          <Text style={styles.fullOptionTitle}>Walk Around Landmarks</Text>
          <Text style={styles.fullOptionSubtitle}>With a custom path</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fullOptionCard}
          activeOpacity={0.85}
          onPress={() => handleTourTypeSelection("immersive")}
        >
          <View style={styles.fullOptionIcon}>
            <Headphones size={32} color={Colors.light.secondary} />
          </View>
          <Text style={styles.fullOptionTitle}>Listen While Doing</Text>
          <Text style={styles.fullOptionSubtitle}>Something else</Text>
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
        onPress={() => goToNextStep("areaSpecificity")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAreaSpecificity = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>What&apos;s your focus?</Text>
      <View style={styles.optionsVertical}>
        {AREA_SPECIFICITY.map((area) => (
          <TouchableOpacity
            key={area.value}
            style={[
              styles.simpleOptionCard,
              areaSpecificity === area.value && styles.simpleOptionCardSelected,
            ]}
            activeOpacity={0.7}
            onPress={() => setAreaSpecificity(area.value)}
          >
            <View style={styles.simpleOptionContent}>
              <Text style={styles.simpleOptionLabel}>{area.label}</Text>
              <Text style={styles.simpleOptionDescription}>
                {area.description}
              </Text>
            </View>
            {areaSpecificity === area.value && (
              <View style={styles.selectedIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => goToNextStep("audioLength")}
      >
        <Text style={styles.ctaButtonText}>Continue</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAudioLength = () => (
    <Animated.View style={[styles.centeredContainer, { opacity: fadeAnim }]}>
      <Text style={styles.questionTitle}>How long should it be?</Text>
      <View style={styles.lengthGrid}>
        {AUDIO_LENGTHS.map((length) => (
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
      case "topics":
        return renderTopics();
      case "areaSpecificity":
        return renderAreaSpecificity();
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

  const showBackButton = flowStep !== "welcome" && flowStep !== "generating";

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
    paddingVertical: 32,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 20,
  },
  welcomeImage: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: -12,
    paddingHorizontal: 32,
    lineHeight: 22,
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
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 28,
    marginTop: -80,
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
    gap: 10,
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
    fontWeight: "600",
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
});
