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
import { LinearGradient } from "expo-linear-gradient";

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

// ─────────────────────────────────────────────────────────────
// 👑 ROYAL PALETTE
// ─────────────────────────────────────────────────────────────
const Royal = {
  gold: "#D4AF37",
  goldSoft: "#E8CC7A",
  goldDim: "rgba(212,175,55,0.35)",
  goldFaint: "rgba(212,175,55,0.10)",
  royalGreen: "#0A3D2B",
  royalGreenDeep: "#062318",
  obsidian: "#0B0B0F",
  ivory: "#FBF7EE",
  cream: "#FAF3E0",
  maroon: "#5C1A2B",
  redAlert: "#B91C1C",
  redSoft: "rgba(185,28,28,0.08)",
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
    selectAllAddresses(state)
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
          "We need location access to deliver your orders accurately."
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

      dispatch(fetchLocationSuccess({ latitude: exactLat, longitude: exactLng }));
      setIsEditingAddress(true);
    } catch (error) {
      dispatch(fetchLocationFailure("Error fetching location"));
      Alert.alert(
        "Error",
        "Could not fetch your exact location. Please try again."
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
        saveUserAddress({ token, addressData: addressForm })
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
      {/* ─── Header ─── */}
      <View style={styles.header}>
        {selectedAddress ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate("UserTabs")
            }
          >
            <Ionicons name="arrow-back" size={22} color={Royal.gold} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <View style={styles.headerTitleWrap}>
          <Ionicons name="diamond" size={11} color={Royal.gold} />
          <Text style={styles.headerTitle}>
            {isEditingAddress ? "ENTER ADDRESS DETAILS" : "SELECT A LOCATION"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Loading overlay ─── */}
      {(isLocationLoading || addressActionLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Royal.gold} />
          <Text style={styles.loadingText}>Fetching accurate GPS…</Text>
          <View style={styles.loadingDivider} />
        </View>
      )}

      {/* ─── Editing form ─── */}
      {isEditingAddress ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.formContainer}
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={[Royal.royalGreenDeep, Royal.royalGreen, Royal.obsidian]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mapMockup}
            >
              <View style={styles.mapMockupInner}>
                <Ionicons name="location" size={32} color={Royal.gold} />
                <Text style={styles.mapMockupText}>
                  LOCATING YOUR EXACT POSITION
                </Text>
                <View style={styles.mapMockupDivider} />
                <Text style={styles.mapMockupSub}>
                  GPS precision in progress…
                </Text>
              </View>
            </LinearGradient>

            <Text style={styles.inputLabel}>COMPLETE ADDRESS *</Text>
            <TextInput
              style={styles.addressInput}
              value={addressForm.addressString}
              onChangeText={(text) =>
                setAddressForm({ ...addressForm, addressString: text })
              }
              placeholder="House No, Building Name, Street..."
              placeholderTextColor={Royal.royalGreen}
              multiline
            />

            <Text style={styles.inputLabel}>LANDMARK (OPTIONAL)</Text>
            <TextInput
              style={styles.singleLineInput}
              value={addressForm.landmark}
              onChangeText={(text) =>
                setAddressForm({ ...addressForm, landmark: text })
              }
              placeholder="e.g. Near Apollo Hospital"
              placeholderTextColor={Royal.royalGreen}
            />

            <Text style={styles.inputLabel}>SAVE AS</Text>
            <View style={styles.typeRow}>
              {["Home", "Work", "Other"].map((type) => {
                const isActive = addressForm.type === type;
                const icon =
                  type === "Home"
                    ? "home"
                    : type === "Work"
                    ? "briefcase"
                    : "location";
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeBadge, isActive && styles.typeBadgeActive]}
                    onPress={() =>
                      setAddressForm({ ...addressForm, type: type as any })
                    }
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={icon as any}
                      size={14}
                      color={isActive ? Royal.obsidian : Royal.gold}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.typeBadgeText,
                        isActive && styles.typeBadgeTextActive,
                      ]}
                    >
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.geoDataRow}>
              <View style={styles.geoPill}>
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={Royal.gold}
                />
                <Text style={styles.coordText}>
                  {addressForm.city || "—"} • {addressForm.pincode || "—"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={submitNewAddressForm}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[Royal.gold, Royal.goldSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.saveButtonInner}>
                <Text style={styles.saveButtonText}>SAVE ADDRESS</Text>
                <Ionicons name="arrow-forward" size={16} color={Royal.obsidian} />
              </View>
            </TouchableOpacity>

            {selectedAddress && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsEditingAddress(false)}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
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
                    size={16}
                    color={Royal.redAlert}
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
                <Text style={styles.grantButtonText}>ENABLE</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.currentLocationContainer}
            onPress={handleInitiateAddAddress}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={[Royal.gold, Royal.goldSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.currentLocationIcon}
            >
              <Ionicons name="locate" size={20} color={Royal.obsidian} />
            </LinearGradient>
            <View style={styles.addressInfo}>
              <Text style={styles.currentLocationTitle}>
                Use current location
              </Text>
              <Text style={styles.addressString} numberOfLines={1}>
                Using GPS for precision
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Royal.gold} />
          </TouchableOpacity>

          <View style={styles.sectionDivider} />

          {savedAddresses.length > 0 && (
            <View style={styles.savedSection}>
              <View style={styles.savedHeaderRow}>
                <View style={styles.savedHeaderLine} />
                <Text style={styles.savedAddressesHeader}>SAVED ADDRESSES</Text>
                <View style={styles.savedHeaderLine} />
              </View>

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
                    activeOpacity={0.75}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={iconName as any}
                        size={22}
                        color={isSelected ? Royal.gold : Royal.royalGreenDeep}
                      />
                    </View>
                    <View style={styles.addressInfo}>
                      <View style={styles.addressTypeRow}>
                        <Text
                          style={[
                            styles.addressType,
                            isSelected && { color: Royal.royalGreenDeep },
                          ]}
                        >
                          {addr.type}
                        </Text>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>
                              SELECTED
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressString} numberOfLines={2}>
                        {addr.addressString}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={Royal.gold}
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

// ─────────────────────────────────────────────────────────────
// 👑 Royal Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Royal.ivory },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Royal.ivory,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldDim,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Royal.goldDim,
    backgroundColor: Royal.cream,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: Royal.royalGreenDeep,
    letterSpacing: 2,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(251,247,238,0.92)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontWeight: "700",
    color: Royal.royalGreenDeep,
    letterSpacing: 1,
    fontSize: 13,
  },
  loadingDivider: {
    width: 48,
    height: 1,
    backgroundColor: Royal.gold,
    marginTop: 12,
    opacity: 0.6,
  },

  listContainer: { flex: 1, backgroundColor: Royal.ivory },
  formContainer: { padding: 20, paddingBottom: 40 },

  // Map mockup
  mapMockup: {
    height: 130,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Royal.goldDim,
  },
  mapMockupInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  mapMockupText: {
    marginTop: 10,
    color: Royal.ivory,
    fontWeight: "900",
    letterSpacing: 1.8,
    fontSize: 11,
  },
  mapMockupDivider: {
    width: 36,
    height: 1,
    backgroundColor: Royal.gold,
    marginVertical: 8,
    opacity: 0.8,
  },
  mapMockupSub: {
    color: Royal.goldSoft,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: Royal.gold,
    marginBottom: 8,
    marginTop: 15,
    letterSpacing: 2,
  },
  addressInput: {
    backgroundColor: Royal.cream,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    borderRadius: 12,
    padding: 14,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 14,
    color: Royal.royalGreenDeep,
    fontWeight: "500",
  },
  singleLineInput: {
    backgroundColor: Royal.cream,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Royal.royalGreenDeep,
    fontWeight: "500",
  },

  typeRow: { flexDirection: "row", marginTop: 5 },
  typeBadge: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    marginRight: 10,
    backgroundColor: Royal.ivory,
    alignItems: "center",
  },
  typeBadgeActive: {
    backgroundColor: Royal.gold,
    borderColor: Royal.goldSoft,
  },
  typeBadgeText: {
    fontSize: 11,
    color: Royal.royalGreenDeep,
    fontWeight: "800",
    letterSpacing: 1,
  },
  typeBadgeTextActive: { color: Royal.obsidian },

  geoDataRow: { marginTop: 22, alignItems: "center" },
  geoPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    backgroundColor: Royal.goldFaint,
    gap: 6,
  },
  coordText: {
    fontSize: 11,
    color: Royal.royalGreenDeep,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  saveButton: {
    marginTop: 22,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Royal.goldSoft,
    elevation: 3,
    shadowColor: Royal.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    color: Royal.obsidian,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cancelButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: Royal.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },

  // Permission banner
  permissionBanner: {
    backgroundColor: Royal.redSoft,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.25)",
  },
  permissionTextContainer: { flex: 1 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  permissionTitle: {
    color: Royal.redAlert,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  permissionSubtitle: {
    color: "#7F1D1D",
    fontSize: 12,
    opacity: 0.85,
  },
  grantButton: {
    backgroundColor: Royal.redAlert,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  grantButtonText: {
    color: Royal.ivory,
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 1.5,
  },

  // Current location
  currentLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    backgroundColor: Royal.ivory,
    borderTopWidth: 1,
    borderTopColor: Royal.goldFaint,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldFaint,
  },
  currentLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: Royal.goldSoft,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Royal.royalGreenDeep,
    marginBottom: 2,
    letterSpacing: 0.2,
  },

  addressInfo: { flex: 1, paddingRight: 10 },
  addressString: {
    fontSize: 12,
    color: Royal.royalGreen,
    lineHeight: 18,
    opacity: 0.8,
  },
  sectionDivider: {
    height: 6,
    backgroundColor: Royal.goldFaint,
    width: "100%",
  },

  // Saved addresses
  savedSection: {
    backgroundColor: Royal.ivory,
    paddingBottom: 24,
  },
  savedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  savedHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: Royal.goldDim,
  },
  savedAddressesHeader: {
    fontSize: 10,
    fontWeight: "900",
    color: Royal.gold,
    letterSpacing: 2.5,
    marginHorizontal: 12,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldFaint,
  },
  addressItemSelected: { backgroundColor: Royal.goldFaint },
  iconContainer: { width: 36, alignItems: "flex-start" },
  addressTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressType: {
    fontSize: 14,
    fontWeight: "800",
    color: Royal.royalGreenDeep,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Royal.royalGreenDeep,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Royal.gold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
});

export default AddressScreen;