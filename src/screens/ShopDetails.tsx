import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Image,
  TouchableOpacity,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Product } from "../types";
import { RootState } from "../app/store";

const { width } = Dimensions.get("window");
const cardWidth = (width - 48) / 2;

const ShopDetails = () => {
  const route = useRoute();
  const { vendorId, vendorName } = route.params as {
    vendorId: string;
    vendorName: string;
  };

  const { products, loading, error } = useSelector((state: RootState) => {
    const allProducts = state.vendorProducts?.allProducts || [];
    const filteredProducts = allProducts.filter(
      (p) => (p.vendor?._id || p.vendorId) === vendorId
    );
    return {
      products: filteredProducts,
      loading: state.vendorProducts?.loading || false,
      error: state.vendorProducts?.error || null,
    };
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00704A" />
        <Text style={styles.messageText}>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noProductsText}>
          No products found for this shop.
        </Text>
      </View>
    );
  }

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard}>
      {item.images && item.images.length > 0 ? (
        <Image
          source={{ uri: item.images[0].url }}
          style={styles.productImage}
        />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
        <Text style={styles.productStock}>
          {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.shopName}>{vendorName}</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        renderItem={renderProductItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },
  listContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  row: {
    flex: 1,
    justifyContent: "space-between",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  shopName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4A2C2A",
    padding: 16,
    textAlign: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
  },
  productCard: {
    width: cardWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    margin: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  productImage: {
    width: "100%",
    height: cardWidth,
    resizeMode: "cover",
  },
  productImagePlaceholder: {
    width: "100%",
    height: cardWidth,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "#888",
  },
  cardContent: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4A2C2A",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: "#00704A",
    fontWeight: "600",
  },
  productStock: {
    fontSize: 12,
    color: "gray",
    marginTop: 4,
  },
  messageText: {
    marginTop: 10,
    fontSize: 16,
    color: "#4A2C2A",
  },
  errorText: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
  },
  noProductsText: {
    fontSize: 16,
    color: "gray",
    textAlign: "center",
  },
});

export default ShopDetails;
