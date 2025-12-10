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
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Account</Text>
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
