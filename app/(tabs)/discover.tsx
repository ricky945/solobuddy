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
} from "react-native";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Camera, ImageIcon, Volume2, FileText, Sparkles } from "lucide-react-native";
import { Audio } from "expo-av";
import { generateText } from "@rork-ai/toolkit-sdk";

import Colors from "@/constants/colors";
import { trpc } from "@/lib/trpc";

type ViewMode = "text" | "audio";

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
  
  const generateTTSMutation = trpc.tts.generate.useMutation();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const getLocation = async () => {
    try {
      console.log("[Discover] Getting location...");
      
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          return "Location not available";
        }

        return new Promise<string>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              console.log("[Discover] Location obtained:", { latitude, longitude });

              try {
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
                    geocodeData.address?.village,
                  geocodeData.address?.country,
                ];
                
                const locationString = locationParts.filter(Boolean).join(", ");
                resolve(locationString || "Unknown location");
              } catch (error) {
                console.error("[Discover] Geocode error:", error);
                resolve("Location unavailable");
              }
            },
            (error) => {
              console.error("[Discover] Geolocation error:", error);
              resolve("Location unavailable");
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return "Location permission denied";
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 1,
        });

        const { latitude, longitude } = currentLocation.coords;
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
            geocodeData.address?.village,
          geocodeData.address?.country,
        ];
        
        return locationParts.filter(Boolean).join(", ") || "Unknown location";
      }
    } catch (error) {
      console.error("[Discover] Location error:", error);
      return "Location unavailable";
    }
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
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Discover] Photo captured");
        setSelectedImage(result.assets[0].uri);
        setAnalysisResult(null);
        setAudioUrl(null);
        animateIn();
      }
    } catch (error) {
      console.error("[Discover] Camera error:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
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
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Discover] Photo selected");
        setSelectedImage(result.assets[0].uri);
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
      const location = await getLocation();
      setLocationInfo(location);
      console.log("[Discover] Location:", location);

      const base64Image = await convertImageToBase64(selectedImage);
      
      if (!base64Image) {
        throw new Error("Failed to convert image");
      }

      const systemPrompt = `You are an expert art historian, cultural guide, and landmark specialist. 
Analyze the provided image and location to give comprehensive information about what's shown.

Location: ${location}

Focus on:
- Identifying landmarks, buildings, monuments, or artworks
- Historical context and significance
- Architectural or artistic style
- Cultural importance
- Interesting facts and stories
- Practical visitor information if relevant

Provide a detailed, engaging response as if you're a knowledgeable local guide.
Write 3-4 paragraphs with rich detail. Be conversational and enthusiastic.`;

      console.log("[Discover] Calling AI for analysis...");
      
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
    console.log("[Discover] Generating audio...");

    try {
      const ttsResult = await generateTTSMutation.mutateAsync({
        text: analysisResult,
        voice: "alloy",
        speed: 1.0,
      });

      console.log("[Discover] TTS response: success=", ttsResult.success);

      if (!ttsResult.success || !ttsResult.audioData) {
        throw new Error("Failed to generate audio");
      }

      if (Platform.OS === 'web') {
        const binaryString = atob(ttsResult.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: ttsResult.mimeType || 'audio/mpeg' });
        const generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);
      } else {
        const dataUrl = `data:${ttsResult.mimeType || 'audio/mpeg'};base64,${ttsResult.audioData}`;
        setAudioUrl(dataUrl);
      }
      
      console.log("[Discover] Audio generated successfully");
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

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      if (!newSound) {
        throw new Error("Failed to create sound object");
      }
      
      setSound(newSound);
      setIsPlayingAudio(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log("[Discover] Audio finished");
          setIsPlayingAudio(false);
        }
      });
    } catch (error) {
      console.error("[Discover] Audio playback error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to play audio: ${errorMessage}. Please try again.`);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        console.log("[Discover] Stopping audio...");
        await sound.stopAsync();
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error("[Discover] Stop audio error:", error);
      setIsPlayingAudio(false);
    }
  };

  const resetDiscovery = () => {
    setSelectedImage(null);
    setAnalysisResult(null);
    setAudioUrl(null);
    setLocationInfo(null);
    setViewMode("text");
    if (sound) {
      sound.unloadAsync().catch(err => {
        console.warn("[Discover] Error unloading sound during reset:", err);
      });
      setSound(null);
    }
    setIsPlayingAudio(false);
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
      <View style={styles.imageContainer}>
        <RNImage source={{ uri: selectedImage! }} style={styles.previewImage} />
      </View>
      
      {locationInfo && (
        <View style={styles.locationBadge}>
          <Text style={styles.locationText}>{locationInfo}</Text>
        </View>
      )}

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
          <ActivityIndicator size="large" color={Colors.light.primary} />
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
    justifyContent: "flex-start",
    gap: 24,
    paddingTop: 40,
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
    gap: 16,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
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
});
