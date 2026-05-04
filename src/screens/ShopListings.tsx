import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  TextInput,
  RefreshControl,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchNearbyVendors } from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import { Vendor } from "../types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";

const { width } = Dimensions.get("window");

// --- Colors updated for the Premium Dark Background UI ---
const Colors = {
  backgroundDark: "#0c2808", // The deep dark background outside the card
  cardWhite: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#1B8C40", // The rating pill green
  accentPurple: "#0d3313", // The offer badge purple
  accentBlue: "#2563EB", // Verified checkmark blue
  dividerGray: "#F3F4F6",
};

// --- Beautiful Swiggy/Zomato Style Shop Card ---
const ShopCard: React.FC<{
  shop: Vendor & {
    distance?: number;
    productsCount: number;
    productImages: string[];
    canInvite?: boolean;
  };
  onPress: () => void;
}> = ({ shop, onPress }) => {
  return (
    <TouchableOpacity
      style={shopCardStyles.cardContainer}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* 1. Top Badges Row ("Best in Pizza" & "Swiggy Seal") */}
      <View style={shopCardStyles.topBadgeRow}>
        <View style={shopCardStyles.badgeLeft}>
          <Text style={shopCardStyles.badgeIcon}>🏆</Text>
          <Text style={shopCardStyles.badgeText}>
            {shop.businessType || "Best Seller"}
          </Text>
        </View>
        {shop.isApproved && (
          <View style={shopCardStyles.badgeRight}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={Colors.accentBlue}
            />
            <Text style={shopCardStyles.verifiedText}>Verified Partner</Text>
          </View>
        )}
      </View>

      {/* 2. Main Title & Rating Pill Row */}
      <View style={shopCardStyles.titleRow}>
        <Text style={shopCardStyles.shopName} numberOfLines={1}>
          {shop.shopName}
        </Text>
        <View style={shopCardStyles.ratingContainer}>
          <View style={shopCardStyles.ratingPill}>
            <Text style={shopCardStyles.ratingNumber}>4.5</Text>
            <Ionicons
              name="star"
              size={10}
              color="#FFF"
              style={{ marginLeft: 2 }}
            />
          </View>
          <Text style={shopCardStyles.ratingCount}>1K+ ratings</Text>
        </View>
      </View>

      {/* 3. Subtitle Row (Distance & Location) */}
      <View style={shopCardStyles.subtitleRow}>
        <Text style={shopCardStyles.subtitleText}>
          {shop.distance !== undefined && shop.distance !== null
            ? `${shop.distance.toFixed(1)} km`
            : "Nearby"}
          <Text style={shopCardStyles.dotSeparator}> • </Text>
          {shop.address?.formattedAddress || "Local Area"}
        </Text>
      </View>

      {/* 4. Contact Row (Seamlessly injecting your data) */}
      {(shop.phone || shop.email) && (
        <View style={shopCardStyles.contactRow}>
          {shop.phone && (
            <Text style={shopCardStyles.contactText}>📞 {shop.phone}</Text>
          )}
          {shop.phone && shop.email && (
            <Text style={shopCardStyles.dotSeparator}> • </Text>
          )}
          {shop.email && (
            <Text style={shopCardStyles.contactText}>✉️ {shop.email}</Text>
          )}
        </View>
      )}

      {/* Divider Line */}
      <View style={shopCardStyles.divider} />

      {/* 5. Bottom Offer/Products Row */}
      <View style={shopCardStyles.bottomRow}>
        <View style={shopCardStyles.bottomLeft}>
          <View style={shopCardStyles.offerIconBadge}>
            <Ionicons name="flash" size={18} color="#FFF" />
          </View>
          <View>
            <Text style={shopCardStyles.offerTitle}>
              {shop.productsCount > 0
                ? `${shop.productsCount} Products`
                : "Explore Shop"}
            </Text>
            <Text style={shopCardStyles.offerSubtitle}>
              AVAILABLE NOW | VIEW ALL
            </Text>
          </View>
        </View>

        {/* Product Image Previews elegantly stacked on the right */}
        <View style={shopCardStyles.productImagesContainer}>
          {shop.productImages && shop.productImages.length > 0 ? (
            shop.productImages
              .slice(0, 3)
              .map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: img }}
                  style={[
                    shopCardStyles.miniProductImg,
                    { marginLeft: idx > 0 ? -12 : 0, zIndex: 3 - idx },
                  ]}
                />
              ))
          ) : (
            <Ionicons
              name="arrow-forward-circle"
              size={28}
              color={Colors.accentGreen}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// --- Main Component ---
const ShopListings = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const targetVendorId = route.params?.vendorId;

  const { location: userLocation } = useSelector(
    (state: RootState) => state.location,
  );
  const { nearbyVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts,
  );

  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const promises = [dispatch(fetchAllVendorProducts())];
      if (userLocation?.latitude && userLocation?.longitude) {
        promises.push(
          dispatch(
            fetchNearbyVendors({
              lat: userLocation.latitude,
              lng: userLocation.longitude,
            }),
          ),
        );
      }
      await Promise.all(promises);
    } catch (error) {
      Alert.alert("Refresh Failed", "Could not refresh data.");
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, userLocation]);

  useEffect(() => {
    if (!allProducts || allProducts.length === 0) {
      dispatch(fetchAllVendorProducts());
    }
  }, [dispatch, allProducts.length]);

  const vendorsWithDetails = useMemo(() => {
    const approvedVendors =
      nearbyVendors?.filter((vendor) => vendor.isApproved) || [];

    return approvedVendors.map((vendor) => {
      const vendorProducts = allProducts.filter(
        (product) => product.vendorId === vendor._id,
      );
      const productImages = vendorProducts
        .map((p) => p.images && p.images[0])
        .filter(Boolean);

      const formattedAddress =
        vendor.address?.district || vendor.address?.state || "Local Seller";

      return {
        ...vendor,
        address: { ...vendor.address, formattedAddress },
        productsCount: vendorProducts.length,
        productImages,
        canInvite: vendor.shopName === "Seva Sadan",
      };
    });
  }, [nearbyVendors, allProducts]);

  const localSellers = useMemo(() => {
    if (targetVendorId)
      return vendorsWithDetails.filter(
        (v) => v._id === targetVendorId || (v as any).id === targetVendorId,
      );
    if (!searchText) return vendorsWithDetails;

    const lowercasedSearchText = searchText.toLowerCase();
    return vendorsWithDetails.filter(
      (vendor) =>
        vendor.shopName?.toLowerCase().includes(lowercasedSearchText) ||
        vendor.address?.formattedAddress
          ?.toLowerCase()
          .includes(lowercasedSearchText) ||
        vendor.phone?.includes(lowercasedSearchText) ||
        vendor.businessType?.toLowerCase().includes(lowercasedSearchText),
    );
  }, [vendorsWithDetails, searchText, targetVendorId]);

  const handleCardPress = (shop: any) => {
    navigation.navigate("ShopProducts", {
      vendorId: shop._id,
      vendorName: shop.shopName,
    });
  };

  const renderContent = () => {
    if (vendorsLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.cardWhite} />
          <Text style={styles.loadingText}>Finding nearby gems...</Text>
        </View>
      );
    }

    if (!userLocation && !targetVendorId) {
      return (
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>Location Required</Text>
          <Text style={styles.messageText}>
            Set your location on the Home screen to see nearby sellers.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={localSellers}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ShopCard shop={item} onPress={() => handleCardPress(item)} />
        )}
        contentContainerStyle={styles.flatlistContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.cardWhite}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No nearby local shops found.</Text>
          </View>
        }
      />
    );
  };

  return (
    // 🔥 DARK MODE BACKGROUND TO MATCH SCREENSHOT
    <View style={{ flex: 1, backgroundColor: Colors.backgroundDark }}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {/* Header - Styled for Dark Mode */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.cardWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {targetVendorId
              ? "Shop Profile"
              : `Local Sellers (${localSellers.length})`}
          </Text>
        </View>

        {/* Search Bar - Styled for Dark Mode */}
        {!targetVendorId && (
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color={Colors.textLightGray} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search for sellers, brands..."
              placeholderTextColor={Colors.textLightGray}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        )}

        {renderContent()}
      </SafeAreaView>
    </View>
  );
};

