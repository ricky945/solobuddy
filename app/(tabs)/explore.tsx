import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Bell, Globe, MapPin, Plus, Sparkles, User as UserIcon } from "lucide-react-native";

import Colors from "@/constants/colors";
import type { LandmarkReview, MapLandmark } from "@/types";
import { discoverLandmarks, DiscoveredLandmark } from "@/lib/supabase-functions";
import { getAllLandmarks } from "@/lib/supabase-landmarks";
import LandmarkDetailModal from "@/components/LandmarkDetailModal";
import AddLandmarkModal from "@/components/AddLandmarkModal";
import { useUser } from "@/contexts/UserContext";
import { useQuery } from "@tanstack/react-query";

type ExploreTab = "touristic" | "unique";

type LocationState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; coords: { latitude: number; longitude: number } };

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MIN_HEIGHT = 260;
const SHEET_MAX_HEIGHT = Math.min(560, Math.max(420, SCREEN_HEIGHT * 0.65));

function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 0.1) return `${Math.round(miles * 5280)}ft`; // Convert to feet if less than 0.1 miles
  return `${miles.toFixed(1)}mi`;
}

function formatNotificationTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getErrorMessage(e: unknown): string {
  if (!e) return "Something went wrong";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "Something went wrong";
  const msg = (e as { message?: unknown })?.message;
  if (typeof msg === "string") return msg;
  return "Something went wrong";
}

function isValidCoordinate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

type ExploreItem = MapLandmark & { distanceMiles: number };

