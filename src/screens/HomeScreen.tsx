import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { Video, ResizeMode } from "expo-av";
import * as Location from "expo-location";

// --- Redux Slices & Types ---
import { AppDispatch, RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { Product } from "../components/NewProductCard";
import { Vendor } from "../types";

// --- New ProductCarousel component ---
import ProductCarousel from "./ProductCarousel";

// --- Local Video & Image Assets ---
import LocalVideo from "../../assets/Image_to_Video_Generation.mp4";
import LocalVideo1 from "../../assets/Gemino_Luxury_Video_Generation.mp4";
import ShopPlaceholderImage from "../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png";

const { width, height } = Dimensions.get("window");

const Colors = {
  starbucksGreen: "#F8F5F0",
  starbucksDarkGreen: "#009632",
  starbucksGold: "#FFD700",
  textDarkBrown: "#4A2C2A",
  textWhite: "#F8F5F0",
  grayText: "gray",
  borderGray: "#DDDDDD",
  backgroundWhite: "#0a0a09ff",
  redAlert: "#DC2626",
};

// --- Helper function to handle category name formatting ---
const getCategoryName = (fullCategoryName) => {
  const parts = fullCategoryName.split("_");

  if (fullCategoryName.toLowerCase().includes("hotels")) {
    // If it's a hotel category, show the last two words
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    }
  }

  // For all other categories, show only the last word
  return parts[parts.length - 1];
};

// --- FIX: Move helper functions outside the component scope ---
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
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

const shuffleArray = (array: Product[]): Product[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- OrderBox Component (Kept as is) ---
interface OrderBoxProps {
  productVideo: any;
  isLarge?: boolean;
}

const OrderBox: React.FC<OrderBoxProps> = ({ productVideo, isLarge }) => (
  <View
    style={[orderBoxStyles.container, isLarge && orderBoxStyles.containerLarge]}
  >
    <View
      style={[
        orderBoxStyles.visualContainer,
        isLarge && orderBoxStyles.visualContainerLarge,
      ]}
    >
      <Video
        source={productVideo}
        style={orderBoxStyles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <View style={orderBoxStyles.overlay} />
      <View style={orderBoxStyles.bottomBar}>
        <View>{/* Content can be added here if needed */}</View>
      </View>
    </View>
  </View>
);

const orderBoxStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.starbucksGreen,
    marginHorizontal: 0,
    overflow: "hidden",
    width: width,
  },
  containerLarge: {
    height: height * 0.1,
  },
  visualContainer: {
    width: "100%",
    height: height * 0.1,
    justifyContent: "flex-end",
    position: "relative",
  },
  visualContainerLarge: {
    height: height * 0.1,
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: width * 0.04,
    paddingVertical: height * 0.02,
    zIndex: 1,
  },
  productName: {
    color: Colors.textWhite,
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  productPrice: {
    color: Colors.textWhite,
    fontSize: width * 0.04,
    marginTop: 2,
  },
});

// --- Reusable Horizontal Carousel Component ---
interface HorizontalCarouselProps<T> {
  title: string;
  data: T[];
  onPressItem: (item: T) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}

