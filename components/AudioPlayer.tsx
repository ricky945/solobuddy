import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { AudioGuide, Chapter } from "@/types";

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildUnsplashArtworkUrl(title: string, location: string) {
  const q = encodeURIComponent(`${title} ${location} city landmark`);
  return `https://source.unsplash.com/1200x1200/?${q}`;
}

function getErrorMessage(e: unknown): string {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Something went wrong";
  const msg = (e as { message?: unknown })?.message;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(e);
  } catch {
    return "Something went wrong";
  }
}

function useWaveBars(count: number) {
  return useMemo(() => {
    const bars = Array.from({ length: count }).map((_, i) => {
      const seed = (i * 37) % 17;
      const h = 8 + ((seed * 7) % 22);
      return h;
    });
    return bars;
  }, [count]);
}

function getActiveChapter(chapters: Chapter[] | undefined, positionMs: number) {
  const list = chapters ?? [];
  if (list.length === 0) return undefined;

  let active = list[0];
  for (const c of list) {
    if (c.timestamp * 1000 <= positionMs) active = c;
  }
  return active;
}

export default function AudioPlayer({ guide, onClose }: AudioPlayerProps) {
  const [, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(Math.max(0, guide.duration * 1000));
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [audioError, setAudioError] = useState<string>("");
  const [showChapters, setShowChapters] = useState<boolean>(false);

  const fade = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const sheetFade = useRef(new Animated.Value(0)).current;
  const playScale = useRef(new Animated.Value(1)).current;

  const soundRef = useRef<Audio.Sound | null>(null);

  const speeds = useMemo(() => [0.75, 1, 1.25, 1.5], []);
  const bars = useWaveBars(44);

  const artworkUrl = useMemo(() => {
    if (guide.thumbnailUrl) return guide.thumbnailUrl;
    return buildUnsplashArtworkUrl(guide.title, guide.location || "");
  }, [guide.location, guide.thumbnailUrl, guide.title]);

  const subtitle = useMemo(() => {
    const loc = guide.location?.trim();
    const kind = guide.type === "landmark" ? "Landmark audio guide" : guide.type === "route" ? "Walking tour" : "Audio tour";
    return loc ? `${kind} • ${loc}` : kind;
  }, [guide.location, guide.type]);

  const onPlaybackStatusUpdate = useCallback(
    (status: any) => {
      if (status?.isLoaded) {
        setPosition(status.positionMillis ?? 0);
        setDuration(status.durationMillis ?? duration);
        setIsPlaying(!!status.isPlaying);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
        }
      }
    },
    [duration]
  );

  const configureAudioMode = useCallback(async () => {
    try {
      console.log("[AudioPlayer] Configuring audio mode...");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      return true;
    } catch (e) {
      console.error("[AudioPlayer] Failed to configure audio mode", e);
      return false;
    }
  }, []);

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(headerFade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(sheetFade, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();
  }, [fade, headerFade, sheetFade]);

  useEffect(() => {
    console.log("[AudioPlayer] mount", {
      title: guide.title,
      type: guide.type,
      audioUrlPrefix: guide.audioUrl?.slice(0, 18) ?? "",
    });

    let mounted = true;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    const initAudio = async () => {
      if (soundRef.current) {
        console.log("[AudioPlayer] Unloading previous sound");
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log("[AudioPlayer] unload error", e);
        }
        soundRef.current = null;
        setSound(null);
      }

      try {
        setLoadState("loading");
        setAudioError("");

        if (!guide.audioUrl || guide.audioUrl.length < 20) {
          throw new Error("Invalid audio URL. The audio data is missing or corrupted.");
        }

        await configureAudioMode();

        loadTimeout = setTimeout(() => {
          if (mounted) {
            console.error("[AudioPlayer] Audio load timeout");
            setLoadState("error");
            setAudioError("Audio loading timed out. The file may be too large.");
          }
        }, 45000);

        let audioSource: { uri: string };
        if (
          guide.audioUrl.startsWith("data:audio/") ||
          guide.audioUrl.startsWith("http://") ||
          guide.audioUrl.startsWith("https://") ||
          guide.audioUrl.startsWith("file://") ||
          guide.audioUrl.startsWith("blob:")
        ) {
          audioSource = { uri: guide.audioUrl };
        } else {
          throw new Error("Unsupported audio format. Please regenerate the tour.");
        }

        console.log("[AudioPlayer] Loading sound...");
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          audioSource,
          { shouldPlay: false, progressUpdateIntervalMillis: 350 },
          onPlaybackStatusUpdate
        );

        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }

        if (!mounted) {
          await newSound.unloadAsync();
          return;
        }

        if (!status.isLoaded) {
          console.error("[AudioPlayer] Sound not loaded", status);
          throw new Error("Audio failed to load. Please try again.");
        }

        soundRef.current = newSound;
        setSound(newSound);
        setDuration(status.durationMillis ?? duration);
        setLoadState("ready");
        console.log("[AudioPlayer] ready", { durationMs: status.durationMillis });
      } catch (e) {
        console.error("[AudioPlayer] initAudio error", e);
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        if (mounted) {
          setLoadState("error");
          setAudioError(getErrorMessage(e));
        }
      }
    };

    void initAudio();

    return () => {
      mounted = false;
      if (loadTimeout) clearTimeout(loadTimeout);
      if (soundRef.current) {
        console.log("[AudioPlayer] cleanup unload");
        soundRef.current.unloadAsync().catch((e) => console.log("[AudioPlayer] cleanup error", e));
        soundRef.current = null;
      }
    };
  }, [configureAudioMode, duration, guide.audioUrl, guide.title, guide.type, onPlaybackStatusUpdate]);

  const handleSeek = useCallback(
    async (newPosition: number) => {
      try {
        const s = soundRef.current;
        if (!s) return;
        const next = clamp(newPosition, 0, duration);
        await s.setPositionAsync(next);
        setPosition(next);
      } catch (e) {
        console.error("[AudioPlayer] seek error", e);
      }
    },
    [duration]
  );

  const handleSkipForward = useCallback(() => {
    void handleSeek(position + 15000);
  }, [handleSeek, position]);

  const handleSkipBackward = useCallback(() => {
    void handleSeek(position - 15000);
  }, [handleSeek, position]);

  const handleSpeedChange = useCallback(async () => {
    try {
      const currentIndex = speeds.indexOf(playbackSpeed);
      const nextIndex = (currentIndex + 1) % speeds.length;
      const newSpeed = speeds[nextIndex];
      setPlaybackSpeed(newSpeed);
      if (soundRef.current) {
        await soundRef.current.setRateAsync(newSpeed, true);
      }
    } catch (e) {
      console.error("[AudioPlayer] speed error", e);
    }
  }, [playbackSpeed, speeds]);

  const handlePlayPause = useCallback(async () => {
    try {
      const s = soundRef.current;
      console.log("[AudioPlayer] toggle", { hasSound: !!s, loadState, isPlaying });
      if (!s) {
        Alert.alert("Error", "Audio player not initialized. Please close and reopen.");
        return;
      }
      if (loadState !== "ready") {
        Alert.alert("Please wait", "Audio is still loading.");
        return;
      }

      const status = await s.getStatusAsync();
      if (!status.isLoaded) {
        Alert.alert("Error", "Audio is not ready. Please try again.");
        return;
      }

      if (status.isPlaying) {
        await s.pauseAsync();
        setIsPlaying(false);
        return;
      }

      await configureAudioMode();
      await s.playAsync();
      setIsPlaying(true);
    } catch (e) {
      console.error("[AudioPlayer] play/pause error", e);
      Alert.alert("Playback error", getErrorMessage(e));
    }
  }, [configureAudioMode, isPlaying, loadState]);

  const onPressInPlay = useCallback(() => {
    Animated.spring(playScale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 200,
      friction: 14,
    }).start();
  }, [playScale]);

  const onPressOutPlay = useCallback(() => {
    Animated.spring(playScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 14,
    }).start();
  }, [playScale]);

  const activeChapter = useMemo(() => getActiveChapter(guide.chapters, position), [guide.chapters, position]);
  const nowPlayingLabel = useMemo(() => {
    if (activeChapter?.title) return activeChapter.title;
    return guide.title;
  }, [activeChapter?.title, guide.title]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return clamp(position / duration, 0, 1);
  }, [duration, position]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]} testID="audioPlayerRoot">
      <View style={styles.bg} />

      <Animated.View style={[styles.header, { opacity: headerFade }]} testID="audioPlayerHeader">
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          activeOpacity={0.85}
          testID="audioPlayerClose"
        >
          <X size={20} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerKicker} numberOfLines={1} testID="audioPlayerHeaderKicker">
            Audio guide
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1} testID="audioPlayerHeaderTitle">
            {guide.title}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSpeedChange}
          style={styles.speedPill}
          activeOpacity={0.85}
          testID="audioPlayerSpeed"
        >
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="audioPlayerScroll"
      >
        <Animated.View style={[styles.card, { opacity: fade }]} testID="audioPlayerCard">
          <View style={styles.artworkWrap}>
            <Image source={{ uri: artworkUrl }} style={styles.artwork} resizeMode="cover" testID="audioPlayerArtwork" />
            <View style={styles.artworkOverlay} pointerEvents="none" />
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.title} numberOfLines={2} testID="audioPlayerTitle">
              {guide.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1} testID="audioPlayerSubtitle">
              {subtitle}
            </Text>

            {!!guide.description && (
              <Text style={styles.description} numberOfLines={4} testID="audioPlayerDescription">
                {guide.description}
              </Text>
            )}

            <View style={styles.metaRow} testID="audioPlayerMetaRow">
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{formatTime(duration)}</Text>
              </View>
              {!!guide.chapters?.length && (
                <TouchableOpacity
                  style={styles.metaPillSoft}
                  activeOpacity={0.85}
                  onPress={() => setShowChapters((v) => !v)}
                  testID="audioPlayerChaptersToggle"
                >
                  <Text style={styles.metaPillSoftText}>{guide.chapters.length} chapters</Text>
                  {showChapters ? (
                    <ChevronUp size={16} color={"rgba(15,20,25,0.62)"} />
                  ) : (
                    <ChevronDown size={16} color={"rgba(15,20,25,0.62)"} />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {loadState === "loading" ? (
              <View style={styles.stateRow} testID="audioPlayerStateLoading">
                <View style={styles.stateDot} />
                <Text style={styles.stateText}>Loading audio…</Text>
              </View>
            ) : null}

            {loadState === "error" ? (
              <View style={styles.errorRow} testID="audioPlayerStateError">
                <Text style={styles.errorTitle}>Couldn’t load audio</Text>
                <Text style={styles.errorText} numberOfLines={3}>
                  {audioError || "Please try again."}
                </Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  activeOpacity={0.9}
                  onPress={() => {
                    console.log("[AudioPlayer] user retry");
                    setShowChapters(false);
                    setPosition(0);
                    setDuration(Math.max(0, guide.duration * 1000));
                    setLoadState("loading");
                    setAudioError("");
                    Alert.alert(
                      "Retry",
                      "Close and reopen this player from Library to reload the audio."
                    );
                  }}
                  testID="audioPlayerRetry"
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.waveWrap} testID="audioPlayerWaveform">
              <View style={styles.waveRow}>
                {bars.map((h, idx) => {
                  const x = idx / Math.max(1, bars.length - 1);
                  const active = x <= progress;
                  return (
                    <View
                      key={`b-${idx}`}
                      style={[
                        styles.waveBar,
                        {
                          height: h,
                          opacity: active ? 1 : 0.38,
                          backgroundColor: active ? Colors.light.text : "rgba(15,20,25,0.22)",
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.timelineRow} testID="audioPlayerTimeline">
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            <View style={styles.sliderWrap}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(1, duration)}
                value={position}
                onSlidingComplete={(val: number) => {
                  void handleSeek(val);
                }}
                minimumTrackTintColor={Colors.light.text}
                maximumTrackTintColor={"rgba(15,20,25,0.14)"}
                thumbTintColor={Colors.light.text}
                disabled={loadState !== "ready"}
                testID="audioPlayerSlider"
              />
            </View>

            <Animated.View style={[styles.controlsRow, { opacity: sheetFade }]} testID="audioPlayerControls">
              <TouchableOpacity
                onPress={handleSkipBackward}
                style={styles.ctrlBtn}
                activeOpacity={0.85}
                disabled={loadState !== "ready"}
                testID="audioPlayerBack15"
              >
                <SkipBack size={22} color={Colors.light.text} />
                <Text style={styles.ctrlHint}>15</Text>
              </TouchableOpacity>

              <Animated.View style={{ transform: [{ scale: playScale }] }}>
                <TouchableOpacity
                  onPress={handlePlayPause}
                  onPressIn={onPressInPlay}
                  onPressOut={onPressOutPlay}
                  style={[styles.playBtn, loadState !== "ready" && styles.playBtnDisabled]}
                  activeOpacity={0.9}
                  disabled={loadState !== "ready"}
                  testID="audioPlayerPlay"
                >
                  {isPlaying ? (
                    <Pause size={26} color={"#FFFFFF"} fill={"#FFFFFF"} />
                  ) : (
                    <Play size={26} color={"#FFFFFF"} fill={"#FFFFFF"} />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                onPress={handleSkipForward}
                style={styles.ctrlBtn}
                activeOpacity={0.85}
                disabled={loadState !== "ready"}
                testID="audioPlayerForward15"
              >
                <SkipForward size={22} color={Colors.light.text} />
                <Text style={styles.ctrlHint}>15</Text>
              </TouchableOpacity>
            </Animated.View>

            {!!guide.chapters?.length && showChapters ? (
              <View style={styles.chaptersWrap} testID="audioPlayerChapters">
                {guide.chapters.map((c) => {
                  const isActive = activeChapter?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chapterRow, isActive && styles.chapterRowActive]}
                      activeOpacity={0.85}
                      onPress={() => {
                        console.log("[AudioPlayer] seek chapter", { id: c.id, ts: c.timestamp });
                        void handleSeek(c.timestamp * 1000);
                      }}
                      testID={`audioPlayerChapter_${c.id}`}
                    >
                      <Text style={[styles.chapterTitle, isActive && styles.chapterTitleActive]} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={[styles.chapterTime, isActive && styles.chapterTimeActive]}>
                        {formatTime(c.timestamp * 1000)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.nowPlayingRow} testID="audioPlayerNowPlaying">
              <Text style={styles.nowPlayingLabel} numberOfLines={1}>
                Now playing
              </Text>
              <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                {nowPlayingLabel}
              </Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F3F4F6",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerKicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(15,20,25,0.50)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "900",
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  speedPill: {
    minWidth: 54,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.light.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.10,
        shadowRadius: 22,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  artworkWrap: {
    position: "relative",
    height: 320,
    backgroundColor: "rgba(15,20,25,0.06)",
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    backgroundColor: "rgba(255,255,255,0.66)",
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: Colors.light.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(15,20,25,0.56)",
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "rgba(15,20,25,0.72)",
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,20,25,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.light.text,
  },
  metaPillSoft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
  },
  metaPillSoftText: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(15,20,25,0.74)",
  },
  stateRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
  },
  stateText: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(15,20,25,0.70)",
  },
  errorRow: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,59,48,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.18)",
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8A1F19",
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "rgba(138,31,25,0.92)",
  },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#0F1419",
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  waveWrap: {
    marginTop: 14,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 30,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  timelineRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(15,20,25,0.58)",
  },
  sliderWrap: {
    marginTop: 2,
  },
  slider: {
    width: "100%",
    height: 34,
  },
  controlsRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  ctrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.90)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
  },
  ctrlHint: {
    position: "absolute",
    bottom: 10,
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(15,20,25,0.72)",
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F1419",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
      },
      android: {
        elevation: 7,
      },
      default: {},
    }),
  },
  playBtnDisabled: {
    opacity: 0.55,
  },
  chaptersWrap: {
    marginTop: 14,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,20,25,0.08)",
  },
  chapterRowActive: {
    backgroundColor: "rgba(30,136,229,0.10)",
    borderTopColor: "rgba(30,136,229,0.16)",
  },
  chapterTitle: {
    flex: 1,
    marginRight: 10,
    fontSize: 13,
    fontWeight: "900",
    color: "rgba(15,20,25,0.78)",
  },
  chapterTitleActive: {
    color: Colors.light.primary,
  },
  chapterTime: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(15,20,25,0.52)",
  },
  chapterTimeActive: {
    color: Colors.light.primary,
  },
  nowPlayingRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,20,25,0.08)",
  },
  nowPlayingLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(15,20,25,0.48)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  nowPlayingTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "900",
    color: Colors.light.text,
  },
  bottomSpace: {
    height: 18,
  },
});
