import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Audio } from "expo-av";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Square,
} from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { AudioGuide } from "@/types";

interface AudioPlayerProps {
  guide: AudioGuide;
  onClose: () => void;
}

type LoadState = "loading" | "ready" | "error";

function formatTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildUnsplashArtworkUrl(title: string, location: string) {
  const q = encodeURIComponent(`${title} ${location} city landmark`);
  return `https://source.unsplash.com/1200x1200/?${q}`;
}

export default function AudioPlayer({ guide, onClose }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(Math.max(0, guide.duration * 1000));
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [showChapters, setShowChapters] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const artworkUrl = useMemo(() => {
    if (guide.thumbnailUrl) return guide.thumbnailUrl;
    return buildUnsplashArtworkUrl(guide.title, guide.location || "");
  }, [guide.location, guide.thumbnailUrl, guide.title]);

  useEffect(() => {
    isMountedRef.current = true;

    const setupAudio = async () => {
      try {
        console.log("[AudioPlayer] Setting audio mode");
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
        });

        console.log("[AudioPlayer] Loading audio", { url: guide.audioUrl });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: guide.audioUrl },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          (status: any) => {
            if (!isMountedRef.current) return;
            if (status?.isLoaded) {
              setPosition(status.positionMillis ?? 0);
              setDuration(status.durationMillis ?? guide.duration * 1000);
              setIsPlaying(!!status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );

        soundRef.current = newSound;
        setLoadState("ready");
      } catch (error) {
        console.error("[AudioPlayer] Audio load error:", error);
        setLoadState("error");
      }
    };

    void setupAudio();

    return () => {
      isMountedRef.current = false;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) {
        s.stopAsync()
          .catch((e) => console.error("[AudioPlayer] stopAsync cleanup error", e))
          .finally(() => {
            s.unloadAsync().catch((e) => console.error("[AudioPlayer] unloadAsync cleanup error", e));
          });
      }
    };
  }, [guide.audioUrl, guide.duration]);

  const togglePlayPause = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) return;

      if (st.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
      } else {
        await s.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("[AudioPlayer] togglePlayPause error", e);
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const st = await s.getStatusAsync();
      if (!st.isLoaded) {
        setIsPlaying(false);
        setPosition(0);
        return;
      }

      if (st.isPlaying) {
        await s.pauseAsync();
      }
      await s.setPositionAsync(0);
      setPosition(0);
      setIsPlaying(false);
    } catch (e) {
      console.error("[AudioPlayer] stopPlayback error", e);
      setIsPlaying(false);
      setPosition(0);
    }
  }, []);

  const handleClose = useCallback(() => {
    void stopPlayback();
    onClose();
  }, [onClose, stopPlayback]);

  const handleSeek = useCallback(async (value: number) => {
    const s = soundRef.current;
    if (!s) return;
    try {
      await s.setPositionAsync(value);
      setPosition(value);
    } catch (e) {
      console.error("[AudioPlayer] handleSeek error", e);
    }
  }, []);

  const skipForward = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const newPos = Math.min(duration, position + 15000);
      await s.setPositionAsync(newPos);
    } catch (e) {
      console.error("[AudioPlayer] skipForward error", e);
    }
  }, [duration, position]);

  const skipBackward = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const newPos = Math.max(0, position - 15000);
      await s.setPositionAsync(newPos);
    } catch (e) {
      console.error("[AudioPlayer] skipBackward error", e);
    }
  }, [position]);

  const changeSpeed = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      const newSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
      await s.setRateAsync(newSpeed, true);
      setPlaybackSpeed(newSpeed);
    } catch (e) {
      console.error("[AudioPlayer] changeSpeed error", e);
    }
  }, [playbackSpeed]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton} testID="audioPlayerClose">
            <ChevronDown size={28} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <TouchableOpacity
            onPress={stopPlayback}
            style={styles.headerStopButton}
            activeOpacity={0.8}
            testID="audioPlayerStop"
          >
            <Square size={22} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="audioPlayerScroll"
        >
          <View style={styles.artworkContainer}>
            <Image source={{ uri: artworkUrl }} style={styles.artwork} resizeMode="cover" />
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.title} numberOfLines={2}>
              {guide.title}
            </Text>
            <Text style={styles.location}>{guide.location || "Audio Tour"}</Text>
          </View>

          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={handleSeek}
              minimumTrackTintColor={Colors.light.primary}
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor={Colors.light.primary}
              testID="audioPlayerSlider"
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity onPress={changeSpeed} style={styles.speedButton} testID="audioPlayerSpeed">
              <Text style={styles.speedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>

            <View style={styles.mainControls}>
              <TouchableOpacity onPress={skipBackward} style={styles.skipButton} testID="audioPlayerBack15">
                <SkipBack size={28} color={Colors.light.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                style={styles.playButton}
                activeOpacity={0.8}
                testID="audioPlayerPlayPause"
              >
                {loadState === "loading" ? (
                  <ActivityIndicator color="#fff" />
                ) : isPlaying ? (
                  <Pause size={32} color="#fff" fill="#fff" />
                ) : (
                  <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={skipForward} style={styles.skipButton} testID="audioPlayerFwd15">
                <SkipForward size={28} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {guide.chapters && guide.chapters.length > 0 && (
            <TouchableOpacity
              style={styles.chaptersButton}
              onPress={() => setShowChapters((v) => !v)}
              activeOpacity={0.85}
              testID="audioPlayerChaptersToggle"
            >
              <Text style={styles.chaptersText}>Chapters</Text>
              {showChapters ? (
                <ChevronUp size={20} color={Colors.light.primary} />
              ) : (
                <ChevronDown size={20} color={Colors.light.primary} />
              )}
            </TouchableOpacity>
          )}

          {showChapters && guide.chapters && (
            <View style={styles.chaptersCard} testID="audioPlayerChapters">
              <ScrollView
                style={styles.chaptersList}
                contentContainerStyle={styles.chaptersListContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {guide.chapters.map((chapter, index) => (
                  <TouchableOpacity
                    key={`${chapter.title}-${chapter.timestamp}-${index}`}
                    style={styles.chapterItem}
                    onPress={() => handleSeek(chapter.timestamp * 1000)}
                    activeOpacity={0.85}
                    testID={`audioPlayerChapter-${index}`}
                  >
                    <Text style={styles.chapterTitle} numberOfLines={1}>
                      {chapter.title}
                    </Text>
                    <Text style={styles.chapterTime}>{formatTime(chapter.timestamp * 1000)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 12,
  },
  headerStopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,20,25,0.04)",
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  artworkContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  infoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 8,
  },
  location: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  progressContainer: {
    marginBottom: 32,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  skipButton: {
    padding: 12,
  },
  speedButton: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  speedText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  chaptersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  chaptersText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  chaptersCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(247,249,250,0.9)",
    overflow: "hidden",
  },
  chaptersList: {
    maxHeight: 260,
  },
  chaptersListContent: {
    paddingVertical: 4,
  },
  chapterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  chapterTitle: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "700",
    flex: 1,
    marginRight: 16,
  },
  chapterTime: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  bottomSpacer: {
    height: 18,
  }
});
