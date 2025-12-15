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
} from "react-native";
import { X, Navigation } from "lucide-react-native";
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

export default function LandmarkDetailModal({
  landmark,
  userLocation,
  visible,
  onClose,
}: LandmarkDetailModalProps) {
  if (!landmark || !visible) return null;



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

  const whyVisit = landmark.userNote || "A must-see attraction in the area";

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

          {landmark.imageUrl && (
            <Image
              source={{ uri: landmark.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          )}

          <View style={styles.contentPadding}>
            <Text style={styles.title}>{landmark.name}</Text>
            
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
              <Text style={styles.directionsButtonText}>Start Directions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "80%",
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
    height: 200,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  contentPadding: {
    padding: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: "#1F2937",
    marginBottom: 24,
    lineHeight: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#6B7280",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: "#4B5563",
    lineHeight: 24,
  },
  whyVisit: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  directionsButton: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 16,
    gap: 10,
    marginTop: 8,
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
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
