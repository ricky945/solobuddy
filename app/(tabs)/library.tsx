import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  Animated,
  Alert,
  PanResponder,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Download, Play, Clock, MapPin, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { AudioGuide } from "@/types";
import { useTours } from "@/contexts/ToursContext";
import AudioPlayer from "@/components/AudioPlayer";
import FeatureGuard from "@/components/FeatureGuard";

interface SwipeableCardProps {
  guide: AudioGuide;
  onPress: () => void;
  onDelete: () => void;
  formatDuration: (seconds: number) => string;
}

function SwipeableCard({ guide, onPress, onDelete, formatDuration }: SwipeableCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [isSwipedOpen, setIsSwipedOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const clampX = (x: number) => Math.max(Math.min(x, 0), -80);

  const snapTo = (toValue: number, nextOpen: boolean) => {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start(() => {
      setIsSwipedOpen(nextOpen);
    });
  };

  const resetSwipe = () => snapTo(0, false);
  const openSwipe = () => snapTo(-80, true);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const dx = Math.abs(gestureState.dx);
        const dy = Math.abs(gestureState.dy);
        return dx > 6 && dx > dy * 1.25;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const dx = Math.abs(gestureState.dx);
        const dy = Math.abs(gestureState.dy);
        return dx > 6 && dx > dy * 1.25;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const next = isSwipedOpen ? clampX(-80 + gestureState.dx) : clampX(gestureState.dx);
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = isSwipedOpen ? !(gestureState.dx > 40) : gestureState.dx < -60;

        if (shouldOpen) {
          openSwipe();
        } else {
          resetSwipe();
        }
      },
      onPanResponderTerminate: () => {
        translateX.stopAnimation((value) => {
          if (value <= -40) {
            openSwipe();
          } else {
            resetSwipe();
          }
        });
      },
    })
  ).current;

  const handleDelete = () => {
    Alert.alert(
      "Delete Tour",
      `Are you sure you want to delete "${guide.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsDeleting(true);
            // Animate both slide and fade out
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: -500,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Give a tiny delay to ensure animation completes and component unmounts
              setTimeout(() => {
                onDelete();
              }, 50);
            });
          },
        },
      ]
    );
  };

  return (
    <Animated.View 
      style={[
        styles.swipeableContainer, 
        { opacity }
      ]} 
      testID={`library-card-${guide.id}`}
    >
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID={`library-card-${guide.id}-delete`}
          disabled={isDeleting}
        >
          <Trash2 size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[
          styles.swipeableContent,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.95}
          onPress={() => {
            if (isSwipedOpen) {
              resetSwipe();
            } else {
              onPress();
            }
          }}
        >
          <View style={styles.cardContent}>
            <View style={styles.imageContainer}>
              {guide.thumbnailUrl ? (
                <Image
                  source={{ uri: guide.thumbnailUrl }}
                  style={styles.thumbnail}
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <MapPin size={48} color="#C7C7CC" />
                </View>
              )}
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {guide.type === "route" ? "ROUTE" : "IMMERSIVE"}
                </Text>
              </View>
              {guide.isDownloaded && (
                <View style={styles.downloadedBadge}>
                  <Download size={14} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.cardDetails}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {guide.title}
                </Text>
                <View style={styles.playButton}>
                  <Play
                    size={16}
                    color="#FFFFFF"
                    fill="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.locationRow}>
                <MapPin size={15} color="#8E8E93" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {guide.location || "Unknown location"}
                </Text>
              </View>

              <Text style={styles.description} numberOfLines={2}>
                {guide.description}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={13} color="#8E8E93" />
                  <Text style={styles.metaText}>
                    {formatDuration(guide.duration)}
                  </Text>
                </View>
                <View style={styles.metaDividerContainer}>
                  <Text style={styles.metaDivider}>•</Text>
                </View>
                <Text style={styles.metaText}>
                  {guide.chapters?.length || 0} chapters
                </Text>
                {guide.type === "route" && guide.landmarks && guide.landmarks.length > 0 && (
                  <>
                    <View style={styles.metaDividerContainer}>
                      <Text style={styles.metaDivider}>•</Text>
                    </View>
                    <Text style={styles.metaText}>
                      {guide.landmarks.length} stops
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const { tours: guides, removeTour } = useTours();
  const [selectedGuide, setSelectedGuide] = useState<AudioGuide | null>(null);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <FeatureGuard featureName="Library">
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          <ScrollView
            style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Library</Text>
            <Text style={styles.headerSubtitle}>
              {guides.length} {guides.length === 1 ? "tour" : "tours"} saved
            </Text>
          </View>

          {guides.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tours yet</Text>
              <Text style={styles.emptyDescription}>
                Create your first audio tour in the Explore tab
              </Text>
            </View>
          ) : (
            guides.map((guide: AudioGuide) => (
              <SwipeableCard
                key={guide.id}
                guide={guide}
                onPress={() => {
                  if (guide.type === "route") {
                    router.push({ pathname: "/route-navigation" as any, params: { tourId: guide.id } } as any);
                  } else {
                    setSelectedGuide(guide);
                  }
                }}
                onDelete={() => removeTour(guide.id)}
                formatDuration={formatDuration}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={selectedGuide !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedGuide(null)}
      >
        {selectedGuide && (
          <AudioPlayer
            guide={selectedGuide}
            onClose={() => setSelectedGuide(null)}
          />
        )}
      </Modal>
    </View>
    </FeatureGuard>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    position: "relative",
    marginBottom: 20,
    width: "100%",
    alignSelf: "center",
  },
  deleteButtonContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  swipeableContent: {
    width: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    fontWeight: "400",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    alignSelf: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardContent: {
    overflow: "hidden",
    width: "100%",
    alignItems: "stretch",
  },
  imageContainer: {
    width: "100%",
    height: 160,
    position: "relative",
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    alignSelf: "center",
  },
  typeBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  downloadedBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#34C759",
    padding: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardDetails: {
    padding: 16,
    alignItems: "stretch",
    width: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginRight: 12,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: "#8E8E93",
    flex: 1,
    fontWeight: "500",
  },
  description: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  metaDividerContainer: {
    justifyContent: "center",
  },
  metaDivider: {
    fontSize: 13,
    color: "#C7C7CC",
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    left: 0,
  },
});
