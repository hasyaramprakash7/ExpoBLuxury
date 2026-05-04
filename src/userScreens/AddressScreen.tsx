import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";

import { AppDispatch, RootState } from "../app/store";
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
  saveUserAddress,
  setSelectedAddress,
  selectAllAddresses,
  SavedAddress,
} from "../features/locationSlice";

const Colors = {
  white: "#FFFFFF",
  lightGray: "#F0F0F0",
  grayText: "#7A7A7A",
  dark: "#0A3D2B",
  darkText: "#1A1A1A", // Darker for premium readability
  orange: "#0A3D2B",
  swiggyOrange: "#fc8019", // Standard Swiggy Orange
  borderGray: "#E5E5EA",
  redAlert: "#DC2626",
  successGreen: "#34C759",
  background: "#F2F2F2", // Slightly off-white background
};

const AddressScreen: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<any>();

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    type: "Home" as "Home" | "Work" | "Other",
    addressString: "",
    landmark: "",
    city: "",
    pincode: "",
    latitude: 0,
    longitude: 0,
  });

  const {
    selectedAddress,
    permissionGranted,
    loading: isLocationLoading,
    addressActionLoading,
  } = useSelector((state: RootState) => state.location);

  const token = useSelector((state: RootState) => state.auth.user?.token);
  const savedAddresses = useSelector((state: RootState) =>
    selectAllAddresses(state),
  );

  const handleSelectAddress = (address: SavedAddress) => {
    dispatch(setSelectedAddress(address));
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("UserTabs");
    }
  };

  const handleInitiateAddAddress = async () => {
    if (!token) {
      Alert.alert("Authentication Required", "Please login to add an address.");
      return;
    }

    try {
      dispatch(fetchLocationStart());
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dispatch(fetchLocationFailure("Permission denied"));
        Alert.alert(
          "Permission Required",
          "We need location access to deliver your orders accurately.",
        );
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const exactLat = parseFloat(locationData.coords.latitude.toFixed(8));
      const exactLng = parseFloat(locationData.coords.longitude.toFixed(8));

      let geocode = await Location.reverseGeocodeAsync({
        latitude: exactLat,
        longitude: exactLng,
      });

      let generatedAddressString = "";
      let fetchedCity = "";
      let fetchedPincode = "";

      if (geocode.length > 0) {
        const g = geocode[0];
        generatedAddressString = [g.name, g.street, g.subregion, g.district]
          .filter(Boolean)
          .join(", ");

        fetchedCity = g.city || g.subregion || g.region || "";
        fetchedPincode = g.postalCode || "";
      }

      setAddressForm({
        type: "Home",
        addressString: generatedAddressString,
        landmark: "",
        city: fetchedCity,
        pincode: fetchedPincode,
        latitude: exactLat,
        longitude: exactLng,
      });

      dispatch(
        fetchLocationSuccess({ latitude: exactLat, longitude: exactLng }),
      );
      setIsEditingAddress(true);
    } catch (error) {
      dispatch(fetchLocationFailure("Error fetching location"));
      Alert.alert(
        "Error",
        "Could not fetch your exact location. Please try again.",
      );
      console.error(error);
    }
  };

  const submitNewAddressForm = async () => {
    if (!addressForm.addressString.trim()) {
      Alert.alert("Required", "Complete address details cannot be empty.");
      return;
    }

    try {
      await dispatch(
        saveUserAddress({ token, addressData: addressForm }),
      ).unwrap();
      setIsEditingAddress(false);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("UserTabs");
      }
    } catch (error) {
      Alert.alert("Error", "Could not save address to the database.");
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {/* 🔥 SWIGGY LOGIC: Only show back button if they ALREADY have a selected address. */}
        {selectedAddress ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate("UserTabs")
            }
          >
            <Ionicons name="arrow-back" size={24} color={Colors.darkText} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} /> /* Spacer to keep title centered */
        )}
        <Text style={styles.headerTitle}>
          {isEditingAddress ? "Enter Address Details" : "Select a location"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {(isLocationLoading || addressActionLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.swiggyOrange} />
          <Text style={styles.loadingText}>Fetching accurate GPS...</Text>
        </View>
      )}

      {isEditingAddress ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.mapMockup}>
              <Ionicons name="location" size={40} color={Colors.swiggyOrange} />
              <Text style={styles.mapMockupText}>
                Locating exactly where you are...
              </Text>
            </View>

            <Text style={styles.inputLabel}>Complete Address *</Text>
            <TextInput
              style={styles.addressInput}
              value={addressForm.addressString}
              onChangeText={(text) =>
                setAddressForm({ ...addressForm, addressString: text })
              }
              placeholder="House No, Building Name, Street..."
              placeholderTextColor={Colors.grayText}
              multiline
            />

            <Text style={styles.inputLabel}>Landmark (Optional)</Text>
            <TextInput
              style={styles.singleLineInput}
              value={addressForm.landmark}
              onChangeText={(text) =>
                setAddressForm({ ...addressForm, landmark: text })
              }
              placeholder="e.g. Near Apollo Hospital"
              placeholderTextColor={Colors.grayText}
            />

            <Text style={styles.inputLabel}>Save As</Text>
            <View style={styles.typeRow}>
              {["Home", "Work", "Other"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeBadge,
                    addressForm.type === type && styles.typeBadgeActive,
                  ]}
                  onPress={() =>
                    setAddressForm({ ...addressForm, type: type as any })
                  }
                >
                  <Ionicons
                    name={
                      type === "Home"
                        ? "home"
                        : type === "Work"
                          ? "briefcase"
                          : "location"
                    }
                    size={16}
                    color={
                      addressForm.type === type
                        ? Colors.swiggyOrange
                        : Colors.grayText
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeBadgeText,
                      addressForm.type === type && styles.typeBadgeTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.geoDataRow}>
              <Text style={styles.coordText}>
                📍 {addressForm.city} - {addressForm.pincode}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={submitNewAddressForm}
            >
              <Text style={styles.saveButtonText}>Save Address</Text>
            </TouchableOpacity>

            {/* Allow them to cancel editing if they already have an address */}
            {selectedAddress && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsEditingAddress(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={styles.listContainer} bounces={false}>
          {!permissionGranted && (
            <View style={styles.permissionBanner}>
              <View style={styles.permissionTextContainer}>
                <View style={styles.permissionRow}>
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={Colors.redAlert}
                  />
                  <Text style={styles.permissionTitle}>
                    Device location is off
                  </Text>
                </View>
                <Text style={styles.permissionSubtitle}>
                  Turn on device location to ensure accurate delivery
                </Text>
              </View>
              <TouchableOpacity
                style={styles.grantButton}
                onPress={handleInitiateAddAddress}
              >
                <Text style={styles.grantButtonText}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.currentLocationContainer}
            onPress={handleInitiateAddAddress}
          >
            <View style={styles.currentLocationIcon}>
              <Ionicons name="locate" size={22} color={Colors.swiggyOrange} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.currentLocationTitle}>
                Use current location
              </Text>
              <Text style={styles.addressString} numberOfLines={1}>
                Using GPS for precision
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.grayText}
            />
          </TouchableOpacity>

          <View style={styles.sectionDivider} />

          {savedAddresses.length > 0 && (
            <View style={styles.savedSection}>
              <Text style={styles.savedAddressesHeader}>SAVED ADDRESSES</Text>
              {savedAddresses.map((addr) => {
                const isSelected = selectedAddress?.id === addr.id;
                let iconName = "location-outline";
                if (addr.type === "Home") iconName = "home-outline";
                if (addr.type === "Work") iconName = "briefcase-outline";

                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[
                      styles.addressItem,
                      isSelected && styles.addressItemSelected,
                    ]}
                    onPress={() => handleSelectAddress(addr)}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={iconName as any}
                        size={24}
                        color={
                          isSelected ? Colors.swiggyOrange : Colors.darkText
                        }
                      />
                    </View>
                    <View style={styles.addressInfo}>
                      <Text
                        style={[
                          styles.addressType,
                          isSelected && { color: Colors.swiggyOrange },
                        ]}
                      >
                        {addr.type}
                      </Text>
                      <Text style={styles.addressString} numberOfLines={2}>
                        {addr.addressString}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={Colors.successGreen}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 3 },
    }),
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.darkText },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, fontWeight: "600", color: Colors.darkText },
  listContainer: { flex: 1, backgroundColor: Colors.background },
  formContainer: { padding: 20, paddingBottom: 40 },

  // Forms
  mapMockup: {
    height: 120,
    backgroundColor: "rgba(252, 128, 25, 0.05)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(252, 128, 25, 0.2)",
  },
  mapMockupText: {
    marginTop: 10,
    color: Colors.swiggyOrange,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.grayText,
    marginBottom: 8,
    marginTop: 15,
    letterSpacing: 0.5,
  },
  addressInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 10,
    padding: 14,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 15,
    color: Colors.darkText,
  },
  singleLineInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.darkText,
  },
  typeRow: { flexDirection: "row", marginTop: 5 },
  typeBadge: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    marginRight: 10,
    backgroundColor: Colors.white,
    alignItems: "center",
  },
  typeBadgeActive: {
    backgroundColor: "rgba(252, 128, 25, 0.08)",
    borderColor: Colors.swiggyOrange,
  },
  typeBadgeText: { fontSize: 14, color: Colors.grayText, fontWeight: "600" },
  typeBadgeTextActive: { color: Colors.swiggyOrange },
  geoDataRow: { marginTop: 25, alignItems: "center" },
  coordText: {
    fontSize: 12,
    color: Colors.grayText,
    fontStyle: "italic",
    fontWeight: "500",
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: Colors.swiggyOrange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cancelButton: { marginTop: 15, alignItems: "center", paddingVertical: 10 },
  cancelButtonText: { color: Colors.grayText, fontSize: 15, fontWeight: "600" },

  // List Items
  permissionBanner: {
    backgroundColor: "#FEE2E2",
    margin: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  permissionTextContainer: { flex: 1 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  permissionTitle: {
    color: Colors.redAlert,
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 6,
  },
  permissionSubtitle: { color: "#991B1B", fontSize: 13 },
  grantButton: {
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  grantButtonText: { color: Colors.redAlert, fontWeight: "bold", fontSize: 13 },

  currentLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: Colors.white,
  },
  currentLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(252, 128, 25, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.swiggyOrange,
    marginBottom: 2,
  },

  addressInfo: { flex: 1, paddingRight: 10 },
  addressString: { fontSize: 13, color: Colors.grayText, lineHeight: 18 },
  sectionDivider: { height: 10, backgroundColor: Colors.background },

  savedSection: { backgroundColor: Colors.white, paddingBottom: 20 },
  savedAddressesHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.grayText,
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 15,
    letterSpacing: 1,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  addressItemSelected: { backgroundColor: "rgba(52, 199, 89, 0.04)" },
  iconContainer: { width: 36, alignItems: "flex-start" },
  addressType: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.darkText,
    marginBottom: 4,
  },
});

export default AddressScreen;
