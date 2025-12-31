import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Image as RNImage,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  AppState,
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon, Volume2, FileText, Sparkles, MessageCircle, X, ArrowLeft, Send } from "lucide-react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";

import Colors from "@/constants/colors";
import { generateText, generateTTS } from "@/lib/supabase-functions";
import { sanitizeTextForTTS, splitIntoChunks } from "@/lib/text-sanitizer";
import { configureAudioForLockScreen, enableNowPlayingControls } from "@/lib/audio-config";

type ViewMode = "text" | "audio";

type ImageExifLocation = {
  latitude: number;
  longitude: number;
} | null;

export default function DiscoverScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [locationInfo, setLocationInfo] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const intendedPlayingRef = useRef<boolean>(false);
  const [showQuestionModal, setShowQuestionModal] = useState<boolean>(false);
  const [aiQuestionResponse, setAiQuestionResponse] = useState<string>("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [imageExifLocation, setImageExifLocation] = useState<ImageExifLocation>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  // Set up audio mode for lock screen playback
  useEffect(() => {
    void configureAudioForLockScreen().catch(e => {
      console.error("[Discover] Audio mode setup error:", e);
    });
  }, []);

  // Maintain audio mode when screen locks or app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await configureAudioForLockScreen().catch(e => {
          console.error("[Discover] Error maintaining audio mode", e);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        console.log("[Discover] Unloading sound");
        sound.unloadAsync().catch(err => {
          console.error("[Discover] Error unloading sound:", err);
        });
      }
    };
  }, [sound]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  // Wave animation for analyzing state
  useEffect(() => {
    if (isAnalyzing) {
      const createWaveAnimation = (animValue: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 600,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const wave1 = createWaveAnimation(waveAnim1, 0);
      const wave2 = createWaveAnimation(waveAnim2, 150);
      const wave3 = createWaveAnimation(waveAnim3, 300);

      wave1.start();
      wave2.start();
      wave3.start();

      return () => {
        wave1.stop();
        wave2.stop();
        wave3.stop();
        waveAnim1.setValue(0);
        waveAnim2.setValue(0);
        waveAnim3.setValue(0);
      };
    }
  }, [isAnalyzing]);

  // Extract GPS coordinates from EXIF data
  const extractLocationFromExif = (exif: any): ImageExifLocation => {
    if (!exif) return null;
    
    try {
      console.log("[Discover] EXIF data keys:", Object.keys(exif));
      
      // expo-image-picker returns EXIF in different formats
      let latitude: number | null = null;
      let longitude: number | null = null;
      let latRef: string | null = null;
      let lngRef: string | null = null;
      
      // Check for GPSLatitude and GPSLongitude (common format)
      if (exif.GPSLatitude !== undefined) {
        latitude = exif.GPSLatitude;
        longitude = exif.GPSLongitude;
        latRef = exif.GPSLatitudeRef;
        lngRef = exif.GPSLongitudeRef;
      }
      
      // Also check for {GPS} object format (iOS)
      if (latitude === null && exif['{GPS}']) {
        const gps = exif['{GPS}'];
        latitude = gps.Latitude;
        longitude = gps.Longitude;
        latRef = gps.LatitudeRef;
        lngRef = gps.LongitudeRef;
      }
      
      // Check for lowercase versions
      if (latitude === null && exif.gps) {
        latitude = exif.gps.latitude ?? exif.gps.Latitude;
        longitude = exif.gps.longitude ?? exif.gps.Longitude;
        latRef = exif.gps.latitudeRef ?? exif.gps.LatitudeRef;
        lngRef = exif.gps.longitudeRef ?? exif.gps.LongitudeRef;
      }

      console.log("[Discover] Raw EXIF GPS:", { latitude, longitude, latRef, lngRef });

      if (latitude !== null && longitude !== null) {
        // Ensure they're numbers
        let lat = typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
        let lng = typeof longitude === 'number' ? longitude : parseFloat(String(longitude));
        
        // Apply GPS reference direction
        // EXIF stores coordinates as positive values with a reference (N/S, E/W)
        // South latitudes should be negative, West longitudes should be negative
        if (latRef === 'S' || latRef === 's') {
          lat = -Math.abs(lat);
        }
        if (lngRef === 'W' || lngRef === 'w') {
          lng = -Math.abs(lng);
        }
        
        console.log("[Discover] Processed coordinates:", { lat, lng, latRef, lngRef });
        
        // Validate coordinates are reasonable
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          console.log("[Discover] Extracted EXIF location:", { latitude: lat, longitude: lng });
          return { latitude: lat, longitude: lng };
        }
      }
      
      console.log("[Discover] No valid GPS data in EXIF");
      return null;
    } catch (error) {
      console.error("[Discover] Error extracting EXIF location:", error);
      return null;
    }
  };

  // Reverse geocode coordinates to get location name
  const reverseGeocodeCoordinates = async (latitude: number, longitude: number): Promise<string> => {
    try {
      console.log("[Discover] Reverse geocoding:", { latitude, longitude });
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            "User-Agent": "SoloBuddy/1.0",
            "Accept": "application/json",
          },
        }
      );
      const geocodeData = await geocodeResponse.json();
      
      const locationParts = [
        geocodeData.address?.city ||
          geocodeData.address?.town ||
          geocodeData.address?.village ||
          geocodeData.address?.county,
        geocodeData.address?.state,
        geocodeData.address?.country,
      ];
      
      const locationString = locationParts.filter(Boolean).join(", ");
      return locationString || "Unknown location";
    } catch (error) {
      console.error("[Discover] Reverse geocode error:", error);
      return "Location unavailable";
    }
  };

  // Get location ONLY from photo EXIF metadata - never uses device location
  const getPhotoLocation = async (): Promise<{ name: string; coords: ImageExifLocation } | null> => {
    if (!imageExifLocation) {
      console.log("[Discover] No EXIF location in photo metadata");
      return null;
    }
    
    console.log("[Discover] Using EXIF location from photo metadata:", imageExifLocation);
    const locationName = await reverseGeocodeCoordinates(
      imageExifLocation.latitude,
      imageExifLocation.longitude
    );
    return { name: locationName, coords: imageExifLocation };
  };

  const requestPermissions = async () => {
    if (Platform.OS !== "web") {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraPermission.status !== "granted" || mediaLibraryPermission.status !== "granted") {
        Alert.alert(
          "Permissions Required",
          "Camera and photo library access are needed to use this feature."
        );
        return false;
      }
    }
    return true;
  };

  const handleTakePhoto = async () => {
    console.log("[Discover] Taking photo...");
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        exif: true, // Request EXIF data including GPS
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Discover] Photo captured");
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        
        // Extract location from EXIF if available
        const exifLocation = extractLocationFromExif(asset.exif);
        setImageExifLocation(exifLocation);
        if (exifLocation) {
          console.log("[Discover] Photo has GPS location from EXIF");
        }
        
        setAnalysisResult(null);
        setAudioUrl(null);
        animateIn();
      }
    } catch (error: any) {
      console.error("[Discover] Camera error:", error);
      const errorMessage = error?.message || "";
      
      // Check if running in simulator (camera not available)
      if (errorMessage.includes("simulator") || errorMessage.includes("not available")) {
        Alert.alert(
          "Camera Not Available",
          "The camera is not available in the iOS Simulator. Please use a physical device, or tap 'Upload Photo' to select an image from the photo library instead.",
          [
            { text: "OK", style: "default" },
            { 
              text: "Upload Photo", 
              onPress: () => handleUploadPhoto(),
              style: "default"
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to take photo. Please try again.");
      }
    }
  };

  const handleUploadPhoto = async () => {
    console.log("[Discover] Uploading photo...");
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        exif: true, // Request EXIF data including GPS
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Discover] Photo selected");
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        
        // Extract location from EXIF if available
        const exifLocation = extractLocationFromExif(asset.exif);
        setImageExifLocation(exifLocation);
        if (exifLocation) {
          console.log("[Discover] Photo has GPS location from EXIF - will use for identification");
        } else {
          console.log("[Discover] Photo has no GPS location in EXIF - will analyze visually only");
        }
        
        setAnalysisResult(null);
        setAudioUrl(null);
        animateIn();
      }
    } catch (error) {
      console.error("[Discover] Upload error:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) {
      console.log("[Discover] No image selected");
      return;
    }

    setIsAnalyzing(true);
    console.log("[Discover] Starting analysis...");

    try {
      // Get location ONLY from photo EXIF metadata
      const photoLocation = await getPhotoLocation();
      if (photoLocation) {
        setLocationInfo(photoLocation.name);
        console.log("[Discover] Photo was taken in:", photoLocation.name);
      } else {
        setLocationInfo(null);
        console.log("[Discover] No location metadata in photo - analyzing visually only");
      }

      const base64Image = await convertImageToBase64(selectedImage);
      
      if (!base64Image) {
        throw new Error("Failed to convert image");
      }

      // Build system prompt - include location hint if available from photo metadata
      const locationContext = photoLocation 
        ? `\n\nIMPORTANT CONTEXT: The photo metadata indicates this image was taken in ${photoLocation.name} (coordinates: ${photoLocation.coords?.latitude.toFixed(4)}, ${photoLocation.coords?.longitude.toFixed(4)}). Use this location information to help identify what's in the image - look for famous landmarks, monuments, or points of interest in that area that match what you see.`
        : '';

      const systemPrompt = `You are an expert art historian, cultural guide, and landmark specialist. 
Analyze the provided image to give comprehensive information about what's shown.

Focus on:
- Identifying landmarks, buildings, monuments, or artworks
- Historical context and significance
- Architectural or artistic style
- Cultural importance
- Interesting facts and stories
- Practical visitor information if relevant${locationContext}

${photoLocation 
  ? `Since we know where this photo was taken, confidently identify the landmark based on both visual features AND the location. Name the specific place if you can identify it.` 
  : `Base your identification on visual analysis. If you're uncertain about the identification, make your best educated guess based on visual features.`}

Provide a detailed, engaging response as if you're a knowledgeable local guide.
Write 3-4 paragraphs with rich detail. Be conversational and enthusiastic.`;

      console.log("[Discover] Calling AI for analysis...");
      console.log("[Discover] Has location context:", !!photoLocation);
      
      const response = await generateText({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image", image: base64Image }
            ]
          }
        ],
      });

      if (!response || response.trim().length === 0) {
        throw new Error("Empty response from AI");
      }

      console.log("[Discover] Analysis complete");
      setAnalysisResult(response);
      animateIn();
    } catch (error) {
      console.error("[Discover] Analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(
        "Analysis Failed",
        `We couldn't analyze this image: ${errorMessage}. Please try again.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      if (uri.startsWith("data:")) {
        return uri;
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("[Discover] Base64 conversion error:", error);
      throw error;
    }
  };

  const generateAudioNarration = async () => {
    if (!analysisResult) {
      console.log("[Discover] No analysis result to generate audio from");
      return;
    }

    setIsGeneratingAudio(true);
    console.log("[Discover] Generating audio via Supabase...");

    try {
      // Split text into chunks for longer content (TTS API has ~4000 char limit per call)
      const chunks = splitIntoChunks(analysisResult, { minChars: 900, maxChars: 3400 });
      console.log(`[Discover] Split into ${chunks.length} chunk(s), total chars:`, analysisResult.length);

      if (chunks.length === 0) {
        throw new Error("No text to generate audio from");
      }

      // Generate audio for each chunk
      const audioChunks: Uint8Array[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const sanitized = sanitizeTextForTTS(chunk, 3400);
        console.log(`[Discover] Generating chunk ${i + 1}/${chunks.length}, length: ${sanitized.length}`);
        
        const ttsResult = await generateTTS({
          text: sanitized,
          voice: "alloy",
          speed: 1.0,
        });

        if (!ttsResult.success || !ttsResult.audioData) {
          throw new Error(`Failed to generate audio for chunk ${i + 1}`);
        }

        // Convert base64 to bytes
        const binaryString = atob(ttsResult.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        audioChunks.push(bytes);
        console.log(`[Discover] Chunk ${i + 1} generated: ${bytes.length} bytes`);
      }

      // Concatenate all audio chunks into a single buffer
      const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of audioChunks) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }
      console.log(`[Discover] Combined audio: ${combinedAudio.length} bytes from ${audioChunks.length} chunks`);

      if (Platform.OS === 'web') {
        const audioBlob = new Blob([combinedAudio], { type: 'audio/mpeg' });
        const generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);
      } else {
        // Convert to base64 for data URL
        let binary = '';
        for (let i = 0; i < combinedAudio.length; i++) {
          binary += String.fromCharCode(combinedAudio[i]);
        }
        const base64Audio = btoa(binary);
        const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;
        setAudioUrl(dataUrl);
      }
      
      console.log("[Discover] Audio generated successfully via Supabase");
    } catch (error) {
      console.error("[Discover] Audio generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert(
        "Audio Generation Failed",
        `Unable to generate audio narration: ${errorMessage}. Please check your connection and try again.`
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playAudio = async () => {
    if (!audioUrl) {
      console.log("[Discover] No audio URL available");
      return;
    }

    try {
      console.log("[Discover] Playing audio...");
      
      if (sound) {
        await sound.unloadAsync().catch(err => {
          console.warn("[Discover] Error unloading previous sound:", err);
        });
      }

      // Ensure audio mode is set before playing for lock screen support
      await configureAudioForLockScreen();

      intendedPlayingRef.current = true;
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      if (!newSound) {
        throw new Error("Failed to create sound object");
      }
      
      // Enable lock screen controls
      await enableNowPlayingControls(newSound);
      
      setSound(newSound);
      setIsPlayingAudio(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            console.log("[Discover] Audio finished");
            intendedPlayingRef.current = false;
            setIsPlayingAudio(false);
          } else {
            // Use intended state to prevent race conditions
            setIsPlayingAudio(intendedPlayingRef.current);
          }
        }
      });
    } catch (error) {
      console.error("[Discover] Audio playback error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to play audio: ${errorMessage}. Please try again.`);
      intendedPlayingRef.current = false;
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = async () => {
    if (!sound) return;
    
    try {
      console.log("[Discover] Stopping audio...");
      intendedPlayingRef.current = false;
      setIsPlayingAudio(false);
      
      const status = await sound.getStatusAsync();
      
      // Only try to stop if the sound is actually loaded and playing
      if (status.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        }
        // Seek to beginning so it can be played again from start
        await sound.setPositionAsync(0);
      }
      console.log("[Discover] Audio stopped");
    } catch (error: any) {
      // Ignore "Seeking interrupted" errors - this happens when audio is still loading
      const errorMessage = error?.message || "";
      if (!errorMessage.includes("Seeking interrupted")) {
        console.error("[Discover] Stop audio error:", error);
      }
      setIsPlayingAudio(false);
    }
  };

  const resetDiscovery = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setAudioUrl(null);
    setLocationInfo(null);
    setImageExifLocation(null);
    setViewMode("text");
    if (sound) {
      sound.unloadAsync().catch(err => {
        console.warn("[Discover] Error unloading sound during reset:", err);
      });
      setSound(null);
    }
    setIsPlayingAudio(false);
    setShowQuestionModal(false);
    setAiQuestionResponse("");
  };

  const openQuestionModal = () => {
    setShowQuestionModal(true);
    setAiQuestionResponse("");
    setCustomQuestion("");
    Animated.timing(modalFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeQuestionModal = () => {
    Animated.timing(modalFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowQuestionModal(false);
      setCustomQuestion("");
    });
  };

  const handleAskQuestion = async (question: string) => {
    if (!question.trim() || !analysisResult) return;

    setIsLoadingQuestion(true);
    setAiQuestionResponse("");
    setCustomQuestion("");

    try {
      console.log("[Discover] Asking question:", question);
      const context = `Analysis of the image:\n${analysisResult}`;
      
      const response = await generateText({
        messages: [
          {
            role: "user",
            content: `You are a helpful tour guide assistant. The user has discovered a place and wants to know more. Based on the analysis of what they're looking at, answer their question concisely and helpfully.\n\nContext: ${context}\n\nUser question: ${question}`,
          },
        ],
      });

      if (response) {
        setAiQuestionResponse(response);
      } else {
        throw new Error("No response received");
      }
    } catch (error) {
      console.error("[Discover] Question error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to get answer: ${errorMessage}`);
    } finally {
      setIsLoadingQuestion(false);
    }
  };



  const renderInitialState = () => (
    <View style={styles.centeredContainer}>
      <View style={styles.heroIcon}>
        <Camera size={56} color={Colors.light.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Discover Places</Text>
      <Text style={styles.subtitle}>
        Snap a photo of any landmark, monument, or artwork to instantly learn its story, history, and cultural significance
      </Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={handleTakePhoto}
        >
          <Camera size={22} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.primaryButtonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.9}
          onPress={handleUploadPhoto}
        >
          <ImageIcon size={22} color="#000000" strokeWidth={2} />
          <Text style={styles.secondaryButtonText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImagePreview = () => (
    <Animated.View style={[styles.previewContainer, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={styles.backButton}
        activeOpacity={0.7}
        onPress={resetDiscovery}
      >
        <ArrowLeft size={24} color={Colors.light.text} />
      </TouchableOpacity>

      <View style={styles.imageContainer}>
        <RNImage source={{ uri: selectedImage! }} style={styles.previewImage} />
      </View>

      {!analysisResult && !isAnalyzing && (
        <TouchableOpacity
          style={styles.analyzeButton}
          activeOpacity={0.85}
          onPress={analyzeImage}
        >
          <Sparkles size={20} color={Colors.light.background} />
          <Text style={styles.analyzeButtonText}>Analyze</Text>
        </TouchableOpacity>
      )}

      {isAnalyzing && (
        <View style={styles.loadingContainer}>
          <View style={styles.waveContainer}>
            <Animated.View 
              style={[
                styles.waveBar, 
                { 
                  transform: [{ 
                    scaleY: waveAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1.2],
                    }) 
                  }],
                  opacity: waveAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.waveBar, 
                styles.waveBarTall,
                { 
                  transform: [{ 
                    scaleY: waveAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1.4],
                    }) 
                  }],
                  opacity: waveAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.waveBar, 
                { 
                  transform: [{ 
                    scaleY: waveAnim3.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1.2],
                    }) 
                  }],
                  opacity: waveAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.waveBar, 
                styles.waveBarTall,
                { 
                  transform: [{ 
                    scaleY: waveAnim1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1.3],
                    }) 
                  }],
                  opacity: waveAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }
              ]} 
            />
            <Animated.View 
              style={[
                styles.waveBar, 
                { 
                  transform: [{ 
                    scaleY: waveAnim2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 1.1],
                    }) 
                  }],
                  opacity: waveAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }
              ]} 
            />
          </View>
          <Text style={styles.loadingText}>Analyzing image...</Text>
        </View>
      )}

      {analysisResult && (
        <View style={styles.resultsContainer}>
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === "text" && styles.toggleButtonActive
              ]}
              activeOpacity={0.7}
              onPress={() => setViewMode("text")}
            >
              <FileText size={18} color={viewMode === "text" ? Colors.light.background : Colors.light.text} />
              <Text style={[
                styles.toggleButtonText,
                viewMode === "text" && styles.toggleButtonTextActive
              ]}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === "audio" && styles.toggleButtonActive
              ]}
              activeOpacity={0.7}
              onPress={() => {
                setViewMode("audio");
                if (!audioUrl && !isGeneratingAudio) {
                  generateAudioNarration();
                }
              }}
            >
              <Volume2 size={18} color={viewMode === "audio" ? Colors.light.background : Colors.light.text} />
              <Text style={[
                styles.toggleButtonText,
                viewMode === "audio" && styles.toggleButtonTextActive
              ]}>Audio</Text>
            </TouchableOpacity>
          </View>

          {viewMode === "text" && (
            <ScrollView style={styles.textResultsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.resultText}>{analysisResult}</Text>
            </ScrollView>
          )}

          {viewMode === "audio" && (
            <View style={styles.audioContainer}>
              {isGeneratingAudio && (
                <View style={styles.audioLoadingContainer}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <Text style={styles.audioLoadingText}>Generating audio...</Text>
                </View>
              )}

              {audioUrl && !isGeneratingAudio && (
                <View style={styles.audioControls}>
                  <TouchableOpacity
                    style={styles.playButton}
                    activeOpacity={0.85}
                    onPress={isPlayingAudio ? stopAudio : playAudio}
                  >
                    <Volume2 size={32} color={Colors.light.background} />
                    <Text style={styles.playButtonText}>
                      {isPlayingAudio ? "Stop" : "Play"} Audio
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.askQuestionButton}
            activeOpacity={0.85}
            onPress={openQuestionModal}
          >
            <MessageCircle size={20} color={Colors.light.primary} />
            <Text style={styles.askQuestionButtonText}>Ask a Question</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetButton}
            activeOpacity={0.85}
            onPress={resetDiscovery}
          >
            <Text style={styles.resetButtonText}>Discover Another</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const renderQuestionModal = () => (
    showQuestionModal && analysisResult && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            dismissKeyboard();
            closeQuestionModal();
          }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <Animated.View style={[styles.questionModal, { opacity: modalFadeAnim }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask Your Guide</Text>
              <TouchableOpacity onPress={() => {
                dismissKeyboard();
                closeQuestionModal();
              }}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {aiQuestionResponse ? (
              <ScrollView 
                style={styles.responseScrollView} 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.responseScrollContent}
              >
                <Text style={styles.responseLabel}>Answer:</Text>
                <Text style={styles.responseText}>{aiQuestionResponse}</Text>
                <TouchableOpacity
                  style={styles.askAnotherButton}
                  onPress={() => setAiQuestionResponse("")}
                >
                  <Text style={styles.askAnotherButtonText}>Ask Another Question</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => {
                    dismissKeyboard();
                    closeQuestionModal();
                  }}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView 
                style={styles.questionInputContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={dismissKeyboard}
              >
                <Text style={styles.inputLabel}>What would you like to know?</Text>
                
                {/* Custom question input */}
                <View style={styles.customQuestionContainer}>
                  <TextInput
                    style={styles.customQuestionInput}
                    placeholder="Type your question..."
                    placeholderTextColor="#8E8E93"
                    value={customQuestion}
                    onChangeText={setCustomQuestion}
                    multiline
                    maxLength={500}
                    editable={!isLoadingQuestion}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => {
                      if (customQuestion.trim() && !isLoadingQuestion) {
                        handleAskQuestion(customQuestion);
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendQuestionButton,
                      (!customQuestion.trim() || isLoadingQuestion) && styles.sendQuestionButtonDisabled
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      dismissKeyboard();
                      handleAskQuestion(customQuestion);
                    }}
                    disabled={!customQuestion.trim() || isLoadingQuestion}
                  >
                    <Send size={20} color={customQuestion.trim() && !isLoadingQuestion ? Colors.light.background : "#8E8E93"} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.orDividerText}>or try a quick question</Text>

                <View style={styles.quickQuestions}>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => {
                      dismissKeyboard();
                      handleAskQuestion("What's the history of this place?");
                    }}
                    disabled={isLoadingQuestion}
                  >
                    <Text style={styles.quickQuestionText}>History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => {
                      dismissKeyboard();
                      handleAskQuestion("What should I look for here?");
                    }}
                    disabled={isLoadingQuestion}
                  >
                    <Text style={styles.quickQuestionText}>What to see</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => {
                      dismissKeyboard();
                      handleAskQuestion("Tell me an interesting fact");
                    }}
                    disabled={isLoadingQuestion}
                  >
                    <Text style={styles.quickQuestionText}>Fun fact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => {
                      dismissKeyboard();
                      handleAskQuestion("What makes this place special?");
                    }}
                    disabled={isLoadingQuestion}
                  >
                    <Text style={styles.quickQuestionText}>Why special</Text>
                  </TouchableOpacity>
                </View>

                {isLoadingQuestion && (
                  <View style={styles.questionLoadingContainer}>
                    <ActivityIndicator color={Colors.light.primary} />
                    <Text style={styles.questionLoadingText}>Getting answer...</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    )
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!selectedImage ? renderInitialState() : renderImagePreview()}
        </ScrollView>
      </SafeAreaView>
      {renderQuestionModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    paddingTop: 20,
    paddingBottom: 60,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 40,
    position: "relative" as const,
  },

  heroIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 8,
    zIndex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 24,
    fontWeight: "400",
    marginBottom: 8,
    zIndex: 1,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F2F2F7",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  secondaryButtonText: {
    color: "#000000",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  previewContainer: {
    flex: 1,
    width: "100%",
    gap: 16,
    paddingTop: 52,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  locationBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 20,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 17,
    color: Colors.light.primary,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 50,
  },
  waveBar: {
    width: 6,
    height: 30,
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
  },
  waveBarTall: {
    height: 40,
  },
  resultsContainer: {
    gap: 20,
  },
  viewModeToggle: {
    flexDirection: "row",
    gap: 0,
    backgroundColor: "#F2F2F7",
    padding: 4,
    borderRadius: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#8E8E93",
  },
  toggleButtonTextActive: {
    color: "#000000",
  },
  textResultsScroll: {
    maxHeight: 300,
  },
  resultText: {
    fontSize: 16,
    color: "#000000",
    lineHeight: 26,
  },
  audioContainer: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  audioLoadingContainer: {
    alignItems: "center",
    gap: 16,
  },
  audioLoadingText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
  audioControls: {
    width: "100%",
    alignItems: "center",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  askQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    marginTop: 8,
  },
  askQuestionButtonText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  resetButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  // Question Modal styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  keyboardAvoidingView: {
    width: "100%",
    justifyContent: "flex-end",
  },
  questionModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: -0.4,
  },
  responseScrollView: {
    padding: 20,
    flexGrow: 1,
  },
  responseScrollContent: {
    paddingBottom: 20,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  responseText: {
    fontSize: 16,
    color: "#000000",
    lineHeight: 24,
  },
  askAnotherButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  askAnotherButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  closeModalButton: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  closeModalButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  questionInputContainer: {
    padding: 20,
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 16,
  },
  customQuestionContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 16,
  },
  customQuestionInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    textAlignVertical: "center",
  },
  sendQuestionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sendQuestionButtonDisabled: {
    backgroundColor: "#E5E5EA",
  },
  orDividerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 12,
  },
  quickQuestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickQuestionChip: {
    backgroundColor: "#F2F2F7",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  quickQuestionText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000000",
  },
  questionLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 24,
    paddingVertical: 16,
  },
  questionLoadingText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
});
