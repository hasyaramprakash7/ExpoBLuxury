// src/screens/ShopListings.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  ImageSourcePropType,
  RefreshControl,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { searchDirectoryVendors } from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import * as Location from "expo-location";
import {
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  selectAllAddresses,
} from "../features/locationSlice";
import { fetchCategories } from "../features/categorySlice";
import { createSelector } from "@reduxjs/toolkit";
import Toast from "react-native-toast-message";

import {
  Colors,
  calculateDistance,
  scale,
  verticalScale,
  moderateScale,
} from "../constants/colors";
import { ShopCard } from "../components/ShopCard";
import AdCarousel from "../components/AdCarousel";
import AddAddressScreen from "./AddAddressScreen";
import { navigationRef } from "../userScreens/utils/navigationRef";

// ─────────────────────────────────────────────────────────────
// 🖼️ LOCAL IMAGES (asserts)
// ─────────────────────────────────────────────────────────────
// Place these files in your project's assets folder.
// Update the paths below to match your project structure.
const LOCAL_IMAGES = {
  rental: require("../../assets/rental.jpg") as ImageSourcePropType,
  property: require("../../assets/pro.jpg") as ImageSourcePropType,
};

// ─────────────────────────────────────────────────────────────
// 🩺 DIAGNOSTICS (off)
// ─────────────────────────────────────────────────────────────
const DIAG = false;
const dlog = (...args: any[]) => DIAG && console.log("🩺[ShopListings]", ...args);
const dwarn = (...args: any[]) =>
  DIAG && console.warn("⚠️[ShopListings]", ...args);

const { width, height } = Dimensions.get("window");
const CATEGORY_DISPLAY_LIMIT = 30;
const FETCH_STALE_MS = 5 * 60 * 1000;
const DEFAULT_RADIUS_KM = 2;
const RADIUS_PRESETS = [2, 4, 5, 7, 9, 10, 20, 30, 50, 100];
// If user has scrolled more than this, first back press scrolls to top.
const SCROLL_TOP_THRESHOLD = 40;

// ─────────────────────────────────────────────────────────────
// 🎨 PALETTE (Solid, non-glass)
// ─────────────────────────────────────────────────────────────
const Palette = {
  primary: "#0B3D2E",
  primaryDeep: "#052318",
  primaryMid: "#0F4A38",
  primarySoft: "#1A5C47",
  primaryLight: "#2A7A5E",
  accent: "#7FBFA4",
  accentSoft: "#A8D5C2",
  obsidian: "#0A0A0C",
  charcoal: "#1A1A1E",
  ivory: "#FFFFFF",
  cream: "#FBF7EE",
  creamDark: "#F5EDD9",
  parchment: "#FDFBF5",
  emerald: "#0E6B4F",
  emeraldLight: "#14875F",
  pureWhite: "#FFFFFF",
  pureBlack: "#000000",
  offWhite: "#F4F4F6",
  softBlack: "#111111",
  borderLight: "rgba(0,0,0,0.08)",
  borderMedium: "rgba(0,0,0,0.15)",
  borderDark: "rgba(0,0,0,0.22)",
  shadow: "rgba(0,0,0,0.10)",
  overlay: "rgba(10,10,12,0.45)",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E5EA",
  chipBg: "#F2F2F7",
  chipBorder: "#D1D1D6",
  chipActiveBg: "#000000",
  chipActiveText: "#FFFFFF",
  sectionLine: "#C7C7CC",
};

// ─────────────────────────────────────────────────────────────
// Ad Carousel wrapper
// ─────────────────────────────────────────────────────────────
const selectGenericAds = createSelector(
  (state: RootState) => state.ads?.activeAds || [],
  (activeAds) => activeAds.filter((ad) => ad.isProductAd === false)
);

const AdCarouselWithNavigation = memo(
  ({ limit = 105, title = "Sponsored" }: { limit?: number; title?: string }) => {
    const navigation = useNavigation<any>();
    const allGenericAds = useSelector(selectGenericAds);
    const genericAds = useMemo(
      () => allGenericAds.slice(0, limit),
      [allGenericAds, limit]
    );
    const handleAdPress = useCallback(
      (ad: any) => {
        navigation.navigate("AdList", {
          selectedAdTitle: ad.title || ad.name || "Sponsored",
          selectedAdId: ad._id,
        });
      },
      [navigation]
    );
    if (!genericAds || genericAds.length === 0) return null;
    return (
      <AdCarousel ads={genericAds} title={title} onAdPress={handleAdPress} />
    );
  }
);
AdCarouselWithNavigation.displayName = "AdCarouselWithNavigation";

// ─────────────────────────────────────────────────────────────
// Quick Navigation
// ─────────────────────────────────────────────────────────────
interface QuickNavItem {
  key: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  routeName: string;
  image?: ImageSourcePropType;
}

const QUICK_NAV_ITEMS: QuickNavItem[] = [
  {
    key: "rental",
    label: "RENTAL",
    subtitle: "Rentals near you",
    icon: "key",
    routeName: "RentalList",
    image: LOCAL_IMAGES.rental,
  },
  {
    key: "property",
    label: "PROPERTY",
    subtitle: "Buy & sell property",
    icon: "home",
    routeName: "UserPropertyListScreen",
    image: LOCAL_IMAGES.property,
  },
  // {
  //   key: "shop",
  //   label: "SHOP",
  //   subtitle: "Browse boutiques",
  //   icon: "storefront",
  //   routeName: "Order",
  // },
];

