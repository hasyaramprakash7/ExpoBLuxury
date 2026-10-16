// src/components/ShopCard.tsx
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ViewStyle,
  TextStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ShopProduct {
  imageUrl?: string;
}

interface ShopAddress {
  city?: string;
  state?: string;
  postalCode?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
}

interface ShopOperatingHours {
  [day: string]: { open?: string; close?: string } | undefined;
}

interface ShopData {
  id: string;
  name: string;
  shopImageUrl?: string;
  distance?: number;
  address?: ShopAddress;
  products?: ShopProduct[];
  isOnline?: boolean;
  operatingHours?: ShopOperatingHours | string;
}

interface ShopCardProps {
  shop: ShopData;
  onPress: (shop: ShopData) => void;
}

// ─────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────
const Colors = {
  white: "#FFFFFF",
  grayText: "#777777",
  dark: "#0a0a09ff",
  borderGray: "#EEEEEE",
  greenDark: "#0A3D2B",
  lightgreen: "#c7e6dbff",
  orange: "#FF6600",
  openGreen: "#00A651",
  openGreenBg: "rgba(0,166,81,0.12)",
  closedRed: "#EF4444",
  closedRedBg: "rgba(239,68,68,0.12)",
};

// Fallback gradient palettes (deterministic per string key)
const AVATAR_GRADIENTS: [string, string][] = [
  ["#0A3D2B", "#1B8C40"],
  ["#1B8C40", "#4CAF7A"],
  ["#0B1021", "#2C3E50"],
  ["#7C3AED", "#A78BFA"],
  ["#D97706", "#F59E0B"],
  ["#DC2626", "#F87171"],
  ["#0891B2", "#22D3EE"],
  ["#059669", "#34D399"],
];

const PRODUCT_GRADIENTS: [string, string][] = [
  ["#F3F4F6", "#E5E7EB"],
  ["#E8F5E9", "#C8E6C9"],
  ["#E3F2FD", "#BBDEFB"],
  ["#FCE4EC", "#F8BBD0"],
  ["#FFF3E0", "#FFE0B2"],
];

const hashString = (str: string): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const pickGradient = (
  key: string,
  pool: [string, string][]
): [string, string] => pool[hashString(key) % pool.length];

