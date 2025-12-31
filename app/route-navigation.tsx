import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  MapPin,
  Play,
  Pause,
  Navigation as NavigationIcon,
  ArrowRight,
  ChevronLeft,
  X,
  MessageCircle,
  ImageIcon,
  SkipBack,
  SkipForward,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import Slider from "@react-native-community/slider";

import Colors from "@/constants/colors";
import { generateText } from "@/lib/supabase-functions";
import { useTours } from "@/contexts/ToursContext";
import { getLocationImageWithFallback, getThemedPlaceholder } from "@/lib/image-utils";
import { configureAudioForLockScreen, enableNowPlayingControls } from "@/lib/audio-config";

// Component for landmark image with loading state - always shows an image of the actual landmark
function LandmarkImage({ name, location, style }: { name: string; location: string | undefined; style: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      setIsLoading(true);

      try {
        // Search for the specific landmark - use just the name for best results
        // Adding location as secondary context helps disambiguate
        console.log("[RouteNav] Fetching landmark image for:", name, "in", location);
        const image = await getLocationImageWithFallback(name, "landmark monument");
        
        if (mounted) {
          setImageUrl(image);
        }
      } catch (error) {
        console.log("[RouteNav] Error fetching image:", error);
        if (mounted) {
          setImageUrl(getThemedPlaceholder("landmark"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [name, location]);

  const handleError = () => {
    // On error, use themed placeholder for guaranteed image
    console.log("[RouteNav] Image load error, using themed placeholder");
    setImageUrl(getThemedPlaceholder("landmark"));
  };

  if (isLoading) {
    return (
      <View style={[style, { backgroundColor: "#EEF2F7", alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={Colors.light.primary} />
      </View>
    );
  }

  // Always show an image - use themed placeholder if needed
  const finalUrl = imageUrl || getThemedPlaceholder("landmark");

  return (
    <Image
      source={{ uri: finalUrl }}
      style={style}
      resizeMode="cover"
      onError={handleError}
    />
  );
}

type NavigationStep = "navigate" | "arrived" | "listening" | "complete";

export default function RouteNavigationScreen() {
  const { tourId } = useLocalSearchParams();
  const router = useRouter();
  const { getTourById } = useTours();
  
  const tour = getTourById(tourId as string);
  
  const [currentLandmarkIndex, setCurrentLandmarkIndex] = useState<number>(0);
  const [step, setStep] = useState<NavigationStep>("navigate");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceToLandmark, setDistanceToLandmark] = useState<string>("");
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showAiQuestion, setShowAiQuestion] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const modalFadeAnim = useRef(new Animated.Value(0)).current;
  
  // Audio position tracking for seek slider
  const [audioPosition, setAudioPosition] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [seekPosition, setSeekPosition] = useState<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const toRad = (value: number) => {
    return (value * Math.PI) / 180;
  };

  const calculateDistance = React.useCallback((lat: number, lon: number) => {
    if (!tour || !tour.landmarks || !tour.landmarks[currentLandmarkIndex]) return;

    const landmark = tour.landmarks[currentLandmarkIndex];
    const R = 3959; // Earth's radius in miles
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

    if (distance < 0.1) {
      setDistanceToLandmark(`${Math.round(distance * 5280)}ft away`);
    } else {
      setDistanceToLandmark(`${distance.toFixed(1)}mi away`);
    }
  }, [tour, currentLandmarkIndex]);

  useEffect(() => {
    void configureAudioForLockScreen().catch(error => {
      console.error("[RouteNav] Audio setup error:", error);
    });
  }, []);

  // Maintain audio mode when screen locks or app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await configureAudioForLockScreen().catch(e => {
          console.error("[RouteNav] Error maintaining audio mode", e);
        });
      }
    });

    return () => {
      subscription.remove();
    };
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
  }, [currentLandmarkIndex, calculateDistance]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(err => {
          console.error("[RouteNav] Error unloading sound:", err);
        });
      }
    };
  }, [sound]);

  const transitionToStep = (newStep: NavigationStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setStep(newStep);
    }, 300);
  };

  const handleArrived = () => {
    transitionToStep("listening");
  };

  // Ref to track intended play state to prevent race conditions with status updates
  const intendedPlayingRef = useRef<boolean>(false);

  const handlePlayAudio = async () => {
    if (!tour || !tour.audioUrl) {
      console.log("[RouteNav] No tour or audio URL");
      return;
    }

    try {
      // If we already have a sound loaded, toggle play/pause
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            console.log("[RouteNav] Pausing audio...");
            intendedPlayingRef.current = false;
            await sound.pauseAsync();
            setIsPlaying(false);
            console.log("[RouteNav] Audio paused");
          } else {
            console.log("[RouteNav] Resuming audio...");
            intendedPlayingRef.current = true;
            await sound.playAsync();
            setIsPlaying(true);
            console.log("[RouteNav] Audio resumed");
          }
          return;
        }
      }

      // No sound loaded yet - create and play
      const landmark = tour.landmarks?.[currentLandmarkIndex];
      if (!landmark) return;

      console.log("[RouteNav] Loading audio for playback");
      
      // Re-apply audio mode before playing to ensure lock screen support
      await configureAudioForLockScreen();
      
      intendedPlayingRef.current = true;
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: tour.audioUrl },
        {
          shouldPlay: true,
          positionMillis: landmark.audioTimestamp * 1000,
          isLooping: false,
          progressUpdateIntervalMillis: 250,
        }
      );
      
      // Enable lock screen controls
      await enableNowPlayingControls(newSound);
      
      console.log("[RouteNav] ✓ Audio created with lock screen support");

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          // Only update isPlaying if it matches intended state or audio finished
          if (status.didJustFinish) {
            console.log("[RouteNav] Audio finished playing at this landmark");
            intendedPlayingRef.current = false;
            setIsPlaying(false);
          } else {
            // Use intended state to prevent UI flicker
            setIsPlaying(intendedPlayingRef.current);
          }
          
          // Track position and duration for the seek slider
          if (typeof status.durationMillis === "number") {
            setAudioDuration(status.durationMillis);
          }
          if (typeof status.positionMillis === "number" && !isSeekingRef.current) {
            setAudioPosition(status.positionMillis);
          }
        }
      });
    } catch (error) {
      console.error("[RouteNav] Audio playback error:", error);
      intendedPlayingRef.current = false;
      setIsPlaying(false);
      Alert.alert("Audio Error", "Failed to play audio for this landmark.");
    }
  };

  // Format time for display
  const formatTime = (ms: number) => {
    if (!Number.isFinite(ms) || ms < 0) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Seek handlers for the slider
  const handleSeekStart = useCallback(() => {
    console.log("[RouteNav] User started seeking");
    setIsSeeking(true);
    isSeekingRef.current = true;
  }, []);

  const handleSeekValueChange = useCallback((value: number) => {
    setSeekPosition(value);
  }, []);

  const handleSeekComplete = useCallback(async (value: number) => {
    console.log("[RouteNav] Seeking to position:", value);
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(Math.floor(value));
          setAudioPosition(value);
          setSeekPosition(value);
        }
      } catch (error) {
        console.error("[RouteNav] Seek error:", error);
      }
    }
    setIsSeeking(false);
    isSeekingRef.current = false;
  }, [sound]);

  const skipForward = useCallback(async () => {
    if (!sound) return;
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      
      const currentPos = status.positionMillis || audioPosition;
      const maxDur = status.durationMillis || audioDuration;
      const newPos = Math.min(maxDur, currentPos + 15000);
      
      await sound.setPositionAsync(newPos);
      setAudioPosition(newPos);
      console.log("[RouteNav] Skipped forward to:", newPos);
    } catch (error) {
      console.error("[RouteNav] Skip forward error:", error);
    }
  }, [sound, audioDuration, audioPosition]);

  const skipBackward = useCallback(async () => {
    if (!sound) return;
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;
      
      const currentPos = status.positionMillis || audioPosition;
      const newPos = Math.max(0, currentPos - 15000);
      
      await sound.setPositionAsync(newPos);
      setAudioPosition(newPos);
      console.log("[RouteNav] Skipped backward to:", newPos);
    } catch (error) {
      console.error("[RouteNav] Skip backward error:", error);
    }
  }, [sound, audioPosition]);

  const handleNextDestination = async () => {
    if (!tour || !tour.landmarks) return;

    // Stop and unload current audio
    if (sound) {
      try {
        intendedPlayingRef.current = false;
        setIsPlaying(false);
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setAudioPosition(0);
        setAudioDuration(0);
      } catch (err) {
        console.error("[RouteNav] Error stopping sound:", err);
      }
    }

    if (currentLandmarkIndex < tour.landmarks.length - 1) {
      transitionToStep("navigate");
      setTimeout(() => {
        setCurrentLandmarkIndex(currentLandmarkIndex + 1);
        setStep("navigate");
      }, 300);
    } else {
      transitionToStep("complete");
    }
  };

  const handleCompleteTour = () => {
    if (sound) {
      sound.unloadAsync().catch(err => {
        console.error("[RouteNav] Error unloading sound:", err);
      });
    }
    router.back();
  };

  const openInMaps = async () => {
    if (!tour || !tour.landmarks) return;
    
    const landmark = tour.landmarks[currentLandmarkIndex];
    const { latitude, longitude } = landmark.coordinates;
    
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    
    try {
      if (Platform.OS === "web") {
        window.open(url, "_blank");
      } else {
        const supported = await Linking.canOpenURL(url as string);
        if (supported) {
          await Linking.openURL(url as string);
        } else {
          Alert.alert("Error", "Unable to open maps application");
        }
      }
    } catch (error) {
      console.error("[RouteNav] Error opening maps:", error);
      Alert.alert("Error", "Failed to open maps application");
    }
  };

  const handleAskQuestion = async (question: string) => {
    if (!question.trim()) return;

    setIsLoadingAi(true);
    setAiResponse("");

    try {
      const currentLandmark = tour?.landmarks?.[currentLandmarkIndex];
      const context = `Tour: ${tour?.title}\nCurrent Landmark: ${currentLandmark?.name}\nDescription: ${currentLandmark?.description}\nLocation: ${tour?.location}`;
      
      const response = await generateText({
        messages: [
          {
            role: "user",
            content: `You are a helpful tour guide assistant. Answer questions about the current landmark and tour concisely. Context: ${context}\n\nUser question: ${question}`,
          },
        ],
      });

      if (response) {
        setAiResponse(response);
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

  const renderNavigateStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.landmarkImageContainer}>
        <LandmarkImage 
          name={currentLandmark.name} 
          location={tour.location} 
          style={styles.landmarkImage} 
        />
        <View style={styles.landmarkImageOverlay}>
          <NavigationIcon size={32} color="#FFFFFF" />
        </View>
      </View>
      
      <Text style={styles.landmarkName}>{currentLandmark.name}</Text>
      
      {userLocation && distanceToLandmark && (
        <View style={styles.distanceBadge}>
          <NavigationIcon size={18} color={Colors.light.primary} />
          <Text style={styles.distanceText}>{distanceToLandmark}</Text>
        </View>
      )}
      
      <Text style={styles.landmarkSummary}>{currentLandmark.description}</Text>
      
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.8}
          onPress={openInMaps}
        >
          <NavigationIcon size={20} color={Colors.light.primary} />
          <Text style={styles.secondaryButtonText}>Get Directions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={handleArrived}
        >
          <Text style={styles.primaryButtonText}>I&apos;ve Arrived</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderListeningStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={styles.landmarkImageContainer}>
        <LandmarkImage 
          name={currentLandmark.name} 
          location={tour.location} 
          style={styles.landmarkImage} 
        />
      </View>
      
      <Text style={styles.landmarkName}>{currentLandmark.name}</Text>
      
      <View style={styles.audioPlayerFull}>
        {/* Progress Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.audioSlider}
            minimumValue={0}
            maximumValue={Math.max(1, audioDuration)}
            value={isSeeking ? seekPosition : audioPosition}
            onSlidingStart={handleSeekStart}
            onValueChange={handleSeekValueChange}
            onSlidingComplete={handleSeekComplete}
            minimumTrackTintColor={Colors.light.primary}
            maximumTrackTintColor="#E2E8F0"
            thumbTintColor={Colors.light.primary}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(isSeeking ? seekPosition : audioPosition)}</Text>
            <Text style={styles.timeText}>{formatTime(audioDuration)}</Text>
          </View>
        </View>

        {/* Playback Controls */}
        <View style={styles.audioControls}>
          <TouchableOpacity
            style={styles.skipButton}
            activeOpacity={0.8}
            onPress={skipBackward}
          >
            <SkipBack size={24} color={Colors.light.text} />
            <Text style={styles.skipLabel}>15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButton}
            activeOpacity={0.8}
            onPress={handlePlayAudio}
          >
            {isPlaying ? (
              <Pause size={32} color={Colors.light.background} fill={Colors.light.background} />
            ) : (
              <Play size={32} color={Colors.light.background} fill={Colors.light.background} style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            activeOpacity={0.8}
            onPress={skipForward}
          >
            <SkipForward size={24} color={Colors.light.text} />
            <Text style={styles.skipLabel}>15s</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.questionButton}
        activeOpacity={0.8}
        onPress={() => {
          setShowAiQuestion(true);
          setAiResponse("");
          Animated.timing(modalFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }}
      >
        <MessageCircle size={20} color={Colors.light.primary} />
        <Text style={styles.questionButtonText}>Ask a Question</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.8}
        onPress={handleNextDestination}
      >
        <Text style={styles.primaryButtonText}>
          {isLastLandmark ? "Complete Tour" : "Next Destination"}
        </Text>
        {!isLastLandmark && <ArrowRight size={24} color={Colors.light.background} />}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderCompleteStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <View style={[styles.landmarkIconContainer, styles.completeIcon]}>
        <Text style={styles.completeEmoji}>🎉</Text>
      </View>
      
      <Text style={styles.stepTitle}>Tour Complete!</Text>
      <Text style={styles.completeMessage}>
        You&apos;ve visited all {tour.landmarks.length} landmarks on this tour. Great job!
      </Text>
      
      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.8}
        onPress={handleCompleteTour}
      >
        <Text style={styles.primaryButtonText}>Finish</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={["#FFFFFF", "#F0F4F8"]}
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
              router.back();
            }}
            style={styles.backButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <ChevronLeft size={28} color={Colors.light.text} />
          </TouchableOpacity>
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

        <View style={styles.content}>
          {step === "navigate" && renderNavigateStep()}
          {step === "listening" && renderListeningStep()}
          {step === "complete" && renderCompleteStep()}
        </View>
      </SafeAreaView>

      {showAiQuestion && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              Animated.timing(modalFadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start(() => setShowAiQuestion(false));
            }}
          />
          <Animated.View style={[styles.questionModal, { opacity: modalFadeAnim }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask Your Tour Guide</Text>
              <TouchableOpacity onPress={() => {
                Animated.timing(modalFadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => setShowAiQuestion(false));
              }}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {aiResponse ? (
              <View style={styles.responseContainer}>
                <Text style={styles.responseLabel}>Answer:</Text>
                <Text style={styles.responseText}>{aiResponse}</Text>
                <TouchableOpacity
                  style={styles.askAnotherButton}
                  onPress={() => {
                    setAiResponse("");
                  }}
                >
                  <Text style={styles.askAnotherButtonText}>Ask Another Question</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.questionInputContainer}>
                <Text style={styles.inputLabel}>What would you like to know about {currentLandmark.name}?</Text>
                <View style={styles.quickQuestions}>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => handleAskQuestion("What's the history of this place?")}
                    disabled={isLoadingAi}
                  >
                    <Text style={styles.quickQuestionText}>History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => handleAskQuestion("What should I look for here?")}
                    disabled={isLoadingAi}
                  >
                    <Text style={styles.quickQuestionText}>What to see</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickQuestionChip}
                    onPress={() => handleAskQuestion("Tell me an interesting fact")}
                    disabled={isLoadingAi}
                  >
                    <Text style={styles.quickQuestionText}>Fun fact</Text>
                  </TouchableOpacity>
                </View>

                {isLoadingAi && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color={Colors.light.primary} />
                    <Text style={styles.loadingText}>Getting answer...</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      )}
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
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },

  progressBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  stepContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  landmarkIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  landmarkImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  landmarkImage: {
    width: "100%",
    height: "100%",
  },
  landmarkImageOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeIcon: {
    backgroundColor: "#FEF3C7",
  },
  completeEmoji: {
    fontSize: 48,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  landmarkName: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 38,
    marginTop: 4,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  landmarkSummary: {
    fontSize: 17,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: "90%",
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
    marginTop: 8,
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
    width: "100%",
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
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.background,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.light.card,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  audioPlayer: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
  },
  audioButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
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
  audioStatus: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  audioPlayerFull: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    marginVertical: 8,
  },
  sliderContainer: {
    width: "100%",
    paddingHorizontal: 8,
  },
  audioSlider: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: -4,
  },
  timeText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginTop: 12,
  },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  skipLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  questionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.card,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  questionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  completeMessage: {
    fontSize: 17,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    maxWidth: "85%",
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
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  questionModal: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "80%",
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
  questionInputContainer: {
    padding: 20,
    gap: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  quickQuestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickQuestionChip: {
    backgroundColor: Colors.light.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  quickQuestionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  responseContainer: {
    padding: 20,
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
});
