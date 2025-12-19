import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Platform,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { Plus, MapPin, Utensils, Sparkles, ChevronsUp, User as UserIcon, Globe } from "lucide-react-native";

import Colors from "@/constants/colors";
import { MapLandmark } from "@/types";
import { trpc } from "@/lib/trpc";
import LandmarkDetailModal from "@/components/LandmarkDetailModal";
import AddLandmarkModal from "@/components/AddLandmarkModal";
import { useUser } from "@/contexts/UserContext";

type LocationTab = "touristic" | "restaurant" | "unique";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOTTOM_SHEET_MIN_HEIGHT = 280;
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.7;

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
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
}

export default function ExploreScreen() {
  const { user } = useUser();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [landmarks, setLandmarks] = useState<(MapLandmark & { distance?: number })[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<MapLandmark | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<LocationTab>("touristic");
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  
  const bottomSheetHeight = useRef(new Animated.Value(BOTTOM_SHEET_MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const discoverQuery = trpc.landmarks.discover.useQuery(
    {
      latitude: location?.coords.latitude || 0,
      longitude: location?.coords.longitude || 0,
      radius: 5000,
      type: activeTab,
    },
    {
      enabled: !!location,
      retry: 1,
    }
  );

  useEffect(() => {
    if (discoverQuery.data?.landmarks && location) {
      console.log("[Explore] Loaded", discoverQuery.data.landmarks.length, "landmarks");
      
      const landmarksWithDistance = (discoverQuery.data.landmarks as MapLandmark[]).map((landmark) => ({
        ...landmark,
        distance: calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          landmark.coordinates.latitude,
          landmark.coordinates.longitude
        ),
      }));
      
      const sorted = landmarksWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      setLandmarks(sorted);
    }
  }, [discoverQuery.data, location]);

  useEffect(() => {
    if (discoverQuery.isError) {
      console.error("[Explore] Error:", discoverQuery.error);
    }
  }, [discoverQuery.isError, discoverQuery.error]);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    console.log("[Explore] Getting location...");
    
    try {
      if (Platform.OS === "web") {
        navigator.geolocation?.getCurrentPosition(
          (position) => {
            setLocation({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            });
            setIsLoadingLocation(false);
          },
          (error) => {
            console.error("[Explore] Location error:", error);
            setIsLoadingLocation(false);
          }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== "granted") {
          Alert.alert("Permission Required", "Location access is needed");
          setIsLoadingLocation(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        setIsLoadingLocation(false);
      }
    } catch (error) {
      console.error("[Explore] Error:", error);
      setIsLoadingLocation(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0 && !isExpanded) {
          const newHeight = Math.min(
            BOTTOM_SHEET_MIN_HEIGHT - gestureState.dy,
            BOTTOM_SHEET_MAX_HEIGHT
          );
          bottomSheetHeight.setValue(newHeight);
        } else if (gestureState.dy > 0 && isExpanded) {
          const newHeight = Math.max(
            BOTTOM_SHEET_MAX_HEIGHT + gestureState.dy,
            BOTTOM_SHEET_MIN_HEIGHT
          );
          bottomSheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50 && !isExpanded) {
          setIsExpanded(true);
          Animated.spring(bottomSheetHeight, {
            toValue: BOTTOM_SHEET_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        } else if (gestureState.dy > 50 && isExpanded) {
          setIsExpanded(false);
          Animated.spring(bottomSheetHeight, {
            toValue: BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        } else {
          Animated.spring(bottomSheetHeight, {
            toValue: isExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleMarkerPress = (landmark: MapLandmark) => {
    console.log("[Explore] Landmark selected:", landmark.name);
    setSelectedLandmark(landmark);
    setIsModalVisible(true);
  };

  const toggleBottomSheet = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    Animated.spring(bottomSheetHeight, {
      toValue: newExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleAddLandmark = (landmark: MapLandmark) => {
    setLandmarks([...landmarks, landmark]);
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case "touristic":
        return Colors.light.primary;
      case "restaurant":
        return "#F59E0B";
      case "unique":
        return "#10B981";
      default:
        return Colors.light.primary;
    }
  };

  const getTabIcon = (tab: LocationTab) => {
    switch (tab) {
      case "touristic":
        return MapPin;
      case "restaurant":
        return Utensils;
      case "unique":
        return Sparkles;
    }
  };

  const getTabColor = (tab: LocationTab) => {
    switch (tab) {
      case "touristic":
        return Colors.light.primary;
      case "restaurant":
        return "#F59E0B";
      case "unique":
        return "#10B981";
    }
  };

  const getTabLabel = (tab: LocationTab) => {
    switch (tab) {
      case "touristic":
        return "Tourist Sites";
      case "restaurant":
        return "Restaurants";
      case "unique":
        return "Hidden Gems";
    }
  };

  if (isLoadingLocation || !location) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {landmarks.map((landmark) => (
          <Marker
            key={landmark.id}
            coordinate={{
              latitude: landmark.coordinates.latitude,
              longitude: landmark.coordinates.longitude,
            }}
            title={landmark.name}
            onPress={() => handleMarkerPress(landmark)}
            pinColor={getMarkerColor(landmark.type)}
          />
        ))}
      </MapView>

      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>📖</Text>
          <Text style={styles.logoText}>SoloBuddy</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.8}
        >
          {user.profile?.profilePictureUrl ? (
            <Image 
              source={{ uri: user.profile.profilePictureUrl }} 
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <UserIcon size={24} color={Colors.light.primary} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {discoverQuery.isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {discoverQuery.isError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>
            {discoverQuery.error?.message || "Failed to load"}
          </Text>
          <TouchableOpacity onPress={() => discoverQuery.refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
        <View {...panResponder.panHandlers} style={styles.handle}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.tabs}>
          {(["touristic", "restaurant", "unique"] as LocationTab[]).map((tab) => {
            const Icon = getTabIcon(tab);
            const active = activeTab === tab;
            const color = getTabColor(tab);
            
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, active && { backgroundColor: color }]}
                onPress={() => setActiveTab(tab)}
              >
                <Icon size={16} color={active ? "#fff" : color} />
                <Text style={[styles.tabText, active && { color: "#fff" }]}>
                  {getTabLabel(tab)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          onPress={toggleBottomSheet}
          style={styles.expandButton}
          activeOpacity={0.7}
        >
          <ChevronsUp 
            size={20} 
            color={Colors.light.textSecondary}
            style={{
              transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
            }}
          />
          <Text style={styles.expandText}>
            {isExpanded ? "Show Less" : "Show All"}
          </Text>
        </TouchableOpacity>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {landmarks.length === 0 && !discoverQuery.isLoading ? (
            <Text style={styles.emptyText}>No landmarks found</Text>
          ) : (
            landmarks.map((landmark) => (
              <TouchableOpacity
                key={landmark.id}
                style={styles.card}
                onPress={() => handleMarkerPress(landmark)}
              >
                <View style={styles.cardIcon}>
                  <MapPin size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {landmark.name}
                    </Text>
                    <Text style={styles.cardDistance}>
                      {formatDistance(landmark.distance || 0)}
                    </Text>
                  </View>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {landmark.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </Animated.View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsAddModalVisible(true)}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <LandmarkDetailModal
        landmark={selectedLandmark}
        userLocation={
          location
            ? {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }
            : null
        }
        visible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setSelectedLandmark(null);
        }}
      />

      {location && (
        <AddLandmarkModal
          visible={isAddModalVisible}
          onClose={() => setIsAddModalVisible(false)}
          onAdd={handleAddLandmark}
          coordinates={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
        />
      )}

      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.profileModalContainer}>
          <View style={styles.profileModalHeader}>
            <Text style={styles.profileModalTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.profileModalContent}>
            <View style={styles.profileModalAvatar}>
              {user.profile?.profilePictureUrl ? (
                <Image 
                  source={{ uri: user.profile.profilePictureUrl }} 
                  style={styles.profileModalImage}
                />
              ) : (
                <View style={styles.profileModalPlaceholder}>
                  <UserIcon size={48} color={Colors.light.textSecondary} />
                </View>
              )}
            </View>
            
            {user.profile?.name && (
              <>
                <Text style={styles.profileModalName}>{user.profile.name}</Text>
                {user.profile.bio && (
                  <Text style={styles.profileModalBio}>{user.profile.bio}</Text>
                )}
                {user.profile.currentCity && (
                  <View style={styles.profileModalInfo}>
                    <MapPin size={16} color={Colors.light.textSecondary} />
                    <Text style={styles.profileModalInfoText}>{user.profile.currentCity}</Text>
                  </View>
                )}
                {user.profile.countriesVisited && user.profile.countriesVisited.length > 0 && (
                  <View style={styles.profileModalCountries}>
                    <View style={styles.profileModalInfo}>
                      <Globe size={16} color={Colors.light.textSecondary} />
                      <Text style={styles.profileModalInfoText}>
                        {user.profile.countriesVisited.length} {user.profile.countriesVisited.length === 1 ? 'Country' : 'Countries'} Visited
                      </Text>
                    </View>
                    <View style={styles.countriesList}>
                      {user.profile.countriesVisited.map((country: string, index: number) => (
                        <View key={index} style={styles.countryChip}>
                          <Text style={styles.countryChipText}>{country}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
            
            {!user.profile?.name && (
              <View style={styles.noProfileContainer}>
                <Text style={styles.noProfileText}>No profile information yet</Text>
                <Text style={styles.noProfileSubtext}>Visit the Account tab to set up your profile</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  header: {
    position: "absolute" as const,
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoContainer: {
    flexDirection: "row" as const,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoIcon: {
    fontSize: 20,
  },
  logoText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  profileImage: {
    width: 48,
    height: 48,
  },
  profilePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  profileModalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginTop: Platform.OS === "ios" ? 50 : 20,
  },
  profileModalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  closeButton: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.primary,
  },
  profileModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  profileModalAvatar: {
    alignItems: "center",
    marginBottom: 24,
  },
  profileModalImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileModalPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileModalName: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  profileModalBio: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  profileModalInfo: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    justifyContent: "center",
  },
  profileModalInfoText: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
  },
  profileModalCountries: {
    marginTop: 12,
  },
  countriesList: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
  countryChip: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  countryChipText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  noProfileContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noProfileText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  noProfileSubtext: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute" as const,
    top: 60,
    alignSelf: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row" as const,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  errorOverlay: {
    position: "absolute" as const,
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  addButton: {
    position: "absolute" as const,
    bottom: 300,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheet: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 2,
  },
  expandButton: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  expandText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
  },
  tabs: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    textAlign: "center",
    color: Colors.light.textSecondary,
    marginTop: 20,
  },
  card: {
    flexDirection: "row" as const,
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardIcon: {
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  cardDistance: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.light.primary,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
