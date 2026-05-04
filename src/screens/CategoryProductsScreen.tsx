import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef, // Import useRef
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  // Animated removed
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";

import NewProductCard from "../components/NewProductCard11";
import { RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";

// Haversine Distance Calculation Function (Unchanged)
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

// Type Definitions
type CategoryProductsRouteParams = {
  categoryName: string;
};

type CategoryProductsScreenRouteProp = RouteProp<
  { CategoryProducts: CategoryProductsRouteParams },
  "CategoryProducts"
>;

// **MODIFIED:** Helper function to format category names to show only the sub-subcategory
const getCategoryName = (fullCategoryName) => {
  const parts = fullCategoryName.split("_");
  let categoryPart = fullCategoryName;
  // Get the last part of the category name (sub-subcategory)
  if (parts.length > 1) {
    categoryPart = parts[parts.length - 1];
  }

  // Apply truncation to the cleaned category name
  const MAX_LENGTH = 7;
  if (categoryPart.length > MAX_LENGTH) {
    return categoryPart.substring(0, MAX_LENGTH) + "...";
  }

  return categoryPart;
};

// Floating Cart Bar Component (Unchanged)
const FloatingCartBar = ({ cartItems }) => {
  const navigation = useNavigation();
  const DELIVERY_CHARGE = 0;
  const FREE_DELIVERY_THRESHOLD = 0;
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

// --- Fisher-Yates (Knuth) Shuffle Algorithm ---
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- CategoryProductsScreen Component ---
const CategoryProductsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const route = useRoute<CategoryProductsScreenRouteProp>();
  const { categoryName } = route.params;

  const [selectedCategory, setSelectedCategory] = useState(categoryName);
  const [sortOrder, setSortOrder] = useState("asc");

  // State to hold the products *after* they have been filtered and shuffled
  const [shuffledProducts, setShuffledProducts] = useState([]);

  // --- PERSISTENT IMAGE CACHE (Ref is used because we don't want state updates on cache hits) ---
  const imageUriCache = useRef({});

  // --- Read location and its loading state from Redux ---
  const { location: userLocation, loading: isLocationLoading } = useSelector(
    (state) => state.location
  );
  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts
  );
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const cartItems = useSelector((state: RootState) => state.cart.items);

  // --- Fetch data only if not already present ---
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
    return 1; // 🚩 FORCED TO 1 COLUMN
  }, [width]);

  // Create a map of vendors for quick lookup
  const vendorMap = useMemo(() => {
    const map = {};
    if (allVendors) {
      allVendors.forEach((vendor) => {
        map[vendor._id] = vendor;
      });
    }
    return map;
  }, [allVendors]);

  // Filter vendors based on delivery range and approval status
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
        !vendor.isApproved
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

  // Filter products to only include those from in-range vendors
  const inRangeProducts = useMemo(() => {
    if (!allProducts || !inRangeVendors) return [];
    const inRangeVendorIds = new Set(
      inRangeVendors.map((vendor) => vendor._id)
    );
    return allProducts.filter((product) =>
      inRangeVendorIds.has(product.vendorId)
    );
  }, [allProducts, inRangeVendors]);

  // Create a list of all unique categories with an associated image
  const uniqueCategories = useMemo(() => {
    const categoriesMap = new Map();
    inRangeProducts.forEach((product) => {
      if (product.category && !categoriesMap.has(product.category)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.category === product.category && p.images && p.images.length > 0
        );
        const imageUrl = firstImageProduct?.images?.[0];

        // Populate cache for category images
        if (imageUrl) {
          imageUriCache.current[product.category] = imageUrl;
        }

        categoriesMap.set(product.category, {
          name: product.category,
          // Use the cached image URL if available
          imageUrl: imageUriCache.current[product.category] || imageUrl,
        });
      }
    });
    return Array.from(categoriesMap.values());
  }, [inRangeProducts]);

  // Filter and sort products based on the currently selected category and sort order
  const preShuffledFilteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }
    const products = inRangeProducts.filter(
      (product) => product.category === selectedCategory
    );

    // Sort logic (applied *before* shuffling for predictable results if sort is toggled)
    return products.sort((a, b) => {
      const priceA = a.discountedPrice || a.price || 0;
      const priceB = b.discountedPrice || b.price || 0;

      if (sortOrder === "asc") {
        return priceA - priceB;
      } else {
        return priceB - priceA;
      }
    });
  }, [inRangeProducts, selectedCategory, sortOrder]);

  // --- SHUFFLE EFFECT: Shuffle the pre-sorted list once when it changes ---
  useEffect(() => {
    // We only want to shuffle if the sort order is default ("asc" in this case, meaning price-based sorting is active)
    // If you want random order when the user enters, you might want to remove the price sorting initially.
    // For now, let's keep the shuffle as the final step after filtering/sorting.

    // Shuffle only on initial load or category change (when the preShuffledFilteredProducts list updates significantly)
    setShuffledProducts(shuffleArray(preShuffledFilteredProducts));
  }, [preShuffledFilteredProducts]);

  const renderProductCard = ({ item }) => {
    // Also cache main product images when rendering
    if (item.images && item.images.length > 0) {
      imageUriCache.current[item._id] = item.images[0];
    }

    const vendorId = item.vendorId || item.vendor?._id || "";
    const vendorData = vendorMap[vendorId];
    const isVendorOffline = vendorData ? !vendorData.isOnline : true;

    return (
      <View style={styles.productCardContainer}>
        <NewProductCard
          key={item._id}
          product={item}
          // Assuming NewProductCard handles image loading using the provided URI
          // The image source will now effectively hit the native cache faster
          vendorShopName={vendorData?.shopName || "Unknown Shop"}
          isVendorOffline={isVendorOffline}
          isVendorOutOfRange={false}
          cardStyle={{ width: "100%" }}
        />
      </View>
    );
  };

  const flatListKey = `category-product-list-key-${numColumns}-${selectedCategory}-${sortOrder}`;

  const isLoading = productsLoading || vendorsLoading || isLocationLoading;

  // --- Animation Styles REMOVED/Simplified ---

  if (isLoading) {
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
        {/* Header Section */}
        <View style={mergedStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.starbucksGreen}
            />
          </TouchableOpacity>
          {/* Reduced title font size */}
          <Text style={mergedStyles.title}>
            {getCategoryName(selectedCategory)}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        {/* --- Horizontal Category Bar --- */}
        <View style={styles.horizontalBarContainer}>
          <FlatList
            horizontal
            data={uniqueCategories}
            keyExtractor={(item) => item.name}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalListContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryItem,
                  selectedCategory === item.name && styles.activeCategoryItem,
                ]}
                onPress={() => setSelectedCategory(item.name)} // This is the category click
              >
                {/* Reduced image size */}
                <Image
                  source={{
                    // Use image URI stored in the cache if available
                    uri:
                      imageUriCache.current[item.name] ||
                      item.imageUrl ||
                      "https://via.placeholder.com/150",
                  }}
                  style={styles.categoryImage}
                />
                {/* Reduced text size */}
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === item.name && styles.activeCategoryText,
                  ]}
                >
                  {getCategoryName(item.name)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
        {/* --- END Horizontal Category Bar --- */}
        {/* Main Content Wrapper */}
        <View style={styles.contentWrapper}>
          {/* Replaced Animated.View with standard View */}
          <View style={[styles.rightPanelFullWidth]}>
            {/* Price Filter Options */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  sortOrder === "asc" && styles.activeFilterButton,
                ]}
                onPress={() => setSortOrder("asc")}
              >
                <Ionicons
                  name="arrow-up"
                  size={12}
                  color={
                    sortOrder === "asc"
                      ? Colors.textLight
                      : Colors.textDarkBrown
                  }
                />
                <Text
                  style={[
                    styles.filterText,
                    sortOrder === "asc" && styles.activeFilterText,
                  ]}
                >
                  Low to High
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  sortOrder === "desc" && styles.activeFilterButton,
                ]}
                onPress={() => setSortOrder("desc")}
              >
                <Ionicons
                  name="arrow-down"
                  size={12}
                  color={
                    sortOrder === "desc"
                      ? Colors.textLight
                      : Colors.textDarkBrown
                  }
                />
                <Text
                  style={[
                    styles.filterText,
                    sortOrder === "desc" && styles.activeFilterText,
                  ]}
                >
                  High to Low
                </Text>
              </TouchableOpacity>
            </View>
            {/* Product List: Uses shuffledProducts state */}
            {shuffledProducts.length > 0 ? (
              <FlatList
                key={flatListKey}
                data={shuffledProducts} // <-- Use the shuffled array
                renderItem={renderProductCard}
                keyExtractor={(item) => item._id}
                numColumns={numColumns}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.productListContainer}
              />
            ) : (
              <Text style={mergedStyles.noResultsText}>
                No products found for this category.
              </Text>
            )}
          </View>
        </View>
      </SafeAreaView>
      {/* Reduced Floating Cart Bar size */}
      {cartItems.length > 0 && <FloatingCartBar cartItems={cartItems} />}
    </View>
  );
};

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    flexDirection: "row", // Keep row for layout consistency, but only one child now
    backgroundColor: Colors.backgroundWhite,
  },
  // *** STYLES FOR HORIZONTAL BAR (Reduced) ***
  horizontalBarContainer: {
    paddingVertical: 8, // Reduced padding
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  horizontalListContainer: {
    paddingHorizontal: 1, // Reduced padding
  },
  categoryItem: {
    alignItems: "center",
    marginHorizontal: 8, // Reduced space between items
    paddingHorizontal: 4,
  },
  activeCategoryItem: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.starbucksGreen,
  },
  categoryImage: {
    width: 60, // Reduced image size
    height: 50, // Reduced image size
    borderRadius: 8, // Reduced border radius
    resizeMode: "cover",
    marginBottom: 3, // Reduced margin
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  categoryText: {
    fontSize: 6, // Reduced font size
    fontWeight: "900",
    textAlign: "center",
    color: Colors.textDarkBrown,
  },
  activeCategoryText: {
    fontWeight: "bold",
    color: Colors.starbucksGreen,
  },
  // Right Panel (now full width)
  rightPanelFullWidth: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  // Responsive and smaller filter container
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 6, // Reduced padding
    paddingHorizontal: 15,
    backgroundColor: Colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  // Filter button
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 4, // Reduced padding
    paddingHorizontal: 6,
    borderRadius: 12, // Reduced border radius
    marginHorizontal: 4, // Reduced margin
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  activeFilterButton: {
    backgroundColor: Colors.starbucksGreen,
    borderColor: Colors.starbucksGreen,
  },
  filterText: {
    marginLeft: 3,
    fontSize: 10, // Reduced font size
    fontWeight: "600",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  activeFilterText: {
    color: Colors.textLight,
  },
  productListContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: 80, // Reduced bottom padding
  },
  // 🚩 MODIFIED: 1 COLUMN LAYOUT CONTAINER
  productCardContainer: {
    width: "100%", // Takes full width of the FlatList column
    paddingHorizontal: 5, // Add padding to separate card from edge
    marginBottom: 10,
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
    paddingTop: 30, // Reduced padding
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  title: {
    paddingTop: 5, // Reduced padding
    fontSize: 20, // Reduced font size
    fontWeight: "bold",
    color: Colors.starbucksGreen,
    textAlign: "center",
  },
  noResultsText: {
    textAlign: "center",
    marginTop: 40, // Reduced margin
    fontSize: 16, // Reduced font size
    fontWeight: "500",
    color: Colors.textDarkBrown,
    width: "100%",
  },
  // --- Floating Cart Bar (Reduced) ---
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 15 : 5, // Reduced bottom distance
    left: 10, // Reduced horizontal distance
    right: 10, // Reduced horizontal distance
    backgroundColor: Colors.starbucksGreen,
    borderRadius: 10, // Reduced border radius
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8, // Reduced vertical padding
    paddingHorizontal: 15, // Reduced horizontal padding
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 999,
    minHeight: 65, // Reduced minimum height
  },
  floatingCartTextContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  floatingCartLabel: {
    color: Colors.textLight,
    fontSize: 15, // Reduced font size
    fontWeight: "500",
    lineHeight: 18,
    marginBottom: 1,
  },
  floatingCartPrice: {
    color: Colors.textLight,
    fontSize: 17, // Reduced font size
    fontWeight: "700",
    lineHeight: 20,
  },
  floatingCartButton: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 20, // Reduced border radius
    paddingVertical: 6, // Reduced padding
    paddingHorizontal: 10, // Reduced padding
    justifyContent: "center",
    alignItems: "center",
    minWidth: 80, // Reduced minimum width
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  floatingCartButtonText: {
    color: Colors.starbucksGreen,
    fontSize: 14, // Reduced font size
    fontWeight: "700",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16, // Reduced font size
    color: Colors.textDarkBrown,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
});

export default CategoryProductsScreen;
