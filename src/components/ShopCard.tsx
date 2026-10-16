// src/components/ShopCard.tsx
import React, { useState, useMemo, memo, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Vendor } from "../types";
import {
  Colors,
  getFullAddress,
  scale,
  verticalScale,
  moderateScale,
} from "../constants/colors";
import VendorHorizontalScroll from "./VendorHorizontalScroll";
import Share from "react-native-share";
import { Share as RNShare } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// ─────────────────────────────────────────────────────────────
// 🩺 DIAGNOSTICS
// ─────────────────────────────────────────────────────────────
const DIAG = false;
const dlog = (...args: any[]) => DIAG && console.log("🩺[ShopCard]", ...args);
const dwarn = (...args: any[]) => DIAG && console.warn("⚠️[ShopCard]", ...args);
const renderCounts = new Map<string, number>();

const PLAY_STORE_LINK =
  "https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury";
const APP_STORE_LINK =
  "https://apps.apple.com/app/bluxury/id123456789";

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
  ivory: "#FFFFFF",
  cream: "#FBF7EE",
  creamDark: "#F5EDD9",
  parchment: "#FDFBF5",

  // Green accents
  emerald: "#0E6B4F",
  emeraldLight: "#14875F",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const parseArrayField = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) {
    if (
      field.length === 1 &&
      typeof field[0] === "string" &&
      field[0].startsWith("[")
    ) {
      try {
        const parsed = JSON.parse(field[0]);
        if (Array.isArray(parsed))
          return parsed.map((item) => String(item).trim()).filter(Boolean);
      } catch (_) {}
    }
    return field.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed))
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      if (field.includes(","))
        return field.split(",").map((s) => s.trim()).filter(Boolean);
      return [field.trim()].filter(Boolean);
    }
  }
  return [];
};

const pickFirstString = (...vals: any[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (Array.isArray(v)) {
      const found = v.find((x) => typeof x === "string" && x.trim().length > 0);
      if (found) return String(found).trim();
    }
  }
  return undefined;
};

const resolveShopImageUri = (shop: any): string | undefined =>
  pickFirstString(
    shop?.shopImage,
    shop?.shopImageUrl,
    shop?.image,
    shop?.imageUrl,
    shop?.logo,
    shop?.logoUrl,
    shop?.banner,
    shop?.bannerImage,
    shop?.shopImages,
    shop?.images,
    shop?.productImages
  );

