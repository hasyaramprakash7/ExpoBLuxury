import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";

// --- Redux Slices & Types ---
import { AppDispatch, RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { Product } from "../components/NewProductCard";

interface Vendor {
  _id: string;
  shopName: string;
  isOnline: boolean;
  address?: {
    latitude?: number;
    longitude?: number;
  };
  deliveryRange?: number;
  shopImage: string;
}

// --- NewProductCard Component ---
import NewProductCard from "../components/NewProductCard";

// --- Color Palette and Constants ---
const Colors = {
  greenDark: "#005612",
  greenPrimary: "#00704A",
  greenSecondary: "#009632",
  greenLight: "#E8F5E9",
  yellowHighlight: "#FFD700",
  textDark: "#4A2C2A",
  textLight: "#FFFFFF",
  grayDark: "#333333",
  grayText: "#555555",
  grayLight: "#DDDDDD",
  redAlert: "#DC2626",
  greenSuccess: "#10B981",
  yellowStar: "#F59E0B",
  backgroundWhite: "#F8F5F0",
};

const { width } = Dimensions.get("window");

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

// Helper function to handle category name formatting
const getCategoryName = (fullCategoryName) => {
  const parts = fullCategoryName.split("_");
  if (fullCategoryName.toLowerCase().includes("hotels")) {
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    }
  }
  return parts[parts.length - 1];
};

