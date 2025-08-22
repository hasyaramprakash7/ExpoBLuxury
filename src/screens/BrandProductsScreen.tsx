import React, { useMemo } from "react";
import { View, StyleSheet, Text, ScrollView, Dimensions } from "react-native";
import { useSelector } from "react-redux";
import { useRoute, RouteProp } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Redux & Types ---
import { RootState } from "../app/store";
import { Product } from "../components/NewProductCard";
import NewProductCard from "../components/NewProductCard";

// --- Type Definitions ---
type BrandProductsRouteParams = {
  brandName: string;
};

type BrandProductsScreenRouteProp = RouteProp<
  { BrandProducts: BrandProductsRouteParams },
  "BrandProducts"
>;

// Assuming you have a central place for your color palette
const Colors = {
  luxuryBackground: "#E0E0E0", // A light, beige-like color to match the image
  luxuryTextPrimary: "#0A0A0A",
  textDarkBrown: "#0A0A0A",
  cardBackground: "#FFFFFF", // White background for the cards
};

const { width } = Dimensions.get("window");

const BrandProductsScreen = () => {
  const route = useRoute<BrandProductsScreenRouteProp>();
  const { brandName } = route.params;

  const allProducts = useSelector(
    (state: RootState) => state.vendorProducts.allProducts
  );
  const loading = useSelector(
    (state: RootState) => state.vendorProducts.loading
  );

  const brandProducts = useMemo(() => {
    if (!allProducts || allProducts.length === 0) {
      return [];
    }
    return allProducts.filter(
      (product: Product) => product.brandName === brandName
    );
  }, [allProducts, brandName]);

  const renderProductCard = (product: Product) => (
    <View key={product._id} style={styles.cardWrapper}>
      <NewProductCard
        product={product}
        // Add other necessary props here
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{brandName} Products</Text>
      </View>
      {loading ? (
        <Text style={styles.loadingText}>Loading products...</Text>
      ) : brandProducts.length > 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {brandProducts.map(renderProductCard)}
        </ScrollView>
      ) : (
        <Text style={styles.noResultsText}>
          No products found for the brand {brandName}.
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.luxuryBackground,
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 20,
    color: Colors.textDarkBrown,
  },
  noResultsText: {
    textAlign: "center",
    marginTop: 20,
    color: Colors.textDarkBrown,
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 15, // Spacing on the sides of the list
  },
  cardWrapper: {
    width: "100%",
    marginBottom: 20,
    // The image seems to have a subtle shadow, which you might add here
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
    // elevation: 2,
    borderRadius: 10, // Matching the rounded corners in the image
    overflow: "hidden", // Ensures the child component respects the border radius
    backgroundColor: Colors.cardBackground, // A distinct background for the card
  },
});

export default BrandProductsScreen;
