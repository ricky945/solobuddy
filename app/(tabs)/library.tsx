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

interface SwipeableCardProps {
  guide: AudioGuide;
  onPress: () => void;
  onDelete: () => void;
  formatDuration: (seconds: number) => string;
}

function SwipeableCard({ guide, onPress, onDelete, formatDuration }: SwipeableCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
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
            Animated.timing(translateX, {
              toValue: -500,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              onDelete();
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={24} color={Colors.light.background} />
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
          activeOpacity={0.7}
          onPress={onPress}
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
                  <MapPin size={32} color={Colors.light.textSecondary} />
                </View>
              )}
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {guide.type === "route" ? "Route" : "Immersive"}
                </Text>
              </View>
              {guide.isDownloaded && (
                <View style={styles.downloadedBadge}>
                  <Download size={12} color={Colors.light.background} />
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
                    size={20}
                    color={Colors.light.primary}
                    fill={Colors.light.primary}
                  />
                </View>
              </View>

              <View style={styles.locationRow}>
                <MapPin size={14} color={Colors.light.textSecondary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {guide.location || "Unknown location"}
                </Text>
              </View>

              <Text style={styles.description} numberOfLines={2}>
                {guide.description}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={14} color={Colors.light.textSecondary} />
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

              {!guide.isDownloaded && (
                <TouchableOpacity
                  style={styles.downloadButton}
                  activeOpacity={0.7}
                >
                  <Download size={16} color={Colors.light.primary} />
                  <Text style={styles.downloadButtonText}>
                    Download for offline
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
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
                    router.push(`/route-navigation?tourId=${guide.id}`);
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
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    position: "relative",
    marginBottom: 16,
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
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeableContent: {
    width: "100%",
  },
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardContent: {
    flexDirection: "row",
    padding: 12,
  },
  imageContainer: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  typeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: Colors.light.background,
    fontSize: 10,
    fontWeight: "600",
  },
  downloadedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.light.success,
    padding: 6,
    borderRadius: 6,
  },
  cardDetails: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginRight: 8,
  },
  playButton: {
    padding: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  metaDividerContainer: {
    justifyContent: "center",
  },
  metaDivider: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  downloadButtonText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
});
