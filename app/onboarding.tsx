import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

import { useUser } from "@/contexts/UserContext";
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");

type OnboardingStep =
  | "welcome"
  | "trip-question"
  | "tours-question"
  | "savings"
  | "pain-points"
  | "features"
  | "notifications"
  | "referral";

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateUser } = useUser();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [onTrip, setOnTrip] = useState<boolean | null>(null);
  const [bookedTours, setBookedTours] = useState<boolean | null>(null);
  const [painPoint, setPainPoint] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string>("");

  const handleComplete = async () => {
    updateUser({ 
      hasCompletedOnboarding: true,
      onboarding: {
        onTrip,
        bookedTours,
        painPoint,
        referralCode,
      }
    });
    router.replace("/(tabs)");
  };

  const handleNotifications = async () => {
    if (Platform.OS !== "web") {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      console.log("Notification permission status:", finalStatus);
    }
    setStep("referral");
  };

  const renderProgressBar = () => {
    const steps: OnboardingStep[] = [
      "welcome",
      "trip-question",
      "tours-question",
      "savings",
      "pain-points",
      "features",
      "notifications",
      "referral",
    ];
    const currentIndex = steps.indexOf(step);
    const progress = ((currentIndex + 1) / steps.length) * 100;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    );
  };

  const renderWelcomeSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/nrrw8bqqmv0smf2x4l0gc" }}
          style={styles.phoneImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.heading}>Custom & Immersive Tours Made Easy</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("trip-question")}>
          <Text style={styles.primaryButtonText}>Start Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTripQuestion = () => (
    <View style={styles.slideContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>Are you currently on a trip or travelling soon?</Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, onTrip === true && styles.optionButtonSelected]}
            onPress={() => {
              setOnTrip(true);
              setStep("tours-question");
            }}
          >
            <Text style={[styles.optionText, onTrip === true && styles.optionTextSelected]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, onTrip === false && styles.optionButtonSelected]}
            onPress={() => {
              setOnTrip(false);
              setStep("tours-question");
            }}
          >
            <Text style={[styles.optionText, onTrip === false && styles.optionTextSelected]}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderToursQuestion = () => (
    <View style={styles.slideContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>Have you booked any tours for your trip?</Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, bookedTours === true && styles.optionButtonSelected]}
            onPress={() => {
              setBookedTours(true);
              setStep("savings");
            }}
          >
            <Text style={[styles.optionText, bookedTours === true && styles.optionTextSelected]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, bookedTours === false && styles.optionButtonSelected]}
            onPress={() => {
              setBookedTours(false);
              setStep("savings");
            }}
          >
            <Text style={[styles.optionText, bookedTours === false && styles.optionTextSelected]}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSavingsSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          SoloBuddy users save around 40% from tours using our app compared to big tour companies
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("pain-points")}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPainPointsQuestion = () => (
    <View style={styles.slideContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>
            What&apos;s stopped you from not squeezing more out of your trip before?
          </Text>
          <View style={styles.multiChoiceContainer}>
            <TouchableOpacity
              style={[styles.multiChoiceButton, painPoint === "tiktoks" && styles.multiChoiceButtonSelected]}
              onPress={() => {
                setPainPoint("tiktoks");
                setTimeout(() => setStep("features"), 300);
              }}
            >
              <Text style={[styles.multiChoiceText, painPoint === "tiktoks" && styles.multiChoiceTextSelected]}>
                Too many Tik Toks, YT videos to watch
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.multiChoiceButton, painPoint === "expensive" && styles.multiChoiceButtonSelected]}
              onPress={() => {
                setPainPoint("expensive");
                setTimeout(() => setStep("features"), 300);
              }}
            >
              <Text style={[styles.multiChoiceText, painPoint === "expensive" && styles.multiChoiceTextSelected]}>
                Tours too slow or expensive
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.multiChoiceButton, painPoint === "custom" && styles.multiChoiceButtonSelected]}
              onPress={() => {
                setPainPoint("custom");
                setTimeout(() => setStep("features"), 300);
              }}
            >
              <Text style={[styles.multiChoiceText, painPoint === "custom" && styles.multiChoiceTextSelected]}>
                Want something fast, easy & custom to me
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderFeaturesSlide = () => (
    <View style={styles.slideContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoContainer}>
          <Text style={styles.featuresText}>
            SoloBuddy lets you create custom AI powered tours in your exact location from verified academic sources,
            take pictures of landmarks and even artworks to learn more about them instantly, find the main touristic
            hotspots, hidden gems & unique restaurants submitted by travelers like you, connect with other like minded
            travelers
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("notifications")}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderNotificationsSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.infoContainer}>
        <Text style={styles.heading}>Stay Connected</Text>
        <Text style={styles.notificationText}>
          Get notified about new landmarks nearby, tour updates, and connect with fellow travelers in real-time
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={handleNotifications}>
          <Text style={styles.primaryButtonText}>Enable Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => setStep("referral")}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReferralSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.infoContainer}>
        <Text style={styles.heading}>Have a Referral Code?</Text>
        <Text style={styles.notificationText}>Enter your referral code to unlock bonus tours</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter code (optional)"
          placeholderTextColor={Colors.light.textSecondary}
          value={referralCode}
          onChangeText={setReferralCode}
          autoCapitalize="characters"
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={handleComplete}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentSlide = () => {
    switch (step) {
      case "welcome":
        return renderWelcomeSlide();
      case "trip-question":
        return renderTripQuestion();
      case "tours-question":
        return renderToursQuestion();
      case "savings":
        return renderSavingsSlide();
      case "pain-points":
        return renderPainPointsQuestion();
      case "features":
        return renderFeaturesSlide();
      case "notifications":
        return renderNotificationsSlide();
      case "referral":
        return renderReferralSlide();
      default:
        return renderWelcomeSlide();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {step !== "welcome" && renderProgressBar()}
      {renderCurrentSlide()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },
  slideContainer: {
    flex: 1,
    justifyContent: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  phoneImage: {
    width: width * 0.75,
    height: height * 0.45,
  },
  contentContainer: {
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 38,
  },
  primaryButton: {
    backgroundColor: Colors.light.text,
    paddingVertical: 18,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.light.background,
    fontSize: 18,
    fontWeight: "700",
  },
  questionContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  questionText: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 36,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionButtonSelected: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  optionTextSelected: {
    color: Colors.light.background,
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  infoText: {
    fontSize: 26,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 48,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 32,
  },
  multiChoiceContainer: {
    gap: 16,
  },
  multiChoiceButton: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  multiChoiceButtonSelected: {
    backgroundColor: Colors.light.text,
    borderColor: Colors.light.text,
  },
  multiChoiceText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 24,
  },
  multiChoiceTextSelected: {
    color: Colors.light.background,
  },
  featuresText: {
    fontSize: 18,
    fontWeight: "500",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 40,
  },
  notificationText: {
    fontSize: 17,
    fontWeight: "400",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 32,
    marginTop: 16,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.textSecondary,
  },
  input: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    fontSize: 17,
    fontWeight: "500",
    color: Colors.light.text,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
});
