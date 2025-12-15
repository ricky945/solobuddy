import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Platform,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { X, Navigation, ThumbsUp, Star, User, MessageSquare, Send } from "lucide-react-native";
import Colors from "@/constants/colors";
import { MapLandmark } from "@/types";
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
  onLandmarkUpdate?: (landmark: MapLandmark) => void;
}

export default function LandmarkDetailModal({
  landmark,
  userLocation,
  visible,
  onClose,
  onLandmarkUpdate,
}: LandmarkDetailModalProps) {
  const { user } = useUser();
  const [reviewComment, setReviewComment] = useState<string>("");
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  
  const upvoteMutation = trpc.landmarks.upvote.useMutation();
  const addReviewMutation = trpc.landmarks.addReview.useMutation();
  console.log("[LandmarkDetailModal] Rendering with:", {
    hasLandmark: !!landmark,
    visible,
    landmarkName: landmark?.name,
  });

  if (!landmark || !visible) return null;

  const hasUpvoted = landmark.upvotedBy.includes(user.id);
  
  const handleUpvote = async () => {
    try {
      const result = await upvoteMutation.mutateAsync({
        landmarkId: landmark.id,
        userId: user.id,
      });
      if (onLandmarkUpdate && result.landmark) {
        onLandmarkUpdate(result.landmark);
      }
    } catch (error: any) {
      console.error("[LandmarkDetailModal] Error upvoting:", error);
      Alert.alert("Error", "Failed to update upvote. Please try again.");
    }
  };
  
  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) {
      Alert.alert("Required", "Please enter a comment");
      return;
    }
    
    setIsSubmittingReview(true);
    try {
      const userName = user.profile?.name || "Anonymous User";
      const result = await addReviewMutation.mutateAsync({
        landmarkId: landmark.id,
        review: {
          id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          userName: userName,
          userAvatar: user.profile?.profilePictureUrl,
          rating: reviewRating,
          comment: reviewComment.trim(),
          createdAt: Date.now(),
        },
      });
      
      setReviewComment("");
      setReviewRating(5);
      
      if (onLandmarkUpdate && result.landmark) {
        onLandmarkUpdate(result.landmark);
      }
      
      Alert.alert("Success", "Your review has been added!");
    } catch (error: any) {
      console.error("[LandmarkDetailModal] Error submitting review:", error);
      Alert.alert("Error", "Failed to add review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const calculateDistance = () => {
    if (!userLocation) return null;

    const R = 6371;
    const dLat = ((landmark.coordinates.latitude - userLocation.latitude) * Math.PI) / 180;
    const dLon = ((landmark.coordinates.longitude - userLocation.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.latitude * Math.PI) / 180) *
        Math.cos((landmark.coordinates.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    } else {
      return `${distance.toFixed(1)}km away`;
    }
  };

  const handleGetDirections = () => {
    if (!userLocation) return;

    const destination = `${landmark.coordinates.latitude},${landmark.coordinates.longitude}`;
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
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      historical: "#D97706",
      cultural: "#7C3AED",
      religious: "#2563EB",
      museum: "#DC2626",
      park: "#059669",
      monument: "#B45309",
      building: "#4B5563",
      natural: "#10B981",
    };
    return colors[category] || Colors.light.primary;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.light.text} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {landmark.imageUrl && (
              <Image
                source={{ uri: landmark.imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            )}

            <View style={styles.contentPadding}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: getCategoryColor(landmark.category) },
                ]}
              >
                <Text style={styles.categoryText}>
                  {landmark.category.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.title}>{landmark.name}</Text>
              
              {userLocation && (
                <View style={styles.distanceContainer}>
                  <Navigation size={14} color={Colors.light.primary} />
                  <Text style={styles.distanceText}>{calculateDistance()}</Text>
                </View>
              )}

              <Text style={styles.description}>{landmark.description}</Text>

              <View style={styles.socialSection}>
                <TouchableOpacity 
                  style={[styles.upvoteButton, hasUpvoted && styles.upvoteButtonActive]}
                  onPress={handleUpvote}
                  activeOpacity={0.7}
                >
                  <ThumbsUp 
                    size={20} 
                    color={hasUpvoted ? "#fff" : Colors.light.primary}
                    fill={hasUpvoted ? "#fff" : "none"}
                  />
                  <Text style={[styles.upvoteText, hasUpvoted && styles.upvoteTextActive]}>
                    {landmark.upvotes} {landmark.upvotes === 1 ? "upvote" : "upvotes"}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.posterButton}
                  activeOpacity={0.7}
                >
                  <User size={16} color={Colors.light.textSecondary} />
                  <Text style={styles.posterText}>by {landmark.createdByName}</Text>
                </TouchableOpacity>
              </View>
              
              {landmark.reviews.length > 0 && (
                <View style={styles.reviewsSection}>
                  <View style={styles.reviewsHeader}>
                    <MessageSquare size={20} color={Colors.light.text} />
                    <Text style={styles.reviewsTitle}>
                      Reviews ({landmark.reviews.length})
                    </Text>
                  </View>
                  
                  {landmark.reviews.map((review) => (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewUserInfo}>
                          {review.userAvatar ? (
                            <Image 
                              source={{ uri: review.userAvatar }} 
                              style={styles.reviewAvatar}
                            />
                          ) : (
                            <View style={styles.reviewAvatarPlaceholder}>
                              <User size={16} color={Colors.light.textSecondary} />
                            </View>
                          )}
                          <Text style={styles.reviewUserName}>{review.userName}</Text>
                        </View>
                        <View style={styles.reviewRating}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              color="#F59E0B"
                              fill={i < review.rating ? "#F59E0B" : "none"}
                            />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                      <Text style={styles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.addReviewSection}>
                <Text style={styles.addReviewTitle}>Add Your Review</Text>
                
                <View style={styles.ratingSelector}>
                  <Text style={styles.ratingSelectorLabel}>Rating:</Text>
                  <View style={styles.ratingStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setReviewRating(i + 1)}
                        activeOpacity={0.7}
                      >
                        <Star
                          size={24}
                          color="#F59E0B"
                          fill={i < reviewRating ? "#F59E0B" : "none"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View style={styles.reviewInputContainer}>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="Share your experience..."
                    placeholderTextColor={Colors.light.textSecondary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.submitReviewButton, isSubmittingReview && styles.submitReviewButtonDisabled]}
                    onPress={handleSubmitReview}
                    disabled={isSubmittingReview}
                    activeOpacity={0.7}
                  >
                    {isSubmittingReview ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Send size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {landmark.userNote && (
                <View style={styles.noteContainer}>
                  <Text style={styles.noteLabel}>Why it&apos;s special:</Text>
                  <Text style={styles.noteText}>{landmark.userNote}</Text>
                </View>
              )}

              {landmark.userImages && landmark.userImages.length > 0 && (
                <View style={styles.imagesContainer}>
                  <Text style={styles.imagesLabel}>Photos:</Text>
                  <FlatList
                    horizontal
                    data={landmark.userImages}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item }}
                        style={styles.userImage}
                        resizeMode="cover"
                      />
                    )}
                    showsHorizontalScrollIndicator={false}
                  />
                </View>
              )}

              <TouchableOpacity
                style={styles.directionsButton}
                onPress={handleGetDirections}
              >
                <Navigation size={20} color="#fff" />
                <Text style={styles.directionsButtonText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBackdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "95%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 10,
  },
  closeButton: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  image: {
    width: "100%",
    height: 240,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentPadding: {
    padding: 24,
  },
  categoryBadge: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 34,
  },
  distanceContainer: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  distanceText: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: "600" as const,
  },
  description: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 24,
    marginBottom: 24,
  },
  directionsButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  directionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  noteContainer: {
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 6,
  },
  noteText: {
    fontSize: 15,
    color: "#78350F",
    lineHeight: 22,
  },
  imagesContainer: {
    marginBottom: 24,
  },
  imagesLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  userImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  socialSection: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  upvoteButton: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: `${Colors.light.primary}15`,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  upvoteButtonActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  upvoteText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.primary,
  },
  upvoteTextActive: {
    color: "#fff",
  },
  posterButton: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
  },
  posterText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
  },
  reviewsSection: {
    marginBottom: 24,
  },
  reviewsHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  reviewCard: {
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  reviewHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewUserInfo: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  reviewRating: {
    flexDirection: "row" as const,
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  addReviewSection: {
    backgroundColor: Colors.light.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  addReviewTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  ratingSelector: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  ratingSelectorLabel: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.light.text,
  },
  ratingStars: {
    flexDirection: "row" as const,
    gap: 6,
  },
  reviewInputContainer: {
    flexDirection: "row" as const,
    alignItems: "flex-end",
    gap: 8,
  },
  reviewInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    minHeight: 80,
  },
  submitReviewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitReviewButtonDisabled: {
    opacity: 0.6,
  },
});
