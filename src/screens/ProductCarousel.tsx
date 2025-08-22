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
const CARD_HORIZONTAL_MARGIN = 15; // Spacing between horizontal cards
const CONTAINER_HORIZONTAL_PADDING = 15; // Padding for the container itself
const HORIZONTAL_CARD_WIDTH = width * 4; // Making cards wider

interface ProductCarouselProps {
  products: Product[];
  title: string;
  noResultsMessage: string;
  isHorizontal?: boolean;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({
  products,
  title,
  noResultsMessage,
  isHorizontal = true,
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

  return (
    <View style={styles.sectionContainer}>
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
            const isVendorOutOfRange = false; // Add your logic here if needed

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

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop:20,
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
  productsGridContainer: {
    paddingLeft: CONTAINER_HORIZONTAL_PADDING,
    paddingRight: CONTAINER_HORIZONTAL_PADDING,
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
});

export default ProductCarousel;
