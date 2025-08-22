import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import NewProductCard from "../components/NewProductCard";
import { Product, Vendor } from "../types";

const { width } = Dimensions.get("window");

// --- Color Palette ---
const Colors = {
  starbucksGreen: "#0A3D2B",
  backgroundWhite: "#F8F5F0",
  textDarkBrown: "#4A2C2A",
  textGray: "gray",
  borderGray: "#DDDDDD",
  redAlert: "#DC2626",
  textLight: "#FFFFFF",
};

interface OrderScreenContentProps {
  loading: boolean;
  error: any;
  viewMode: "vendor" | "category";
  setViewMode: (mode: "vendor" | "category") => void;
  productsToDisplay: { [key: string]: Product[] };
  allVendors: Vendor[] | null;
  isVendorWithinRange: (vendorId?: string) => boolean;
  setShowFilterModal: (visible: boolean) => void;
}

const OrderScreenContent: React.FC<OrderScreenContentProps> = ({
  loading,
  error,
  viewMode,
  setViewMode,
  productsToDisplay,
  allVendors,
  isVendorWithinRange,
  setShowFilterModal,
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.starbucksGreen} />
        <Text style={styles.loadingText}>Loading products, please wait...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTextTitle}>Oops! Error Loading Products</Text>
        <Text style={styles.errorText}>
          {typeof error === "string"
            ? error
            : error instanceof Error
            ? error.message
            : JSON.stringify(error)}
        </Text>
        <Text style={styles.errorTextSmall}>
          Please try refreshing the page or check your internet connection.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollViewContent}>
      <View style={styles.topFilterBar}>
        <View style={styles.topFilterModeToggle}>
          <TouchableOpacity
            onPress={() => setViewMode("vendor")}
            style={[
              styles.topFilterModeButton,
              viewMode === "vendor" && styles.topFilterModeButtonActive,
            ]}
          >
            <Ionicons
              name="business-outline"
              size={16}
              color={
                viewMode === "vendor" ? Colors.textLight : Colors.textDarkBrown
              }
            />
            <Text
              style={[
                styles.topFilterModeText,
                viewMode === "vendor" && styles.topFilterModeTextActive,
              ]}
            >
              Shop
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("category")}
            style={[
              styles.topFilterModeButton,
              viewMode === "category" && styles.topFilterModeButtonActive,
            ]}
          >
            <Ionicons
              name="pricetag-outline"
              size={16}
              color={
                viewMode === "category"
                  ? Colors.textLight
                  : Colors.textDarkBrown
              }
            />
            <Text
              style={[
                styles.topFilterModeText,
                viewMode === "category" && styles.topFilterModeTextActive,
              ]}
            >
              Categories
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => setShowFilterModal(true)}
          style={styles.filterButton}
        >
          <Ionicons
            name="filter-outline"
            size={20}
            color={Colors.starbucksGreen}
          />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {Object.entries(productsToDisplay)
        .sort(([nameA], [nameB]) => {
          const allKey = viewMode === "vendor" ? "All Shops" : "All Products";
          if (nameA === allKey) return -1;
          if (nameB === allKey) return 1;

          if (viewMode === "vendor") {
            const isAOnline = allVendors?.find(
              (v) => v.shopName === nameA
            )?.isOnline;
            const isBOnline = allVendors?.find(
              (v) => v.shopName === nameB
            )?.isOnline;
            if (isAOnline && !isBOnline) return -1;
            if (!isAOnline && isBOnline) return 1;
          }
          return nameA.localeCompare(nameB);
        })
        .map(([name, products]) => {
          if (
            products.length === 0 &&
            name !== (viewMode === "vendor" ? "All Shops" : "All Products")
          ) {
            return null;
          }

          const isSectionVendorOffline =
            viewMode === "vendor" &&
            name !== "All Shops" &&
            allVendors?.find((v) => v.shopName === name)?.isOnline === false;

          const vendorId = allVendors?.find((v) => v.shopName === name)?._id;
          const isSectionVendorOutOfRange =
            viewMode === "vendor" &&
            name !== "All Shops" &&
            !isVendorWithinRange(vendorId);

          return (
            <View key={name} style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={
                    viewMode === "vendor"
                      ? "business-outline"
                      : "pricetag-outline"
                  }
                  size={24}
                  color={Colors.textDarkBrown}
                />
                <Text style={styles.sectionTitle}>{name}</Text>
                {isSectionVendorOffline && (
                  <Text style={styles.vendorStatusOffline}>Offline</Text>
                )}
                {isSectionVendorOutOfRange && !isSectionVendorOffline && (
                  <Text style={styles.vendorStatusOutOfRange}>
                    Out of Range
                  </Text>
                )}
              </View>

              {products.length === 0 ? (
                <Text style={styles.noProductsText}>
                  No products found for this {viewMode} within the selected
                  criteria.{"\n"}Try adjusting your filters.
                </Text>
              ) : (
                // Changed this from ScrollView to View
                <View style={styles.productsGrid}>
                  {products.map((product) => {
                    const productVendorId =
                      product.vendor?._id || product.vendorId;
                    const vendorData = allVendors?.find(
                      (v) => v._id === productVendorId
                    );
                    const isProductVendorOffline =
                      vendorData?.isOnline === false;
                    const isProductVendorOutOfRange =
                      !isVendorWithinRange(productVendorId);
                    return (
                      <NewProductCard
                        key={product._id}
                        product={product}
                        isVendorOffline={isProductVendorOffline}
                        isVendorOutOfRange={isProductVendorOutOfRange}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.backgroundWhite,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textDarkBrown,
    marginTop: 10,
  },
  errorContainer: {
    backgroundColor: Colors.redAlert,
    marginHorizontal: 10,
    marginTop: 20,
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  errorTextTitle: {
    fontWeight: "bold",
    fontSize: 20,
    color: Colors.textLight,
    marginBottom: 5,
  },
  errorText: { color: Colors.textLight, textAlign: "center", marginTop: 5 },
  errorTextSmall: { fontSize: 12, color: Colors.textLight, marginTop: 10 },
  scrollViewContent: { paddingBottom: 150 },
  topFilterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.backgroundWhite,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  topFilterModeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.borderGray,
    borderRadius: 8,
    overflow: "hidden",
  },
  topFilterModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  topFilterModeButtonActive: { backgroundColor: Colors.starbucksGreen },
  topFilterModeText: {
    fontSize: 14,
    marginLeft: 5,
    color: Colors.textDarkBrown,
  },
  topFilterModeTextActive: { color: Colors.textLight },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundWhite,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.starbucksGreen,
  },
  filterButtonText: {
    fontSize: 16,
    color: Colors.starbucksGreen,
    marginLeft: 5,
    fontWeight: "600",
  },
  sectionContainer: {
    margin: 4,
    padding: 4,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
    marginLeft: 8,
  },
  vendorStatusOffline: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.redAlert,
    borderRadius: 15,
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textLight,
  },
  vendorStatusOutOfRange: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.redAlert,
    borderRadius: 15,
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textLight,
  },
  noProductsText: {
    color: Colors.textGray,
    textAlign: "center",
    paddingVertical: 30,
    fontSize: 16,
  },
  // Updated styles for vertical grid layout
  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 5,
  },
});

export default OrderScreenContent;
