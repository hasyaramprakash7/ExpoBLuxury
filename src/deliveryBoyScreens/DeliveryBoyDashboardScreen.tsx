import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import {
  logoutDeliveryBoy,
  updateDeliveryBoyProfile,
  fetchDeliveryBoyProfile,
  toggleAvailability,
} from "../features/deliveryBoy/deliveryBoyOrderSlice";
import { RootState, AppDispatch } from "../app/store";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../App";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import axios from "axios";
import Toast from "react-native-toast-message";

type DeliveryBoyDashboardScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "DeliveryBoyDashboard"
>;

export default function DeliveryBoyDashboardScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<DeliveryBoyDashboardScreenNavigationProp>();
  const { deliveryBoy, loading } = useSelector(
    (state: RootState) => state.deliveryBoyAuth
  );

  const [isEditing, setIsEditing] = useState(false);
  const [profileImageFile, setProfileImageFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    businessType: "",
    shopName: "",
    vehicleNo: "",
    licenseNo: "",
    address: {
      latitude: "",
      longitude: "",
      pincode: "",
      state: "",
      district: "",
      country: "",
    },
  });

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");

  useEffect(() => {
    if (deliveryBoy) {
      setFormData({
        name: deliveryBoy.name || "",
        phone: deliveryBoy.phone || "",
        businessType: deliveryBoy.businessType || "",
        shopName: deliveryBoy.shopName || "",
        vehicleNo: deliveryBoy.vehicleNo || "",
        licenseNo: deliveryBoy.licenseNo || "",
        address: {
          latitude: deliveryBoy.address?.latitude || "",
          longitude: deliveryBoy.address?.longitude || "",
          pincode: deliveryBoy.address?.pincode || "",
          state: deliveryBoy.address?.state || "",
          district: deliveryBoy.address?.district || "",
          country: deliveryBoy.address?.country || "India",
        },
      });
    }
  }, [deliveryBoy]);

  useEffect(() => {
    if (!deliveryBoy) {
      dispatch(fetchDeliveryBoyProfile());
    }
  }, [dispatch, deliveryBoy]);

  const handleChange = (name: string, value: string) => {
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [key]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFetchLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setAddressStatus("Location permission denied. Please enter manually.");
      return;
    }

    setLoadingAddress(true);
    setAddressStatus("Fetching your current location...");
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 5000,
      });
      const { latitude, longitude } = position.coords;

      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          latitude: String(latitude),
          longitude: String(longitude),
        },
      }));

      const response = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          headers: { "User-Agent": "BLuxuryApp/1.0 (contact@bluxury.com)" },
          params: {
            lat: latitude,
            lon: longitude,
            format: "json",
            addressdetails: 1,
          },
        }
      );

      const address = response.data.address || {};
      const pincode = address.postcode || "";
      const state = address.state || "";
      const district = address.county || address.city_district || "";
      const country = address.country || "India";

      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          pincode,
          state,
          district,
          country,
        },
      }));
      setAddressStatus("Address auto-filled from your location.");
    } catch (error) {
      console.error("Error fetching location/address:", error);
      setAddressStatus(
        "Could not fetch address automatically. Please enter manually."
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  const handlePincodeBlur = async () => {
    const { pincode } = formData.address;
    if (!pincode || pincode.length !== 6) {
      setAddressStatus("Please enter a valid 6-digit pincode.");
      return;
    }

    setLoadingAddress(true);
    setAddressStatus("Fetching address for pincode...");
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          headers: { "User-Agent": "BLuxuryApp/1.0 (contact@bluxury.com)" },
          params: {
            postalcode: pincode,
            format: "json",
            addressdetails: 1,
            countrycodes: "in",
          },
        }
      );

      if (res.data.length > 0) {
        const address = res.data[0].address;
        setFormData((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            state: address.state || "",
            district: address.county || address.city_district || "",
            country: address.country || "India",
          },
        }));
        setAddressStatus("Address details updated from pincode.");
      } else {
        setAddressStatus("No address found for this pincode.");
      }
    } catch (err) {
      console.error("Error fetching address from pincode:", err);
      setAddressStatus("Failed to fetch address from pincode.");
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleImageChange = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to upload an image."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImageFile(result.assets[0]);
    }
  };

  const handleSave = async () => {
    const dataToUpdate = new FormData();

    for (const key in formData) {
      if (key === "address") {
        dataToUpdate.append("address", JSON.stringify(formData.address));
      } else {
        dataToUpdate.append(key, (formData as any)[key]);
      }
    }

    if (profileImageFile) {
      const uri = profileImageFile.uri;
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const type = match ? `image/${match[1]}` : `image`;

      dataToUpdate.append("shopImage", {
        uri: uri,
        name: filename,
        type: type,
      } as any);
    }

    const result = await dispatch(
      updateDeliveryBoyProfile(dataToUpdate as any)
    );
    if (updateDeliveryBoyProfile.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Profile Updated",
        text2: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
      setProfileImageFile(null);
      dispatch(fetchDeliveryBoyProfile());
    } else {
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: result.payload?.message || "Something went wrong.",
      });
    }
  };

  const handleToggleAvailability = async () => {
    const result = await dispatch(toggleAvailability({}));
    if (toggleAvailability.fulfilled.match(result)) {
      Toast.show({
        type: "success",
        text1: "Status Updated",
        text2: `You are now ${result.payload ? "Online" : "Offline"}.`,
      });
    } else if (toggleAvailability.rejected.match(result)) {
      Toast.show({
        type: "error",
        text1: "Update failed",
        text2: result.payload as string,
      });
    }
  };

  const handleLogout = () => {
    dispatch(logoutDeliveryBoy());
    navigation.navigate("Login");
  };

  if (loading || !deliveryBoy) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A3D2B" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const isAddressAutofilled =
    formData.address.state || formData.address.district;

  return (
    <View style={styles.mainContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome, {deliveryBoy.name}</Text>
          <Text style={styles.headerSubtitle}>
            Your personal dashboard for managing deliveries.
          </Text>
        </View>

        {/* Availability Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusInfo}>
            <View
              style={[
                styles.statusIconContainer,
                {
                  backgroundColor: deliveryBoy.isAvailable
                    ? "#E8F8E5"
                    : "#FBE6E6",
                },
              ]}
            >
              <Ionicons
                name={
                  deliveryBoy.isAvailable ? "checkmark-circle" : "close-circle"
                }
                size={28}
                color={deliveryBoy.isAvailable ? "#4CAF50" : "#F44336"}
              />
            </View>
            <View>
              <Text style={styles.statusText}>
                {deliveryBoy.isAvailable
                  ? "Available for Delivery"
                  : "Currently Unavailable"}
              </Text>
              <Text style={styles.statusSubtext}>
                {deliveryBoy.isAvailable
                  ? "You are ready to accept new orders."
                  : "Take a break, you won't receive orders."}
              </Text>
            </View>
          </View>
          
        </View>

        <View>
           <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor: deliveryBoy.isAvailable
                  ? "#F44336"
                  : "#4CAF50",
              },
            ]}
            onPress={handleToggleAvailability}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.toggleButtonText}>
                {deliveryBoy.isAvailable ? "Go Offline" : "Go Online"}
              </Text>
            )}
          </TouchableOpacity>
       </View>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Profile Header with Image and Name */}
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              {deliveryBoy.shopImage ? (
                <Image
                  source={{ uri: deliveryBoy.shopImage }}
                  style={styles.profileImage}
                />
              ) : (
                <Ionicons name="person-circle-outline" size={90} color="#fff" />
              )}
              <View
                style={[
                  styles.availabilityDot,
                  {
                    backgroundColor: deliveryBoy.isAvailable
                      ? "#4CAF50"
                      : "#F44336",
                  },
                ]}
              />
            </View>
            <View style={styles.profileHeaderText}>
              <Text style={styles.profileName}>{deliveryBoy.name}</Text>
              <Text style={styles.profileType}>Delivery Partner</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              style={styles.editIcon}
            >
              <Ionicons
                name={isEditing ? "close-circle-outline" : "create-outline"}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Profile Content */}
          <View style={styles.profileContent}>
            {isEditing ? (
              // Edit Mode Form
              <View style={styles.editForm}>
                <TouchableOpacity
                  style={styles.imagePicker}
                  onPress={handleImageChange}
                >
                  <View style={styles.imagePickerContainer}>
                    {profileImageFile ? (
                      <Image
                        source={{ uri: profileImageFile.uri }}
                        style={styles.imagePreview}
                      />
                    ) : deliveryBoy.shopImage ? (
                      <Image
                        source={{ uri: deliveryBoy.shopImage }}
                        style={styles.imagePreview}
                      />
                    ) : (
                      <Ionicons
                        name="camera-outline"
                        size={50}
                        color={colors.textLight}
                      />
                    )}
                  </View>
                  <Text style={styles.imagePickerText}>
                    Tap to change profile picture
                  </Text>
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChangeText={(text) => handleChange("name", text)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChangeText={(text) => handleChange("phone", text)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Shop Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter shop name"
                    value={formData.shopName}
                    onChangeText={(text) => handleChange("shopName", text)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Business Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Groceries, Food"
                    value={formData.businessType}
                    onChangeText={(text) => handleChange("businessType", text)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., ABC-1234"
                    value={formData.vehicleNo}
                    onChangeText={(text) => handleChange("vehicleNo", text)}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>License Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter license number"
                    value={formData.licenseNo}
                    onChangeText={(text) => handleChange("licenseNo", text)}
                  />
                </View>

                {/* Address Section with Location Integration */}
                <View style={styles.addressSection}>
                  <Text style={styles.sectionTitle}>Address Details</Text>
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={handleFetchLocation}
                  >
                    {loadingAddress ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="locate-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.locationButtonText}>
                          Update from My Location
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {addressStatus ? (
                    <Text style={styles.addressStatusText}>
                      {addressStatus}
                    </Text>
                  ) : null}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Pincode</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Pincode"
                      value={formData.address.pincode}
                      onChangeText={(value) =>
                        handleChange("address.pincode", value)
                      }
                      onBlur={handlePincodeBlur}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>State</Text>
                    <TextInput
                      style={[
                        styles.input,
                        isAddressAutofilled && styles.inputDisabled,
                      ]}
                      placeholder="State"
                      value={formData.address.state}
                      onChangeText={(value) =>
                        handleChange("address.state", value)
                      }
                      editable={!isAddressAutofilled}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>District</Text>
                    <TextInput
                      style={[
                        styles.input,
                        isAddressAutofilled && styles.inputDisabled,
                      ]}
                      placeholder="District"
                      value={formData.address.district}
                      onChangeText={(value) =>
                        handleChange("address.district", value)
                      }
                      editable={!isAddressAutofilled}
                    />
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                  >
                    <Ionicons name="save-outline" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setIsEditing(false)}
                  >
                    <Ionicons name="close-outline" size={20} color="#333" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // View Mode
              <View style={styles.viewMode}>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{deliveryBoy.email}</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{deliveryBoy.phone}</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="business-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Shop Name</Text>
                    <Text style={styles.infoValue}>
                      {deliveryBoy.shopName || "N/A"}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="briefcase-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Business Type</Text>
                    <Text style={styles.infoValue}>
                      {deliveryBoy.businessType || "N/A"}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="car-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Vehicle Number</Text>
                    <Text style={styles.infoValue}>
                      {deliveryBoy.vehicleNo || "N/A"}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="id-card-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>License Number</Text>
                    <Text style={styles.infoValue}>
                      {deliveryBoy.licenseNo || "N/A"}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={colors.textLight}
                  />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={styles.infoValue}>
                      {`${deliveryBoy.address?.district || "N/A"}, ${
                        deliveryBoy.address?.state || "N/A"
                      }`}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        {/* <TouchableOpacity style={styles.navBarItem}>
          <Ionicons name="home-outline" size={24} color={colors.textLight} />
          <Text style={styles.navBarText}>Home</Text>
        </TouchableOpacity> */}
        <TouchableOpacity
          style={styles.navBarItem}
          onPress={() =>
            navigation.navigate("DeliveryBoyOrders", { id: deliveryBoy._id })
          }
        >
          <View style={styles.navBarCenterIconContainer}>
            <Ionicons name="receipt-outline" size={30} color="#fff" />
          </View>
          <Text style={styles.navBarTextActive}>Orders</Text>
        </TouchableOpacity>
        {/* <TouchableOpacity style={styles.navBarItem}>
          <Ionicons
            name="person-outline"
            size={24}
            color={colors.primaryDark}
          />
          <Text style={styles.navBarTextActive}>Profile</Text>
        </TouchableOpacity> */}
      </View>
      <Toast />
    </View>
  );
}

const colors = {
  primaryDark: "#0A3D2B",
  primaryGreen: "#4CAF50",
  primaryRed: "#F44336",
  textDark: "#333333",
  textLight: "#888888",
  background: "#F4F4F9",
  cardBackground: "#FFFFFF",
  shadowColor: "#000000",
};

const shadow = {
  elevation: 5,
  shadowColor: colors.shadowColor,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 5,
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textLight,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 30,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textDark,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#777777",
    marginTop: 4,
    textAlign: "center",
  },
  statusCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: colors.cardBackground,
    borderRadius: 15,
    ...shadow,
    marginBottom: 25,
  },
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusIconContainer: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 18,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.textDark,
  },
  statusSubtext: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 25,
    minWidth: 120,
    alignItems: "center",
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 15,
    ...shadow,
    marginBottom: 25,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 25,
    backgroundColor: colors.primaryDark,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  profileImageContainer: {
    position: "relative",
    width: 90,
    height: 90,
    marginRight: 20,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  availabilityDot: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileHeaderText: {
    flex: 1,
    justifyContent: "center",
  },
  profileName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  profileType: {
    fontSize: 16,
    color: "#D6E5D9",
  },
  editIcon: {
    padding: 5,
  },
  profileContent: {
    padding: 25,
  },
  viewMode: {},
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  infoTextContainer: {
    marginLeft: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textDark,
    marginTop: 2,
  },
  editForm: {},
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: "bold",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D3D3D3",
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: "#F8F8F8",
  },
  inputDisabled: {
    backgroundColor: "#EFEFEF",
    color: colors.textLight,
  },
  addressSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingTop: 20,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  locationButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
  addressStatusText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: "center",
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryDark,
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEFEF",
    padding: 15,
    borderRadius: 10,
    flex: 1,
  },
  cancelButtonText: {
    color: colors.textDark,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
  imagePicker: {
    alignItems: "center",
    marginBottom: 20,
  },
  imagePickerContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#EFEFEF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.textLight,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },
  imagePickerText: {
    marginTop: 10,
    color: colors.textLight,
    fontSize: 14,
    textAlign: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.textDark,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginBottom: 25,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
  navBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingVertical: 20,
    paddingHorizontal: 5,
    elevation: 10,
  },
  navBarItem: {
    flex: 1,
    alignItems: "center",
  },
  navBarText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.textLight,
  },
  navBarTextActive: {
    fontSize: 12,
    marginTop: 4,
    color: colors.primaryDark,
    fontWeight: "bold",
  },
  navBarCenterIconContainer: {
    backgroundColor: colors.primaryDark,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -35,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
});
