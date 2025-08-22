// src/components/OrderMapDetails.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Geolocation from "@react-native-community/geolocation";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { MapPin, User, Truck } from "lucide-react-native";
import { Order } from "../../src/features/order/orderSlice";

// Define the type for the navigation route parameters
type OrderMapDetailsRouteProp = RouteProp<
  { OrderMapDetails: { order: Order } },
  "OrderMapDetails"
>;

const OrderMapDetails = () => {
  const route = useRoute<OrderMapDetailsRouteProp>();
  const navigation = useNavigation();
  const { order } = route.params;

  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const customerLocation = {
    latitude: order.address.latitude,
    longitude: order.address.longitude,
  };

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === "android") {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: "Location Permission",
              message:
                "This app needs access to your location to show delivery route.",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK",
            }
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            fetchCurrentLocation();
          } else {
            Alert.alert(
              "Permission Denied",
              "Location permission is required to show the map."
            );
            setLoadingLocation(false);
          }
        } catch (err) {
          console.warn(err);
          setLoadingLocation(false);
        }
      } else {
        fetchCurrentLocation();
      }
    };

    const fetchCurrentLocation = () => {
      Geolocation.getCurrentPosition(
        (position) => {
          setDeliveryBoyLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLoadingLocation(false);
        },
        (error) => {
          Alert.alert(
            "Location Error",
            "Could not get your current location. Please ensure location services are enabled."
          );
          console.error(error);
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
    };

    requestLocationPermission();
  }, []);

  // Handle case where latitude/longitude might be null or undefined
  if (
    customerLocation.latitude === null ||
    customerLocation.longitude === null
  ) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Customer location data is missing.
        </Text>
      </View>
    );
  }

  // Determine the initial map region
  const initialRegion = deliveryBoyLocation
    ? {
        latitude:
          (customerLocation.latitude + deliveryBoyLocation.latitude) / 2,
        longitude:
          (customerLocation.longitude + deliveryBoyLocation.longitude) / 2,
        latitudeDelta:
          Math.abs(customerLocation.latitude - deliveryBoyLocation.latitude) *
            1.5 || 0.1,
        longitudeDelta:
          Math.abs(customerLocation.longitude - deliveryBoyLocation.longitude) *
            1.5 || 0.1,
      }
    : {
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MapPin size={28} color="#fff" />
        <Text style={styles.headerTitle}>Delivery Map</Text>
      </View>
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={true}
          followsUserLocation={true}
        >
          {/* Marker for the delivery user's address */}
          <Marker
            coordinate={{
              latitude: customerLocation.latitude,
              longitude: customerLocation.longitude,
            }}
            title={order.address.fullName}
            description={`Delivery Address: ${order.address.street}`}
          >
            <View style={styles.markerContainer}>
              <User size={24} color="#E53935" />
            </View>
          </Marker>

          {/* Marker for the delivery boy's current location */}
          {deliveryBoyLocation && (
            <Marker
              coordinate={deliveryBoyLocation}
              title="Your Location"
              description="You are here"
            >
              <View style={styles.markerContainer}>
                <Truck size={24} color="#4F46E5" />
              </View>
            </Marker>
          )}
        </MapView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: "#4F46E5",
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6B7280",
  },
  markerContainer: {
    backgroundColor: "white",
    padding: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#4F46E5",
  },
});

export default OrderMapDetails;
