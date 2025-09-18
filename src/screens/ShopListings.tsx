import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  SafeAreaView,
  Image,
  TextInput,
  RefreshControl,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { RootState } from "../app/store";
import { Vendor } from "../types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Placeholder image for shops without a profile picture.
const ShopPlaceholderImage = require("../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png");

const { width } = Dimensions.get("window");

const Colors = {
  textDarkBrown: "#4A2C2A",
  grayText: "#6B7280",
  lightGrayBackground: "#F3F4F6",
  borderGray: "#E5E7EB",
  redAlert: "#DC2626",
  greenButton: "#009632",
  textWhite: "#F8F5F0",
  purple: "#6A2A96",
  lightBlue: "#E0F7FA",
  accentGreen: "#009632",
};

// --- Haversine Distance Calculation Function ---
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

// --- Shop Card Component matching the UI ---
const ShopCard: React.FC<{
  shop: Vendor & { distance: number; productsCount: number };
  onPress: () => void;
}> = ({ shop, onPress }) => {
  const hasProducts = shop.productsCount > 0;
  const hasPhone = shop.phoneNumber && shop.phoneNumber.length > 0;

  return (
    <TouchableOpacity
      style={shopCardStyles.cardContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header Section */}
      <View style={shopCardStyles.headerRow}>
        <View style={shopCardStyles.headerLeft}>
          {shop.shopImage ? (
            <Image
              source={{ uri: shop.shopImage }}
              style={shopCardStyles.logo}
            />
          ) : (
            <View style={[shopCardStyles.logo, shopCardStyles.placeholderLogo]}>
              <Text style={shopCardStyles.placeholderText}>
                {shop.shopName.charAt(0)}
              </Text>
            </View>
          )}
          <View style={shopCardStyles.headerText}>
            <Text style={shopCardStyles.shopName}>{shop.shopName}</Text>
            <View style={shopCardStyles.localSellerTag}>
              <Text style={shopCardStyles.localSellerText}>Local Seller</Text>
            </View>
            {hasPhone && (
              <Text style={shopCardStyles.phone}>
                <Ionicons
                  name="call-outline"
                  size={12}
                  color={Colors.grayText}
                />{" "}
                {shop.phoneNumber}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* POS and Products Count Section */}
      <View style={shopCardStyles.infoRow}>
        <Text style={shopCardStyles.infoText}>
          Number of POSs: <Text style={shopCardStyles.infoValue}>--</Text>
        </Text>
      </View>

      {/* Address and Distance Section */}
      <View style={shopCardStyles.addressRow}>
        <Ionicons name="location-outline" size={20} color={Colors.grayText} />
        <View style={shopCardStyles.addressTextContainer}>
          <Text style={shopCardStyles.addressText}>
            Address: {shop.address?.formattedAddress || "---"}
          </Text>
        </View>
        <Text style={shopCardStyles.distanceText}>
          {shop.distance ? `${shop.distance.toFixed(1)} km` : "-- km"}
        </Text>
      </View>

      {/* Products and View All section */}
      <View style={shopCardStyles.productsRow}>
        <View style={shopCardStyles.productsInfo}>
          <Text style={shopCardStyles.infoText}>
            Products :{" "}
            <Text style={shopCardStyles.infoValue}>{shop.productsCount}</Text>
          </Text>
          <View style={shopCardStyles.productImagesContainer}>
            {shop.productImages.slice(0, 3).map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={shopCardStyles.productImage}
              />
            ))}
          </View>
        </View>
        {hasProducts && (
          // This "View All" is now just for show, the whole card is clickable
          <Text style={shopCardStyles.viewAllText}>View All</Text>
        )}
      </View>

      {/* "Invite Seller" Button - for the second card in your image */}
      {shop.canInvite && (
        <TouchableOpacity style={shopCardStyles.inviteButton}>
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={Colors.textWhite}
          />
          <Text style={shopCardStyles.inviteButtonText}>Invite Seller</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// --- Main ShopListings Component ---
const ShopListings = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { allVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const { allProducts } = useSelector(
    (state: RootState) => state.vendorProducts
  );

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchUserLocation = useCallback(async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      // First, try to load location from AsyncStorage
      const storedLocation = await AsyncStorage.getItem("user_location");
      if (storedLocation) {
        setUserLocation(JSON.parse(storedLocation));
        setIsLocationLoading(false);
      }

      // Then, request current location in the background
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Permission to access location was denied.");
        if (!storedLocation) {
          setIsLocationLoading(false);
        }
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      const newLocation = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      };
      setUserLocation(newLocation);
      await AsyncStorage.setItem("user_location", JSON.stringify(newLocation));
    } catch (locError: any) {
      console.error("Error fetching user location:", locError);
      setLocationError("Could not get your location. Please check settings.");
    } finally {
      setIsLocationLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchAllVendors()),
        dispatch(fetchAllVendorProducts()),
        fetchUserLocation(),
      ]);
    } catch (error) {
      Alert.alert(
        "Refresh Failed",
        "Could not refresh data. Please try again."
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, fetchUserLocation]);

  useEffect(() => {
    dispatch(fetchAllVendors());
    dispatch(fetchAllVendorProducts());
    fetchUserLocation();
  }, [dispatch, fetchUserLocation]);

  const allVendorsWithProductsAndDistance = useMemo(() => {
    // 1. Filter vendors to only include approved ones
    const approvedVendors = allVendors.filter((vendor) => vendor.isApproved);

    return approvedVendors.map((vendor) => {
      const vendorProducts = allProducts.filter(
        (product) => product.vendorId === vendor._id
      );
      const productsCount = vendorProducts.length;
      const productImages = vendorProducts
        .map((p) => p.images[0])
        .filter(Boolean);
      let distance = null;
      if (
        userLocation &&
        vendor.address &&
        vendor.address.latitude &&
        vendor.address.longitude
      ) {
        distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          vendor.address.latitude,
          vendor.address.longitude
        );
      }
      return {
        ...vendor,
        productsCount,
        productImages,
        distance,
        canInvite: vendor.shopName === "Seva Sadan",
      };
    });
  }, [allVendors, allProducts, userLocation]);

  const localSellers = useMemo(() => {
    if (!userLocation) return [];
    const filteredVendors = allVendorsWithProductsAndDistance.filter(
      (v) =>
        (v.type === "local" || !v.type) &&
        v.distance !== null &&
        v.distance <= v.deliveryRange
    );

    if (!searchText) {
      return filteredVendors;
    }
    const lowercasedSearchText = searchText.toLowerCase();
    return filteredVendors.filter(
      (vendor) =>
        vendor.shopName.toLowerCase().includes(lowercasedSearchText) ||
        vendor.address.formattedAddress
          ?.toLowerCase()
          .includes(lowercasedSearchText) ||
        vendor.phoneNumber?.includes(lowercasedSearchText) ||
        vendor.brandName?.toLowerCase().includes(lowercasedSearchText)
    );
  }, [allVendorsWithProductsAndDistance, userLocation, searchText]);

  const handleCardPress = (shop) => {
    navigation.navigate("ShopProducts", {
      vendorId: shop._id,
      vendorName: shop.shopName,
    });
  };

  const renderContent = () => {
    if (isLocationLoading || vendorsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
          <Text style={styles.loadingText}>
            {isLocationLoading
              ? "Finding your location..."
              : "Loading shops..."}
          </Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.messageContainer}>
          <Text style={styles.messageTitle}>Location Error</Text>
          <Text style={styles.messageText}>{locationError}</Text>
          <TouchableOpacity
            onPress={fetchUserLocation}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={localSellers}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ShopCard
            shop={item}
            onPress={() => handleCardPress(item)}
          />
        )}
        contentContainerStyle={styles.flatlistContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentGreen}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No nearby local shops found.</Text>
            {searchText && (
              <Text style={styles.emptyText}>
                Try adjusting your search criteria.
              </Text>
            )}
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textDarkBrown} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Local Sellers ({localSellers.length})
        </Text>
      </View>

      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={20} color={Colors.grayText} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search for a seller, business, phone number, brand, product"
          placeholderTextColor={Colors.grayText}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {renderContent()}
    </SafeAreaView>
  );
};

