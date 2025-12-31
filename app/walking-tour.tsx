import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  AppState,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import Slider from "@react-native-community/slider";
import {
  ChevronLeft,
  Play,
  Pause,
  MessageCircle,
  Navigation as NavigationIcon,
  ArrowRight,
  X,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { useTours } from "@/contexts/ToursContext";
import type { Landmark } from "@/types";
import { configureAudioForLockScreen, enableNowPlayingControls } from "@/lib/audio-config";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SHEET_MIN = 168;
const SHEET_MAX = Math.min(460, SCREEN_HEIGHT * 0.58);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(milliseconds: number): string {
  if (isNaN(milliseconds) || milliseconds < 0) return "0:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getMidRegion(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): Region {
  const midLat = (a.latitude + b.latitude) / 2;
  const midLng = (a.longitude + b.longitude) / 2;

  const latDelta = Math.max(0.01, Math.abs(a.latitude - b.latitude) * 2.2);
  const lngDelta = Math.max(0.01, Math.abs(a.longitude - b.longitude) * 2.2);

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: clamp(latDelta, 0.01, 0.22),
    longitudeDelta: clamp(lngDelta, 0.01, 0.22),
  };
}

export default function WalkingTourScreen() {
  const router = useRouter();
  const { tourId } = useLocalSearchParams();
  const { getTourById } = useTours();

  const tour = useMemo(() => getTourById(String(tourId ?? "")), [getTourById, tourId]);

  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>("");

  const soundRef = useRef<Audio.Sound | null>(null);
  const segmentIndexRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const seekTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [globalPlaybackPosition, setGlobalPlaybackPosition] = useState<number>(0);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);

  const [isAskOpen, setIsAskOpen] = useState<boolean>(false);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [isAsking, setIsAsking] = useState<boolean>(false);

  const sheetHeight = useRef(new Animated.Value(SHEET_MIN)).current;
  const dragStart = useRef<number>(SHEET_MIN);

  const topFade = useRef(new Animated.Value(0)).current;
  const sheetFade = useRef(new Animated.Value(0)).current;

  const landmarks: Landmark[] = tour?.landmarks ?? [];
  const currentLandmark = landmarks[currentIdx];

  const canUseTour = !!tour && tour.type === "route" && landmarks.length > 0;

  const region = useMemo(() => {
    if (!currentLandmark) {
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      } as Region;
    }

    if (userLocation) {
      return getMidRegion(userLocation, currentLandmark.coordinates);
    }

    return {
      latitude: currentLandmark.coordinates.latitude,
      longitude: currentLandmark.coordinates.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    } as Region;
  }, [currentLandmark, userLocation]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation((value: number) => {
          dragStart.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(dragStart.current - g.dy, SHEET_MIN, SHEET_MAX);
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const next = clamp(dragStart.current - g.dy, SHEET_MIN, SHEET_MAX);
        const snapTo = next > (SHEET_MIN + SHEET_MAX) / 2 ? SHEET_MAX : SHEET_MIN;
        Animated.spring(sheetHeight, {
          toValue: snapTo,
          useNativeDriver: false,
          tension: 120,
          friction: 14,
        }).start();
      },
    });
  }, [sheetHeight]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(topFade, { toValue: 1, duration: 420, useNativeDriver: false }),
      Animated.timing(sheetFade, { toValue: 1, duration: 520, useNativeDriver: false }),
    ]).start();
  }, [sheetFade, topFade]);

  useEffect(() => {
    void configureAudioForLockScreen().catch(e => {
      console.error("[WalkingTour] Audio mode error", e);
    });
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup timeouts and audio on unmount
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      const s = soundRef.current;
      soundRef.current = null;
      if (s) {
        s.unloadAsync().catch((e) => console.error("[WalkingTour] unload sound error", e));
      }
    };
  }, []);

  const requestLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError("");

    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          throw new Error("Geolocation not supported");
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setIsLocating(false);
          },
          (err) => {
            console.error("[WalkingTour] web geolocation error", err);
            setLocationError("We couldn't access your location.");
            setIsLocating(false);
          },
          { enableHighAccuracy: true, timeout: 30000 }
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission not granted.");
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 1000,
        maximumAge: 0,
      });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setIsLocating(false);
    } catch (e) {
      console.error("[WalkingTour] requestLocation error", e);
      setLocationError("Failed to get your location.");
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  // Handle app state changes to maintain audio session when screen locks or app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log("[WalkingTour] App state changed to:", nextAppState);
      
      // When app goes to background or inactive (screen lock), ensure audio mode is maintained
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await configureAudioForLockScreen().catch(e => {
          console.error("[WalkingTour] Error maintaining audio mode", e);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let webWatchId: number | null = null;

    const start = async () => {
      try {
        if (Platform.OS === "web") {
          if (!navigator.geolocation) return;
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            (err) => {
              console.error("[WalkingTour] watchPosition error", err);
            },
            { enableHighAccuracy: true }
          );
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 8,
            timeInterval: 1000,
          },
          (loc) => {
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          }
        );
      } catch (e) {
        console.error("[WalkingTour] start watch error", e);
      }
    };

    void start();

    return () => {
      if (sub) sub.remove();
      if (webWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
    };
  }, []);

  const stopAudio = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.stopAsync();
    } catch (e: any) {
      // Ignore "Seeking interrupted" errors - they're expected
      if (!e?.message?.includes('interrupted')) {
        console.error("[WalkingTour] stop audio error", e);
      }
    } finally {
      setIsPlaying(false);
    }
  }, []);

  const segments = useMemo(() => {
    const segs = tour?.audioSegments;
    if (Array.isArray(segs) && segs.length > 0) {
      const cleaned = segs
        .filter((s) => !!s?.uri && typeof s.startTime === "number" && typeof s.duration === "number")
        .map((s) => ({ uri: String(s.uri), startTime: s.startTime, duration: s.duration }))
        .sort((a, b) => a.startTime - b.startTime);
      if (cleaned.length > 0) return cleaned;
    }
    if (tour?.audioUrl) {
      return [{ uri: tour.audioUrl, startTime: 0, duration: Math.max(1, Math.round(tour.duration ?? 60)) }];
    }
    return [] as { uri: string; startTime: number; duration: number }[];
  }, [tour?.audioSegments, tour?.audioUrl, tour?.duration]);

  // Calculate total duration across all segments
  const totalDurationMs = useMemo(() => {
    if (segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    const duration = (lastSegment.startTime + lastSegment.duration) * 1000;
    console.log("[WalkingTour] Calculated total duration:", duration, "ms");
    return duration;
  }, [segments]);

  // Set initial duration when tour loads
  useEffect(() => {
    if (totalDurationMs > 0) {
      console.log("[WalkingTour] Setting playback duration:", totalDurationMs, "ms");
      setPlaybackDuration(totalDurationMs);
    } else {
      console.log("[WalkingTour] Warning: totalDurationMs is 0");
    }
  }, [totalDurationMs]);

  const getSegmentIndexForGlobalMs = useCallback(
    (globalMs: number) => {
      if (isNaN(globalMs) || globalMs < 0) return 0;
      const t = Math.max(0, Math.floor(globalMs / 1000));
      for (let i = segments.length - 1; i >= 0; i--) {
        if (t >= (segments[i].startTime || 0)) return i;
      }
      return 0;
    },
    [segments]
  );

  const getSegmentLocalMs = useCallback(
    (segIdx: number, globalMs: number) => {
      const seg = segments[segIdx];
      if (!seg) return 0;
      const local = globalMs - (seg.startTime || 0) * 1000;
      return Math.max(0, isNaN(local) ? 0 : local);
    },
    [segments]
  );


  const unloadSound = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;
    setGlobalPlaybackPosition(0);
    setPlaybackDuration(totalDurationMs);
    isSeekingRef.current = false;
    if (!s) return;
    try {
      await s.stopAsync();
    } catch {}
    try {
      await s.unloadAsync();
    } catch {}
  }, [totalDurationMs]);

  const loadSegment = useCallback(
    async (nextIndex: number, opts?: { shouldPlay?: boolean; globalPositionMs?: number }) => {
      if (segments.length === 0) throw new Error("Missing audio");
      const seg = segments[nextIndex];
      if (!seg?.uri) throw new Error("Missing audio segment");

      await unloadSound();

      setIsAudioLoading(true);
      segmentIndexRef.current = nextIndex;
      isSeekingRef.current = false;

      const desiredGlobalMs = opts?.globalPositionMs ?? seg.startTime * 1000;
      const localMs = getSegmentLocalMs(nextIndex, desiredGlobalMs);

      console.log("[WalkingTour] Loading segment", {
        nextIndex,
        uri: seg.uri,
        desiredGlobalMs,
        localMs,
      });

      // Re-apply audio mode before loading to ensure lock screen support
      await configureAudioForLockScreen();

      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: seg.uri },
          {
            shouldPlay: false,
            isLooping: false,
            progressUpdateIntervalMillis: 100,
            positionMillis: Math.max(0, Math.floor(localMs)),
            // Enable seeking on Android with MediaPlayer
            ...(Platform.OS === 'android' && { androidImplementation: 'MediaPlayer' as any }),
          }
        );

        s.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;
          setIsPlaying(!!st.isPlaying);
          
          // Update playback position and duration for seeking
          // Use ref to avoid state delays during seeking
          if (!isSeekingRef.current) {
            // Calculate global position from segment start time + local position
            const segIdx = segmentIndexRef.current;
            const seg = segments[segIdx];
            if (seg) {
              const localPositionMs = st.positionMillis || 0;
              const globalPositionMs = seg.startTime * 1000 + localPositionMs;
              setGlobalPlaybackPosition(globalPositionMs);
            }
            // Duration is always the total duration across all segments
            setPlaybackDuration(totalDurationMs);
          }

          if (st.didJustFinish) {
            const idx = segmentIndexRef.current;
            const next = idx + 1;
            if (next < segments.length) {
              console.log("[WalkingTour] Segment finished, advancing", { idx, next });
              void loadSegment(next, { shouldPlay: true, globalPositionMs: segments[next].startTime * 1000 });
            } else {
              console.log("[WalkingTour] Audio finished playing");
              setIsPlaying(false);
            }
          }
        });

        soundRef.current = s;
        
        // Enable Now Playing controls for lock screen
        await enableNowPlayingControls(s);
        
        setIsAudioLoading(false);

        if (opts?.shouldPlay) {
          void s.playAsync().catch((e) => console.error("[WalkingTour] playAsync error", e));
        }
      } catch (e) {
        setIsAudioLoading(false);
        throw e;
      }
    },
    [getSegmentLocalMs, segments, unloadSound, totalDurationMs]
  );

  const ensureSound = useCallback(async () => {
    const s = soundRef.current;
    if (s) return s;
    await loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
    if (!soundRef.current) throw new Error("Failed to load audio");
    return soundRef.current;
  }, [loadSegment]);

  const onTogglePlay = useCallback(async () => {
    if (!currentLandmark) return;

    try {
      const s = await ensureSound();
      const status = await s.getStatusAsync();

      if (status.isLoaded && status.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // For route tours with per-landmark audio, each landmark = one segment
      // Use the landmark's order/index to find corresponding audio segment
      const allLandmarks = tour?.landmarks || [];
      const targetIdx = allLandmarks.findIndex((lm: any) => lm.id === currentLandmark.id);
      const safeIdx = targetIdx >= 0 ? targetIdx : 0;
      
      console.log("[WalkingTour] Playing audio for landmark", {
        landmarkIndex: targetIdx,
        landmarkName: currentLandmark.name,
        targetSegmentIndex: safeIdx,
        totalSegments: segments.length
      });

      if (segmentIndexRef.current !== safeIdx || !soundRef.current) {
        // Load the segment corresponding to this landmark (start from beginning of segment)
        const segmentStartMs = segments[safeIdx]?.startTime ? segments[safeIdx].startTime * 1000 : 0;
        await loadSegment(safeIdx, { shouldPlay: true, globalPositionMs: segmentStartMs });
        setIsPlaying(true);
        return;
      }

      if (status.isLoaded) {
        await s.playAsync();
        setIsPlaying(true);
      }
    } catch (e: any) {
      // Ignore "Seeking interrupted" errors - they're expected
      if (!e?.message?.includes('interrupted')) {
        console.error("[WalkingTour] play/pause error", e);
        Alert.alert("Audio Error", "Couldn't play this stop.");
      }
    }
  }, [currentLandmark, tour, segments, ensureSound, loadSegment]);

  const onNextStop = useCallback(async () => {
    if (!tour) return;

    const nextIdx = currentIdx + 1;
    console.log("[WalkingTour] Moving to next stop", {
      currentIdx,
      nextIdx,
      currentLandmark: landmarks[currentIdx]?.name,
      nextLandmark: landmarks[nextIdx]?.name,
      totalStops: landmarks.length
    });

    await stopAudio();

    if (currentIdx >= landmarks.length - 1) {
      Alert.alert("Tour complete", "You reached the final stop.", [
        { text: "Done", onPress: () => router.back() },
      ]);
      return;
    }

    setCurrentIdx((v) => v + 1);
    Animated.spring(sheetHeight, {
      toValue: SHEET_MIN,
      useNativeDriver: false,
      tension: 120,
      friction: 14,
    }).start();
    
    // Auto-play audio for the next landmark after a short delay
    setTimeout(() => {
      if (nextIdx < segments.length) {
        console.log("[WalkingTour] Auto-playing next landmark audio");
        const segmentStartMs = segments[nextIdx]?.startTime ? segments[nextIdx].startTime * 1000 : 0;
        loadSegment(nextIdx, { shouldPlay: true, globalPositionMs: segmentStartMs })
          .catch((e: any) => console.error("[WalkingTour] Failed to auto-play next landmark", e));
      }
    }, 100);
  }, [currentIdx, landmarks, segments, tour, router, sheetHeight, stopAudio, loadSegment]);

  const onAsk = useCallback(async () => {
    if (!question.trim() || !tour || !currentLandmark) return;

    setIsAsking(true);
    setAnswer("");

    try {
      const context = `Tour: ${tour.title}\nLocation: ${tour.location}\nLandmark: ${currentLandmark.name}\nDescription: ${currentLandmark.description}`;
      const prompt =
        `Answer the user's question about this landmark. ` +
        `Be accurate, concise, and specific. Avoid special characters like * or bullets. ` +
        `Context: ${context}\n\nQuestion: ${question}`;

      console.log("[WalkingTour] Asking AI", { qLen: question.length });
      
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "SoloBuddy/1.0 (Audio Tour App)",
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
      const resp = data.choices[0]?.message?.content || "";

      setAnswer(resp || "Sorry, I couldn't answer that. Try again.");
    } catch (e) {
      console.error("[WalkingTour] ask AI error", e);
      setAnswer("Sorry, something went wrong. Please try again.");
    } finally {
      setIsAsking(false);
    }
  }, [currentLandmark, question, tour]);

  const onOpenAsk = useCallback(() => {
    setIsAskOpen(true);
    setQuestion("");
    setAnswer("");
  }, []);

  if (!canUseTour) {
    return (
      <View style={styles.errorContainer} testID="walkingTourError">
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorTitle}>Tour not available</Text>
        <Text style={styles.errorSubtitle}>Open this from your Library after creating a walking route tour.</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={styles.errorButton}
          testID="walkingTourBack"
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = (currentIdx + 1) / landmarks.length;

  return (
    <View style={styles.container} testID="walkingTourScreen">
      <Stack.Screen options={{ headerShown: false }} />

      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={() => {
          console.log("[WalkingTour] region changed");
        }}
        showsUserLocation
        showsMyLocationButton
        testID="walkingTourMap"
      >
        {landmarks.map((lm, idx) => (
          <Marker
            key={lm.id}
            coordinate={lm.coordinates}
            title={lm.name}
            pinColor={idx === currentIdx ? Colors.light.primary : "#FF6B6B"}
            onPress={() => {
              console.log("[WalkingTour] marker press", { idx });
              setCurrentIdx(idx);
            }}
          />
        ))}

        {userLocation && currentLandmark && (
          <Polyline
            coordinates={[userLocation, currentLandmark.coordinates]}
            strokeWidth={5}
            strokeColor={Colors.light.primary}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      <View style={styles.topScrim} pointerEvents="none" />

      <Animated.View style={[styles.topBar, { opacity: topFade }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
          testID="walkingTourBackBtn"
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.sheet, { height: sheetHeight, opacity: sheetFade }]} testID="walkingTourSheet">
        <View {...panResponder.panHandlers} style={styles.sheetHandleArea} testID="walkingTourSheetHandle">
          <View style={styles.handlePill} />
        </View>

        <View style={styles.sheetContent}>
          <View style={styles.metaRow}>
            <Text style={styles.landmarkTitle} numberOfLines={2} testID="walkingTourLandmarkTitle">
              {currentLandmark.name}
            </Text>
          </View>

          <View style={styles.progressTrack} testID="walkingTourProgress">
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>

          {/* Audio Seeking Slider */}
          {playbackDuration > 0 ? (
            <View style={styles.audioSeekContainer} testID="walkingTourAudioSeeker">
              <Text style={styles.audioTimeText}>{formatTime(globalPlaybackPosition)}</Text>
              <Slider
                style={styles.audioSlider}
                testID="walkingTourAudioSlider"
                minimumValue={0}
                maximumValue={Math.max(1, playbackDuration)}
                value={Math.max(0, Math.min(globalPlaybackPosition || 0, playbackDuration))}
                onSlidingStart={() => {
                  isSeekingRef.current = true;
                  // Clear any pending seek operations
                  if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = null;
                  }
                }}
                onValueChange={(value) => {
                  // Update UI immediately during scrubbing
                  setGlobalPlaybackPosition(value);
                }}
                onSlidingComplete={async (globalMs) => {
                  // Debounce seek operations to prevent rapid consecutive seeks
                  if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                  }
                  
                  seekTimeoutRef.current = setTimeout(async () => {
                  try {
                    console.log("[WalkingTour] Seeking to global position:", globalMs);
                    
                    // Find which segment this position falls into
                    const targetSegmentIndex = getSegmentIndexForGlobalMs(globalMs);
                    const targetSegment = segments[targetSegmentIndex];
                    
                    if (!targetSegment) {
                      isSeekingRef.current = false;
                      return;
                    }

                    // Calculate local position within that segment
                    const localMs = getSegmentLocalMs(targetSegmentIndex, globalMs);
                    
                    console.log("[WalkingTour] Seek target:", {
                      globalMs,
                      targetSegmentIndex,
                      currentSegmentIndex: segmentIndexRef.current,
                      localMs,
                    });

                    // If we need to switch segments, load the new segment
                    if (targetSegmentIndex !== segmentIndexRef.current) {
                      const wasPlaying = isPlaying;
                      await loadSegment(targetSegmentIndex, {
                        shouldPlay: wasPlaying,
                        globalPositionMs: globalMs,
                      });
                    } else {
                      // Same segment, just seek within it
                      const s = soundRef.current;
                      if (s) {
                        try {
                          await s.setPositionAsync(Math.floor(localMs));
                        } catch (seekErr: any) {
                          // Ignore "Seeking interrupted" errors - they're expected during rapid scrubbing
                          if (seekErr?.message?.includes('interrupted')) {
                            console.log("[WalkingTour] Seek interrupted (expected during scrubbing)");
                          } else {
                            throw seekErr;
                          }
                        }
                      }
                    }

                    // Small delay to ensure position is set before allowing updates
                    setTimeout(() => {
                      isSeekingRef.current = false;
                    }, 50);
                  } catch (err: any) {
                    // Ignore "Seeking interrupted" errors
                    if (!err?.message?.includes('interrupted')) {
                      console.error("[WalkingTour] Seek error:", err);
                    }
                    isSeekingRef.current = false;
                  }
                  }, 50); // 50ms debounce
                }}
                minimumTrackTintColor={Colors.light.primary}
                maximumTrackTintColor="rgba(15,20,25,0.10)"
                thumbTintColor={Colors.light.primary}
                step={100}
              />
              <Text style={styles.audioTimeText}>{formatTime(playbackDuration)}</Text>
            </View>
          ) : (
            <View style={styles.audioSeekContainer}>
              <Text style={[styles.audioTimeText, { opacity: 0.5 }]}>Loading...</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.playBtn, (isAudioLoading || isLocating) && styles.playBtnDisabled]}
              onPress={onTogglePlay}
              activeOpacity={0.9}
              disabled={isAudioLoading}
              testID="walkingTourPlay"
            >
              {isAudioLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : isPlaying ? (
                <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              )}
              <Text style={styles.playBtnText}>{isPlaying ? "Pause" : "Play audio"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.askBtn}
              onPress={onOpenAsk}
              activeOpacity={0.9}
              testID="walkingTourAsk"
            >
              <MessageCircle size={18} color={Colors.light.primary} />
              <Text style={styles.askBtnText}>Ask</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dirBtn}
              onPress={() => {
                console.log("[WalkingTour] Directions tapped");
                Animated.spring(sheetHeight, {
                  toValue: SHEET_MAX,
                  useNativeDriver: false,
                  tension: 120,
                  friction: 14,
                }).start();
              }}
              activeOpacity={0.9}
              testID="walkingTourDirections"
            >
              <NavigationIcon size={18} color={Colors.light.primary} />
              <Text style={styles.dirBtnText}>Directions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.descWrap}>
            <Text style={styles.desc} numberOfLines={3} testID="walkingTourDesc">
              {currentLandmark.description}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.locRow}>
              {isLocating ? (
                <Text style={styles.locText} testID="walkingTourLocStatus">Locating…</Text>
              ) : locationError ? (
                <TouchableOpacity
                  onPress={requestLocation}
                  style={styles.locRetry}
                  activeOpacity={0.85}
                  testID="walkingTourLocRetry"
                >
                  <Text style={styles.locRetryText}>Enable location</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.locText} testID="walkingTourLocOk">
                  Follow the line to the next stop
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={onNextStop}
              activeOpacity={0.9}
              testID="walkingTourNext"
            >
              <Text style={styles.nextBtnText}>
                {currentIdx === landmarks.length - 1 ? "Finish" : "Next site"}
              </Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Modal
        visible={isAskOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAskOpen(false)}
      >
        <View style={styles.modalOverlay} testID="walkingTourAskModal">
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsAskOpen(false)}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>Ask about {currentLandmark.name}</Text>
              <TouchableOpacity onPress={() => setIsAskOpen(false)} activeOpacity={0.85} testID="walkingTourAskClose">
                <X size={20} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask anything (history, architecture, fun facts…)"
                placeholderTextColor={"rgba(15,20,25,0.38)"}
                style={styles.input}
                multiline
                testID="walkingTourAskInput"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setQuestion("What should I look for here?");
                  }}
                  style={styles.chip}
                  activeOpacity={0.85}
                  testID="walkingTourAskChip"
                >
                  <Text style={styles.chipText}>What to see</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setQuestion("What's the history of this place?");
                  }}
                  style={styles.chip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chipText}>History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setQuestion("Tell me an interesting fact about this landmark.");
                  }}
                  style={styles.chip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chipText}>Fun fact</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={onAsk}
                activeOpacity={0.9}
                style={[styles.askSubmit, (!question.trim() || isAsking) && styles.askSubmitDisabled]}
                disabled={!question.trim() || isAsking}
                testID="walkingTourAskSubmit"
              >
                {isAsking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.askSubmitText}>Ask</Text>
                )}
              </TouchableOpacity>

              {!!answer && (
                <View style={styles.answerCard} testID="walkingTourAskAnswer">
                  <Text style={styles.answerText}>{answer}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "rgba(15, 23, 42, 0.20)",
  },
  topBar: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  sheetHandleArea: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
  },
  handlePill: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(15,20,25,0.16)",
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  landmarkTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(30, 136, 229, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(30, 136, 229, 0.18)",
  },
  countPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.light.primary,
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,20,25,0.10)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
  },
  audioSeekContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  audioSlider: {
    flex: 1,
    height: 40,
    minWidth: 200,
  },
  audioTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    minWidth: 36,
    textAlign: "center",
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    minHeight: 48,
  },
  playBtnDisabled: {
    opacity: 0.7,
  },
  playBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },
  askBtn: {
    width: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  askBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.light.primary,
  },
  dirBtn: {
    width: 118,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  dirBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.light.primary,
  },
  descWrap: {
    marginTop: 12,
    backgroundColor: "rgba(247,249,250,0.9)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  locRow: {
    flex: 1,
  },
  locText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(15,20,25,0.58)",
  },
  locRetry: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,149,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,149,0,0.20)",
  },
  locRetryText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8A4B00",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0B1220",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  modalTitle: {
    flex: 1,
    marginRight: 10,
    fontSize: 15,
    fontWeight: "900",
    color: Colors.light.text,
  },
  modalBody: {
    padding: 14,
    gap: 12,
  },
  input: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.text,
    backgroundColor: "rgba(247,249,250,0.8)",
  },
  modalButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    backgroundColor: "rgba(30,136,229,0.10)",
    borderColor: "rgba(30,136,229,0.16)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.light.primary,
  },
  askSubmit: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  askSubmitDisabled: {
    opacity: 0.6,
  },
  askSubmitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  answerCard: {
    backgroundColor: "rgba(15,20,25,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    padding: 12,
  },
  answerText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: Colors.light.text,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    backgroundColor: Colors.light.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 18,
    textAlign: "center",
  },
  errorButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
