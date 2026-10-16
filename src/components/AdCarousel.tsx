// components/AdCarousel.tsx
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

// ─────────────────────────────────────────────────────────────
// 👑 ROYAL GREEN PALETTE — Pure Rolex-inspired, no gold
// ─────────────────────────────────────────────────────────────
const Royal = {
  // Primary royal greens
  royalGreen: "#0B3D2E",
  royalGreenDeep: "#052318",
  royalGreenMid: "#0F4A38",
  royalGreenSoft: "#1A5C47",
  royalGreenLight: "#2A7A5E",
  royalGreenFaint: "rgba(11,61,46,0.06)",

  // Light greens for accents
  mint: "#7FBFA4",
  mintSoft: "#A8D5C2",
  mintFaint: "rgba(127,191,164,0.15)",
  mintDim: "rgba(127,191,164,0.35)",

  // Neutrals
  obsidian: "#0A0A0C",
  charcoal: "#1A1A1E",
  ivory: "#FBF7EE",
  cream: "#F5EDD9",
  parchment: "#FDFBF5",

  // Green accents
  emerald: "#0E6B4F",
  emeraldLight: "#14875F",
};

interface AdCarouselProps {
  ads: any[];
  title?: string;
  onAdPress?: (ad: any) => void;
  limit?: number;
  autoPlayInterval?: number;
}

const AdCarouselBase: React.FC<AdCarouselProps> = ({
  ads = [],
  title = "Sponsored",
  onAdPress,
  limit = 5,
  autoPlayInterval = 4000,
}) => {
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState<{ [key: string]: boolean }>({});
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayAds = useMemo(() => {
    if (!ads || !Array.isArray(ads)) return [];
    return ads.slice(0, limit);
  }, [ads, limit]);

  const startAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (displayAds.length > 1 && isAutoPlaying) {
      autoPlayTimerRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % displayAds.length;
        setCurrentIndex(nextIndex);
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      }, autoPlayInterval);
    }
  }, [displayAds.length, currentIndex, isAutoPlaying, autoPlayInterval]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / CARD_WIDTH);
      if (index !== currentIndex && index < displayAds.length) {
        setCurrentIndex(index);
      }
    },
    [currentIndex, displayAds.length]
  );

  const handleImageLoad = useCallback((adId: string) => {
    setImageLoaded((prev) => ({ ...prev, [adId]: true }));
  }, []);

  const handleAdPress = useCallback(
    (ad: any) => {
      if (onAdPress) onAdPress(ad);
      else
        navigation.navigate("AdList", {
          selectedAdTitle: ad.title || ad.name || "Sponsored",
          selectedAdId: ad._id,
        });
    },
    [onAdPress, navigation]
  );

  const handleDotPress = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
      stopAutoPlay();
      setTimeout(() => startAutoPlay(), 3000);
    },
    [stopAutoPlay, startAutoPlay]
  );

  const renderAdItem = useCallback(
    ({ item }: { item: any }) => {
      const isLoaded = imageLoaded[item._id] || false;
      const hasImage = !!item.image;
      return (
        <TouchableOpacity
          style={styles.adCard}
          onPress={() => handleAdPress(item)}
          activeOpacity={0.9}
        >
          <View style={styles.imageContainer}>
            {!hasImage ? (
              <LinearGradient
                colors={[Royal.royalGreenDeep, Royal.royalGreen, Royal.royalGreenMid]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.adFallbackInner}>
                  <Ionicons name="diamond" size={28} color={Royal.mint} />
                  <Text style={styles.adFallbackTitle} numberOfLines={2}>
                    {(item.title || "Sponsored").toUpperCase()}
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <>
                {!isLoaded && (
                  <View style={styles.placeholderContainer}>
                    <ActivityIndicator size="small" color={Royal.mint} />
                  </View>
                )}
                <Image
                  source={{ uri: item.image, cache: "force-cache" }}
                  style={[styles.adImage, !isLoaded && styles.imageHidden]}
                  resizeMode="cover"
                  onLoad={() => handleImageLoad(item._id)}
                  onError={() => handleImageLoad(item._id)}
                />
              </>
            )}
            <LinearGradient
              colors={["rgba(5,35,24,0)", "rgba(5,35,24,0.45)", "rgba(5,35,24,0.92)"]}
              style={styles.gradientOverlay}
            >
              <View style={styles.adContent}>
                <Text style={styles.adTitle} numberOfLines={1}>
                  {item.title || "Sponsored"}
                </Text>
                {item.description && (
                  <Text style={styles.adDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                <View style={styles.shopNowButton}>
                  <Text style={styles.shopNowText}>EXPLORE</Text>
                  <Ionicons name="arrow-forward" size={12} color={Royal.ivory} />
                </View>
              </View>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      );
    },
    [imageLoaded, handleAdPress, handleImageLoad]
  );

  if (displayAds.length === 0) return null;

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.titleRow}>
          <View style={styles.titleLine} />
          <Text style={styles.title}>{title.toUpperCase()}</Text>
          <View style={styles.titleLine} />
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={displayAds}
        renderItem={renderAdItem}
        keyExtractor={(item, index) => item._id || `ad-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.listContainer}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onTouchStart={stopAutoPlay}
        onTouchEnd={() => setTimeout(startAutoPlay, 3000)}
        removeClippedSubviews={false}
      />

      {displayAds.length > 1 && (
        <View style={styles.paginationContainer}>
          {displayAds.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.paginationDot,
                currentIndex === index && styles.paginationDotActive,
              ]}
              onPress={() => handleDotPress(index)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const AdCarousel = memo(AdCarouselBase, (prev, next) => {
  return (
    prev.ads === next.ads &&
    prev.title === next.title &&
    prev.limit === next.limit &&
    prev.autoPlayInterval === next.autoPlayInterval
  );
});

export default AdCarousel;

// ─────────────────────────────────────────────────────────────
// 🎨 Royal Green Styles — No Gold
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { marginVertical: 18 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleLine: {
    flex: 1,
    height: 1,
    backgroundColor: Royal.mintDim,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: Royal.royalGreenDeep,
    letterSpacing: 3,
    marginHorizontal: 12,
  },
  listContainer: { paddingHorizontal: 16 },
  adCard: {
    width: CARD_WIDTH,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Royal.ivory,
    borderWidth: 1,
    borderColor: Royal.mintDim,
    shadowColor: Royal.royalGreenDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
    backgroundColor: Royal.royalGreenDeep,
  },
  adImage: { width: "100%", height: "100%" },
  imageHidden: { opacity: 0 },
  placeholderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Royal.royalGreenDeep,
  },
  adFallbackInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  adFallbackTitle: {
    color: Royal.ivory,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 10,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  adContent: { flexDirection: "column" },
  adTitle: {
    color: Royal.ivory,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  adDescription: {
    color: Royal.mintSoft,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  shopNowButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Royal.royalGreen,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Royal.mintDim,
  },
  shopNowText: {
    color: Royal.ivory,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginRight: 5,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Royal.mintDim,
    marginHorizontal: 5,
  },
  paginationDotActive: { backgroundColor: Royal.royalGreen, width: 22 },
});