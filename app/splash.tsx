import { useRouter, useRootNavigationState } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { usePlacement } from "expo-superwall";
import { useUser } from "@/contexts/UserContext";

// Passport mascot image URL
const PASSPORT_MASCOT = "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/renps5x3u8toqdey782pi";

// TEMPORARY: Developer bypass for testing
const DEVELOPER_MODE = true; // Set to false when ready for production

export default function SplashScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationComplete, setAnimationComplete] = useState(false);
  const [paywallShown, setPaywallShown] = useState(DEVELOPER_MODE); // Skip paywall in dev mode
  const { hasActiveSubscription, user } = useUser();

  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log("[Splash] Paywall presented:", info.name);
    },
    onDismiss: (info, result) => {
      console.log("[Splash] Paywall dismissed:", result.type);
      setPaywallShown(true);
    },
    onSkip: (reason) => {
      console.log("[Splash] Paywall skipped:", reason.type);
      setPaywallShown(true);
    },
    onError: (error) => {
      console.error("[Splash] Paywall error:", error);
      setPaywallShown(true);
    },
  });

  // Run animation on mount
  useEffect(() => {
    console.log("[Splash] Animation starting...");
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log("[Splash] Animation complete");
      setAnimationComplete(true);
    });
  }, [fadeAnim]);

  // Show paywall after animation, then navigate
  useEffect(() => {
    if (animationComplete && rootNavigationState?.key && !paywallShown) {
      // TEMPORARY: Skip paywall in developer mode
      if (DEVELOPER_MODE) {
        console.log("[Splash] Developer mode - skipping paywall");
        setPaywallShown(true);
        return;
      }

      const showPaywall = async () => {
        try {
          console.log("[Splash] Showing paywall...");
          await registerPlacement({
            placement: "campaign_trigger",
            params: { source: "splash" },
            feature: () => {
              console.log("[Splash] User has access, navigating...");
              setPaywallShown(true);
            },
          });
        } catch (error) {
          console.error("[Splash] Error showing paywall:", error);
          setPaywallShown(true);
        }
      };
      
      showPaywall();
    }
  }, [animationComplete, rootNavigationState?.key, paywallShown, registerPlacement]);

  // Navigate after paywall is shown or skipped
  useEffect(() => {
    if (paywallShown && rootNavigationState?.key) {
      // TEMPORARY: In developer mode, always go to tabs and skip onboarding
      if (DEVELOPER_MODE) {
        console.log("[Splash] Developer mode - navigating to tabs...");
        router.replace({ pathname: "/(tabs)" as any });
        return;
      }

      const isSubscribed = hasActiveSubscription();
      
      // If not subscribed, always show onboarding
      // If subscribed and hasn't completed onboarding, show onboarding
      // If subscribed and completed onboarding, go to tabs
      if (!isSubscribed || !user.hasCompletedOnboarding) {
        console.log("[Splash] Navigating to onboarding...");
        router.replace({ pathname: "/onboarding" as any });
      } else {
        console.log("[Splash] User is subscribed, navigating to tabs...");
        router.replace({ pathname: "/(tabs)" as any });
      }
    }
  }, [paywallShown, rootNavigationState?.key, hasActiveSubscription, user.hasCompletedOnboarding, router]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Image
          source={{ uri: PASSPORT_MASCOT }}
          style={styles.logo}
          resizeMode="contain"
          onLoad={() => console.log("[Splash] Passport mascot loaded")}
          onError={(e) => console.error("[Splash] Image load error:", e.nativeEvent.error)}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
});
