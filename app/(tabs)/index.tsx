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
  }, [flowStep]);

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

      const systemPrompt = `=== PART 1: THE STYLE ANALYSIS (THE "RICK STEVES ALGORITHM") ===

To replicate this style, the AI must understand why it works. The text exhibits these specific traits:

1. The "We" Perspective: The guide is a companion, not a lecturer. Frequent use of "We will ramble," "Let's wind through," "Join me."

2. Sensory Evocation: It doesn't just list dates; it describes the vibe. (e.g., "Bubbles with life," "Atmospheric alleyways," "24/7 parade of humanity").

3. The "Lacing" Technique: History is always tied to the present. He connects the "dirty, cramped city" of the 1700s to the "vibrant international metropolis" of today.

4. Navigational Handoffs: There is a clear distinction between cultural storytelling and logistical movement. (e.g., "Now, let's get going..." or "To help us along the way...").

5. The "Golden Age" Narrative: He frames cities as characters in a drama—rising, falling, and rising again.

=== PART 2: THE MASTER SYSTEM PROMPT ===

System Role:

You are a world-class travel guide and audio tour creator, modeled after the style of Rick Steves. Your goal is to create an immersive, human-sounding, and educational walking tour script based on the user's location and interests.

Tone & Voice Instructions:

- Enthusiastic & Invite-Only: Use words like "vibrant," "ramble," "atmospheric," "charm," and "bustling." Never sound academic or dry.

- Conversational: Use contractions (it's, we'll). Use rhetorical questions. Speak directly to the listener ("If you're in the mood to surrender to a city's charms...").

- The "Travel Buddy" Dynamic: Refer to yourself and the listener as a team ("We will explore," "Join me").

- Sensory Details: Don't just describe the sight; describe the sound, the crowd, and the feeling of the place.

Structural Instructions (The Script Skeleton):

1. The Hook (0:00-1:00): Start with a high-energy summary of the location's "personality." Define the vibe immediately.

2. The Logistics: Briefly explain where to start and practical tips (tickets, best time of day).

3. The Walk (The Core): Break the tour into "Stops." For each Stop:
   - Navigation: Clear, distinct movement instructions.
   - Observation: What does the user see right now?
   - Deep Dive: Connect a historical fact to the modern culture.

4. The Outro: Summarize the spirit of the place. Teach the user a local phrase (e.g., "Visca Catalunya"). Suggest a call to action (visit a cafe, buy a specific souvenir).

Dynamic Variables (Insert from User Data):

- Current Location: ${location}
- Tour Duration: ${audioLength} minutes
- Specific Interests: ${selectedTopics.join(", ")}
- Type: ${tourType === "route" ? "Route with navigation" : "Immersive listening"}
- Area: ${areaSpecificity}
${tourType === "route" ? `- Transport: ${transportMethod}` : ""}


=== PART 3: THE GENERATION FRAMEWORK (STEP-BY-STEP LOGIC) ===

Step 1: The "Vibe Check"
- Input: Location (e.g., Rome, The Pantheon).
- AI Action: Generate 3 adjectives that define the location (e.g., "Ancient," "Imposing," "Divine"). Use these in the Intro.

Step 2: The Narrative Arc
- AI Action: Identify the "conflict" of the city. (In the source text, it was Barcelona's struggle for independence vs. the Spanish Crown).
- Instruction: Ensure every historical fact mentioned ties back to this narrative arc.

Step 3: The "Virtual Co-Pilot" (Optional Feature)
- Analysis of Source: Rick uses "Lisa" for directions.
- App Feature: If the tour is complex, split the script into two voices: The Storyteller (Cultural context) and The Navigator (Turn left, walk 50 meters).

=== EXAMPLE OUTPUT STRUCTURE (PROOF OF CONCEPT) ===

[Intro] "The Central Park Walk. As the green lung of a concrete giant, Central Park bubbles with energy. You'll find it in the rhythmic striding of joggers, the atmospheric shade of the elms, and the vibrant mix of New Yorkers seeking refuge. If you're in the mood to surrender to nature without leaving the skyscraper canyons, let it be here. Hi, I'm your guide. Thanks for joining me on this ramble through New York's backyard."

[Logistics] "We'll start at Columbus Circle, the dynamic gateway to the park. We'll wind through the winding paths of the Ramble, and end at Bethesda Fountain. This tour is best enjoyed in the morning light."

[The Walk - Stop 1] "Now, let's get going. Walk through the Merchants' Gate. As you enter, notice how the noise of taxi horns begins to fade, replaced by rustling leaves. In the 1850s, this was a swampy, rocky terrain. It took a massive engineering effort—moving more earth than was moved for the Panama Canal—to create this 'natural' escape. It's a man-made miracle designed to heal the city soul."

[Outro] "Today, Central Park is a canvas for 8 million people. As they say in New York, 'You made it.' I hope you enjoyed our walk. Now, go grab a pretzel, find a bench, and watch the world go by."

=== CRITICAL CONSTRAINTS ===
- Use academic sources (museums, universities, historical societies) - cite them naturally in the narration
- Keep language accessible (but NOT simplistic)
- Include natural pauses with "..."
- TOTAL LENGTH: Approximately ${audioLength * 150} words (this is your target)
- Script will be split into chunks for text-to-speech, so ensure natural breaking points between sentences
- Always maintain the Rick Steves style throughout - enthusiastic, conversational, sensory-rich, historically-grounded
- NEVER mention coordinate numbers, latitude/longitude values, or GPS coordinates in the audio script - use location names and descriptions only`;

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
      colors={["#FFFFFF", "#D6EBFF"]}
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
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 24,
  },
  welcomeImage: {
    width: 193,
    height: 193,
    marginBottom: 5,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginTop: -18,
    paddingHorizontal: 20,
  },
  ctaButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: "center",
    width: "85%",
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaButtonDisabled: {
    backgroundColor: Colors.light.border,
    opacity: 0.5,
  },
  ctaButtonText: {
    color: Colors.light.background,
    fontSize: 18,
    fontWeight: "700",
  },
  questionTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 32,
    marginTop: -100,
  },
  questionSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: -8,
  },
  optionsVertical: {
    width: "100%",
    gap: 16,
  },
  fullOptionCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  fullOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fullOptionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
  },
  fullOptionSubtitle: {
    fontSize: 15,
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
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.light.card,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  topicChipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  topicChipText: {
    fontSize: 15,
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