export default function ExploreScreen() {
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<ExploreTab>("touristic");
  const [selectedLandmark, setSelectedLandmark] = useState<MapLandmark | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState<boolean>(false);
  const [isAddVisible, setIsAddVisible] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  const [locationState, setLocationState] = useState<LocationState>({ status: "loading" });

  const mapRef = useRef<MapView | null>(null);
  const didSetInitialRegion = useRef<boolean>(false);

  const sheetHeight = useRef(new Animated.Value(SHEET_MIN_HEIGHT)).current;
  const [sheetExpanded, setSheetExpanded] = useState<boolean>(false);

  const coords = locationState.status === "ready" ? locationState.coords : null;

  const getLocation = useCallback(async () => {
    console.log("[Explore] getLocation start", { platform: Platform.OS });
    setLocationState({ status: "loading" });

    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation?.getCurrentPosition) {
          setLocationState({
            status: "error",
            message: "Location is not supported in this browser.",
          });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            console.log("[Explore] web geolocation ok", { lat, lng });
            if (!isValidLatLng(lat, lng)) {
              setLocationState({ status: "error", message: "Invalid location received." });
              return;
            }
            setLocationState({ status: "ready", coords: { latitude: lat, longitude: lng } });
          },
          (err) => {
            console.error("[Explore] web geolocation error", err);
            setLocationState({
              status: "error",
              message: "Couldn’t get your location. Please allow location access and try again.",
            });
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );

        return;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      console.log("[Explore] native hasServicesEnabledAsync", { enabled });
      if (!enabled) {
        setLocationState({ status: "error", message: "Location Services are turned off." });
        return;
      }

      const perm = await Location.requestForegroundPermissionsAsync();
      console.log("[Explore] native location permission", { status: perm.status });
      if (perm.status !== "granted") {
        setLocationState({ status: "error", message: "Location permission was denied." });
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        });
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        console.log("[Explore] native getCurrentPositionAsync ok", { lat, lng });
        if (!isValidLatLng(lat, lng)) {
          setLocationState({ status: "error", message: "Invalid location received." });
          return;
        }
        setLocationState({ status: "ready", coords: { latitude: lat, longitude: lng } });
        return;
      } catch (e) {
        console.error("[Explore] native getCurrentPositionAsync failed", e);
      }

      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 2000 });
      if (lastKnown) {
        const lat = lastKnown.coords.latitude;
        const lng = lastKnown.coords.longitude;
        console.log("[Explore] native last known ok", { lat, lng });
        if (!isValidLatLng(lat, lng)) {
          setLocationState({ status: "error", message: "Invalid location received." });
          return;
        }
        setLocationState({ status: "ready", coords: { latitude: lat, longitude: lng } });
        return;
      }

      setLocationState({
        status: "error",
        message: "Couldn’t get your location. Please try again.",
      });
    } catch (e) {
      console.error("[Explore] getLocation fatal", e);
      setLocationState({ status: "error", message: "Couldn’t get your location. Please try again." });
    }
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  const lastFetchKeyRef = useRef<string>("");

  // Use Supabase Edge Function for touristic landmarks discovery
  const touristicQuery = useQuery({
    queryKey: ['landmarks', 'discover', 'touristic', coords?.latitude, coords?.longitude],
    queryFn: async () => {
      if (!coords) return { landmarks: [] as DiscoveredLandmark[], location: coords, source: 'google_places' as const };
      console.log('[Explore] Fetching touristic landmarks via Supabase...');
      return discoverLandmarks({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: 5000,
        type: 'touristic',
      });
    },
    enabled: false,
    retry: false, // Don't retry on failure - function handles gracefully
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 mins
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Use Supabase for user-created landmarks
  const allQuery = useQuery({
    queryKey: ['landmarks', 'all', coords?.latitude, coords?.longitude],
    queryFn: async () => {
      console.log('[Explore] Fetching user landmarks via Supabase...');
      return getAllLandmarks({
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        radius: 25,
      });
    },
    enabled: false,
    retry: false, // Don't retry on failure
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 mins
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const activeQuery = activeTab === "touristic" ? touristicQuery : allQuery;

  const canAutoFetch = useMemo(() => {
    return !!coords;
  }, [coords]);

  const triggerFetch = useCallback(
    async (reason: string) => {
      if (!coords) return;

      const fetchKey = `${activeTab}:${coords.latitude.toFixed(5)}:${coords.longitude.toFixed(5)}`;
      if (fetchKey === lastFetchKeyRef.current && activeQuery.data) {
        console.log("[Explore] triggerFetch skipped (same key + has data)", { reason, fetchKey });
        return;
      }

      if (!canAutoFetch) {
        console.log("[Explore] triggerFetch blocked - no coords");
        return;
      }

      lastFetchKeyRef.current = fetchKey;
      console.log("[Explore] triggerFetch", { reason, fetchKey, tab: activeTab });

      try {
        if (activeTab === "touristic") {
          await touristicQuery.refetch();
        } else {
          await allQuery.refetch();
        }
      } catch (e) {
        console.error("[Explore] triggerFetch refetch threw", e);
      }
    },
    [activeQuery.data, activeTab, allQuery, canAutoFetch, coords, touristicQuery]
  );

  // Trigger fetch when tab or location changes - only once per combination
  const coordsKey = coords ? `${coords.latitude.toFixed(5)}:${coords.longitude.toFixed(5)}` : null;
  const fetchTriggerRef = useRef<string>("");
  
  useEffect(() => {
    if (!coords || !coordsKey) return;
    
    const newKey = `${activeTab}:${coordsKey}`;
    if (fetchTriggerRef.current === newKey) {
      return; // Already fetched for this combination
    }
    
    fetchTriggerRef.current = newKey;
    triggerFetch("initial/tab/location");
  }, [activeTab, coordsKey, coords, triggerFetch]);

  // Log errors but don't spam - errors are now handled gracefully in the fetch function
  useEffect(() => {
    const err = activeQuery.error as any;
    if (!err) return;

    const message = String(err?.message || "");
    // Only log once, don't spam
    console.warn("[Explore] Query had an error (handled gracefully):", {
      tab: activeTab,
      message: message.substring(0, 100), // Truncate long messages
    });
  }, [activeQuery.error?.message, activeTab]);

  const items: ExploreItem[] = useMemo(() => {
    if (!coords) return [];

    const raw: MapLandmark[] =
      activeTab === "touristic"
        ? ((touristicQuery.data?.landmarks as MapLandmark[] | undefined) ?? [])
        : ((allQuery.data?.landmarks as MapLandmark[] | undefined) ?? []).filter((l) => l.type === "unique" || l.type === "restaurant");

    console.log(`[Explore] Processing ${raw.length} landmarks`);

    const mapped: ExploreItem[] = raw
      .map((l) => {
        const lat = l.coordinates?.latitude;
        const lng = l.coordinates?.longitude;
        if (!isValidCoordinate(lat) || !isValidCoordinate(lng) || !isValidLatLng(lat, lng)) {
          console.warn("[Explore] dropping landmark with invalid coords", { id: l.id, lat, lng });
          return null;
        }
        const distanceMiles = calculateDistanceMiles(coords.latitude, coords.longitude, lat, lng);
        return { ...l, distanceMiles };
      })
      .filter((x): x is ExploreItem => x !== null && Number.isFinite(x.distanceMiles));

    mapped.sort((a, b) => a.distanceMiles - b.distanceMiles);
    return mapped;
  }, [activeTab, allQuery.data?.landmarks, coords, touristicQuery.data?.landmarks]);

  const region: Region | null = useMemo(() => {
    if (!coords) return null;
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }, [coords]);

  useEffect(() => {
    if (!region) return;
    if (didSetInitialRegion.current) return;

    didSetInitialRegion.current = true;
    console.log("[Explore] initial region set", region);

    requestAnimationFrame(() => {
      try {
        mapRef.current?.animateToRegion(region, 450);
      } catch (e) {
        console.error("[Explore] animateToRegion failed", e);
      }
    });
  }, [region]);

  const openLandmark = useCallback((landmark: MapLandmark) => {
    console.log("[Explore] openLandmark", { id: landmark.id, type: landmark.type, name: landmark.name });
    setSelectedLandmark(landmark);
    setIsDetailVisible(true);
  }, []);

  const markerColor = useCallback((type: MapLandmark["type"]) => {
    if (type === "unique") return "#10B981";
    if (type === "restaurant") return "#F59E0B";
    return Colors.light.primary;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const base = sheetExpanded ? SHEET_MAX_HEIGHT : SHEET_MIN_HEIGHT;
        const next = Math.max(SHEET_MIN_HEIGHT, Math.min(SHEET_MAX_HEIGHT, base - g.dy));
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const shouldExpand = g.dy < -40;
        const shouldCollapse = g.dy > 40;

        const nextExpanded = shouldExpand ? true : shouldCollapse ? false : sheetExpanded;
        setSheetExpanded(nextExpanded);
        Animated.spring(sheetHeight, {
          toValue: nextExpanded ? SHEET_MAX_HEIGHT : SHEET_MIN_HEIGHT,
          useNativeDriver: false,
          tension: 50,
          friction: 9,
        }).start();
      },
    })
  ).current;

  const renderItem: ListRenderItem<ExploreItem> = useCallback(
    ({ item }) => {
      if (activeTab === "touristic") {
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openLandmark(item)}
            activeOpacity={0.85}
            testID={`explore-touristic-card-${item.id}`}
          >
            <View style={styles.cardIcon}>
              <MapPin size={20} color={Colors.light.primary} />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardDistance}>{formatDistance(item.distanceKm)}</Text>
              </View>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      const thumbnailUrl =
        item.userImages?.[0] ||
        item.imageUrl ||
        `https://source.unsplash.com/300x300/?hidden%20gem,${encodeURIComponent(item.name)}`;

      const reviews = item.reviews ?? [];
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / Math.max(1, reviews.length)
          : 0;

      const ratingText =
        reviews.length > 0
          ? `${avgRating.toFixed(1)} • ${reviews.length} review${reviews.length === 1 ? "" : "s"}`
          : "No reviews yet";

      return (
        <TouchableOpacity
          style={styles.gemCard}
          onPress={() => openLandmark(item)}
          activeOpacity={0.9}
          testID={`explore-unique-card-${item.id}`}
        >
          <View style={styles.gemThumbWrap}>
            <Image source={{ uri: thumbnailUrl }} style={styles.gemThumb} />
          </View>

          <View style={styles.gemBody}>
            <View style={styles.gemTopRow}>
              <Text style={styles.gemTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.gemDistance}>{formatDistance(item.distanceMiles)}</Text>
            </View>

            {/* Type Label */}
            <View style={[
              styles.gemTypeBadge,
              item.type === "restaurant" ? styles.gemTypeBadgeRestaurant : styles.gemTypeBadgeUnique
            ]}>
              <Text style={[
                styles.gemTypeBadgeText,
                item.type === "restaurant" ? styles.gemTypeBadgeTextRestaurant : styles.gemTypeBadgeTextUnique
              ]}>
                {item.type === "restaurant" ? "🍽️ Restaurant" : "💎 Hidden Gem"}
              </Text>
            </View>

            <Text style={styles.gemMeta} numberOfLines={1}>
              Suggested by {item.createdByName || "Anonymous"}
            </Text>

            <Text style={styles.gemRating}>{ratingText}</Text>

            {reviews?.[0]?.comment ? (
              <Text style={styles.gemSnippet} numberOfLines={2}>
                “{reviews[0].comment}”
              </Text>
            ) : (
              <Text style={styles.gemSnippetMuted} numberOfLines={2}>
                Tap to view details and reviews.
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [activeTab, openLandmark]
  );

  const keyExtractor = useCallback((item: ExploreItem) => item.id, []);

  const listEmpty = useMemo(() => {
    if (activeQuery.isLoading) return null;

    return (
      <View style={styles.emptyContainer} testID="explore-empty">
        <Text style={styles.emptyTitle}>{activeTab === "unique" ? "No hidden gems yet" : "No landmarks found"}</Text>
        {activeTab === "unique" ? (
          <Text style={styles.emptySubtitle}>Be the first to add something locals love.</Text>
        ) : (
          <Text style={styles.emptySubtitle}>Try moving the map or retrying.</Text>
        )}
      </View>
    );
  }, [activeQuery.isLoading, activeTab]);

  const notifications = useMemo(() => {
    const all = (items as MapLandmark[]).filter((l) => l.createdBy === user.id && (l.type === "unique" || l.type === "restaurant"));
    const result: { id: string; landmark: MapLandmark; review: LandmarkReview }[] = [];

    all.forEach((landmark) => {
      (landmark.reviews ?? []).forEach((review) => {
        if (review.userId !== user.id) {
          result.push({ id: `${landmark.id}-${review.id}`, landmark, review });
        }
      });
    });

    result.sort((a, b) => (b.review.createdAt || 0) - (a.review.createdAt || 0));
    return result;
  }, [items, user.id]);

  if (locationState.status === "loading") {
    return (
      <View style={styles.centerStateContainer} testID="explore-location-loading">
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.centerStateTitle}>Finding your location…</Text>
        <Text style={styles.centerStateSubtitle}>We use it to show nearby places.</Text>
      </View>
    );
  }

  if (locationState.status === "error") {
    return (
      <View style={styles.centerStateContainer} testID="explore-location-error">
        <Text style={styles.centerStateTitle}>We can’t access your location</Text>
        <Text style={styles.centerStateSubtitle}>{locationState.message}</Text>
        <TouchableOpacity
          onPress={getLocation}
          activeOpacity={0.85}
          style={styles.centerStateButton}
          testID="explore-location-retry"
        >
          <Text style={styles.centerStateButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="explore-screen">
      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={styles.map}
        provider={Platform.OS === "web" ? undefined : PROVIDER_DEFAULT}
        initialRegion={region ?? undefined}
        showsUserLocation={Platform.OS !== "web"}
        showsMyLocationButton={Platform.OS !== "web"}
        onMapReady={() => {
          console.log("[Explore] map ready", { hasRegion: !!region });
        }}
        onMapLoaded={() => {
          console.log("[Explore] map loaded");
        }}
        testID="explore-map"
      >
        {items.map((l) => (
          <Marker
            key={l.id}
            coordinate={{ latitude: l.coordinates.latitude, longitude: l.coordinates.longitude }}
            title={l.name}
            pinColor={markerColor(l.type)}
            onPress={() => openLandmark(l)}
            testID={`explore-marker-${l.id}`}
          />
        ))}
      </MapView>

      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/renps5x3u8toqdey782pi" }}
            style={styles.logoIcon}
          />
          <Text style={styles.logoText}>SoloBuddy</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotificationsModal(true)}
            activeOpacity={0.8}
            testID="explore-notifications-button"
          >
            <Bell size={22} color={Colors.light.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => setShowProfileModal(true)}
            activeOpacity={0.8}
            testID="explore-profile-button"
          >
            {user.profile?.profilePictureUrl ? (
              <Image source={{ uri: user.profile.profilePictureUrl }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <UserIcon size={24} color={Colors.light.primary} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {activeQuery.isLoading ? (
        <View style={styles.loadingOverlay} testID="explore-loading-overlay">
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : null}

      {activeQuery.isError ? (
        <View style={styles.errorOverlay} testID="explore-error-overlay">
          <Text style={styles.errorText}>
            {activeQuery.error?.message?.includes("401") 
              ? "API authentication error. Please check your Supabase configuration."
              : getErrorMessage(activeQuery.error)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              lastFetchKeyRef.current = ""; // Reset to allow retry
              triggerFetch("user_retry");
            }}
            style={styles.retryButton}
            testID="explore-retry"
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]} testID="explore-sheet">
        <View {...panResponder.panHandlers} style={styles.handle} testID="explore-sheet-handle">
          <View style={styles.handleBar} />
        </View>

        <View style={styles.tabs} testID="explore-tabs">
          <TouchableOpacity
            style={[styles.tab, activeTab === "touristic" && styles.tabActivePrimary]}
            onPress={() => setActiveTab("touristic")}
            activeOpacity={0.85}
            testID="explore-tab-touristic"
          >
            <MapPin size={16} color={activeTab === "touristic" ? "#fff" : Colors.light.primary} />
            <Text style={[styles.tabText, activeTab === "touristic" && styles.tabTextActive]}>Tourist Sites</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "unique" && styles.tabActiveGreen]}
            onPress={() => setActiveTab("unique")}
            activeOpacity={0.85}
            testID="explore-tab-unique"
          >
            <Sparkles size={16} color={activeTab === "unique" ? "#fff" : "#10B981"} />
            <Text style={[styles.tabText, activeTab === "unique" && styles.tabTextActive]}>Hidden Gems</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="explore-list"
        />
      </Animated.View>

      {activeTab === "unique" ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddVisible(true)}
          activeOpacity={0.9}
          testID="explore-add-hidden-gem"
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <LandmarkDetailModal
        landmark={selectedLandmark}
        userLocation={coords}
        visible={isDetailVisible}
        onClose={() => {
          setIsDetailVisible(false);
          setSelectedLandmark(null);
        }}
        onLandmarkUpdated={(updated) => {
          console.log("[Explore] onLandmarkUpdated", { id: updated.id });
          setSelectedLandmark(updated);
          if (activeTab === "unique") allQuery.refetch();
        }}
        onLandmarkDeleted={(landmarkId) => {
          console.log("[Explore] onLandmarkDeleted", { landmarkId });
          setSelectedLandmark(null);
          setIsDetailVisible(false);
          allQuery.refetch();
        }}
      />

      {coords ? (
        <AddLandmarkModal
          visible={isAddVisible}
          onClose={() => setIsAddVisible(false)}
          onAdd={() => {
            allQuery.refetch();
          }}
          coordinates={coords}
        />
      ) : null}

      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.profileModalContainer} testID="explore-profile-modal">
          <View style={styles.profileModalHeader}>
            <Text style={styles.profileModalTitle}>Profile</Text>
            <TouchableOpacity onPress={() => setShowProfileModal(false)} testID="explore-profile-close">
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileModalContent}>
            <View style={styles.profileModalAvatar}>
              {user.profile?.profilePictureUrl ? (
                <Image source={{ uri: user.profile.profilePictureUrl }} style={styles.profileModalImage} />
              ) : (
                <View style={styles.profileModalPlaceholder}>
                  <UserIcon size={48} color={Colors.light.textSecondary} />
                </View>
              )}
            </View>

            {user.profile?.name ? (
              <>
                <Text style={styles.profileModalName}>{user.profile.name}</Text>
                {user.profile.bio ? <Text style={styles.profileModalBio}>{user.profile.bio}</Text> : null}
                {user.profile.currentCity ? (
                  <View style={styles.profileModalInfo}>
                    <MapPin size={16} color={Colors.light.textSecondary} />
                    <Text style={styles.profileModalInfoText}>{user.profile.currentCity}</Text>
                  </View>
                ) : null}

                {user.profile.countriesVisited && user.profile.countriesVisited.length > 0 ? (
                  <View style={styles.profileModalCountries}>
                    <View style={styles.profileModalInfo}>
                      <Globe size={16} color={Colors.light.textSecondary} />
                      <Text style={styles.profileModalInfoText}>
                        {user.profile.countriesVisited.length} {user.profile.countriesVisited.length === 1 ? "Country" : "Countries"} Visited
                      </Text>
                    </View>
                    <View style={styles.countriesList}>
                      {user.profile.countriesVisited.map((country: string, idx: number) => (
                        <View key={`${country}-${idx}`} style={styles.countryChip}>
                          <Text style={styles.countryChipText}>{country}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.noProfileContainer}>
                <Text style={styles.noProfileText}>No profile information yet</Text>
                <Text style={styles.noProfileSubtext}>Visit the Account tab to set up your profile</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.notificationsModalContainer} testID="explore-notifications-modal">
          <View style={styles.notificationsModalHeader}>
            <Text style={styles.notificationsModalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotificationsModal(false)} testID="explore-notifications-close">
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.noNotificationsContainer} testID="explore-no-notifications">
              <View style={styles.noNotificationsIcon}>
                <Bell size={48} color={Colors.light.textSecondary} />
              </View>
              <Text style={styles.noNotificationsText}>No notifications yet</Text>
              <Text style={styles.noNotificationsSubtext}>
                You’ll see updates here when people review your hidden gems.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              contentContainerStyle={styles.notificationsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.notificationCard}
                  onPress={() => {
                    setShowNotificationsModal(false);
                    openLandmark(item.landmark);
                  }}
                  activeOpacity={0.75}
                  testID={`explore-notification-${item.id}`}
                >
                  <View style={styles.notificationIconWrap}>
                    {item.review.userAvatar ? (
                      <Image source={{ uri: item.review.userAvatar }} style={styles.notificationUserAvatar} />
                    ) : (
                      <View style={styles.notificationUserPlaceholder}>
                        <UserIcon size={20} color={Colors.light.textSecondary} />
                      </View>
                    )}
                  </View>

                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationText}>
                      <Text style={styles.notificationUserName}>{item.review.userName}</Text>
                      {" left a review on "}
                      <Text style={styles.notificationLandmarkName}>{item.landmark.name}</Text>
                    </Text>

                    {item.review.comment ? (
                      <View style={styles.notificationReviewBox}>
                        <Text style={styles.notificationRating}>★ {item.review.rating}/5</Text>
                        <Text style={styles.notificationComment} numberOfLines={2}>
                          “{item.review.comment}”
                        </Text>
                      </View>
                    ) : null}

                    <Text style={styles.notificationTime}>{formatNotificationTime(item.review.createdAt)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  centerStateContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  centerStateTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.light.text,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  centerStateSubtitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  centerStateButton: {
    marginTop: 10,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  centerStateButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700" as const,
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
  logoIcon: { width: 28, height: 28 },
  logoText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
  profileImage: { width: 48, height: 48 },
  profilePlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
  loadingText: { fontSize: 14, fontWeight: "600" as const, color: Colors.light.text },

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
  errorText: { fontSize: 14, color: Colors.light.text, marginBottom: 12, textAlign: "center" },
  retryButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },

  addButton: {
    position: "absolute" as const,
    bottom: SHEET_MIN_HEIGHT + 24,
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
  handle: { alignItems: "center", paddingVertical: 12 },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 2,
  },

  tabs: { flexDirection: "row" as const, gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  tabActivePrimary: { backgroundColor: Colors.light.primary },
  tabActiveGreen: { backgroundColor: "#10B981" },
  tabText: { fontSize: 12, fontWeight: "700" as const, color: Colors.light.text },
  tabTextActive: { color: "#fff" },

  listContent: {
    paddingBottom: 6,
  },

  emptyContainer: {
    paddingTop: 18,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.light.text,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },

  card: {
    flexDirection: "row" as const,
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    marginBottom: 10,
  },
  cardIcon: { marginTop: 2 },
  cardHeader: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
  },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.light.text,
    flex: 1,
  },
  cardDistance: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.light.primary,
  },
  cardDesc: { fontSize: 13, color: Colors.light.textSecondary },

  gemCard: {
    flexDirection: "row" as const,
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  gemThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.light.backgroundSecondary,
  },
  gemThumb: { width: 64, height: 64 },
  gemBody: { flex: 1 },
  gemTopRow: {
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  gemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800" as const,
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  gemDistance: {
    fontSize: 12,
    fontWeight: "900" as const,
    color: "#10B981",
  },
  gemTypeBadge: {
    alignSelf: "flex-start" as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  gemTypeBadgeRestaurant: {
    backgroundColor: "#FEF3C7",
  },
  gemTypeBadgeUnique: {
    backgroundColor: "#D1FAE5",
  },
  gemTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  gemTypeBadgeTextRestaurant: {
    color: "#D97706",
  },
  gemTypeBadgeTextUnique: {
    color: "#059669",
  },
  gemMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
  },
  gemRating: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "900" as const,
    color: Colors.light.text,
  },
  gemSnippet: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  gemSnippetMuted: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },

  profileModalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
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
  profileModalTitle: { fontSize: 20, fontWeight: "700" as const, color: Colors.light.text },
  closeButtonText: { fontSize: 16, fontWeight: "700" as const, color: Colors.light.primary },
  profileModalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 32 },
  profileModalAvatar: { alignItems: "center", marginBottom: 24 },
  profileModalImage: { width: 120, height: 120, borderRadius: 60 },
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
    fontWeight: "800" as const,
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
  profileModalInfoText: { fontSize: 15, color: Colors.light.textSecondary, fontWeight: "600" as const },
  profileModalCountries: { marginTop: 12 },
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
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  noProfileContainer: { alignItems: "center", paddingVertical: 40 },
  noProfileText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  noProfileSubtext: { fontSize: 15, color: Colors.light.textSecondary, textAlign: "center" },

  notificationsModalContainer: { flex: 1, backgroundColor: "#FFFFFF" },
  notificationsModalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginTop: Platform.OS === "ios" ? 50 : 20,
  },
  notificationsModalTitle: { fontSize: 20, fontWeight: "700" as const, color: Colors.light.text },
  notificationsList: { paddingTop: 8 },

  noNotificationsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  noNotificationsIcon: { marginBottom: 20, opacity: 0.3 },
  noNotificationsText: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: "center",
  },
  noNotificationsSubtext: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  notificationCard: {
    flexDirection: "row" as const,
    padding: 16,
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  notificationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  notificationUserAvatar: { width: 44, height: 44 },
  notificationUserPlaceholder: {
    width: 44,
    height: 44,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: { flex: 1 },
  notificationText: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationUserName: { fontWeight: "800" as const, color: Colors.light.text },
  notificationLandmarkName: { fontWeight: "800" as const, color: Colors.light.primary },
  notificationReviewBox: {
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  notificationRating: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: "#F59E0B",
    marginBottom: 4,
  },
  notificationComment: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    fontStyle: "italic" as const,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "600" as const,
  },
});
