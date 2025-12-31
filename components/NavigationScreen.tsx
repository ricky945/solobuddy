import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Check, ChevronRight, MapPin } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { NavigationStep } from "@/types";

interface NavigationScreenProps {
  steps: NavigationStep[];
  currentStepIndex: number;
  onStepComplete: () => void;
  onClose: () => void;
}

export default function NavigationScreen({
  steps,
  currentStepIndex,
  onStepComplete,
  onClose,
}: NavigationScreenProps) {
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Step {currentStepIndex + 1} of {steps.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentStepIndex + 1) / steps.length) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <MapPin size={24} color={Colors.light.primary} />
            <Text style={styles.destinationLabel}>Destination</Text>
          </View>
          <Text style={styles.destinationName}>
            {currentStep.destinationLandmark.name}
          </Text>
          <Text style={styles.destinationDescription} numberOfLines={2}>
            {currentStep.destinationLandmark.description}
          </Text>
        </View>

        <View style={styles.directionCard}>
          <View style={styles.directionHeader}>
            <ChevronRight size={32} color={Colors.light.primary} />
            <View style={styles.directionMeta}>
              <Text style={styles.directionDistance}>{currentStep.distance}</Text>
              <Text style={styles.directionTime}>{currentStep.estimatedTime}</Text>
            </View>
          </View>

          <Text style={styles.directionText}>{currentStep.instruction}</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmButton}
          activeOpacity={0.8}
          onPress={onStepComplete}
        >
          <Check size={24} color={Colors.light.background} />
          <Text style={styles.confirmButtonText}>
            {isLastStep ? "Complete Tour" : "I've Arrived"}
          </Text>
        </TouchableOpacity>

        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>Upcoming Stops</Text>
          <ScrollView
            style={styles.upcomingList}
            showsVerticalScrollIndicator={false}
          >
            {steps.slice(currentStepIndex + 1).map((step, index) => (
              <View key={step.id} style={styles.upcomingItem}>
                <View style={styles.upcomingNumber}>
                  <Text style={styles.upcomingNumberText}>
                    {currentStepIndex + index + 2}
                  </Text>
                </View>
                <View style={styles.upcomingDetails}>
                  <Text style={styles.upcomingName} numberOfLines={1}>
                    {step.destinationLandmark.name}
                  </Text>
                  <Text style={styles.upcomingMeta}>
                    {step.distance} • {step.estimatedTime}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  closeButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  progressContainer: {
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: "600",
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  destinationCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  destinationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  destinationLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  destinationName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 8,
  },
  destinationDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 21,
  },
  directionCard: {
    backgroundColor: Colors.light.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  directionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  directionMeta: {
    flex: 1,
  },
  directionDistance: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 2,
  },
  directionTime: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  directionText: {
    fontSize: 17,
    color: Colors.light.text,
    lineHeight: 24,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 24,
  },
  confirmButtonText: {
    color: Colors.light.background,
    fontSize: 17,
    fontWeight: "700",
  },
  upcomingSection: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 12,
  },
  upcomingList: {
    flex: 1,
  },
  upcomingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  upcomingNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingNumberText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 2,
  },
  upcomingMeta: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
