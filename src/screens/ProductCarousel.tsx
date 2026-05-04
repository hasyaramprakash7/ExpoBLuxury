import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  ViewStyle,
} from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import NewProductCard, { Product } from "../components/NewProductCard";
import { Vendor } from "../features/vendor/vendorAuthSlice";

const { width } = Dimensions.get("window");

const Colors = {
  greenDark: "#0A3D2B",
  textDark: "#4A2C2A",
  grayLight: "#DDDDDD",
  grayText: "#555555",
};

// Constants for consistent sizing
const CONTAINER_HORIZONTAL_PADDING = 15; // Padding for the container itself
const CARD_BOTTOM_MARGIN = 15; // NEW: Margin between vertical cards

interface ProductCarouselProps {
  products: Product[];
  title: string;
  noResultsMessage: string;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({
  products,
  title,
  noResultsMessage,
}) => {
  const { allVendors } = useSelector((state: RootState) => state.vendorAuth);
  const vendorMap = React.useMemo(() => {
    const map: { [key: string]: Vendor } = {};
    allVendors?.forEach((vendor) => {
      map[vendor._id] = vendor;
    });
    return map;
  }, [allVendors]);

  if (products.length === 0 && !noResultsMessage) {
    return null;
  }

  // Define the content to be rendered, which is a list of product cards
  const productCards = products.map((item) => {
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
        // Apply vertical card styling
        cardStyle={styles.verticalCard}
      />
    );
  });

  return (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {products.length === 0 ? (
        <Text style={styles.emptyListText}>{noResultsMessage}</Text>
      ) : (
        <ScrollView
          horizontal={false} // KEY CHANGE 1: Set horizontal to false for vertical scrolling
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.verticalProductsContainer} // KEY CHANGE 2: Use new vertical container style
        >
          {productCards}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 20,
    marginBottom: 110,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.greenDark,
    marginBottom: 10,
    marginLeft: 15,
  },
  emptyListText: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
    fontSize: 16,
    width: "100%",
  },
  // NEW: Style for the vertical ScrollView content container
  verticalProductsContainer: {
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    paddingBottom: 20, // Add some space at the bottom of the list
  },
  // NEW: Style for each individual product card in the vertical list
  verticalCard: {
    marginBottom: CARD_BOTTOM_MARGIN,
  },
});

export default ProductCarousel;