const QuickNavCard = memo(
  ({
    item,
    onPress,
  }: {
    item: QuickNavItem;
    onPress: (item: QuickNavItem) => void;
  }) => {
    const handlePress = useCallback(() => onPress(item), [onPress, item]);
    return (
      <TouchableOpacity
        style={quickNavStyles.card}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Full-bleed image block */}
        <View style={quickNavStyles.imageBlock}>
          {item.image ? (
            <Image
              source={item.image}
              style={quickNavStyles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={quickNavStyles.iconFallback}>
              <Ionicons
                name={item.icon}
                size={scale(22)}
                color={Palette.pureBlack}
              />
            </View>
          )}
        </View>

        {/* Text area below the image */}
        <View style={quickNavStyles.textBlock}>
          <Text style={quickNavStyles.cardLabel}>{item.label}</Text>
          <Text style={quickNavStyles.cardSubtitle} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
);
QuickNavCard.displayName = "QuickNavCard";

const QuickNavRow = memo(
  ({ onPress }: { onPress: (item: QuickNavItem) => void }) => {
    return (
      <View style={quickNavStyles.row}>
        {QUICK_NAV_ITEMS.map((item) => (
          <QuickNavCard key={item.key} item={item} onPress={onPress} />
        ))}
      </View>
    );
  }
);
QuickNavRow.displayName = "QuickNavRow";

// ─────────────────────────────────────────────────────────────
// Category item + grid
// ─────────────────────────────────────────────────────────────
interface CategoryItem {
  name: string;
  count: number;
  image?: string;
  _id?: string;
}

const CategoryGridItem = memo(
  ({
    category,
    onPress,
  }: {
    category: CategoryItem;
    onPress: (c: CategoryItem) => void;
  }) => {
    const handlePress = useCallback(() => onPress(category), [onPress, category]);
    const displayName =
      typeof category.name === "string"
        ? category.name
        : String(category.name || "Category");

    if (!category.image) {
      return (
        <TouchableOpacity
          style={styles.categoryGridItem}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          <View style={styles.categoryTextContainer}>
            <Ionicons
              name="diamond-outline"
              size={scale(12)}
              color={Palette.pureBlack}
              style={{ marginBottom: verticalScale(4) }}
            />
            <Text style={styles.categoryGridName} numberOfLines={2}>
              {displayName.toUpperCase()}
            </Text>
            <View style={styles.categoryMiniDivider} />
            <Text style={styles.categoryGridCount}>
              {category.count} {category.count === 1 ? "SHOP" : "SHOPS"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.categoryGridItem}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.categoryImageWrap}>
          <Image
            source={{ uri: category.image, cache: "force-cache" }}
            style={styles.categoryGridImage}
            resizeMode="cover"
          />
          <View style={styles.categoryBlackFrame} />
        </View>
        <View style={styles.categoryBottomContainer}>
          <View style={styles.categoryTextContainer}>
            <Text style={styles.categoryGridName} numberOfLines={1}>
              {displayName.toUpperCase()}
            </Text>
            <View style={styles.categoryMiniDivider} />
            <Text style={styles.categoryGridCount}>
              {category.count} {category.count === 1 ? "SHOP" : "SHOPS"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);
CategoryGridItem.displayName = "CategoryGridItem";

const CategorySectionHeader = memo(
  ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLine} />
      <Text style={styles.sectionHeaderTitle}>{title.toUpperCase()}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  )
);
CategorySectionHeader.displayName = "CategorySectionHeader";

const CategoryGrid = memo(
  ({
    categories,
    onCategoryPress,
    hasMore,
    onShowMore,
  }: {
    categories: CategoryItem[];
    onCategoryPress: (c: CategoryItem) => void;
    hasMore: boolean;
    onShowMore: () => void;
  }) => {
    const renderItem = useCallback(
      ({ item }: { item: CategoryItem }) => (
        <CategoryGridItem category={item} onPress={onCategoryPress} />
      ),
      [onCategoryPress]
    );
    const keyExtractor = useCallback((item: CategoryItem) => item.name, []);

    if (categories.length === 0) return null;

    return (
      <>
        <CategorySectionHeader title="Browse the Collection" />
        <View style={styles.categoryGridContainer}>
          <FlatList
            data={categories}
            keyExtractor={keyExtractor}
            numColumns={3}
            scrollEnabled={false}
            contentContainerStyle={styles.categoryGridContent}
            removeClippedSubviews={false}
            renderItem={renderItem}
          />
        </View>
        {hasMore && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={onShowMore}
            activeOpacity={0.7}
          >
            <View style={styles.showMoreInner}>
              <Text style={styles.showMoreText}>VIEW ALL CATEGORIES</Text>
              <Ionicons
                name="arrow-forward"
                size={scale(14)}
                color={Palette.pureBlack}
              />
            </View>
          </TouchableOpacity>
        )}
      </>
    );
  }
);
CategoryGrid.displayName = "CategoryGrid";

// ─────────────────────────────────────────────────────────────
// Address Modal
// ─────────────────────────────────────────────────────────────
interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (a: any) => void;
  onAddAddress: () => void;
  selectedAddress: any;
  addresses: any[];
  isLoading: boolean;
  onOpenMap: () => void;
}

const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
  onAddAddress,
  selectedAddress,
  addresses,
  isLoading,
  onOpenMap,
}) => {
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 12;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={addressModalStyles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={addressModalStyles.bottomSheet}>
          <View style={addressModalStyles.bottomSheetContent}>
            <View style={addressModalStyles.bottomSheetHandle} />

            <View style={addressModalStyles.sheetHeader}>
              <View style={addressModalStyles.sheetTitleRow}>
                <Ionicons name="diamond" size={14} color={Palette.pureBlack} />
                <Text style={addressModalStyles.sheetTitle}>SELECT LOCATION</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={Palette.pureBlack} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={addressModalStyles.addressList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <TouchableOpacity
                style={addressModalStyles.currentLocationContainer}
                onPress={onAddAddress}
              >
                <View style={addressModalStyles.currentLocationIcon}>
                  <Ionicons name="locate" size={20} color={Palette.pureBlack} />
                </View>
                <View style={addressModalStyles.addressInfo}>
                  <Text style={addressModalStyles.currentLocationTitle}>
                    Use my current location
                  </Text>
                  <Text style={addressModalStyles.addressString} numberOfLines={1}>
                    {selectedAddress
                      ? selectedAddress.addressString
                      : "Fetch GPS & find nearby boutiques"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.pureBlack} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  addressModalStyles.currentLocationContainer,
                  { borderTopWidth: 0 },
                ]}
                onPress={onOpenMap}
              >
                <View style={addressModalStyles.currentLocationIcon}>
                  <Ionicons name="map" size={20} color={Palette.pureBlack} />
                </View>
                <View style={addressModalStyles.addressInfo}>
                  <Text style={addressModalStyles.currentLocationTitle}>
                    Pick from Map
                  </Text>
                  <Text style={addressModalStyles.addressString} numberOfLines={1}>
                    Search and select a location on map
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Palette.pureBlack} />
              </TouchableOpacity>

              <View style={addressModalStyles.sectionDivider} />

              {addresses.length > 0 && (
                <>
                  <Text style={addressModalStyles.savedAddressesHeader}>
                    SAVED ADDRESSES
                  </Text>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddress?.id === addr.id;
                    let iconName = "location";
                    if (addr.type === "Home") iconName = "home";
                    if (addr.type === "Work") iconName = "briefcase";
                    if (addr.type === "Current Location") iconName = "locate";
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[
                          addressModalStyles.addressItem,
                          isSelected && addressModalStyles.addressItemSelected,
                        ]}
                        onPress={() => onSelectAddress(addr)}
                      >
                        <View style={addressModalStyles.iconContainer}>
                          <Ionicons
                            name={iconName as any}
                            size={20}
                            color={Palette.pureBlack}
                          />
                        </View>
                        <View style={addressModalStyles.addressInfo}>
                          <View style={addressModalStyles.addressTypeRow}>
                            <Text
                              style={[
                                addressModalStyles.addressType,
                                isSelected && { color: Palette.pureBlack },
                              ]}
                            >
                              {addr.type}
                            </Text>
                            {isSelected && (
                              <View style={addressModalStyles.selectedBadge}>
                                <Text
                                  style={addressModalStyles.selectedBadgeText}
                                >
                                  SELECTED
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={addressModalStyles.addressString}
                            numberOfLines={2}
                          >
                            {addr.addressString}
                          </Text>
                          {addr.landmark && (
                            <Text style={addressModalStyles.landmarkText}>
                              ◆ {addr.landmark}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={Palette.pureBlack}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {isLoading && (
                <View style={addressModalStyles.loadingContainer}>
                  <ActivityIndicator size="small" color={Palette.pureBlack} />
                </View>
              )}
            </ScrollView>

            <View
              style={[
                addressModalStyles.addAddressFooter,
                { paddingBottom: footerPaddingBottom },
              ]}
            >
              <TouchableOpacity
                style={addressModalStyles.addAddressButton}
                onPress={onAddAddress}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color={Palette.ivory} />
                <Text style={addressModalStyles.addAddressButtonText}>
                  ADD NEW ADDRESS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const addressModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Palette.overlay,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    maxHeight: height * 0.88,
    backgroundColor: Palette.pureWhite,
    borderTopWidth: 1,
    borderTopColor: Palette.borderLight,
  },
  bottomSheetContent: {
    paddingTop: 12,
    backgroundColor: Palette.pureWhite,
  },
  bottomSheetHandle: {
    width: 42,
    height: 4,
    backgroundColor: Palette.pureBlack,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
    opacity: 0.55,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: Palette.pureBlack,
    letterSpacing: 2,
  },
  addressList: {
    flexGrow: 0,
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Palette.borderLight,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.offWhite,
    borderWidth: 1,
    borderColor: Palette.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Palette.pureBlack,
    marginBottom: 2,
  },
  addressInfo: { flex: 1, paddingRight: 10 },
  addressString: {
    fontSize: 12,
    color: Palette.pureBlack,
    lineHeight: 18,
    opacity: 0.7,
  },
  landmarkText: {
    fontSize: 11,
    color: Palette.pureBlack,
    marginTop: 3,
    fontWeight: "700",
    opacity: 0.7,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Palette.borderLight,
    width: "100%",
  },
  savedAddressesHeader: {
    fontSize: 10,
    fontWeight: "900",
    color: Palette.pureBlack,
    opacity: 0.7,
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },
  addressItemSelected: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  iconContainer: { width: 30, alignItems: "flex-start" },
  addressTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressType: {
    fontSize: 14,
    fontWeight: "800",
    color: Palette.pureBlack,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Palette.pureBlack,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Palette.pureWhite,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  addAddressFooter: {
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Palette.borderLight,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.pureBlack,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Palette.pureWhite,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginLeft: 8,
  },
  loadingContainer: { padding: 20, alignItems: "center" },
});

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
          return parsed.map((i) => String(i).trim()).filter(Boolean);
      } catch (_) {}
    }
    return field.map((i) => String(i).trim()).filter(Boolean);
  }
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed))
        return parsed.map((i) => String(i).trim()).filter(Boolean);
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      if (field.includes(","))
        return field.split(",").map((s) => s.trim()).filter(Boolean);
      return [field.trim()].filter(Boolean);
    }
  }
  return [];
};

