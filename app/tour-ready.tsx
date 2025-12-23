import React, { useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Footprints, MapPin } from "lucide-react-native";

import Colors from "@/constants/colors";
import { useTours } from "@/contexts/ToursContext";

export default function TourReadyScreen() {
  const router = useRouter();
  const { tourId } = useLocalSearchParams();
  const { getTourById } = useTours();

  const tour = useMemo(() => getTourById(String(tourId ?? "")), [getTourById, tourId]);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(translate, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
    ]).start();
  }, [fade, translate]);

  const onStart = () => {
    console.log("[TourReady] Start tour", { tourId: String(tourId ?? "") });
    router.replace({
      pathname: "/walking-tour" as any,
      params: { tourId: String(tourId ?? "") },
    });
  };

  const stopsCount = tour?.landmarks?.length ?? 0;

  return (
    <View style={styles.container} testID="tourReadyScreen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["#0B1220", "#0E1A33", "#FFFFFF"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.85}
          testID="tourReadyBack"
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Animated.View
          style={[
            styles.heroCard,
            {
              opacity: fade,
              transform: [{ translateY: translate }],
            },
          ]}
        >
          <View style={styles.iconRow}>
            <View style={styles.iconPill}>
              <Footprints size={18} color="#0B1220" />
              <Text style={styles.iconPillText}>Walking</Text>
            </View>
            <View style={styles.iconPillSoft}>
              <MapPin size={16} color="#EAF2FF" />
              <Text style={styles.iconPillSoftText}>{stopsCount} stops</Text>
            </View>
          </View>

          <Text style={styles.title} testID="tourReadyTitle">
            Are you ready to begin your tour?
          </Text>

          <Text style={styles.subtitle} testID="tourReadySubtitle">
            {tour?.title
              ? `Next up: ${tour.title}`
              : "Your custom walking tour is ready."}
          </Text>

          <View style={styles.primaryCtaWrap}>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={onStart}
              activeOpacity={0.9}
              testID="tourReadyStart"
            >
              <Text style={styles.primaryCtaText}>Start Tour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={() => router.push("/library")}
              activeOpacity={0.9}
              testID="tourReadyLibrary"
            >
              <Text style={styles.secondaryCtaText}>View in Library</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.footerFade} pointerEvents="none" />
      </View>

      {!tour && (
        <View style={styles.fallbackCard} testID="tourReadyFallback">
          <Text style={styles.fallbackTitle}>Tour not found</Text>
          <Text style={styles.fallbackText}>
            If you just created it, open Library and try again.
          </Text>
        </View>
      )}

      <View style={styles.bottomSafe} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  topBar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  hero: {
    flex: 1,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 26,
    padding: 20,
    overflow: "hidden",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  iconPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B1220",
  },
  iconPillSoft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  iconPillSoftText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EAF2FF",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: "#FFFFFF",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    color: "rgba(255,255,255,0.78)",
  },
  primaryCtaWrap: {
    marginTop: 18,
    gap: 10,
  },
  primaryCta: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  secondaryCta: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 15,
    fontWeight: "700",
  },
  footerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 120,
    backgroundColor: "transparent",
  },
  fallbackCard: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 24,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 16,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.light.text,
    marginBottom: 4,
  },
  fallbackText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  bottomSafe: {
    height: 14,
  },
});
