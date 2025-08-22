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
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";

import { RootState } from "../app/store";
import NewProductCard from "../components/NewProductCard";
import { Vendor } from "../features/vendor/vendorAuthSlice";

const { width } = Dimensions.get("window");

const Colors = {
  starbucksGreen: "#0A3D2B",
  textDarkBrown: "#4A2C2A",
  luxuryTextPrimary: "#E0E0E0",
  luxuryBackground: "#0a0a09ff",
  greenDark: "#0A3D2B",
  textDark: "#4A2C2A",
  textLight: "#FFFFFF",
  backgroundWhite: "#0A3D2B",
};

// --- Type Definitions (Copy from your main app/store file) ---
interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  isAvailable: boolean;
  images?: string[];
  companyName?: string;
  brand?: string;
  location?: string;
  rating?: number;
  numReviews?: number;
  vendorId?: string;
  vendor?: {
    _id: string;
  };
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  description?: string;
}

interface CartReduxItem {
  productId: Product;
  quantity: number;
  price: number;
  _id: string;
}

// --- Floating Cart Bar Logic and Component (Integrated) ---
const FloatingCartBar = ({ cartItems }) => {
  // Correctly call useNavigation without any arguments
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
        // Correct navigation to the 'CartScreen' tab
        onPress={() => navigation.navigate("CartScreen")}
        activeOpacity={0.8}
      >
        <Text style={mergedStyles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Main ShopProductsScreen Component ---
const ShopProductsScreen = () => {
  const route = useRoute();
  const { vendorId, vendorName } = route.params;

  const navigation = useNavigation();
  const { allProducts } = useSelector((state) => state.vendorProducts);
  const { allVendors } = useSelector((state) => state.vendorAuth);
  const cartItems = useSelector((state) => state.cart.items);

  const vendorMap = React.useMemo(() => {
    const map = {};
    allVendors?.forEach((vendor) => (map[vendor._id] = vendor));
    return map;
  }, [allVendors]);

  const filteredProducts = allProducts.filter(
    (product) => (product.vendor?._id || product.vendorId) === vendorId
  );

  const renderProductCard = ({ item }) => {
    const vendorId = item.vendorId || item.vendor?._id || "";
    const vendorData = vendorMap[vendorId];
    const isVendorOffline = vendorData ? !vendorData.isOnline : true;

    return (
      <NewProductCard
        key={item._id}
        product={item}
        vendorShopName={vendorData?.shopName || "Unknown Shop"}
        isVendorOffline={isVendorOffline}
        isVendorOutOfRange={false}
        cardStyle={shopCardStyles.productCard}
      />
    );
  };

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
          <Text style={mergedStyles.title}>{vendorName}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={mergedStyles.container}>
          {filteredProducts.length > 0 ? (
            <FlatList
              data={filteredProducts}
              renderItem={renderProductCard}
              keyExtractor={(item) => item._id}
              numColumns={1}
              contentContainerStyle={mergedStyles.listContainer}
            />
          ) : (
            <Text style={mergedStyles.noResultsText}>
              No products found for this shop.
            </Text>
          )}
        </View>
      </SafeAreaView>

      {cartItems.length > 0 && <FloatingCartBar cartItems={cartItems} />}
    </View>
  );
};

// --- Stylesheets for all components in this file ---
const shopCardStyles = StyleSheet.create({
  card: {
    // ... your existing styles
  },
  cardOffline: {
    // ... your existing styles
  },
  contentContainer: {
    // ... your existing styles
  },
  shopName: {
    // ... your existing styles
  },
  detailsContainer: {
    // ... your existing styles
  },
  distanceText: {
    // ... your existing styles
  },
  statusText: {
    // ... your existing styles
  },
  imageAndIconContainer: {
    // ... your existing styles
  },
  shopImage: {
    // ... your existing styles
  },
  chevronIcon: {
    // ... your existing styles
  },
  productCard: {
    width: "100%",
    marginVertical: 10,
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
    backgroundColor: "#F8F5F0",
  },
  container: {
    flex: 1,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    backgroundColor: "#fff",
  },
  title: {
    paddingTop: 20,
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.greenDark,
    textAlign: "center",
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.backgroundWhite,
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
    padding: 20,
    backgroundColor: Colors.backgroundWhite,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  messageText: {
    fontSize: 16,
    color: Colors.textDarkBrown,
    textAlign: "center",
    marginBottom: 5,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.starbucksGreen,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textLight,
    fontWeight: "bold",
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
    backgroundColor: "#F8F5F0",
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
});

export default ShopProductsScreen;