// ─────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────
const ShopListings = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const targetVendorId = route.params?.vendorId;
  const insets = useSafeAreaInsets();

  const { location: userLocation, selectedAddress, loading: isLocationLoading } =
    useSelector((state: RootState) => state.location);
  const addresses = useSelector(selectAllAddresses);

  const directoryVendors = useSelector(
    (state: RootState) => state.vendorAuth.directoryVendors,
    shallowEqual
  );
  const allProducts = useSelector(
    (state: RootState) => state.vendorProducts.allProducts,
    shallowEqual
  );
  const token = useSelector((state: RootState) => state.auth.user?.token);
  const categories = useSelector(
    (state: RootState) => state.categories?.categories || [],
    shallowEqual
  );
  const categoriesLoading = useSelector(
    (state: RootState) => state.categories?.loading || false
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [manualRadius, setManualRadius] = useState(DEFAULT_RADIUS_KM);
  const [appliedRadius, setAppliedRadius] = useState(DEFAULT_RADIUS_KM);
  const [radiusExpanded, setRadiusExpanded] = useState(false);
  const [isRadiusSwitching, setIsRadiusSwitching] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const savedScrollOffset = useRef(0);

  const fetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchTime = useRef(0);
  const isNavigatingAway = useRef(false);
  const hasFocusedOnce = useRef(false);
  const hasLocationEffectRun = useRef(false);

  const appliedRadiusRef = useRef(appliedRadius);
  const allProductsRef = useRef(allProducts);
  const categoriesRef = useRef(categories);
  const categoriesLoadingRef = useRef(categoriesLoading);
  const fetchDirectoryVendorsRef = useRef<(opts?: any) => void>(() => {});
  const getCurrentLocationRef = useRef<() => { lat?: number; lng?: number }>(
    () => ({})
  );

  useEffect(() => {
    appliedRadiusRef.current = appliedRadius;
  }, [appliedRadius]);
  useEffect(() => {
    allProductsRef.current = allProducts;
  }, [allProducts]);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  useEffect(() => {
    categoriesLoadingRef.current = categoriesLoading;
  }, [categoriesLoading]);

  const hasLocation = !!(selectedAddress?.latitude || userLocation?.latitude);

  // ── Scroll to top helper ──
  const scrollListToTop = useCallback(() => {
    if (flatListRef.current && savedScrollOffset.current > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      savedScrollOffset.current = 0;
      return true;
    }
    return false;
  }, []);

  // ── Hardware back: first scroll to top, then navigate back ──
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      // 1. Close modals first
      if (showAddAddressModal) {
        setShowAddAddressModal(false);
        return true;
      }
      if (showAddressModal) {
        setShowAddressModal(false);
        return true;
      }
      // 2. If scrolled down, first scroll to top
      if (savedScrollOffset.current > SCROLL_TOP_THRESHOLD) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        savedScrollOffset.current = 0;
        return true; // consume — don't navigate yet
      }
      // 3. Otherwise allow default back navigation
      return false;
    });
    return () => sub.remove();
  }, [showAddAddressModal, showAddressModal]);

  useEffect(() => {
    if (categories.length === 0 && !categoriesLoading) dispatch(fetchCategories());
  }, [dispatch, categories.length, categoriesLoading]);

  const getCurrentLocation = useCallback(() => {
    let lat = userLocation?.latitude;
    let lng = userLocation?.longitude;
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      lat = selectedAddress.latitude;
      lng = selectedAddress.longitude;
    }
    return { lat, lng };
  }, [userLocation, selectedAddress]);

  useEffect(() => {
    getCurrentLocationRef.current = getCurrentLocation;
  }, [getCurrentLocation]);

  const fetchDirectoryVendors = useCallback(
    async (options?: {
      force?: boolean;
      category?: string;
      radius?: number;
      expanded?: boolean;
      latOverride?: number;
      lngOverride?: number;
    }) => {
      const { lat: stateLat, lng: stateLng } = getCurrentLocation();
      const lat = options?.latOverride ?? stateLat;
      const lng = options?.lngOverride ?? stateLng;

      if (!lat || !lng) {
        setHasLoadedOnce(true);
        return;
      }

      const radiusToUse =
        options?.radius !== undefined ? options.radius : appliedRadiusRef.current;

      try {
        const params: any = { lat, lng };
        if (options?.category) params.category = options.category;
        if (radiusToUse) params.radius = radiusToUse;

        await dispatch(searchDirectoryVendors(params)).unwrap();

        if (radiusToUse !== appliedRadiusRef.current) {
          setAppliedRadius(radiusToUse);
          appliedRadiusRef.current = radiusToUse;
        }
        setRadiusExpanded(options?.expanded ?? radiusToUse > 10);

        if (!allProductsRef.current || allProductsRef.current.length === 0) {
          await dispatch(fetchAllVendorProducts());
        }
        if (
          categoriesRef.current.length === 0 &&
          !categoriesLoadingRef.current
        ) {
          await dispatch(fetchCategories());
        }
        lastFetchTime.current = Date.now();
      } catch (error) {
        dwarn("fetchDirectoryVendors error:", error);
      } finally {
        setHasLoadedOnce(true);
      }
    },
    [dispatch, getCurrentLocation]
  );

  useEffect(() => {
    fetchDirectoryVendorsRef.current = fetchDirectoryVendors;
  }, [fetchDirectoryVendors]);

  const handleRadiusChange = useCallback(
    async (val: number, lat: number, lng: number) => {
      setIsRadiusSwitching(true);
      try {
        await fetchDirectoryVendors({
          radius: val,
          expanded: val > 10,
          latOverride: lat,
          lngOverride: lng,
          force: true,
        });
      } finally {
        setIsRadiusSwitching(false);
      }
    },
    [fetchDirectoryVendors]
  );

  const debouncedFetch = useCallback(() => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    fetchTimeout.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastFetchTime.current > FETCH_STALE_MS) {
        fetchDirectoryVendorsRef.current({
          radius: appliedRadiusRef.current,
        });
      }
      fetchTimeout.current = null;
    }, 300);
  }, []);

  const handleAddCurrentLocation = useCallback(async () => {
    if (!token) {
      Toast.show({
        type: "error",
        text1: "Authentication Required",
        text2: "Please login to save address",
      });
      return;
    }
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Location permission required.",
        });
        setIsLocating(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const { city, region, district, postalCode, street, name } = geocode[0];
        const detectedCity = city || district || region || "";
        const detectedLocality = street || name || district || "";
        const detectedState = region || "";
        const detectedPincode = postalCode || "";
        const addressString = [
          detectedLocality,
          detectedCity,
          detectedState,
          detectedPincode,
        ]
          .filter(Boolean)
          .join(", ");
        const addressData = {
          type: "Current Location" as const,
          addressString: addressString || "Current Location",
          landmark: "",
          city: detectedCity,
          pincode: detectedPincode,
          latitude,
          longitude,
          isDefault: addresses.length === 0,
          state: detectedState,
          locality: detectedLocality,
        };
        dispatch(saveUserAddress({ token, addressData }))
          .unwrap()
          .then((savedAddress: any) => {
            dispatch(setSelectedAddress(savedAddress));
            setShowAddressModal(false);
            Toast.show({
              type: "success",
              text1: "Location Detected",
              text2: `📍 ${detectedLocality}, ${detectedCity}`,
            });
            fetchDirectoryVendorsRef.current({
              radius: appliedRadiusRef.current,
              latOverride: latitude,
              lngOverride: longitude,
              force: true,
            });
          })
          .catch(() => {
            Toast.show({
              type: "error",
              text1: "Error",
              text2: "Failed to save location",
            });
          });
      }
    } catch {
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: "Could not detect location.",
      });
    } finally {
      setIsLocating(false);
    }
  }, [dispatch, token, addresses.length]);

  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddressModal(true);
  }, []);

  const handleOpenAddressModal = useCallback(() => {
    if (token) dispatch(fetchUserAddresses(token));
    setShowAddressModal(true);
  }, [dispatch, token]);

  const handleCloseAddressModal = useCallback(() => setShowAddressModal(false), []);

  const handleSelectAddress = useCallback(
    (address: any) => {
      const isSame =
        selectedAddress?.id === address?.id ||
        selectedAddress?.addressString === address?.addressString;
      dispatch(setSelectedAddress(address));
      setShowAddressModal(false);
      if (isSame) return;
      const lat = address?.latitude;
      const lng = address?.longitude;
      if (lat && lng) {
        fetchDirectoryVendorsRef.current({
          radius: appliedRadiusRef.current,
          latOverride: lat,
          lngOverride: lng,
          force: true,
        });
      }
    },
    [dispatch, selectedAddress]
  );

  const handleLocationFromAddAddress = useCallback(
    (lat: number, lng: number, addressDetails: any) => {
      const cityVal = addressDetails.city || addressDetails.district || "";
      const localityVal =
        addressDetails.colony ||
        addressDetails.suburb ||
        addressDetails.neighbourhood ||
        addressDetails.street ||
        addressDetails.district ||
        "";
      const stateVal = addressDetails.state || "";
      const pincodeVal = addressDetails.pincode || "";
      const country = addressDetails.country || "India";
      const street = addressDetails.street || "";
      const fullAddress =
        addressDetails.addressString || addressDetails.fullAddress || "";
      const addressParts = [
        street,
        addressDetails.colony,
        addressDetails.suburb,
        addressDetails.neighbourhood,
        localityVal,
        cityVal,
        addressDetails.district,
        stateVal,
        pincodeVal,
        country,
      ].filter(Boolean);
      const displayAddress = addressParts.join(", ") || fullAddress;

      const addressData = {
        type: "Home" as const,
        addressString: displayAddress || "Selected location",
        landmark: "",
        city: cityVal || "",
        pincode: pincodeVal || "",
        latitude: lat,
        longitude: lng,
        isDefault: addresses.length === 0,
        state: stateVal || "",
        locality: localityVal || "",
      };

      if (token) {
        dispatch(saveUserAddress({ token, addressData }))
          .unwrap()
          .then((savedAddress: any) => {
            dispatch(setSelectedAddress(savedAddress));
            setShowAddAddressModal(false);
            Toast.show({
              type: "success",
              text1: "Location Saved",
              text2: `📍 ${displayAddress}`,
            });
            fetchDirectoryVendorsRef.current({
              radius: appliedRadiusRef.current,
              latOverride: lat,
              lngOverride: lng,
              force: true,
            });
          })
          .catch(() => {
            Toast.show({
              type: "error",
              text1: "Error",
              text2: "Failed to save location",
            });
          });
      } else {
        dispatch(setSelectedAddress(addressData));
        setShowAddAddressModal(false);
        Toast.show({
          type: "info",
          text1: "Location Updated",
          text2: displayAddress,
        });
        fetchDirectoryVendorsRef.current({
          radius: appliedRadiusRef.current,
          latOverride: lat,
          lngOverride: lng,
          force: true,
        });
      }
    },
    [dispatch, token, addresses.length]
  );

  const handleCloseAddAddress = useCallback(
    () => setShowAddAddressModal(false),
    []
  );

  useEffect(() => {
    if (isLocationLoading) return;
    if (hasLocation) return;
    if (showAddAddressModal) return;
    if (showAddressModal) return;
    if (isNavigatingAway.current) return;
    setShowAddAddressModal(true);
  }, [hasLocation, isLocationLoading, showAddAddressModal, showAddressModal]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
    try {
      const { lat, lng } = getCurrentLocationRef.current();
      await Promise.all([
        fetchDirectoryVendorsRef.current({
          radius: appliedRadiusRef.current,
          latOverride: lat,
          lngOverride: lng,
          force: true,
        }),
        dispatch(fetchAllVendorProducts()),
        dispatch(fetchCategories()),
      ]);
    } catch {
      Alert.alert("Refresh Failed", "Could not refresh data.");
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    const load = async () => {
      const { lat, lng } = getCurrentLocationRef.current();
      if (lat && lng) {
        await fetchDirectoryVendorsRef.current({ radius: DEFAULT_RADIUS_KM });
      } else {
        setHasLoadedOnce(true);
      }
      if (!allProductsRef.current || allProductsRef.current.length === 0) {
        await dispatch(fetchAllVendorProducts());
      }
      if (token) dispatch(fetchUserAddresses(token));
      if (
        categoriesRef.current.length === 0 &&
        !categoriesLoadingRef.current
      ) {
        await dispatch(fetchCategories());
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasLocationEffectRun.current) {
      hasLocationEffectRun.current = true;
      return;
    }
    const lat = selectedAddress?.latitude || userLocation?.latitude;
    const lng = selectedAddress?.longitude || userLocation?.longitude;
    if (lat && lng) debouncedFetch();
  }, [
    userLocation?.latitude,
    userLocation?.longitude,
    selectedAddress?.latitude,
    selectedAddress?.longitude,
    debouncedFetch,
  ]);

  useFocusEffect(
    useCallback(() => {
      const isFirstFocus = !hasFocusedOnce.current;
      hasFocusedOnce.current = true;

      if (isNavigatingAway.current) {
        isNavigatingAway.current = false;
        const { lat, lng } = getCurrentLocationRef.current();
        if (lat && lng) {
          fetchDirectoryVendorsRef.current({
            radius: appliedRadiusRef.current,
            latOverride: lat,
            lngOverride: lng,
          });
        }
      }

      if (!isFirstFocus) {
        const now = Date.now();
        if (now - lastFetchTime.current > FETCH_STALE_MS && hasLocation) {
          fetchDirectoryVendorsRef.current({
            radius: appliedRadiusRef.current,
          });
        }
      }

      if (
        categoriesRef.current.length === 0 &&
        !categoriesLoadingRef.current
      ) {
        dispatch(fetchCategories());
      }

      return () => {
        isNavigatingAway.current = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, hasLocation])
  );

  useEffect(() => {
    return () => {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    };
  }, []);

  const { displayCategories, hasMoreCategories } = useMemo(() => {
    if (!categories || categories.length === 0)
      return { displayCategories: [], hasMoreCategories: false };

    const shopCountMap = new Map<string, number>();
    const categoryNameMap = new Map<string, string>();

    (directoryVendors || []).forEach((vendor) => {
      if (!vendor) return;
      const vendorCategories = parseArrayField(vendor.categories);
      vendorCategories.forEach((cat: string) => {
        if (!cat) return;
        const normalized = cat.toLowerCase();
        shopCountMap.set(normalized, (shopCountMap.get(normalized) || 0) + 1);
        if (!categoryNameMap.has(normalized))
          categoryNameMap.set(normalized, cat);
      });
    });

    const fullList = categories
      .map((category) => {
        const categoryName =
          typeof category.name === "string"
            ? category.name
            : String(category.name || "");
        const normalized = categoryName.toLowerCase();
        return {
          name: categoryNameMap.get(normalized) || categoryName,
          count: shopCountMap.get(normalized) || 0,
          image: category.image || category.icon,
          _id: category._id,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });

    return {
      displayCategories: fullList.slice(0, CATEGORY_DISPLAY_LIMIT),
      hasMoreCategories: fullList.length > CATEGORY_DISPLAY_LIMIT,
    };
  }, [categories, directoryVendors]);

  const productsByVendorId = useMemo(() => {
    const map = new Map<string, any[]>();
    (allProducts || []).forEach((p) => {
      if (!p || !p.vendorId) return;
      const arr = map.get(p.vendorId);
      if (arr) arr.push(p);
      else map.set(p.vendorId, [p]);
    });
    return map;
  }, [allProducts]);

  const userLat = selectedAddress?.latitude || userLocation?.latitude;
  const userLng = selectedAddress?.longitude || userLocation?.longitude;

  const vendorsWithDetails = useMemo(() => {
    const vendors = (directoryVendors || []).filter((v) => v && v._id);

    const result = vendors.map((vendor) => {
      const vendorProducts = productsByVendorId.get(vendor._id) || [];
      const productImages = vendorProducts
        .map((p) => p.images && p.images[0])
        .filter(Boolean);
      const vendorCategories = parseArrayField(vendor.categories);

      let distance = vendor.distance;
      let isInRange = true;
      if (
        userLat &&
        userLng &&
        vendor.address?.latitude &&
        vendor.address?.longitude
      ) {
        distance = calculateDistance(
          userLat,
          userLng,
          vendor.address.latitude,
          vendor.address.longitude
        );
        const deliveryRange = vendor.deliveryRange || 10;
        isInRange = distance <= deliveryRange;
      }
      if (!vendor.deliveryRange || vendor.deliveryRange === 0) isInRange = true;

      return {
        ...vendor,
        categories: vendorCategories,
        shopImage:
          vendor.shopImage || vendor.profileImage || vendor.coverImage,
        productsCount: vendorProducts.length,
        productImages,
        distance,
        isInRange,
      };
    });

    const withinRadius = result.filter((v) => {
      const d = typeof v.distance === "number" ? v.distance : Number(v.distance);
      if (!Number.isFinite(d)) return true;
      return d <= appliedRadius;
    });

    return withinRadius.sort((a, b) => {
      if (a.isInRange && b.isInRange)
        return (a.distance || Infinity) - (b.distance || Infinity);
      if (a.isInRange && !b.isInRange) return -1;
      if (!a.isInRange && b.isInRange) return 1;
      return (a.distance || Infinity) - (b.distance || Infinity);
    });
  }, [directoryVendors, productsByVendorId, userLat, userLng, appliedRadius]);

  const handleCardPress = useCallback(
    (shop: any) => {
      navigation.navigate("ShopDetails", { vendor: shop });
    },
    [navigation]
  );

  const handleCategoryPress = useCallback(
    (category: CategoryItem) => {
      if (!category?.name) return;
      navigation.navigate("CategoryShopsScreen", {
        categoryName: category.name,
        categoryImage: category.image,
        radius: appliedRadiusRef.current,
      });
    },
    [navigation]
  );

  const handleShowMoreCategories = useCallback(() => {
    navigation.navigate("AllCategoriesScreen");
  }, [navigation]);

  const handleOpenAllCategories = useCallback(() => {
    navigation.navigate("AllCategoriesScreen");
  }, [navigation]);

  const handleQuickNavPress = useCallback(
    (item: QuickNavItem) => {
      if (item.routeName === "Order") {
        try {
          navigation.navigate(item.routeName);
          return;
        } catch (e) {
          // fall through
        }
      }

      let parent: any = navigation.getParent?.();
      let found = false;
      let depth = 0;
      while (parent && depth < 6) {
        const state = parent.getState?.();
        const routeNames: string[] =
          state?.routeNames ||
          state?.routes?.map((r: any) => r.name) ||
          [];
        if (routeNames.includes(item.routeName)) {
          parent.navigate(item.routeName);
          found = true;
          break;
        }
        parent = parent.getParent?.();
        depth += 1;
      }

      if (!found) {
        try {
          navigationRef.current?.navigate(item.routeName as any);
        } catch (e) {
          console.warn(
            `[ShopListings] Could not navigate to "${item.routeName}" from any navigator`
          );
        }
      }
    },
    [navigation]
  );

  const isLoading =
    (!hasLoadedOnce &&
      !isRefreshing &&
      (!directoryVendors || directoryVendors.length === 0)) ||
    isLocationLoading ||
    isLocating;

  const shopCount = vendorsWithDetails.length;

  const renderShopItem = useCallback(
    ({ item }: { item: any }) => (
      <ShopCard shop={item} onPress={handleCardPress} />
    ),
    [handleCardPress]
  );

  const keyExtractor = useCallback((item: any) => String(item._id), []);

  const listHeader = useMemo(() => {
    if (targetVendorId) return null;
    return (
      <CategoryGrid
        categories={displayCategories}
        onCategoryPress={handleCategoryPress}
        hasMore={hasMoreCategories}
        onShowMore={handleShowMoreCategories}
      />
    );
  }, [
    targetVendorId,
    displayCategories,
    hasMoreCategories,
    handleCategoryPress,
    handleShowMoreCategories,
  ]);

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="diamond-outline" size={scale(28)} color={Palette.pureBlack} />
        </View>
        <Text style={styles.emptyTitle}>
          No shops within {appliedRadius} km
        </Text>
        <View style={styles.emptyDivider} />
        <Text style={styles.emptySubText}>
          Expand your search radius or change your location to discover more
          exclusive boutiques.
        </Text>
        <TouchableOpacity
          onPress={handleOpenAddressModal}
          style={styles.retryButton}
          activeOpacity={0.85}
        >
          <Text style={styles.retryButtonText}>CHANGE LOCATION</Text>
        </TouchableOpacity>
      </View>
    ),
    [appliedRadius, handleOpenAddressModal]
  );

  // ── Header content (now part of the scrollable list) ──
  const renderTopHeader = useCallback(() => {
    return (
      <View
        style={[
          styles.headerScrollContent,
          { paddingTop: insets.top + 8 },
        ]}
      >
        {/* 1. Location bar */}
        <TouchableOpacity
          style={styles.glassPill}
          onPress={handleOpenAddressModal}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={scale(18)} color={Palette.pureBlack} />
          <Text style={styles.locationBarText} numberOfLines={1}>
            {selectedAddress?.addressString ||
              (userLocation ? "Using GPS location" : "Select a location")}
          </Text>
          <Ionicons name="chevron-down" size={scale(16)} color={Palette.pureBlack} />
        </TouchableOpacity>

        {/* 2. Search bar */}
        {!targetVendorId && (
          <TouchableOpacity
            style={[styles.glassPill, styles.searchBarExtraMargin]}
            onPress={handleOpenAllCategories}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={scale(18)} color={Palette.pureBlack} />
            <Text style={styles.searchBarPlaceholder}>
              Search the royal collection...
            </Text>
            <Ionicons
              name="chevron-forward"
              size={scale(16)}
              color={Palette.pureBlack}
            />
          </TouchableOpacity>
        )}

        {/* 3. Radius label row */}
        <View style={styles.radiusInfoRow}>
          <Ionicons name="radio-outline" size={16} color={Palette.pureBlack} />
          <Text style={styles.radiusLabel}>Within {manualRadius} km</Text>
          {shopCount > 0 && (
            <Text style={styles.shopCountText}>
              {shopCount} {shopCount === 1 ? "boutique" : "boutiques"}
            </Text>
          )}
        </View>

        {/* 4. Km preset chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScrollContent}
          style={styles.presetScrollView}
        >
          {RADIUS_PRESETS.map((val) => {
            const isActive = manualRadius === val;
            const isChipLoading = isRadiusSwitching && isActive;
            return (
              <TouchableOpacity
                key={val}
                style={[
                  styles.presetChipWrapper,
                  isActive && styles.presetChipWrapperActive,
                ]}
                disabled={isRadiusSwitching}
                onPress={() => {
                  if (manualRadius === val) return;
                  setManualRadius(val);
                  const { lat, lng } = getCurrentLocationRef.current();
                  if (lat && lng) {
                    handleRadiusChange(val, lat, lng);
                  } else {
                    Toast.show({
                      type: "info",
                      text1: "Location Required",
                      text2: "Please select an address first.",
                    });
                    setShowAddAddressModal(true);
                  }
                }}
              >
                {isActive ? (
                  <View style={styles.presetChipActive}>
                    {isChipLoading ? (
                      <ActivityIndicator size="small" color={Palette.pureWhite} />
                    ) : (
                      <Text style={styles.presetChipTextActive}>{val} km</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.presetChipGlass}>
                    <Text style={styles.presetChipText}>{val} km</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. Quick nav row */}
        {!targetVendorId && <QuickNavRow onPress={handleQuickNavPress} />}
      </View>
    );
  }, [
    insets.top,
    selectedAddress,
    userLocation,
    targetVendorId,
    manualRadius,
    isRadiusSwitching,
    shopCount,
    handleOpenAddressModal,
    handleOpenAllCategories,
    handleRadiusChange,
    handleQuickNavPress,
  ]);

  const renderContent = () => {
    if (!hasLocation && !targetVendorId) {
      return (
        <View style={styles.messageContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location" size={scale(28)} color={Palette.pureBlack} />
          </View>
          <Text style={styles.messageTitle}>CHOOSE YOUR DESTINATION</Text>
          <View style={styles.emptyDivider} />
          <Text style={styles.messageText}>
            Select an address to discover royal boutiques near you.
          </Text>
          <TouchableOpacity
            onPress={() => setShowAddAddressModal(true)}
            style={styles.retryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>SELECT ADDRESS</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Palette.pureBlack} />
          <Text style={styles.loadingText}>Curating boutiques near you…</Text>
          <View style={styles.loadingDivider} />
        </View>
      );
    }

    return (
      <>
        {isRadiusSwitching && (
          <View style={styles.inlineLoadingBanner}>
            <ActivityIndicator size="small" color={Palette.pureBlack} />
            <Text style={styles.inlineLoadingText}>
              Refining results to {manualRadius} km…
            </Text>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={vendorsWithDetails}
          keyExtractor={keyExtractor}
          renderItem={renderShopItem}
          contentContainerStyle={styles.flatlistContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Palette.pureBlack}
              colors={[Palette.pureBlack]}
            />
          }
          onScroll={(e) => {
            savedScrollOffset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {renderTopHeader()}
              {listHeader}
            </>
          }
          ListEmptyComponent={listEmpty}
        />
      </>
    );
  };

  return (
    <View style={styles.container}>
      {renderContent()}

      {showAddressModal && (
        <AddressModal
          visible={showAddressModal}
          onClose={handleCloseAddressModal}
          onSelectAddress={handleSelectAddress}
          onAddAddress={handleAddCurrentLocation}
          selectedAddress={selectedAddress}
          addresses={addresses}
          isLoading={isLocating || isLocationLoading}
          onOpenMap={handleOpenMapPicker}
        />
      )}

      {showAddAddressModal && (
        <Modal
          visible={showAddAddressModal}
          animationType="slide"
          transparent={false}
          onRequestClose={handleCloseAddAddress}
          statusBarTranslucent
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: Palette.ivory }}
            edges={["top", "bottom", "left", "right"]}
          >
            <AddAddressScreen
              onClose={handleCloseAddAddress}
              onLocationSelect={handleLocationFromAddAddress}
            />
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.offWhite },

  // Header content is now inside the scroll view (no absolute positioning)
  headerScrollContent: {
    backgroundColor: Palette.pureWhite,
    paddingBottom: verticalScale(6),
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },

  glassPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    marginHorizontal: scale(16),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: Palette.borderLight,
    backgroundColor: Palette.offWhite,
    marginTop: verticalScale(4),
    shadowColor: Palette.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBarExtraMargin: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  locationBarText: {
    flex: 1,
    color: Palette.pureBlack,
    fontSize: moderateScale(13),
    marginLeft: scale(8),
    marginRight: scale(8),
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  searchBarPlaceholder: {
    flex: 1,
    marginLeft: scale(10),
    fontSize: moderateScale(14),
    color: Palette.pureBlack,
    opacity: 0.55,
    fontWeight: "500",
  },

  radiusInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: scale(16),
    marginVertical: verticalScale(4),
    paddingVertical: verticalScale(4),
  },
  radiusLabel: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: Palette.pureBlack,
    marginLeft: scale(6),
    marginRight: scale(6),
    flex: 1,
    letterSpacing: 0.5,
  },
  shopCountText: {
    fontSize: moderateScale(11),
    fontWeight: "900",
    color: Palette.pureBlack,
    letterSpacing: 1.2,
  },

  presetScrollView: {
    flexGrow: 0,
    marginBottom: verticalScale(6),
    marginTop: verticalScale(2),
  },
  presetScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    columnGap: scale(8),
  },
  presetChipWrapper: {
    borderRadius: moderateScale(18),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Palette.chipBorder,
    backgroundColor: Palette.chipBg,
  },
  presetChipWrapperActive: {
    borderColor: Palette.pureBlack,
    backgroundColor: Palette.chipActiveBg,
  },
  presetChipGlass: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    minWidth: scale(56),
    alignItems: "center",
    justifyContent: "center",
  },
  presetChipActive: {
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(14),
    minWidth: scale(56),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.chipActiveBg,
  },
  presetChipText: {
    fontSize: moderateScale(11),
    color: Palette.pureBlack,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  presetChipTextActive: {
    color: Palette.chipActiveText,
    fontWeight: "900",
    fontSize: moderateScale(11),
    letterSpacing: 0.6,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    marginTop: verticalScale(6),
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Palette.sectionLine,
  },
  sectionHeaderTitle: {
    fontSize: moderateScale(12),
    fontWeight: "900",
    color: Palette.pureBlack,
    letterSpacing: 2.5,
    marginHorizontal: scale(12),
  },

  categoryGridContainer: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  categoryGridContent: { paddingBottom: verticalScale(4) },
  categoryGridItem: {
    flex: 1,
    aspectRatio: 0.9,
    margin: scale(4),
    borderRadius: moderateScale(14),
    overflow: "hidden",
    backgroundColor: Palette.pureWhite,
    borderWidth: 1,
    borderColor: Palette.borderLight,
    shadowColor: Palette.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryImageWrap: {
    width: "100%",
    height: "62%",
    position: "relative",
    backgroundColor: Palette.offWhite,
  },
  categoryGridImage: {
    width: "100%",
    height: "100%",
  },
  categoryBlackFrame: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
  },
  categoryWhiteFrame: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: Palette.borderLight,
  },
  categoryBottomContainer: {
    flex: 1,
    backgroundColor: Palette.pureWhite,
  },
  categoryTextContainer: {
    flex: 1,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(6),
    alignItems: "center",
    justifyContent: "center",
  },
  categoryMiniDivider: {
    width: scale(20),
    height: 1.5,
    backgroundColor: Palette.pureBlack,
    marginVertical: verticalScale(3),
    opacity: 0.55,
  },
  categoryGridName: {
    fontSize: moderateScale(10.5),
    fontWeight: "900",
    color: Palette.pureBlack,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  categoryGridCount: {
    fontSize: moderateScale(9),
    color: Palette.pureBlack,
    opacity: 0.6,
    textAlign: "center",
    letterSpacing: 1,
    fontWeight: "800",
  },

  showMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(14),
    marginHorizontal: scale(16),
    marginTop: verticalScale(6),
  },
  showMoreInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(20),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Palette.borderLight,
    backgroundColor: Palette.offWhite,
  },
  showMoreText: {
    fontSize: moderateScale(11),
    color: Palette.pureBlack,
    fontWeight: "900",
    letterSpacing: 2,
    marginRight: scale(6),
  },

  flatlistContainer: {
    paddingBottom: verticalScale(40),
  },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: verticalScale(14),
    fontSize: moderateScale(13),
    color: Palette.pureBlack,
    fontWeight: "700",
    letterSpacing: 1,
  },
  loadingDivider: {
    width: scale(48),
    height: 1.5,
    backgroundColor: Palette.pureBlack,
    marginTop: verticalScale(12),
    opacity: 0.4,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scale(24),
  },
  emptyIconCircle: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Palette.borderLight,
    marginBottom: verticalScale(18),
    backgroundColor: Palette.offWhite,
  },
  messageTitle: {
    fontSize: moderateScale(15),
    fontWeight: "900",
    marginBottom: verticalScale(10),
    color: Palette.pureBlack,
    letterSpacing: 2.5,
    textAlign: "center",
  },
  messageText: {
    fontSize: moderateScale(13),
    color: Palette.pureBlack,
    textAlign: "center",
    marginBottom: verticalScale(20),
    opacity: 0.65,
    lineHeight: moderateScale(20),
    paddingHorizontal: scale(20),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: verticalScale(50),
    paddingHorizontal: scale(20),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    color: Palette.pureBlack,
    textAlign: "center",
    marginTop: verticalScale(4),
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  emptyDivider: {
    width: scale(36),
    height: 1.5,
    backgroundColor: Palette.pureBlack,
    marginVertical: verticalScale(10),
    opacity: 0.55,
  },
  emptySubText: {
    fontSize: moderateScale(12),
    color: Palette.pureBlack,
    textAlign: "center",
    marginTop: verticalScale(4),
    opacity: 0.6,
    paddingHorizontal: scale(16),
    lineHeight: moderateScale(18),
  },
  retryButton: {
    marginTop: verticalScale(22),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(24),
    backgroundColor: Palette.pureBlack,
    borderWidth: 1,
    borderColor: Palette.pureBlack,
  },
  retryButtonText: {
    color: Palette.pureWhite,
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: moderateScale(11),
  },
  inlineLoadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(8),
    backgroundColor: Palette.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },
  inlineLoadingText: {
    marginLeft: scale(8),
    fontSize: moderateScale(11),
    color: Palette.pureBlack,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});

// ─────────────────────────────────────────────────────────────
// Quick nav styles
// ─────────────────────────────────────────────────────────────
const quickNavStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(6),
    columnGap: scale(8),
  },
  card: {
    flex: 1,
    borderRadius: moderateScale(14),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Palette.borderLight,
    backgroundColor: Palette.pureWhite,
    shadowColor: Palette.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: verticalScale(120),
  },
  imageBlock: {
    width: "100%",
    height: verticalScale(78),
    backgroundColor: Palette.offWhite,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  iconFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.offWhite,
  },
  textBlock: {
    flex: 1,
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(6),
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: moderateScale(10.5),
    fontWeight: "900",
    color: Palette.pureBlack,
    letterSpacing: 1.3,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: moderateScale(8.5),
    color: Palette.pureBlack,
    opacity: 0.55,
    fontWeight: "600",
    textAlign: "center",
    marginTop: verticalScale(1),
    letterSpacing: 0.3,
  },
});

export default ShopListings;