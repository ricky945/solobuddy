import React from "react";
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
} from "react-native";
import { X, Navigation, MapPin } from "lucide-react-native";
import Colors from "@/constants/colors";
import { MapLandmark } from "@/types";

interface LandmarkDetailModalProps {
  landmark: MapLandmark | null;
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  visible: boolean;
  onClose: () => void;
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

export default function LandmarkDetailModal({
  landmark,
  userLocation,
  visible,
  onClose,
}: LandmarkDetailModalProps) {
  if (!landmark || !visible) return null;

  const distance = userLocation
    ? calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        landmark.coordinates.latitude,
        landmark.coordinates.longitude
      )
    : 0;

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

  const imageUrl = landmark.imageUrl || generateGooglePlacesImageUrl(landmark.name);
  const whyVisit = landmark.userNote || generateWhyVisit(landmark);

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
            <X size={24} color="#1F2937" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />

            <View style={styles.contentPadding}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{landmark.name}</Text>
                <View style={styles.distanceBadge}>
                  <MapPin size={14} color={Colors.light.primary} />
                  <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
                </View>
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>About</Text>
                <Text style={styles.description}>{landmark.description}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Why Visit</Text>
                <Text style={styles.whyVisit}>{whyVisit}</Text>
              </View>

              <TouchableOpacity
                style={styles.directionsButton}
                onPress={handleGetDirections}
                activeOpacity={0.8}
              >
                <Navigation size={22} color="#fff" />
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
});
