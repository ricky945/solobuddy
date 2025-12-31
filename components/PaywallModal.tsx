import React, { useRef, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  X,
  Check,
  Sparkles,
  MapPin,
  Headphones,
  Globe,
  Zap,
} from "lucide-react-native";

import Colors from "@/constants/colors";
import { SubscriptionTier } from "@/types";

const { height } = Dimensions.get("window");

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: (tier: SubscriptionTier) => void;
  isProcessing?: boolean;
}

const SUBSCRIPTION_OPTIONS = [
  {
    id: "weekly" as SubscriptionTier,
    name: "Weekly",
    price: "$8.99",
    duration: "per week",
    pricePerDay: "$1.28/day",
  },
  {
    id: "yearly" as SubscriptionTier,
    name: "Annual",
    price: "$29.99",
    duration: "per year",
    savings: "Save 87%",
    pricePerDay: "$0.08/day",
    popular: true,
  },
];

const PREMIUM_FEATURES = [
  {
    icon: Sparkles,
    title: "Unlimited AI Tours",
    description: "Create as many custom tours as you want",
  },
  {
    icon: Headphones,
    title: "Premium Audio Guides",
    description: "High-quality narrated experiences",
  },
  {
    icon: MapPin,
    title: "Route Planning",
    description: "Optimized paths with transport options",
  },
  {
    icon: Globe,
    title: "Worldwide Access",
    description: "Explore any destination on Earth",
  },
];

export default function PaywallModal({
  visible,
  onClose,
  onSubscribe,
  isProcessing = false,
}: PaywallModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("yearly");
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
      ]).start();
    } else {
      slideAnim.setValue(height);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, slideAnim, fadeAnim, scaleAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleSubscribe = () => {
    if (!isProcessing) {
      onSubscribe(selectedTier);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <View style={styles.contentWrapper}>
            <LinearGradient
              colors={["#1E88E5", "#0D47A1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerGradient}
            >
              <View style={styles.sparklesContainer}>
                <Sparkles size={80} color="rgba(255,255,255,0.15)" style={styles.sparkle1} />
                <Sparkles size={60} color="rgba(255,255,255,0.1)" style={styles.sparkle2} />
                <Sparkles size={50} color="rgba(255,255,255,0.12)" style={styles.sparkle3} />
              </View>

              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerContent}>
                <View style={styles.iconBadge}>
                  <Zap size={32} color="#FFFFFF" fill="#FFFFFF" />
                </View>
                <Text style={styles.headerTitle}>Unlock Premium</Text>
                <Text style={styles.headerSubtitle}>
                  Create unlimited AI-powered tours and explore the world
                </Text>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.subscriptionSection}>
                <Text style={styles.sectionTitle}>Choose Your Plan</Text>
                
                <View style={styles.optionsContainer}>
                  {SUBSCRIPTION_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setSelectedTier(option.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.optionCard,
                        selectedTier === option.id && styles.optionCardSelected,
                      ]}
                    >
                      {option.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularText}>MOST POPULAR</Text>
                        </View>
                      )}
                      
                      <View style={styles.optionHeader}>
                        <View style={styles.optionLeft}>
                          <View style={styles.radioOuter}>
                            {selectedTier === option.id && (
                              <View style={styles.radioInner} />
                            )}
                          </View>
                          <View style={styles.optionInfo}>
                            <Text style={styles.optionName}>{option.name}</Text>
                            <Text style={styles.optionDuration}>{option.duration}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.optionRight}>
                          <Text style={styles.optionPrice}>{option.price}</Text>
                          {option.savings && (
                            <View style={styles.savingsBadge}>
                              <Text style={styles.savingsText}>{option.savings}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <View style={styles.pricePerDay}>
                        <Text style={styles.pricePerDayText}>{option.pricePerDay}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.featuresSection}>
                <Text style={styles.featuresSectionTitle}>What&apos;s Included</Text>
                
                {PREMIUM_FEATURES.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIconContainer}>
                      <feature.icon size={20} color={Colors.light.primary} />
                    </View>
                    <View style={styles.featureTextContainer}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                    <View style={styles.featureCheck}>
                      <Check size={18} color={Colors.light.success} strokeWidth={3} />
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.disclaimer}>
                Free features: Map exploration and image recognition remain free forever.
              </Text>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSubscribe}
                disabled={isProcessing}
                activeOpacity={0.8}
                style={styles.subscribeButtonWrapper}
              >
                <LinearGradient
                  colors={["#1E88E5", "#0D47A1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subscribeButton}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={styles.subscribeButtonText}>
                        Start {selectedTier === "weekly" ? "Weekly" : "Annual"} Plan
                      </Text>
                      <Text style={styles.subscribeButtonSubtext}>
                        Cancel anytime
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleClose}
                style={styles.restorePurchaseButton}
              >
                <Text style={styles.restorePurchaseText}>Restore Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  backdropTouchable: {
    flex: 1,
  },
  modalContainer: {
    height: height * 0.92,
    maxHeight: height * 0.92,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  contentWrapper: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
    position: "relative",
    overflow: "hidden",
  },
  sparklesContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle1: {
    position: "absolute",
    top: 20,
    right: 30,
    opacity: 0.6,
  },
  sparkle2: {
    position: "absolute",
    bottom: 40,
    left: 40,
    opacity: 0.4,
  },
  sparkle3: {
    position: "absolute",
    top: 60,
    left: -10,
    opacity: 0.5,
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    alignItems: "center",
    marginTop: 8,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flex: 1,
  },
  subscriptionSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: "#F7F9FA",
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  popularText: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  optionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.primary,
  },
  optionInfo: {
    gap: 2,
  },
  optionName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  optionDuration: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
  },
  optionRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  optionPrice: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.light.text,
  },
  savingsBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  pricePerDay: {
    marginTop: 4,
  },
  pricePerDayText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: "600" as const,
  },
  featuresSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  featuresSectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.light.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.light.success}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  subscribeButtonWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  subscribeButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  subscribeButtonSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500" as const,
  },
  restorePurchaseButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  restorePurchaseText: {
    fontSize: 15,
    color: Colors.light.primary,
    fontWeight: "600" as const,
  },
});
