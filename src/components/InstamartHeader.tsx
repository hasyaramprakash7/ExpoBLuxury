import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
  StatusBar,
} from "react-native";
// Removed useNavigation since we are using Redux now!
import { TouchableOpacity } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";

// --- REDUX IMPORTS ---
import { useDispatch } from "react-redux";
import {
  addToHistory,
  setActiveApp,
  showBrowser,
} from "../features/browserSlice";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 45) / 2;

const getRealIcon = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const CATEGORIES = [
  {
    id: "all",
    name: "Explore",
    icon: "compass",
    bg: "#000000",
    accent: "#00C896",
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: "cart-outline",
    bg: "#000000",
    accent: "#D4AF37",
  },
  {
    id: "social",
    name: "Social",
    icon: "people-outline",
    bg: "#000000",
    accent: "#3B82F6",
  },
  {
    id: "tech",
    name: "AI & Tech",
    icon: "hardware-chip-outline",
    bg: "#000000",
    accent: "#D946EF",
  },
  {
    id: "media",
    name: "Media",
    icon: "play-circle-outline",
    bg: "#000000",
    accent: "#E11D48",
  },
];

const WEB_LINKS = [
  {
    id: "1",
    name: "Google",
    url: "https://www.google.com",
    icon: getRealIcon("google.com"),
    category: "tech",
    description: "Search the world's information.",
  },
  // --- ADDED YOUTUBE HERE ---
  {
    id: "2",
    name: "YouTube",
    url: "https://www.youtube.com",
    icon: getRealIcon("youtube.com"),
    category: "media",
    description: "Watch and listen to videos & music.",
  },
  {
    id: "3",
    name: "Flipkart",
    url: "https://fktr.in/Dml0zdT",
    icon: getRealIcon("flipkart.com"),
    category: "shopping",
    description: "The top Indian e-commerce site.",
  },
  {
    id: "4",
    name: "Myntra",
    url: "https://myntr.it/vvM3Hl2",
    icon: getRealIcon("myntra.com"),
    category: "shopping",
    description: "Latest fashion and lifestyle apparel.",
  },
  {
    id: "6",
    name: "Ajio",
    url: "https://ajiio.in/eVnse8m",
    icon: getRealIcon("ajio.com"),
    category: "shopping",
    description: "Premium fashion and lifestyle apparel.",
  },
  {
    id: "16",
    name: "Instagram",
    url: "https://www.instagram.com",
    icon: getRealIcon("instagram.com"),
    category: "social",
    description: "Photos, videos & stories.",
  },
];

interface InstamartHeaderProps {
  searchQuery?: string;
}

const InstamartHeader: React.FC<InstamartHeaderProps> = ({
  searchQuery = "",
}) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const scrollRef = useRef<ScrollView>(null);

  const dispatch = useDispatch();

  const handleCategoryPress = (catId: string) => {
    setActiveCategory(catId);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  // --- UPDATED TO USE GLOBAL BROWSER ---
  const openWebLink = (url: string, name: string, icon: string) => {
    const newApp = {
      url,
      name,
      icon,
      timestamp: Date.now(),
    };

    // 1. Add it to history
    dispatch(addToHistory(newApp));

    // 2. Set it as the active app to view
    dispatch(setActiveApp(newApp));

    // 3. Trigger the Global Browser to slide up!
    dispatch(showBrowser());
  };

  const filteredLinks = useMemo(() => {
    let filtered =
      activeCategory === "all"
        ? WEB_LINKS
        : WEB_LINKS.filter((link) => link.category === activeCategory);

    const safeQuery = searchQuery || "";
    if (safeQuery.trim() !== "") {
      filtered = filtered.filter((link) =>
        link.name.toLowerCase().includes(safeQuery.toLowerCase()),
      );
    }
    return filtered;
  }, [activeCategory, searchQuery]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Category Pills Header */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryItem,
                  isActive && { backgroundColor: "rgba(255,255,255,0.1)" },
                ]}
                onPress={() => handleCategoryPress(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={18}
                  color={isActive ? cat.accent : "#888888"}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isActive && { color: "#FFFFFF", fontWeight: "bold" },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Vertical Scroll Grid Area (2 Per Row) */}
      <View style={styles.gridContainer}>
        {filteredLinks.length === 0 ? (
          <Text style={styles.noResultsText}>No brand matches found</Text>
        ) : (
          filteredLinks.map((link) => (
            <TouchableOpacity
              key={link.id}
              style={styles.cardContainer}
              onPress={() => openWebLink(link.url, link.name, link.icon)}
              activeOpacity={0.7}
            >
              <BlurView intensity={60} tint="dark" style={styles.musicCard}>
                <View style={styles.cardHeader}>
                  <Image source={{ uri: link.icon }} style={styles.brandIcon} />
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color="rgba(255,255,255,0.3)"
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {link.name}
                  </Text>
                  <Text style={styles.brandDesc} numberOfLines={2}>
                    {link.description}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  contentContainer: {
    paddingTop:
      Platform.OS === "ios" ? 50 : (StatusBar.currentHeight || 20) + 15,
    paddingBottom: 40,
  },
  categoryWrapper: {
    marginBottom: 20,
  },
  categoryScroll: {
    paddingHorizontal: 15,
    gap: 10,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categoryText: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: 140,
    marginBottom: 15,
    borderRadius: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 8 },
    }),
  },
  musicCard: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  cardContent: {
    marginTop: 10,
  },
  brandName: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginBottom: 4,
  },
  brandDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 16,
  },
  noResultsText: {
    color: "#888888",
    textAlign: "center",
    width: "100%",
    fontSize: 15,
    marginTop: 30,
  },
});

export default React.memo(InstamartHeader);
