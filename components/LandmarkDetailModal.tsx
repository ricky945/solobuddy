import React, { useCallback, useMemo, useState, useRef } from "react";
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
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { X, Navigation, MapPin, Star, Trash2, Camera, ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { LandmarkReview, MapLandmark } from "@/types";
import { addReview as supabaseAddReview, deleteLandmark as supabaseDeleteLandmark } from "@/lib/supabase-landmarks";
import { useUser } from "@/contexts/UserContext";
import { uploadImage } from "@/lib/supabase-functions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const R = 3959; // Earth's radius in miles
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

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)}ft away`;
  }
  return `${miles.toFixed(1)}mi away`;
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
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment, setComment] = useState<string>("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [isAddingReview, setIsAddingReview] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isUploadingReviewImage, setIsUploadingReviewImage] = useState<boolean>(false);
  const imageSliderRef = useRef<FlatList>(null);
  const commentInputRef = useRef<TextInput>(null);

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

  // Combine main image with user images for the slider
  const allImages = useMemo(() => {
    if (!safeLandmark) return [];
    const images: string[] = [];
    if (safeLandmark.imageUrl) {
      images.push(safeLandmark.imageUrl);
    }
    if (safeLandmark.userImages && safeLandmark.userImages.length > 0) {
      images.push(...safeLandmark.userImages);
    }
    // If no images at all, use a placeholder
    if (images.length === 0) {
      images.push(generateGooglePlacesImageUrl(safeLandmark.name));
    }
    return images;
  }, [safeLandmark]);

  const handleImageScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (SCREEN_WIDTH - 48));
    setCurrentImageIndex(index);
  }, []);

  const goToPrevImage = useCallback(() => {
    if (currentImageIndex > 0) {
      const newIndex = currentImageIndex - 1;
      setCurrentImageIndex(newIndex);
      imageSliderRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  }, [currentImageIndex]);

  const goToNextImage = useCallback(() => {
    if (currentImageIndex < allImages.length - 1) {
      const newIndex = currentImageIndex + 1;
      setCurrentImageIndex(newIndex);
      imageSliderRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  }, [currentImageIndex, allImages.length]);

  const handlePickReviewImage = useCallback(async () => {
    if (reviewImages.length >= 3) {
      Alert.alert("Limit reached", "You can add up to 3 photos per review.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsUploadingReviewImage(true);
      try {
        const uploadedUrl = await uploadImage(uri);
        setReviewImages((prev) => [...prev, uploadedUrl]);
      } catch (e) {
        console.error("[LandmarkDetail] Review image upload failed:", e);
        Alert.alert("Upload failed", "Couldn't upload the image. Please try again.");
      } finally {
        setIsUploadingReviewImage(false);
      }
    }
  }, [reviewImages.length]);

  const removeReviewImage = useCallback((index: number) => {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

  const submitReview = useCallback(async () => {
    Keyboard.dismiss();
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
      images: reviewImages.length > 0 ? reviewImages : undefined,
      createdAt: Date.now(),
    };

    console.log("[Landmark Modal] Submitting review via Supabase:", {
      landmarkId,
      rating,
      commentLength: review.comment.length,
      imagesCount: reviewImages.length,
    });

    setIsAddingReview(true);
    try {
      const updatedLandmark = await supabaseAddReview(landmarkId, review);
      console.log("[Landmark Modal] Review added OK", updatedLandmark?.id);
      if (updatedLandmark) onLandmarkUpdated?.(updatedLandmark);
      setComment("");
      setRating(5);
      setReviewImages([]);
      setShowReviewModal(false);
    } catch (e) {
      console.error("[Landmark Modal] Review add failed", e);
      Alert.alert("Couldn't add review", getErrorMessage(e));
    } finally {
      setIsAddingReview(false);
    }
  }, [comment, onLandmarkUpdated, rating, reviewImages, safeLandmark?.id, user.id, user.profile?.name, user.profile?.profilePictureUrl]);

  const confirmAndDelete = useCallback(() => {
    if (!safeLandmark) return;
    const reviewsCount = safeLandmark.reviews?.length ?? 0;

    const doDelete = async () => {
      console.log("[Landmark Modal] Deleting landmark via Supabase", safeLandmark.id);
      setIsDeleting(true);
      try {
        await supabaseDeleteLandmark(safeLandmark.id);
        console.log("[Landmark Modal] Delete OK", safeLandmark.id);
        onLandmarkDeleted?.(safeLandmark.id);
        onClose();
      } catch (e) {
        console.error("[Landmark Modal] Delete failed", e);
        Alert.alert("Couldn't delete", getErrorMessage(e));
      } finally {
        setIsDeleting(false);
      }
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

    Alert.alert("Delete location?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }, [onClose, onLandmarkDeleted, safeLandmark]);

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
            {/* Image Slider */}
            <View style={styles.imageSliderContainer}>
              <FlatList
                ref={imageSliderRef}
                data={allImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setFullScreenImage(item)}
                    style={styles.imageSlideWrapper}
                  >
                    <Image source={{ uri: item }} style={styles.image} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
              />
              
              {/* Image navigation arrows */}
              {allImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <TouchableOpacity
                      style={[styles.imageNavButton, styles.imageNavLeft]}
                      onPress={goToPrevImage}
                      activeOpacity={0.8}
                    >
                      <ChevronLeft size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {currentImageIndex < allImages.length - 1 && (
                    <TouchableOpacity
                      style={[styles.imageNavButton, styles.imageNavRight]}
                      onPress={goToNextImage}
                      activeOpacity={0.8}
                    >
                      <ChevronRight size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Pagination dots */}
              {allImages.length > 1 && (
                <View style={styles.paginationContainer}>
                  {allImages.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Image counter */}
              {allImages.length > 1 && (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {allImages.length}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.contentPadding}>
              {/* Type Label */}
              {(safeLandmark.type === "restaurant" || safeLandmark.type === "unique") && (
                <View style={[
                  styles.typeBadge,
                  safeLandmark.type === "restaurant" ? styles.typeBadgeRestaurant : styles.typeBadgeUnique
                ]}>
                  <Text style={[
                    styles.typeBadgeText,
                    safeLandmark.type === "restaurant" ? styles.typeBadgeTextRestaurant : styles.typeBadgeTextUnique
                  ]}>
                    {safeLandmark.type === "restaurant" ? "🍽️ Restaurant" : "💎 Hidden Gem"}
                  </Text>
                </View>
              )}

              <View style={styles.titleRow}>
                <Text style={styles.title} testID="landmark-detail-title">
                  {safeLandmark.name}
                </Text>
                <View style={styles.distanceBadge}>
                  <MapPin size={14} color={Colors.light.primary} />
                  <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
                </View>
              </View>

              {(safeLandmark.type === "unique" || safeLandmark.type === "restaurant") ? (
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
                
                {/* Compact Get Directions button */}
                <TouchableOpacity 
                  style={styles.directionsButtonCompact} 
                  onPress={handleGetDirections} 
                  activeOpacity={0.8}
                >
                  <Navigation size={16} color={Colors.light.primary} />
                  <Text style={styles.directionsButtonCompactText}>Get Directions</Text>
                </TouchableOpacity>
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
                          {r.images && r.images.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              style={styles.reviewImagesScroll}
                              contentContainerStyle={styles.reviewImagesContainer}
                            >
                              {r.images.map((img, imgIdx) => (
                                <TouchableOpacity
                                  key={imgIdx}
                                  onPress={() => setFullScreenImage(img)}
                                  activeOpacity={0.9}
                                >
                                  <Image source={{ uri: img }} style={styles.reviewImage} />
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          )}
                        </View>
                      ))}
                  </View>
                )}

                {/* Compact Add Review button */}
                <TouchableOpacity 
                  style={styles.addReviewButton}
                  onPress={() => setShowReviewModal(true)}
                  activeOpacity={0.8}
                  testID="open-review-modal-button"
                >
                  <Plus size={18} color={Colors.light.primary} />
                  <Text style={styles.addReviewButtonText}>Add Review</Text>
                </TouchableOpacity>
              </View>

              {(safeLandmark.type === "unique" || safeLandmark.type === "restaurant") && isOwner ? (
                <TouchableOpacity
                  style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                  onPress={confirmAndDelete}
                  activeOpacity={0.85}
                  disabled={isDeleting}
                  testID="delete-hidden-gem-button"
                >
                  <Trash2 size={18} color="#fff" />
                  <Text style={styles.deleteButtonText}>Delete listing</Text>
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

        {/* Add Review Modal */}
        <Modal
          visible={showReviewModal}
          animationType="slide"
          transparent
          onRequestClose={() => {
            Keyboard.dismiss();
            setShowReviewModal(false);
          }}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.reviewModalOverlay}
          >
            <TouchableOpacity
              style={styles.reviewModalBackdrop}
              activeOpacity={1}
              onPress={() => {
                Keyboard.dismiss();
                setShowReviewModal(false);
              }}
            />
            <View style={styles.reviewModalContent}>
              <View style={styles.reviewModalHeader}>
                <Text style={styles.reviewModalTitle}>Write a Review</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowReviewModal(false);
                  }}
                  style={styles.reviewModalCloseButton}
                  activeOpacity={0.8}
                >
                  <X size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.reviewModalScrollContent}
              >
                <Text style={styles.reviewModalLandmarkName}>{safeLandmark?.name}</Text>

                <Text style={styles.reviewModalLabel}>Your Rating</Text>
                <View style={styles.ratingRowModal}>
                  {([1, 2, 3, 4, 5] as const).map((n) => {
                    const active = rating >= n;
                    return (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setRating(n)}
                        style={styles.starButtonModal}
                        activeOpacity={0.8}
                        testID={`review-star-modal-${n}`}
                      >
                        <Star size={28} color={active ? "#F59E0B" : "#D1D5DB"} fill={active ? "#F59E0B" : "transparent"} />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.reviewModalLabel}>Your Review</Text>
                <TextInput
                  ref={commentInputRef}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Share your experience..."
                  placeholderTextColor={"#9CA3AF"}
                  style={styles.commentInputModal}
                  multiline
                  textAlignVertical="top"
                  returnKeyType="default"
                  blurOnSubmit={false}
                  testID="review-comment-input-modal"
                />

                <Text style={styles.reviewModalLabel}>Add Photos (Optional)</Text>
                <View style={styles.reviewImagesPreviewModal}>
                  {reviewImages.map((img, idx) => (
                    <View key={idx} style={styles.reviewImagePreviewWrapper}>
                      <Image source={{ uri: img }} style={styles.reviewImagePreviewModal} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeReviewImage(idx)}
                        activeOpacity={0.8}
                      >
                        <X size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {reviewImages.length < 3 && (
                    <TouchableOpacity
                      style={styles.addReviewImageButtonModal}
                      onPress={handlePickReviewImage}
                      activeOpacity={0.8}
                      disabled={isUploadingReviewImage}
                    >
                      {isUploadingReviewImage ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                      ) : (
                        <>
                          <Camera size={22} color={Colors.light.primary} />
                          <Text style={styles.addReviewImageTextModal}>Photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.submitReviewButton, (isAddingReview || isUploadingReviewImage) && styles.submitReviewButtonDisabled]}
                  onPress={submitReview}
                  activeOpacity={0.85}
                  disabled={isAddingReview || isUploadingReviewImage}
                  testID="submit-review-button-modal"
                >
                  {isAddingReview ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitReviewButtonText}>Post Review</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Full-screen image viewer */}
        <Modal
          visible={!!fullScreenImage}
          animationType="fade"
          transparent
          onRequestClose={() => setFullScreenImage(null)}
        >
          <View style={styles.fullScreenOverlay}>
            <TouchableOpacity
              style={styles.fullScreenBackdrop}
              activeOpacity={1}
              onPress={() => setFullScreenImage(null)}
            />
            {fullScreenImage && (
              <Image
                source={{ uri: fullScreenImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setFullScreenImage(null)}
              activeOpacity={0.8}
            >
              <X size={28} color="#fff" />
            </TouchableOpacity>
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
  imageSliderContainer: {
    position: "relative" as const,
    height: 240,
  },
  imageSlideWrapper: {
    width: SCREEN_WIDTH,
  },
  image: {
    width: "100%",
    height: 240,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  imageNavButton: {
    position: "absolute" as const,
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  imageNavLeft: {
    left: 12,
  },
  imageNavRight: {
    right: 12,
  },
  paginationContainer: {
    position: "absolute" as const,
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row" as const,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  paginationDotActive: {
    backgroundColor: "#fff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  imageCounter: {
    position: "absolute" as const,
    top: 16,
    left: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700" as const,
  },
  contentPadding: {
    padding: 24,
  },
  typeBadge: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  typeBadgeRestaurant: {
    backgroundColor: "#FEF3C7",
  },
  typeBadgeUnique: {
    backgroundColor: "#D1FAE5",
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  typeBadgeTextRestaurant: {
    color: "#D97706",
  },
  typeBadgeTextUnique: {
    color: "#059669",
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
  directionsButtonCompact: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: "#EEF2FF",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  directionsButtonCompactText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: "700" as const,
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
  reviewImagesScroll: {
    marginTop: 10,
  },
  reviewImagesContainer: {
    gap: 8,
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundSecondary,
  },

  addReviewButton: {
    marginTop: 14,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: "#EEF2FF",
    gap: 8,
    alignSelf: "flex-start",
  },
  addReviewButtonText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.light.primary,
  },

  // Review Modal Styles
  reviewModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  reviewModalBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  reviewModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  reviewModalHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: "#111827",
  },
  reviewModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewModalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  reviewModalLandmarkName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#6B7280",
    marginBottom: 20,
  },
  reviewModalLabel: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#374151",
    marginBottom: 10,
  },
  ratingRowModal: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  starButtonModal: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  commentInputModal: {
    minHeight: 100,
    maxHeight: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "500" as const,
    color: "#111827",
    marginBottom: 20,
  },
  reviewImagesPreviewModal: {
    flexDirection: "row" as const,
    gap: 12,
    flexWrap: "wrap" as const,
    marginBottom: 24,
  },
  reviewImagePreviewWrapper: {
    position: "relative" as const,
  },
  reviewImagePreviewModal: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  removeImageButton: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  addReviewImageButtonModal: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: "dashed" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addReviewImageTextModal: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.light.primary,
  },
  submitReviewButton: {
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitReviewButtonDisabled: {
    opacity: 0.6,
  },
  submitReviewButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800" as const,
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

  fullScreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
  },
  fullScreenCloseButton: {
    position: "absolute" as const,
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
