import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Platform,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
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

type LocationTab = "touristic" | "restaurant" | "unique";

export default function ExploreScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [landmarks, setLandmarks] = useState<MapLandmark[]>([]);
  const [selectedLandmark, setSelectedLandmark] = useState<MapLandmark | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<LocationTab>("touristic");

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
    if (discoverQuery.data?.landmarks) {
      console.log("[Explore] Loaded", discoverQuery.data.landmarks.length, "landmarks");
      setLandmarks(discoverQuery.data.landmarks as MapLandmark[]);
    }
  }, [discoverQuery.data]);

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

  const handleMarkerPress = (landmark: MapLandmark) => {
    console.log("[Explore] Landmark selected:", landmark.name);
    setSelectedLandmark(landmark);
    setIsModalVisible(true);
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

      <View style={styles.bottomSheet}>
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

        <ScrollView style={styles.list}>
          {landmarks.length === 0 && !discoverQuery.isLoading ? (
            <Text style={styles.emptyText}>No landmarks found</Text>
          ) : (
            landmarks.map((landmark) => (
              <TouchableOpacity
                key={landmark.id}
                style={styles.card}
                onPress={() => handleMarkerPress(landmark)}
              >
                <MapPin size={20} color={Colors.light.primary} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {landmark.name}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {landmark.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

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
    bottom: 280,
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
    height: 260,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
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
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    marginBottom: 8,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