const getInitials = (name: string): string => {
  const cleaned = (name || "S").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

// ─────────────────────────────────────────────────────────────
// Open/Closed — shared clock ticker (single interval for all cards)
// ─────────────────────────────────────────────────────────────
const listeners = new Set<() => void>();
let sharedInterval: ReturnType<typeof setInterval> | null = null;
let clockTick = 0;

const subscribeToClock = (fn: () => void) => {
  listeners.add(fn);
  if (sharedInterval == null) {
    sharedInterval = setInterval(() => {
      clockTick += 1;
      listeners.forEach((l) => l());
    }, 60 * 1000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && sharedInterval != null) {
      clearInterval(sharedInterval);
      sharedInterval = null;
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

// ─────────────────────────────────────────────────────────────
// isShopCurrentlyOpen
// ─────────────────────────────────────────────────────────────
const isShopCurrentlyOpen = (operatingHours: any): boolean => {
  if (!operatingHours) return false;
  try {
    const parsed =
      typeof operatingHours === "string"
        ? JSON.parse(operatingHours)
        : operatingHours;
    if (!parsed || typeof parsed !== "object") return false;

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

    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime < closeTime;
    }
    return currentTime >= openTime && currentTime < closeTime;
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
const ShopCardBase: React.FC<ShopCardProps> = ({ shop, onPress }) => {
  const tick = useClockTick();

  const products = shop.products || [];

  // Stable product list — slice(0,3) memoized
  const displayedProducts = useMemo(
    () => products.slice(0, 3).map((p) => ({ uri: p.imageUrl })),
    [products]
  );

  const computedIsOpen = useMemo(
    () => isShopCurrentlyOpen(shop.operatingHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shop.operatingHours, tick]
  );

  const finalIsOpen =
    typeof shop.isOnline === "boolean" ? shop.isOnline : computedIsOpen;

  const statusColor = finalIsOpen ? Colors.openGreen : Colors.closedRed;
  const statusBg = finalIsOpen ? Colors.openGreenBg : Colors.closedRedBg;

  // Stable press handler
  const handlePress = useCallback(() => onPress(shop), [onPress, shop]);

  // Avatar gradient fallback
  const avatarGradient = useMemo(
    () => pickGradient(shop.id || shop.name || "shop", AVATAR_GRADIENTS),
    [shop.id, shop.name]
  );

  const initials = useMemo(() => getInitials(shop.name || "Shop"), [shop.name]);

  // Product count overflow
  const extraCount = Math.max(0, products.length - 3);

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* ── Header: Avatar, Name, Badges, Distance ── */}
      <View style={styles.header}>
        <View style={styles.shopInfo}>
          {shop.shopImageUrl ? (
            <Image
              source={{ uri: shop.shopImageUrl, cache: "force-cache" }}
              style={styles.avatar}
            />
          ) : (
            <LinearGradient
              colors={avatarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>
          )}

          <View style={styles.shopNameAndBadge}>
            <Text style={styles.shopName} numberOfLines={1}>
              @{shop.name}.collections
            </Text>

            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Local Seller</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusBg, borderColor: statusColor },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: statusColor }]}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {finalIsOpen ? "Open Now" : "Closed"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.distanceContainer}>
          <Ionicons name="compass-outline" size={16} color={Colors.greenDark} />
          <Text style={styles.distanceText}>
            {shop.distance ? `${shop.distance.toFixed(1)} km` : "Near"}
          </Text>
        </View>
      </View>

      {/* ── Product Previews + CTA ── */}
      <View style={styles.productsRow}>
        <View style={styles.productImagesContainer}>
          {displayedProducts.length > 0 ? (
            displayedProducts.map((img, index) => {
              if (img.uri) {
                return (
                  <Image
                    key={index}
                    source={{ uri: img.uri, cache: "force-cache" }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                );
              }
              // No image — gradient tile with index
              const grad = pickGradient(
                `${shop.id}-${index}`,
                PRODUCT_GRADIENTS
              );
              return (
                <LinearGradient
                  key={index}
                  colors={grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.productImage, styles.productTileFallback]}
                >
                  <Ionicons
                    name="bag-handle-outline"
                    size={22}
                    color="rgba(10,61,43,0.45)"
                  />
                </LinearGradient>
              );
            })
          ) : (
            // No products at all — show a single muted tile
            <View
              style={[
                styles.productImage,
                styles.productTileFallback,
                { backgroundColor: "#F3F4F6" },
              ]}
            >
              <Ionicons
                name="storefront-outline"
                size={22}
                color="rgba(10,61,43,0.35)"
              />
            </View>
          )}

          {extraCount > 0 && (
            <View style={styles.moreProductsOverlay}>
              <Text style={styles.moreProductsText}>+{extraCount}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.viewCollectionButton}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <Text style={styles.viewCollectionButtonText}>View Collection</Text>
          <Ionicons
            name="arrow-forward-sharp"
            size={16}
            color={Colors.white}
            style={{ marginLeft: 5 }}
          />
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footerRow}>
        <Text style={styles.productsCountText}>
          Total Products:{" "}
          <Text style={styles.productsCountNumber}>{products.length}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ✅ Memo with field-level comparator — critical for Y-scroll smoothness
export const ShopCard = memo(ShopCardBase, (prev, next) => {
  if (prev.onPress !== next.onPress) return false;
  const a = prev.shop;
  const b = next.shop;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.shopImageUrl === b.shopImageUrl &&
    a.distance === b.distance &&
    a.isOnline === b.isOnline &&
    a.operatingHours === b.operatingHours &&
    a.address === b.address &&
    a.products === b.products
  );
});

export default ShopCard;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 18,
    marginHorizontal: 2,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  } as ViewStyle,

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  } as ViewStyle,

  shopInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  } as ViewStyle,

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    backgroundColor: Colors.borderGray,
    justifyContent: "center",
    alignItems: "center",
  },

  avatarInitials: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  } as TextStyle,

  shopNameAndBadge: {
    flexShrink: 1,
    flex: 1,
  } as ViewStyle,

  shopName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.dark,
  } as TextStyle,

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  } as ViewStyle,

  badge: {
    backgroundColor: Colors.lightgreen,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignSelf: "flex-start",
    marginRight: 6,
  } as ViewStyle,

  badgeText: {
    color: Colors.greenDark,
    fontSize: 10,
    fontWeight: "700",
  } as TextStyle,

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    alignSelf: "flex-start",
  } as ViewStyle,

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  } as ViewStyle,

  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  } as TextStyle,

  distanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#F5FFF9",
    borderWidth: 1,
    borderColor: Colors.lightgreen,
  } as ViewStyle,

  distanceText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.greenDark,
    marginLeft: 4,
  } as TextStyle,

  productsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  } as ViewStyle,

  productImagesContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  } as ViewStyle,

  productImage: {
    width: 55,
    height: 55,
    borderRadius: 10,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    backgroundColor: Colors.borderGray,
  },

  productTileFallback: {
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,

  moreProductsOverlay: {
    width: 55,
    height: 55,
    borderRadius: 10,
    marginLeft: -10,
    backgroundColor: Colors.greenDark,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.white,
  } as ViewStyle,

  moreProductsText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
  } as TextStyle,

  viewCollectionButton: {
    backgroundColor: Colors.greenDark,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  } as ViewStyle,

  viewCollectionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  } as TextStyle,

  footerRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
    paddingTop: 10,
  } as ViewStyle,

  productsCountText: {
    fontSize: 14,
    color: Colors.grayText,
    fontWeight: "400",
  } as TextStyle,

  productsCountNumber: {
    fontWeight: "600",
    color: Colors.dark,
  } as TextStyle,
});