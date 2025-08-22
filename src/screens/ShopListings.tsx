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
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllVendors } from "../features/vendor/vendorAuthSlice";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { RootState } from "../app/store";
import { Vendor } from "../types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";

// Placeholder image for shops without a profile picture.
// Make sure to add this image to your assets folder.
const ShopPlaceholderImage = require("../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png");

const { width } = Dimensions.get("window");

const Colors = {
  starbucksGreen: "#00704A",
  backgroundWhite: "#F8F5F0",
  textDarkBrown: "#4A2C2A",
  borderGray: "#DDDDDD",
  textLight: "#FFFFFF",
  redAlert: "#DC2626",
  grayText: "gray",
  darkBlue: "#1C1C1E",
};

// Haversine Distance Calculation Function (Remains unchanged)
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

// --- Shop Card Component ---
const ShopCard: React.FC<{ vendor: Vendor; distance: number }> = ({
  vendor,
  distance,
}) => {
  const navigation = useNavigation();
  const isOnline = vendor.isOnline;

  const handleShopPress = () => {
    if (isOnline) {
      navigation.navigate("ShopProducts", {
        vendorId: vendor._id,
        vendorName: vendor.shopName,
      });
    } else {
      Alert.alert("Shop is Closed", `${vendor.shopName} is currently offline.`);
    }
  };

  const shopImageSource = vendor.shopImage
    ? { uri: vendor.shopImage }
    : ShopPlaceholderImage;

  return (
    <TouchableOpacity
      style={[shopCardStyles.card, !isOnline && shopCardStyles.cardOffline]}
      onPress={handleShopPress}
      disabled={!isOnline}
    >
      <View style={shopCardStyles.contentContainer}>
        <Text
          style={[
            shopCardStyles.shopName,
            !isOnline && { color: Colors.grayText },
          ]}
          numberOfLines={1}
        >
          {vendor.shopName}
        </Text>
        <View style={shopCardStyles.detailsContainer}>
          <Ionicons
            name="navigate-circle-outline"
            size={16}
            color={isOnline ? Colors.starbucksGreen : Colors.grayText}
          />
          <Text
            style={[
              shopCardStyles.distanceText,
              !isOnline && { color: Colors.grayText },
            ]}
          >
            {distance.toFixed(1)} km away
          </Text>
        </View>
        <Text
          style={[
            shopCardStyles.statusText,
            { color: isOnline ? Colors.starbucksGreen : Colors.redAlert },
          ]}
        >
          {isOnline ? "Open" : "Closed"}
        </Text>
      </View>
      <View style={shopCardStyles.imageAndIconContainer}>
        <Image
          source={shopImageSource}
          style={shopCardStyles.shopImage}
          resizeMode="cover"
        />
        <Ionicons
          name="chevron-forward-outline"
          size={24}
          color={isOnline ? Colors.textDarkBrown : Colors.grayText}
          style={shopCardStyles.chevronIcon}
        />
      </View>
    </TouchableOpacity>
  );
};

const shopCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.textLight,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  cardOffline: {
    backgroundColor: Colors.borderGray,
  },
  contentContainer: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.textDarkBrown,
  },
  detailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  distanceText: {
    fontSize: 14,
    color: Colors.grayText,
    marginLeft: 5,
  },
  statusText: {
    marginTop: 8,
    fontWeight: "bold",
    fontSize: 14,
  },
  imageAndIconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  shopImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  chevronIcon: {
    marginLeft: 10,
  },
});

// --- Main ShopListings Component ---
const ShopListings = () => {
  const dispatch = useDispatch();
  const allVendors = useSelector(
    (state: RootState) => state.vendorAuth.allVendors
  );
  const { loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchUserLocation = useCallback(async () => {
    setIsLocationLoading(true);
    setLocationError(null);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Permission to access location was denied.");
        Alert.alert(
          "Location Permission Required",
          "This app needs access to your location to show nearby shops. Please enable it in app settings.",
          [{ text: "OK" }]
        );
        setIsLocationLoading(false);
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
        maximumAge: 1000,
      });

      setUserLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });
    } catch (locError: any) {
      console.error("Error fetching user location:", locError);
      setLocationError("Could not get your location. Please check settings.");
      Alert.alert(
        "Location Error",
        "Could not get your location. Please check app permissions.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    dispatch(fetchAllVendors());
    dispatch(fetchAllVendorProducts());
    fetchUserLocation();
  }, [dispatch, fetchUserLocation]);

  const nearbyVendors = useMemo(() => {
    if (!allVendors || !userLocation) {
      return [];
    }

    const vendorsWithDistance = allVendors
      .map((vendor) => {
        if (
          !vendor.address ||
          vendor.address.latitude === undefined ||
          vendor.address.longitude === undefined ||
          vendor.deliveryRange === undefined
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

  if (isLocationLoading || vendorsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.starbucksGreen} />
        <Text style={styles.loadingText}>
          {isLocationLoading ? "Finding your location..." : "Loading shops..."}
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

  if (nearbyVendors.length === 0) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>No Shops Found</Text>
        <Text style={styles.messageText}>
          Looks like there are no shops currently delivering to your location.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Shops</Text>
      </View>
      <FlatList
        data={nearbyVendors}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ShopCard vendor={item} distance={item.distance} />
        )}
        contentContainerStyle={styles.flatlistContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
    backgroundColor: Colors.textLight,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
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
    backgroundColor: Colors.backgroundWhite,
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
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.textLight,
    fontWeight: "bold",
  },
});

export default ShopListings;
