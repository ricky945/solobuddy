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
  Platform,
  AppState,
} from "react-native";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { File, Paths } from "expo-file-system";
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
import type { AudioGuide, AudioSegment } from "@/types";
import { configureAudioForLockScreen, enableNowPlayingControls } from "@/lib/audio-config";

interface AudioPlayerProps {
  guide: AudioGuide;
  onClose: () => void;
}

type LoadState = "loading" | "ready" | "error";

type CachedAudioResult =
  | { uri: string; fromCache: boolean; local: boolean }
  | { uri: string; fromCache: false; local: false };

function formatTime(milliseconds: number | null | undefined) {
  const ms = typeof milliseconds === "number" ? milliseconds : NaN;
  if (!Number.isFinite(ms) || ms < 0) return "--:--";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildUnsplashArtworkUrl(title: string, location: string) {
  const q = encodeURIComponent(`${title} ${location} city landmark`);
  return `https://source.unsplash.com/1200x1200/?${q}`;
}

function hashStringToId(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

async function resolvePlayableAudioUri(audioUrl: string): Promise<CachedAudioResult> {
  if (!audioUrl) {
    return { uri: audioUrl, fromCache: false, local: false };
  }

  if (Platform.OS === "web") {
    return { uri: audioUrl, fromCache: false, local: false };
  }

  const isRemote = /^https?:\/\//i.test(audioUrl);
  if (!isRemote) {
    return { uri: audioUrl, fromCache: true, local: true };
  }

  try {
    const fileName = `audio_${hashStringToId(audioUrl)}.mp3`;
    const file = new File(Paths.cache, `audio-guides/${fileName}`);

    try {
      const exists = await (file as any).exists?.();
      if (exists) {
        return { uri: file.uri, fromCache: true, local: true };
      }
    } catch {
    }

    try {
      await file.create({ overwrite: true });
    } catch {
      try {
        const dir = new File(Paths.cache, "audio-guides");
        await dir.create({ intermediates: true });
        await file.create({ overwrite: true });
      } catch (e) {
        console.log("[AudioPlayer] cache directory create failed", e);
      }
    }

    console.log("[AudioPlayer] Downloading audio to cache for reliable playback", {
      audioUrl,
      uri: file.uri,
    });

    const resp = await fetch(audioUrl);
    if (!resp.ok) {
      throw new Error(`Download failed: ${resp.status}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    await (file as any).write(bytes);

    return { uri: file.uri, fromCache: false, local: true };
  } catch (e) {
    console.log("[AudioPlayer] cache download failed; falling back to remote streaming", e);
    return { uri: audioUrl, fromCache: false, local: false };
  }
}

function getGlobalDurationMs(guide: AudioGuide): number {
  if (typeof guide.duration === "number" && Number.isFinite(guide.duration) && guide.duration > 0) {
    return Math.floor(guide.duration * 1000);
  }
  return 60_000;
}

function buildSegments(guide: AudioGuide): AudioSegment[] {
  const segs = guide.audioSegments;
  if (Array.isArray(segs) && segs.length > 0) {
    const cleaned = segs
      .filter((s) => !!s?.uri && typeof s.startTime === "number" && typeof s.duration === "number")
      .map((s) => ({ uri: String(s.uri), startTime: s.startTime, duration: s.duration }))
      .sort((a, b) => a.startTime - b.startTime);

    if (cleaned.length > 0) return cleaned;
  }

  return [{ uri: guide.audioUrl, startTime: 0, duration: Math.max(1, Math.round(guide.duration ?? 60)) }];
}

function hasMultipleSegments(guide: AudioGuide): boolean {
  const segs = guide.audioSegments;
  return Array.isArray(segs) && segs.length > 1 && segs.some((s) => !!s?.uri);
}

export default function AudioPlayer({ guide, onClose }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const segmentIndexRef = useRef<number>(0);
  const actualDurationRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration] = useState<number>(() => getGlobalDurationMs(guide));
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [showChapters, setShowChapters] = useState<boolean>(false);
  const [segmentIndex, setSegmentIndex] = useState<number>(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const segments = useMemo<AudioSegment[]>(() => buildSegments(guide), [guide]);
  const useSegmentMode = useMemo<boolean>(() => hasMultipleSegments(guide), [guide]);

  useEffect(() => {
    const dur = getGlobalDurationMs(guide);
    actualDurationRef.current = dur;
  }, [guide]);

  // Maintain audio mode when screen locks or app backgrounds
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        await configureAudioForLockScreen().catch(e => {
          console.error("[AudioPlayer] Error maintaining audio mode", e);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

  const getSegmentIndexForGlobalMs = useCallback(
    (globalMs: number) => {
      const t = Math.max(0, Math.floor(globalMs / 1000));
      for (let i = segments.length - 1; i >= 0; i--) {
        if (t >= segments[i].startTime) return i;
      }
      return 0;
    },
    [segments]
  );

  const getSegmentLocalMs = useCallback(
    (segIdx: number, globalMs: number) => {
      const seg = segments[segIdx];
      if (!seg) return globalMs;
      const local = globalMs - seg.startTime * 1000;
      return Math.max(0, local);
    },
    [segments]
  );

  const loadSegment = useCallback(
    async (nextIndex: number, opts?: { shouldPlay?: boolean; globalPositionMs?: number }) => {
      const prev = soundRef.current;
      soundRef.current = null;

      if (prev) {
        try {
          await prev.stopAsync();
        } catch (e) {
          console.log("[AudioPlayer] stopAsync cleanup error", e);
        }
        try {
          await prev.unloadAsync();
        } catch (e) {
          console.log("[AudioPlayer] unloadAsync cleanup error", e);
        }

      }

      const seg = segments[nextIndex];
      if (!seg?.uri) {
        console.log("[AudioPlayer] Missing segment", { nextIndex, segments: segments.length });
        setLoadState("error");
        return;
      }

      setLoadState("loading");
      setSegmentIndex(nextIndex);
      segmentIndexRef.current = nextIndex;

      const desiredGlobalMs = opts?.globalPositionMs ?? seg.startTime * 1000;
      const localMs = getSegmentLocalMs(nextIndex, desiredGlobalMs);

      console.log("[AudioPlayer] Loading segment", {
        nextIndex,
        uri: seg.uri,
        localMs,
        desiredGlobalMs,
      });

      // Ensure audio mode is set before creating sound for lock screen support
      await configureAudioForLockScreen();

      const resolved = await resolvePlayableAudioUri(seg.uri);
      if (!isMountedRef.current) return;


      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: resolved.uri },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 100,
          isLooping: false,
          positionMillis: Math.max(0, Math.floor(localMs)),
          // Enable seeking on Android with MediaPlayer
          ...(Platform.OS === 'android' && { androidImplementation: 'MediaPlayer' as any }),
        },
        (status: any) => {
          if (!isMountedRef.current) return;

          if (status?.isLoaded) {
            const localPos = typeof status.positionMillis === "number" ? status.positionMillis : 0;
            const segIdx = segmentIndexRef.current;
            const segNow = segments[segIdx];
            const globalPos = (segNow?.startTime ?? 0) * 1000 + localPos;

            // Only update position if not actively scrubbing
            if (!isSeeking.current) {
              setPosition(globalPos);
            }
            setIsPlaying(!!status.isPlaying);

            if (status.didJustFinish) {
              const next = segIdx + 1;
              if (next < segments.length) {
                console.log("[AudioPlayer] Segment finished, advancing", { segIdx, next });
                void loadSegment(next, { shouldPlay: true, globalPositionMs: segments[next].startTime * 1000 });
              } else {
                console.log("[AudioPlayer] Playback finished");
                setIsPlaying(false);
              }
            }
          } else if (status?.error) {
            console.log("[AudioPlayer] Playback status error", status.error);
          }
        }
      );

      soundRef.current = newSound;

      try {
        await newSound.setRateAsync(playbackSpeed, true);
      } catch (e) {
        console.log("[AudioPlayer] setRateAsync error", e);
      }

      // Enable remote controls and Now Playing info for lock screen
      await enableNowPlayingControls(newSound);

      setLoadState("ready");

      if (opts?.shouldPlay) {
        try {
          await newSound.playAsync();
          setIsPlaying(true);
        } catch (e) {
          console.error("[AudioPlayer] playAsync after loadSegment error", e);
        }
      }
    },
    [getSegmentLocalMs, playbackSpeed, segments]
  );

  useEffect(() => {
    isMountedRef.current = true;

    const setupAudio = async () => {
      try {
        setLoadState("loading");
        await configureAudioForLockScreen();
        await loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
      } catch (error) {
        console.error("[AudioPlayer] Audio load error:", error);
        setLoadState("error");
      }
    };

    void setupAudio();

    return () => {
      isMountedRef.current = false;
      // Cleanup timeouts
      if (seekTimeoutRef.current) {
        clearTimeout(seekTimeoutRef.current);
        seekTimeoutRef.current = null;
      }
      const s = soundRef.current;
      soundRef.current = null;
      if (s) {
        s.getStatusAsync()
          .then((st) => {
            if (st.isLoaded && st.isPlaying) {
              return s.pauseAsync().catch(() => {});
            }
          })
          .catch(() => {})
          .finally(() => {
            s.unloadAsync().catch(() => {});
          });
      }
    };
  }, [loadSegment]);

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
    setIsPlaying(false);
    setPosition(0);
    setSegmentIndex(0);
    segmentIndexRef.current = 0;

    try {
      await loadSegment(0, { shouldPlay: false, globalPositionMs: 0 });
    } catch (e) {
      console.error("[AudioPlayer] stopPlayback error", e);
    }
  }, [loadSegment]);

  const handleClose = useCallback(() => {
    void stopPlayback();
    onClose();
  }, [onClose, stopPlayback]);

  const isSeeking = useRef(false);
  const seekTimeoutRef = useRef<number | null>(null);

  const handleSeek = useCallback(
    async (value: number) => {
      try {
        const targetIdx = getSegmentIndexForGlobalMs(value);
        const targetSegment = segments[targetIdx];
        
        if (!targetSegment) {
          isSeeking.current = false;
          return;
        }

        const localMs = getSegmentLocalMs(targetIdx, value);
        
        // If we need to switch segments, load the new segment
        if (targetIdx !== segmentIndexRef.current) {
          const wasPlaying = isPlaying;
          await loadSegment(targetIdx, { shouldPlay: wasPlaying, globalPositionMs: value });
        } else {
          // Same segment, just seek within it
          const s = soundRef.current;
          if (s) {
            try {
              await s.setPositionAsync(Math.floor(localMs));
            } catch (seekErr: any) {
              // Ignore "Seeking interrupted" errors - expected during rapid scrubbing
              if (!seekErr?.message?.includes('interrupted')) {
                throw seekErr;
              }
            }
          }
        }
        
        setPosition(value);
        setTimeout(() => {
          isSeeking.current = false;
        }, 50);
      } catch (err: any) {
        // Ignore "Seeking interrupted" errors
        if (!err?.message?.includes('interrupted')) {
          console.error("[AudioPlayer] Seek error:", err);
        }
        isSeeking.current = false;
      }
    },
    [getSegmentIndexForGlobalMs, getSegmentLocalMs, isPlaying, loadSegment, segments]
  );

  const handleSeekAndPlay = useCallback(
    async (value: number) => {
      const targetIdx = getSegmentIndexForGlobalMs(value);
      await loadSegment(targetIdx, { shouldPlay: true, globalPositionMs: value });
      setPosition(value);
      setIsPlaying(true);
    },
    [getSegmentIndexForGlobalMs, loadSegment]
  );

  const skipForward = useCallback(async () => {
    try {
      const dur = duration ?? position + 15000;
      const newPos = Math.min(dur, position + 15000);
      await handleSeekAndPlay(newPos);
    } catch (e) {
      console.error("[AudioPlayer] skipForward error", e);
    }
  }, [duration, handleSeekAndPlay, position]);

  const skipBackward = useCallback(async () => {
    try {
      const newPos = Math.max(0, position - 15000);
      await handleSeekAndPlay(newPos);
    } catch (e) {
      console.error("[AudioPlayer] skipBackward error", e);
    }
  }, [handleSeekAndPlay, position]);

  const changeSpeed = useCallback(async () => {
    const s = soundRef.current;
    try {
      const newSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
      setPlaybackSpeed(newSpeed);
      if (s) {
        await s.setRateAsync(newSpeed, true);
      }
    } catch (e) {
      console.error("[AudioPlayer] changeSpeed error", e);
    }
  }, [playbackSpeed]);

  const chapterItems = guide.chapters ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
                maximumValue={Math.max(1, duration ?? 1)}
                value={Math.max(0, Math.min(position || 0, duration ?? 1))}
                onSlidingStart={() => {
                  isSeeking.current = true;
                  if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = null;
                  }
                }}
                onValueChange={(value) => {
                  if (isSeeking.current) {
                    setPosition(value);
                  }
                }}
                onSlidingComplete={(value) => {
                  // Debounce to prevent rapid consecutive seeks
                  if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                  }
                  seekTimeoutRef.current = setTimeout(() => {
                    handleSeek(value);
                  }, 50);
                }}
              minimumTrackTintColor={Colors.light.primary}
              maximumTrackTintColor="#E2E8F0"
              thumbTintColor={Colors.light.primary}
              step={100}
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

          {chapterItems.length > 0 && (
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

          {showChapters && chapterItems.length > 0 && (
            <View style={styles.chaptersCard} testID="audioPlayerChapters">
              <ScrollView
                style={styles.chaptersList}
                contentContainerStyle={styles.chaptersListContent}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {chapterItems.map((chapter, index) => {
                  const nextChapter = chapterItems[index + 1];
                  const totalDurationSeconds = Math.floor(duration / 1000);

                  let chapterDurationSeconds = 0;

                  if (typeof chapter.duration === "number" && chapter.duration > 0) {
                    chapterDurationSeconds = chapter.duration;
                  } else if (nextChapter && typeof nextChapter.timestamp === "number") {
                    chapterDurationSeconds = Math.max(0, nextChapter.timestamp - chapter.timestamp);
                  } else if (totalDurationSeconds > chapter.timestamp) {
                    chapterDurationSeconds = Math.max(0, totalDurationSeconds - chapter.timestamp);
                  } else {
                    chapterDurationSeconds = 0;
                  }

                  const chapterDurationMs = chapterDurationSeconds * 1000;
                  const isValidDuration = Number.isFinite(chapterDurationMs) && chapterDurationMs > 0;

                  return (
                    <TouchableOpacity
                      key={`${chapter.title}-${chapter.timestamp}-${index}`}
                      style={styles.chapterItem}
                      onPress={() => handleSeekAndPlay(chapter.timestamp * 1000)}
                      activeOpacity={0.85}
                      testID={`audioPlayerChapter-${index}`}
                    >
                      <View style={styles.chapterTextBlock}>
                        <Text style={styles.chapterTitle} numberOfLines={1}>
                          {chapter.title}
                        </Text>
                        <Text style={styles.chapterSub}>Start {formatTime(chapter.timestamp * 1000)}</Text>
                      </View>
                      <Text style={styles.chapterTime}>{isValidDuration ? formatTime(chapterDurationMs) : "--:--"}</Text>
                    </TouchableOpacity>
                  );
                })}
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
  segmentHintRow: {
    marginTop: 10,
    alignItems: "center",
  },
  segmentHintText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "600",
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
  chapterTextBlock: {
    flex: 1,
    marginRight: 16,
  },
  chapterTitle: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "700",
  },
  chapterSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "600",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  chapterTime: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  bottomSpacer: {
    height: 18,
  },
});
