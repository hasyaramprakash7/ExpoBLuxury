import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  RefreshControl,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { addOrUpdateItem } from "../features/cart/cartSlice";
import image from "../../assets/How To Choose The Right E-commerce Platform_ A Guide For Business Growth.jpeg";
import image1 from "../../assets/Gemini_Generated_Image_an9bnuan9bnuan9b.png";

import NewProductCard1 from "../components/NewPeoductCard1";

import { AppDispatch, RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
} from "../features/locationSlice";

const { width, height } = Dimensions.get("window");

const Colors = {
  white: "#FFFFFF",
  lightGray: "#F0F0F0",
  grayText: "gray",
  dark: "#0a0a09ff",
  orange: "#FF6600",
  borderGray: "#DDDDDD",
  redAlert: "#DC2626",
  greenDark: "#0A3D2B",
  lightgreen: "#23df9eff",
};

const getCategoryName = (fullCategoryName) => {
  if (!fullCategoryName) return "";
  return fullCategoryName.replace(/_/g, " ");
};

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

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const TabBarButton = ({ iconName, label, isSelected = false }) => (
  <TouchableOpacity style={allStyles.tabButton}>
    <Ionicons
      name={iconName}
      size={24}
      color={isSelected ? Colors.orange : "gray"}
    />
    <Text
      style={[
        allStyles.tabLabel,
        { color: isSelected ? Colors.orange : "gray" },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const SectionHeader = ({ title, onPress }) => (
  <View style={allStyles.sectionHeader}>
    <Text style={allStyles.sectionTitle}>{title}</Text>
    <TouchableOpacity style={allStyles.seeAllButton} onPress={onPress}>
      <Text style={allStyles.seeAllText}>See All</Text>
      <Ionicons
        name="chevron-forward-outline"
        size={16}
        color={Colors.grayText}
      />
    </TouchableOpacity>
  </View>
);

const FloatingCartBar = () => {
  const navigation = useNavigation();
  const cartItems = useSelector((state) => state.cart.items);

  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 200;
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

  const cartItemsArray = useMemo(() => Object.values(cartItems), [cartItems]);

  const primaryItemName = useMemo(() => {
    if (cartItemsArray.length === 0) return "";
    const firstItem = cartItemsArray[0];
    const productName = firstItem.productId?.name || "Item";

    if (cartItemsArray.length > 1) {
      const uniqueProducts = new Set(
        cartItemsArray.map((item) => item.productId?._id)
      );
      if (uniqueProducts.size > 1) {
        return `${cartItemsArray.length} Items`;
      }
    }
    return productName;
  }, [cartItemsArray]);

  const pricingBreakdown = useMemo(() => {
    const discountedSubtotal = cartItemsArray.reduce((sum, item) => {
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
      itemCount: cartItemsArray.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [cartItemsArray, getEffectivePrice]);

  if (cartItemsArray.length === 0) {
    return null;
  }

  return (
    <View style={allStyles.floatingCartBar}>
      <View style={allStyles.floatingCartTextContainer}>
        <Text style={allStyles.floatingCartLabel}>{primaryItemName}</Text>
        <Text style={allStyles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={allStyles.floatingCartButton}
        onPress={() => navigation.navigate("CartScreen")}
        activeOpacity={0.8}
      >
        <Text style={allStyles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const ImageBanner = ({ imageUrl, onPress }) => (
  <TouchableOpacity onPress={onPress} style={allStyles.imageBannerContainer}>
    <Image source={imageUrl} style={allStyles.imageBanner} resizeMode="cover" />
  </TouchableOpacity>
);

const HomeScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const { location: userLocation, loading: isLocationLoading } = useSelector(
    (state) => state.location
  );
  const locationError = useSelector((state) => state.location.error);
  const { allProducts, loading: productsLoading } = useSelector(
    (state) => state.vendorProducts
  );
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state) => state.vendorAuth
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [numRecommendedProducts, setNumRecommendedProducts] = useState(10);

  const fetchUserLocation = useCallback(async () => {
    dispatch(fetchLocationStart());
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dispatch(
          fetchLocationFailure(
            "Permission to access location was denied. Please enable it in app settings to see nearby shops."
          )
        );
        Alert.alert(
          "Location Permission Required",
          "This app needs access to your location to show nearby shops. Please enable location services and grant permissions."
        );
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });
      dispatch(
        fetchLocationSuccess({
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        })
      );
    } catch (locError) {
      console.error("Error fetching user location:", locError);
      dispatch(
        fetchLocationFailure(
          "Could not get your location. Please check your device's location settings."
        )
      );
    }
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchAllVendors()),
        dispatch(fetchAllVendorProducts()),
        fetchUserLocation(),
      ]);
      setNumRecommendedProducts(10); // Reset count on refresh
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, fetchUserLocation]);

  useEffect(() => {
    if (!userLocation && !isLocationLoading) {
      fetchUserLocation();
    }
    if (!allVendors || allVendors.length === 0) {
      dispatch(fetchAllVendors());
    }
    if (!allProducts || allProducts.length === 0) {
      dispatch(fetchAllVendorProducts());
    }
  }, [
    dispatch,
    fetchUserLocation,
    allVendors,
    allProducts,
    userLocation,
    isLocationLoading,
  ]);

  const inRangeVendors = useMemo(() => {
    if (!allVendors || !userLocation) {
      return [];
    }
    const approvedVendors = allVendors.filter((vendor) => vendor.isApproved);
    const vendorsWithDistance = approvedVendors
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

  const inRangeProducts = useMemo(() => {
    if (!allProducts || !inRangeVendors || inRangeVendors.length === 0) {
      return [];
    }
    const inRangeVendorIds = inRangeVendors.map((vendor) => vendor._id);
    return allProducts.filter((product) =>
      inRangeVendorIds.includes(product.vendorId)
    );
  }, [allProducts, inRangeVendors]);

  const uniqueShops = useMemo(() => {
    return inRangeVendors.map((vendor) => ({
      id: vendor._id,
      name: vendor.shopName,
      shopImageUrl: vendor.shopImage,
      distance: vendor.distance,
      address: vendor.address,
    }));
  }, [inRangeVendors]);

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
        brandsMap.set(product.brandName, {
          name: product.brandName,
          imageUrl,
        });
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

  const topDeals = useMemo(() => {
    return shuffleArray(inRangeProducts.slice(0, 5));
  }, [inRangeProducts]);

  const handleShopPress = (shop) => {
    navigation.navigate("ShopProducts", {
      vendorId: shop.id,
      vendorName: shop.name,
    });
  };

  const handleBrandPress = (brand) => {
    navigation.navigate("BrandProducts", { brandName: brand.name });
  };

  const handleCategoryPress = (category) => {
    navigation.navigate("CategoryProducts", { categoryName: category.name });
  };

  // Handlers for the ad banners
  const handleAdPress = () => {
    navigation.navigate("ShopListings");
  };

  const handleAdPress1 = () => {
    navigation.navigate("InsuranceProductsAndDetails");
  };

  // NEW: Handler for the free shipping banner
  const handleFreeShippingBannerPress = () => {
    navigation.navigate("InsuranceProductsAndDetails");
  };

  const handleSearchPress = () => {
    navigation.navigate("Search");
  };

  const handleCartPress = () => {
    navigation.navigate("CartScreen");
  };

  const handleProfilePress = () => {
    navigation.navigate("Profile");
  };

  const handleProductPress = (product) => {
    navigation.navigate("ProductDetails", { product });
  };

  const handleSeeAllPress = (sectionTitle) => {
    if (sectionTitle === "Top Deals" && topDeals.length > 0) {
      navigation.navigate("CategoryProducts", {
        categoryName: topDeals[0]?.category,
      });
    } else if (sectionTitle === "Hotels" && hotelsCategory.length > 0) {
      navigation.navigate("CategoryProducts", { categoryName: "Hotels" });
    } else if (sectionTitle === "Nearby Shops") {
      navigation.navigate("ShopListings");
    } else if (sectionTitle === "Popular Brands" && uniqueBrands.length > 0) {
      navigation.navigate("BrandProducts", {
        brandName: uniqueBrands[0]?.name,
      });
    } else if (sectionTitle === "Product Categories" && otherCategories.length > 0) {
      navigation.navigate("CategoryProducts", {
        categoryName: otherCategories[0]?.name,
      });
    }
  };

  const onScrollEnd = (event, sectionTitle) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtEnd =
      contentOffset.x >= contentSize.width - layoutMeasurement.width - 1;
    if (isAtEnd) {
      handleSeeAllPress(sectionTitle);
    }
  };

  const handleRecommendedScroll = ({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const isCloseToBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;

    if (isCloseToBottom && numRecommendedProducts < inRangeProducts.length) {
      setNumRecommendedProducts((prev) => Math.min(prev + 10, inRangeProducts.length));
    }
  };


  const isLoading = productsLoading || vendorsLoading || isLocationLoading;
  const cartItems = useSelector((state) => state.cart.items);
  const isCartEmpty = Object.keys(cartItems).length === 0;

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={allStyles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={allStyles.loadingText}>
            {isLocationLoading
              ? "Finding your location..."
              : "Loading products..."}
          </Text>
        </View>
      );
    }
    if (locationError) {
      return (
        <View style={allStyles.messageContainer}>
          <Text style={allStyles.messageTitle}>Location Error</Text>
          <Text style={allStyles.messageText}>{locationError}</Text>
          <TouchableOpacity
            onPress={fetchUserLocation}
            style={allStyles.retryButton}
          >
            <Text style={allStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (inRangeProducts.length === 0) {
      return (
        <View style={allStyles.messageContainer}>
          <Text style={allStyles.messageTitle}>No Products Nearby!</Text>
          <Text style={allStyles.messageText}>
            Looks like no products are currently available in your area.
          </Text>
          <TouchableOpacity onPress={onRefresh} style={allStyles.retryButton}>
            <Text style={allStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        style={allStyles.mainContentScrollView}
        contentContainerStyle={[
          allStyles.contentContainer,
          !isCartEmpty && { paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark}
            colors={[Colors.dark]}
          />
        }
        onScroll={handleRecommendedScroll}
        scrollEventThrottle={16}
      >
    
        <ImageBanner
          imageUrl={image1}
          onPress={handleAdPress1}
        />
            {/* First Order Banner */}
        <TouchableOpacity
          style={allStyles.freeShippingBanner}
          onPress={handleFreeShippingBannerPress}
        >
          <View style={allStyles.bannerTextContainer}>
            <Text style={allStyles.bannerTitle}>
              <Text style={allStyles.bannerTitleBold}>
               TATA ALA   10 % Returns 
              </Text>
            </Text>
            <Text style={allStyles.bannerSubtitle}>
              Unlock exclusive perks with Savings Booster
            </Text>
          </View>
          <Ionicons
            name="arrow-forward-outline"
            size={24}
            color={Colors.dark}
          />
        </TouchableOpacity>


        {topDeals.length > 0 && (
          <View style={allStyles.horizontalSection}>
            <SectionHeader
              title="Top Deals"
              onPress={() => handleSeeAllPress("Top Deals")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={allStyles.horizontalScrollContainer}
              onScrollEndDrag={(event) => onScrollEnd(event, "Top Deals")}
            >
              {topDeals.map((product) => (
                <View key={product._id} style={allStyles.horizontalItemContainer}>
                  <NewProductCard1
                    product={product}
                    isVendorOffline={false} // Assuming online for top deals
                    isVendorOutOfRange={false} // Assuming in range for top deals
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {hotelsCategory.length > 0 && (
          <View style={allStyles.horizontalSection}>
            <SectionHeader
              title="Hotels"
              onPress={() => handleSeeAllPress("Hotels")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={allStyles.horizontalScrollContainer}
              onScrollEndDrag={(event) => onScrollEnd(event, "Hotels")}
            >
              {hotelsCategory.slice(0, 4).map((hotel, index) => (
                <TouchableOpacity
                  key={index}
                  style={allStyles.topDealCard}
                  onPress={() => handleCategoryPress(hotel)}
                >
                  <View style={allStyles.superBadge}>
                    <Text style={allStyles.superBadgeText}>Super</Text>
                  </View>
                  <Image
                    source={{
                      uri: hotel.imageUrl || "https://via.placeholder.com/150",
                    }}
                    style={allStyles.topDealImage}
                  />
                  <View style={allStyles.topDealInfo}>
                    <Text style={allStyles.topDealName} numberOfLines={1}>
                      {getCategoryName(hotel.name)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {uniqueShops.length > 0 && (
          <View style={allStyles.horizontalSection}>
            <SectionHeader
              title="Nearby Shops"
              onPress={() => handleSeeAllPress("Nearby Shops")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={allStyles.horizontalScrollContainer}
              onScrollEndDrag={(event) => onScrollEnd(event, "Nearby Shops")}
            >
              {uniqueShops.slice(0, 4).map((shop, index) => (
                <TouchableOpacity
                  key={index}
                  style={allStyles.topDealCard}
                  onPress={() => handleShopPress(shop)}
                >
                  <View style={allStyles.superBadge}>
                    <Text style={allStyles.superBadgeText}>Super</Text>
                  </View>
                  <Image
                    source={{
                      uri:
                        shop.shopImageUrl || "https://via.placeholder.com/150",
                    }}
                    style={allStyles.topDealImage}
                  />
                  <View style={allStyles.topDealInfo}>
                    <Text style={allStyles.topDealName} numberOfLines={1}>
                      {shop.name}
                    </Text>
                    <Text style={allStyles.topDealMinOrder}>
                      {shop.distance.toFixed(2)} km
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {uniqueBrands.length > 0 && (
          <View style={allStyles.horizontalSection}>
            <SectionHeader
              title="Popular Brands"
              onPress={() => handleSeeAllPress("Popular Brands")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={allStyles.horizontalScrollContainer}
              onScrollEndDrag={(event) => onScrollEnd(event, "Popular Brands")}
            >
              {uniqueBrands.slice(0, 4).map((brand, index) => {
                const productForBrand = inRangeProducts.find(
                  (p) => p.brandName === brand.name
                );
                if (!productForBrand) return null;
                const vendorForProduct = inRangeVendors.find(v => v._id === productForBrand.vendorId);
                const isVendorOffline = vendorForProduct ? !vendorForProduct.isOnline : false;
                const isVendorOutOfRange = vendorForProduct ? vendorForProduct.distance > vendorForProduct.deliveryRange : false;

                return (
                  <View key={index} style={allStyles.horizontalItemContainer}>
                    <NewProductCard1
                      product={productForBrand}
                      isVendorOffline={isVendorOffline}
                      isVendorOutOfRange={isVendorOutOfRange}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {otherCategories.length > 0 && (
          <View style={allStyles.horizontalSection}>
            <SectionHeader
              title="Product Categories"
              onPress={() => handleSeeAllPress("Product Categories")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={allStyles.horizontalScrollContainer}
              onScrollEndDrag={(event) => onScrollEnd(event, "Product Categories")}
            >
              {otherCategories.slice(0, 4).map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={allStyles.topDealCard}
                  onPress={() => handleCategoryPress(category)}
                >
                  <View style={allStyles.superBadge}>
                    <Text style={allStyles.superBadgeText}>Super</Text>
                  </View>
                  <Image
                    source={{
                      uri:
                        category.imageUrl || "https://via.placeholder.com/150",
                    }}
                    style={allStyles.topDealImage}
                  />
                  <View style={allStyles.topDealInfo}>
                    <Text style={allStyles.topDealName} numberOfLines={1}>
                      {getCategoryName(category.name)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {inRangeProducts.length > 0 && (
          <View style={allStyles.gridSection}>
            <SectionHeader title="Recommended for you" />
            <View style={allStyles.productGridContainer}>
              {inRangeProducts.slice(0, numRecommendedProducts).map((product) => {
                const vendor = inRangeVendors.find(
                  (v) => v._id === product.vendorId
                );
                const isVendorOffline = vendor ? !vendor.isOnline : false;
                const isVendorOutOfRange = vendor
                  ? vendor.distance > vendor.deliveryRange
                  : false;

                return (
                  <View key={product._id} style={allStyles.itemContainer}>
                    <NewProductCard1
                      product={product}
                      isVendorOffline={isVendorOffline}
                      isVendorOutOfRange={isVendorOutOfRange}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={allStyles.safeArea}>
      <View style={allStyles.container}>
        {/* Main Header with Search Bar and Icons */}
        <View style={allStyles.mainHeader}>
          <View style={allStyles.searchBarContainer}>
            <TouchableOpacity
              onPress={handleSearchPress}
              style={allStyles.searchBar}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={Colors.grayText}
              />
              <Text style={allStyles.searchPlaceholder}>55 inch smart tv</Text>
            </TouchableOpacity>
            <TouchableOpacity style={allStyles.cameraButton}>
              <Ionicons name="search" size={24} color={Colors.grayText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={allStyles.cartButton}
              onPress={handleCartPress}
            >
              <Ionicons name="cart-outline" size={24} color={Colors.grayText} />
              {Object.keys(cartItems).length > 0 && (
                <View style={allStyles.cartBadge}>
                  <Text style={allStyles.cartBadgeText}>
                    {Object.keys(cartItems).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={allStyles.profileButton}
              onPress={handleProfilePress}
            >
              <Ionicons
                name="person-circle-outline"
                size={24}
                color={Colors.grayText}
              />
            </TouchableOpacity>
          </View>
        </View>

        {renderContent()}

        {!isCartEmpty && <FloatingCartBar />}
      </View>
    </SafeAreaView>
  );
};

const allStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },
  mainHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: 15,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  headerTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  headerTabText: {
    color: Colors.grayText,
    fontSize: 14,
    marginHorizontal: 8,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.lightGray,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  searchPlaceholder: {
    color: Colors.grayText,
    marginLeft: 8,
  },
  cameraButton: {},
  cartButton: {
    marginLeft: 10,
    position: "relative",
  },
  profileButton: {
    marginLeft: 10,
  },
  cartBadge: {
    position: "absolute",
    right: -6,
    top: -6,
    backgroundColor: Colors.redAlert,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  mainContentScrollView: {
    flex: 1,
    backgroundColor: "#F8F5F0",
  },
  contentContainer: {
    paddingBottom: 60,
  },
  freeShippingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    marginHorizontal: 10,
    marginTop: 10,
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    color: Colors.dark,
  },
  bannerTitleBold: {
    fontWeight: "bold",
    color: Colors.orange,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: Colors.grayText,
  },
  imageBannerContainer: {
    width: "100%",
    height: 250,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  imageBanner: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  categoriesSection: {
    paddingVertical: 10,
    backgroundColor: Colors.white,
    marginTop: 10,
  },
  categoriesScrollContainer: {
    paddingHorizontal: 10,
  },
  categoryBlock: {
    width: 100,
    height: 100,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  categoryBlockText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
    color: Colors.dark,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.dark,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    color: Colors.grayText,
    marginRight: 2,
  },
  horizontalSection: {
    marginTop: 10,
    backgroundColor: Colors.white,
    paddingVertical: 10,
  },
  horizontalScrollContainer: {
    paddingHorizontal: 10,
  },
  // New style for horizontal NewProductCard1
  horizontalItemContainer: {
    width: width * 0.43,
    marginRight: 10,
  },
  topDealCard: {
    width: width * 0.35,
    height: width * 0.5,
    backgroundColor: Colors.white,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    overflow: "hidden",
    position: "relative",
  },
  topDealImage: {
    width: "100%",
    height: "60%",
    resizeMode: "cover",
  },
  topDealInfo: {
    padding: 8,
    justifyContent: "space-between",
    flex: 1,
  },
  topDealName: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.dark,
  },
  topDealPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.greenDark,
    marginRight: 5,
  },
  topDealMinOrder: {
    fontSize: 12,
    color: Colors.grayText,
  },
  superBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: Colors.redAlert,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  superBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  gridSection: {
    marginTop: 10,
    backgroundColor: Colors.white,
    paddingVertical: 10,
  },
  productGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  itemContainer: {
    width: "48%",
    marginBottom: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.dark,
  },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.dark,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    textAlign: "center",
    color: Colors.grayText,
    marginBottom: 5,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.orange,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 10 : 10,
    left: 15,
    right: 15,
    backgroundColor: Colors.greenDark,
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
  },
  floatingCartTextContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  floatingCartLabel: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 2,
  },
  floatingCartPrice: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  floatingCartButton: {
    backgroundColor: Colors.white,
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
    color: Colors.greenDark,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 60,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  discountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Colors.redAlert,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 5,
  },
});
export default HomeScreen;