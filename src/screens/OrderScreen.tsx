import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Text,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Modal from "react-native-modal";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { RootState } from "../app/store";
import OrderScreenContent from "./OrderScreenContent";
import ProductListSidebar from "./ProductFilterSidebar";
import { Product, Vendor } from "../types";
import { useNavigation } from "@react-navigation/native"; // Use this hook
import * as Location from "expo-location";

const { height } = Dimensions.get("window");

// --- Color Palette ---
const Colors = {
  starbucksGreen: "#0A3D2B",
  backgroundWhite: "#F8F5F0",
  redAlert: "#DC2626",
  textLight: "#FFFFFF",
  textDarkBrown: "#4A2C2A",
  borderGray: "#DDDDDD",
  glassWhite: "rgba(255, 255, 255, 0.95)",
  shadowDark: "rgba(0, 0, 0, 0.1)",
};

// --- Type Definitions (for the cart logic) ---
interface CartReduxItem {
  productId: Product;
  quantity: number;
  price: number;
  _id: string;
}
interface ProductWithDistance extends Product {
  distanceToVendor?: number;
  distanceMessage?: string;
  isVendorCurrentlyInRange?: boolean;
}

// --- Haversine Distance Calculation Function ---
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

// --- Floating Cart Bar Logic and Component ---
const FloatingCartBar = ({ cartItems }) => {
  const navigation = useNavigation();

  // Re-define pricing constants here
  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 200;
  const PLATFORM_FEE_RATE = 0.19;
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
    <View style={styles.floatingCartBar}>
      <View style={styles.floatingCartTextContainer}>
        <Text style={styles.floatingCartLabel}>{primaryItemName}</Text>
        <Text style={styles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.floatingCartButton}
        onPress={() => navigation.navigate("Gift")}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const OrderScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation(); // Use the navigation hook
  const [viewMode, setViewMode] = useState<"vendor" | "category">("vendor");
  const [activeSelection, setActiveSelection] = useState<string>("All Shops");
  const [sortOrder, setSortOrder] = useState<string>("default");
  const [maxAllowedPrice, setMaxAllowedPrice] = useState<number>(10000);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [showInStockOnly, setShowInStockOnly] = useState<boolean>(false);
  const [minRating, setMinRating] = useState<number>(0);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { allProducts, loading, error } = useSelector(
    (state: RootState) => state.vendorProducts
  );
  const allVendors = useSelector(
    (state: RootState) => state.vendorAuth.allVendors
  );
  const cartItems = useSelector(
    (state: RootState) => state.cart.items as CartReduxItem[]
  );

  const fetchUserLocation = useCallback(async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Permission to access location was denied. Please enable it in app settings."
        );
        Alert.alert(
          "Location Permission Required",
          "This app needs access to your location to show nearby shops. Please enable location services and grant permissions.",
          [{ text: "OK", onPress: () => {} }]
        );
        setIsLocationLoading(false);
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
        maximumAge: 1000,
      });

      setUserLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });
    } catch (locError) {
      let errorMessage =
        "Could not get your location. Please enable location services.";
      if (locError.message) {
        errorMessage = `Location Error: ${locError.message}`;
      }
      setLocationError(errorMessage);
      Alert.alert(
        "Location Error",
        "Could not get your location. Some shops might not be visible. Please check app permissions.",
        [{ text: "OK", onPress: () => {} }]
      );
    } finally {
      setIsLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    dispatch(fetchAllVendorProducts());
    dispatch(fetchAllVendors());
    fetchUserLocation();
  }, [dispatch, fetchUserLocation]);

  const { overallMinProductPrice, overallMaxProductPrice } = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return { overallMinProductPrice: 0, overallMaxProductPrice: 10000 };
    }
    const prices = allProducts.map((p) => p.discountedPrice || p.price);
    const min = Math.floor(Math.min(...prices));
    const max = Math.ceil(Math.max(...prices));
    return {
      overallMinProductPrice: min,
      overallMaxProductPrice: Math.max(max, 100),
    };
  }, [allProducts]);

  useEffect(() => {
    if (!loading && allProducts.length > 0 && overallMaxProductPrice > 100) {
      setMaxAllowedPrice(overallMaxProductPrice);
    }
  }, [loading, allProducts, overallMaxProductPrice]);

  useEffect(() => {
    const defaultSelection =
      viewMode === "vendor" ? "All Shops" : "All Products";
    setActiveSelection(defaultSelection);
    setSortOrder("default");
    setMaxAllowedPrice(overallMaxProductPrice);
    setSelectedBrands([]);
    setShowInStockOnly(false);
    setMinRating(0);
  }, [viewMode, overallMaxProductPrice]);

  const vendorMap = useMemo(() => {
    const map = {};
    if (allVendors) {
      allVendors.forEach((vendor) => {
        map[vendor._id] = vendor;
      });
    }
    return map;
  }, [allVendors]);

  const allBrands = useMemo(() => {
    const brands = new Set();
    if (allProducts) {
      allProducts.forEach((product) => {
        if (product.brand) {
          brands.add(product.brand);
        }
      });
    }
    return Array.from(brands).sort();
  }, [allProducts]);

  const applyFiltersAndSort = (productsArray) => {
    let filteredProducts = productsArray
      .filter((product) => {
        const price = product.discountedPrice || product.price;
        return price <= maxAllowedPrice;
      })
      .filter(
        (product) => !showInStockOnly || (showInStockOnly && product.stock > 0)
      )
      .filter((product) => (product.rating || 0) >= minRating)
      .filter(
        (product) =>
          selectedBrands.length === 0 ||
          selectedBrands.includes(product.brand || "")
      );

    const sortableProducts = [...filteredProducts];
    if (sortOrder === "asc") {
      return sortableProducts.sort(
        (a, b) =>
          (a.discountedPrice || a.price) - (b.discountedPrice || b.price)
      );
    } else if (sortOrder === "desc") {
      return sortableProducts.sort(
        (a, b) =>
          (b.discountedPrice || b.price) - (a.discountedPrice || a.price)
      );
    }
    return filteredProducts;
  };

  const isVendorWithinRange = useCallback(
    (vendorId) => {
      if (!vendorId || !userLocation) {
        return false;
      }

      const vendor = vendorMap[vendorId];

      if (
        !vendor ||
        !vendor.address ||
        vendor.address.latitude === undefined ||
        vendor.address.latitude === null ||
        vendor.address.longitude === undefined ||
        vendor.address.longitude === null ||
        vendor.deliveryRange === undefined ||
        vendor.deliveryRange === null ||
        vendor.deliveryRange < 0
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
    },
    [userLocation, vendorMap]
  );

  const getDistanceMessage = useCallback(
    (vendor) => {
      if (
        !userLocation ||
        !vendor.address ||
        vendor.address.latitude === undefined ||
        vendor.address.latitude === null ||
        vendor.address.longitude === undefined ||
        vendor.address.longitude === null ||
        vendor.deliveryRange === undefined ||
        vendor.deliveryRange === null
      ) {
        return { message: "Location data missing", inRange: false };
      }

      const dist = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        vendor.address.latitude,
        vendor.address.longitude
      );

      const isCurrentlyInRange = dist <= vendor.deliveryRange;

      if (isCurrentlyInRange) {
        return { message: `Within delivery range`, inRange: true };
      } else {
        const neededCloser = dist - vendor.deliveryRange;
        if (neededCloser > 0) {
          return {
            message: `Need to be at least ${Math.ceil(neededCloser)} km closer`,
            inRange: false,
          };
        }
        return { message: "Currently out of delivery range", inRange: false };
      }
    },
    [userLocation]
  );

  const vendorShopNames = useMemo(() => {
    const onlineVendorNames = new Set();
    const offlineVendorNames = new Set();

    if (!userLocation && !isLocationLoading) {
      return ["All Shops"];
    }

    if (allProducts && allVendors && userLocation) {
      const vendorsToShow = new Set();

      allProducts.forEach((product) => {
        const vendorId = product.vendor?._id || product.vendorId;
        if (vendorId && vendorMap[vendorId]) {
          if (vendorMap[vendorId].isOnline && isVendorWithinRange(vendorId)) {
            vendorsToShow.add(vendorId);
          }
        }
      });

      vendorsToShow.forEach((vendorId) => {
        const vendor = vendorMap[vendorId];
        if (vendor) {
          onlineVendorNames.add(vendor.shopName);
        }
      });

      allVendors.forEach((vendor) => {
        if (
          !vendor.isOnline &&
          isVendorWithinRange(vendor._id) &&
          !onlineVendorNames.has(vendor.shopName)
        ) {
          offlineVendorNames.add(vendor.shopName + " (Offline)");
        }
      });
    }

    const sortedOnline = Array.from(onlineVendorNames).sort();
    const sortedOffline = Array.from(offlineVendorNames).sort();
    return ["All Shops", ...sortedOnline, ...sortedOffline];
  }, [
    allProducts,
    vendorMap,
    allVendors,
    userLocation,
    isLocationLoading,
    isVendorWithinRange,
  ]);

  const categories = useMemo(() => {
    const uniqueCategories = new Set();

    if (!userLocation && !isLocationLoading) {
      return ["All Products"];
    }

    if (allProducts) {
      const productsInUserRange = allProducts.filter((product) =>
        isVendorWithinRange(product.vendor?._id || product.vendorId)
      );

      productsInUserRange.forEach((product) => {
        if (typeof product.category === "string" && product.category) {
          uniqueCategories.add(
            product.category.charAt(0).toUpperCase() +
              product.category.slice(1).toLowerCase()
          );
        }
      });
    }
    return ["All Products", ...Array.from(uniqueCategories).sort()];
  }, [allProducts, userLocation, isLocationLoading, isVendorWithinRange]);

  const processProductsWithDistance = useCallback(
    (products) => {
      return products.map((product) => {
        const vendor = vendorMap[product.vendor?._id || product.vendorId];
        if (vendor && userLocation) {
          const { message, inRange } = getDistanceMessage(vendor);
          return {
            ...product,
            distanceMessage: message,
            isVendorCurrentlyInRange: inRange,
          };
        }
        return product;
      });
    },
    [vendorMap, userLocation, getDistanceMessage]
  );

  const allFilteredProducts = useMemo(() => {
    if (!allProducts || !userLocation) return [];
    if (isLocationLoading) return [];

    const productsInUserRange = allProducts.filter((product) =>
      isVendorWithinRange(product.vendor?._id || product.vendorId)
    );
    return processProductsWithDistance(
      applyFiltersAndSort(productsInUserRange)
    );
  }, [
    allProducts,
    sortOrder,
    maxAllowedPrice,
    selectedBrands,
    showInStockOnly,
    minRating,
    userLocation,
    isLocationLoading,
    isVendorWithinRange,
    processProductsWithDistance,
  ]);

  const productsByShop = useMemo(() => {
    const grouped = {};
    if (!allProducts || !allVendors || !userLocation) return grouped;
    if (isLocationLoading) return grouped;

    const initialGrouping = {};
    allProducts.forEach((product) => {
      const vendorId = product.vendor?._id || product.vendorId;
      if (vendorId && vendorMap[vendorId] && isVendorWithinRange(vendorId)) {
        const shopName = vendorMap[vendorId]?.shopName;
        if (shopName) {
          if (!initialGrouping[shopName]) {
            initialGrouping[shopName] = [];
          }
          initialGrouping[shopName].push(product);
        }
      }
    });

    for (const shopName in initialGrouping) {
      grouped[shopName] = processProductsWithDistance(
        applyFiltersAndSort(initialGrouping[shopName])
      );
    }
    return grouped;
  }, [
    allProducts,
    vendorMap,
    allVendors,
    sortOrder,
    maxAllowedPrice,
    selectedBrands,
    showInStockOnly,
    minRating,
    userLocation,
    isLocationLoading,
    isVendorWithinRange,
    processProductsWithDistance,
  ]);

  const productsByCategory = useMemo(() => {
    const grouped = {};
    if (!allProducts || !userLocation) return grouped;
    if (isLocationLoading) return grouped;

    categories.slice(1).forEach((categoryName) => {
      const categoryProducts = allProducts.filter(
        (p) =>
          p.category?.toLowerCase() === categoryName.toLowerCase() &&
          isVendorWithinRange(p.vendor?._id || p.vendorId)
      );
      grouped[categoryName] = processProductsWithDistance(
        applyFiltersAndSort(categoryProducts)
      );
    });

    return grouped;
  }, [
    allProducts,
    categories,
    sortOrder,
    maxAllowedPrice,
    selectedBrands,
    showInStockOnly,
    minRating,
    userLocation,
    isLocationLoading,
    isVendorWithinRange,
    processProductsWithDistance,
  ]);

  const finalContentToDisplay = useMemo(() => {
    const isVendorView = viewMode === "vendor";
    const defaultKey = isVendorView ? "All Shops" : "All Products";
    const activeGrouping = isVendorView ? productsByShop : productsByCategory;

    if (activeSelection !== defaultKey && activeGrouping[activeSelection]) {
      return { [activeSelection]: activeGrouping[activeSelection] };
    }

    const finalObject = {};
    finalObject[defaultKey] = allFilteredProducts;
    Object.assign(finalObject, activeGrouping);

    return finalObject;
  }, [
    viewMode,
    activeSelection,
    allFilteredProducts,
    productsByShop,
    productsByCategory,
  ]);

  const hasShopsInCurrentSelection = useMemo(() => {
    if (
      activeSelection === (viewMode === "vendor" ? "All Shops" : "All Products")
    ) {
      return allFilteredProducts.length > 0;
    }
    const activeGrouping =
      viewMode === "vendor" ? productsByShop : productsByCategory;
    return (activeGrouping[activeSelection]?.length || 0) > 0;
  }, [
    activeSelection,
    viewMode,
    allFilteredProducts,
    productsByShop,
    productsByCategory,
  ]);

  const handleItemClick = (name) => {
    setActiveSelection(name);
    setShowFilterModal(false);
  };

  if (isLocationLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.starbucksGreen} />
        <Text style={styles.loadingText}>
          {isLocationLoading
            ? "Finding your location..."
            : "Loading shops and products..."}
        </Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Location Error</Text>
        <Text style={styles.messageText}>{locationError}</Text>
        <Text style={styles.messageText}>
          Please enable location services or grant permissions for the app.
        </Text>
      </View>
    );
  }

  const isEmptyDisplay = Object.values(finalContentToDisplay).every(
    (arr) => arr.length === 0
  );

  if (!userLocation && !isLocationLoading) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Location Required</Text>
        <Text style={styles.messageText}>
          We need your location to show nearby shops.
        </Text>
        <Text style={styles.messageText}>
          Please ensure location services are enabled.
        </Text>
      </View>
    );
  }

  if (isEmptyDisplay && !error) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>No Shops Nearby!</Text>
        <Text style={styles.messageText}>
          Looks like no shops are currently delivering to your location.
        </Text>
        <Text style={styles.messageText}>
          Please try again later or adjust your location if possible.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Error Loading Data</Text>
        <Text style={styles.messageText}>
          {error || "Something went wrong while fetching products/vendors."}
        </Text>
        <Text style={styles.messageText}>Please try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* Main content area */}
      <OrderScreenContent
        loading={loading}
        error={error}
        viewMode={viewMode}
        setViewMode={setViewMode}
        productsToDisplay={finalContentToDisplay}
        allVendors={allVendors}
        isVendorWithinRange={isVendorWithinRange}
        setShowFilterModal={setShowFilterModal}
        // Pass the navigation prop here
        navigation={navigation}
      />

      {/* Filter Modal */}
      <Modal
        isVisible={showFilterModal}
        onBackdropPress={() => setShowFilterModal(false)}
        onSwipeComplete={() => setShowFilterModal(false)}
        swipeDirection={["down"]}
        style={styles.bottomModal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.5}
        useNativeDriverForBackdrop
      >
        <View style={styles.modalContentContainer}>
          <ProductListSidebar
            viewMode={viewMode}
            setViewMode={setViewMode}
            activeSelection={activeSelection}
            handleItemClick={handleItemClick}
            sidebarItems={viewMode === "vendor" ? vendorShopNames : categories}
            titlePrefix={viewMode === "vendor" ? "Vendor Shops" : "Categories"}
            onClose={() => setShowFilterModal(false)}
          />
        </View>
      </Modal>

      {/* Conditionally render the floating cart bar */}
      {cartItems.length > 0 && <FloatingCartBar cartItems={cartItems} />}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    paddingTop: 30,
    paddingBottom: 60,
    flex: 1,
    position: "relative",
    backgroundColor: Colors.backgroundWhite,
  },
  container: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 100,
    backgroundColor: Colors.backgroundWhite,
  },
  bottomModal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  modalContentContainer: {
    height: height * 0.75, // Changed to 75% of screen height
    backgroundColor: Colors.backgroundWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
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
  // --- Floating Cart Bar Styles ---
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

export default OrderScreen;