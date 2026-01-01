import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Lock, Sparkles } from "lucide-react-native";
import { usePlacement } from "expo-superwall";
import { useUser } from "@/contexts/UserContext";
import Colors from "@/constants/colors";

// TEMPORARY: Developer bypass for testing
const DEVELOPER_MODE = true; // Set to false when ready for production

interface FeatureGuardProps {
  children: React.ReactNode;
  featureName?: string;
}

export default function FeatureGuard({ children, featureName = "this feature" }: FeatureGuardProps) {
  const { canAccessFeature } = useUser();
  const [isShowingPaywall, setIsShowingPaywall] = useState(false);

  const { registerPlacement } = usePlacement({
    onPresent: () => {
      console.log("[FeatureGuard] Paywall presented");
      setIsShowingPaywall(true);
    },
    onDismiss: () => {
      console.log("[FeatureGuard] Paywall dismissed");
      setIsShowingPaywall(false);
    },
    onSkip: () => {
      console.log("[FeatureGuard] Paywall skipped");
      setIsShowingPaywall(false);
    },
    onError: (error) => {
      console.error("[FeatureGuard] Paywall error:", error);
      setIsShowingPaywall(false);
    },
  });

  const handleUnlock = async () => {
    try {
      await registerPlacement({
        placement: "campaign_trigger",
        params: { source: "feature_guard", feature: featureName },
        feature: () => {
          console.log("[FeatureGuard] User has access");
          setIsShowingPaywall(false);
        },
      });
    } catch (error) {
      console.error("[FeatureGuard] Error showing paywall:", error);
      setIsShowingPaywall(false);
    }
  };

  // TEMPORARY: Bypass paywall for developer testing
  if (DEVELOPER_MODE) {
    console.log("[FeatureGuard] Developer mode enabled - bypassing paywall");
    return <>{children}</>;
  }

  if (canAccessFeature()) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(30, 136, 229, 0.1)", "rgba(13, 71, 161, 0.1)"]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconBadge}>
              <Lock size={32} color={Colors.light.primary} />
            </View>
            <View style={styles.sparkleContainer}>
              <Sparkles size={20} color={Colors.light.primary} style={styles.sparkle1} />
              <Sparkles size={16} color={Colors.light.primary} style={styles.sparkle2} />
            </View>
          </View>

          <Text style={styles.title}>Premium Feature</Text>
          <Text style={styles.subtitle}>
            Unlock {featureName} and all premium features
          </Text>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Create unlimited custom tours</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Access your saved library</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Discover new landmarks</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Walking tours with audio guides</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleUnlock}
            disabled={isShowingPaywall}
            activeOpacity={0.85}
            style={styles.unlockButton}
          >
            <Lock size={20} color="#FFFFFF" />
            <Text style={styles.unlockButtonText}>Unlock Premium</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Cancel anytime • Image recognition stays free
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 24,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  sparkleContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle1: {
    position: "absolute",
    top: -5,
    right: -5,
  },
  sparkle2: {
    position: "absolute",
    bottom: 10,
    left: -5,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  features: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "600",
  },
  unlockButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  disclaimer: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
