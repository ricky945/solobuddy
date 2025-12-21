import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { X, Navigation, MapPin, Star, Trash2 } from "lucide-react-native";
import Colors from "@/constants/colors";
import { LandmarkReview, MapLandmark } from "@/types";
import { trpc } from "@/lib/trpc";
import { useUser } from "@/contexts/UserContext";

interface LandmarkDetailModalProps {
  landmark: MapLandmark | null;
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  visible: boolean;
  onClose: () => void;
  onLandmarkUpdated?: (landmark: MapLandmark) => void;
  onLandmarkDeleted?: (landmarkId: string) => void;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m away`;
  }
  return `${km.toFixed(1)}km away`;
}

function generateGooglePlacesImageUrl(placeName: string): string {
  const encodedName = encodeURIComponent(placeName);
  return `https://source.unsplash.com/800x400/?${encodedName},landmark,architecture`;
}

function generateWhyVisit(landmark: MapLandmark): string {
  const category = landmark.category;
  const type = landmark.type;
  
  const reasons = {
    historical: [
      "Step back in time and experience centuries of rich history",
      "Discover the fascinating stories that shaped this location",
      "A remarkable window into the past you won't want to miss",
    ],
    cultural: [
      "Immerse yourself in authentic local culture and traditions",
      "Experience the vibrant cultural heart of the area",
      "A cultural treasure that showcases the essence of this place",
    ],
    religious: [
      "Marvel at stunning architectural beauty and spiritual significance",
      "A serene sanctuary offering peace and architectural wonder",
      "Experience the profound history and artistry of sacred architecture",
    ],
    museum: [
      "Explore world-class exhibits and fascinating collections",
      "An inspiring journey through art, history, and innovation",
      "Discover rare artifacts and captivating stories",
    ],
    park: [
      "Escape to natural beauty and peaceful surroundings",
      "Perfect spot for relaxation and outdoor activities",
      "A green oasis offering stunning views and fresh air",
    ],
    monument: [
      "An iconic symbol with powerful historical significance",
      "Stand in awe of this impressive architectural achievement",
      "A must-see landmark that defines the city's skyline",
    ],
    building: [
      "Admire exceptional architecture and design excellence",
      "A stunning example of architectural innovation",
      "Experience the grandeur of this architectural masterpiece",
    ],
    natural: [
      "Witness breathtaking natural beauty and landscapes",
      "A spectacular natural wonder that takes your breath away",
      "Experience nature's magnificent artistry firsthand",
    ],
  };

  if (type === "restaurant") {
    return "Savor exceptional cuisine and authentic local flavors in a welcoming atmosphere";
  }

  if (type === "unique") {
    return "Discover a hidden gem that offers a unique and unforgettable experience";
  }

  const categoryReasons = reasons[category] || reasons.historical;
  return categoryReasons[Math.floor(Math.random() * categoryReasons.length)];
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

function formatReviewDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function LandmarkDetailModal({
  landmark,
  userLocation,
  visible,
  onClose,
  onLandmarkUpdated,
  onLandmarkDeleted,
}: LandmarkDetailModalProps) {
  const { user } = useUser();
  const [showCreatorModal, setShowCreatorModal] = useState<boolean>(false);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment, setComment] = useState<string>("");

  const addReviewMutation = trpc.landmarks.addReview.useMutation();
  const deleteMutation = trpc.landmarks.delete.useMutation();

  const safeLandmark: MapLandmark | null = landmark;

  const distance = useMemo(() => {
    if (!userLocation || !safeLandmark) return 0;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      safeLandmark.coordinates.latitude,
      safeLandmark.coordinates.longitude
    );
  }, [safeLandmark, userLocation]);

  const handleGetDirections = useCallback(() => {
    if (!userLocation) {
      Alert.alert("Location needed", "Enable location to get directions.");
      return;
    }
    if (!safeLandmark) return;

    const destination = `${safeLandmark.coordinates.latitude},${safeLandmark.coordinates.longitude}`;
    const origin = `${userLocation.latitude},${userLocation.longitude}`;

    let url = "";
    if (Platform.OS === "ios") {
      url = `maps://app?saddr=${origin}&daddr=${destination}`;
    } else if (Platform.OS === "android") {
      url = `google.navigation:q=${destination}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    }

    console.log("[Landmark Modal] Opening directions:", url);
    Linking.openURL(url).catch((err) =>
      console.error("[Landmark Modal] Error opening maps:", err)
    );
  }, [safeLandmark, userLocation]);

  const imageUrl = useMemo(() => {
    if (!safeLandmark) return "";
    return safeLandmark.imageUrl || generateGooglePlacesImageUrl(safeLandmark.name);
  }, [safeLandmark]);

  const whyVisit = useMemo(() => {
    if (!safeLandmark) return "";
    return safeLandmark.userNote || generateWhyVisit(safeLandmark);
  }, [safeLandmark]);

  const isOwner = useMemo(() => {
    if (!safeLandmark) return false;
    return safeLandmark.createdBy === user.id;
  }, [safeLandmark, user.id]);

  const avgRating = useMemo(() => {
    const reviews = safeLandmark?.reviews ?? [];
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
  }, [safeLandmark?.reviews]);

  const creatorAvatar = useMemo(() => {
    if (!safeLandmark) return undefined;
    return safeLandmark.createdByAvatar;
  }, [safeLandmark]);

  const creatorName = useMemo(() => {
    if (!safeLandmark) return "";
    return safeLandmark.createdByName || "Anonymous";
  }, [safeLandmark]);

  const submitReview = useCallback(() => {
    const landmarkId = safeLandmark?.id;

    if (!landmarkId) return;

    if (!comment.trim()) {
      Alert.alert("Add a comment", "Tell others what you thought.");
      return;
    }

    const review: LandmarkReview = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      userId: user.id,
      userName: user.profile?.name || "Anonymous",
      userAvatar: user.profile?.profilePictureUrl,
      rating,
      comment: comment.trim(),
      createdAt: Date.now(),
    };

    console.log("[Landmark Modal] Submitting review:", {
      landmarkId,
      rating,
      commentLength: review.comment.length,
    });

    addReviewMutation.mutate(
      { landmarkId, review },
      {
        onSuccess: (res) => {
          console.log("[Landmark Modal] Review added OK", res?.landmark?.id);
          if (res?.landmark) onLandmarkUpdated?.(res.landmark);
          setComment("");
          setRating(5);
        },
        onError: (e) => {
          console.error("[Landmark Modal] Review add failed", e);
          Alert.alert("Couldn’t add review", getErrorMessage(e));
        },
      }
    );
  }, [addReviewMutation, comment, onLandmarkUpdated, rating, safeLandmark?.id, user.id, user.profile?.name, user.profile?.profilePictureUrl]);

  const confirmAndDelete = useCallback(() => {
    if (!safeLandmark) return;
    const reviewsCount = safeLandmark.reviews?.length ?? 0;

    const doDelete = () => {
      console.log("[Landmark Modal] Deleting landmark", safeLandmark.id);
      deleteMutation.mutate(
        { landmarkId: safeLandmark.id, userId: user.id },
        {
          onSuccess: () => {
            console.log("[Landmark Modal] Delete OK", safeLandmark.id);
            onLandmarkDeleted?.(safeLandmark.id);
            onClose();
          },
          onError: (e) => {
            console.error("[Landmark Modal] Delete failed", e);
            Alert.alert("Couldn’t delete", getErrorMessage(e));
          },
        }
      );
    };

    if (reviewsCount > 1) {
      Alert.alert(
        "Delete location?",
        `This location has ${reviewsCount} reviews. Are you sure you want to delete it?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ]
      );
      return;
    }

    Alert.alert("Delete location?", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }, [deleteMutation, onClose, onLandmarkDeleted, safeLandmark, user.id]);

  if (!visible || !safeLandmark) return null;

  const reviews = safeLandmark.reviews ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} testID="landmark-detail-close">
            <X size={24} color="#1F2937" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />

            <View style={styles.contentPadding}>
              <View style={styles.titleRow}>
                <Text style={styles.title} testID="landmark-detail-title">
                  {safeLandmark.name}
                </Text>
                <View style={styles.distanceBadge}>
                  <MapPin size={14} color={Colors.light.primary} />
                  <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
                </View>
              </View>

              {safeLandmark.type === "unique" ? (
                <TouchableOpacity
                  style={styles.creatorRow}
                  activeOpacity={0.85}
                  onPress={() => setShowCreatorModal(true)}
                  testID="landmark-creator-row"
                >
                  {creatorAvatar ? (
                    <Image source={{ uri: creatorAvatar }} style={styles.creatorAvatar} />
                  ) : (
                    <View style={styles.creatorAvatarFallback} />
                  )}
                  <View style={styles.creatorTextWrap}>
                    <Text style={styles.creatorTop}>Suggested by</Text>
                    <Text style={styles.creatorName} numberOfLines={1}>
                      {creatorName}
                    </Text>
                  </View>
                  <View style={styles.creatorPill}>
                    <Text style={styles.creatorPillText}>View profile</Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.description}>{safeLandmark.description}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Why Visit</Text>
                <Text style={styles.whyVisit}>{whyVisit}</Text>
              </View>

              <View style={styles.section}>
                <View style={styles.reviewsHeaderRow}>
                  <Text style={styles.sectionLabel}>Reviews</Text>
                  <View style={styles.reviewsSummary}>
                    <Star size={14} color="#F59E0B" />
                    <Text style={styles.reviewsSummaryText}>
                      {reviews.length === 0 ? "No reviews" : `${avgRating.toFixed(1)} (${reviews.length})`}
                    </Text>
                  </View>
                </View>

                {reviews.length === 0 ? (
                  <Text style={styles.emptyReviewsText}>Be the first to review this spot.</Text>
                ) : (
                  <View style={styles.reviewsList}>
                    {reviews
                      .slice()
                      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                      .map((r) => (
                        <View key={r.id} style={styles.reviewCard} testID={`landmark-review-${r.id}`}>
                          <View style={styles.reviewHeader}>
                            {r.userAvatar ? (
                              <Image source={{ uri: r.userAvatar }} style={styles.reviewAvatar} />
                            ) : (
                              <View style={styles.reviewAvatarFallback} />
                            )}
                            <View style={styles.reviewHeaderText}>
                              <Text style={styles.reviewName} numberOfLines={1}>
                                {r.userName || "Anonymous"}
                              </Text>
                              <Text style={styles.reviewMeta}>
                                {formatReviewDate(r.createdAt)} • {"★".repeat(Math.max(0, Math.min(5, r.rating || 0)))}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.reviewComment}>{r.comment}</Text>
                        </View>
                      ))}
                  </View>
                )}

                <View style={styles.addReviewCard}>
                  <Text style={styles.addReviewTitle}>Add a review</Text>

                  <View style={styles.ratingRow}>
                    {([1, 2, 3, 4, 5] as const).map((n) => {
                      const active = rating >= n;
                      return (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setRating(n)}
                          style={styles.starButton}
                          activeOpacity={0.8}
                          testID={`review-star-${n}`}
                        >
                          <Star size={20} color={active ? "#F59E0B" : "#D1D5DB"} fill={active ? "#F59E0B" : "transparent"} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="What did you think?"
                    placeholderTextColor={"#9CA3AF"}
                    style={styles.commentInput}
                    multiline
                    testID="review-comment-input"
                  />

                  <TouchableOpacity
                    style={[styles.primaryButton, addReviewMutation.isPending && styles.primaryButtonDisabled]}
                    onPress={submitReview}
                    activeOpacity={0.85}
                    disabled={addReviewMutation.isPending}
                    testID="submit-review-button"
                  >
                    {addReviewMutation.isPending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Post review</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.directionsButton} onPress={handleGetDirections} activeOpacity={0.8}>
                <Navigation size={22} color="#fff" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>

              {safeLandmark.type === "unique" && isOwner ? (
                <TouchableOpacity
                  style={[styles.deleteButton, deleteMutation.isPending && styles.deleteButtonDisabled]}
                  onPress={confirmAndDelete}
                  activeOpacity={0.85}
                  disabled={deleteMutation.isPending}
                  testID="delete-hidden-gem-button"
                >
                  <Trash2 size={18} color="#fff" />
                  <Text style={styles.deleteButtonText}>Delete location</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>

        <Modal
          visible={showCreatorModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowCreatorModal(false)}
        >
          <View style={styles.profileOverlay}>
            <TouchableOpacity
              style={styles.profileBackdrop}
              activeOpacity={1}
              onPress={() => setShowCreatorModal(false)}
            />
            <View style={styles.profileCard}>
              <View style={styles.profileCardTop}>
                {creatorAvatar ? (
                  <Image source={{ uri: creatorAvatar }} style={styles.profileAvatarLarge} />
                ) : (
                  <View style={styles.profileAvatarLargeFallback} />
                )}
                <Text style={styles.profileName} numberOfLines={1}>
                  {creatorName}
                </Text>
                <Text style={styles.profileSubtitle}>Creator of this hidden gem</Text>
              </View>
              <TouchableOpacity
                style={styles.profileClose}
                onPress={() => setShowCreatorModal(false)}
                activeOpacity={0.85}
                testID="creator-profile-close"
              >
                <Text style={styles.profileCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrollContent: {
    paddingBottom: 18,
  },
  modalBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  closeButton: {
    position: "absolute" as const,
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  image: {
    width: "100%",
    height: 240,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  contentPadding: {
    padding: 24,
  },
  titleRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#1F2937",
    lineHeight: 30,
    flex: 1,
  },
  distanceBadge: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.light.primary,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#6B7280",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  whyVisit: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    fontWeight: "500" as const,
  },
  directionsButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 10,
    marginTop: 4,
    shadowColor: Colors.light.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  directionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },

  creatorRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 16,
    padding: 12,
    gap: 12,
    marginBottom: 18,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  creatorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5E7EB",
  },
  creatorTextWrap: {
    flex: 1,
  },
  creatorTop: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#6B7280",
    marginBottom: 2,
  },
  creatorName: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#111827",
    letterSpacing: -0.2,
  },
  creatorPill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  creatorPillText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: Colors.light.primary,
  },

  reviewsHeaderRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reviewsSummary: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reviewsSummaryText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#92400E",
  },
  emptyReviewsText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#6B7280",
    lineHeight: 20,
  },
  reviewsList: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 16,
    padding: 12,
  },
  reviewHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  reviewAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5E7EB",
  },
  reviewHeaderText: {
    flex: 1,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#111827",
  },
  reviewMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#6B7280",
  },
  reviewComment: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: "#374151",
    lineHeight: 20,
  },

  addReviewCard: {
    marginTop: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#EEF2F7",
    borderRadius: 18,
    padding: 12,
  },
  addReviewTitle: {
    fontSize: 14,
    fontWeight: "900" as const,
    color: "#111827",
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  starButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  commentInput: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#111827",
    textAlignVertical: "top" as const,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900" as const,
    letterSpacing: 0.2,
  },

  deleteButton: {
    marginTop: 12,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900" as const,
  },

  profileOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  profileCard: {
    width: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  profileCardTop: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
  },
  profileAvatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.light.backgroundSecondary,
    marginBottom: 12,
  },
  profileAvatarLargeFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#E5E7EB",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: "#111827",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#6B7280",
  },
  profileClose: {
    marginTop: 10,
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  profileCloseText: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#111827",
  },
});