// Main component styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    paddingTop: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
    backgroundColor: "white",
  },
  backButton: {
    paddingHorizontal: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
    textAlign: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.lightGrayBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    paddingVertical: 8,
    color: Colors.textDarkBrown,
  },
  flatlistContainer: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
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
    backgroundColor: Colors.accentGreen,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textWhite,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.grayText,
    textAlign: "center",
  },
});

// ShopCard styles
const shopCardStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.lightGrayBackground,
    borderRadius: 10,
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderLogo: {
    backgroundColor: Colors.purple,
  },
  placeholderText: {
    color: Colors.textWhite,
    fontSize: 24,
    fontWeight: "bold",
  },
  headerText: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
  },
  localSellerTag: {
    backgroundColor: Colors.accentGreen,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  localSellerText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: "bold",
  },
  phone: {
    fontSize: 12,
    color: Colors.grayText,
    marginTop: 4,
  },
  infoRow: {
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: Colors.grayText,
  },
  infoValue: {
    fontWeight: "bold",
    color: Colors.textDarkBrown,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  addressTextContainer: {
    flex: 1,
    marginLeft: 5,
    marginRight: 10,
  },
  addressText: {
    fontSize: 14,
    color: Colors.textDarkBrown,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
  },
  productsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  productsInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  productImagesContainer: {
    flexDirection: "row",
    marginLeft: 10,
  },
  productImage: {
    width: 30,
    height: 30,
    borderRadius: 5,
    marginRight: 5,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  viewAllText: {
    color: Colors.accentGreen,
    fontWeight: "bold",
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.purple,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 15,
  },
  inviteButtonText: {
    color: Colors.textWhite,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
});

export default ShopListings;