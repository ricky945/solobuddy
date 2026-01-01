import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
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
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Star, Camera, MapPin, Headphones } from "lucide-react-native";
import { usePlacement } from "expo-superwall";
import { useUser } from "@/contexts/UserContext";
import Colors from "@/constants/colors";
import { triggerHapticFeedback } from "@/lib/haptics";

const { width, height } = Dimensions.get("window");

// Default landmark images for welcome slide
const LANDMARK_IMAGES = [
  { uri: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800&q=80", name: "Eiffel Tower" },
  { uri: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80", name: "Colosseum" },
  { uri: "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?w=800&q=80", name: "Great Pyramids" },
  { uri: "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=800&q=80", name: "Big Ben" },
  { uri: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=800&q=80", name: "Statue of Liberty" },
  { uri: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80", name: "Taj Mahal" },
];

// Curated landmarks by city - historically important & iconic landmarks only
const CITY_LANDMARKS: Record<string, { name: string; imageUrl: string }[]> = {
  "rome": [
    { name: "Colosseum", imageUrl: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80" },
    { name: "Trevi Fountain", imageUrl: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800&q=80" },
    { name: "Pantheon", imageUrl: "https://images.unsplash.com/photo-1529260830199-42c24126f198?w=800&q=80" },
    { name: "Vatican Museums", imageUrl: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800&q=80" },
    { name: "Roman Forum", imageUrl: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80" },
  ],
  "paris": [
    { name: "Eiffel Tower", imageUrl: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=800&q=80" },
    { name: "Louvre Museum", imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80" },
    { name: "Notre-Dame Cathedral", imageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80" },
    { name: "Arc de Triomphe", imageUrl: "https://images.unsplash.com/photo-1549144511-f099e773c147?w=800&q=80" },
    { name: "Sacré-Cœur", imageUrl: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80" },
  ],
  "london": [
    { name: "Big Ben", imageUrl: "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=800&q=80" },
    { name: "Tower of London", imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80" },
    { name: "Buckingham Palace", imageUrl: "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=800&q=80" },
    { name: "Westminster Abbey", imageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80" },
    { name: "Tower Bridge", imageUrl: "https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=800&q=80" },
  ],
  "new york": [
    { name: "Statue of Liberty", imageUrl: "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=800&q=80" },
    { name: "Empire State Building", imageUrl: "https://images.unsplash.com/photo-1546436836-07a91091f160?w=800&q=80" },
    { name: "Brooklyn Bridge", imageUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80" },
    { name: "Central Park", imageUrl: "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800&q=80" },
    { name: "One World Trade Center", imageUrl: "https://images.unsplash.com/photo-1546436836-07a91091f160?w=800&q=80" },
  ],
  "san francisco": [
    { name: "Golden Gate Bridge", imageUrl: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&q=80" },
    { name: "Alcatraz Island", imageUrl: "https://images.unsplash.com/photo-1611212166534-cea2fd6ece01?w=800&q=80" },
    { name: "Painted Ladies", imageUrl: "https://images.unsplash.com/photo-1521747116042-5a810fda9664?w=800&q=80" },
    { name: "Coit Tower", imageUrl: "https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=800&q=80" },
    { name: "Palace of Fine Arts", imageUrl: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&q=80" },
  ],
  "tokyo": [
    { name: "Senso-ji Temple", imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80" },
    { name: "Tokyo Tower", imageUrl: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80" },
    { name: "Meiji Shrine", imageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&q=80" },
    { name: "Imperial Palace", imageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80" },
    { name: "Tokyo Skytree", imageUrl: "https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80" },
  ],
  "barcelona": [
    { name: "Sagrada Família", imageUrl: "https://images.unsplash.com/photo-1558642084-fd07fae5282e?w=800&q=80" },
    { name: "Park Güell", imageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80" },
    { name: "Casa Batlló", imageUrl: "https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?w=800&q=80" },
    { name: "Gothic Quarter", imageUrl: "https://images.unsplash.com/photo-1558642084-fd07fae5282e?w=800&q=80" },
    { name: "La Rambla", imageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80" },
  ],
  "chicago": [
    { name: "Willis Tower", imageUrl: "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80" },
    { name: "Cloud Gate", imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80" },
    { name: "Navy Pier", imageUrl: "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=800&q=80" },
    { name: "Millennium Park", imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80" },
    { name: "Wrigley Building", imageUrl: "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=800&q=80" },
  ],
  "athens": [
    { name: "Acropolis", imageUrl: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80" },
    { name: "Parthenon", imageUrl: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=800&q=80" },
    { name: "Temple of Olympian Zeus", imageUrl: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80" },
    { name: "Ancient Agora", imageUrl: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb?w=800&q=80" },
    { name: "Acropolis Museum", imageUrl: "https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&q=80" },
  ],
  "istanbul": [
    { name: "Hagia Sophia", imageUrl: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80" },
    { name: "Blue Mosque", imageUrl: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=80" },
    { name: "Topkapı Palace", imageUrl: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80" },
    { name: "Grand Bazaar", imageUrl: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=800&q=80" },
    { name: "Galata Tower", imageUrl: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80" },
  ],
  "amsterdam": [
    { name: "Anne Frank House", imageUrl: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80" },
    { name: "Rijksmuseum", imageUrl: "https://images.unsplash.com/photo-1459679749680-18eb1eb37418?w=800&q=80" },
    { name: "Van Gogh Museum", imageUrl: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80" },
    { name: "Royal Palace", imageUrl: "https://images.unsplash.com/photo-1459679749680-18eb1eb37418?w=800&q=80" },
    { name: "Westerkerk", imageUrl: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80" },
  ],
  "berlin": [
    { name: "Brandenburg Gate", imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80" },
    { name: "Berlin Wall Memorial", imageUrl: "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=800&q=80" },
    { name: "Reichstag Building", imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80" },
    { name: "Checkpoint Charlie", imageUrl: "https://images.unsplash.com/photo-1599946347371-68eb71b16afc?w=800&q=80" },
    { name: "Berlin Cathedral", imageUrl: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80" },
  ],
  "vienna": [
    { name: "Schönbrunn Palace", imageUrl: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&q=80" },
    { name: "St. Stephen's Cathedral", imageUrl: "https://images.unsplash.com/photo-1609856878074-cf31e21ccb6b?w=800&q=80" },
    { name: "Hofburg Palace", imageUrl: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&q=80" },
    { name: "Belvedere Palace", imageUrl: "https://images.unsplash.com/photo-1609856878074-cf31e21ccb6b?w=800&q=80" },
    { name: "Vienna State Opera", imageUrl: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&q=80" },
  ],
  "prague": [
    { name: "Charles Bridge", imageUrl: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80" },
    { name: "Prague Castle", imageUrl: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80" },
    { name: "Old Town Square", imageUrl: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80" },
    { name: "Astronomical Clock", imageUrl: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80" },
    { name: "St. Vitus Cathedral", imageUrl: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80" },
  ],
  "dubai": [
    { name: "Burj Khalifa", imageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
    { name: "Dubai Fountain", imageUrl: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80" },
    { name: "Burj Al Arab", imageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
    { name: "Dubai Frame", imageUrl: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80" },
    { name: "Museum of the Future", imageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
  ],
  "sydney": [
    { name: "Sydney Opera House", imageUrl: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80" },
    { name: "Sydney Harbour Bridge", imageUrl: "https://images.unsplash.com/photo-1523428099323-76b51f85f6b7?w=800&q=80" },
    { name: "The Rocks", imageUrl: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80" },
    { name: "Bondi Beach", imageUrl: "https://images.unsplash.com/photo-1523428099323-76b51f85f6b7?w=800&q=80" },
    { name: "Royal Botanic Garden", imageUrl: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80" },
  ],
  "los angeles": [
    { name: "Hollywood Sign", imageUrl: "https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=800&q=80" },
    { name: "Griffith Observatory", imageUrl: "https://images.unsplash.com/photo-1518416177092-ec985e8c4788?w=800&q=80" },
    { name: "Santa Monica Pier", imageUrl: "https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=800&q=80" },
    { name: "Getty Center", imageUrl: "https://images.unsplash.com/photo-1518416177092-ec985e8c4788?w=800&q=80" },
    { name: "Walt Disney Concert Hall", imageUrl: "https://images.unsplash.com/photo-1534190239940-9ba8944ea261?w=800&q=80" },
  ],
  "seattle": [
    { name: "Space Needle", imageUrl: "https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=800&q=80" },
    { name: "Pike Place Market", imageUrl: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80" },
    { name: "Chihuly Garden and Glass", imageUrl: "https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=800&q=80" },
    { name: "Museum of Pop Culture", imageUrl: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80" },
    { name: "Kerry Park", imageUrl: "https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=800&q=80" },
  ],
  "miami": [
    { name: "Art Deco Historic District", imageUrl: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=800&q=80" },
    { name: "Vizcaya Museum", imageUrl: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80" },
    { name: "Wynwood Walls", imageUrl: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=800&q=80" },
    { name: "Freedom Tower", imageUrl: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80" },
    { name: "Bayside Marketplace", imageUrl: "https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=800&q=80" },
  ],
  "boston": [
    { name: "Freedom Trail", imageUrl: "https://images.unsplash.com/photo-1554488563-734c5b7990c5?w=800&q=80" },
    { name: "Faneuil Hall", imageUrl: "https://images.unsplash.com/photo-1601024445121-e5b82f020549?w=800&q=80" },
    { name: "Old State House", imageUrl: "https://images.unsplash.com/photo-1554488563-734c5b7990c5?w=800&q=80" },
    { name: "Boston Common", imageUrl: "https://images.unsplash.com/photo-1601024445121-e5b82f020549?w=800&q=80" },
    { name: "USS Constitution", imageUrl: "https://images.unsplash.com/photo-1554488563-734c5b7990c5?w=800&q=80" },
  ],
  "washington": [
    { name: "Lincoln Memorial", imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80" },
    { name: "Washington Monument", imageUrl: "https://images.unsplash.com/photo-1617581629397-a72507c3de9e?w=800&q=80" },
    { name: "U.S. Capitol", imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80" },
    { name: "White House", imageUrl: "https://images.unsplash.com/photo-1617581629397-a72507c3de9e?w=800&q=80" },
    { name: "National Mall", imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80" },
  ],
};

// Passport mascot image URL
const PASSPORT_MASCOT = "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/renps5x3u8toqdey782pi";

// Pain point options from existing onboarding
const PAIN_POINT_OPTIONS = [
  { id: "tiktoks", text: "Too many TikToks & YT videos to watch" },
  { id: "expensive", text: "Tours are too slow or expensive" },
  { id: "custom", text: "Want something fast, easy & custom to me" },
  { id: "planning", text: "Trip planning is stressful" },
  { id: "time", text: "Not enough time to research" },
];

// Reviews for final slide
const REVIEWS = [
  {
    name: "Sarah M.",
    title: "Perfect for solo travelers",
    text: "This app made exploring Rome so much easier. The audio tours were informative and the route suggestions helped me discover places I wouldn't have found on my own.",
    rating: 5,
  },
  {
    name: "James K.",
    title: "Great walking tours",
    text: "Used this in Barcelona and it was fantastic. The landmark information was detailed and the offline maps saved me so much data. Highly recommend.",
    rating: 5,
  },
  {
    name: "Emma L.",
    title: "Love the audio guides",
    text: "The audio tours feel like having a knowledgeable friend showing you around. Much better than reading from a guidebook while trying to navigate.",
    rating: 5,
  },
  {
    name: "Michael R.",
    title: "Worth every penny",
    text: "Saved me from buying expensive guided tours. The app is well designed and the content is actually interesting, not just dry facts.",
    rating: 5,
  },
  {
    name: "Lisa T.",
    title: "Excellent for discovering",
    text: "Found so many hidden gems I would have missed otherwise. The walking routes are well-paced and the recommendations were spot on.",
    rating: 5,
  },
];

// ============ DEMO ASSETS - Used consistently across all onboarding demos ============

// Demo image for Landmark Analyzer (Colosseum)
const DEMO_LANDMARK_IMAGE = "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=90";
const DEMO_LANDMARK_NAME = "The Colosseum";
const DEMO_LANDMARK_ANALYSIS = `The Colosseum, also known as the Flavian Amphitheatre, is an iconic symbol of Imperial Rome. Built between 70-80 AD under Emperor Vespasian, this massive amphitheater could hold up to 80,000 spectators.

Standing at 157 feet tall, it was the largest amphitheater ever built and remains the largest standing amphitheater in the world today. The arena hosted gladiatorial contests, public spectacles, animal hunts, and even mock naval battles.

The Colosseum's innovative design included 80 entrances and a complex system of underground tunnels called the hypogeum, where gladiators and animals waited before their dramatic entrances through trapdoors into the arena above.`;

// Demo locations for Discover/Explore tab
const DEMO_LOCATIONS = [
  {
    id: "1",
    name: "Hidden Trattoria da Mario",
    type: "Restaurant",
    rating: 4.8,
    distance: "0.3 km",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80",
  },
  {
    id: "2", 
    name: "Secret Viewpoint",
    type: "Attraction",
    rating: 4.9,
    distance: "0.5 km",
    image: "https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=400&q=80",
  },
  {
    id: "3",
    name: "Local Artisan Market",
    type: "Shopping",
    rating: 4.6,
    distance: "0.8 km",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80",
  },
];

// Demo tour for Audio Tours
const DEMO_TOUR = {
  title: "Rome: Ancient History",
  duration: "25 min",
  stops: 5,
  topics: ["History", "Architecture", "Culture"],
  image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80",
};

type OnboardingStep =
  | "welcome"
  | "did-you-know"
  | "name"
  | "on-trip"
  | "planning-trip"
  | "excited-city"        // What city are you most excited to visit?
  | "trip-days"
  | "cities-count"
  | "tourist-points"
  | "save-intro"
  | "cost-calculation"
  | "savings-reveal"
  | "pain-research"       // Do you find researching stressful?
  | "pain-missed"         // Do you feel you missed out?
  | "did-you-know-context" // Research about contextual info
  | "feature-intro"       // Solobuddy intro text
  | "audio-tour-demo"     // FIRST: Full-screen Audio Tour experience
  | "feature-landmark"    // Static phone mockup for landmark analyzer
  | "feature-discover"    // Static phone mockup for discover/organize
  | "reviews"
  | "creating-plan"       // Loading screen - creating custom plan
  | "suggestions";        // Personalized suggestions based on answers

// Demo state for audio tour - mimics actual app flow
type AudioTourDemoState = 
  | "intro"             // New intro page showcasing what's possible
  | "tour-type"         // Choose tour type (all 3 types shown)
  | "location"          // Enter location (Rome pre-filled)
  | "topics"            // Select interests
  | "generating"        // Tour being generated
  | "library";          // Show tour in library

const BLUE = "#1E88E5";
const LIGHT_BLUE = "#E3F2FD";

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateUser } = useUser();
  
  // Superwall paywall integration
  const { registerPlacement, state: paywallState } = usePlacement({
    onPresent: (info) => console.log("[Superwall] ✅ Paywall presented:", info.name),
    onDismiss: (info, result) => {
      console.log("[Superwall] Paywall dismissed:", result.type);
      // After paywall interaction, navigate to main app
      console.log("[Onboarding] Navigating to main app");
      router.replace("/(tabs)");
    },
    onSkip: (reason) => {
      console.log("[Superwall] ⚠️ Paywall skipped:", reason.type);
      // If paywall is skipped, navigate to main app
      console.log("[Onboarding] Navigating to main app");
      router.replace("/(tabs)");
    },
    onError: (error) => {
      console.error("[Superwall] ❌ Error:", error);
      // On error, still allow user to continue to main app
      console.log("[Onboarding] Navigating to main app");
      router.replace("/(tabs)");
    },
  });
  
  // Monitor state changes
  useEffect(() => {
    console.log("[Superwall] State changed:", paywallState.status);
    if (paywallState.status === 'skipped') {
      console.log("[Superwall] Skipped reason:", JSON.stringify(paywallState.reason));
    } else if (paywallState.status === 'error') {
      console.log("[Superwall] Error:", paywallState.error);
    }
  }, [paywallState]);
  
  console.log("[Onboarding] Screen mounted");
  
  // Step management
  const [step, setStep] = useState<OnboardingStep>("welcome");
  
  // User data
  const [userName, setUserName] = useState<string>("");
  const [onTrip, setOnTrip] = useState<boolean | null>(null);
  const [tripDays, setTripDays] = useState<string>("");
  const [citiesCount, setCitiesCount] = useState<string>("");
  const [touristPoints, setTouristPoints] = useState<string>("");
  const [painPoint, setPainPoint] = useState<string>("");
  
  // Location and landmarks data for final slide
  const [userCity, setUserCity] = useState<string>("your area");
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [cityLandmarks, setCityLandmarks] = useState<{ name: string; imageUrl: string }[]>([]);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const carouselAnim = useRef(new Animated.Value(0)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;
  const headlineFadeAnim = useRef(new Animated.Value(0)).current;
  
  // Carousel
  const [currentLandmarkIndex, setCurrentLandmarkIndex] = useState(0);
  const carouselInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save intro slide animations (moved to top level for hooks rules)
  const [saveIntroPhase, setSaveIntroPhase] = useState(0);
  const congratsFadeAnim = useRef(new Animated.Value(0)).current;
  const savingsFadeAnim = useRef(new Animated.Value(0)).current;
  const saveButtonFadeAnim = useRef(new Animated.Value(0)).current;

  // Demo animations (shared across demo slides)
  const demoFadeAnim = useRef(new Animated.Value(1)).current;

  // Audio tour demo state - mimics actual app flow
  const [audioTourDemoState, setAudioTourDemoState] = useState<AudioTourDemoState>("intro");
  
  // Landmark feature demo animations
  const [landmarkDemoPlayed, setLandmarkDemoPlayed] = useState(false);
  const [landmarkPhase, setLandmarkPhase] = useState<"camera" | "analyzing" | "result">("camera");
  const landmarkFlashAnim = useRef(new Animated.Value(0)).current;
  const landmarkImageAnim = useRef(new Animated.Value(0)).current;
  const landmarkTextSlideAnim = useRef(new Animated.Value(50)).current;
  const landmarkTextFadeAnim = useRef(new Animated.Value(0)).current;
  const landmarkAnalyzingFadeAnim = useRef(new Animated.Value(0)).current;
  const landmarkAnalyzingDotsAnim = useRef(new Animated.Value(0)).current;
  
  // Generating button fade animation
  const generatingButtonFadeAnim = useRef(new Animated.Value(0)).current;
  
  // Tour created card fade animation
  const tourCreatedCardFadeAnim = useRef(new Animated.Value(0)).current;
  
  // Demo animation refs
  const highlightPulseAnim = useRef(new Animated.Value(1)).current;
  const arrowBounceAnim = useRef(new Animated.Value(0)).current;
  const cameraFlashAnim = useRef(new Animated.Value(0)).current;
  const progressBarAnim = useRef(new Animated.Value(0)).current;

  // Calculate savings
  const getMaxTouristPoints = () => {
    if (touristPoints === "1-2") return 2;
    if (touristPoints === "2-4") return 4;
    if (touristPoints === "+5") return 6;
    return 4;
  };

  const calculateTotalCost = () => {
    const cities = parseInt(citiesCount) || 2;
    const points = getMaxTouristPoints();
    return cities * points * 20;
  };

  const getRecommendedPlan = () => {
    const days = parseInt(tripDays) || 7;
    return days > 7 ? "yearly" : "weekly";
  };

  const getPlanPrice = () => {
    return getRecommendedPlan() === "yearly" ? 29.99 : 9.99;
  };

  const calculateSavings = () => {
    const totalCost = calculateTotalCost();
    const planPrice = getPlanPrice();
    return totalCost - planPrice;
  };

  const calculateSavingsPercent = () => {
    const planPrice = getPlanPrice();
    const savings = calculateSavings();
    // Calculate how much MORE EXPENSIVE the old way is (can exceed 100%)
    return Math.round((savings / planPrice) * 100);
  };

  // Animated transition between steps
  const transitionToStep = (nextStep: OnboardingStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Fade in elements on mount
  useEffect(() => {
    Animated.sequence([
      Animated.timing(headlineFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(buttonFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Carousel auto-scroll
  useEffect(() => {
    if (step === "welcome") {
      carouselInterval.current = setInterval(() => {
        setCurrentLandmarkIndex((prev) => (prev + 1) % LANDMARK_IMAGES.length);
      }, 3000);
    }
    return () => {
      if (carouselInterval.current) {
        clearInterval(carouselInterval.current);
      }
    };
  }, [step]);

  // Animate carousel transition
  useEffect(() => {
    Animated.sequence([
      Animated.timing(carouselAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(carouselAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentLandmarkIndex]);

  // Save intro slide animation sequence
  useEffect(() => {
    if (step === "save-intro") {
      // Reset animations
      setSaveIntroPhase(0);
      congratsFadeAnim.setValue(0);
      savingsFadeAnim.setValue(0);
      saveButtonFadeAnim.setValue(0);

      // Phase 0: Fade in congratulations
      Animated.timing(congratsFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        // Wait then fade out
        setTimeout(() => {
          Animated.timing(congratsFadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            setSaveIntroPhase(1);
            // Phase 1: Fade in savings text
            Animated.timing(savingsFadeAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }).start(() => {
              // Phase 2: Fade in button
              setTimeout(() => {
                Animated.timing(saveButtonFadeAnim, {
                  toValue: 1,
                  duration: 400,
                  useNativeDriver: true,
                }).start();
              }, 300);
            });
          });
        }, 1500);
      });
    }
  }, [step]);

  // Audio tour demo - reset state when entering
  useEffect(() => {
    if (step === "audio-tour-demo") {
      setAudioTourDemoState("intro");
      demoFadeAnim.setValue(1);
    }
  }, [step]);
  
  // Generating button fade-in after 2 seconds
  useEffect(() => {
    if (audioTourDemoState === "generating") {
      generatingButtonFadeAnim.setValue(0);
      const timer = setTimeout(() => {
        Animated.timing(generatingButtonFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [audioTourDemoState]);
  
  // Tour created card fade-in after 1 second
  useEffect(() => {
    if (audioTourDemoState === "library") {
      tourCreatedCardFadeAnim.setValue(0);
      const timer = setTimeout(() => {
        Animated.timing(tourCreatedCardFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [audioTourDemoState]);
  
  // Landmark feature demo animation sequence
  useEffect(() => {
    if (step === "feature-landmark" && !landmarkDemoPlayed) {
      setLandmarkDemoPlayed(true);
      setLandmarkPhase("camera");
      
      // Reset animations
      landmarkFlashAnim.setValue(0);
      landmarkImageAnim.setValue(0);
      landmarkTextSlideAnim.setValue(60);
      landmarkTextFadeAnim.setValue(0);
      landmarkAnalyzingFadeAnim.setValue(0);
      
      // Animation sequence: Wait → Flash → Image appears → Analyzing → Result
      Animated.sequence([
        // Wait 0.5 seconds before flash so user can see the camera viewfinder
        Animated.delay(500),
        // Camera flash effect (slower)
        Animated.sequence([
          Animated.timing(landmarkFlashAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(landmarkFlashAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
        // Image fades in
        Animated.timing(landmarkImageAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // After image appears, show analyzing phase
        setLandmarkPhase("analyzing");
        Animated.timing(landmarkAnalyzingFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
        
        // Wait 2 seconds then transition to result
        setTimeout(() => {
          Animated.timing(landmarkAnalyzingFadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setLandmarkPhase("result");
            // Text slides up and fades in
            Animated.parallel([
              Animated.timing(landmarkTextSlideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(landmarkTextFadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
            ]).start();
          });
        }, 2000);
      });
    }
  }, [step, landmarkDemoPlayed]);
  
  // Reset landmark demo when leaving the step
  useEffect(() => {
    if (step !== "feature-landmark") {
      setLandmarkDemoPlayed(false);
      setLandmarkPhase("camera");
    }
  }, [step]);
  
  // Demo step transition animation
  const transitionDemoStep = (nextState: AudioTourDemoState) => {
    Animated.timing(demoFadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setAudioTourDemoState(nextState);
      Animated.timing(demoFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleComplete = async () => {
    console.log("[Onboarding] 🎯 handleComplete called");
    
    // Save onboarding data
    updateUser({ 
      hasCompletedOnboarding: true,
      name: userName || undefined,
      onboarding: {
        onTrip,
        tripDays: parseInt(tripDays) || undefined,
        citiesCount: parseInt(citiesCount) || undefined,
        touristPoints,
        painPoint,
      },
    });
    
    console.log("[Onboarding] 💾 User data saved");
    console.log("[Onboarding] Triggering paywall");
    
    // Trigger the Superwall paywall
    try {
      await registerPlacement({
        placement: "onboarding_complete",
        params: { source: "onboarding" },
        feature: () => {
          console.log("[Onboarding] User has access or completed paywall flow");
          // The onDismiss/onSkip/onError callbacks will handle navigation
        }
      });
    } catch (error) {
      console.error("[Onboarding] Error showing paywall:", error);
      // On error, navigate to main app
      router.replace("/(tabs)");
    }
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
    handleComplete();
  };

  const renderProgressBar = () => {
    const steps: OnboardingStep[] = [
      "welcome", "did-you-know", "name", "on-trip", "planning-trip", "excited-city", "trip-days", "cities-count", "tourist-points",
      "save-intro", "cost-calculation", "savings-reveal", "pain-research", "pain-missed", "did-you-know-context",
      "feature-intro", "audio-tour-demo", "feature-landmark", "feature-discover",
      "reviews", "creating-plan", "suggestions",
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

  // ============ SLIDE RENDERS ============

  const carouselScrollRef = useRef<ScrollView>(null);
  const autoScrollPosition = useRef(0);

  // Create extended image list for infinite loop effect
  const extendedImages = [...LANDMARK_IMAGES, ...LANDMARK_IMAGES, ...LANDMARK_IMAGES];
  const cardWidth = width * 0.38 + 20; // card width + margins
  const singleSetWidth = LANDMARK_IMAGES.length * cardWidth;

  // Auto-scroll carousel very slowly and loop
  useEffect(() => {
    if (step === "welcome") {
      // Start from middle set
      autoScrollPosition.current = singleSetWidth;
      setTimeout(() => {
        carouselScrollRef.current?.scrollTo({ x: singleSetWidth, animated: false });
      }, 100);

      const scrollInterval = setInterval(() => {
        if (carouselScrollRef.current) {
          autoScrollPosition.current += 0.3; // Very slow movement
          carouselScrollRef.current.scrollTo({
            x: autoScrollPosition.current,
            animated: false,
          });
        }
      }, 50);

      return () => clearInterval(scrollInterval);
    }
  }, [step, singleSetWidth]);

  // Handle scroll position for infinite loop
  const handleCarouselScroll = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    autoScrollPosition.current = scrollX;
    
    // If scrolled past the third set, jump back to second set
    if (scrollX >= singleSetWidth * 2 - 50) {
      const newX = scrollX - singleSetWidth;
      autoScrollPosition.current = newX;
      carouselScrollRef.current?.scrollTo({ x: newX, animated: false });
    }
    // If scrolled before the first set, jump to second set
    else if (scrollX <= 50) {
      const newX = scrollX + singleSetWidth;
      autoScrollPosition.current = newX;
      carouselScrollRef.current?.scrollTo({ x: newX, animated: false });
    }
  };

  const renderWelcomeSlide = () => (
    <View style={styles.welcomeContainer}>
      {/* App Name with Mascot */}
      <Animated.View style={[styles.logoContainer, { opacity: headlineFadeAnim }]}>
        <View style={styles.titleRow}>
        <Image
            source={{ uri: PASSPORT_MASCOT }}
            style={styles.mascotIcon}
          resizeMode="contain"
        />
          <Text style={styles.appName}>solobuddy</Text>
      </View>
        <Text style={styles.tagline}>
          Explore the world more easily with custom audio tours & squeeze the most from your trip
        </Text>
      </Animated.View>

      {/* Horizontal Scrollable Carousel - Infinite Loop */}
      <View style={styles.carouselSection}>
        <ScrollView
          ref={carouselScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselScrollContent}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={handleCarouselScroll}
          onScrollBeginDrag={() => {
            // User started dragging - could pause auto-scroll here if needed
          }}
        >
          {extendedImages.map((landmark, index) => {
            // Create floating effect with different rotations and offsets
            const rotations = [-6, 4, -3, 5, -4, 3];
            const offsets = [12, -8, 16, -12, 8, -16];
            const baseIndex = index % LANDMARK_IMAGES.length;
            const rotation = rotations[baseIndex % rotations.length];
            const offset = offsets[baseIndex % offsets.length];

            return (
              <View
                key={`${landmark.name}-${index}`}
                style={[
                  styles.polaroidCard,
                  {
                    transform: [
                      { rotate: `${rotation}deg` },
                      { translateY: offset },
                    ],
                  },
                ]}
              >
                {/* Polaroid inner frame */}
                <View style={styles.polaroidInner}>
                  <Image
                    source={{ uri: landmark.uri }}
                    style={styles.polaroidImage}
                    resizeMode="cover"
                  />
                </View>
                {/* Caption area like polaroid bottom */}
                <View style={styles.polaroidCaption}>
                  <Text style={styles.polaroidName}>{landmark.name}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* CTA Button */}
      <Animated.View style={[styles.ctaContainer, { opacity: buttonFadeAnim }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("did-you-know");
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Start Creating Tours</Text>
        </TouchableOpacity>
      </Animated.View>
      </View>
  );

  // Did You Know slide - showcasing research backing
  const renderDidYouKnowSlide = () => (
    <View style={styles.didYouKnowContainer}>
      {/* Main Content */}
      <View style={styles.didYouKnowContent}>
        <Text style={styles.didYouKnowTitle}>Did you know?</Text>
        
        {/* Dashed border card */}
        <View style={styles.didYouKnowCard}>
          <Text style={styles.didYouKnowText}>
            SoloBuddy is powered by <Text style={styles.textBlue}>hundreds of peer-reviewed documents</Text>, travel blogs, and expert sources to provide you with accurate, trustworthy information.
          </Text>
          
          {/* Stats inside the card */}
          <View style={styles.didYouKnowStats}>
            <View style={styles.didYouKnowStat}>
              <Text style={styles.didYouKnowStatNumber}>500+</Text>
              <Text style={styles.didYouKnowStatLabel}>Research Papers</Text>
            </View>
            <View style={styles.didYouKnowStatDivider} />
            <View style={styles.didYouKnowStat}>
              <Text style={styles.didYouKnowStatNumber}>1000+</Text>
              <Text style={styles.didYouKnowStatLabel}>Travel Sources</Text>
            </View>
          </View>
        </View>
      </View>
      
      {/* Button */}
      <View style={styles.didYouKnowButtonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("name");
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNameSlide = () => (
    <KeyboardAvoidingView 
      style={styles.slideContainer} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>What is your name?</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your name"
          placeholderTextColor="#A0A0A0"
          value={userName}
          onChangeText={setUserName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            transitionToStep("on-trip");
          }}
        />
        <TouchableOpacity
          style={[styles.primaryButton, !userName.trim() && styles.buttonDisabled]}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("on-trip");
          }}
          disabled={!userName.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
    </View>
    </KeyboardAvoidingView>
  );

  const renderOnTripSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>Are you currently on a trip?</Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.optionButton, onTrip === true && styles.optionButtonSelected]}
            onPress={() => {
              triggerHapticFeedback();
              setOnTrip(true);
              setTimeout(() => transitionToStep("trip-days"), 200);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, onTrip === true && styles.optionTextSelected]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, onTrip === false && styles.optionButtonSelected]}
            onPress={() => {
              triggerHapticFeedback();
              setOnTrip(false);
              setTimeout(() => transitionToStep("planning-trip"), 200);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, onTrip === false && styles.optionTextSelected]}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const [planningTrip, setPlanningTrip] = useState<boolean | null>(null);
  const [excitedCity, setExcitedCity] = useState<string>("");

  const renderPlanningTripSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>Are you currently planning a trip?</Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.optionButton, planningTrip === true && styles.optionButtonSelected]}
            onPress={() => {
              setPlanningTrip(true);
              setTimeout(() => transitionToStep("excited-city"), 200);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, planningTrip === true && styles.optionTextSelected]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, planningTrip === false && styles.optionButtonSelected]}
            onPress={() => {
              triggerHapticFeedback();
              setPlanningTrip(false);
              setTimeout(() => transitionToStep("trip-days"), 200);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, planningTrip === false && styles.optionTextSelected]}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderExcitedCitySlide = () => {
    const handleCitySubmit = () => {
      if (excitedCity.trim()) {
        Keyboard.dismiss();
        setTimeout(() => transitionToStep("trip-days"), 200);
      }
    };

    return (
      <TouchableOpacity 
        style={styles.slideContainer} 
        activeOpacity={1} 
        onPress={() => Keyboard.dismiss()}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.questionContainer}
        >
          <Text style={styles.questionText}>What city are you most excited to visit in your trip?</Text>
          <TextInput
            style={styles.textInput}
            value={excitedCity}
            onChangeText={setExcitedCity}
            placeholder="e.g. Paris, Tokyo, Rome..."
            placeholderTextColor="#999"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleCitySubmit}
            blurOnSubmit={true}
            enablesReturnKeyAutomatically={true}
          />
          <TouchableOpacity
            style={[styles.continueButton, !excitedCity.trim() && styles.continueButtonDisabled]}
            onPress={handleCitySubmit}
            disabled={!excitedCity.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    );
  };

  const renderTripDaysSlide = () => (
    <KeyboardAvoidingView 
      style={styles.slideContainer} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>How many days will you be out?</Text>
        <TextInput
          style={styles.numberInput}
          placeholder="0"
          placeholderTextColor="#A0A0A0"
          value={tripDays}
          onChangeText={(text) => setTripDays(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
          autoFocus
        />
          <TouchableOpacity
          style={[styles.primaryButton, !tripDays && styles.buttonDisabled]}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("cities-count");
          }}
          disabled={!tripDays}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderCitiesCountSlide = () => (
    <KeyboardAvoidingView 
      style={styles.slideContainer} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>How many cities will you be visiting?</Text>
        <TextInput
          style={styles.numberInput}
          placeholder="0"
          placeholderTextColor="#A0A0A0"
          value={citiesCount}
          onChangeText={(text) => setCitiesCount(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={2}
          autoFocus
        />
          <TouchableOpacity
          style={[styles.primaryButton, !citiesCount && styles.buttonDisabled]}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("tourist-points");
          }}
          disabled={!citiesCount}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderTouristPointsSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>
          How many touristic points will you visit in every city?
        </Text>
        <Text style={styles.questionSubtext}>(museums, attractions, etc.)</Text>
        <View style={styles.pointsOptionsContainer}>
          {["1-2", "2-4", "+5"].map((option) => (
          <TouchableOpacity
              key={option}
              style={[
                styles.pointsOption,
                touristPoints === option && styles.pointsOptionSelected,
              ]}
            onPress={() => {
                triggerHapticFeedback();
                setTouristPoints(option);
                setTimeout(() => transitionToStep("save-intro"), 200);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pointsOptionText,
                  touristPoints === option && styles.pointsOptionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderSaveIntroSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.centeredContent}>
        {saveIntroPhase === 0 ? (
          <Animated.Text style={[styles.highlightText, { opacity: congratsFadeAnim }]}>
             Congratulations{userName ? `, ${userName}` : ""}! 🎉
          </Animated.Text>
        ) : (
          <>
            <Animated.Text style={[styles.highlightText, { opacity: savingsFadeAnim }]}>
              <Text style={styles.textBlue}>SoloBuddy</Text> can help you{"\n"}
              <Text style={styles.textBlue}>save $$</Text>
            </Animated.Text>
            <Animated.View style={{ opacity: saveButtonFadeAnim }}>
          <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => transitionToStep("cost-calculation")}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>See How</Text>
          </TouchableOpacity>
            </Animated.View>
          </>
        )}
        </View>
    </View>
  );

  const renderCostCalculationSlide = () => {
    const totalCost = calculateTotalCost();
    return (
      <View style={styles.slideContainer}>
        <View style={styles.centeredContent}>
          <Text style={styles.calculationText}>
            If you get the cheapest tours possible at{" "}
            <Text style={styles.textBlue}>$20 each</Text>, you are going to spend on average
        </Text>
          <Text style={styles.bigNumber}>${totalCost}</Text>
          <Text style={styles.calculationSubtext}>on this trip on tours alone</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => transitionToStep("savings-reveal")}
            activeOpacity={0.8}
          >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  };

  const renderSavingsRevealSlide = () => {
    const totalCost = calculateTotalCost();
    const savings = calculateSavings();
    const savingsPercent = calculateSavingsPercent();
    const planPrice = getPlanPrice();
    const plan = getRecommendedPlan();
    
    const maxBarHeight = 150;
    const normalBarHeight = maxBarHeight;
    const solobuddyBarHeight = (planPrice / totalCost) * maxBarHeight;

    return (
    <View style={styles.slideContainer}>
        <ScrollView contentContainerStyle={styles.savingsScrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.savingsContent}>
            <Text style={styles.savingsTitle}>
              Tours cost{" "}
              <Text style={styles.textBlue}>{savingsPercent}%</Text> more{"\n"}
              without SoloBuddy!
          </Text>
            <Text style={styles.savingsSubtitle}>That's <Text style={styles.textBlue}>${savings.toFixed(0)}</Text> in extra costs</Text>

            {/* Bar Graph */}
            <View style={styles.barGraphContainer}>
              <View style={styles.barWrapper}>
                <Text style={styles.barLabel}>${totalCost}</Text>
                <View style={[styles.bar, styles.barGrey, { height: normalBarHeight }]} />
                <Text style={styles.barCaption}>Normal</Text>
              </View>
              <View style={styles.barWrapper}>
                <Text style={styles.barLabel}>${planPrice}</Text>
                <View style={[styles.bar, styles.barBlue, { height: Math.max(solobuddyBarHeight, 30) }]} />
                <Text style={styles.barCaption}>SoloBuddy</Text>
              </View>
            </View>

            <Text style={styles.planNote}>
              {plan === "yearly" ? "Annual" : "Weekly"} plan recommended for your {tripDays}-day trip
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                triggerHapticFeedback();
                transitionToStep("pain-research");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
      </View>
        </ScrollView>
    </View>
  );
  };

  // Pain Point 1: Research stress
  const renderPainResearchSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.painQuestionContainer}>
        <Text style={styles.painQuestionEmoji}>🔍</Text>
        <Text style={styles.painQuestionText}>
          Do you find researching new cities <Text style={styles.textBlue}>stressful</Text> & too time consuming?
              </Text>
        <View style={styles.painYesNoContainer}>
          <TouchableOpacity
            style={styles.painYesButton}
            onPress={() => {
              triggerHapticFeedback();
              transitionToStep("pain-missed");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.painYesButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
            style={styles.painNoButton}
            onPress={() => {
              triggerHapticFeedback();
              transitionToStep("pain-missed");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.painNoButtonText}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Pain Point 2: Missed experiences
  const renderPainMissedSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.painQuestionContainer}>
        <Text style={styles.painQuestionEmoji}>😔</Text>
        <Text style={styles.painQuestionText}>
          Do you leave trips feeling you <Text style={styles.textBlue}>missed out</Text> on insightful context or that you walked past interesting places unknowingly?
        </Text>
        <View style={styles.painYesNoContainer}>
          <TouchableOpacity
            style={styles.painYesButton}
            onPress={() => {
              triggerHapticFeedback();
              transitionToStep("did-you-know-context");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.painYesButtonText}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.painNoButton}
            onPress={() => {
              triggerHapticFeedback();
              transitionToStep("did-you-know-context");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.painNoButtonText}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Did You Know - Context Research
  const renderDidYouKnowContextSlide = () => (
    <View style={styles.didYouKnowContainer}>
      {/* Main Content */}
      <View style={styles.didYouKnowContent}>
        <Text style={styles.didYouKnowTitle}>Did you know?</Text>
        
        {/* Dashed border card */}
        <View style={styles.didYouKnowCard}>
          <Text style={styles.didYouKnowText}>
            Research shows that <Text style={styles.textBlue}>contextual information</Text> increases tourist satisfaction & creates more memorable experiences by up to 45%
          </Text>
          
          {/* Source citation */}
          <View style={styles.didYouKnowSource}>
            <Text style={styles.didYouKnowSourceText}>
              Source: Journal of Travel Research, Volume 54, Issue 3 (May 2015)
            </Text>
          </View>
        </View>
      </View>
      
      {/* Button */}
      <View style={styles.didYouKnowButtonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("feature-intro");
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeatureIntroSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.centeredContent}>
        <View style={styles.featureIconContainer}>
          <MapPin size={48} color={BLUE} />
        </View>
        <Text style={styles.featureText}>
          <Text style={styles.textBlue}>Solobuddy</Text> lets you create an unforgettable tour in 60 seconds or less without any stress 
          </Text>
            <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => transitionToStep("audio-tour-demo")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>See How It Works</Text>
            </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeatureLandmarkSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.landmarkShowcaseContainer}>
        <Text style={styles.landmarkShowcaseTitle}>
          Learn about any <Text style={styles.textBlue}>landmark</Text> instantly
              </Text>
        
        {/* Full-width image area */}
        <View style={styles.landmarkImageContainer}>
          {/* Camera viewfinder before flash */}
          {landmarkPhase === "camera" && (
            <View style={styles.landmarkCameraViewfinder}>
              <View style={styles.cameraViewfinderOverlay}>
                <View style={styles.cameraCorner} />
                <View style={[styles.cameraCorner, styles.cameraCornerTR]} />
                <View style={[styles.cameraCorner, styles.cameraCornerBL]} />
                <View style={[styles.cameraCorner, styles.cameraCornerBR]} />
                <View style={styles.cameraCircle}>
                  <Text style={styles.cameraCaptureText}>📷</Text>
                </View>
              </View>
            </View>
          )}
          
          {/* Camera flash overlay */}
          <Animated.View 
            style={[
              styles.landmarkFlashOverlay,
              { opacity: landmarkFlashAnim },
            ]}
          />
          
          {/* The landmark image */}
          <Animated.Image
            source={{ uri: DEMO_LANDMARK_IMAGE }}
            style={[
              styles.landmarkFullImage,
              { opacity: landmarkImageAnim },
            ]}
            resizeMode="cover"
          />
          
          {/* Scanning corners overlay */}
          <Animated.View style={[styles.landmarkScanOverlay, { opacity: landmarkImageAnim }]}>
            <View style={styles.scanCorner} />
            <View style={[styles.scanCorner, styles.scanCornerTR]} />
            <View style={[styles.scanCorner, styles.scanCornerBL]} />
            <View style={[styles.scanCorner, styles.scanCornerBR]} />
          </Animated.View>
          
          {/* Analyzing overlay */}
          {landmarkPhase === "analyzing" && (
            <Animated.View 
              style={[
                styles.landmarkAnalyzingOverlay,
                { opacity: landmarkAnalyzingFadeAnim },
              ]}
            >
              <View style={styles.analyzingContent}>
                <ActivityIndicator size="large" color={BLUE} />
                <Text style={styles.landmarkAnalyzingText}>Analyzing...</Text>
                <Text style={styles.landmarkAnalyzingSubtext}>Identifying landmark</Text>
              </View>
            </Animated.View>
          )}
        </View>
        
        {/* Result card that overlaps with image */}
        <Animated.View 
          style={[
            styles.landmarkResultOverlay,
            { 
              opacity: landmarkTextFadeAnim,
              transform: [{ translateY: landmarkTextSlideAnim }],
            },
          ]}
        >
          <View style={styles.landmarkResultContent}>
            <Text style={styles.landmarkResultTitle}>The Colosseum</Text>
            <Text style={styles.landmarkResultDescription}>
              Ancient amphitheater built 70-80 AD under Emperor Vespasian. Could hold up to 80,000 spectators for gladiatorial contests.
            </Text>
            <View style={styles.landmarkResultTags}>
              <View style={styles.landmarkResultTag}>
                <Text style={styles.landmarkResultTagText}>🏛️ World Heritage Site</Text>
              </View>
              <View style={styles.landmarkResultTag}>
                <Text style={styles.landmarkResultTagText}>📍 Rome, Italy</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              triggerHapticFeedback();
              transitionToStep("feature-discover");
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
        </View>
    </View>
  );


  // Static phone mockup for Discover/Organize feature - Hidden Gems
  const renderFeatureDiscoverSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.discoverShowcaseContainer}>
        <Text style={styles.featureShowcaseTitle}>
          Discover <Text style={styles.textBlue}>hidden gems</Text> from our community & submit your own!
        </Text>
        
        {/* Phone mockup with map */}
        <View style={styles.discoverPhoneMockup}>
          <View style={styles.discoverPhoneScreen}>
            {/* Map header */}
            <View style={styles.discoverMapHeader}>
              <Text style={styles.discoverMapCity}>📍 Rome, Italy</Text>
              <View style={styles.discoverCommunityBadge}>
                <Text style={styles.discoverCommunityText}>👥 2.4k spots</Text>
              </View>
            </View>
            
            {/* Map area - real map image */}
            <View style={styles.discoverMapAreaNew}>
              {/* Real Rome map background */}
              <Image
                source={{ uri: "https://tile.openstreetmap.org/14/8966/5990.png" }}
                style={styles.discoverMapImage}
                resizeMode="cover"
              />
              {/* Second tile for fuller coverage */}
              <Image
                source={{ uri: "https://tile.openstreetmap.org/14/8967/5990.png" }}
                style={[styles.discoverMapImage, { left: "50%" }]}
                resizeMode="cover"
              />
              {/* Map styling overlay - subtle tint */}
              <View style={styles.discoverMapTint} />
              
              {/* Hidden gem pins */}
              <View style={[styles.discoverGemPin, { top: "15%", left: "12%" }]}>
                <Text style={styles.discoverGemEmoji}>💎</Text>
              </View>
              <View style={[styles.discoverGemPin, { top: "35%", left: "55%" }]}>
                <Text style={styles.discoverGemEmoji}>🍝</Text>
              </View>
              <View style={[styles.discoverGemPin, styles.discoverGemPinHighlight, { top: "25%", right: "18%" }]}>
                <Text style={styles.discoverGemEmoji}>⭐</Text>
              </View>
              <View style={[styles.discoverGemPin, { top: "55%", left: "25%" }]}>
                <Text style={styles.discoverGemEmoji}>🎨</Text>
              </View>
              <View style={[styles.discoverGemPin, { top: "48%", right: "12%" }]}>
                <Text style={styles.discoverGemEmoji}>☕</Text>
              </View>
              <View style={[styles.discoverGemPin, { top: "70%", left: "45%" }]}>
                <Text style={styles.discoverGemEmoji}>🍷</Text>
              </View>
            </View>
            
            {/* Hidden gem card */}
            <View style={styles.discoverGemCard}>
              <View style={styles.discoverGemCardHeader}>
                <Text style={styles.discoverGemCardBadge}>💎 Hidden Gem</Text>
                <Text style={styles.discoverGemCardRating}>⭐ 4.9</Text>
              </View>
              <Text style={styles.discoverGemCardName}>Trattoria Da Enzo</Text>
              <Text style={styles.discoverGemCardDesc}>
                "Best carbonara in Rome! Only locals know about this place" - Maria
              </Text>
              <View style={styles.discoverGemCardMeta}>
                <Text style={styles.discoverGemCardMetaText}>📍 Trastevere</Text>
                <Text style={styles.discoverGemCardMetaText}>👤 142 saved</Text>
              </View>
            </View>
          </View>
        </View>
        
            <TouchableOpacity
          style={styles.discoverContinueBtn}
          onPress={() => transitionToStep("reviews")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Audio Tour Demo - Full screen immersive experience
  const renderAudioTourDemoSlide = () => {
    return (
      <View style={styles.demoFullScreen}>
        {/* Skip button - top right */}
        <TouchableOpacity
          style={styles.demoSkipButton}
              onPress={() => {
            setAudioTourDemoState("intro");
            transitionToStep("feature-landmark");
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.demoSkipText}>Skip</Text>
        </TouchableOpacity>
        
        <Animated.View style={[styles.demoFullContent, { opacity: demoFadeAnim }]}>
          
          {/* INTRO: Showcase what's possible */}
          {audioTourDemoState === "intro" && (
            <View style={styles.demoIntroScreen}>
              <View style={styles.demoIntroHeader}>
                <Text style={styles.demoIntroEmoji}>🎧</Text>
                <Text style={styles.demoIntroTitle}>
                  Create <Text style={styles.textBlue}>AI-Powered</Text> Audio Tours
              </Text>
                <Text style={styles.demoIntroSubtitle}>
                  Personal guides for any destination, generated in seconds
                </Text>
      </View>
              
              {/* Preview tour cards */}
              <View style={styles.demoIntroTours}>
                <View style={styles.demoIntroTourCard}>
                  <Image
                    source={{ uri: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80" }}
                    style={styles.demoIntroTourImage}
                    resizeMode="cover"
                  />
                  <View style={styles.demoIntroTourOverlay}>
                    <Text style={styles.demoIntroTourTitle}>Colosseum</Text>
                    <Text style={styles.demoIntroTourMeta}>🎧 15 min</Text>
                  </View>
                </View>
                <View style={styles.demoIntroTourCard}>
                  <Image
                    source={{ uri: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&q=80" }}
                    style={styles.demoIntroTourImage}
                    resizeMode="cover"
                  />
                  <View style={styles.demoIntroTourOverlay}>
                    <Text style={styles.demoIntroTourTitle}>Eiffel Tower</Text>
                    <Text style={styles.demoIntroTourMeta}>🎧 12 min</Text>
                  </View>
                </View>
                <View style={styles.demoIntroTourCard}>
                  <Image
                    source={{ uri: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80" }}
                    style={styles.demoIntroTourImage}
                    resizeMode="cover"
                  />
                  <View style={styles.demoIntroTourOverlay}>
                    <Text style={styles.demoIntroTourTitle}>Big Ben</Text>
                    <Text style={styles.demoIntroTourMeta}>🎧 10 min</Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.demoPrimaryBtn}
                onPress={() => {
                  triggerHapticFeedback();
                  transitionDemoStep("tour-type");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoPrimaryBtnText}>Try It Now</Text>
            </TouchableOpacity>
          </View>
          )}
          
          {/* STEP 1: Tour Type Selection - All 3 types */}
          {audioTourDemoState === "tour-type" && (
            <View style={styles.demoStepFullScreen}>
              <Text style={styles.demoStepTitleLarge}>Choose Your Tour Type</Text>
              <Text style={styles.demoStepSubtitleLarge}>Select how you want to explore</Text>
              
              <View style={styles.demoTourTypesGrid}>
                <TouchableOpacity
                  style={[styles.demoTourTypeCard, styles.demoTourTypeCardSelected]}
                  onPress={() => {
                    triggerHapticFeedback();
                    transitionDemoStep("location");
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.demoTourTypeIconContainer}>
                    <MapPin size={32} color={BLUE} />
        </View>
                  <Text style={styles.demoTourTypeTitle}>Walking Tour</Text>
                  <Text style={styles.demoTourTypeDesc}>Multi-stop guided walk through the city</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.demoTourTypeCard}
                  onPress={() => {
                    triggerHapticFeedback();
                    transitionDemoStep("location");
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.demoTourTypeIconContainer}>
                    <Camera size={32} color="#666" />
                  </View>
                  <Text style={[styles.demoTourTypeTitle, { color: "#666" }]}>Single Landmark</Text>
                  <Text style={styles.demoTourTypeDesc}>Deep dive into one location</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.demoTourTypeCard}
                  onPress={() => {
                    triggerHapticFeedback();
                    transitionDemoStep("location");
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.demoTourTypeIconContainer}>
                    <Headphones size={32} color="#666" />
                  </View>
                  <Text style={[styles.demoTourTypeTitle, { color: "#666" }]}>General Audio</Text>
                  <Text style={styles.demoTourTypeDesc}>Overview of the destination</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* STEP 2: Location */}
          {audioTourDemoState === "location" && (
            <View style={styles.demoStepFullScreen}>
              <Text style={styles.demoStepTitleLarge}>Where Are You?</Text>
              <Text style={styles.demoStepSubtitleLarge}>Enter your destination</Text>
              
              <View style={styles.demoLocationInputLarge}>
                <MapPin size={22} color={BLUE} />
                <Text style={styles.demoLocationTextLarge}>Rome, Italy</Text>
                <View style={styles.demoLocationCheckLarge}>
                  <Text style={styles.demoCheckmarkLarge}>✓</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.demoPrimaryBtn}
                onPress={() => {
                  triggerHapticFeedback();
                  transitionDemoStep("topics");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoPrimaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* STEP 3: Topics */}
          {audioTourDemoState === "topics" && (
            <View style={styles.demoStepFullScreen}>
              <Text style={styles.demoStepTitleLarge}>What Interests You?</Text>
              <Text style={styles.demoStepSubtitleLarge}>Select one or more topics</Text>
              
              <View style={styles.demoTopicsGridLarge}>
                <View style={[styles.demoTopicChipLarge, styles.demoTopicChipSelectedLarge]}>
                  <Text style={styles.demoTopicChipTextSelectedLarge}>🏛️ History</Text>
                </View>
                <View style={[styles.demoTopicChipLarge, styles.demoTopicChipSelectedLarge]}>
                  <Text style={styles.demoTopicChipTextSelectedLarge}>🏗️ Architecture</Text>
                </View>
                <View style={[styles.demoTopicChipLarge, styles.demoTopicChipSelectedLarge]}>
                  <Text style={styles.demoTopicChipTextSelectedLarge}>🎭 Culture</Text>
                </View>
                <View style={styles.demoTopicChipLarge}>
                  <Text style={styles.demoTopicChipTextLarge}>🍝 Food</Text>
                </View>
                <View style={styles.demoTopicChipLarge}>
                  <Text style={styles.demoTopicChipTextLarge}>🎨 Art</Text>
                </View>
                <View style={styles.demoTopicChipLarge}>
                  <Text style={styles.demoTopicChipTextLarge}>🏞️ Nature</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.demoPrimaryBtn}
                onPress={() => {
                  triggerHapticFeedback();
                  transitionDemoStep("generating");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoPrimaryBtnText}>Generate Tour</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* STEP 4: Generating */}
          {audioTourDemoState === "generating" && (
            <View style={styles.demoGeneratingScreen}>
              <View style={styles.demoGeneratingAnimation}>
                <Text style={styles.demoGeneratingEmoji}>✨</Text>
              </View>
              <Text style={styles.demoGeneratingTitle}>Creating Your Tour...</Text>
              <Text style={styles.demoGeneratingSubtitle}>
                Gathering info from academic sources
              </Text>
              <Animated.View style={{ opacity: generatingButtonFadeAnim, marginTop: 40 }}>
                <TouchableOpacity
                  style={styles.demoPrimaryBtn}
                  onPress={() => {
                    triggerHapticFeedback();
                    transitionDemoStep("library");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.demoPrimaryBtnText}>View Result</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
          
          {/* STEP 5: Library with created tour */}
          {audioTourDemoState === "library" && (
            <View style={styles.demoLibraryFullScreen}>
              <Text style={styles.demoLibraryTitleLarge}>🎉 Tour Created!</Text>
              
              <Animated.View style={{ opacity: tourCreatedCardFadeAnim, width: "100%" }}>
                <View style={styles.demoTourCardLarge}>
                  <Image
                    source={{ uri: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80" }}
                    style={styles.demoTourCardImageLarge}
                    resizeMode="cover"
                  />
                  <View style={styles.demoTourCardGradient}>
                    <Text style={styles.demoTourCardTitleLarge}>Ancient Rome Walking Tour</Text>
                    <Text style={styles.demoTourCardMetaLarge}>Rome, Italy • 25 min • 5 stops</Text>
                    <View style={styles.demoTourCardTopicsLarge}>
                      <Text style={styles.demoTourCardTopicLarge}>History</Text>
                      <Text style={styles.demoTourCardTopicLarge}>Architecture</Text>
                      <Text style={styles.demoTourCardTopicLarge}>Culture</Text>
                    </View>
                  </View>
                  <View style={styles.demoPlayButtonLarge}>
                    <Text style={styles.demoPlayIconLarge}>▶</Text>
                  </View>
                </View>
              </Animated.View>
              
              <TouchableOpacity
                style={styles.demoPrimaryBtn}
                onPress={() => {
                  triggerHapticFeedback();
                  setAudioTourDemoState("intro");
                  transitionToStep("feature-landmark");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.demoPrimaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}
          
        </Animated.View>
    </View>
  );
  };

  // Auto-scrolling carousel state for reviews
  const reviewsCarouselScrollRef = useRef<ScrollView>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Auto-scroll effect for reviews carousel
  useEffect(() => {
    if (step !== "reviews") return;

    const interval = setInterval(() => {
      setCurrentReviewIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % REVIEWS.length;
        const cardWidth = Dimensions.get('window').width - 80 + 16; // card width + gap
        
        reviewsCarouselScrollRef.current?.scrollTo({
          x: nextIndex * cardWidth,
          animated: true,
        });
        
        return nextIndex;
      });
    }, 4000); // Change review every 4 seconds

    return () => clearInterval(interval);
  }, [step]);

  const renderReviewsSlide = () => (
    <View style={styles.slideContainer}>
      {/* Fixed Header Section */}
      <View style={styles.socialProofFixedHeader}>
        {/* Headline */}
        <Text style={styles.socialProofHeadline}>
          <Text style={styles.socialProofHeadlineRegular}>Solobuddy was designed{'\n'}for </Text>
          <Text style={styles.textBlue}>travelers like you</Text>
          <Text style={styles.socialProofHeadlineRegular}>.</Text>
        </Text>
        
        {/* Subheadline */}
        <Text style={styles.socialProofSubheadline}>
          reviews from travelers using Solobuddy.
        </Text>
        
        {/* Wreath Badge with Text */}
        <View style={styles.wreathBadgeContainer}>
          {/* Left half wreath */}
          <Image 
            source={{ uri: 'https://user-content.superwalleditor.com/user-content/qPU58XOnYEVq8y-eOD-2y.png' }}
            style={styles.wreathLeftImageOuter}
            resizeMode="contain"
            onLoad={() => console.log('[Wreath] Left loaded')}
            onError={(e) => console.log('[Wreath] Left error:', e.nativeEvent.error)}
          />
          {/* Right half wreath */}
          <Image 
            source={{ uri: 'https://user-content.superwalleditor.com/user-content/CNBEXdRti1UmIhbciDs9E.png' }}
            style={styles.wreathRightImageOuter}
            resizeMode="contain"
            onLoad={() => console.log('[Wreath] Right loaded')}
            onError={(e) => console.log('[Wreath] Right error:', e.nativeEvent.error)}
          />
          
          {/* Center content box */}
          <View style={styles.wreathBadge}>
            <View style={styles.wreathTextContainer}>
              <Text style={styles.wreathMainText}>the #1 audio{'\n'}tour app</Text>
              
              {/* 5 Stars */}
              <View style={styles.wreathStarsRow}>
                {[...Array(5)].map((_, i) => (
                  <Text key={i} style={styles.wreathStar}>⭐</Text>
                ))}
              </View>
              
              {/* Emojis + Count */}
              <Text style={styles.wreathEmojis}>
                ✈️ 🗺️ 🎧 <Text style={styles.wreathCount}>+ 1,000 people</Text>
              </Text>
            </View>
          </View>
        </View>
        
        {/* Gradient Fade */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0)', 'rgba(240, 240, 240, 0.3)', 'rgba(240, 240, 240, 0.5)']}
          style={styles.headerGradientFade}
        />
      </View>

      {/* Scrollable Reviews Section */}
      <ScrollView 
        style={styles.reviewsScrollContainer}
        contentContainerStyle={styles.reviewsScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewsStackSection}>
          {REVIEWS.map((review, index) => (
            <View key={index} style={styles.reviewStackCard}>
              {/* Stars at top */}
              <View style={styles.reviewStarsRow}>
                {[...Array(review.rating)].map((_, i) => (
                  <Text key={i} style={styles.reviewStar}>⭐</Text>
                ))}
              </View>
              
              {/* Title */}
              <Text style={styles.reviewTitle}>{review.title}</Text>
              
              {/* Review text */}
              <Text style={styles.reviewBodyText}>{review.text}</Text>
              
              {/* Name */}
              <Text style={styles.reviewName}>{review.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Fixed CTA Button */}
      <View style={styles.ctaButtonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            triggerHapticFeedback();
            transitionToStep("creating-plan");
          }}
          activeOpacity={0.8}
        >
            <Text style={styles.primaryButtonText}>See Your Custom Plan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Creating Plan - Loading/Buffer screen
  const [planCreated, setPlanCreated] = useState(false);
  const planLoadingAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (step === "creating-plan") {
      setPlanCreated(false);
      planLoadingAnim.setValue(0);
      
      // Animate the loading progress
      Animated.timing(planLoadingAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: false,
      }).start(() => {
        setPlanCreated(true);
        // Auto-transition after loading completes
        setTimeout(() => {
          transitionToStep("suggestions");
        }, 500);
      });
    }
  }, [step]);

  const renderCreatingPlanSlide = () => (
    <View style={styles.slideContainer}>
      <View style={styles.creatingPlanContainer}>
        <Text style={styles.creatingPlanEmoji}>🗺️</Text>
        <Text style={styles.creatingPlanTitle}>
          Creating a custom travel plan based on your answers...
        </Text>
        
        {/* Loading bar */}
        <View style={styles.creatingPlanLoadingContainer}>
          <View style={styles.creatingPlanLoadingBar}>
            <Animated.View 
              style={[
                styles.creatingPlanLoadingFill,
                {
                  width: planLoadingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]} 
            />
          </View>
          <Text style={styles.creatingPlanLoadingText}>
            {planCreated ? "Done!" : "Analyzing your preferences..."}
          </Text>
        </View>
      </View>
    </View>
  );


  // Helper function to get city key for landmark lookup - EXACT MATCHES ONLY
  const getCityKey = (cityName: string): string | null => {
    const city = cityName.toLowerCase().trim();
    
    // ONLY exact matches - no partial matching to avoid confusion
    const cityMap: Record<string, string> = {
      'rome': 'rome',
      'roma': 'rome',
      'paris': 'paris',
      'london': 'london',
      'new york': 'new york',
      'new york city': 'new york',
      'nyc': 'new york',
      'san francisco': 'san francisco',
      'tokyo': 'tokyo',
      'barcelona': 'barcelona',
      'chicago': 'chicago',
      'athens': 'athens',
      'istanbul': 'istanbul',
      'amsterdam': 'amsterdam',
      'berlin': 'berlin',
      'vienna': 'vienna',
      'prague': 'prague',
      'dubai': 'dubai',
      'sydney': 'sydney',
      'los angeles': 'los angeles',
      'seattle': 'seattle',
      'miami': 'miami',
      'miami beach': 'miami',
      'boston': 'boston',
      'washington': 'washington',
      'washington dc': 'washington',
    };
    
    return cityMap[city] || null;
  };

  // Fetch location and landmarks for final slide - API FIRST approach
  const fetchLocationAndLandmarks = async () => {
    try {
      setIsLoadingLocation(true);
      
      let cityName = "";
      let location: { coords: { latitude: number; longitude: number } } | null = null;
      
      // If user provided an excited city from trip planning, use that instead of actual location
      if (excitedCity.trim()) {
        cityName = excitedCity.trim();
        setUserCity(cityName);
        console.log(`[Final Slide] 🎯 Using user's excited city: ${cityName} (skipping location detection)`);
        
        // Check if we have curated landmarks for this city
        const cityKey = getCityKey(cityName);
        if (cityKey && CITY_LANDMARKS[cityKey]) {
          console.log(`[Final Slide] ✅ Using curated landmarks for ${cityName}`);
          setCityLandmarks(CITY_LANDMARKS[cityKey]);
          setIsLoadingLocation(false);
          return;
        }
        
        // City not in curated list - fallback to current location
        console.log(`[Final Slide] 📍 ${cityName} not in curated list - falling back to current location`);
        console.log('[Final Slide] 🔄 Switching to location-based landmark search...');
        // Don't return - continue to location detection below
      }
      
      // Otherwise, use actual location
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Final Slide] ⚠️ Location permission not granted - using Paris as fallback');
        setUserCity("Paris");
        setCityLandmarks(CITY_LANDMARKS["paris"]);
        setIsLoadingLocation(false);
        return;
      }

      // Get current location
      console.log('[Final Slide] 📍 Getting current location...');
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get city name
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      cityName = address?.city || address?.subregion || "your area";
      setUserCity(cityName);
      
      console.log('[Final Slide] ✅ Location detected:', {
        city: cityName,
        state: address?.region,
        country: address?.country,
        lat: location.coords.latitude.toFixed(4),
        lng: location.coords.longitude.toFixed(4)
      });

      // ALWAYS TRY GOOGLE PLACES API FIRST - this is the primary method
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || "";
      
      if (!apiKey) {
        console.error('[Final Slide] ❌ Google Places API key missing!');
        // Check if we have curated landmarks as fallback
        const cityKey = getCityKey(cityName);
        if (cityKey && CITY_LANDMARKS[cityKey]) {
          console.log(`[Final Slide] 🎯 Using curated landmarks for ${cityName} (API key missing)`);
          setCityLandmarks(CITY_LANDMARKS[cityKey]);
        } else {
          console.log('[Final Slide] 🔄 No API key and no curated list - showing empty');
          setCityLandmarks([]);
        }
        setIsLoadingLocation(false);
        return;
      }

      console.log(`[Final Slide] 🚀 Searching for landmarks in ${cityName} via Google Places API...`);
      console.log(`[Final Slide] 🔍 Search radius: 6.2 miles from coordinates (${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)})`);

      const requestBody = {
        includedTypes: [
          "tourist_attraction",
          "museum",
          "church",
          "art_gallery",
          "synagogue",
          "hindu_temple",
          "mosque",
          "performing_arts_theater",
          "cultural_center"
        ],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { 
              latitude: location.coords.latitude, 
              longitude: location.coords.longitude 
            },
            radius: 10000, // 10km radius
          },
        },
        rankPreference: "POPULARITY",
      };

      const response = await fetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "SoloBuddy/1.0 (Audio Tour App)",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.photos,places.types,places.rating",
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log(`[Final Slide] 📥 API Response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        const places = data.places || [];
        
        console.log(`[Final Slide] 📊 API found ${places.length} total places near ${cityName}`);
        
        if (places.length === 0) {
          console.warn(`[Final Slide] ⚠️ No places found near ${cityName}. Checking curated list...`);
          const cityKey = getCityKey(cityName);
          if (cityKey && CITY_LANDMARKS[cityKey]) {
            console.log(`[Final Slide] 🎯 Using curated landmarks for ${cityName}`);
            setCityLandmarks(CITY_LANDMARKS[cityKey]);
          } else {
            console.log('[Final Slide] 💭 No landmarks found - showing empty carousel');
            setCityLandmarks([]);
          }
          setIsLoadingLocation(false);
          return;
        }
        
        // Filter to only places with photos
        const placesWithPhotos = places.filter((place: any) => place.photos && place.photos.length > 0);
        console.log(`[Final Slide] 📸 ${placesWithPhotos.length} places have photos`);
        
        if (placesWithPhotos.length === 0) {
          console.warn(`[Final Slide] ⚠️ Found ${places.length} places but none have photos. Checking curated list...`);
          const cityKey = getCityKey(cityName);
          if (cityKey && CITY_LANDMARKS[cityKey]) {
            console.log(`[Final Slide] 🎯 Using curated landmarks for ${cityName}`);
            setCityLandmarks(CITY_LANDMARKS[cityKey]);
          } else {
            console.log('[Final Slide] 💭 No landmarks with photos - showing empty carousel');
            setCityLandmarks([]);
          }
          setIsLoadingLocation(false);
          return;
        }
        
        // Simple filtering: only remove obvious commercial chains
        const commercialChains = [
          'walmart', 'target', 'costco', 'best buy', 'starbucks',
          'mcdonald', 'burger king', 'subway', 'wendy', 'taco bell',
          'home depot', 'lowe\'s', 'cvs', 'walgreens', 'rite aid'
        ];
        
        const filteredPlaces = placesWithPhotos.filter((place: any) => {
          const name = (place.displayName?.text || "").toLowerCase();
          
          // Only filter out obvious commercial chains
          if (commercialChains.some(chain => name.includes(chain))) {
            return false;
          }
          
          return true;
        });
        
        console.log(`[Final Slide] 🏛️  After filtering: ${filteredPlaces.length} landmarks`);
        
        const scoredPlaces = filteredPlaces.map((place: any) => {
          const name = (place.displayName?.text || "").toLowerCase();
          const types = place.types || [];
          
          let score = 0;
          
          // Historic indicators
          const historicalTerms = ['museum', 'historic', 'cathedral', 'monument', 'fort', 'castle'];
          
          // Boost score for historical/cultural indicators
          if (historicalTerms.some(term => name.includes(term))) score += 10;
          if (types.includes('museum')) score += 8;
          if (types.includes('historical_landmark')) score += 12;
          if (types.includes('tourist_attraction')) score += 6;
          
          // Religious buildings
          if (types.includes('church') || types.includes('synagogue') || types.includes('hindu_temple') || types.includes('mosque')) {
            score += 7;
          }
          
          if (types.includes('art_gallery')) score += 6;
          if (types.includes('monument')) score += 9;
          
          // Cultural centers and theaters
          if (types.includes('performing_arts_theater') || types.includes('cultural_center')) {
            score += 5;
          }
          
          // Boost if it has a good rating
          if (place.rating >= 4.5) score += 3;
          else if (place.rating >= 4.0) score += 2;
          
          return { place, score };
        });
        
        // Sort by score (highest first) and take top 5
        const sortedPlaces = scoredPlaces.sort((a: { place: any; score: number }, b: { place: any; score: number }) => b.score - a.score);
        
        console.log('[Final Slide] 🎯 Landmark scoring:');
        sortedPlaces.slice(0, 8).forEach(({ place, score }: { place: any; score: number }) => {
          const name = place.displayName?.text || "Unnamed";
          const rating = place.rating ? ` (${place.rating}⭐)` : '';
          console.log(`[Final Slide]   ${name}${rating} - Score: ${score}`);
        });
        
        // Take top 5 landmarks and create proper image URLs
        const landmarks = sortedPlaces.slice(0, 5).map(({ place }: { place: any }) => {
          const photoReference = place.photos[0].name;
          const imageUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`;
          const name = place.displayName?.text || "Landmark";
          
          return {
            name,
            imageUrl,
          };
        });
        
        console.log(`[Final Slide] ✅ Successfully loaded ${landmarks.length} landmarks for ${cityName} from Google Places API!`);
        setCityLandmarks(landmarks);
        
      } else {
        const errorText = await response.text();
        console.error('[Final Slide] ❌ API request failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
        });
        
        // Try curated list as fallback
        const cityKey = getCityKey(cityName);
        if (cityKey && CITY_LANDMARKS[cityKey]) {
          console.log(`[Final Slide] 🎯 API failed - using curated landmarks for ${cityName}`);
          setCityLandmarks(CITY_LANDMARKS[cityKey]);
        } else {
          console.log(`[Final Slide] 💭 API failed and no curated list available for ${cityName}`);
          setCityLandmarks([]);
        }
      }
    } catch (error) {
      console.error('[Final Slide] ❌ Exception:', error);
      
      // Try curated list for current city
      const cityKey = getCityKey(userCity);
      if (cityKey && CITY_LANDMARKS[cityKey]) {
        console.log(`[Final Slide] 🎯 Exception occurred - using curated landmarks for ${userCity}`);
        setCityLandmarks(CITY_LANDMARKS[cityKey]);
      } else {
        console.log('[Final Slide] 🔄 Exception occurred - using Paris as fallback');
        setUserCity("Paris");
        setCityLandmarks(CITY_LANDMARKS["paris"]);
      }
    } finally {
      setIsLoadingLocation(false);
      console.log('[Final Slide] ✅ Location loading complete');
    }
  };

  // Trigger location fetch when reaching final slide
  useEffect(() => {
    if (step === "suggestions") {
      console.log('[Final Slide] Suggestions slide mounted, fetching landmarks...');
      fetchLocationAndLandmarks();
    }
  }, [step]);
  
  // Debug: Log when cityLandmarks changes
  useEffect(() => {
    console.log('[Final Slide] cityLandmarks updated:', {
      count: cityLandmarks.length,
      landmarks: cityLandmarks.map(l => l.name)
    });
  }, [cityLandmarks]);
  
  // Carousel scroll ref for landmarks
  const landmarksScrollRef = useRef<ScrollView>(null);
  const landmarksAutoScrollPosition = useRef(0);
  
  // Auto-scroll landmarks carousel
  useEffect(() => {
    if (step === "suggestions" && cityLandmarks.length > 0) {
      const cardWidth = width * 0.38 + 20;
      const extendedLandmarks = [...cityLandmarks, ...cityLandmarks, ...cityLandmarks];
      const singleSetWidth = cityLandmarks.length * cardWidth;
      
      // Start from middle set
      landmarksAutoScrollPosition.current = singleSetWidth;
      setTimeout(() => {
        landmarksScrollRef.current?.scrollTo({ x: singleSetWidth, animated: false });
      }, 100);
      
      const scrollInterval = setInterval(() => {
        if (landmarksScrollRef.current) {
          landmarksAutoScrollPosition.current += 0.3; // Slow movement
          landmarksScrollRef.current.scrollTo({
            x: landmarksAutoScrollPosition.current,
            animated: false,
          });
          
          // Reset when reaching end of second set
          if (landmarksAutoScrollPosition.current >= singleSetWidth * 2) {
            landmarksAutoScrollPosition.current = singleSetWidth;
          }
        }
      }, 30);
      
      return () => clearInterval(scrollInterval);
    }
  }, [step, cityLandmarks]);

  // Suggestions slide - final slide with landmarks carousel
  const renderSuggestionsSlide = () => {
    const extendedLandmarks = cityLandmarks.length > 0 
      ? [...cityLandmarks, ...cityLandmarks, ...cityLandmarks]
      : [];
    
    return (
      <View style={styles.slideContainer}>
        {isLoadingLocation ? (
          <View style={styles.finalSlideLoadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.finalSlideLoadingText}>Finding attractions near you...</Text>
          </View>
        ) : (
          <View style={styles.finalContainer}>
            {/* Landmarks Carousel - only show if we have local landmarks */}
            {extendedLandmarks.length > 0 && (
              <View style={styles.finalCarouselSection}>
                <ScrollView
                  ref={landmarksScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEnabled={false}
                  contentContainerStyle={styles.finalCarouselContent}
                >
                  {extendedLandmarks.map((landmark, index) => (
                    <View key={`landmark-${index}`} style={styles.finalLandmarkCard}>
                      <Image
                        source={{ uri: landmark.imageUrl }}
                        style={styles.finalLandmarkCardImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(30, 136, 229, 0.9)']}
                        style={styles.finalLandmarkCardGradient}
                      >
                        <Text style={styles.finalLandmarkCardTitle}>{landmark.name}</Text>
                      </LinearGradient>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {/* Content Section */}
            <View style={styles.finalContentSection}>
              <Text style={styles.finalHeadline}>
                {cityLandmarks.length > 0 ? (
                  <>
                    <Text style={styles.finalHeadlineHighlight}>{userName || "Traveler"}</Text>, we've found some great places you should check out in{" "}
                    <Text style={styles.finalHeadlineHighlight}>{userCity}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.finalHeadlineHighlight}>{userName || "Traveler"}</Text>, ready to explore{" "}
                    <Text style={styles.finalHeadlineHighlight}>{userCity}</Text> like never before?
                  </>
                )}
              </Text>
              
              <View style={styles.finalFeaturesContainer}>
                <Text style={styles.finalFeaturesTitle}>Get access to:</Text>
                
                <View style={styles.finalFeaturesList}>
                  <View style={styles.finalFeatureItem}>
                    <Text style={styles.finalFeatureIcon}>🎧</Text>
                    <Text style={styles.finalFeatureText}>
                      <Text style={styles.finalFeatureBold}>AI-powered audio tours</Text> that adapt to your interests and walking speed
                    </Text>
                  </View>
                  
                  <View style={styles.finalFeatureItem}>
                    <Text style={styles.finalFeatureIcon}>📸</Text>
                    <Text style={styles.finalFeatureText}>
                      <Text style={styles.finalFeatureBold}>Instant landmark analyzer</Text>—point your camera at any building for its full history
                    </Text>
                  </View>
                  
                  <View style={styles.finalFeatureItem}>
                    <Text style={styles.finalFeatureIcon}>🗺️</Text>
                    <Text style={styles.finalFeatureText}>
                      <Text style={styles.finalFeatureBold}>Personalized walking routes</Text> connecting hidden gems locals actually visit
                    </Text>
                  </View>
                  
                  <View style={styles.finalFeatureItem}>
                    <Text style={styles.finalFeatureIcon}>💎</Text>
                    <Text style={styles.finalFeatureText}>
                      <Text style={styles.finalFeatureBold}>Landmark finder & user database</Text> of unique hidden gems
                    </Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.finalButton}
                onPress={() => {
                  triggerHapticFeedback();
                  handleComplete();
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.light.accent, Colors.light.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.finalButtonGradient}
                >
                  <Text style={styles.finalButtonText}>Unlock All Features</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderCurrentSlide = () => {
    const slides: Record<OnboardingStep, () => React.ReactNode> = {
      "welcome": renderWelcomeSlide,
      "did-you-know": renderDidYouKnowSlide,
      "name": renderNameSlide,
      "on-trip": renderOnTripSlide,
      "planning-trip": renderPlanningTripSlide,
      "excited-city": renderExcitedCitySlide,
      "trip-days": renderTripDaysSlide,
      "cities-count": renderCitiesCountSlide,
      "tourist-points": renderTouristPointsSlide,
      "save-intro": renderSaveIntroSlide,
      "cost-calculation": renderCostCalculationSlide,
      "savings-reveal": renderSavingsRevealSlide,
      "pain-research": renderPainResearchSlide,
      "pain-missed": renderPainMissedSlide,
      "did-you-know-context": renderDidYouKnowContextSlide,
      "feature-intro": renderFeatureIntroSlide,
      "audio-tour-demo": renderAudioTourDemoSlide,
      "feature-landmark": renderFeatureLandmarkSlide,
      "feature-discover": renderFeatureDiscoverSlide,
      "reviews": renderReviewsSlide,
      "creating-plan": renderCreatingPlanSlide,
      "suggestions": renderSuggestionsSlide,
    };

    return slides[step]();
  };

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {step !== "welcome" && renderProgressBar()}
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
        {renderCurrentSlide()}
        </Animated.View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  animatedContainer: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E8E8E8",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: BLUE,
    borderRadius: 2,
  },

  // Welcome slide
  welcomeContainer: {
    flex: 1,
    paddingTop: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: -1.5,
    marginRight: 40,
  },
  appName: {
    fontSize: 44,
    fontWeight: "700",
    color: BLUE,
    letterSpacing: -1.5,
    textTransform: "lowercase",
    marginBottom: 0,
    marginLeft: -12,
  },
  mascotIcon: {
    width: 114,
    height: 114,
    marginRight: -4,
    marginBottom: -8,
  },
  tagline: {
    fontSize: 15.4,
    fontWeight: "500",
    color: "#888",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 20,
    paddingHorizontal: 24,
  },

  // Did You Know Slide
  didYouKnowContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  didYouKnowContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    justifyContent: "center",
  },
  didYouKnowTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 24,
  },
  didYouKnowCard: {
    backgroundColor: "#F0F6FF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#3B7FD9",
    borderStyle: "dashed",
  },
  didYouKnowText: {
    fontSize: 17,
    color: "#444",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },
  didYouKnowStats: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 144, 226, 0.2)",
  },
  didYouKnowStat: {
    alignItems: "center",
    flex: 1,
  },
  didYouKnowStatNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#3B7FD9",
  },
  didYouKnowStatLabel: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  didYouKnowStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(59, 127, 217, 0.3)",
    marginHorizontal: 16,
  },
  didYouKnowSource: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(59, 127, 217, 0.2)",
    width: "100%",
  },
  didYouKnowSourceText: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
  },
  didYouKnowButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // Horizontal Scrollable Carousel
  carouselSection: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
    marginTop: -40,
  },
  carouselScrollContent: {
    paddingHorizontal: 32,
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },

  // Polaroid-style cards
  polaroidCard: {
    width: width * 0.38,
    backgroundColor: "#FAFAFA",
    borderRadius: 4,
    marginHorizontal: 10,
    padding: 8,
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    // Subtle tape/pin effect at top
    borderTopWidth: 2,
    borderTopColor: "rgba(200, 180, 160, 0.3)",
  },
  polaroidInner: {
    width: "100%",
    aspectRatio: 0.85,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#E8E8E8",
  },
  polaroidImage: {
    width: "100%",
    height: "100%",
  },
  polaroidCaption: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  polaroidName: {
    color: "#444",
    fontSize: 12,
    fontWeight: "600",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },

  // CTA
  ctaContainer: {
    paddingBottom: 85,
    paddingHorizontal: 24,
  },
  primaryButton: {
    backgroundColor: BLUE,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  buttonDisabled: {
    backgroundColor: "#C0C0C0",
    shadowOpacity: 0,
  },

  // Slides
  slideContainer: {
    flex: 1,
  },
  questionContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  questionText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 36,
  },
  questionSubtext: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: -24,
    marginBottom: 32,
  },

  // Name input
  nameInput: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E8E8E8",
    textAlign: "center",
  },

  // Number input
  numberInput: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    fontSize: 48,
    fontWeight: "800",
    color: BLUE,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: "#E8E8E8",
    textAlign: "center",
  },

  // Options
  optionsRow: {
    flexDirection: "row",
    gap: 16,
  },
  optionButton: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E8E8E8",
  },
  optionButtonSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  optionText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },

  // Text input for city name
  textInput: {
    width: "100%",
    backgroundColor: "#F5F5F5",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
    color: "#1A1A1A",
    borderWidth: 2,
    borderColor: "#E0E0E0",
    marginTop: 24,
  },

  // Continue button
  continueButton: {
    backgroundColor: Colors.light.accent,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 24,
    alignItems: "center",
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: "#CCCCCC",
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Tourist points
  pointsOptionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  pointsOption: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E8E8E8",
  },
  pointsOptionSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  pointsOptionText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  pointsOptionTextSelected: {
    color: "#FFFFFF",
  },

  // Centered content
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  highlightText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 48,
  },
  textBlue: {
    color: BLUE,
  },

  // Cost calculation
  calculationText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 30,
  },
  bigNumber: {
    fontSize: 72,
    fontWeight: "900",
    color: BLUE,
    textAlign: "center",
    marginBottom: 8,
  },
  calculationSubtext: {
    fontSize: 18,
    fontWeight: "500",
    color: "#888",
    textAlign: "center",
    marginBottom: 48,
  },

  // Savings
  savingsScrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  savingsContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  savingsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 38,
  },
  savingsSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
  },
  barGraphContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 48,
    marginBottom: 24,
    height: 200,
  },
  barWrapper: {
    alignItems: "center",
  },
  barLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  bar: {
    width: 60,
    borderRadius: 8,
  },
  barGrey: {
    backgroundColor: "#D0D0D0",
  },
  barBlue: {
    backgroundColor: BLUE,
  },
  barCaption: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginTop: 8,
  },
  planNote: {
    fontSize: 14,
    fontWeight: "500",
    color: "#888",
    textAlign: "center",
    marginBottom: 32,
  },

  // Pain points
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  painPointsContainer: {
    gap: 12,
  },
  painPointButton: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E8E8E8",
  },
  painPointButtonSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  painPointText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
  },
  painPointTextSelected: {
    color: "#FFFFFF",
  },

  // Pain Question Yes/No Slides
  painQuestionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  painQuestionEmoji: {
    fontSize: 56,
    marginBottom: 24,
  },
  painQuestionText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 34,
    marginBottom: 40,
  },
  painYesNoContainer: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  painYesButton: {
    flex: 1,
    backgroundColor: BLUE,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  painYesButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  painNoButton: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E8E8E8",
  },
  painNoButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },

  // Feature slides
  featureIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LIGHT_BLUE,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 32,
  },
  featureText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 32,
  },

  // Demo
  demoContainer: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: "center",
  },
  demoTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 24,
  },
  phoneFrame: {
    width: width * 0.78,
    height: width * 1.1,
    backgroundColor: "#1A1A1A",
    borderRadius: 36,
    padding: 10,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  phoneScreen: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  demoImage: {
    width: "100%",
    height: "100%",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(30, 136, 229, 0.1)",
  },
  scanLine: {
    height: 3,
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  resultCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  // Reviews
  reviewsScrollContent: {
    flexGrow: 1,
    paddingTop: 24,
    paddingBottom: 40,
  },
  reviewsContent: {
    paddingHorizontal: 24,
  },
  
  // Social Proof Slide Styles
  socialProofBg: {
    backgroundColor: "#FFF5E6",
  },
  socialProofContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  awardBadgeMain: {
    alignItems: "center",
    marginBottom: 8,
  },
  laurelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  laurelLeft: {
    fontSize: 36,
  },
  laurelRight: {
    fontSize: 36,
  },
  awardTextContainer: {
    alignItems: "center",
  },
  awardMainTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -1,
  },
  awardMainSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    marginTop: -2,
  },
  awardBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    width: "100%",
  },
  awardBadgeContent: {
    flex: 1,
    alignItems: "center",
  },
  awardRating: {
    fontSize: 32,
    fontWeight: "800",
    color: BLUE,
  },
  awardRatingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: 2,
  },
  awardYear: {
    fontSize: 13,
    fontWeight: "500",
    color: "#888",
  },
  awardNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: BLUE,
  },
  awardNumberLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: 2,
  },
  testimonialCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  testimonialQuote: {
    fontSize: 48,
    fontWeight: "800",
    color: BLUE,
    opacity: 0.3,
    lineHeight: 48,
    marginBottom: -16,
  },
  testimonialText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 22,
    fontStyle: "italic",
  },
  testimonialAuthor: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },
  testimonialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  testimonialName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  primaryButtonDark: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  
  // Badge styles for compatibility
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    backgroundColor: LIGHT_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignSelf: "center",
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "700",
    color: BLUE,
  },
  socialProofFixedHeader: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 0,
  },
  headerGradientFade: {
    height: 20,
    width: "100%",
  },
  socialProofHeadline: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 32,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: 24,
  },
  socialProofHeadlineRegular: {
    fontWeight: "700",
    color: "#1A1A1A",
  },
  socialProofSubheadline: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  wreathBadgeContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    marginTop: -8,
    backgroundColor: "#FFFFFF",
    height: 180,
  },
  wreathLeftImageOuter: {
    position: "absolute",
    left: 20,
    top: 0,
    width: 90,
    height: 180,
    zIndex: 1,
  },
  wreathRightImageOuter: {
    position: "absolute",
    right: 20,
    top: 0,
    width: 90,
    height: 180,
    zIndex: 1,
  },
  wreathBadge: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  wreathTextContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  wreathMainText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 26,
  },
  wreathStarsRow: {
    flexDirection: "row",
    marginBottom: 6,
    gap: 2,
  },
  wreathStar: {
    fontSize: 16,
  },
  wreathEmojis: {
    fontSize: 16,
    textAlign: "center",
  },
  wreathCount: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "400",
  },
  wreathSubtext: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    lineHeight: 19,
  },
  reviewsScrollContainer: {
    flex: 1,
  },
  reviewsScrollContent: {
    paddingBottom: 20,
  },
  reviewsStackSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  ctaButtonContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  reviewStackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  reviewStarsRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 2,
  },
  reviewStar: {
    fontSize: 16,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  reviewBodyText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#333333",
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  reviewsTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 32,
    flex: 1,
  },
  reviewsList: {
    gap: 12,
    marginBottom: 32,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  reviewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
  },
  reviewMeta: {
    flex: 1,
  },
  reviewName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 2,
  },
  reviewText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    letterSpacing: 0.2,
  },

  // Notifications (kept for compatibility)
  notificationText: {
    fontSize: 17,
    fontWeight: "400",
    color: "#888",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 32,
    marginTop: -16,
  },
  
  // Creating Plan / Loading Screen
  creatingPlanContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  creatingPlanEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  creatingPlanTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 34,
    marginBottom: 40,
  },
  creatingPlanLoadingContainer: {
    width: "100%",
    alignItems: "center",
  },
  creatingPlanLoadingBar: {
    width: "80%",
    height: 8,
    backgroundColor: "#E8E8E8",
    borderRadius: 4,
    overflow: "hidden",
  },
  creatingPlanLoadingFill: {
    height: "100%",
    backgroundColor: BLUE,
    borderRadius: 4,
  },
  creatingPlanLoadingText: {
    fontSize: 14,
    color: "#888",
    marginTop: 16,
  },
  
  // Suggestions Screen
  suggestionsScrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  suggestionsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  suggestionsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  suggestionsSubtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginBottom: 28,
  },
  suggestionsList: {
    gap: 16,
    marginBottom: 32,
  },
  suggestionCard: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  suggestionIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  suggestionCardText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  
  // Final slide styles
  finalSlideLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  finalSlideLoadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  finalContainer: {
    flex: 1,
  },
  finalCarouselSection: {
    height: height * 0.35,
    marginBottom: 4,
  },
  finalCarouselContent: {
    paddingHorizontal: 20,
  },
  finalLandmarkCard: {
    width: width * 0.38,
    height: height * 0.3,
    marginHorizontal: 10,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  finalLandmarkCardImage: {
    width: "100%",
    height: "100%",
  },
  finalLandmarkCardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    justifyContent: "flex-end",
    padding: 12,
  },
  finalLandmarkCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
  },
  finalContentSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
  },
  finalHeadline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 18,
  },
  finalHeadlineHighlight: {
    color: Colors.light.accent,
    fontWeight: "800",
  },
  finalFeaturesContainer: {
    marginBottom: 20,
  },
  finalFeaturesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 10,
  },
  finalFeaturesList: {
    gap: 10,
  },
  finalFeatureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  finalFeatureIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  finalFeatureText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  finalFeatureBold: {
    fontWeight: "700",
    color: "#1A1A1A",
  },
  finalButton: {
    marginTop: 16,
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  finalButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  finalButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  
  skipButton: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 12,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
  },

  // ============ INTERACTIVE DEMO STYLES ============
  
  demoSubtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
    textAlign: "center",
    marginTop: -8,
    marginBottom: 20,
  },

  // Demo overlay (for darkening)
  demoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 10,
  },

  // Arrow indicators
  arrowContainer: {
    alignItems: "center",
    marginTop: 16,
    zIndex: 20,
  },
  arrowText: {
    fontSize: 28,
    color: BLUE,
    fontWeight: "bold",
  },
  arrowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: BLUE,
    marginTop: 4,
  },

  // Mock Discover Screen (Landmark Analyzer)
  mockDiscoverScreen: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  mockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  mockHeaderText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  mockDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  mockCameraButton: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  mockCameraButtonHighlight: {
    zIndex: 20,
  },
  mockCameraButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: BLUE,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  mockCameraButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Camera flash effect
  cameraFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    zIndex: 100,
  },

  // Full image display
  demoFullImage: {
    width: "100%",
    height: "100%",
  },

  // Analyzing state
  analyzingContainer: {
    flex: 1,
    position: "relative",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  scanLineContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  demoScanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  progressBarContainer: {
    width: "80%",
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: BLUE,
    borderRadius: 3,
  },

  // Result state
  resultContainer: {
    flex: 1,
  },
  demoResultImage: {
    width: "100%",
    height: "45%",
  },
  resultContent: {
    flex: 1,
    padding: 16,
  },
  resultLandmarkName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  resultAnalysis: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 12,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF8E1",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F9A825",
  },

  // Mock Explore Screen (Discover)
  mockExploreScreen: {
    flex: 1,
    padding: 12,
  },
  mockTabBar: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    padding: 4,
  },
  mockTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  mockTabActive: {
    backgroundColor: "#FFFFFF",
  },
  mockTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
  mockTabTextActive: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  mockMapPlaceholder: {
    flex: 1,
    backgroundColor: "#E8F4E8",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  mockMapText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginTop: 8,
  },
  mockExploreButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  mockExploreButtonHighlight: {
    zIndex: 20,
  },
  mockExploreButtonInner: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
  },
  mockExploreButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Mock Map Screen
  mockMapScreen: {
    flex: 1,
  },
  mockMapBackground: {
    flex: 1,
    backgroundColor: "#E8F4E8",
    position: "relative",
  },
  mockMapPin: {
    position: "absolute",
    padding: 4,
  },
  mockMapPinHighlight: {
    zIndex: 20,
    transform: [{ scale: 1.2 }],
  },
  mockYouPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(30, 136, 229, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  mockYouPinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BLUE,
  },

  // Location Detail Screen
  locationDetailScreen: {
    flex: 1,
  },
  locationDetailImage: {
    width: "100%",
    height: "40%",
  },
  locationDetailContent: {
    flex: 1,
    padding: 16,
  },
  locationDetailName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  locationDetailType: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
  },
  locationRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  locationRatingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  locationDetailDesc: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  // Mock Tour Screen (Audio Tour)
  mockTourScreen: {
    flex: 1,
    padding: 16,
  },
  mockSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  mockLocationInput: {
    borderRadius: 12,
    overflow: "hidden",
  },
  mockLocationInputHighlight: {
    zIndex: 20,
  },
  mockLocationInputInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F2F7",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BLUE,
  },
  mockLocationPlaceholder: {
    fontSize: 15,
    color: "#1A1A1A",
    fontWeight: "500",
  },
  mockTopicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  mockTopicChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  mockTopicChipSelected: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  mockTopicChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  mockTopicChipTextSelected: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  mockGenerateButton: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
  },
  mockGenerateButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // Generating Screen
  mockGeneratingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mockLoadingSpinner: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  mockSpinnerRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: "#E5E5E5",
    borderTopColor: BLUE,
  },
  mockGeneratingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  mockGeneratingText: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 24,
  },

  // Tour Ready Screen
  mockTourReadyScreen: {
    flex: 1,
  },
  tourReadyImage: {
    width: "100%",
    height: "40%",
  },
  tourReadyContent: {
    flex: 1,
    padding: 16,
  },
  tourReadyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  tourReadyMeta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  tourReadyMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tourReadyMetaText: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  tourReadyTopics: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tourReadyTopicBadge: {
    backgroundColor: LIGHT_BLUE,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tourReadyTopicText: {
    fontSize: 12,
    fontWeight: "600",
    color: BLUE,
  },
  tourReadyPlayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: BLUE,
    paddingVertical: 12,
    borderRadius: 24,
  },
  tourReadyPlayIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tourReadyPlayIconText: {
    fontSize: 10,
    color: BLUE,
    marginLeft: 2,
  },
  tourReadyPlayText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // ============ NEW FEATURE SHOWCASE STYLES ============
  
  // Feature showcase container (for static phone mockups)
  featureShowcaseContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureShowcaseTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 36,
  },
  
  // Phone mockup for features
  featurePhoneMockup: {
    width: width * 0.72,
    aspectRatio: 0.56,
    backgroundColor: "#1A1A1A",
    borderRadius: 32,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 20,
  },
  featurePhoneScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
  },
  
  // Landmark feature styles
  featureLandmarkImage: {
    width: "100%",
    height: "60%",
  },
  scanCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: BLUE,
    borderWidth: 3,
    top: 20,
    left: 20,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  scanCornerTR: {
    left: undefined,
    right: 20,
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
  scanCornerBL: {
    top: undefined,
    bottom: 20,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  scanCornerBR: {
    top: undefined,
    bottom: 20,
    left: undefined,
    right: 20,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  landmarkResultCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  landmarkResultName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  landmarkResultDesc: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginBottom: 8,
  },
  landmarkResultBadge: {
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  landmarkResultBadgeText: {
    fontSize: 12,
    color: "#F57C00",
    fontWeight: "600",
  },
  
  // New landmark showcase styles
  landmarkShowcaseContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  landmarkShowcaseTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    lineHeight: 34,
    zIndex: 10,
  },
  landmarkImageContainer: {
    width: "100%",
    height: height * 0.62,
    position: "relative",
  },
  landmarkFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 20,
  },
  landmarkFullImage: {
    width: "100%",
    height: "100%",
  },
  landmarkScanOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  landmarkResultOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: height * 0.38,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 15,
  },
  landmarkResultContent: {
    marginBottom: 20,
  },
  landmarkResultTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  landmarkResultDescription: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    marginBottom: 16,
  },
  landmarkResultTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  landmarkResultTag: {
    backgroundColor: "#F0F4FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  // Camera viewfinder styles
  landmarkCameraViewfinder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A1A1A",
    zIndex: 5,
  },
  cameraViewfinderOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cameraCorner: {
    position: "absolute",
    top: 60,
    left: 40,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#FFFFFF",
  },
  cameraCornerTR: {
    top: 60,
    left: "auto",
    right: 40,
    borderLeftWidth: 0,
    borderRightWidth: 3,
  },
  cameraCornerBL: {
    top: "auto",
    bottom: 60,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  cameraCornerBR: {
    top: "auto",
    left: "auto",
    bottom: 60,
    right: 40,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  cameraCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cameraCaptureText: {
    fontSize: 32,
  },
  // Analyzing overlay styles
  landmarkAnalyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  analyzingContent: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  landmarkAnalyzingText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 16,
  },
  landmarkAnalyzingSubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 6,
  },
  landmarkResultTagText: {
    fontSize: 13,
    color: BLUE,
    fontWeight: "600",
  },
  
  // Discover feature styles
  discoverMapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  discoverMapCity: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  discoverSearchIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  discoverSearchIconText: {
    fontSize: 14,
  },
  discoverMapArea: {
    flex: 1,
    position: "relative",
  },
  discoverMapBg: {
    width: "100%",
    height: "100%",
    opacity: 0.4,
  },
  discoverMapPin: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  discoverPinEmoji: {
    fontSize: 18,
  },
  discoverTabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  discoverTabActive: {
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  discoverTabActiveText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  discoverTabInactive: {
    fontSize: 12,
    color: "#999",
    paddingVertical: 6,
  },
  discoverPlaceCard: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  discoverPlaceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  discoverPlaceInfo: {
    flex: 1,
  },
  discoverPlaceName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  discoverPlaceDesc: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  discoverPlaceImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  
  // New Discover Hidden Gems styles
  discoverShowcaseContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
    justifyContent: "space-between",
  },
  discoverPhoneMockup: {
    width: width * 0.68,
    aspectRatio: 0.58,
    backgroundColor: "#1A1A1A",
    borderRadius: 36,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    marginTop: 12,
    marginBottom: 12,
    // Subtle bezel highlight
    borderWidth: 1,
    borderColor: "#333",
  },
  discoverPhoneScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
  },
  discoverCommunityBadge: {
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discoverCommunityText: {
    fontSize: 11,
    fontWeight: "600",
    color: BLUE,
  },
  discoverMapAreaNew: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  discoverMapImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  discoverMapTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  discoverGemPin: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  discoverGemPinHighlight: {
    borderColor: BLUE,
    backgroundColor: LIGHT_BLUE,
  },
  discoverGemEmoji: {
    fontSize: 16,
  },
  discoverGemCard: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  discoverGemCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  discoverGemCardBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: BLUE,
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
  },
  discoverGemCardRating: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  discoverGemCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  discoverGemCardDesc: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    lineHeight: 16,
    marginBottom: 8,
  },
  discoverGemCardMeta: {
    flexDirection: "row",
    gap: 12,
  },
  discoverGemCardMetaText: {
    fontSize: 11,
    color: "#888",
  },
  discoverContinueBtn: {
    backgroundColor: BLUE,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 16,
  },
  
  // ============ DEMO APP UI STYLES ============
  
  demoAppContainer: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  
  // Full Screen Demo Styles
  demoFullScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  demoSkipButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  demoSkipText: {
    fontSize: 15,
    color: "rgba(0,0,0,0.4)",
    fontWeight: "500",
  },
  demoFullContent: {
    flex: 1,
  },
  demoIntroScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  demoIntroHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  demoIntroEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  demoIntroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 36,
  },
  demoIntroSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  demoIntroTours: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },
  demoIntroTourCard: {
    width: (width - 72) / 3,
    aspectRatio: 0.7,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E0E0E0",
  },
  demoIntroTourImage: {
    width: "100%",
    height: "100%",
  },
  demoIntroTourOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  demoIntroTourTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  demoIntroTourMeta: {
    fontSize: 9,
    color: "rgba(255,255,255,0.8)",
  },
  demoPrimaryBtn: {
    backgroundColor: BLUE,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  demoPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  demoStepFullScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: "center",
  },
  demoStepTitleLarge: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  demoStepSubtitleLarge: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  demoTourTypesGrid: {
    flex: 1,
    width: "100%",
    gap: 16,
    marginBottom: 24,
  },
  demoTourTypeCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  demoTourTypeCardSelected: {
    backgroundColor: LIGHT_BLUE,
    borderWidth: 2,
    borderColor: BLUE,
  },
  demoTourTypeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  demoTourTypeTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  demoTourTypeDesc: {
    fontSize: 13,
    color: "#888",
    flex: 1,
  },
  demoLocationInputLarge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 18,
    width: "100%",
    marginBottom: 32,
    gap: 12,
  },
  demoLocationTextLarge: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  demoLocationCheckLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  demoCheckmarkLarge: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  demoTopicsGridLarge: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 40,
    justifyContent: "center",
  },
  demoTopicChipLarge: {
    backgroundColor: "#F5F7FA",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  demoTopicChipSelectedLarge: {
    backgroundColor: LIGHT_BLUE,
    borderWidth: 2,
    borderColor: BLUE,
  },
  demoTopicChipTextLarge: {
    fontSize: 15,
    color: "#666",
  },
  demoTopicChipTextSelectedLarge: {
    fontSize: 15,
    color: BLUE,
    fontWeight: "600",
  },
  demoGeneratingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  demoGeneratingAnimation: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LIGHT_BLUE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  demoGeneratingEmoji: {
    fontSize: 48,
  },
  demoGeneratingTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  demoGeneratingSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  demoLibraryFullScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
  },
  demoLibraryTitleLarge: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 24,
  },
  demoTourCardLarge: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 32,
    position: "relative",
  },
  demoTourCardImageLarge: {
    width: "100%",
    height: "100%",
  },
  demoTourCardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 60,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  demoTourCardTitleLarge: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  demoTourCardMetaLarge: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  demoTourCardTopicsLarge: {
    flexDirection: "row",
    gap: 8,
  },
  demoTourCardTopicLarge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: "#FFFFFF",
    overflow: "hidden",
  },
  demoPlayButtonLarge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  demoPlayIconLarge: {
    fontSize: 24,
    color: BLUE,
    marginLeft: 4,
  },
  
  demoPreviewBadge: {
    backgroundColor: BLUE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  demoPreviewText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  demoPhoneFrame: {
    width: width * 0.85,
    height: height * 0.65,
    backgroundColor: "#1A1A1A",
    borderRadius: 40,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 20,
  },
  demoPhoneNotch: {
    width: 120,
    height: 28,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    alignSelf: "center",
    marginTop: -4,
    marginBottom: -4,
    zIndex: 10,
  },
  demoPhoneScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    overflow: "hidden",
  },
  
  // Demo Welcome Screen
  demoWelcomeScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  demoMascotContainer: {
    marginBottom: 24,
  },
  demoMascot: {
    width: 80,
    height: 80,
  },
  demoWelcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  demoWelcomeSubtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  demoCTAButton: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  demoCTAButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  
  // Demo Step Screen
  demoStepScreen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  demoStepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  demoStepSubtitle: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  
  // Demo Options (Tour Type)
  demoOptionsContainer: {
    flex: 1,
    gap: 12,
    marginBottom: 20,
  },
  demoOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  demoOptionCardSelected: {
    backgroundColor: LIGHT_BLUE,
    borderWidth: 2,
    borderColor: BLUE,
  },
  demoOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  demoOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  
  // Demo Location Input
  demoLocationInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    borderWidth: 2,
    borderColor: BLUE,
  },
  demoLocationText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  demoLocationCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  demoCheckmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  
  // Demo Topics
  demoTopicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
    justifyContent: "center",
  },
  demoTopicChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  demoTopicChipSelected: {
    backgroundColor: BLUE,
  },
  demoTopicChipText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  demoTopicChipTextSelected: {
    fontSize: 13,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  
  // Demo Summary Card
  demoSummaryCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  demoSummaryLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  demoSummaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
  },
  demoSummaryDivider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginBottom: 12,
  },
  
  // Demo Congratulations
  demoCongratulationsScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  demoCongratulationsEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  demoCongratulationsTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  demoCongratulationsSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
  },
  
  // Demo Library Screen
  demoLibraryScreen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: "#F8F9FA",
  },
  demoLibraryTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  demoTourCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  demoTourCardImage: {
    width: "100%",
    height: 120,
  },
  demoTourCardContent: {
    padding: 14,
  },
  demoTourCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  demoTourCardMeta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  demoTourCardTopics: {
    flexDirection: "row",
    gap: 6,
  },
  demoTourCardTopic: {
    fontSize: 11,
    color: BLUE,
    backgroundColor: LIGHT_BLUE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  demoTourCardPlayBtn: {
    position: "absolute",
    right: 14,
    top: 130,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  demoTourCardPlayIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 2,
  },
  demoLibraryEmptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
  },
  demoLibraryEmptyText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
});
