import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import {
  User as UserIcon,
  MapPin,
  Globe,
  ChevronRight,
  Camera,
  Edit3,
  LogOut,
  Bell,
  Lock,
  CreditCard,
  HelpCircle,
  Info,
  Trash2,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useUser } from "@/contexts/UserContext";
import { AuthAppleButton } from "@/components/AuthAppleButton";

const getCountryFlag = (country: string): string => {
  const countryToFlag: Record<string, string> = {
    "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Algeria": "🇩🇿", "Andorra": "🇦🇩", "Angola": "🇦🇴",
    "Argentina": "🇦🇷", "Armenia": "🇦🇲", "Australia": "🇦🇺", "Austria": "🇦🇹", "Azerbaijan": "🇦🇿",
    "Bahamas": "🇧🇸", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩", "Barbados": "🇧🇧", "Belarus": "🇧🇾",
    "Belgium": "🇧🇪", "Belize": "🇧🇿", "Benin": "🇧🇯", "Bhutan": "🇧🇹", "Bolivia": "🇧🇴",
    "Bosnia and Herzegovina": "🇧🇦", "Botswana": "🇧🇼", "Brazil": "🇧🇷", "Brunei": "🇧🇳", "Bulgaria": "🇧🇬",
    "Burkina Faso": "🇧🇫", "Burundi": "🇧🇮", "Cambodia": "🇰🇭", "Cameroon": "🇨🇲", "Canada": "🇨🇦",
    "Cape Verde": "🇨🇻", "Central African Republic": "🇨🇫", "Chad": "🇹🇩", "Chile": "🇨🇱", "China": "🇨🇳",
    "Colombia": "🇨🇴", "Comoros": "🇰🇲", "Congo": "🇨🇬", "Costa Rica": "🇨🇷", "Croatia": "🇭🇷",
    "Cuba": "🇨🇺", "Cyprus": "🇨🇾", "Czech Republic": "🇨🇿", "Czechia": "🇨🇿", "Denmark": "🇩🇰",
    "Djibouti": "🇩🇯", "Dominica": "🇩🇲", "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨", "Egypt": "🇪🇬",
    "El Salvador": "🇸🇻", "Equatorial Guinea": "🇬🇶", "Eritrea": "🇪🇷", "Estonia": "🇪🇪", "Ethiopia": "🇪🇹",
    "Fiji": "🇫🇯", "Finland": "🇫🇮", "France": "🇫🇷", "Gabon": "🇬🇦", "Gambia": "🇬🇲",
    "Georgia": "🇬🇪", "Germany": "🇩🇪", "Ghana": "🇬🇭", "Greece": "🇬🇷", "Grenada": "🇬🇩",
    "Guatemala": "🇬🇹", "Guinea": "🇬🇳", "Guinea-Bissau": "🇬🇼", "Guyana": "🇬🇾", "Haiti": "🇭🇹",
    "Honduras": "🇭🇳", "Hungary": "🇭🇺", "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩",
    "Iran": "🇮🇷", "Iraq": "🇮🇶", "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹",
    "Jamaica": "🇯🇲", "Japan": "🇯🇵", "Jordan": "🇯🇴", "Kazakhstan": "🇰🇿", "Kenya": "🇰🇪",
    "Kiribati": "🇰🇮", "Kuwait": "🇰🇼", "Kyrgyzstan": "🇰🇬", "Laos": "🇱🇦", "Latvia": "🇱🇻",
    "Lebanon": "🇱🇧", "Lesotho": "🇱🇸", "Liberia": "🇱🇷", "Libya": "🇱🇾", "Liechtenstein": "🇱🇮",
    "Lithuania": "🇱🇹", "Luxembourg": "🇱🇺", "Madagascar": "🇲🇬", "Malawi": "🇲🇼", "Malaysia": "🇲🇾",
    "Maldives": "🇲🇻", "Mali": "🇲🇱", "Malta": "🇲🇹", "Marshall Islands": "🇲🇭", "Mauritania": "🇲🇷",
    "Mauritius": "🇲🇺", "Mexico": "🇲🇽", "Micronesia": "🇫🇲", "Moldova": "🇲🇩", "Monaco": "🇲🇨",
    "Mongolia": "🇲🇳", "Montenegro": "🇲🇪", "Morocco": "🇲🇦", "Mozambique": "🇲🇿", "Myanmar": "🇲🇲",
    "Namibia": "🇳🇦", "Nauru": "🇳🇷", "Nepal": "🇳🇵", "Netherlands": "🇳🇱", "New Zealand": "🇳🇿",
    "Nicaragua": "🇳🇮", "Niger": "🇳🇪", "Nigeria": "🇳🇬", "North Korea": "🇰🇵", "North Macedonia": "🇲🇰",
    "Norway": "🇳🇴", "Oman": "🇴🇲", "Pakistan": "🇵🇰", "Palau": "🇵🇼", "Palestine": "🇵🇸",
    "Panama": "🇵🇦", "Papua New Guinea": "🇵🇬", "Paraguay": "🇵🇾", "Peru": "🇵🇪", "Philippines": "🇵🇭",
    "Poland": "🇵🇱", "Portugal": "🇵🇹", "Qatar": "🇶🇦", "Romania": "🇷🇴", "Russia": "🇷🇺",
    "Rwanda": "🇷🇼", "Saint Kitts and Nevis": "🇰🇳", "Saint Lucia": "🇱🇨", "Samoa": "🇼🇸", "San Marino": "🇸🇲",
    "Sao Tome and Principe": "🇸🇹", "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Serbia": "🇷🇸", "Seychelles": "🇸🇨",
    "Sierra Leone": "🇸🇱", "Singapore": "🇸🇬", "Slovakia": "🇸🇰", "Slovenia": "🇸🇮", "Solomon Islands": "🇸🇧",
    "Somalia": "🇸🇴", "South Africa": "🇿🇦", "South Korea": "🇰🇷", "South Sudan": "🇸🇸", "Spain": "🇪🇸",
    "Sri Lanka": "🇱🇰", "Sudan": "🇸🇩", "Suriname": "🇸🇷", "Sweden": "🇸🇪", "Switzerland": "🇨🇭",
    "Syria": "🇸🇾", "Taiwan": "🇹🇼", "Tajikistan": "🇹🇯", "Tanzania": "🇹🇿", "Thailand": "🇹🇭",
    "Timor-Leste": "🇹🇱", "Togo": "🇹🇬", "Tonga": "🇹🇴", "Trinidad and Tobago": "🇹🇹", "Tunisia": "🇹🇳",
    "Turkey": "🇹🇷", "Turkmenistan": "🇹🇲", "Tuvalu": "🇹🇻", "Uganda": "🇺🇬", "Ukraine": "🇺🇦",
    "United Arab Emirates": "🇦🇪", "UAE": "🇦🇪", "United Kingdom": "🇬🇧", "UK": "🇬🇧", "United States": "🇺🇸",
    "USA": "🇺🇸", "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Vanuatu": "🇻🇺", "Vatican City": "🇻🇦",
    "Venezuela": "🇻🇪", "Vietnam": "🇻🇳", "Yemen": "🇾🇪", "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼"
  };
  return countryToFlag[country] || "🌍";
};

