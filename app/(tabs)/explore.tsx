import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Platform,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { Plus, MapPin, Utensils, Sparkles } from "lucide-react-native";

import Colors from "@/constants/colors";
import { MapLandmark } from "@/types";
import { trpc } from "@/lib/trpc";
import LandmarkDetailModal from "@/components/LandmarkDetailModal";
import AddLandmarkModal from "@/components/AddLandmarkModal";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_HEIGHT = SCREEN_HEIGHT * 0.75;
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

type LocationTab = "touristic" | "restaurant" | "unique";

export default function ExploreScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<MapLandmark[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<MapLandmark | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [hasInitialLoad, setHasInitialLoad] = useState<boolean>(false);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [queryInput, setQueryInput] = useState<{ latitude: number; longitude: number; radius: number } | null>(null);
  const [activeTab, setActiveTab] = useState<LocationTab>("touristic");
  
  const sheetY = useRef(new Animated.Value(MAP_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newY = MAP_HEIGHT + gestureState.dy;
        const minY = SCREEN_HEIGHT - SHEET_MAX_HEIGHT;
        const maxY = MAP_HEIGHT;
        
        if (newY >= minY && newY <= maxY) {
          sheetY.setValue(newY);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = SCREEN_HEIGHT * 0.1;
        
        if (gestureState.dy < -threshold) {
          Animated.spring(sheetY, {
            toValue: SCREEN_HEIGHT - SHEET_MAX_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        } else if (gestureState.dy > threshold) {
          Animated.spring(sheetY, {
            toValue: MAP_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        } else {
          Animated.spring(sheetY, {
            toValue: MAP_HEIGHT,
            useNativeDriver: false,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const globalLandmarksQuery = trpc.landmarks.getAll.useQuery(
    {
      latitude: location?.coords.latitude,
      longitude: location?.coords.longitude,
      radius: 50,
    },
    {
      enabled: !!location,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 0,
      retryDelay: 0,
    }
  );
  
  const discoverLandmarksQuery = trpc.landmarks.discover.useQuery(
    queryInput!,
    {
      enabled: !!queryInput,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 0,
      retryDelay: 0,
    }
  );

  useEffect(() => {
    if (globalLandmarksQuery.data) {
      console.log("[Explore] Global landmarks loaded:", globalLandmarksQuery.data.landmarks?.length || 0);
      setLandmarks(globalLandmarksQuery.data.landmarks || []);
      setHasInitialLoad(true);
    }
  }, [globalLandmarksQuery.data]);
  
  useEffect(() => {
    if (globalLandmarksQuery.error) {
      console.log("[Explore] Global landmarks query error (suppressed):", globalLandmarksQuery.error.message);
      setHasInitialLoad(true);
    }
  }, [globalLandmarksQuery.error]);
  
  useEffect(() => {
    if (discoverLandmarksQuery.data) {
      console.log("[Explore] Landmarks discovered:", discoverLandmarksQuery.data.landmarks?.length || 0);
      const rawLandmarks = discoverLandmarksQuery.data.landmarks || [];
      const discoveredLandmarks = rawLandmarks.map((landmark: any) => ({
        ...landmark,
        createdBy: "ai-generated",
        createdByName: "AI Generated",
        upvotes: 0,
        upvotedBy: [],
        reviews: [],
      }));
      setLandmarks(discoveredLandmarks);
      setHasInitialLoad(true);
      setIsDiscovering(false);
    }
  }, [discoverLandmarksQuery.data]);

  useEffect(() => {
    if (discoverLandmarksQuery.error) {
      console.error("[Explore] Failed to discover landmarks:", discoverLandmarksQuery.error);
      const errorMessage = discoverLandmarksQuery.error.message || "Failed to discover landmarks. Please try again.";
      
      if (!errorMessage.includes("Backend") && 
          !errorMessage.includes("unavailable") && 
          !errorMessage.includes("Network request failed")) {
        Alert.alert("Discovery Error", errorMessage);
      }
      
      setLandmarks([]);
      setHasInitialLoad(true);
      setIsDiscovering(false);
    }
  }, [discoverLandmarksQuery.error]);

  useEffect(() => {
    getLocationAsync();
  }, []);

  useEffect(() => {
    if (location && !hasInitialLoad) {
      console.log("[Explore] Fetching landmarks for current location");
      setIsDiscovering(true);
      setQueryInput({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius: 2,
      });
    }
  }, [location, hasInitialLoad]);



  const getLocationAsync = async () => {
    console.log("[Explore] Requesting location...");

    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) {
          setLocationError("Geolocation is not supported");
          setIsLoadingLocation(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            console.log("[Explore] Web location obtained:", { latitude, longitude });

            setLocation({
              coords: {
                latitude,
                longitude,
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
            console.error("[Explore] Web geolocation error:", error);
            setLocationError("Failed to get location");
            setIsLoadingLocation(false);
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log("[Explore] Permission status:", status);

        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required to show the map."
          );
          setLocationError("Location permission denied");
          setIsLoadingLocation(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 1,
        });

        console.log("[Explore] Native location obtained:", currentLocation.coords);
        setLocation(currentLocation);
        setIsLoadingLocation(false);
      }
    } catch (error) {
      console.error("[Explore] Error getting location:", error);
      setLocationError("Failed to get location");
      setIsLoadingLocation(false);
    }
  };

  const handleMarkerPress = (landmark: MapLandmark) => {
    console.log("[Explore] Landmark selected:", landmark.name);
    setSelectedLandmark(landmark);
    setIsModalVisible(true);
  };



  const handleAddLandmark = (landmark: MapLandmark) => {
    console.log("[Explore] Adding user landmark:", landmark);
    setLandmarks([...landmarks, landmark]);
    globalLandmarksQuery.refetch();
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

  const filteredLandmarks = landmarks.filter(landmark => {
    if (activeTab === "touristic") {
      return landmark.type === "touristic";
    } else if (activeTab === "restaurant") {
      return landmark.type === "restaurant";
    } else if (activeTab === "unique") {
      return landmark.type === "unique";
    }
    return true;
  });

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



  if (isLoadingLocation) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  if (locationError || !location) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {locationError || "Unable to load location"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.mapContainer, { height: MAP_HEIGHT }]}>
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
          showsCompass={true}
          showsScale={true}
        >
          {landmarks.map((landmark) => (
            <Marker
              key={landmark.id}
              coordinate={{
                latitude: landmark.coordinates.latitude,
                longitude: landmark.coordinates.longitude,
              }}
              title={landmark.name}
              description={landmark.description}
              onPress={() => handleMarkerPress(landmark)}
              pinColor={getMarkerColor(landmark.type)}
            />
          ))}
        </MapView>

        {isDiscovering && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <Text style={styles.loadingOverlayText}>
                Discovering landmarks...
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.bottomSheet,
          {
            top: sheetY,
          },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.sheetHandle}>
          <View style={styles.handleBar} />
        </View>

        <View style={styles.sheetContent}>
          <View style={styles.tabsContainer}>
            {(["touristic", "restaurant", "unique"] as LocationTab[]).map((tab) => {
              const Icon = getTabIcon(tab);
              const isActive = activeTab === tab;
              const color = getTabColor(tab);
              
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    isActive && { backgroundColor: color, borderColor: color },
                  ]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Icon size={18} color={isActive ? "#fff" : color} />
                  <Text style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}>
                    {getTabLabel(tab)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.locationsList}
            showsVerticalScrollIndicator={false}
          >
            {filteredLandmarks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No landmarks nearby
                </Text>
                <Text style={styles.emptySubtext}>
                  Pull down the map to refresh or add your own landmarks
                </Text>
              </View>
            ) : (
              filteredLandmarks.map((landmark) => (
                <TouchableOpacity
                  key={landmark.id}
                  style={styles.locationCard}
                  onPress={() => handleMarkerPress(landmark)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.locationIcon,
                    { backgroundColor: `${Colors.light.primary}20` },
                  ]}>
                    <MapPin size={20} color={Colors.light.primary} />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName} numberOfLines={1}>
                      {landmark.name}
                    </Text>
                    <Text style={styles.locationDescription} numberOfLines={2}>
                      {landmark.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Animated.View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  mapContainer: {
    width: "100%",
    position: "relative" as const,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: "600" as const,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.background,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },

  loadingOverlay: {
    position: "absolute" as const,
    top: 60,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingOverlayText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "600" as const,
  },

  addButton: {
    position: "absolute" as const,
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheet: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabsContainer: {
    flexDirection: "row" as const,
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  tabTextActive: {
    color: "#fff",
  },
  locationsList: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "600" as const,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  locationCard: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  locationDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
});
