import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  AppState,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import Slider from "@react-native-community/slider";
import { 
  ChevronLeft, 
  Sparkles, 
  MapPin, 
  Clock, 
  ArrowRight, 
  ImageIcon,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { useTours } from "@/contexts/ToursContext";
import type { Landmark, AudioSegment } from "@/types";
import { getThemedPlaceholder, getLocationImageWithFallback } from "@/lib/image-utils";
import { configureAudioForLockScreen, enableNowPlayingControls } from "@/lib/audio-config";
import { triggerHapticFeedback } from "@/lib/haptics";

// Helper to extract city name from location or title
function extractCityName(location?: string, title?: string): string {
  const text = location || title || "";
  // If it's in "City: Focus" format, extract the city
  if (text.includes(":")) {
    return text.split(":")[0].trim();
  }
  // Remove common suffixes
  return text.replace(/,.*$|Tour$|Guide$/i, "").trim() || "city";
}

// Component for tour cover image - shows relevant location image based on tour type
function TourCoverImage({ 
  location, 
  title, 
  tourType,
  style 
}: { 
  location?: string; 
  title?: string; 
  tourType?: string;
  style: any 
}) {
  // For landmark tours, use the full location name
  // For city/route tours, extract just the city name
  const getSearchTermAndContext = () => {
    const text = location || title || "";
    
    if (tourType === "landmark") {
      // Clean up the location but keep the landmark name intact
      const cleanLocation = text
        .replace(/\s*(Tour|Guide)$/i, '')
        .trim();
      return {
        searchTerm: cleanLocation,
        context: "landmark monument"
      };
    }
    
    // For city/route tours, extract the city
    return {
      searchTerm: extractCityName(location, title),
      context: "city skyline"
    };
  };

  const { searchTerm, context } = getSearchTermAndContext();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      setIsLoading(true);

      try {
        // Use the comprehensive image fetcher that tries Google Places, then Wikipedia
        console.log("[TourReady] Fetching cover image for:", searchTerm, "context:", context);
        const image = await getLocationImageWithFallback(searchTerm, context);
        
        if (mounted) {
          setImageUrl(image);
        }
      } catch (error) {
        console.log("[TourReady] Error fetching cover image:", error);
        if (mounted) {
          // Use themed placeholder as last resort
          setImageUrl(getThemedPlaceholder("city"));
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
  }, [searchTerm, context]);

  const handleError = () => {
    // On error, use themed placeholder for guaranteed image
    console.log("[TourCoverImage] Image load error, using themed placeholder");
    setImageUrl(getThemedPlaceholder("city"));
  };

  if (isLoading) {
    return (
      <View style={[style, { backgroundColor: "#EEF2F7", alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  const finalUrl = imageUrl || getThemedPlaceholder("city");

  return (
    <Image
      source={{ uri: finalUrl }}
      style={style}
      resizeMode="cover"
      onError={handleError}
    />
  );
}

// Component for landmark image with loading state - shows actual landmark image
function LandmarkImage({ name, location, style }: { name: string; location: string | undefined; style: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // Use just the landmark name for best image results
        // The name alone (e.g., "The Alamo", "Big Ben") gives better results than combining with city
        console.log("[LandmarkImage] Fetching image for landmark:", name);
        const image = await getLocationImageWithFallback(name, "landmark monument");
        
        if (mounted) {
          setImageUrl(image);
          setIsLoading(false);
        }
      } catch (error) {
        console.log("[LandmarkImage] Error:", error);
        if (mounted) {
          setImageUrl(getThemedPlaceholder("landmark"));
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
    };
  }, [name, location]);

  if (isLoading) {
    return (
      <View style={[style, { backgroundColor: "#EEF2F7", alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="small" color={Colors.light.primary} />
      </View>
    );
  }

  if (hasError || !imageUrl) {
    // Even on error, show themed placeholder instead of icon
    return (
      <Image
        source={{ uri: getThemedPlaceholder("landmark") }}
        style={style}
        resizeMode="cover"
      />
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
  );
}

export default function TourReadyScreen() {
  const router = useRouter();
  const { tourId } = useLocalSearchParams();
  const { getTourById } = useTours();

  const tour = useMemo(() => getTourById(String(tourId ?? "")), [getTourById, tourId]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const landmarks = useMemo<Landmark[]>(() => tour?.landmarks ?? [], [tour?.landmarks]);
  const stopsCount = landmarks.length;

  // Audio player state
  const soundRef = useRef<Audio.Sound | null>(null);
  const segmentIndexRef = useRef<number>(0);
  const intendedPlayingRef = useRef<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [audioPosition, setAudioPosition] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPosition, setScrubPosition] = useState<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const [audioReady, setAudioReady] = useState<boolean>(false);

  // Get audio segments or create a single segment from audioUrl
  // Note: tour.duration is in minutes, segment.duration is in seconds
  const segments = useMemo<AudioSegment[]>(() => {
    if (tour?.audioSegments && tour.audioSegments.length > 0) {
      return tour.audioSegments;
    }
    if (tour?.audioUrl) {
      // Convert tour.duration from minutes to seconds
      const durationInSeconds = (tour.duration || 0) * 60;
      return [{ uri: tour.audioUrl, startTime: 0, duration: durationInSeconds }];
    }
    return [];
  }, [tour?.audioSegments, tour?.audioUrl, tour?.duration]);

  // Set up audio mode for background/lock screen playback (like Spotify)
  useEffect(() => {
    void configureAudioForLockScreen().catch(e => {
      console.error("[TourReady] Audio mode setup error:", e);
    });
  }, []);

  // Maintain audio mode when screen locks or app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await configureAudioForLockScreen().catch(e => {
          console.error("[TourReady] Error maintaining audio mode", e);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize audio duration from segments
  useEffect(() => {
    if (segments.length > 0) {
      const totalDur = segments.reduce((acc, seg) => acc + seg.duration * 1000, 0);
      if (totalDur > 0) {
        setAudioDuration(totalDur);
        console.log("[TourReady] Audio duration set from segments:", totalDur);
      }
    }
  }, [segments]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Ignore errors during cleanup
      }
      soundRef.current = null;
    }
  }, []);

  const getSegmentIndexForGlobalMs = useCallback((globalMs: number): number => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segStart = seg.startTime * 1000;
      const segEnd = segStart + seg.duration * 1000;
      if (globalMs >= segStart && globalMs < segEnd) return i;
    }
    return segments.length - 1;
  }, [segments]);

  const getSegmentLocalMs = useCallback((segIdx: number, globalMs: number): number => {
    const seg = segments[segIdx];
    if (!seg) return 0;
    return Math.max(0, globalMs - seg.startTime * 1000);
  }, [segments]);

  const loadSegment = useCallback(
    async (
      segIdx: number,
      opts?: { shouldPlay?: boolean; globalPositionMs?: number }
    ) => {
      if (segments.length === 0) return;
      const seg = segments[segIdx];
      if (!seg) return;

      await unloadSound();
      segmentIndexRef.current = segIdx;
      setIsAudioLoading(true);
      setAudioReady(false);

      try {
        const localMs = opts?.globalPositionMs
          ? getSegmentLocalMs(segIdx, opts.globalPositionMs)
          : 0;

        console.log("[TourReady] Loading segment", { segIdx, uri: seg.uri.substring(0, 50), localMs });

        // Re-apply audio mode before loading to ensure lock screen support
        await configureAudioForLockScreen();

        const { sound: s, status } = await Audio.Sound.createAsync(
          { uri: seg.uri },
          {
            shouldPlay: false,
            isLooping: false,
            progressUpdateIntervalMillis: 200,
            positionMillis: Math.max(0, Math.floor(localMs)),
          }
        );

        // Get actual duration from loaded status
        if (status.isLoaded && status.durationMillis) {
          console.log("[TourReady] Audio loaded with duration:", status.durationMillis);
          setAudioDuration(status.durationMillis);
        }

        s.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded) return;

          const localPos = typeof st.positionMillis === "number" ? st.positionMillis : 0;
          const segNow = segments[segmentIndexRef.current];
          const globalPos = (segNow?.startTime ?? 0) * 1000 + localPos;
          
          // Only update position if not scrubbing
          if (!isScrubbingRef.current) {
            setAudioPosition(globalPos);
          }

          // Update duration if not already set
          if (typeof st.durationMillis === "number" && st.durationMillis > 0) {
            setAudioDuration((prev) => prev === 0 ? st.durationMillis! : prev);
          }

          // Handle playback state - use intended state to prevent UI flicker
          if (st.didJustFinish) {
            const idx = segmentIndexRef.current;
            const next = idx + 1;
            if (next < segments.length) {
              intendedPlayingRef.current = true;
              void loadSegment(next, { shouldPlay: true, globalPositionMs: segments[next].startTime * 1000 });
            } else {
              intendedPlayingRef.current = false;
              setIsPlaying(false);
              setAudioPosition(0);
            }
          } else {
            // Use intended state to prevent race conditions
            setIsPlaying(intendedPlayingRef.current);
          }
        });

        soundRef.current = s;
        
        // Enable Now Playing controls for lock screen
        await enableNowPlayingControls(s);
        
        setIsAudioLoading(false);
        setAudioReady(true);

        if (opts?.shouldPlay) {
          intendedPlayingRef.current = true;
          setIsPlaying(true);
          await s.playAsync().catch((e) => {
            console.error("[TourReady] playAsync error", e);
            intendedPlayingRef.current = false;
            setIsPlaying(false);
          });
        } else {
          intendedPlayingRef.current = false;
        }
      } catch (e) {
        setIsAudioLoading(false);
        setAudioReady(false);
        intendedPlayingRef.current = false;
        setIsPlaying(false);
        console.error("[TourReady] loadSegment error:", e);
      }
    },
    [getSegmentLocalMs, segments, unloadSound]
  );

  // Pre-load audio when segments become available for better scrubbing experience
  useEffect(() => {
    if (segments.length > 0 && !soundRef.current && !isAudioLoading) {
      console.log("[TourReady] Pre-loading audio for scrubbing");
      loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
    }
  }, [segments, loadSegment, isAudioLoading]);

  const ensureSound = useCallback(async () => {
    if (soundRef.current) return soundRef.current;
    if (segments.length === 0) return null;
    await loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
    return soundRef.current;
  }, [loadSegment, segments.length]);

  const handleScrubStart = useCallback(async () => {
    setIsScrubbing(true);
    isScrubbingRef.current = true;
    
    // Ensure audio is loaded when user starts scrubbing
    if (!soundRef.current && segments.length > 0) {
      console.log("[TourReady] Loading audio on scrub start");
      await loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
    }
  }, [loadSegment, segments.length]);

  const handleScrubbing = useCallback((value: number) => {
    setScrubPosition(value);
  }, []);

  const handleSeek = useCallback(async (value: number) => {
    setIsScrubbing(false);
    isScrubbingRef.current = false;
    
    // Clamp value to valid range
    const maxDuration = audioDuration > 0 ? audioDuration : value + 1;
    const clampedValue = Math.max(0, Math.min(value, maxDuration));
    console.log("[TourReady] Seeking to:", clampedValue);
    
    // Update position immediately for UI responsiveness
    setAudioPosition(clampedValue);
    
    const wasPlaying = intendedPlayingRef.current;
    const sound = soundRef.current;
    
    try {
      // If we have a loaded sound, just seek directly - faster and smoother
      if (sound && audioReady) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(Math.floor(clampedValue));
          console.log("[TourReady] Seek complete");
          return;
        }
      }
      
      // Sound not loaded - need to load at the seek position
      console.log("[TourReady] Loading audio at seek position");
      const targetIdx = getSegmentIndexForGlobalMs(clampedValue);
      await loadSegment(targetIdx, { shouldPlay: wasPlaying, globalPositionMs: clampedValue });
    } catch (e) {
      console.error("[TourReady] Seek error:", e);
      // Attempt recovery
      try {
        const targetIdx = getSegmentIndexForGlobalMs(clampedValue);
        await loadSegment(targetIdx, { shouldPlay: wasPlaying, globalPositionMs: clampedValue });
      } catch (reloadError) {
        console.error("[TourReady] Failed to recover from seek error", reloadError);
      }
    }
  }, [audioDuration, audioReady, getSegmentIndexForGlobalMs, loadSegment]);

  const skipForward = useCallback(async () => {
    triggerHapticFeedback();
    const newPos = Math.min(audioDuration, audioPosition + 15000);
    await handleSeek(newPos);
  }, [audioDuration, audioPosition, handleSeek]);

  const skipBackward = useCallback(async () => {
    triggerHapticFeedback();
    const newPos = Math.max(0, audioPosition - 15000);
    await handleSeek(newPos);
  }, [audioPosition, handleSeek]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const onTogglePlay = useCallback(async () => {
    if (segments.length === 0) return;

    try {
      const s = await ensureSound();
      if (!s) return;
      
      const status = await s.getStatusAsync();

      if (!status.isLoaded) {
        intendedPlayingRef.current = true;
        await loadSegment(0, { shouldPlay: true, globalPositionMs: 0 });
        return;
      }

      if (status.isPlaying) {
        console.log("[TourReady] Pausing audio...");
        intendedPlayingRef.current = false;
        setIsPlaying(false);
        await s.pauseAsync();
        console.log("[TourReady] Audio paused");
      } else {
        console.log("[TourReady] Playing audio...");
        intendedPlayingRef.current = true;
        setIsPlaying(true);
        await s.playAsync();
        console.log("[TourReady] Audio playing");
      }
    } catch (e) {
      console.error("[TourReady] toggle play error", e);
      intendedPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [ensureSound, loadSegment, segments.length]);

  const hasAudio = segments.length > 0;

  const itemAnims = useRef<Animated.Value[]>([]);
  if (itemAnims.current.length !== landmarks.length) {
    itemAnims.current = landmarks.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 46,
        useNativeDriver: true,
      }),
    ]).start();

    const items = itemAnims.current;
    Animated.stagger(
      90,
      items.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [fadeAnim, slideAnim, landmarks.length]);

  const onStart = useCallback(() => {
    triggerHapticFeedback();
    console.log("[TourReady] Start tour", { tourId: String(tourId ?? "") });
    router.replace({
      pathname: "/walking-tour",
      params: { tourId: String(tourId ?? "") },
    } as any);
  }, [router, tourId]);

  return (
    <View style={styles.container} testID="tourReadyScreen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <ChevronLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Tour Cover Image */}
          <View style={styles.coverImageContainer}>
            <TourCoverImage 
              location={tour?.location} 
              title={tour?.title}
              tourType={tour?.type}
              style={styles.coverImage}
            />
            <View style={styles.coverOverlay} />
            {tour?.title && (
              <Text style={styles.coverTitle}>{tour.title}</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Clock size={16} color={Colors.light.textSecondary} />
              <Text style={styles.statText}>~{Math.round(stopsCount * 15)} min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <MapPin size={16} color={Colors.light.textSecondary} />
              <Text style={styles.statText}>{stopsCount} stops</Text>
            </View>
            {tour?.location && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statText}>{tour.location}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.itinerarySection}>
            <Text style={styles.sectionTitle}>Trip itinerary</Text>

            <View style={styles.timeline}>
              <View style={styles.timelineLine} />

              {landmarks.map((lm, idx) => {
                const v = itemAnims.current[idx];
                const translateY = v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                });

                return (
                  <Animated.View
                    key={lm.id}
                    style={[styles.timelineItem, { opacity: v, transform: [{ translateY }] }]}
                    testID={`tourReadyStop_${idx + 1}`}
                  >
                    <View style={styles.timelineDotContainer}>
                      <View style={styles.timelineDot}>
                        <Text style={styles.timelineNumber}>{idx + 1}</Text>
                      </View>
                    </View>

                    <View style={styles.landmarkRowCard}>
                      <View style={styles.landmarkTextCol}>
                        <Text style={styles.landmarkName} numberOfLines={1}>
                          {lm.name}
                        </Text>
                        <Text style={styles.landmarkDesc} numberOfLines={2}>
                          {lm.description}
                        </Text>
                      </View>

                      <LandmarkImage
                        name={lm.name}
                        location={tour?.location}
                        style={styles.landmarkThumb}
                      />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </Animated.View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onStart}
          activeOpacity={0.9}
        >
          <Text style={styles.startBtnText}>Start Tour</Text>
          <ArrowRight size={20} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => {
            triggerHapticFeedback();
            router.push({ pathname: "/(tabs)/library" as any } as any);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save for later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: "#F6F8FB",
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F4F7",
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  content: {
    marginTop: 20,
  },
  coverImageContainer: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
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
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "transparent",
    // Gradient effect using linear gradient would be better, but this works
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  coverTitle: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sparkleIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(30, 136, 229, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    flex: 1,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  tourTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 26,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },
  itinerarySection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 20,
  },
  timeline: {
    position: "relative",
    paddingLeft: 20,
  },
  timelineLine: {
    position: "absolute",
    left: 14,
    top: 8,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(15, 23, 42, 0.10)",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-start",
  },
  timelineDotContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 14,
    zIndex: 1,
    backgroundColor: "#F6F8FB",
    paddingVertical: 4,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F6F8FB",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  timelineNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  landmarkRowCard: {
    flex: 1,
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  landmarkTextCol: {
    flex: 1,
    paddingRight: 2,
  },
  landmarkThumb: {
    width: Math.min(92, Math.max(80, Math.round(SCREEN_WIDTH * 0.22))),
    height: Math.min(92, Math.max(80, Math.round(SCREEN_WIDTH * 0.22))),
    borderRadius: 16,
    backgroundColor: "#EEF2F7",
  },
  landmarkName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 6,
  },
  landmarkDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  startBtn: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  saveBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  saveBtnText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  // Audio Player Styles
  audioPlayerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  audioPlayerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: "center",
  },
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 12,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  skipBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderWrapper: {
    flex: 1,
    height: 50,
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLoading: {
    position: "absolute",
    right: 0,
    top: 15,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    minWidth: 42,
    textAlign: "center",
  },
});