// ===================================================================================
// == MAIN SCREEN COMPONENT: ProductSearchScreen
// ===================================================================================
const ProductSearchScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const [query, setQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);

  const {
    allProducts,
    loading: productsLoading,
    error: productsError,
  } = useSelector((state: RootState) => state.vendorProducts);
  const {
    allVendors,
    loading: vendorsLoading,
    error: vendorsError,
  } = useSelector((state: RootState) => state.vendorAuth);

  const fetchUserLocation = useCallback(async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Permission to access location was denied. Please enable it in app settings to see nearby shops."
        );
        Alert.alert(
          "Location Permission Required",
          "This app needs access to your location to show nearby shops. Please enable location services and grant permissions."
        );
        setIsLocationLoading(false);
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });
      setUserLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });
    } catch (locError) {
      console.error("Error fetching user location:", locError);
      setLocationError(
        "Could not get your location. Please check your device's location settings."
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

  const vendorMap = useMemo(() => {
    const map: { [key: string]: Vendor } = {};
    allVendors?.forEach((vendor) => {
      map[vendor._id] = vendor;
    });
    return map;
  }, [allVendors]);

  const inRangeVendors = useMemo(() => {
    if (!allVendors || !userLocation) {
      return [];
    }
    const vendorsWithDistance = allVendors
      .map((vendor) => {
        if (
          !vendor.address ||
          vendor.address.latitude === undefined ||
          vendor.address.longitude === undefined ||
          vendor.deliveryRange === undefined ||
          !vendor.isOnline
        ) {
          return null;
        }
        const distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          vendor.address.latitude,
          vendor.address.longitude
        );
        if (distance <= vendor.deliveryRange) {
          return { ...vendor, distance };
        }
        return null;
      })
      .filter(Boolean);
    return vendorsWithDistance;
  }, [allVendors, userLocation]);

  const inRangeProducts = useMemo(() => {
    if (
      !allProducts ||
      allProducts.length === 0 ||
      !inRangeVendors ||
      inRangeVendors.length === 0
    ) {
      return [];
    }
    const inRangeVendorIds = inRangeVendors.map((vendor) => vendor._id);
    return allProducts.filter((product) =>
      inRangeVendorIds.includes(product.vendorId)
    );
  }, [allProducts, inRangeVendors]);

  const uniqueBrands = useMemo(() => {
    if (!inRangeProducts || inRangeProducts.length === 0) {
      return [];
    }
    const brandsMap = new Map();
    inRangeProducts.forEach((product) => {
      if (product.brandName && !brandsMap.has(product.brandName)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.brandName === product.brandName && p.images && p.images.length > 0
        );
        const imageUrl = firstImageProduct?.images?.[0];
        brandsMap.set(product.brandName, { name: product.brandName, imageUrl });
      }
    });
    return Array.from(brandsMap.values());
  }, [inRangeProducts]);

  const uniqueCategories = useMemo(() => {
    if (!inRangeProducts || inRangeProducts.length === 0) {
      return [];
    }
    const categoriesMap = new Map();
    inRangeProducts.forEach((product) => {
      if (product.category && !categoriesMap.has(product.category)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.category === product.category && p.images && p.images.length > 0
        );
        const imageUrl = firstImageProduct?.images?.[0];
        categoriesMap.set(product.category, {
          name: product.category,
          imageUrl,
        });
      }
    });
    return Array.from(categoriesMap.values());
  }, [inRangeProducts]);

  const hotelsCategory = useMemo(() => {
    return uniqueCategories.filter((cat) =>
      cat.name.toLowerCase().includes("hotels")
    );
  }, [uniqueCategories]);

  const otherCategories = useMemo(() => {
    return uniqueCategories.filter(
      (cat) => !cat.name.toLowerCase().includes("hotels")
    );
  }, [uniqueCategories]);

  // Search logic now filters within in-range products
  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }
    const q = query.toLowerCase();
    const results = inRangeProducts.filter((product) => {
      const name = product.name?.toLowerCase() || "";
      const description = product.description?.toLowerCase() || "";
      const vendorName =
        vendorMap[product.vendorId]?.shopName?.toLowerCase() || "";
      return (
        name.includes(q) ||
        description.includes(q) ||
        vendorName.includes(q) ||
        product.brandName?.toLowerCase().includes(q)
      );
    });
    setFilteredProducts(results);
  }, [query, inRangeProducts, vendorMap]);

  const isLoading = productsLoading || vendorsLoading || isLocationLoading;

  // Renders a vertical grid of items
  const renderVerticalGrid = (
    title: string,
    data: any[],
    onPressItem: (item: any) => void,
    renderItem: (item: any) => React.ReactNode,
    noResultsMessage: string
  ) => {
    if (data.length === 0) {
      return null;
    }
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.verticalGridContainer}>
          {data.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.gridItem}
              onPress={() => onPressItem(item)}
            >
              {renderItem(item)}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Renders the content for a grid item
  const renderGridItemContent = (item, type) => (
    <>
      <Image
        source={{ uri: item.imageUrl || "https://via.placeholder.com/150" }}
        style={styles.gridImage}
      />
      <Text style={styles.gridTitle}>
        {type === "category" ? getCategoryName(item.name) : item.name}
      </Text>
    </>
  );

  const handleBrandPress = (brand) => {
    navigation.navigate("BrandProducts", { brandName: brand.name });
  };

  const handleCategoryPress = (category) => {
    navigation.navigate("CategoryProducts", { categoryName: category.name });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.greenPrimary} />
          <Text style={styles.loadingText}>
            {isLocationLoading
              ? "Finding your location..."
              : "Loading products..."}
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
            Please enable location services and try again.
          </Text>
          <TouchableOpacity
            onPress={fetchUserLocation}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (inRangeProducts.length === 0) {
      return (
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>No Shops Nearby!</Text>
          <Text style={styles.messageText}>
            Looks like no shops are currently delivering to your location.
          </Text>
          <Text style={styles.messageText}>
            Please check back later or adjust your location.
          </Text>
        </View>
      );
    }

    if (query.trim()) {
      // Show search results
      return (
        <View style={styles.productsGridContainer}>
          <Text style={[styles.sectionTitle, { marginLeft: 0 }]}>
            Search Results
          </Text>
          {filteredProducts.length > 0 ? (
            <View style={styles.resultsGrid}>
              {filteredProducts.map((product) => (
                <NewProductCard
                  key={product._id}
                  product={product}
                  vendorShopName={
                    vendorMap[product.vendorId]?.shopName || "Unknown Shop"
                  }
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyListText}>
              {`No products found for "${query}".`}
            </Text>
          )}
        </View>
      );
    } else {
      // Show categorized/branded lists when no query
      return (
        <>
          {renderVerticalGrid(
            "Hotels",
            hotelsCategory,
            handleCategoryPress,
            (item) => renderGridItemContent(item, "category"),
            "No hotels available."
          )}
          {renderVerticalGrid(
            "Brands",
            uniqueBrands,
            handleBrandPress,
            (item) => renderGridItemContent(item, "brand"),
            "No brands available."
          )}
          {renderVerticalGrid(
            "Grocery & Kitchen",
            otherCategories,
            handleCategoryPress,
            (item) => renderGridItemContent(item, "category"),
            "No grocery or kitchen products available."
          )}
        </>
      );
    }
  };

  return (
    <View style={styles.screenContainer}>
      <View style={styles.searchHeader}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products, categories, vendors, or tags..."
          value={query}
          onChangeText={setQuery}
        />
        <Ionicons
          name="search"
          size={20}
          color={Colors.grayText}
          style={styles.searchIcon}
        />
      </View>
      <ScrollView style={styles.mainScrollView}>{renderContent()}</ScrollView>
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    paddingBottom: 50,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#EFEFEF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginRight: 10,
  },
  searchIcon: {
    padding: 8,
  },
  mainScrollView: {
    flex: 1,
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.greenDark,
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.grayText,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 50,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.redAlert,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.grayDark,
    textAlign: "center",
  },
  emptyListText: {
    textAlign: "center",
    marginTop: 20,
    color: Colors.grayText,
    fontSize: 16,
    width: "100%",
  },
  verticalGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: (width - 15 * 2 - 10 * 3) / 4,
    alignItems: "center",
    marginBottom: 15,
  },
  gridImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
  },
  gridTitle: {
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
    color: Colors.textDark,
  },
  productsGridContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom:200,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 50,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textDark,
    marginBottom: 10,
    textAlign: "center",
  },
  messageText: {
    fontSize: 16,
    color: Colors.grayText,
    textAlign: "center",
    marginBottom: 5,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.greenPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textLight,
    fontWeight: "bold",
  },
});

export default ProductSearchScreen;
