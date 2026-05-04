// AddAddressScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Redux imports
import { AppDispatch, RootState } from "../app/store";
import { saveUserAddress, NewAddressPayload } from "../features/locationSlice";

// --- Colors ---
const Colors = {
  white: "#FFFFFF",
  darkText: "#1C1C1E",
  grayText: "#7A7A7A",
  lightGray: "#F0F0F0",
  swiggyOrange: "#FC8019",
  borderGray: "#E5E5EA",
  successGreen: "#34C759",
};

type AddressType = "Home" | "Work" | "Other";

const AddAddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Redux State
  const { token } = useSelector((state: RootState) => state.auth);
  const { addressActionLoading } = useSelector(
    (state: RootState) => state.location,
  );

  // Local State
  const [region, setRegion] = useState<Region | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string>("Locating...");
  const [detailedAddress, setDetailedAddress] = useState<string>("");
  const [selectedType, setSelectedType] = useState<AddressType>("Home");
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);

  // Default to Visakhapatnam if GPS fails immediately
  const defaultLocation = {
    latitude: 17.6868,
    longitude: 83.2185,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setIsLocating(true);
    setFetchedAddress("Locating your position...");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need location access to pin your address.",
        );
        setRegion(defaultLocation);
        setIsLocating(false);
        return;
      }

      // Quick fallback to last known to avoid hanging
      let location = await Location.getLastKnownPositionAsync();
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
    } catch (error) {
      console.warn("Error getting location:", error);
      setRegion(defaultLocation);
      setFetchedAddress("Could not determine location");
    } finally {
      setIsLocating(false);
    }
  };

  const fetchAddressFromCoords = async (
    latitude: number,
    longitude: number,
  ) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (geocode.length > 0) {
        const place = geocode[0];
        // Construct a readable string
        const addressParts = [
          place.name,
          place.street,
          place.subregion,
          place.city,
        ]
          .filter((part) => part && part !== "Unnamed Road")
          .join(", ");

        setFetchedAddress(addressParts || "Unknown Location");
      } else {
        setFetchedAddress("Unknown Location");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setFetchedAddress("Could not fetch address details");
    }
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setIsMapMoving(false);
    setRegion(newRegion);
    fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
  };

  const handleSaveAddress = () => {
    if (!token) {
      Alert.alert("Error", "You must be logged in to save an address.");
      return;
    }
    if (!region) return;

    // Combine the fetched map address with the user's manual flat/house number
    const finalAddressString = detailedAddress.trim()
      ? `${detailedAddress.trim()}, ${fetchedAddress}`
      : fetchedAddress;

    const addressData: NewAddressPayload = {
      type: selectedType,
      addressString: finalAddressString,
      latitude: region.latitude,
      longitude: region.longitude,
    };

    dispatch(saveUserAddress({ token, addressData }))
      .unwrap()
      .then(() => {
        navigation.goBack(); // Return to previous screen on success
      })
      .catch((err) => {
        Alert.alert("Failed to save address", err);
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* --- MAP SECTION --- */}
          <View style={styles.mapContainer}>
            {region ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                showsUserLocation={true}
                showsMyLocationButton={false}
                onRegionChange={() => setIsMapMoving(true)}
                onRegionChangeComplete={handleRegionChangeComplete}
              />
            ) : (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={Colors.swiggyOrange} />
                <Text style={styles.mapLoadingText}>
                  Finding your location...
                </Text>
              </View>
            )}

            {/* Fixed Center Pin (Stays in middle of screen while map moves) */}
            <View style={styles.centerMarkerContainer} pointerEvents="none">
              <View
                style={[
                  styles.markerBubble,
                  isMapMoving && styles.markerBubbleMoving,
                ]}
              >
                <Text style={styles.markerText}>
                  {isMapMoving
                    ? "Move map to adjust"
                    : "Order will be delivered here"}
                </Text>
              </View>
              <Ionicons
                name="location"
                size={42}
                color={Colors.darkText}
                style={[
                  styles.markerIcon,
                  isMapMoving && styles.markerIconMoving,
                ]}
              />
              <View style={styles.markerShadow} />
            </View>

            {/* Back Button Overlay */}
            <TouchableOpacity
              style={[styles.backButton, { top: Math.max(insets.top, 20) }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.darkText} />
            </TouchableOpacity>

            {/* Re-center Button Overlay */}
            <TouchableOpacity
              style={styles.myLocationButton}
              onPress={getCurrentLocation}
            >
              <Ionicons name="locate" size={24} color={Colors.swiggyOrange} />
            </TouchableOpacity>
          </View>

          {/* --- BOTTOM SHEET FORM SECTION --- */}
          <View style={styles.bottomSheet}>
            <View style={styles.locationHeader}>
              <View style={styles.locationIconContainer}>
                <Ionicons
                  name="location"
                  size={24}
                  color={Colors.swiggyOrange}
                />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationTitle}>Delivery Location</Text>
                <Text style={styles.locationSubtitle} numberOfLines={2}>
                  {isLocating ? "Fetching address..." : fetchedAddress}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TextInput
              style={styles.input}
              placeholder="House / Flat / Block No."
              placeholderTextColor={Colors.grayText}
              value={detailedAddress}
              onChangeText={setDetailedAddress}
            />

            <Text style={styles.saveAsLabel}>Save as</Text>
            <View style={styles.typeContainer}>
              {(["Home", "Work", "Other"] as AddressType[]).map((type) => {
                const isSelected = selectedType === type;
                let iconName = "location-outline";
                if (type === "Home") iconName = "home-outline";
                if (type === "Work") iconName = "briefcase-outline";

                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeChip,
                      isSelected && styles.typeChipSelected,
                    ]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Ionicons
                      name={iconName as any}
                      size={16}
                      color={isSelected ? Colors.swiggyOrange : Colors.darkText}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        isSelected && styles.typeChipTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
              disabled={addressActionLoading}
            >
              {addressActionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  Save Address and Proceed
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.lightGray,
  },
  mapLoadingText: {
    marginTop: 12,
    color: Colors.darkText,
    fontWeight: "600",
  },

  // --- Fixed Pin Styling ---
  centerMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -100, // half of width to center
    marginTop: -85, // Shift up slightly so the *bottom point* of the icon is dead center
    width: 200,
    alignItems: "center",
    zIndex: 2,
  },
  markerBubble: {
    backgroundColor: Colors.darkText,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
  },
  markerBubbleMoving: {
    opacity: 0.5,
  },
  markerText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  markerIcon: {
    transform: [{ translateY: 0 }],
  },
  markerIconMoving: {
    // Jump effect when panning
    transform: [{ translateY: -12 }],
  },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },

  // --- Floating Overlays ---
  backButton: {
    position: "absolute",
    left: 16,
    backgroundColor: Colors.white,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  myLocationButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: Colors.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  // --- Bottom Form Sheet ---
  bottomSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginTop: -20, // Overlap the map
    zIndex: 5,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(252, 128, 25, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.darkText,
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 13,
    color: Colors.grayText,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderGray,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.darkText,
    backgroundColor: "#F9F9F9",
    marginBottom: 20,
  },
  saveAsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.grayText,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: "row",
    marginBottom: 24,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: Colors.white,
  },
  typeChipSelected: {
    borderColor: Colors.swiggyOrange,
    backgroundColor: "rgba(252, 128, 25, 0.05)",
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.darkText,
    marginLeft: 6,
  },
  typeChipTextSelected: {
    color: Colors.swiggyOrange,
  },
  saveButton: {
    backgroundColor: Colors.swiggyOrange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: Colors.swiggyOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});

export default AddAddressScreen;
