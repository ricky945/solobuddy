import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Sparkles, MapPin, Clock, ArrowRight } from "lucide-react-native";

import Colors from "@/constants/colors";
import { useTours } from "@/contexts/ToursContext";
import type { Landmark } from "@/types";

function getLandmarkImageUrl(name: string, location: string | undefined) {
  const q = encodeURIComponent(`${name} ${location ?? ""} landmark`);
  return `https://source.unsplash.com/800x800/?${q}`;
}

export default function TourReadyScreen() {
  const router = useRouter();
  const { tourId } = useLocalSearchParams();
  const { getTourById } = useTours();

  const tour = useMemo(() => getTourById(String(tourId ?? "")), [getTourById, tourId]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const landmarks = useMemo<Landmark[]>(() => tour?.landmarks ?? [], [tour?.landmarks]);
  const stopsCount = landmarks.length;

  const itemAnims = useRef<Animated.Value[]>([]);
  if (itemAnims.current.length !== landmarks.length) {
    itemAnims.current = landmarks.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 46,
        useNativeDriver: true,
      }),
    ]).start();

    const items = itemAnims.current;
    Animated.stagger(
      90,
      items.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [fadeAnim, slideAnim, landmarks.length]);

  const onStart = useCallback(() => {
    console.log("[TourReady] Start tour", { tourId: String(tourId ?? "") });
    router.replace({
      pathname: "/walking-tour",
      params: { tourId: String(tourId ?? "") },
    } as any);
  }, [router, tourId]);

  return (
    <View style={styles.container} testID="tourReadyScreen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <ChevronLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.titleContainer}>
            <View style={styles.sparkleIcon}>
              <Sparkles size={20} color={Colors.light.primary} />
            </View>
            <Text style={styles.headline}>
              this is the tour we&apos;ve created for you
            </Text>
          </View>

          {tour?.title && (
            <Text style={styles.tourTitle}>{tour.title}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Clock size={16} color={Colors.light.textSecondary} />
              <Text style={styles.statText}>~{Math.round(stopsCount * 15)} min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <MapPin size={16} color={Colors.light.textSecondary} />
              <Text style={styles.statText}>{stopsCount} stops</Text>
            </View>
            {tour?.location && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statText}>{tour.location}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.itinerarySection}>
            <Text style={styles.sectionTitle}>Trip itinerary</Text>

            <View style={styles.timeline}>
              <View style={styles.timelineLine} />

              {landmarks.map((lm, idx) => {
                const imageUrl = getLandmarkImageUrl(lm.name, tour?.location);
                const v = itemAnims.current[idx];
                const translateY = v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                });

                return (
                  <Animated.View
                    key={lm.id}
                    style={[styles.timelineItem, { opacity: v, transform: [{ translateY }] }]}
                    testID={`tourReadyStop_${idx + 1}`}
                  >
                    <View style={styles.timelineDotContainer}>
                      <View style={styles.timelineDot}>
                        <Text style={styles.timelineNumber}>{idx + 1}</Text>
                      </View>
                    </View>

                    <View style={styles.landmarkRowCard}>
                      <View style={styles.landmarkTextCol}>
                        <Text style={styles.landmarkName} numberOfLines={1}>
                          {lm.name}
                        </Text>
                        <Text style={styles.landmarkDesc} numberOfLines={2}>
                          {lm.description}
                        </Text>
                      </View>

                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.landmarkThumb}
                        resizeMode="cover"
                      />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </Animated.View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onStart}
          activeOpacity={0.9}
        >
          <Text style={styles.startBtnText}>Start Tour</Text>
          <ArrowRight size={20} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => router.push({ pathname: "/(tabs)/library" as any } as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save for later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F8FB",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: "#F6F8FB",
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  content: {
    marginTop: 20,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sparkleIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(30, 136, 229, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.light.text,
    flex: 1,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  tourTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 26,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },
  itinerarySection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 20,
  },
  timeline: {
    position: "relative",
    paddingLeft: 20,
  },
  timelineLine: {
    position: "absolute",
    left: 14,
    top: 8,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(15, 23, 42, 0.10)",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-start",
  },
  timelineDotContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 14,
    zIndex: 1,
    backgroundColor: "#F6F8FB",
    paddingVertical: 4,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F6F8FB",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  timelineNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  landmarkRowCard: {
    flex: 1,
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  landmarkTextCol: {
    flex: 1,
    paddingRight: 2,
  },
  landmarkThumb: {
    width: Math.min(92, Math.max(80, Math.round(SCREEN_WIDTH * 0.22))),
    height: Math.min(92, Math.max(80, Math.round(SCREEN_WIDTH * 0.22))),
    borderRadius: 16,
    backgroundColor: "#EEF2F7",
  },
  landmarkName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 6,
  },
  landmarkDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  startBtn: {
    backgroundColor: Colors.light.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  saveBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  saveBtnText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
});