const isShopCurrentlyOpen = (operatingHours: any): boolean => {
  if (!operatingHours) return false;
  try {
    const parsed =
      typeof operatingHours === "string"
        ? JSON.parse(operatingHours)
        : operatingHours;
    const now = new Date();
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const currentDay = days[now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const daySchedule = parsed[currentDay];
    if (!daySchedule?.open || !daySchedule?.close) return false;
    const [openHour, openMinute] = daySchedule.open.split(":").map(Number);
    const [closeHour, closeMinute] = daySchedule.close.split(":").map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    if (closeTime < openTime)
      return currentTime >= openTime || currentTime < closeTime;
    return currentTime >= openTime && currentTime < closeTime;
  } catch {
    return false;
  }
};

// Shared clock (unchanged)
const clockListeners = new Set<() => void>();
let sharedClock: ReturnType<typeof setInterval> | null = null;
let clockTick = 0;

const subscribeToClock = (fn: () => void) => {
  clockListeners.add(fn);
  if (sharedClock == null) {
    sharedClock = setInterval(() => {
      clockTick += 1;
      clockListeners.forEach((l) => l());
    }, 60 * 1000);
  }
  return () => {
    clockListeners.delete(fn);
    if (clockListeners.size === 0 && sharedClock) {
      clearInterval(sharedClock);
      sharedClock = null;
    }
  };
};

const useClockTick = (): number => {
  const [tick, setTick] = useState(clockTick);
  useEffect(() => {
    const unsub = subscribeToClock(() => setTick(clockTick));
    return unsub;
  }, []);
  return tick;
};

// Deterministic royal green gradient fallback
const hashString = (str: string): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const ROYAL_GREEN_GRADIENTS: [string, string, string][] = [
  ["#052318", "#0B3D2E", "#1A5C47"],
  ["#0B3D2E", "#0F4A38", "#2A7A5E"],
  ["#052318", "#0F4A38", "#7FBFA4"],
  ["#0B3D2E", "#1A5C47", "#A8D5C2"],
  ["#0F4A38", "#0B3D2E", "#1A5C47"],
  ["#052318", "#1A5C47", "#2A7A5E"],
];

const pickRoyalGreenGradient = (key: string): [string, string, string] =>
  ROYAL_GREEN_GRADIENTS[hashString(key) % ROYAL_GREEN_GRADIENTS.length];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface ShopCardProps {
  shop: Vendor & {
    distance?: number;
    productsCount: number;
    productImages: string[];
    shopImage?: string;
    isInRange?: boolean;
  };
  onPress: (shop: any) => void;
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
const ShopCardBase: React.FC<ShopCardProps> = ({ shop, onPress }) => {
  const key = shop?._id || shop?.shopName || "unknown";
  const n = (renderCounts.get(key) || 0) + 1;
  renderCounts.set(key, n);

  const [imageFailed, setImageFailed] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const tick = useClockTick();

  const heroImageUri = useMemo(
    () => resolveShopImageUri(shop),
    [
      shop.shopImage,
      shop.shopImageUrl,
      shop.image,
      shop.imageUrl,
      shop.logo,
      shop.logoUrl,
      shop.banner,
      shop.bannerImage,
    ]
  );

  const showHeroImage = !!heroImageUri && !imageFailed;

  const categories = useMemo(
    () => parseArrayField(shop.categories),
    [shop.categories]
  );
  const services = useMemo(
    () => parseArrayField(shop.services),
    [shop.services]
  );
  const tags = useMemo(() => parseArrayField(shop.tags), [shop.tags]);

  const fullAddress = useMemo(
    () => getFullAddress(shop.address),
    [shop.address]
  );

  const isOpen = useMemo(
    () => isShopCurrentlyOpen(shop.operatingHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shop.operatingHours, tick]
  );

  const categoryTags = useMemo(() => categories.slice(0, 3), [categories]);
  const serviceTags = useMemo(() => services.slice(0, 3), [services]);
  const royalGradient = useMemo(
    () => pickRoyalGreenGradient(shop._id || shop.shopName || "shop"),
    [shop._id, shop.shopName]
  );

  const handlePress = useCallback(() => onPress(shop), [onPress, shop]);

  const buildShareMessage = useCallback((): string => {
    const shopName = shop.shopName || "Shop";
    const mapsLink = (() => {
      const lat = shop.address?.latitude;
      const lng = shop.address?.longitude;
      if (lat && lng)
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      if (fullAddress)
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          fullAddress
        )}`;
      return "";
    })();

    const appLink = Platform.OS === "ios" ? APP_STORE_LINK : PLAY_STORE_LINK;
    const categoryStr = categories.length ? categories.join(", ") : "N/A";
    const serviceStr = services.length ? services.join(", ") : "N/A";

    let message = `🏪 *${shopName}*\n\n`;
    message += `📋 *Business Type:* ${shop.businessType || "Shop"}\n`;
    if (fullAddress) message += `📍 *Location:* ${fullAddress}\n`;
    if (mapsLink) message += `🗺️ *View on Google Maps:* ${mapsLink}\n`;
    if (shop.phone) message += `📞 *Phone:* ${shop.phone}\n`;
    if (shop.distance != null)
      message += `📏 *Distance:* ${shop.distance.toFixed(1)} km\n`;
    if (categoryStr !== "N/A") message += `📂 *Categories:* ${categoryStr}\n`;
    if (serviceStr !== "N/A") message += `🛠️ *Services:* ${serviceStr}\n`;
    message += `🛍️ *Products:* ${shop.productsCount || 0} items\n`;
    if (shop.deliveryRange && shop.deliveryRange > 0)
      message += `🚚 *Delivery Range:* ${shop.deliveryRange} km\n`;
    message += `🕐 *Status:* ${isOpen ? "✅ Open Now" : "❌ Closed"}\n`;
    if (shop.averageRating)
      message += `⭐ *Rating:* ${shop.averageRating.toFixed(1)} (${
        shop.reviewCount || 0
      } reviews)\n`;
    message += `\n📱 *Download App:* ${appLink}`;
    return message;
  }, [shop, fullAddress, categories, services, isOpen]);

  const downloadImageToLocal = useCallback(
    async (imageUrl: string): Promise<string | null> => {
      try {
        const filePath = `${FileSystem.cacheDirectory}shop_${Date.now()}.jpg`;
        const result = await FileSystem.downloadAsync(imageUrl, filePath);
        if (result.status === 200)
          return Platform.OS === "android" ? `file://${result.uri}` : result.uri;
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  const handleShareWhatsApp = useCallback(async () => {
    setIsSharing(true);
    try {
      const message = buildShareMessage();
      if (heroImageUri) {
        try {
          const localFilePath = await downloadImageToLocal(heroImageUri);
          if (localFilePath) {
            await Share.shareSingle({
              title: "BLuxury Shop",
              message,
              url: localFilePath,
              type: "image/jpeg",
              social: Share.Social.WHATSAPP,
            });
            setIsSharing(false);
            return;
          }
        } catch {}
      }
      const phone = shop.phone || "";
      const waUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(
        message
      )}`;
      if (await Linking.canOpenURL(waUrl)) await Linking.openURL(waUrl);
      else await Share.open({ title: "BLuxury Shop", message });
    } catch (e) {
      if (e instanceof Error && e.message !== "User cancelled") {
        Alert.alert("Share Error", "Could not share to WhatsApp.");
      }
    } finally {
      setIsSharing(false);
    }
  }, [heroImageUri, buildShareMessage, shop.phone, downloadImageToLocal]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const message = buildShareMessage();
      if (heroImageUri) {
        try {
          const localFilePath = await downloadImageToLocal(heroImageUri);
          if (localFilePath) {
            await Share.open({
              title: "BLuxury Shop",
              message,
              url: localFilePath,
              type: "image/jpeg",
            });
            setIsSharing(false);
            return;
          }
        } catch {}
      }
      await RNShare.share({ message, title: "BLuxury Shop" });
    } catch (e) {
      if (e instanceof Error && e.message !== "User cancelled") {
        Alert.alert("Share Error", "Could not share shop.");
      }
    } finally {
      setIsSharing(false);
    }
  }, [heroImageUri, buildShareMessage, downloadImageToLocal]);

  return (
    <TouchableOpacity
      style={shopCardStyles.cardContainer}
      onPress={handlePress}
      activeOpacity={0.95}
    >
      {/* Green hairline on top edge */}
      <LinearGradient
        colors={["rgba(11,61,46,0)", Royal.royalGreen, "rgba(11,61,46,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={shopCardStyles.topGreenLine}
        pointerEvents="none"
      />

      {showHeroImage ? (
        <View style={shopCardStyles.imageHeader}>
          <Image
            source={{ uri: heroImageUri!, cache: "force-cache" }}
            style={shopCardStyles.shopImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
          {/* Royal corner ornaments */}
          <View style={[shopCardStyles.cornerOrnament, { top: 10, left: 10 }]}>
            <View style={shopCardStyles.ornamentL} />
            <View style={shopCardStyles.ornamentT} />
          </View>
          <View
            style={[shopCardStyles.cornerOrnament, { top: 10, right: 10, alignItems: "flex-end" }]}
          >
            <View style={shopCardStyles.ornamentL} />
            <View style={shopCardStyles.ornamentT} />
          </View>

          <View style={shopCardStyles.imageOverlayBadges}>
            {shop.isVerified && (
              <View style={shopCardStyles.overlayBadge}>
                <Ionicons
                  name="shield-checkmark"
                  size={scale(14)}
                  color={Royal.mint}
                />
              </View>
            )}
            {shop.isPremium && (
              <LinearGradient
                colors={[Royal.royalGreen, Royal.royalGreenMid]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={shopCardStyles.premiumBadge}
              >
                <Ionicons name="diamond" size={scale(10)} color={Royal.ivory} />
                <Text style={shopCardStyles.premiumBadgeText}>ROYAL</Text>
              </LinearGradient>
            )}
          </View>

          <View style={shopCardStyles.onlineStatusOverlay}>
            <View
              style={[
                shopCardStyles.statusDot,
                {
                  backgroundColor: isOpen
                    ? Colors.onlineGreen
                    : Colors.offlineRed,
                },
              ]}
            />
            <Text
              style={[
                shopCardStyles.statusTextOverlay,
                {
                  color: isOpen ? "#7FE5A8" : "#FF8F8F",
                },
              ]}
            >
              {isOpen ? "OPEN" : "CLOSED"}
            </Text>
          </View>

          {shop.isInRange === false && shop.distance && (
            <View style={shopCardStyles.outOfRangeBadge}>
              <Ionicons
                name="location-outline"
                size={scale(10)}
                color={Royal.ivory}
              />
              <Text style={shopCardStyles.outOfRangeText}>
                {shop.distance.toFixed(1)} km
              </Text>
            </View>
          )}
        </View>
      ) : (
        <LinearGradient
          colors={royalGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shopCardStyles.imageHeader}
        >
          {/* Green corner ornaments */}
          <View style={[shopCardStyles.cornerOrnament, { top: 10, left: 10 }]}>
            <View style={shopCardStyles.ornamentL} />
            <View style={shopCardStyles.ornamentT} />
          </View>
          <View
            style={[shopCardStyles.cornerOrnament, { top: 10, right: 10, alignItems: "flex-end" }]}
          >
            <View style={shopCardStyles.ornamentL} />
            <View style={shopCardStyles.ornamentT} />
          </View>

          <View style={shopCardStyles.heroFallbackInner}>
            <Ionicons name="diamond" size={scale(22)} color={Royal.mint} />
            <Text style={shopCardStyles.heroFallbackText} numberOfLines={2}>
              {shop.shopName || "Shop"}
            </Text>
            <View style={shopCardStyles.heroDivider} />
            <Text style={shopCardStyles.heroFallbackSub}>
              {(shop.businessType || "LOCAL STORE").toUpperCase()}
            </Text>
          </View>

          <View style={shopCardStyles.onlineStatusOverlay}>
            <View
              style={[
                shopCardStyles.statusDot,
                {
                  backgroundColor: isOpen
                    ? Colors.onlineGreen
                    : Colors.offlineRed,
                },
              ]}
            />
            <Text
              style={[
                shopCardStyles.statusTextOverlay,
                {
                  color: isOpen ? "#7FE5A8" : "#FF8F8F",
                },
              ]}
            >
              {isOpen ? "OPEN" : "CLOSED"}
            </Text>
          </View>
        </LinearGradient>
      )}

      <View style={shopCardStyles.infoSection}>
        <View style={shopCardStyles.nameRow}>
          <Text style={shopCardStyles.shopName} numberOfLines={1}>
            {shop.shopName}
          </Text>
          <Text style={shopCardStyles.businessType} numberOfLines={1}>
            {(shop.businessType || "Shop").toUpperCase()}
          </Text>
        </View>

        <View style={shopCardStyles.greenHairline} />

        <View style={shopCardStyles.ratingRow}>
          {shop.averageRating ? (
            <LinearGradient
              colors={[Royal.royalGreen, Royal.royalGreenMid]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={shopCardStyles.ratingPill}
            >
              <Text style={shopCardStyles.ratingNumber}>
                {shop.averageRating.toFixed(1)}
              </Text>
              <Ionicons name="star" size={scale(11)} color={Royal.ivory} />
            </LinearGradient>
          ) : null}
          {shop.reviewCount ? (
            <Text style={shopCardStyles.reviewCount}>
              {shop.reviewCount} reviews
            </Text>
          ) : null}
          {shop.distance !== undefined && shop.distance !== null && (
            <View style={shopCardStyles.distancePill}>
              <Ionicons
                name="location-outline"
                size={scale(11)}
                color={shop.isInRange ? Royal.royalGreen : "#A33" }
              />
              <Text
                style={[
                  shopCardStyles.distanceText,
                  {
                    color: shop.isInRange ? Royal.royalGreen : "#A33",
                  },
                ]}
              >
                {shop.distance.toFixed(1)} km{!shop.isInRange && " • far"}
              </Text>
            </View>
          )}
        </View>

        <View style={shopCardStyles.addressRow}>
          <Ionicons
            name="location-outline"
            size={scale(13)}
            color={Royal.royalGreen}
          />
          <Text style={shopCardStyles.addressText}>{fullAddress}</Text>
        </View>

        {categoryTags.length > 0 && (
          <View style={shopCardStyles.tagsContainer}>
            {categoryTags.map((cat, idx) => (
              <View
                key={`cat-${idx}`}
                style={[shopCardStyles.tagPill, shopCardStyles.categoryTag]}
              >
                <Text style={shopCardStyles.tagText}>{cat}</Text>
              </View>
            ))}
            {categories.length > 3 && (
              <Text style={shopCardStyles.moreTag}>
                +{categories.length - 3}
              </Text>
            )}
          </View>
        )}

        {serviceTags.length > 0 && (
          <View style={shopCardStyles.tagsContainer}>
            {serviceTags.map((svc, idx) => (
              <View
                key={`service-${idx}`}
                style={[shopCardStyles.tagPill, shopCardStyles.serviceTag]}
              >
                <Text style={shopCardStyles.tagText}>{svc}</Text>
              </View>
            ))}
            {services.length > 3 && (
              <Text style={shopCardStyles.moreTag}>+{services.length - 3}</Text>
            )}
          </View>
        )}

        {categories.length === 0 &&
          services.length === 0 &&
          tags.length > 0 && (
            <View style={shopCardStyles.tagsContainer}>
              {tags.slice(0, 4).map((tag, idx) => (
                <View
                  key={`tag-${idx}`}
                  style={[shopCardStyles.tagPill, shopCardStyles.tagTag]}
                >
                  <Text style={shopCardStyles.tagText}>{tag}</Text>
                </View>
              ))}
              {tags.length > 4 && (
                <Text style={shopCardStyles.moreTag}>+{tags.length - 4}</Text>
              )}
            </View>
          )}

        {shop.deliveryRange !== undefined && shop.deliveryRange > 0 && (
          <View style={shopCardStyles.deliveryRow}>
            <Ionicons
              name="bicycle-outline"
              size={scale(13)}
              color={Royal.royalGreen}
            />
            <Text style={shopCardStyles.deliveryText}>
              Delivers up to {shop.deliveryRange} km
            </Text>
          </View>
        )}

        {(shop.phone || shop.email) && (
          <View style={shopCardStyles.contactRow}>
            {shop.phone && (
              <Text style={shopCardStyles.contactText}>☎ {shop.phone}</Text>
            )}
            {shop.phone && shop.email && (
              <Text style={shopCardStyles.dotSeparator}> ◆ </Text>
            )}
            {shop.email && (
              <Text style={shopCardStyles.contactText}>✉ {shop.email}</Text>
            )}
          </View>
        )}
      </View>

      {shop._id && (
        <View style={shopCardStyles.horizontalScrollContainer}>
          <VendorHorizontalScroll
            vendorId={shop._id}
            vendorName={shop.shopName}
            isVendorOffline={!shop.isOnline}
            onSeeAll={handlePress}
          />
        </View>
      )}

      <View style={shopCardStyles.royalDivider}>
        <View style={shopCardStyles.royalDividerLine} />
        <Ionicons
          name="diamond-outline"
          size={scale(10)}
          color={Royal.royalGreen}
          style={{ marginHorizontal: scale(6) }}
        />
        <View style={shopCardStyles.royalDividerLine} />
      </View>

      <View style={shopCardStyles.bottomRow}>
        <View style={shopCardStyles.bottomLeft}>
          <LinearGradient
            colors={[Royal.royalGreen, Royal.royalGreenMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={shopCardStyles.offerIconBadge}
          >
            <Ionicons name="sparkles" size={moderateScale(16)} color={Royal.ivory} />
          </LinearGradient>
          <View>
            <Text style={shopCardStyles.offerTitle}>
              {shop.productsCount > 0
                ? `${shop.productsCount} Exquisite Items`
                : "Explore Collection"}
            </Text>
            <Text style={shopCardStyles.offerSubtitle}>
              CURATED • AVAILABLE NOW
            </Text>
          </View>
        </View>

        <View style={shopCardStyles.rightSection}>
          <View style={shopCardStyles.productImagesContainer}>
            {shop.productImages && shop.productImages.length > 0 ? (
              shop.productImages.slice(0, 3).map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: img, cache: "force-cache" }}
                  style={[
                    shopCardStyles.miniProductImg,
                    { marginLeft: idx > 0 ? -scale(12) : 0, zIndex: 3 - idx },
                  ]}
                />
              ))
            ) : (
              <Ionicons
                name="arrow-forward-circle"
                size={moderateScale(26)}
                color={Royal.royalGreen}
              />
            )}
          </View>

          <View style={shopCardStyles.shareButtonsContainer}>
            <TouchableOpacity
              style={[
                shopCardStyles.shareBtnSmall,
                shopCardStyles.shareBtnStyle,
              ]}
              onPress={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Royal.ivory} />
              ) : (
                <Ionicons name="share-social" size={12} color={Royal.ivory} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                shopCardStyles.shareBtnSmall,
                shopCardStyles.whatsappShareBtn,
              ]}
              onPress={handleShareWhatsApp}
              disabled={isSharing}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color={Royal.ivory} />
              ) : (
                <Ionicons name="logo-whatsapp" size={12} color={Royal.ivory} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const ShopCard = memo(ShopCardBase, (prev, next) => {
  if (prev.onPress !== next.onPress) return false;
  const a = prev.shop;
  const b = next.shop;
  return (
    a._id === b._id &&
    a.shopName === b.shopName &&
    a.businessType === b.businessType &&
    a.distance === b.distance &&
    a.isInRange === b.isInRange &&
    a.isOnline === b.isOnline &&
    a.isVerified === b.isVerified &&
    a.isPremium === b.isPremium &&
    a.averageRating === b.averageRating &&
    a.reviewCount === b.reviewCount &&
    a.productsCount === b.productsCount &&
    a.deliveryRange === b.deliveryRange &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.shopImage === b.shopImage &&
    a.categories === b.categories &&
    a.services === b.services &&
    a.tags === b.tags &&
    a.operatingHours === b.operatingHours
  );
});

export default ShopCard;

// ─────────────────────────────────────────────────────────────
// 🎨 Royal Green Styles — No Gold
// ─────────────────────────────────────────────────────────────
const shopCardStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Royal.ivory,
    borderRadius: moderateScale(22),
    marginVertical: verticalScale(12),
    marginHorizontal: scale(16),
    borderWidth: 1,
    borderColor: Royal.mintDim,
    shadowColor: Royal.royalGreenDeep,
    shadowOffset: { width: 0, height: verticalScale(10) },
    shadowOpacity: 0.18,
    shadowRadius: moderateScale(16),
    elevation: 9,
    overflow: "hidden",
  },
  topGreenLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    zIndex: 20,
  },
  imageHeader: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
    backgroundColor: Royal.royalGreenDeep,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  cornerOrnament: {
    position: "absolute",
    width: scale(22),
    height: scale(22),
  },
  ornamentL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: scale(14),
    height: 1.5,
    backgroundColor: Royal.mint,
    opacity: 0.85,
  },
  ornamentT: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 1.5,
    height: scale(14),
    backgroundColor: Royal.mint,
    opacity: 0.85,
  },
  heroFallbackInner: {
    paddingHorizontal: scale(24),
    alignItems: "center",
    justifyContent: "center",
  },
  heroFallbackText: {
    color: Royal.ivory,
    fontSize: moderateScale(26),
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
    marginTop: verticalScale(10),
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroDivider: {
    width: scale(48),
    height: 1.5,
    backgroundColor: Royal.mint,
    marginVertical: verticalScale(8),
    opacity: 0.8,
  },
  heroFallbackSub: {
    color: Royal.mintSoft,
    fontSize: moderateScale(10),
    fontWeight: "700",
    letterSpacing: 2.2,
  },
  shopImage: { width: "100%", height: "100%" },
  imageOverlayBadges: {
    position: "absolute",
    top: verticalScale(12),
    right: scale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  overlayBadge: {
    backgroundColor: "rgba(5,35,24,0.85)",
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderWidth: 1,
    borderColor: Royal.mintDim,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    gap: scale(3),
  },
  premiumBadgeText: {
    color: Royal.ivory,
    fontSize: moderateScale(9),
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  onlineStatusOverlay: {
    position: "absolute",
    bottom: verticalScale(12),
    left: scale(12),
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5,35,24,0.85)",
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: Royal.mintDim,
  },
  statusDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
    marginRight: scale(6),
  },
  statusTextOverlay: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  outOfRangeBadge: {
    position: "absolute",
    bottom: verticalScale(12),
    right: scale(12),
    backgroundColor: "rgba(11,61,46,0.95)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    gap: scale(4),
    borderWidth: 1,
    borderColor: Royal.mintDim,
  },
  outOfRangeText: {
    color: Royal.ivory,
    fontSize: moderateScale(10),
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  infoSection: { padding: moderateScale(18) },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(6),
  },
  shopName: {
    fontSize: moderateScale(21),
    fontWeight: "900",
    color: Royal.royalGreenDeep,
    letterSpacing: 0.3,
    flex: 1,
  },
  businessType: {
    fontSize: moderateScale(10),
    color: Royal.royalGreen,
    marginLeft: scale(8),
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  greenHairline: {
    height: 1,
    backgroundColor: Royal.mintDim,
    marginBottom: verticalScale(8),
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(2),
    flexWrap: "wrap",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    marginRight: scale(6),
  },
  ratingNumber: {
    color: Royal.ivory,
    fontWeight: "900",
    fontSize: moderateScale(12),
    marginRight: scale(3),
    letterSpacing: 0.5,
  },
  reviewCount: {
    color: Royal.royalGreen,
    fontSize: moderateScale(12),
    marginRight: scale(6),
    fontWeight: "600",
    opacity: 0.75,
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Royal.mintFaint,
    borderWidth: 1,
    borderColor: Royal.mintDim,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
  },
  distanceText: {
    fontSize: moderateScale(11),
    marginLeft: scale(3),
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: verticalScale(6),
  },
  addressText: {
    fontSize: moderateScale(13),
    color: Royal.royalGreen,
    marginLeft: scale(6),
    flex: 1,
    flexWrap: "wrap",
    lineHeight: moderateScale(19),
    opacity: 0.85,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: verticalScale(8),
  },
  tagPill: {
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(9),
    paddingVertical: verticalScale(4),
    marginRight: scale(6),
    marginBottom: verticalScale(4),
    borderWidth: 1,
  },
  categoryTag: {
    backgroundColor: "rgba(11,61,46,0.08)",
    borderColor: "rgba(11,61,46,0.25)",
  },
  serviceTag: {
    backgroundColor: "rgba(127,191,164,0.12)",
    borderColor: Royal.mintDim,
  },
  tagTag: {
    backgroundColor: "rgba(5,35,24,0.06)",
    borderColor: "rgba(5,35,24,0.20)",
  },
  tagText: {
    fontSize: moderateScale(11),
    color: Royal.royalGreenDeep,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  moreTag: {
    fontSize: moderateScale(11),
    color: Royal.royalGreen,
    marginLeft: scale(4),
    alignSelf: "center",
    fontWeight: "700",
  },
  horizontalScrollContainer: {
    marginTop: verticalScale(2),
    marginBottom: verticalScale(2),
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(6),
  },
  deliveryText: {
    fontSize: moderateScale(11),
    color: Royal.royalGreen,
    marginLeft: scale(5),
    fontWeight: "600",
    opacity: 0.8,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(6),
    flexWrap: "wrap",
  },
  contactText: {
    fontSize: moderateScale(11),
    color: Royal.royalGreenDeep,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  dotSeparator: {
    color: Royal.royalGreen,
    fontSize: moderateScale(9),
    marginHorizontal: scale(4),
  },
  royalDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(18),
    marginVertical: verticalScale(2),
  },
  royalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Royal.mintDim,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(18),
    paddingBottom: moderateScale(18),
    paddingTop: moderateScale(10),
  },
  bottomLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rightSection: { flexDirection: "row", alignItems: "center", gap: scale(6) },
  offerIconBadge: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(10),
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  offerTitle: {
    fontSize: moderateScale(14),
    fontWeight: "900",
    color: Royal.royalGreenDeep,
    marginBottom: verticalScale(1),
    letterSpacing: 0.2,
  },
  offerSubtitle: {
    fontSize: moderateScale(9),
    fontWeight: "700",
    color: Royal.royalGreen,
    letterSpacing: 1.4,
  },
  productImagesContainer: { flexDirection: "row", alignItems: "center" },
  miniProductImg: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    borderColor: Royal.mint,
    backgroundColor: Royal.cream,
  },
  shareButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    marginLeft: scale(6),
  },
  shareBtnSmall: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  shareBtnStyle: {
    backgroundColor: Royal.royalGreen,
    borderColor: Royal.mintDim,
  },
  whatsappShareBtn: {
    backgroundColor: Royal.royalGreenDeep,
    borderColor: Royal.mintDim,
  },
});