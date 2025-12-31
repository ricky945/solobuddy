import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { X, MapPin, Camera } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { createLandmark } from "@/lib/supabase-landmarks";
import { useUser } from "@/contexts/UserContext";
import { uploadImage } from "@/lib/supabase-functions";

interface AddLandmarkModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (landmark: any) => void;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export default function AddLandmarkModal({
  visible,
  onClose,
  onAdd,
  coordinates,
}: AddLandmarkModalProps) {
  const [selectedType, setSelectedType] = useState<"unique" | "restaurant" | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { user } = useUser();

  const fetchLocationName = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            "User-Agent": "RorkTourApp/1.0",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        const name =
          address.restaurant ||
          address.cafe ||
          address.bar ||
          address.shop ||
          address.building ||
          address.road ||
          address.neighbourhood ||
          "Unknown Location";
        setLocationName(name);
      }
    } catch (error) {
      console.error("[AddLandmark] Error fetching location:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  }, [coordinates.latitude, coordinates.longitude]);

  useEffect(() => {
    if (visible && selectedType === "restaurant") {
      fetchLocationName();
    }
  }, [visible, selectedType, fetchLocationName]);

  const resetForm = () => {
    setSelectedType(null);
    setLocationName("");
    setNote("");
    setImages([]);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  const handleTypeSelect = (type: "unique" | "restaurant") => {
    setSelectedType(type);
  };

  const handlePickImage = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not Available", "Image picking is not available on web yet.");
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Type Required", "Please select a landmark type");
      return;
    }

    if (selectedType !== "unique" && selectedType !== "restaurant") {
      Alert.alert("Invalid Type", "Landmark type must be unique or restaurant");
      return;
    }

    if (!locationName.trim()) {
      Alert.alert("Name Required", "Please enter a location name");
      return;
    }

    // Photo is mandatory
    if (images.length === 0) {
      Alert.alert("Photo Required", "Please add at least one photo of this place");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const userName = user.profile?.name || "Anonymous User";
      
      // Upload the first image to Supabase storage
      let uploadedImageUrl: string | undefined;
      
      if (images.length > 0) {
        const imageUri = images[0];
        console.log("[AddLandmark] Uploading image:", imageUri.substring(0, 50) + "...");
        
        try {
          uploadedImageUrl = await uploadImage(imageUri);
          console.log("[AddLandmark] Image uploaded successfully:", uploadedImageUrl);
        } catch (uploadError: any) {
          console.error("[AddLandmark] Image upload failed:", uploadError);
          Alert.alert(
            "Upload Failed", 
            "Failed to upload your photo. Please try again."
          );
          setIsSubmitting(false);
          return;
        }
      }
      
      // Use Supabase-based landmark creation with uploaded image URL
      const landmark = await createLandmark(
        {
          name: locationName,
          description: note.trim() || `A ${selectedType === 'restaurant' ? 'great place to eat' : 'unique spot'} worth visiting.`,
          coordinates: coordinates,
          imageUrl: uploadedImageUrl,
          type: selectedType,
        },
        user.id,
        userName
      );
      
      console.log("[AddLandmark] Landmark saved via Supabase:", landmark.id);
      onAdd(landmark);
      resetForm();
      onClose();
      Alert.alert("Success", "Your landmark is now visible to all users!");
    } catch (error: any) {
      console.error("[AddLandmark] Error saving landmark:", error);
      
      let errorMessage = "Failed to add landmark. Please try again.";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        {!selectedType ? (
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Add Landmark</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeSelection}>
              <Text style={styles.sectionTitle}>What type of landmark?</Text>

              <TouchableOpacity
                style={styles.typeCard}
                onPress={() => {
                  console.log('[AddLandmark] Selected type: unique');
                  handleTypeSelect("unique");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIcon, { backgroundColor: "#10B981" }]}>
                  <MapPin size={28} color="#fff" />
                </View>
                <Text style={styles.typeTitle}>Unique Place</Text>
                <Text style={styles.typeDescription}>
                  A hidden gem or unique spot worth visiting
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.typeCard}
                onPress={() => {
                  console.log('[AddLandmark] Selected type: restaurant');
                  handleTypeSelect("restaurant");
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.typeIcon, { backgroundColor: "#F59E0B" }]}>
                  <MapPin size={28} color="#fff" />
                </View>
                <Text style={styles.typeTitle}>Restaurant</Text>
                <Text style={styles.typeDescription}>
                  A great place to eat or drink
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
        <KeyboardAvoidingView 
          style={[styles.modalContent, styles.modalContentTall]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => {
                Keyboard.dismiss();
                setSelectedType(null);
              }}>
                <Text style={styles.backButton}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={() => {
                Keyboard.dismiss();
                handleClose();
              }}>
                <X size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>

          <ScrollView 
            style={styles.scrollView} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollViewContent}
          >
            <View style={styles.formContainer}>
              <View
                style={[
                  styles.typeBadge,
                  {
                    backgroundColor:
                      selectedType === "restaurant" ? "#FEF3C7" : "#D1FAE5",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    {
                      color: selectedType === "restaurant" ? "#D97706" : "#059669",
                    },
                  ]}
                >
                  {selectedType === "restaurant" ? "RESTAURANT" : "UNIQUE PLACE"}
                </Text>
              </View>

              <Text style={styles.label}>Location Name</Text>
              {isLoadingLocation ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.primary} />
                  <Text style={styles.loadingText}>Fetching location...</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Enter location name"
                  placeholderTextColor={Colors.light.textSecondary}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              )}

              <Text style={styles.label}>Why is it interesting?</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="Share why this place is special..."
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              <Text style={styles.label}>Photo <Text style={styles.requiredStar}>*</Text></Text>
              <TouchableOpacity
                style={[styles.imageButton, images.length === 0 && styles.imageButtonRequired]}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <Camera size={20} color={images.length > 0 ? Colors.light.primary : "#FF3B30"} />
                <Text style={[styles.imageButtonText, images.length === 0 && styles.imageButtonTextRequired]}>
                  {images.length > 0 ? `${images.length} photo(s) added ✓` : "Add Photo (Required)"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSubmit();
                }}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Landmark</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        )}
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
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalContentTall: {
    maxHeight: "92%",
    flex: 1,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  backButton: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: "600" as const,
  },
  typeSelection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  typeCard: {
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  typeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  typeDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === "ios" ? 20 : 100,
  },
  formContainer: {
    padding: 20,
    gap: 20,
  },
  typeBadge: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: -12,
  },
  input: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  loadingContainer: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  imageButton: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: "dashed",
  },
  imageButtonRequired: {
    borderColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
  },
  imageButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.primary,
  },
  imageButtonTextRequired: {
    color: "#FF3B30",
  },
  requiredStar: {
    color: "#FF3B30",
    fontWeight: "700" as const,
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  formModal: {
    flex: 1,
  },
});
