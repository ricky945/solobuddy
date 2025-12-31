import { useRouter, useRootNavigationState } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";

export default function SplashScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationComplete, setAnimationComplete] = useState(false);

  // Run animation on mount
  useEffect(() => {
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
      setAnimationComplete(true);
    });
  }, [fadeAnim]);

  // Navigate only when both animation is complete AND navigation is ready
  useEffect(() => {
    if (animationComplete && rootNavigationState?.key) {
      // Force show onboarding every time
      console.log("[Splash] Navigating to onboarding...");
      router.replace({ pathname: "/onboarding" as any });
    }
  }, [animationComplete, rootNavigationState?.key, router]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <Image
          source={require("@/assets/images/splash-icon.png")}
          style={styles.logo}
          resizeMode="contain"
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