// --- General Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  header: {
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  backButton: { paddingHorizontal: 15 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.cardWhite, // White text on dark bg
    textAlign: "center",
    marginRight: 40,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F222A", // Dark theme input box
    borderRadius: 12,
    paddingHorizontal: 15,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    paddingVertical: 12,
    color: Colors.cardWhite,
  },
  flatlistContainer: { paddingBottom: 30, paddingTop: 10 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: Colors.textLightGray },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: Colors.cardWhite,
  },
  messageText: {
    fontSize: 16,
    color: Colors.textLightGray,
    textAlign: "center",
    marginBottom: 5,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.accentGreen,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: { color: Colors.cardWhite, fontWeight: "bold" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: { fontSize: 16, color: Colors.textLightGray },
});

// --- ShopCard Specific Styles (Matches Screenshot) ---
const shopCardStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 24, // Huge rounded corners like the image
    padding: 18,
    marginVertical: 10,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  topBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  badgeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textGray,
  },
  badgeRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.accentBlue,
    marginLeft: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  shopName: {
    flex: 1,
    fontSize: 22,
    fontWeight: "900",
    color: Colors.textDark,
    letterSpacing: -0.5,
    marginRight: 10,
  },
  ratingContainer: {
    alignItems: "flex-end",
  },
  ratingPill: {
    backgroundColor: Colors.accentGreen,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingNumber: {
    color: Colors.cardWhite,
    fontWeight: "800",
    fontSize: 13,
  },
  ratingCount: {
    color: Colors.textLightGray,
    fontSize: 10,
    marginTop: 4,
    fontWeight: "600",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: Colors.textGray,
    fontWeight: "500",
  },
  dotSeparator: {
    color: Colors.textLightGray,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  contactText: {
    fontSize: 12,
    color: Colors.textGray,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dividerGray,
    width: "100%",
    marginVertical: 14,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  offerIconBadge: {
    width: 38,
    height: 38,
    backgroundColor: Colors.accentPurple,
    borderRadius: 12, // Mimics the badge shape
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textDark,
    marginBottom: 2,
  },
  offerSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textLightGray,
    letterSpacing: 0.5,
  },
  productImagesContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniProductImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.cardWhite,
    backgroundColor: Colors.dividerGray,
  },
});

export default ShopListings;
