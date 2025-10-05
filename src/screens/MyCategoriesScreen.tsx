import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native"; // 👈 Updated import
import { useSelector, useDispatch } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";

import { RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import NewProductCard from "../components/NewPeoductCard";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";

const Colors = {
  starbucksGreen: "#0A3D2B",
  textDarkBrown: "#4A2C2A",
  textDark: "#4A2C2A",
  textLight: "#FFFFFF",
  backgroundWhite: "#F8F5F0",
    borderGray: "#DDDDDD",
  black:"black"
};

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

// Corrected helper function to get the third-level name from a category path
const getCategoryName = (fullCategoryName) => {
  const parts = fullCategoryName.split("_");
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return fullCategoryName;
};

// Floating Cart Bar Component
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

// --- MyCategoriesScreen Component ---
const MyCategoriesScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [searchQuery, setSearchQuery] = useState("");

  const { location: userLocation, loading: isLocationLoading } = useSelector(
    (state) => state.location
  );
  const { allProducts, loading: productsLoading } = useSelector(
    (state) => state.vendorProducts
  );
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state) => state.vendorAuth
  );
  const cartItems = useSelector((state) => state.cart.items);

  useEffect(() => {
    if (!allVendors || allVendors.length === 0) {
      dispatch(fetchAllVendors());
    }
    if (!allProducts || allProducts.length === 0) {
      dispatch(fetchAllVendorProducts());
    }
  }, [dispatch, allVendors, allProducts]);

  // 👈 Use useFocusEffect to clear the search bar on blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearchQuery("");
        setSelectedCategory("");
      };
    }, [])
  );

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

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

  const inRangeProducts = useMemo(() => {
    if (!allProducts || !inRangeVendors) return [];
    const inRangeVendorIds = new Set(
      inRangeVendors.map((vendor) => vendor._id)
    );
    return allProducts.filter((product) =>
      inRangeVendorIds.has(product.vendorId)
    );
  }, [allProducts, inRangeVendors]);

  const productsAfterSearch = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    if (!lowercasedQuery) {
      return inRangeProducts;
    }
    return inRangeProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(lowercasedQuery) ||
        product.category.toLowerCase().includes(lowercasedQuery) ||
        (product.tags &&
          product.tags.some((tag) =>
            tag.toLowerCase().includes(lowercasedQuery)
          ))
    );
  }, [inRangeProducts, searchQuery]);

  const uniqueCategories = useMemo(() => {
    const categoriesMap = new Map();
    productsAfterSearch.forEach((product) => {
      const fullPath = product.category;
      if (fullPath && !categoriesMap.has(fullPath)) {
        const firstImageProduct = productsAfterSearch.find(
          (p) => p.category === fullPath && p.images && p.images.length > 0
        );
        const imageUrl =
          firstImageProduct?.images?.[0] || "https://via.placeholder.com/150";
        categoriesMap.set(fullPath, {
          fullPath: fullPath,
          name: getCategoryName(fullPath),
          imageUrl,
        });
      }
    });
    return Array.from(categoriesMap.values());
  }, [productsAfterSearch]);

  useEffect(() => {
    if (uniqueCategories.length > 0) {
      const isCategoryValid = uniqueCategories.some(
        (cat) => cat.fullPath === selectedCategory
      );
      if (!isCategoryValid) {
        setSelectedCategory(uniqueCategories[0].fullPath);
      }
    } else {
      setSelectedCategory("");
    }
  }, [uniqueCategories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return productsAfterSearch.sort((a, b) => {
        const priceA = a.discountedPrice || a.price || 0;
        const priceB = b.discountedPrice || b.price || 0;
        return sortOrder === "asc" ? priceA - priceB : priceB - priceA;
      });
    }
    let products = productsAfterSearch.filter(
      (product) => product.category === selectedCategory
    );

    return products.sort((a, b) => {
      const priceA = a.discountedPrice || a.price || 0;
      const priceB = b.discountedPrice || b.price || 0;

      if (sortOrder === "asc") {
        return priceA - priceB;
      } else {
        return priceB - priceA;
      }
    });
  }, [productsAfterSearch, selectedCategory, sortOrder]);

  const renderLeftPanelItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.leftPanelItem,
        selectedCategory === item.fullPath && styles.selectedLeftPanelItem,
      ]}
      onPress={() => setSelectedCategory(item.fullPath)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.leftPanelImage} />
      <Text
        style={[
          styles.leftPanelText,
          selectedCategory === item.fullPath && styles.selectedLeftPanelText,
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

  const flatListKey = `category-product-list-key-${numColumns}-${selectedCategory}-${sortOrder}-${searchQuery}`;

  const isLoading = productsLoading || vendorsLoading || isLocationLoading;

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

  const displayProducts = filteredProducts.length > 0;
  const noProductsInCategory =
    uniqueCategories.length > 0 && filteredProducts.length === 0;
  const noResultsMessage = searchQuery
    ? `No products found for "${searchQuery}".`
    : noProductsInCategory
    ? "No products found in this category."
    : "No products found for this category or search query.";

  return (
    <View style={mergedStyles.mainContainer}>
      <SafeAreaView style={mergedStyles.safeArea}>
        {/* <View style={mergedStyles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.starbucksGreen}
            />
          </TouchableOpacity>
          <Text style={mergedStyles.title}>Categories</Text>
          <View style={{ width: 24 }} />
        </View> */}

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={Colors.black}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.black}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearchChange("")}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={Colors.borderGray}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.leftPanel}>
            {uniqueCategories.length > 0 ? (
              <FlatList
                data={uniqueCategories}
                renderItem={renderLeftPanelItem}
                keyExtractor={(item) => item.fullPath}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.leftListContainer}
              />
            ) : (
              <Text style={styles.leftPanelNoResultsText}>
                No categories match your search.
              </Text>
            )}
          </View>

          <View style={styles.rightPanel}>
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
                  size={14}
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
                  size={14}
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

            {displayProducts ? (
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
              <Text style={mergedStyles.noResultsText}>{noResultsMessage}</Text>
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
    paddingBottom: 200,
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
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 15,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  activeFilterButton: {
    backgroundColor: Colors.starbucksGreen,
    borderColor: Colors.starbucksGreen,
  },
  filterText: {
    marginLeft: 3,
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  activeFilterText: {
    color: Colors.textLight,
  },
  productListContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 200,
  },
  productCardContainer: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 15,
      marginBottom: 10,
    marginTop:35,
    paddingHorizontal: 10,
    borderColor: Colors.borderGray,
      borderWidth: 1,
  },
  searchIcon: {
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: "black",
  },
  clearButton: {
    padding: 5,
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
});

export default MyCategoriesScreen;