type BackendCheckStatus = "idle" | "checking" | "ok" | "error";

type BackendCheckState = {
  status: BackendCheckStatus;
  message: string;
  httpStatus?: number;
  baseUrl?: string;
  checkedAt?: string;
};

export default function AccountScreen() {
  const {
    user,
    updateProfile,
    isAuthLoading,
    isSignedIn,
    authEmail,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    isSigningIn,
    isSigningUp,
    isSigningOut,
  } = useUser();

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const backendBaseUrl = useMemo(() => {
    const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    return url ? url.toString() : "";
  }, []);

  const [backendCheck, setBackendCheck] = useState<BackendCheckState>({
    status: "idle",
    message: "Not checked yet",
    baseUrl: backendBaseUrl,
  });

  const checkBackendHealth = useCallback(async () => {
    console.log("[Connection Check] Starting backend health check...");
    console.log("[Connection Check] Base URL:", backendBaseUrl);

    if (!backendBaseUrl) {
      setBackendCheck({
        status: "error",
        message: "Missing EXPO_PUBLIC_RORK_API_BASE_URL",
        baseUrl: backendBaseUrl,
        checkedAt: new Date().toISOString(),
      });
      Alert.alert("Backend not configured", "Missing backend base URL. Please contact support.");
      return;
    }

    setBackendCheck((prev) => ({
      ...prev,
      status: "checking",
      message: "Checking /health…",
      baseUrl: backendBaseUrl,
    }));

    const healthUrl = `${backendBaseUrl.replace(/\/$/, "")}/health`;

    try {
      const startedAt = Date.now();
      const res = await fetch(healthUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      const elapsedMs = Date.now() - startedAt;

      console.log("[Connection Check] /health response:", {
        status: res.status,
        ok: res.ok,
        elapsedMs,
        url: healthUrl,
      });

      let bodyText = "";
      let json: unknown = null;

      try {
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          json = await res.json();
        } else {
          bodyText = await res.text();
        }
      } catch (e) {
        console.error("[Connection Check] Failed to parse /health response", e);
      }

      if (!res.ok) {
        setBackendCheck({
          status: "error",
          message: `Backend returned error: ${res.status}`,
          httpStatus: res.status,
          baseUrl: backendBaseUrl,
          checkedAt: new Date().toISOString(),
        });
        Alert.alert(
          "Backend error",
          `Backend health check failed (HTTP ${res.status}).\n\nURL: ${healthUrl}`
        );
        return;
      }

      const detail = json ? JSON.stringify(json).slice(0, 300) : bodyText.slice(0, 300);
      setBackendCheck({
        status: "ok",
        message: `Healthy (${elapsedMs}ms)`,
        httpStatus: res.status,
        baseUrl: backendBaseUrl,
        checkedAt: new Date().toISOString(),
      });

      console.log("[Connection Check] Backend healthy details (truncated):", detail);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      console.error("[Connection Check] Health check failed", e);
      setBackendCheck({
        status: "error",
        message: msg,
        baseUrl: backendBaseUrl,
        checkedAt: new Date().toISOString(),
      });
      Alert.alert(
        "Connection failed",
        Platform.OS === "web"
          ? "Could not reach backend. Check your internet connection or CORS settings."
          : "Could not reach backend. Please check your connection and try again."
      );
    }
  }, [backendBaseUrl]);
  const [editName, setEditName] = useState(user.profile?.name || "");
  const [editBio, setEditBio] = useState(user.profile?.bio || "");
  const [editCurrentCity, setEditCurrentCity] = useState(user.profile?.currentCity || "");
  const [editCountriesVisited, setEditCountriesVisited] = useState(user.profile?.countriesVisited?.join(", ") || "");

  const [authEmailInput, setAuthEmailInput] = useState<string>(authEmail ?? "");
  const [authPasswordInput, setAuthPasswordInput] = useState<string>("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const hasProfile = user.profile && user.profile.name;

  const handleSaveProfile = () => {
    console.log("[Account] Saving profile...");
    if (!editName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    const countriesArray = editCountriesVisited
      .split(",")
      .map((country: string) => country.trim())
      .filter((country: string) => country.length > 0);

    updateProfile({
      name: editName.trim(),
      bio: editBio.trim(),
      currentCity: editCurrentCity.trim(),
      countriesVisited: countriesArray,
    });

    setIsEditingProfile(false);
    console.log("[Account] Profile saved successfully");
  };

  const handleCancelEdit = () => {
    setEditName(user.profile?.name || "");
    setEditBio(user.profile?.bio || "");
    setEditCurrentCity(user.profile?.currentCity || "");
    setEditCountriesVisited(user.profile?.countriesVisited?.join(", ") || "");
    setIsEditingProfile(false);
  };

  const handleCreateProfile = () => {
    setEditName("");
    setEditBio("");
    setEditCurrentCity("");
    setEditCountriesVisited("");
    setIsEditingProfile(true);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            setAuthMessage(null);
            await signOut();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to log out";
            console.error("[Account] signOut error", e);
            Alert.alert("Logout failed", msg);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive" },
      ]
    );
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please grant camera roll permissions to change your profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        console.log("[Account] Selected image:", result.assets[0].uri);
        updateProfile({ profilePictureUrl: result.assets[0].uri });
      }
    } catch (error) {
      console.error("[Account] Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  if (!hasProfile && !isEditingProfile) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <UserIcon size={64} color={Colors.light.textSecondary} />
            </View>
            <Text style={styles.emptyStateTitle}>Create Your Profile</Text>
            <Text style={styles.emptyStateDescription}>
              Set up your profile to personalize your experience and keep track of cities you&apos;ve visited
            </Text>
            <TouchableOpacity
              style={styles.createProfileButton}
              activeOpacity={0.8}
              onPress={handleCreateProfile}
            >
              <Text style={styles.createProfileButtonText}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isEditingProfile) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {hasProfile ? "Edit Profile" : "Create Profile"}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCancelEdit}
              >
                <Text style={styles.headerButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButtonPrimary}
                onPress={handleSaveProfile}
              >
                <Text style={styles.headerButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profilePictureEdit}>
              <View style={styles.profilePicturePlaceholder}>
                {user.profile?.profilePictureUrl ? (
                  <Image
                    source={{ uri: user.profile.profilePictureUrl }}
                    style={styles.profilePictureImage}
                  />
                ) : (
                  <UserIcon size={48} color={Colors.light.textSecondary} />
                )}
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                activeOpacity={0.8}
                onPress={handlePickImage}
              >
                <Camera size={18} color={Colors.light.background} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={Colors.light.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Current City</Text>
              <TextInput
                style={styles.input}
                value={editCurrentCity}
                onChangeText={setEditCurrentCity}
                placeholder="Where are you now?"
                placeholderTextColor={Colors.light.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Countries Visited</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editCountriesVisited}
                onChangeText={setEditCountriesVisited}
                placeholder="France, Japan, United States, United Kingdom..."
                placeholderTextColor={Colors.light.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.formHint}>Separate countries with commas</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="account-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Account</Text>

          <View style={styles.backendCard} testID="backend-check-card">
            <View style={styles.backendHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.backendTitle}>Backend</Text>
                <Text style={styles.backendSubtitle} numberOfLines={2}>
                  {backendCheck.baseUrl ? backendCheck.baseUrl : "No base URL configured"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.backendButton,
                  backendCheck.status === "checking" ? styles.backendButtonDisabled : null,
                ]}
                activeOpacity={0.85}
                disabled={backendCheck.status === "checking"}
                onPress={checkBackendHealth}
                testID="backend-check-button"
              >
                {backendCheck.status === "checking" ? (
                  <ActivityIndicator color={"#FFFFFF"} />
                ) : (
                  <Text style={styles.backendButtonText}>Check</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.backendStatusRow} testID="backend-check-status">
              <View
                style={[
                  styles.backendDot,
                  backendCheck.status === "ok"
                    ? styles.backendDotOk
                    : backendCheck.status === "error"
                      ? styles.backendDotError
                      : backendCheck.status === "checking"
                        ? styles.backendDotChecking
                        : styles.backendDotIdle,
                ]}
              />
              <Text style={styles.backendStatusText} numberOfLines={2}>
                {backendCheck.message}
                {backendCheck.httpStatus ? ` (HTTP ${backendCheck.httpStatus})` : ""}
              </Text>
            </View>

            {backendCheck.checkedAt ? (
              <Text style={styles.backendMetaText} numberOfLines={1}>
                Last checked: {new Date(backendCheck.checkedAt).toLocaleString()}
              </Text>
            ) : null}
          </View>

          <View style={styles.authCard} testID="account-auth-card">
            <View style={styles.authHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.authTitle}>{isSignedIn ? "Signed in" : authMode === "signin" ? "Sign in" : "Create account"}</Text>
                <Text style={styles.authSubtitle}>
                  {isSignedIn
                    ? "Your account is connected."
                    : "Sync your profile across devices and keep your tours safe."}
                </Text>
              </View>
              {!isSignedIn ? (
                <View style={styles.authModePills} testID="auth-mode-pills">
                  <TouchableOpacity
                    style={[styles.pill, authMode === "signin" ? styles.pillActive : null]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setAuthMode("signin");
                      setAuthMessage(null);
                    }}
                    testID="auth-mode-signin"
                  >
                    <Text style={[styles.pillText, authMode === "signin" ? styles.pillTextActive : null]}>Sign in</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, authMode === "signup" ? styles.pillActive : null]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setAuthMode("signup");
                      setAuthMessage(null);
                    }}
                    testID="auth-mode-signup"
                  >
                    <Text style={[styles.pillText, authMode === "signup" ? styles.pillTextActive : null]}>Sign up</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {isAuthLoading ? (
              <View style={styles.authLoadingRow} testID="auth-loading">
                <ActivityIndicator color={Colors.light.primary} />
                <Text style={styles.authLoadingText}>Checking session…</Text>
              </View>
            ) : null}

            {isSignedIn ? (
              <View style={styles.signedInRow} testID="auth-signed-in-row">
                <View style={styles.signedInBadge}>
                  <Text style={styles.signedInBadgeText}>Connected</Text>
                </View>
                <Text style={styles.signedInEmail} numberOfLines={1}>
                  {authEmail ?? ""}
                </Text>
                <TouchableOpacity
                  style={[styles.secondaryButton, isSigningOut ? styles.secondaryButtonDisabled : null]}
                  activeOpacity={0.85}
                  onPress={handleLogout}
                  disabled={isSigningOut}
                  testID="auth-signout"
                >
                  <Text style={styles.secondaryButtonText}>{isSigningOut ? "Signing out…" : "Sign out"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emailAuthWrap} testID="auth-email-form">
                <View style={styles.inputGroup}>
                  <Text style={styles.formLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={authEmailInput}
                    onChangeText={setAuthEmailInput}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.light.textSecondary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoCorrect={false}
                    testID="auth-email-input"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.formLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={authPasswordInput}
                    onChangeText={setAuthPasswordInput}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.light.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={authMode === "signup" ? "newPassword" : "password"}
                    testID="auth-password-input"
                  />
                  <Text style={styles.formHint}>{authMode === "signup" ? "Use 8+ characters." : ""}</Text>
                </View>

                {authMessage ? <Text style={styles.authMessage}>{authMessage}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryAuthButton, (isSigningIn || isSigningUp) ? styles.primaryAuthButtonDisabled : null]}
                  activeOpacity={0.85}
                  disabled={isSigningIn || isSigningUp}
                  onPress={async () => {
                    try {
                      setAuthMessage(null);
                      const email = authEmailInput.trim().toLowerCase();
                      const password = authPasswordInput;

                      if (!email || !email.includes("@")) {
                        Alert.alert("Invalid email", "Please enter a valid email address.");
                        return;
                      }
                      if (!password || password.length < 6) {
                        Alert.alert("Invalid password", "Password must be at least 6 characters.");
                        return;
                      }

                      if (authMode === "signin") {
                        await signInWithPassword({ email, password });
                        setAuthPasswordInput("");
                        setAuthMessage("Signed in successfully.");
                      } else {
                        await signUpWithPassword({ email, password });
                        setAuthPasswordInput("");
                        setAuthMessage("Account created. Check your email if confirmation is required.");
                      }
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : "Authentication failed";
                      console.error("[Account] email auth error", e);
                      setAuthMessage(msg);
                      Alert.alert("Authentication failed", msg);
                    }
                  }}
                  testID="auth-email-submit"
                >
                  <Text style={styles.primaryAuthButtonText}>
                    {authMode === "signin" ? (isSigningIn ? "Signing in…" : "Sign in") : isSigningUp ? "Creating…" : "Create account"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.authDividerRow}>
                  <View style={styles.authDividerLine} />
                  <Text style={styles.authDividerText}>or</Text>
                  <View style={styles.authDividerLine} />
                </View>

                <View style={styles.authActions}>
                  <AuthAppleButton />
                </View>
              </View>
            )}
          </View>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profilePicture}>
                {user.profile?.profilePictureUrl ? (
                  <Image
                    source={{ uri: user.profile.profilePictureUrl }}
                    style={styles.profilePictureImage}
                  />
                ) : (
                  <Image
                    source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/laveu4s1oij0t2h4rsl79" }}
                    style={styles.profilePictureImage}
                  />
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.profile?.name}</Text>
                {user.profile?.currentCity && (
                  <View style={styles.currentCityBadge}>
                    <MapPin size={14} color="#16A34A" />
                    <Text style={styles.currentCityLabel}>Currently in:</Text>
                    <Text style={styles.currentCityText}>{user.profile.currentCity}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditingProfile(true)}
                activeOpacity={0.8}
              >
                <Edit3 size={18} color={Colors.light.primary} />
              </TouchableOpacity>
            </View>

            {user.profile?.bio && (
              <Text style={styles.profileBio}>{user.profile.bio}</Text>
            )}

            {user.profile?.countriesVisited && user.profile.countriesVisited.length > 0 && (
              <View style={styles.citiesVisited}>
                <View style={styles.citiesHeader}>
                  <Globe size={18} color={Colors.light.text} />
                  <Text style={styles.citiesTitle}>Countries I&apos;ve Been To</Text>
                </View>
                <View style={styles.citiesList}>
                  {user.profile.countriesVisited.map((country: string, index: number) => (
                    <View key={index} style={styles.cityBadge}>
                      <Text style={styles.countryFlag}>{getCountryFlag(country)}</Text>
                      <Text style={styles.cityBadgeText}>{country}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Management</Text>

            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingIcon}>
                  <CreditCard size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Subscription</Text>
                  <Text style={styles.settingSubtitle}>
                    Manage your subscription
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Notifications</Text>
                  <Text style={styles.settingSubtitle}>
                    Manage your notifications
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingIcon}>
                  <Lock size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Privacy & Security</Text>
                  <Text style={styles.settingSubtitle}>
                    Control your data
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>

            <View style={styles.settingsCard}>
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingIcon}>
                  <HelpCircle size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Help Center</Text>
                  <Text style={styles.settingSubtitle}>
                    Get help and support
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
                <View style={styles.settingIcon}>
                  <Info size={20} color={Colors.light.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>About</Text>
                  <Text style={styles.settingSubtitle}>
                    Version 1.0.0
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.settingsCard}>
              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.7}
                onPress={handleLogout}
                testID="account-logout"
              >
                <View style={[styles.settingIcon, styles.settingIconDanger]}>
                  <LogOut size={20} color={Colors.light.error} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, styles.settingTitleDanger]}>
                    Logout
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>

              <View style={styles.settingDivider} />

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.7}
                onPress={handleDeleteAccount}
                testID="account-delete"
              >
                <View style={[styles.settingIcon, styles.settingIconDanger]}>
                  <Trash2 size={20} color={Colors.light.error} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, styles.settingTitleDanger]}>
                    Delete Account
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backendCard: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  backendHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backendTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  backendSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
  backendButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  backendButtonDisabled: {
    opacity: 0.7,
  },
  backendButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: -0.1,
  },
  backendStatusRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  backendDotIdle: {
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  backendDotChecking: {
    backgroundColor: "#F59E0B",
  },
  backendDotOk: {
    backgroundColor: "#22C55E",
  },
  backendDotError: {
    backgroundColor: "#EF4444",
  },
  backendStatusText: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  backendMetaText: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },

  
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: Colors.light.background,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  headerButtonPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.background,
  },
  headerButtonTextCancel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    paddingTop: 40,
    marginTop: -120,
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  createProfileButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  createProfileButtonText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.light.background,
  },
  profileCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  profilePicture: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  profilePictureImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 4,
  },

  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  profileBio: {
    fontSize: 15,
    color: Colors.light.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  currentCityContainer: {
    marginBottom: 16,
  },
  currentCityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#86EFAC",
    gap: 5,
    alignSelf: "flex-start",
  },
  currentCityLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#16A34A",
  },
  currentCityText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#15803D",
  },
  citiesVisited: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 16,
  },
  citiesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  citiesTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  citiesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  countryFlag: {
    fontSize: 20,
  },
  cityBadgeText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  cityChip: {
    backgroundColor: Colors.light.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cityChipText: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.light.text,
  },
  profilePictureEdit: {
    alignSelf: "center",
    marginBottom: 32,
    position: "relative",
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.light.background,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 16,
  },
  formHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: Colors.light.text,
  },
  authCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  authTitle: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  authSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.light.textSecondary,
    marginBottom: 14,
  },
  authHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  authModePills: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.light.textSecondary,
  },
  pillTextActive: {
    color: Colors.light.text,
  },
  authLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
  },
  authLoadingText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.light.textSecondary,
  },
  emailAuthWrap: {
    gap: 12,
  },
  inputGroup: {
    gap: 8,
  },
  authMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.light.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: `${Colors.light.primary}10`,
    borderWidth: 1,
    borderColor: `${Colors.light.primary}25`,
  },
  primaryAuthButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAuthButtonDisabled: {
    opacity: 0.6,
  },
  primaryAuthButtonText: {
    color: Colors.light.background,
    fontSize: 15,
    fontWeight: "800" as const,
    letterSpacing: 0.2,
  },
  authDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
    marginBottom: 2,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  authDividerText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.light.textSecondary,
  },
  signedInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  signedInBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  signedInBadgeText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: "#15803D",
  },
  signedInEmail: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  secondaryButton: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.light.text,
  },
  authActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundSecondary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingIconDanger: {
    backgroundColor: `${Colors.light.error}15`,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingTitleDanger: {
    color: Colors.light.error,
  },
  settingSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 68,
  },
});
