import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Image,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";

import NewProductCard from "../components/NewPeoductCard";
import { RootState, AppDispatch } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";

// --- Haversine Distance Calculation Function (Copied for consistency) ---
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

const Colors = {
  starbucksGreen: "#0A3D2B",
  textDarkBrown: "#4A2C2A",
  textDark: "#4A2C2A",
  textLight: "#FFFFFF",
  backgroundWhite: "#F8F5F0",
  borderGray: "#DDDDDD",
};

// --- Type Definitions ---
type BrandProductsRouteParams = {
  brandName: string;
};

type BrandProductsScreenRouteProp = RouteProp<
  { BrandProducts: BrandProductsRouteParams },
  "BrandProducts"
>;

// Floating Cart Bar Component (Unchanged)
const FloatingCartBar = ({ cartItems }) => {
  const navigation = useNavigation();
  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 250;
  const PLATFORM_FEE_RATE = 0.03;
  const GST_RATE = 0.05;

  const getEffectivePrice = useCallback((product, quantity) => {
    let price = product.discountedPrice || product.price || 0;
    if (
      product.largeQuantityPrice &&
      product.largeQuantityMinimumUnits &&
      quantity >= product.largeQuantityMinimumUnits
    ) {
      price = product.largeQuantityPrice;
    } else if (
      product.bulkPrice &&
      product.bulkMinimumUnits &&
      quantity >= product.bulkMinimumUnits
    ) {
      price = product.bulkPrice;
    }
    return price;
  }, []);

  const primaryItemName = useMemo(() => {
    if (cartItems.length === 0) return "";
    const firstItem = cartItems[0];
    const productName = firstItem.productId?.name || "Item";
    if (cartItems.length > 1) {
      const uniqueProducts = new Set(
        cartItems.map((item) => item.productId?._id)
      );
      if (uniqueProducts.size > 1) {
        return `${cartItems.length} Items`;
      }
    }
    return productName;
  }, [cartItems]);

  const pricingBreakdown = useMemo(() => {
    const discountedSubtotal = cartItems.reduce((sum, item) => {
      const product = item.productId || {};
      const effectivePrice = getEffectivePrice(product, item.quantity);
      return sum + effectivePrice * item.quantity;
    }, 0);
    const deliveryCharge =
      discountedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
    const platformFee = discountedSubtotal * PLATFORM_FEE_RATE;
    const gstAmount = (discountedSubtotal + platformFee) * GST_RATE;
    const finalTotal =
      discountedSubtotal + deliveryCharge + platformFee + gstAmount;
    return {
      finalTotal,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cartItems, getEffectivePrice]);

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <View style={mergedStyles.floatingCartBar}>
      <View style={mergedStyles.floatingCartTextContainer}>
        <Text style={mergedStyles.floatingCartLabel}>{primaryItemName}</Text>
        <Text style={mergedStyles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={mergedStyles.floatingCartButton}
        onPress={() => navigation.navigate("CartScreen")}
        activeOpacity={0.8}
      >
        <Text style={mergedStyles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- BrandProductsScreen Component ---
const BrandProductsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<BrandProductsScreenRouteProp>();
  const { brandName } = route.params;
  const dispatch = useDispatch();

  // --- Read location and its loading state from Redux ---
  const { location: userLocation, loading: isLocationLoading } = useSelector(
    (state) => state.location
  );
  const locationError = useSelector((state) => state.location.error);

  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts
  );
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const cartItems = useSelector((state: RootState) => state.cart.items);

  // --- Fetch data only if not already present, no need to fetch location here ---
  useEffect(() => {
    if (!allVendors || allVendors.length === 0) {
      dispatch(fetchAllVendors());
    }
    if (!allProducts || allProducts.length === 0) {
      dispatch(fetchAllVendorProducts());
    }
  }, [dispatch, allVendors, allProducts]);

  const { width } = useWindowDimensions();
  const numColumns = useMemo(() => {
    const minCardWidth = 175;
    const containerWidth = width * 0.75;
    return Math.floor(containerWidth / minCardWidth);
  }, [width]);

  const vendorMap = useMemo(() => {
    const map = {};
    if (allVendors) {
      allVendors.forEach((vendor) => {
        map[vendor._id] = vendor;
      });
    }
    return map;
  }, [allVendors]);

  // Filter vendors based on delivery range, location, and approval status
  const inRangeVendors = useMemo(() => {
    if (!allVendors || !userLocation) {
      return [];
    }
    return allVendors.filter((vendor) => {
      if (
        !vendor.address ||
        !vendor.address.latitude ||
        !vendor.address.longitude ||
        !vendor.deliveryRange ||
        !vendor.isOnline ||
        !vendor.isApproved // <-- Added condition to filter for approved vendors
      ) {
        return false;
      }
      const distance = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        vendor.address.latitude,
        vendor.address.longitude
      );
      return distance <= vendor.deliveryRange;
    });
  }, [allVendors, userLocation]);

  const inRangeProducts = useMemo(() => {
    if (!allProducts || !inRangeVendors) return [];
    const inRangeVendorIds = new Set(
      inRangeVendors.map((vendor) => vendor._id)
    );
    return allProducts.filter((product) =>
      inRangeVendorIds.has(product.vendorId)
    );
  }, [allProducts, inRangeVendors]);

  // Create a list of all unique brands with an associated image, but only from in-range products
  const uniqueBrands = useMemo(() => {
    const brandsMap = new Map();
    inRangeProducts.forEach((product) => {
      if (product.brandName && !brandsMap.has(product.brandName)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.brandName === product.brandName && p.images && p.images.length > 0
        );
        const imageUrl = firstImageProduct?.images?.[0];
        brandsMap.set(product.brandName, {
          name: product.brandName,
          imageUrl,
        });
      }
    });
    return Array.from(brandsMap.values());
  }, [inRangeProducts]);

  const filteredProducts = useMemo(() => {
    if (!brandName) {
      return [];
    }
    // Filter from the in-range products list
    return inRangeProducts.filter((product) => product.brandName === brandName);
  }, [inRangeProducts, brandName]);

  const renderLeftPanelItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.leftPanelItem,
        brandName === item.name && styles.selectedLeftPanelItem,
      ]}
      onPress={() =>
        navigation.navigate("BrandProducts", { brandName: item.name })
      }
    >
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
        style={styles.leftPanelImage}
      />
      <Text
        style={[
          styles.leftPanelText,
          brandName === item.name && styles.selectedLeftPanelText,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderProductCard = ({ item }) => {
    const vendorId = item.vendorId || item.vendor?._id || "";
    const vendorData = vendorMap[vendorId];
    const isVendorOffline = vendorData ? !vendorData.isOnline : true;

    return (
      <View style={styles.productCardContainer}>
        <NewProductCard
          key={item._id}
          product={item}
          vendorShopName={vendorData?.shopName || "Unknown Shop"}
          isVendorOffline={isVendorOffline}
          isVendorOutOfRange={false}
          cardStyle={{ width: "100%" }}
        />
      </View>
    );
  };

  const flatListKey = `brand-product-list-key-${numColumns}`;

  if (productsLoading || vendorsLoading || isLocationLoading) {
    return (
      <View style={mergedStyles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.starbucksGreen} />
        <Text style={mergedStyles.loadingText}>
          {isLocationLoading ? "Finding your location..." : "Loading data..."}
        </Text>
      </View>
    );
  }

  if (inRangeVendors.length === 0) {
    return (
      <View style={mergedStyles.messageContainer}>
        <Text style={mergedStyles.noResultsText}>
          No shops are currently delivering to your location. 😔
        </Text>
      </View>
    );
  }

  return (
    <View style={mergedStyles.mainContainer}>
      <SafeAreaView style={mergedStyles.safeArea}>
        <View style={mergedStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.starbucksGreen}
            />
          </TouchableOpacity>
          <Text style={mergedStyles.title}>{brandName}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.leftPanel}>
            {uniqueBrands.length > 0 ? (
              <FlatList
                data={uniqueBrands}
                renderItem={renderLeftPanelItem}
                keyExtractor={(item) => item.name}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.leftListContainer}
              />
            ) : (
              <Text style={styles.leftPanelNoResultsText}>
                No brands found.
              </Text>
            )}
          </View>

          <View style={styles.rightPanel}>
            {filteredProducts.length > 0 ? (
              <FlatList
                key={flatListKey}
                data={filteredProducts}
                renderItem={renderProductCard}
                keyExtractor={(item) => item._id}
                numColumns={numColumns}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.productListContainer}
              />
            ) : (
              <Text style={mergedStyles.noResultsText}>
                No products found for this brand.
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>

      {cartItems.length > 0 && <FloatingCartBar cartItems={cartItems} />}
    </View>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.backgroundWhite,
  },
  leftPanel: {
    width: "25%",
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: Colors.borderGray,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  leftListContainer: {
    paddingVertical: 20,
    paddingBottom: 100,
  },
  leftPanelItem: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  selectedLeftPanelItem: {
    backgroundColor: Colors.backgroundWhite,
    borderLeftWidth: 3,
    borderLeftColor: Colors.starbucksGreen,
  },
  leftPanelImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    resizeMode: "contain",
  },
  leftPanelText: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
    color: Colors.textDarkBrown,
  },
  selectedLeftPanelText: {
    color: Colors.starbucksGreen,
  },
  leftPanelNoResultsText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    color: Colors.textDark,
    paddingHorizontal: 5,
  },
  productListContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 100,
  },
  productCardContainer: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  row: {
    justifyContent: "space-between",
  },
});

const mergedStyles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: Colors.backgroundWhite,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  title: {
    paddingTop: 10,
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.starbucksGreen,
    textAlign: "center",
  },
  noResultsText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: Colors.textDarkBrown,
    width: "100%",
  },
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 20 : 10,
    left: 15,
    right: 15,
    backgroundColor: Colors.starbucksGreen,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 999,
    minHeight: 75,
  },
  floatingCartTextContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  floatingCartLabel: {
    color: Colors.textLight,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 2,
  },
  floatingCartPrice: {
    color: Colors.textLight,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  floatingCartButton: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingCartButtonText: {
    color: Colors.starbucksGreen,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  // New styles for loading and no results
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.textDarkBrown,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
});

export default BrandProductsScreen;
