import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Audio } from "expo-av";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  ChevronUp,
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
  const [sound, setSound] = useState<Audio.Sound | null>(null);
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
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: guide.audioUrl },
          { shouldPlay: true },
          (status: any) => {
            if (status.isLoaded) {
              setPosition(status.positionMillis);
              setDuration(status.durationMillis || guide.duration * 1000);
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );

        setSound(newSound);
        setLoadState("ready");
        setIsPlaying(true);
      } catch (error) {
        console.error("Audio load error:", error);
        setLoadState("error");
      }
    };

    setupAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (sound) {
      await sound.setPositionAsync(value);
      setPosition(value);
    }
  };

  const skipForward = async () => {
    if (sound) {
      const newPos = Math.min(duration, position + 15000);
      await sound.setPositionAsync(newPos);
    }
  };

  const skipBackward = async () => {
    if (sound) {
      const newPos = Math.max(0, position - 15000);
      await sound.setPositionAsync(newPos);
    }
  };

  const changeSpeed = async () => {
    if (sound) {
      const newSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
      await sound.setRateAsync(newSpeed, true);
      setPlaybackSpeed(newSpeed);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Animated.View 
        style={[
          styles.content, 
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <ChevronDown size={28} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <View style={{ width: 40 }} /> 
        </View>

        <View style={styles.artworkContainer}>
          <Image 
            source={{ uri: artworkUrl }} 
            style={styles.artwork} 
            resizeMode="cover" 
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>{guide.title}</Text>
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
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity onPress={changeSpeed} style={styles.speedButton}>
            <Text style={styles.speedText}>{playbackSpeed}x</Text>
          </TouchableOpacity>

          <View style={styles.mainControls}>
            <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
              <SkipBack size={28} color={Colors.light.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={togglePlayPause} 
              style={styles.playButton}
              activeOpacity={0.8}
            >
              {loadState === "loading" ? (
                <ActivityIndicator color="#fff" />
              ) : isPlaying ? (
                <Pause size={32} color="#fff" fill="#fff" />
              ) : (
                <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
              <SkipForward size={28} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <View style={{ width: 40 }} /> 
        </View>

        {guide.chapters && guide.chapters.length > 0 && (
          <TouchableOpacity 
            style={styles.chaptersButton}
            onPress={() => setShowChapters(!showChapters)}
          >
            <Text style={styles.chaptersText}>Chapters</Text>
            {showChapters ? (
              <ChevronDown size={20} color={Colors.light.primary} />
            ) : (
              <ChevronUp size={20} color={Colors.light.primary} />
            )}
          </TouchableOpacity>
        )}

        {showChapters && guide.chapters && (
          <View style={styles.chaptersList}>
            {guide.chapters.map((chapter, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.chapterItem}
                onPress={() => handleSeek(chapter.timestamp * 1000)}
              >
                <Text style={styles.chapterTitle} numberOfLines={1}>{chapter.title}</Text>
                <Text style={styles.chapterTime}>{formatTime(chapter.timestamp * 1000)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    marginBottom: 20,
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
  chaptersList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flex: 1,
  },
  chapterItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  chapterTitle: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "500",
    flex: 1,
    marginRight: 16,
  },
  chapterTime: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontVariant: ["tabular-nums"],
  },
});
