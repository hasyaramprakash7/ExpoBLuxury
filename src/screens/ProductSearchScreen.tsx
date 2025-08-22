import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";

// --- Redux Slices (adjust paths if different in your project) ---
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { fetchUserOrders } from "../features/orders/orderSlice";

// --- Type Definitions ---
import { AppDispatch, RootState } from "../app/store";
// Import Product interface from NewProductCard for type consistency
import { Product } from "../components/NewProductCard";

// Define Vendor interface if not already in a shared types file
// NOTE: Ensure this matches your vendorAuthSlice's Vendor interface
interface Vendor {
  _id: string;
  shopName: string;
  isOnline: boolean;
  // Add other vendor properties as needed, e.g., address for range calculation
  address?: {
    latitude?: number;
    longitude?: number;
    pincode?: string;
    state?: string;
    district?: string;
    country?: string;
  };
  deliveryRange?: number;
}

// --- Your Advanced NewProductCard Component ---
// IMPORTANT: Update NewProductCard to accept a `cardStyle` prop
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
};

// ===================================================================================
// == MAIN SCREEN COMPONENT: ProductSearchScreen
// ===================================================================================
const ProductSearchScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [query, setQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);

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
  const { user } = useSelector((state: RootState) => state.auth);

  const { orders: userOrders, loading: ordersLoading } = useSelector(
    (state: RootState) => state.order
  );

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        dispatch(fetchAllVendorProducts()),
        dispatch(fetchAllVendors()),
        user?._id ? dispatch(fetchUserOrders(user._id)) : Promise.resolve(),
      ]);
    };
    fetchData();
  }, [dispatch, user?._id]);

  // Updated vendorMap to store the full Vendor object
  const vendorMap = useMemo(() => {
    const map: { [key: string]: Vendor } = {}; // Store the whole vendor object
    allVendors?.forEach((vendor) => {
      map[vendor._id] = vendor;
    });
    return map;
  }, [allVendors]);

  useEffect(() => {
    if (!query.trim()) {
      if (user?._id && userOrders?.length > 0 && allProducts?.length > 0) {
        const orderedProductIds = new Set();
        userOrders.forEach((order) =>
          order.items?.forEach((item) => orderedProductIds.add(item.productId))
        );

        const suggestions = allProducts.filter((product) =>
          orderedProductIds.has(product._id)
        );

        if (suggestions.length > 0) {
          setSuggestedProducts(suggestions.slice(0, 8));
        } else {
          setSuggestedProducts(allProducts.slice(0, 8));
        }
      } else if (allProducts?.length > 0) {
        setSuggestedProducts(allProducts.slice(0, 8));
      } else {
        setSuggestedProducts([]);
      }
    } else {
      setSuggestedProducts([]);
    }
  }, [query, user, userOrders, allProducts]);

  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }

    const q = query.toLowerCase();
    let shopMatchVendorId: string | undefined;

    // --- NEW LOGIC: Check if query is an exact match for a shop name ---
    const matchingVendor = Object.values(vendorMap).find(
      (vendor) => vendor.shopName?.toLowerCase() === q
    );

    if (matchingVendor) {
      shopMatchVendorId = matchingVendor._id;
    }
    // --- END NEW LOGIC ---

    const results = allProducts.filter((product) => {
      // --- NEW LOGIC: If a shop name is exactly matched, only show products from that shop ---
      if (shopMatchVendorId) {
        const productVendorId = product.vendorId || product.vendor?._id;
        return productVendorId === shopMatchVendorId;
      }
      // --- END NEW LOGIC ---

      // Otherwise, proceed with the general search logic
      const name = product.name?.toLowerCase() || "";
      const description = product.description?.toLowerCase() || "";

      let categorySearchString = "";
      if (typeof product.category === "string") {
        categorySearchString = product.category.toLowerCase();
      } else if (
        typeof product.category === "object" &&
        product.category !== null &&
        "mainCategory" in product.category
      ) {
        const main =
          (
            product.category as { mainCategory?: string }
          ).mainCategory?.toLowerCase() || "";
        const sub =
          (
            product.category as { subCategory?: string }
          ).subCategory?.toLowerCase() || "";
        categorySearchString = `${main} ${sub}`.trim();
      }

      const tags = (product.tags || [])
        .map((tag) => tag.toLowerCase())
        .join(" ");
      const productVendorId = product.vendorId || product.vendor?._id || "";
      const vendorName =
        vendorMap[productVendorId]?.shopName?.toLowerCase() || "";

      return (
        name.includes(q) ||
        description.includes(q) ||
        categorySearchString.includes(q) ||
        tags.includes(q) ||
        vendorName.includes(q) ||
        product.brand?.toLowerCase().includes(q) ||
        product.companyName?.toLowerCase().includes(q)
      );
    });

    setFilteredProducts(results);
  }, [query, allProducts, vendorMap]);

  const isLoading = productsLoading || vendorsLoading || ordersLoading;

  if (productsError || vendorsError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorMessage}>
          {productsError?.message ||
            vendorsError?.message ||
            "An unknown error occurred."}
        </Text>
        <Text style={styles.errorHint}>Please try refreshing the app.</Text>
      </View>
    );
  }

  // Helper to render product grids (search results, suggestions, all products)
  const renderProductGrid = (
    products: Product[],
    title: string,
    noResultsMessage: string,
    isHorizontal: boolean = false
  ) => {
    if (products.length === 0 && !noResultsMessage) {
      return null;
    }

    const isExactShopSearch = Object.values(vendorMap).some(
      (vendor) =>
        vendor.shopName?.toLowerCase() === query.toLowerCase() &&
        query.trim() !== ""
    );

    const displayTitle = isExactShopSearch
      ? `${query.trim()} Shop Products`
      : title;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{displayTitle}</Text>
        {products.length === 0 ? (
          <Text style={styles.emptyListText}>{noResultsMessage}</Text>
        ) : (
          <ScrollView
            horizontal={isHorizontal}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.productsGridContainer,
              isHorizontal && styles.horizontalProductsContainer,
            ]}
          >
            {products.map((item) => {
              const vendorId = item.vendorId || item.vendor?._id || "";
              const vendorData = vendorMap[vendorId];
              const isVendorOffline = vendorData ? !vendorData.isOnline : true;
              const isVendorOutOfRange = false;

              return (
                <NewProductCard
                  key={item._id}
                  product={item}
                  vendorShopName={vendorData?.shopName || "Unknown Shop"}
                  isVendorOffline={isVendorOffline}
                  isVendorOutOfRange={isVendorOutOfRange}
                  cardStyle={isHorizontal ? styles.horizontalCard : {}}
                />
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  // Helper to render skeleton loading states
  const renderSkeletons = (count: number, isHorizontal: boolean = false) => (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, styles.skeletonTitle]}></Text>
      <ScrollView
        horizontal={isHorizontal}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.productsGridContainer,
          isHorizontal && styles.horizontalProductsContainer,
        ]}
      >
        {[...Array(count)].map((_, i) => (
          <View
            key={i}
            style={[styles.skeletonCard, isHorizontal && styles.horizontalCard]}
          >
            <View style={styles.skeletonImage}></View>
            <View style={styles.skeletonTextLine}></View>
            <View style={[styles.skeletonTextLine, { width: "60%" }]}></View>
            <View style={styles.skeletonButton}></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screenContainer}>
      {/* Search Bar */}
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

      {/* Main content area, uses ScrollView for vertical scrolling of sections */}
      <ScrollView style={styles.mainScrollView}>
        {isLoading ? (
          <>
            {renderSkeletons(4, false)}
            {renderSkeletons(4, true)}
          </>
        ) : (
          <View style={styles.contentContainer}>
            {query.trim() ? (
              renderProductGrid(
                filteredProducts,
                "Search Results",
                `No products found matching "${query}". Try a different search!`,
                false // Keep search results in a vertical grid
              )
            ) : (
              <>
                {suggestedProducts.length > 0 && (
                  <View style={styles.sectionSpacing}>
                    {renderProductGrid(
                      suggestedProducts,
                      user?._id && userOrders?.length > 0
                        ? "Products from Your Past Orders"
                        : "Discover Products",
                      "No recommendations at the moment.",
                      true // Enable horizontal scrolling for suggestions
                    )}
                  </View>
                )}
                {/* The commented out All Products section is now a good candidate
                 * for a new horizontally scrolling list. */}
                {allProducts?.length > 0 && (
                  <View style={styles.sectionSpacing}>
                    {renderProductGrid(
                      allProducts.slice(0, 10), // Limiting for a better UI experience
                      "All Products",
                      "No products available at the moment.",
                      true
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
      {/* Toast message component - place this at the very root of your App.tsx */}
      <Toast />
    </View>
  );
};

// --- STYLES ---
const { width } = Dimensions.get("window");

// Constants for consistent sizing
const CARD_HORIZONTAL_MARGIN = 15; // Spacing between horizontal cards
const CONTAINER_HORIZONTAL_PADDING = 15; // Padding for the container itself
const HORIZONTAL_CARD_WIDTH = width * 1;

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: "#F8F5F0",
    marginBottom: 100,
    
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
  contentContainer: {
    paddingVertical: 15,
    paddingBottom: 0,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionSpacing: {
    marginBottom: 20
    
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.greenDark,
    marginBottom: 10,
    marginLeft: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: Colors.greenLight,
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
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 14,
    color: Colors.grayText,
    textAlign: "center",
  },
  emptyListText: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
    fontSize: 16,
    width: "100%",
  },
  productsGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    paddingVertical: 5,
  },
  horizontalProductsContainer: {
    flexDirection: "row",
    flexWrap: "nowrap", // Prevents wrapping to a new line
    justifyContent: "flex-start",
    paddingLeft: CONTAINER_HORIZONTAL_PADDING,
    paddingRight: HORIZONTAL_CARD_WIDTH + CARD_HORIZONTAL_MARGIN,
  },
  horizontalCard: {
    width: HORIZONTAL_CARD_WIDTH,
    marginRight: CARD_HORIZONTAL_MARGIN,
    marginVertical: 0,
  },
  skeletonCard: {
    width:
      (width - CONTAINER_HORIZONTAL_PADDING * 2 - CARD_HORIZONTAL_MARGIN * 2) /
      2,
    height: 180,
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 8,
    overflow: "hidden",
    padding: 12,
    justifyContent: "space-between",
  },
  skeletonImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#cccccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonTextLine: {
    width: "90%",
    height: 12,
    backgroundColor: "#cccccc",
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonButton: {
    width: "100%",
    height: 38,
    backgroundColor: "#cccccc",
    borderRadius: 8,
  },
  skeletonTitle: {
    backgroundColor: "#e0e0e0",
    width: "50%",
    height: 24,
    borderRadius: 4,
    marginBottom: 10,
    marginLeft: 15,
  },
});

export default ProductSearchScreen;
