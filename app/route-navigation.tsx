import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  MapPin,
  Play,
  Pause,
  Navigation as NavigationIcon,
  Check,
  ArrowRight,
  X,
  MessageCircle,
  Mic,
  Send,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Audio } from "expo-av";

import Colors from "@/constants/colors";
import { useTours } from "@/contexts/ToursContext";


export default function RouteNavigationScreen() {
  const { tourId } = useLocalSearchParams();
  const router = useRouter();
  const { getTourById } = useTours();
  
  const tour = getTourById(tourId as string);
  
  const [currentLandmarkIndex, setCurrentLandmarkIndex] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceToLandmark, setDistanceToLandmark] = useState<string>("");
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiQuestion, setAiQuestion] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentLandmarkIndex]);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.error("[RouteNav] Audio setup error:", error);
      }
    };
    setupAudio();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        if (Platform.OS === "web") {
          if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ latitude, longitude });
                calculateDistance(latitude, longitude);
              },
              (error) => {
                console.error("[RouteNav] Location error:", error);
              },
              { enableHighAccuracy: true }
            );

            return () => {
              navigator.geolocation.clearWatch(watchId);
            };
          }
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            locationSubscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.BestForNavigation,
                distanceInterval: 10,
              },
              (location) => {
                const { latitude, longitude } = location.coords;
                setUserLocation({ latitude, longitude });
                calculateDistance(latitude, longitude);
              }
            );
          }
        }
      } catch (error) {
        console.error("[RouteNav] Location tracking error:", error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [currentLandmarkIndex]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => {
          console.error("[RouteNav] Error unloading sound:", err);
        });
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(err => {
          console.error("[RouteNav] Error stopping recording:", err);
        });
      }
    };
  }, [sound, recording]);

  const calculateDistance = (lat: number, lon: number) => {
    if (!tour || !tour.landmarks || !tour.landmarks[currentLandmarkIndex]) return;

    const landmark = tour.landmarks[currentLandmarkIndex];
    const R = 6371;
    const dLat = toRad(landmark.coordinates.latitude - lat);
    const dLon = toRad(landmark.coordinates.longitude - lon);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) *
        Math.cos(toRad(landmark.coordinates.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      setDistanceToLandmark(`${Math.round(distance * 1000)}m away`);
    } else {
      setDistanceToLandmark(`${distance.toFixed(1)}km away`);
    }
  };

  const toRad = (value: number) => {
    return (value * Math.PI) / 180;
  };

  const handlePlayAudio = async () => {
    if (!tour || !tour.audioUrl) {
      console.log("[RouteNav] No tour or audio URL");
      return;
    }

    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          return;
        } else if (status.isLoaded) {
          await sound.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const landmark = tour.landmarks?.[currentLandmarkIndex];
      if (!landmark) return;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: tour.audioUrl },
        {
          shouldPlay: true,
          positionMillis: landmark.audioTimestamp * 1000,
        }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && !status.isPlaying) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error("[RouteNav] Audio playback error:", error);
      Alert.alert("Audio Error", "Failed to play audio for this landmark.");
    }
  };

  const handleNextLandmark = () => {
    if (!tour || !tour.landmarks) return;

    if (sound) {
      sound.pauseAsync().catch(err => {
        console.error("[RouteNav] Error pausing sound:", err);
      });
      setIsPlaying(false);
    }

    if (currentLandmarkIndex < tour.landmarks.length - 1) {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      setCurrentLandmarkIndex(currentLandmarkIndex + 1);
    } else {
      Alert.alert(
        "Tour Complete!",
        "You've reached the end of your tour. Great job!",
        [
          {
            text: "Finish",
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const openInMaps = () => {
    if (!tour || !tour.landmarks) return;
    
    const landmark = tour.landmarks[currentLandmarkIndex];
    const { latitude, longitude } = landmark.coordinates;
    
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    }
  };

  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;

    setIsLoadingAi(true);
    setAiResponse("");

    try {
      const context = `Tour: ${tour?.title}\nCurrent Landmark: ${currentLandmark.name}\nDescription: ${currentLandmark.description}\nLocation: ${tour?.location}`;
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a helpful tour guide assistant. Answer questions about the current landmark and tour. Context: ${context}`,
            },
            {
              role: "user",
              content: aiQuestion,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const data = await response.json();

      if (data.choices && data.choices[0]) {
        setAiResponse(data.choices[0].message.content);
      } else {
        setAiResponse("Sorry, I couldn't get an answer. Please try again.");
      }
    } catch (error) {
      console.error("[AI Question] Error:", error);
      setAiResponse("Sorry, something went wrong. Please try again.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const startRecording = async () => {
    try {
      console.log("[RouteNav] Requesting audio permissions...");
      const { granted } = await Audio.requestPermissionsAsync();

      if (!granted) {
        Alert.alert("Permission Required", "Please allow microphone access to use voice input.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log("[RouteNav] Starting recording...");
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error("[RouteNav] Failed to start recording:", error);
      Alert.alert("Recording Error", "Failed to start voice recording.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log("[RouteNav] Stopping recording...");
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (uri) {
        await transcribeAudio(uri);
      }

      setRecording(null);
    } catch (error) {
      console.error("[RouteNav] Failed to stop recording:", error);
      Alert.alert("Recording Error", "Failed to process voice recording.");
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      setIsLoadingAi(true);

      const formData = new FormData();
      formData.append("file", {
        uri: audioUri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);
      formData.append("model", "whisper-1");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.text) {
        setAiQuestion(data.text);
        setIsLoadingAi(false);
        await handleAskAi();
      } else {
        setIsLoadingAi(false);
        Alert.alert("Transcription Error", "Failed to transcribe audio. Please try again.");
      }
    } catch (error) {
      console.error("[RouteNav] Transcription error:", error);
      setIsLoadingAi(false);
      Alert.alert("Transcription Error", "Failed to transcribe audio. Please try again.");
    }
  };

  if (!tour || tour.type !== "route" || !tour.landmarks || tour.landmarks.length === 0) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={["top", "bottom"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Tour not found or invalid</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentLandmark = tour.landmarks[currentLandmarkIndex];
  const progress = ((currentLandmarkIndex + 1) / tour.landmarks.length) * 100;
  const isLastLandmark = currentLandmarkIndex === tour.landmarks.length - 1;

  return (
    <LinearGradient
      colors={["#FFFFFF", "#D6EBFF"]}
      locations={[0, 1]}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (sound) {
                sound.unloadAsync().catch(err => {
                  console.error("[RouteNav] Error unloading sound on close:", err);
                });
              }
              if (recording) {
                recording.stopAndUnloadAsync().catch(err => {
                  console.error("[RouteNav] Error stopping recording on close:", err);
                });
              }
              router.back();
            }}
            style={styles.closeButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <X size={28} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{tour.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Stop {currentLandmarkIndex + 1} of {tour.landmarks.length}
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.landmarkCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.landmarkIconContainer}>
              <MapPin size={32} color={Colors.light.primary} />
            </View>
            <Text style={styles.landmarkName}>{currentLandmark.name}</Text>
            {userLocation && distanceToLandmark && (
              <View style={styles.distanceBadge}>
                <NavigationIcon size={16} color={Colors.light.primary} />
                <Text style={styles.distanceText}>{distanceToLandmark}</Text>
              </View>
            )}
            <Text style={styles.landmarkDescription}>
              {currentLandmark.description}
            </Text>

            <View style={styles.audioSection}>
              <TouchableOpacity
                style={styles.audioButton}
                activeOpacity={0.8}
                onPress={handlePlayAudio}
              >
                {isPlaying ? (
                  <Pause size={24} color={Colors.light.background} fill={Colors.light.background} />
                ) : (
                  <Play size={24} color={Colors.light.background} fill={Colors.light.background} />
                )}
                <Text style={styles.audioButtonText}>
                  {isPlaying ? "Pause Audio" : "Play Audio"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.navigationCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.directionsButton}
              activeOpacity={0.8}
              onPress={openInMaps}
            >
              <NavigationIcon size={20} color={Colors.light.primary} />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
              <ArrowRight size={20} color={Colors.light.primary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.aiButton}
              activeOpacity={0.8}
              onPress={() => setShowAiModal(true)}
            >
              <MessageCircle size={20} color={Colors.light.primary} />
              <Text style={styles.aiButtonText}>Ask a Question</Text>
            </TouchableOpacity>
          </Animated.View>

          {tour.landmarks.length > currentLandmarkIndex + 1 && (
            <Animated.View
              style={[
                styles.upcomingSection,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <Text style={styles.upcomingTitle}>Up Next</Text>
              {tour.landmarks
                .slice(currentLandmarkIndex + 1, currentLandmarkIndex + 4)
                .map((landmark: any, index: number) => (
                  <View key={landmark.id} style={styles.upcomingItem}>
                    <View style={styles.upcomingNumber}>
                      <Text style={styles.upcomingNumberText}>
                        {currentLandmarkIndex + index + 2}
                      </Text>
                    </View>
                    <Text style={styles.upcomingName} numberOfLines={1}>
                      {landmark.name}
                    </Text>
                  </View>
                ))}
            </Animated.View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            activeOpacity={0.8}
            onPress={handleNextLandmark}
          >
            <Check size={24} color={Colors.light.background} />
            <Text style={styles.nextButtonText}>
              {isLastLandmark ? "Complete Tour" : "I've Arrived"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={showAiModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAiModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAiModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask Your Tour Guide</Text>
              <TouchableOpacity onPress={() => setShowAiModal(false)}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
            >
              {aiResponse ? (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseLabel}>Answer:</Text>
                  <Text style={styles.responseText}>{aiResponse}</Text>
                  <TouchableOpacity
                    style={styles.askAnotherButton}
                    onPress={() => {
                      setAiResponse("");
                      setAiQuestion("");
                    }}
                  >
                    <Text style={styles.askAnotherButtonText}>Ask Another Question</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>What would you like to know?</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type your question here..."
                    placeholderTextColor={Colors.light.textSecondary}
                    value={aiQuestion}
                    onChangeText={setAiQuestion}
                    multiline
                    numberOfLines={4}
                    editable={!isLoadingAi}
                  />

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.voiceButton}
                      onPress={isRecording ? stopRecording : startRecording}
                      disabled={isLoadingAi}
                    >
                      <Mic
                        size={24}
                        color={isRecording ? Colors.light.error : Colors.light.background}
                      />
                      <Text style={styles.voiceButtonText}>
                        {isRecording ? "Stop Recording" : "Use Voice"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        (!aiQuestion.trim() || isLoadingAi) && styles.sendButtonDisabled,
                      ]}
                      onPress={handleAskAi}
                      disabled={!aiQuestion.trim() || isLoadingAi}
                    >
                      {isLoadingAi ? (
                        <ActivityIndicator color={Colors.light.background} />
                      ) : (
                        <Send size={24} color={Colors.light.background} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 36,
  },
  progressBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "600",
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  landmarkCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  landmarkIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  landmarkName: {
    fontSize: 26,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 12,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  landmarkDescription: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  audioSection: {
    width: "100%",
  },
  audioButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  audioButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.background,
  },
  navigationCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
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
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  aiButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
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
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
  },
  inputContainer: {
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 120,
    textAlignVertical: "top",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  voiceButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  voiceButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.background,
  },
  sendButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  responseContainer: {
    gap: 16,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  responseText: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.light.text,
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
  },
  askAnotherButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  askAnotherButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.background,
  },
  upcomingSection: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 20,
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
  upcomingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 16,
  },
  upcomingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  upcomingNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  upcomingName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    borderRadius: 16,
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
  nextButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.background,
  },
});
