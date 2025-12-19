import React, { useState } from "react";
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
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";
import {
  User as UserIcon,
  ChevronRight,
  Camera,
  LogOut,
  Bell,
  Lock,
  HelpCircle,
  Settings,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import Colors from "@/constants/colors";
import { useUser } from "@/contexts/UserContext";

const { width } = Dimensions.get("window");

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

export default function AccountScreen() {
  const { user, updateProfile } = useUser();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.profile?.name || "");
  const [editBio, setEditBio] = useState(user.profile?.bio || "");
  const [editCurrentCity, setEditCurrentCity] = useState(user.profile?.currentCity || "");
  const [editCountriesVisited, setEditCountriesVisited] = useState(
    user.profile?.countriesVisited?.join(", ") || ""
  );

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
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive" },
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

  const visitedCount = user.profile?.countriesVisited?.length || 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.topBar}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
            >
              <ChevronRight size={24} color="#fff" style={{ transform: [{ rotate: "180deg" }] }} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingsButton}
              activeOpacity={0.8}
            >
              <Settings size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroSection}>
            <View style={styles.profilePictureContainer}>
              <View style={styles.profilePictureGlow} />
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
              <TouchableOpacity
                style={styles.cameraButtonNew}
                activeOpacity={0.8}
                onPress={handlePickImage}
              >
                <Camera size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Tours</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{visitedCount}</Text>
              <Text style={styles.statLabel}>Visited</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileInfoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{user.profile?.name}</Text>
            <TouchableOpacity
              style={styles.editButtonNew}
              onPress={() => setIsEditingProfile(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
              <ChevronRight size={16} color={Colors.light.primary} />
            </TouchableOpacity>
          </View>

          {user.profile?.currentCity && (
            <View style={styles.locationRow}>
              <Text style={styles.countryFlag}>{getCountryFlag(user.profile?.currentCity || "")}</Text>
              <Text style={styles.locationText}>{user.profile.currentCity}</Text>
            </View>
          )}

          {user.profile?.bio && (
            <Text style={styles.bioText}>{user.profile.bio}</Text>
          )}
        </View>

        {user.profile?.countriesVisited && user.profile.countriesVisited.length > 0 && (
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.travelCard}
          >
            <View style={styles.travelCardHeader}>
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
              <Text style={styles.travelCardTitle}>Travel Journey</Text>
              <Text style={styles.travelCardYear}>2025</Text>
            </View>
            <TouchableOpacity style={styles.unwrapButton} activeOpacity={0.9}>
              <Text style={styles.unwrapButtonText}>View Countries</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {user.profile?.countriesVisited && user.profile.countriesVisited.length > 0 && (
          <View style={styles.countriesSection}>
            <View style={styles.countriesHeader}>
              <Text style={styles.countriesSectionTitle}>Countries Visited</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.countriesGrid}>
              {user.profile.countriesVisited.slice(0, 6).map((country: string, index: number) => (
                <View key={index} style={styles.countryChip}>
                  <Text style={styles.countryFlagSmall}>{getCountryFlag(country)}</Text>
                  <Text style={styles.countryChipText} numberOfLines={1}>{country}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.settingsSection}>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
              <View style={styles.settingIconNew}>
                <Bell size={22} color={Colors.light.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Notifications</Text>
              </View>
              <ChevronRight size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
              <View style={styles.settingIconNew}>
                <Lock size={22} color={Colors.light.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Privacy & Security</Text>
              </View>
              <ChevronRight size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
              <View style={styles.settingIconNew}>
                <HelpCircle size={22} color={Colors.light.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Help & Support</Text>
              </View>
              <ChevronRight size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity
              style={styles.settingItem}
              activeOpacity={0.7}
              onPress={handleLogout}
            >
              <View style={styles.settingIconNew}>
                <LogOut size={22} color={Colors.light.error} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, styles.settingTitleDanger]}>
                  Logout
                </Text>
              </View>
              <ChevronRight size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  headerGradient: {
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 20,
  },
  profilePictureContainer: {
    position: "relative",
    marginBottom: 16,
  },
  profilePictureGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    ...Platform.select({
      ios: {
        shadowColor: "#fff",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  profilePicture: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
  },
  profilePictureImage: {
    width: "100%",
    height: "100%",
  },
  cameraButtonNew: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: -30,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  profileInfoSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  profileName: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  editButtonNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.primary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: "500" as const,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.text,
  },
  travelCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  travelCardHeader: {
    marginBottom: 20,
  },
  newBadge: {
    backgroundColor: "#1e3a8a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  newBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1,
  },
  travelCardTitle: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#fff",
    marginBottom: 4,
  },
  travelCardYear: {
    fontSize: 72,
    fontWeight: "900" as const,
    color: "rgba(255, 255, 255, 0.3)",
    lineHeight: 72,
    letterSpacing: -2,
  },
  unwrapButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  unwrapButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#667eea",
  },
  countriesSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  countriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  countriesSectionTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.light.text,
  },
  seeAllText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.primary,
  },
  countriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  countryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    maxWidth: (width - 60) / 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  countryFlagSmall: {
    fontSize: 24,
  },
  countryChipText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.light.text,
    flex: 1,
  },
  settingsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
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

  profileInfo: {
    flex: 1,
    gap: 8,
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
  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  settingIconNew: {
    marginRight: 16,
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
