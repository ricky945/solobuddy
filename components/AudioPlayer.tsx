import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Audio } from "expo-av";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
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

export default function AudioPlayer({
  guide,
  onClose,
}: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(guide.duration * 1000);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string>("");
  const [showChapters, setShowChapters] = useState<boolean>(false);
  
  const soundRef = useRef<Audio.Sound | null>(null);

  const speeds = [0.5, 1, 1.5, 2];

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || duration);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, [duration]);



  useEffect(() => {
    console.log("[AudioPlayer] Component mounted with guide:", guide.title);
    console.log("[AudioPlayer] Audio URL type:", guide.audioUrl.startsWith('data:') ? 'Data URL' : guide.audioUrl.startsWith('blob:') ? 'Blob URL' : guide.audioUrl.startsWith('file:') ? 'File URL' : 'HTTP URL');
    console.log("[AudioPlayer] Audio URL length:", guide.audioUrl.length);
    
    let mounted = true;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const initAudio = async () => {
      if (soundRef.current) {
        console.log("[AudioPlayer] Sound already loaded, cleaning up first");
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log("[AudioPlayer] Error unloading previous sound:", e);
        }
        soundRef.current = null;
        setSound(null);
        setAudioReady(false);
      }

      try {
        console.log("[AudioPlayer] Loading audio...");
        setAudioError("");
        setAudioReady(false);
        
        await configureAudioMode();
        
        console.log("[AudioPlayer] Creating sound object...");
        
        loadTimeout = setTimeout(() => {
          if (!soundRef.current && mounted) {
            console.error("[AudioPlayer] Audio load timeout after 45 seconds");
            setAudioError("Audio loading timed out. The file may be too large.");
            setAudioReady(false);
          }
        }, 45000);
        
        if (!guide.audioUrl || guide.audioUrl.length < 20) {
          throw new Error("Invalid audio URL. The audio data is missing or corrupted.");
        }
        
        let audioSource: { uri: string } | number;
        
        if (guide.audioUrl.startsWith('data:audio/')) {
          console.log("[AudioPlayer] Using data URL (Base64)");
          audioSource = { uri: guide.audioUrl };
        } else if (guide.audioUrl.startsWith('http://') || guide.audioUrl.startsWith('https://')) {
          console.log("[AudioPlayer] Using HTTP URL");
          audioSource = { uri: guide.audioUrl };
        } else if (guide.audioUrl.startsWith('file://')) {
          console.log("[AudioPlayer] Using file URL");
          audioSource = { uri: guide.audioUrl };
        } else if (guide.audioUrl.startsWith('blob:')) {
          console.log("[AudioPlayer] Using blob URL");
          audioSource = { uri: guide.audioUrl };
        } else {
          console.error("[AudioPlayer] Unsupported audio URL format:", guide.audioUrl.substring(0, 50));
          throw new Error("Unsupported audio format. Please regenerate the tour.");
        }
        
        console.log("[AudioPlayer] Starting audio load...");
        
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          audioSource,
          { 
            shouldPlay: false, 
            progressUpdateIntervalMillis: 500,
            ...(Platform.OS === 'android' && { androidImplementation: 'SimpleExoPlayer' })
          },
          onPlaybackStatusUpdate
        );
        
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        
        console.log("[AudioPlayer] Audio creation completed");
        
        if (!mounted) {
          console.log("[AudioPlayer] Component unmounted, cleaning up");
          await newSound.unloadAsync();
          return;
        }
        
        if (!status.isLoaded) {
          console.error("[AudioPlayer] Audio is not loaded after creation");
          console.error("[AudioPlayer] Status:", JSON.stringify(status, null, 2));
          throw new Error("Audio failed to load. Please try regenerating the tour.");
        }
        
        const actualDuration = status.durationMillis || duration;
        console.log("[AudioPlayer] Audio loaded successfully! Duration:", actualDuration, "ms");
        
        soundRef.current = newSound;
        setSound(newSound);
        setDuration(actualDuration);
        setAudioReady(true);
        
        await updateNowPlaying(newSound);
        
        console.log("[AudioPlayer] Audio ready to play!");
      } catch (error: any) {
        console.error("[AudioPlayer] Error loading audio:", error);
        console.error("[AudioPlayer] Error message:", error.message);
        if (error.stack) {
          console.error("[AudioPlayer] Error stack:", error.stack);
        }
        if (loadTimeout) {
          clearTimeout(loadTimeout);
          loadTimeout = null;
        }
        if (mounted) {
          setAudioReady(false);
          let errorMsg = "Failed to load audio. ";
          if (error.message?.includes("404") || error.message?.includes("not found")) {
            errorMsg += "Audio file not found.";
          } else if (error.message?.includes("timeout")) {
            errorMsg += "Loading timed out.";
          } else if (error.message?.includes("format") || error.message?.includes("unsupported")) {
            errorMsg += "Unsupported format.";
          } else {
            errorMsg += error.message || "Unknown error.";
          }
          setAudioError(errorMsg);
        }
      }
    };
    
    initAudio();
    
    return () => {
      mounted = false;
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
      if (soundRef.current) {
        console.log("[AudioPlayer] Cleaning up sound on unmount");
        soundRef.current.unloadAsync().catch(e => console.log("[AudioPlayer] Cleanup error:", e));
        soundRef.current = null;
      }
    };
  }, [guide.audioUrl, guide.title, duration, onPlaybackStatusUpdate]);



  const configureAudioMode = async () => {
    try {
      console.log("[AudioPlayer] Configuring audio mode...");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 2,
        interruptionModeAndroid: 2,
      });
      console.log("[AudioPlayer] Audio mode configured");
    } catch (error) {
      console.error("[AudioPlayer] Error configuring audio mode:", error);
    }
  };

  const updateNowPlaying = async (sound: Audio.Sound) => {
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        console.log("[AudioPlayer] Sound not loaded, skipping now playing update");
        return;
      }
      
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await sound.setStatusAsync({
          progressUpdateIntervalMillis: 500,
        });
      }
      console.log("[AudioPlayer] Now playing metadata updated");
    } catch (error) {
      console.error("[AudioPlayer] Error updating now playing:", error);
    }
  };

  useEffect(() => {
    if (sound && audioReady) {
      console.log("[AudioPlayer] Setting up lock screen controls");
      updateNowPlaying(sound);
    }
  }, [sound, audioReady, guide.title, guide.location]);

  const handlePlayPause = async () => {
    try {
      console.log("[AudioPlayer] handlePlayPause called");
      console.log("[AudioPlayer] sound:", !!sound, "audioReady:", audioReady, "isPlaying:", isPlaying);
      
      if (!sound) {
        console.log("[AudioPlayer] Sound object is null");
        Alert.alert("Error", "Audio player not initialized. Please close and reopen.");
        return;
      }
      
      if (!audioReady) {
        console.log("[AudioPlayer] Audio not ready yet");
        Alert.alert("Please Wait", "Audio is still loading. This may take a moment for large files.");
        return;
      }

      const status = await sound.getStatusAsync();
      console.log("[AudioPlayer] Current status - isLoaded:", status.isLoaded, "isPlaying:", status.isLoaded && status.isPlaying);
      
      if (!status.isLoaded) {
        console.log("[AudioPlayer] Sound not loaded");
        Alert.alert("Error", "Audio is not ready. Please try closing and reopening the player.");
        return;
      }

      if (isPlaying) {
        console.log("[AudioPlayer] Pausing audio");
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        console.log("[AudioPlayer] Playing audio from position:", status.positionMillis);
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error: any) {
      console.error("[AudioPlayer] Error during play/pause:", error);
      console.error("[AudioPlayer] Error message:", error.message);
      if (error.stack) {
        console.error("[AudioPlayer] Error stack:", error.stack);
      }
      Alert.alert(
        "Playback Error", 
        "Failed to " + (isPlaying ? "pause" : "play") + " audio. " + (error.message || "Unknown error")
      );
    }
  };

  const handleSeek = async (newPosition: number) => {
    if (sound) {
      await sound.setPositionAsync(newPosition);
    }
    setPosition(newPosition);
  };

  const handleSkipForward = () => {
    const newPosition = Math.min(position + 15000, duration);
    handleSeek(newPosition);
  };

  const handleSkipBackward = () => {
    const newPosition = Math.max(position - 15000, 0);
    handleSeek(newPosition);
  };

  const handleSpeedChange = async () => {
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);

    if (sound) {
      await sound.setRateAsync(newSpeed, true);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.6}
          >
            <ChevronDown size={32} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.artwork}>
          <View style={styles.artworkPlaceholder}>
            <Volume2 size={64} color={Colors.light.primary} />
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {guide.title}
          </Text>
          <Text style={styles.location} numberOfLines={1}>
            {guide.location}
          </Text>
          {!audioReady && !audioError ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>Loading audio...</Text>
            </View>
          ) : null}
          {audioError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {audioError}</Text>
              <Text style={styles.errorHint}>The audio file may not be available yet</Text>
            </View>
          ) : null}
          {audioReady ? (
            <View style={styles.readyContainer}>
              <Text style={styles.readyText}>Ready to play</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.sliderWrapper}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={handleSeek}
              minimumTrackTintColor={Colors.light.primary}
              maximumTrackTintColor={Colors.light.border}
              thumbTintColor={Colors.light.primary}
              disabled={!audioReady}
            />
            {guide.chapters && guide.chapters.length > 1 && (
              <View style={styles.chapterMarkers}>
                {guide.chapters.slice(1).map((chapter) => {
                  const percentage = (chapter.timestamp * 1000 / duration) * 100;
                  return (
                    <View
                      key={chapter.id}
                      style={[
                        styles.chapterMarker,
                        { left: `${percentage}%` },
                      ]}
                    />
                  );
                })}
              </View>
            )}
          </View>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {guide.chapters && guide.chapters.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.currentChapter}
              activeOpacity={0.7}
              onPress={() => setShowChapters(!showChapters)}
            >
              <View style={styles.chapterInfo}>
                <Text style={styles.chapterLabel}>Now Playing</Text>
                <Text style={styles.chapterTitle} numberOfLines={1}>
                  {guide.chapters.find((c) => c.timestamp * 1000 <= position)?.title ||
                    guide.chapters[0].title}
                </Text>
              </View>
              {showChapters ? (
                <ChevronDown size={20} color={Colors.light.textSecondary} />
              ) : (
                <ChevronUp size={20} color={Colors.light.textSecondary} />
              )}
            </TouchableOpacity>

            {showChapters && (
              <ScrollView
                style={styles.chaptersScroll}
                contentContainerStyle={styles.chaptersContainer}
                showsVerticalScrollIndicator={true}
              >
                {guide.chapters.map((chapter, index) => {
                  const isActive = guide.chapters?.find((c) => c.timestamp * 1000 <= position)?.id === chapter.id;
                  const isCompleted = chapter.timestamp * 1000 < position;
                  
                  return (
                    <TouchableOpacity
                      key={chapter.id}
                      style={[
                        styles.chapterItem,
                        isActive && styles.chapterItemActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSeek(chapter.timestamp * 1000)}
                    >
                      <View style={styles.chapterNumber}>
                        <Text style={[
                          styles.chapterNumberText,
                          isActive && styles.chapterNumberTextActive,
                        ]}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.chapterContent}>
                        <Text style={[
                          styles.chapterItemTitle,
                          isActive && styles.chapterItemTitleActive,
                        ]} numberOfLines={2}>
                          {chapter.title}
                        </Text>
                        <Text style={styles.chapterTime}>
                          {formatTime(chapter.timestamp * 1000)} • {Math.floor(chapter.duration / 60)} min
                        </Text>
                      </View>
                      {isCompleted && !isActive && (
                        <View style={styles.completedIndicator} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}

        <View style={styles.controls}>
          <TouchableOpacity
            onPress={handleSpeedChange}
            style={styles.speedButton}
            activeOpacity={0.7}
          >
            <Text style={styles.speedText}>{playbackSpeed}x</Text>
          </TouchableOpacity>

          <View style={styles.mainControls}>
            <TouchableOpacity
              onPress={handleSkipBackward}
              style={styles.controlButton}
              activeOpacity={0.7}
            >
              <SkipBack size={32} color={Colors.light.text} />
              <Text style={styles.skipText}>15</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePlayPause}
              style={[styles.playButton, !audioReady && styles.playButtonDisabled]}
              activeOpacity={0.8}
              disabled={!audioReady}
            >
              {isPlaying ? (
                <Pause size={40} color={Colors.light.background} fill={Colors.light.background} />
              ) : (
                <Play size={40} color={Colors.light.background} fill={Colors.light.background} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSkipForward}
              style={styles.controlButton}
              activeOpacity={0.7}
            >
              <SkipForward size={32} color={Colors.light.text} />
              <Text style={styles.skipText}>15</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.speedButtonPlaceholder} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingVertical: 8,
    paddingBottom: 4,
    width: "100%",
    alignSelf: "stretch",
  },
  closeButton: {
    padding: 8,
  },
  chaptersButton: {
    padding: 4,
  },
  artwork: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 280,
    marginBottom: 20,
    alignSelf: "center",
    paddingHorizontal: 0,
  },
  artworkPlaceholder: {
    width: "90%",
    height: "90%",
    aspectRatio: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  info: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 8,
  },
  location: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  progressContainer: {
    paddingVertical: 8,
    marginTop: 20,
    width: "100%",
    alignSelf: "center",
  },
  sliderWrapper: {
    position: "relative",
    width: "100%",
    height: 40,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  chapterMarkers: {
    position: "absolute",
    top: 18,
    left: 0,
    right: 0,
    height: 4,
    pointerEvents: "none",
  },
  chapterMarker: {
    position: "absolute",
    width: 2,
    height: 10,
    backgroundColor: Colors.light.text,
    opacity: 0.4,
    marginLeft: -1,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  currentChapter: {
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    alignSelf: "center",
    marginVertical: 12,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
  },
  chaptersScroll: {
    maxHeight: 280,
    width: "100%",
    marginBottom: 12,
  },
  chaptersContainer: {
    gap: 8,
    paddingBottom: 8,
  },
  chapterItem: {
    backgroundColor: Colors.light.card,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  chapterItemActive: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderColor: Colors.light.primary,
  },
  chapterNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  chapterNumberTextActive: {
    color: Colors.light.primary,
  },
  chapterContent: {
    flex: 1,
    gap: 4,
  },
  chapterItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  chapterItemTitleActive: {
    color: Colors.light.primary,
  },
  chapterTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  completedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    marginTop: 20,
    width: "100%",
    alignSelf: "center",
  },
  speedButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
  },
  speedButtonPlaceholder: {
    width: 56,
  },
  statusContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  errorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fee",
    borderRadius: 8,
    gap: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#c33",
    textAlign: "center",
    fontWeight: "600",
  },
  errorHint: {
    fontSize: 12,
    color: "#c33",
    textAlign: "center",
  },
  readyContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#efe",
    borderRadius: 8,
  },
  readyText: {
    fontSize: 13,
    color: "#2a2",
    textAlign: "center",
    fontWeight: "600",
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    alignSelf: "center",
  },
  controlButton: {
    position: "relative",
    padding: 8,
  },
  skipText: {
    position: "absolute",
    fontSize: 10,
    fontWeight: "700",
    color: Colors.light.text,
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
});
