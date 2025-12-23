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
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const onStart = useCallback(() => {
    console.log("[TourReady] Start tour", { tourId: String(tourId ?? "") });
    router.replace({
      pathname: "/walking-tour",
      params: { tourId: String(tourId ?? "") },
    } as any);
  }, [router, tourId]);

  const landmarks = useMemo<Landmark[]>(() => tour?.landmarks ?? [], [tour?.landmarks]);
  const stopsCount = landmarks.length;

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
            <Text style={styles.sectionTitle}>Trip Itinerary</Text>
            
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              
              {landmarks.map((lm, idx) => {
                const imageUrl = getLandmarkImageUrl(lm.name, tour?.location);
                return (
                  <View key={lm.id} style={styles.timelineItem}>
                    <View style={styles.timelineDotContainer}>
                      <View style={styles.timelineDot}>
                        <Text style={styles.timelineNumber}>{idx + 1}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.landmarkCard}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.landmarkImage}
                        resizeMode="cover"
                      />
                      <View style={styles.landmarkInfo}>
                        <Text style={styles.landmarkName} numberOfLines={1}>{lm.name}</Text>
                        <Text style={styles.landmarkDesc} numberOfLines={2}>
                          {lm.description}
                        </Text>
                      </View>
                    </View>
                  </View>
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
          onPress={() => router.push("/library")}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>Save for later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#fff",
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
    paddingHorizontal: 20,
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
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(30, 136, 229, 0.1)",
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
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
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
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: "#E2E8F0",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
  },
  timelineDotContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 16,
    zIndex: 1,
    backgroundColor: "#fff",
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
    borderColor: "#fff",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  timelineNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  landmarkCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  landmarkImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#F1F5F9",
  },
  landmarkInfo: {
    padding: 16,
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
