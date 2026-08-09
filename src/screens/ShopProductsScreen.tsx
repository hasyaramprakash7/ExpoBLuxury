import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import Ionicons from "@expo/vector-icons/Ionicons";

import { RootState } from "../app/store";
import NewProductCard from "../components/NewProductCard10"; // Adjust path if needed

const { width } = Dimensions.get("window");

const Colors = {
  backgroundDark: "#0B0C10",
  cardWhite: "#FFFFFF",
  textDark: "#1C1C1E",
  textGray: "#6B7280",
  textLightGray: "#9CA3AF",
  accentGreen: "#1B8C40",
  accentPurple: "#093313",
  dividerGray: "#F3F4F6",
  bgLight: "#F8F9FA",
};

// --- Floating Cart Bar ---
const FloatingCartBar = ({ cartItems, navigation }: any) => {
  const getEffectivePrice = useCallback((product: any, quantity: number) => {
    return product.discountedPrice || product.price || 0;
  }, []);

  const pricingBreakdown = useMemo(() => {
    const discountedSubtotal = cartItems.reduce((sum: number, item: any) => {
      const product = item.productId || {};
      const effectivePrice = getEffectivePrice(product, item.quantity);
      return sum + effectivePrice * item.quantity;
    }, 0);
    return { finalTotal: discountedSubtotal, itemCount: cartItems.length };
  }, [cartItems, getEffectivePrice]);

  if (cartItems.length === 0) return null;

  return (
    <View style={styles.floatingCartBar}>
      <View>
        <Text style={styles.floatingCartLabel}>
          {pricingBreakdown.itemCount} ITEM(S)
        </Text>
        <Text style={styles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.floatingCartButton}
        onPress={() => navigation.navigate("CartScreen")}
      >
        <Text style={styles.floatingCartButtonText}>View Cart ➔</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Main Screen ---
const ShopProductsScreen = () => {
  const route = useRoute<any>();
  const { vendorId } = route.params;
  const navigation = useNavigation<any>();

  // 🔥 Add state for the search bar
  const [searchText, setSearchText] = useState("");

  const { allProducts } = useSelector(
    (state: RootState) => state.vendorProducts,
  );
  const { allVendors } = useSelector((state: RootState) => state.vendorAuth);
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const vendorData = useMemo(
    () => allVendors.find((v) => v._id === vendorId),
    [allVendors, vendorId],
  );

  // 🔥 Updated to filter products based on the search text
  const filteredProducts = useMemo(() => {
    // 1. Get all products for this vendor
    let products = allProducts.filter(
      (p) => (p.vendor?._id || p.vendorId) === vendorId,
    );

    // 2. Filter them if the user typed anything in the search bar
    if (searchText.trim() !== "") {
      const lowercasedSearch = searchText.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(lowercasedSearch) ||
          (p.description &&
            p.description.toLowerCase().includes(lowercasedSearch)),
      );
    }
    return products;
  }, [allProducts, vendorId, searchText]);

  const isVendorOffline = vendorData ? !vendorData.isOnline : true;

  // --- Render The Swiggy Style Vendor Header ---
  const renderHeader = () => (
    <View>
      {/* Dark Background Top Half */}
      <View style={styles.darkTopBackground}>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.cardWhite} />
          </TouchableOpacity>
          {/* Removed Group Order Button from here */}
        </View>
      </View>

      {/* Overlapping White Vendor Card */}
      <View style={styles.vendorCardWrapper}>
        <View style={styles.vendorCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>🏆 Best In Category</Text>
            <Text style={styles.sealText}>
              {" "}
              <Ionicons name="checkmark-circle" size={14} /> Verified Seal
            </Text>
          </View>

          <View style={styles.titleRow}>
            <View>
              <Text style={styles.shopName}>
                {vendorData?.shopName || "Shop Details"}
              </Text>
              <Text style={styles.shopSubtitle}>
                 {vendorData?.address?.district || "Local Area"}
              </Text>
            </View>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingText}>
                4.8 <Ionicons name="star" size={10} />
              </Text>
              <Text style={styles.ratingSub}>1K+ ratings</Text>
            </View>
          </View>
          {/* Removed 50% Off and Divider from here */}
        </View>
      </View>

      {/* Search Section */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          {/* 🔥 Turned into a working TextInput */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search for dishes..."
            placeholderTextColor={Colors.textLightGray}
            value={searchText}
            onChangeText={setSearchText}
          />
          <Ionicons name="search" size={20} color={Colors.textGray} />
        </View>
        {/* Removed Filter Pills from here */}
      </View>
    </View>
  );

  return (
    <View style={styles.mainContainer}>
      <FlatList
        data={filteredProducts}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <NewProductCard product={item} isVendorOffline={isVendorOffline} />
        )}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingBottom: 100,
          backgroundColor: Colors.bgLight,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchText
                ? "No dishes match your search."
                : "No products available for this shop."}
            </Text>
          </View>
        }
      />
      {/* {Object.keys(cartItems).length > 0 && (
        <FloatingCartBar
          cartItems={Object.values(cartItems)}
          navigation={navigation}
        />
      )} */}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: Colors.bgLight },
  darkTopBackground: {
    backgroundColor: Colors.backgroundDark,
    height: 180,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingHorizontal: 16,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vendorCardWrapper: { marginTop: -80, paddingHorizontal: 16 },
  vendorCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  badgeRow: { flexDirection: "row", marginBottom: 12 },
  badgeText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Colors.textDark,
    marginRight: 10,
  },
  sealText: { fontSize: 13, fontWeight: "bold", color: "#2563EB" },
  titleRow: { flexDirection: "row", justifyContent: "space-between" },
  shopName: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.textDark,
    marginBottom: 4,
  },
  shopSubtitle: { fontSize: 13, color: Colors.textGray, fontWeight: "500" },
  ratingBox: { alignItems: "flex-end" },
  ratingText: {
    backgroundColor: Colors.accentGreen,
    color: "#FFF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: "bold",
    fontSize: 13,
  },
  ratingSub: { fontSize: 10, color: Colors.textLightGray, marginTop: 4 },
  filterSection: { padding: 16, backgroundColor: Colors.bgLight },
  searchBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.cardWhite,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textDark,
    paddingVertical: 10,
  },
  floatingCartBar: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: Colors.accentGreen,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingCartLabel: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  floatingCartPrice: { color: "#FFF", fontSize: 18, fontWeight: "bold" },
  floatingCartButton: { flexDirection: "row", alignItems: "center" },
  floatingCartButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { color: Colors.textGray, fontSize: 16 },
});

export default ShopProductsScreen;
