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
import { ChevronLeft, Sparkles, MapPin, Route } from "lucide-react-native";

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

  const fadeHeader = useRef(new Animated.Value(0)).current;
  const fadeList = useRef(new Animated.Value(0)).current;
  const fadeCta = useRef(new Animated.Value(0)).current;
  const translateHeader = useRef(new Animated.Value(10)).current;
  const translateList = useRef(new Animated.Value(12)).current;
  const translateCta = useRef(new Animated.Value(14)).current;

  const itemAnimRef = useRef<Record<string, Animated.Value>>({});

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(fadeHeader, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(translateHeader, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      ]),
      Animated.parallel([
        Animated.timing(fadeList, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(translateList, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      ]),
      Animated.parallel([
        Animated.timing(fadeCta, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(translateCta, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      ]),
    ]).start();
  }, [fadeCta, fadeHeader, fadeList, translateCta, translateHeader, translateList]);

  const onStart = useCallback(() => {
    console.log("[TourReady] Start tour", { tourId: String(tourId ?? "") });
    router.replace({
      pathname: "/walking-tour" as any,
      params: { tourId: String(tourId ?? "") },
    });
  }, [router, tourId]);

  const landmarks = useMemo<Landmark[]>(() => tour?.landmarks ?? [], [tour?.landmarks]);
  const stopsCount = landmarks.length;

  useEffect(() => {
    const animations = landmarks.map((lm, idx) => {
      const existing = itemAnimRef.current[lm.id];
      const v = existing ?? new Animated.Value(0);
      itemAnimRef.current[lm.id] = v;

      v.setValue(0);
      return Animated.timing(v, {
        toValue: 1,
        duration: 360,
        delay: 120 + idx * 70,
        useNativeDriver: true,
      });
    });

    Animated.stagger(50, animations).start();
  }, [landmarks]);

  const getItemAnim = useCallback((id: string) => {
    if (!itemAnimRef.current[id]) {
      itemAnimRef.current[id] = new Animated.Value(0);
    }
    return itemAnimRef.current[id];
  }, []);

  return (
    <View style={styles.container} testID="tourReadyScreen">
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar} testID="tourReadyTopBar">
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.85}
          testID="tourReadyBack"
        >
          <ChevronLeft size={22} color={Colors.light.text} />
        </TouchableOpacity>

        <View style={styles.topMeta}>
          <View style={styles.metaPill} testID="tourReadyStopsPill">
            <Route size={14} color={Colors.light.primary} />
            <Text style={styles.metaPillText}>{stopsCount} stops</Text>
          </View>
          {!!tour?.location && (
            <View style={styles.metaPillSoft} testID="tourReadyLocationPill">
              <MapPin size={14} color={"rgba(15,20,25,0.52)"} />
              <Text style={styles.metaPillSoftText} numberOfLines={1}>
                {tour.location}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="tourReadyScroll"
      >
        <Animated.View
          style={{ opacity: fadeHeader, transform: [{ translateY: translateHeader }] }}
          testID="tourReadyHeader"
        >
          <View style={styles.kickerRow}>
            <View style={styles.kickerIcon}>
              <Sparkles size={16} color={Colors.light.primary} />
            </View>
            <Text style={styles.kickerText}>Custom itinerary</Text>
          </View>

          <Text style={styles.title} testID="tourReadyTitle">
            {"this is the tour we've created for you"}
          </Text>
          <Text style={styles.subtitle} testID="tourReadySubtitle">
            {tour?.title ? tour.title : "Your tour is ready."}
          </Text>
        </Animated.View>

        <Animated.View
          style={{ opacity: fadeList, transform: [{ translateY: translateList }] }}
          testID="tourReadyItinerary"
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trip itinerary</Text>
            <Text style={styles.sectionMeta}>{stopsCount} stops</Text>
          </View>

          <View style={styles.timelineWrap}>
            <View style={styles.timelineRail} />

            <View style={styles.timelineList}>
              {landmarks.map((lm, idx) => {
                const imageUrl = getLandmarkImageUrl(lm.name, tour?.location);
                const itemAnim = getItemAnim(lm.id);
                return (
                  <Animated.View
                    key={lm.id}
                    style={{
                      opacity: itemAnim,
                      transform: [
                        {
                          translateY: itemAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0],
                          }),
                        },
                      ],
                    }}
                    testID={`tourReadyStop_${idx}`}
                  >
                    <View style={styles.itemRow}>
                      <View style={styles.dotWrap}>
                        <View style={styles.dotOuter}>
                          <View style={styles.dotInner} />
                        </View>
                      </View>

                      <View style={styles.itemCard}>
                        <View style={styles.itemTextCol}>
                          <Text style={styles.itemTitle} numberOfLines={2}>
                            {lm.name}
                          </Text>
                          <Text style={styles.itemMeta}>
                            Stop {idx + 1} of {stopsCount}
                          </Text>
                          <Text style={styles.itemDesc} numberOfLines={2}>
                            {lm.description}
                          </Text>
                        </View>

                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.itemImage}
                          resizeMode="cover"
                          accessibilityLabel={`${lm.name} photo`}
                        />
                      </View>
                    </View>
                  </Animated.View>
                );
              })}

              {stopsCount === 0 && (
                <View style={styles.emptyCard} testID="tourReadyEmpty">
                  <Text style={styles.emptyTitle}>No stops found</Text>
                  <Text style={styles.emptyText}>
                    Try generating a walking route tour again from the Explore tab.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        <View style={styles.bottomSpacer} />

        {!tour && (
          <View style={styles.fallbackCard} testID="tourReadyFallback">
            <Text style={styles.fallbackTitle}>Tour not found</Text>
            <Text style={styles.fallbackText}>If you just created it, open Library and try again.</Text>
          </View>
        )}

        <View style={styles.bottomSafe} />
      </ScrollView>

      <Animated.View
        style={{
          opacity: fadeCta,
          transform: [{ translateY: translateCta }],
        }}
        testID="tourReadyCta"
      >
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryCta, stopsCount === 0 && styles.primaryCtaDisabled]}
            onPress={onStart}
            activeOpacity={0.92}
            disabled={stopsCount === 0}
            testID="tourReadyStart"
          >
            <Text style={styles.primaryCtaText}>Start tour</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={() => router.push("/library")}
            activeOpacity={0.92}
            testID="tourReadyLibrary"
          >
            <Text style={styles.secondaryCtaText}>Save for later</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  topBar: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,20,25,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  topMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(30, 136, 229, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(30, 136, 229, 0.16)",
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "900",
    color: Colors.light.primary,
  },
  metaPillSoft: {
    maxWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,20,25,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.08)",
  },
  metaPillSoftText: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(15,20,25,0.70)",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  kickerIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 136, 229, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(30, 136, 229, 0.14)",
  },
  kickerText: {
    fontSize: 13,
    fontWeight: "900",
    color: Colors.light.primary,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: Colors.light.text,
    textTransform: "lowercase",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.light.text,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(15,20,25,0.48)",
  },
  timelineWrap: {
    position: "relative",
    paddingLeft: 18,
  },
  timelineRail: {
    position: "absolute",
    left: 8,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: "rgba(30, 136, 229, 0.18)",
    borderRadius: 2,
  },
  timelineList: {
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dotWrap: {
    width: 24,
    alignItems: "center",
    paddingTop: 14,
  },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "rgba(30, 136, 229, 0.70)",
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
  },
  itemCard: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: Colors.light.text,
    letterSpacing: -0.2,
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(15,20,25,0.48)",
  },
  itemDesc: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  itemImage: {
    width: 86,
    height: 86,
    borderRadius: 14,
    backgroundColor: "rgba(15,20,25,0.06)",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "rgba(246,247,249,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(15,20,25,0.08)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  bottomSpacer: {
    height: 150,
  },
  primaryCta: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaDisabled: {
    opacity: 0.6,
  },
  primaryCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
    textTransform: "capitalize",
  },
  secondaryCta: {
    marginTop: 10,
    backgroundColor: "rgba(15,20,25,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.10)",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: "900",
  },
  fallbackCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "rgba(255,149,0,0.12)",
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,149,0,0.18)",
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#7A4100",
    marginBottom: 4,
  },
  fallbackText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "rgba(122,65,0,0.84)",
  },
  emptyCard: {
    borderRadius: 16,
    backgroundColor: "rgba(15,20,25,0.04)",
    borderWidth: 1,
    borderColor: "rgba(15,20,25,0.08)",
    padding: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.light.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: Colors.light.textSecondary,
  },
  bottomSafe: {
    height: 14,
  },
});