const HorizontalCarousel = <T,>({
  title,
  data,
  onPressItem,
  renderItem,
}: HorizontalCarouselProps<T>) => (
  <View style={homeStyles.carouselSectionContainer}>
    <Text style={homeStyles.carouselSectionTitle}>{title}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={homeStyles.carousel}
    >
      {data.map((item, index) => (
        <TouchableOpacity key={index} onPress={() => onPressItem(item)}>
          {renderItem(item, index)}
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// --- HomeScreen Component ---
const HomeScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();

  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts
  );
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );

  const [shuffledProducts, setShuffledProducts] = useState<Product[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const vendorMap = useMemo(() => {
    const map: { [key: string]: Vendor } = {};
    if (allVendors) {
      allVendors.forEach((vendor) => {
        map[vendor._id] = vendor;
      });
    }
    return map;
  }, [allVendors]);

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
    } catch (locError: any) {
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
      .filter(Boolean)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    return vendorsWithDistance;
  }, [allVendors, userLocation]);

  const uniqueShops = useMemo(() => {
    return inRangeVendors.map((vendor) => ({
      id: vendor._id,
      name: vendor.shopName,
      shopImageUrl: vendor.shopImage,
    }));
  }, [inRangeVendors]);

  // FIX: Filter allProducts by inRangeVendors before processing brands
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

  // FIX: Process brands only from inRangeProducts
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
        const imageUrl = firstImageProduct?.images?.[0]; // FIX: Access element directly
        brandsMap.set(product.brandName, imageUrl);
      }
    });
    return Array.from(brandsMap.entries()).map(([name, imageUrl]) => ({
      name,
      imageUrl,
    }));
  }, [inRangeProducts]);

  // FIX: Process categories only from inRangeProducts
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
        const imageUrl = firstImageProduct?.images?.[0]; // FIX: Access element directly
        categoriesMap.set(product.category, imageUrl);
      }
    });
    return Array.from(categoriesMap.entries()).map(([name, imageUrl]) => ({
      name,
      imageUrl,
    }));
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

  useEffect(() => {
    setShuffledProducts(shuffleArray(inRangeProducts.slice(0, 10)));
  }, [inRangeProducts]);

  const handleProfilePress = () => {
    navigation.navigate("Profile");
  };

  const handleShopListingsPress = () => {
    navigation.navigate("ShopListings");
  };

  const handleShopPress = (shop: { id: string; name: string }) => {
    navigation.navigate("ShopProducts", {
      vendorId: shop.id,
      vendorName: shop.name,
    });
  };

  const handleBrandPress = (brand: {
    name: string;
    imageUrl: string | null;
  }) => {
    navigation.navigate("BrandProducts", { brandName: brand.name });
  };

  const handleCategoryPress = (category: {
    name: string;
    imageUrl: string | null;
  }) => {
    navigation.navigate("CategoryProducts", { categoryName: category.name });
  };

  const isLoading = productsLoading || vendorsLoading || isLocationLoading;

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={homeStyles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.starbucksGreen} />
          <Text style={homeStyles.loadingText}>
            {isLocationLoading
              ? "Finding your location..."
              : "Loading products..."}
          </Text>
        </View>
      );
    }
    if (locationError) {
      return (
        <View style={homeStyles.messageContainer}>
          <Text style={homeStyles.messageTitle}>Location Error</Text>
          <Text style={homeStyles.messageText}>{locationError}</Text>
          <Text style={homeStyles.messageText}>
            Please enable location services and try again.
          </Text>
          <TouchableOpacity
            onPress={fetchUserLocation}
            style={homeStyles.retryButton}
          >
            <Text style={homeStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (uniqueShops.length === 0) {
      return (
        <View style={homeStyles.messageContainer}>
          <Text style={homeStyles.messageTitle}>No Shops Nearby!</Text>
          <Text style={homeStyles.messageText}>
            Looks like no shops are currently delivering to your location.
          </Text>
          <Text style={homeStyles.messageText}>
            Please check back later or adjust your location.
          </Text>
        </View>
      );
    }
    const videoSources = [
      // { source: LocalVideo, isLarge: true },
      { source: LocalVideo1, isLarge: false },
    ];

    return (
      <ScrollView
        style={homeStyles.mainContentScrollView}
        contentContainerStyle={homeStyles.contentContainer}
      >
        {/* Videos Section */}
        {videoSources.map((video, index) => (
          <OrderBox
            key={`video-${index}`}
            productVideo={video.source}
            isLarge={video.isLarge}
          />
        ))}

        {/* Dynamic Shops Carousel */}
        {uniqueShops.length > 0 && (
          <HorizontalCarousel
            title="Shops"
            data={uniqueShops}
            onPressItem={handleShopPress}
            renderItem={(shop) => (
              <View style={homeStyles.imageContainer}>
                <Image
                  source={
                    shop.shopImageUrl && typeof shop.shopImageUrl === "string"
                      ? { uri: shop.shopImageUrl }
                      : ShopPlaceholderImage
                  }
                  style={homeStyles.imageCard}
                />
                <Text style={homeStyles.imageTitle}>{shop.name}</Text>
              </View>
            )}
          />
        )}

        {/* Dynamic Brands Carousel */}
        {uniqueBrands.length > 0 && (
          <HorizontalCarousel
            title="Brands"
            data={uniqueBrands}
            onPressItem={handleBrandPress}
            renderItem={(brand) => (
              <View style={homeStyles.imageContainer}>
                <Image
                  source={
                    brand.imageUrl
                      ? { uri: brand.imageUrl as string }
                      : { uri: "https://via.placeholder.com/150" }
                  }
                  style={homeStyles.imageCard}
                />
                <Text style={homeStyles.imageTitle}>{brand.name}</Text>
              </View>
            )}
          />
        )}

        {/* Hotels Category Section */}
        {hotelsCategory.length > 0 && (
          <HorizontalCarousel
            title="Hotels"
            data={hotelsCategory}
            onPressItem={handleCategoryPress}
            renderItem={(category) => (
              <View style={homeStyles.imageContainer}>
                <Image
                  source={
                    category.imageUrl
                      ? { uri: category.imageUrl as string }
                      : { uri: "https://via.placeholder.com/150" }
                  }
                  style={homeStyles.imageCard}
                />
                <Text style={homeStyles.imageTitle}>
                  {getCategoryName(category.name)}
                </Text>
              </View>
            )}
          />
        )}

        {/* Other Categories Grid */}
        {otherCategories.length > 0 && (
          <View style={homeStyles.carouselSectionContainer}>
            <Text style={homeStyles.carouselSectionTitle}>
              Other Categories
            </Text>
            <View style={homeStyles.gridContainer}>
              {otherCategories.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleCategoryPress(category)}
                  style={homeStyles.gridItem}
                >
                  <Image
                    source={
                      category.imageUrl
                        ? { uri: category.imageUrl as string }
                        : { uri: "https://via.placeholder.com/150" }
                    }
                    style={homeStyles.gridImage}
                  />
                  <Text style={homeStyles.gridTitle}>
                    {getCategoryName(category.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Product Carousel Section */}
        {shuffledProducts.length > 0 && (
          <ProductCarousel
            products={shuffledProducts}
            title="Nearby Products"
            noResultsMessage="No products available in your area."
            isHorizontal={true}
          />
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={homeStyles.safeArea}>
      <View style={homeStyles.container}>
        <View style={homeStyles.header}>
          {/* Location Icon with half-circle background */}
          <View style={homeStyles.locationIconBackground}>
            <TouchableOpacity onPress={handleShopListingsPress}>
              <Ionicons
                name="location-outline"
                size={width * 0.06}
                color={Colors.textWhite}
              />
            </TouchableOpacity>
          </View>

          {/* Profile Icon with half-circle background */}
          <View style={homeStyles.profileIconBackground}>
            <TouchableOpacity onPress={handleProfilePress}>
              <Ionicons
                name="person-circle-outline"
                size={width * 0.08}
                color={Colors.textWhite}
              />
            </TouchableOpacity>
          </View>
        </View>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

const homeStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.textWhite,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.textWhite,
  },
  mainContentScrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
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
    padding: 20,
    backgroundColor: Colors.backgroundWhite,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  messageText: {
    fontSize: 16,
    color: Colors.textDarkBrown,
    textAlign: "center",
    marginBottom: 5,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.starbucksGreen,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textWhite,
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: width * 0.04,
    paddingTop: Platform.OS === "android" ? 40 : 0,
    paddingVertical: height * 0.02,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  // Styles for the location icon's half-circle background
  locationIconBackground: {
    backgroundColor: "#0A3D2B",
    width: width * 0.13, // Adjust width to control the size of the half-circle
    height: width * 0.12, // Maintain a reasonable height
    borderTopRightRadius: width * 0.12,
    borderBottomRightRadius: width * 0.12,
    justifyContent: "center",
    alignItems: "flex-start", // Align icon to the left within the box
    paddingLeft: width * 0.04,
    marginLeft: -width * 0.04, // Use negative margin to "float" it off-screen
  },
  // Styles for the profile icon's half-circle background
  profileIconBackground: {
    backgroundColor: "#0A3D2B",
    width: width * 0.13, // Same width as location
    height: width * 0.12, // Same height
    borderTopLeftRadius: width * 0.12,
    borderBottomLeftRadius: width * 0.12,
    justifyContent: "center",
    alignItems: "flex-end", // Align icon to the right
    paddingRight: width * 0.04,
    marginRight: -width * 0.04, // Use negative margin to "float" it off-screen
  },
  headerIcon: {
    // No specific styling needed
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: width * 0.05,
    fontWeight: "bold",
  },
  profileIcon: {
    // No specific styling needed
  },
  carouselSectionContainer: {
    marginTop: 20,
  },
  carouselSectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  carousel: {
    flexDirection: "row",
    paddingLeft: 20,
    paddingRight: 20,
  },
  imageContainer: {
    marginRight: 15,
    width: width * 0.4,
    alignItems: "center",
  },
  imageCard: {
    width: "100%",
    height: width * 0.3,
    borderRadius: 10,
  },
  imageTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  // New styles for the 2x2 grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  gridItem: {
    width: "45%",
    aspectRatio: 1,
    margin: "2.5%",
    alignItems: "center",
  },
  gridImage: {
    width: "100%",
    height: "80%",
    borderRadius: 10,
  },
  gridTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
});

export default HomeScreen;
