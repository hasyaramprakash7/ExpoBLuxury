import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  logoutVendor,
  updateVendorProfile,
  fetchVendorProfile,
  toggleVendorStatus,
} from "../features/vendor/vendorAuthSlice";
import { fetchVendorOrders } from "../features/vendor/vendorOrderSlice";
import { RootState, AppDispatch } from "../app/store"; // Import RootState and AppDispatch
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  SafeAreaView, // Import SafeAreaView
} from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import VendorProfileCard from "./VendorProfileCard";
import VendorDashboardSidePanel from "./VendorDashboardSidePanel";
import {
  User,
  AlertCircle,
  CheckCircle,
  MapPin,
  Loader2,
  Home,
  ShoppingCart,
  Receipt,
  Search,
} from "lucide-react-native"; // Using lucide-react-native for icons
import * as Location from "expo-location"; // For geolocation
import * as ImagePicker from "expo-image-picker"; // For image picking
import axios from "axios"; // Keep axios for Nominatim API calls
import { Vendor, Order, Address } from "../types/models"; // Import types
import { Ionicons } from "@expo/vector-icons";

// Define the RootStackParamList for navigation
type RootStackParamList = {
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorCRUD: undefined;
  VendorOrderList: undefined;
  VendorActiveDeliveryBoys: { orderId: string };
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
};

type VendorDashboardNavigationProp = StackNavigationProp<
  RootStackParamList,
  "VendorDashboard"
>;

/**
 * VendorDashboard Component (Parent Container)
 *
 * This component acts as the main dashboard container for vendors.
 * It manages the core state and logic, and renders sub-components for profile management,
 * quick actions, and business statistics.
 */
export default function VendorDashboard() {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<VendorDashboardNavigationProp>();

  // Select vendor data and loading status from the Redux store
  const { vendor, loading: vendorAuthLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  // Select orders data and loading status from the vendorOrders slice
  const {
    orders: vendorOrders,
    loading: vendorOrdersLoading,
    error: vendorOrdersError,
  } = useSelector((state: RootState) => state.vendorOrders);

  // State for managing edit mode and form data
  const [isEditing, setIsEditing] = useState(false);
  const [shopImageFile, setShopImageFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null); // Stores the actual file object for upload
  const [formData, setFormData] = useState<Vendor>({
    _id: "", // Will be populated from Redux vendor object
    name: "",
    email: "",
    phone: "",
    shopName: "",
    shopImage: "", // This will hold the URL for display (either existing or object URL for new file)
    businessType: "",
    gstNo: "",
    deliveryRange: undefined, // Ensure this matches backend type
    address: {
      latitude: undefined,
      longitude: undefined,
      pincode: "",
      state: "",
      district: "",
      country: "India",
    },
    isOnline: false,
    isApproved: false, // Default to false, will be updated from backend
  });

  // State for geolocation/pincode fetching
  const [loadingAddress, setLoadingAddress] = useState(false); // Combined loading state
  const [signupError, setSignupError] = useState<string | null>(null); // For general form errors including address

  /**
   * Helper for showing modal/alert messages using React Native Alert.
   */
  const showModal = (message: string) => {
    Alert.alert("Information", message);
  };

  /**
   * useEffect Hook: Populates formData when vendor data is loaded or updated from Redux.
   * Ensures form fields reflect the current vendor's profile information.
   */
  useEffect(() => {
    if (vendor) {
      setFormData({
        _id: vendor._id,
        name: vendor.name || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        shopName: vendor.shopName || "",
        shopImage: vendor.shopImage || "", // Use existing shop image URL
        businessType: vendor.businessType || "",
        gstNo: vendor.gstNo || "",
        deliveryRange: vendor.deliveryRange, // Ensure this matches backend type
        address: {
          latitude: vendor.address?.latitude,
          longitude: vendor.address?.longitude,
          pincode: vendor.address?.pincode || "",
          state: vendor.address?.state || "",
          district: vendor.address?.district || "",
          country: vendor.address?.country || "India",
        },
        isOnline: vendor.isOnline,
        isApproved: vendor.isApproved,
      });
      // When vendor data changes, ensure we are not in editing mode and clear any selected file
      setIsEditing(false);
      setShopImageFile(null);
    }
  }, [vendor]); // Dependency array ensures this runs when 'vendor' object changes

  /**
   * useEffect Hook: Fetches vendor orders when the vendor ID is available.
   */
  useEffect(() => {
    if (vendor?._id) {
      dispatch(fetchVendorOrders(vendor._id)); // Pass vendor._id as argument
    }
  }, [dispatch, vendor?._id]); // Dispatch when vendor ID becomes available or changes

  /**
   * Calculate Order Statistics
   * These calculations will now be derived directly from the `vendorOrders` array.
   */
  const totalOrders = vendorOrders.length;
  const pendingOrders = vendorOrders.filter(
    (order) => order.status === "placed" || order.status === "processing"
  ).length;

  const totalRevenue = vendorOrders.reduce((sum, order) => {
    let orderRevenue = 0;
    // Assuming order.items is always an array of OrderItem
    if (order.items && Array.isArray(order.items)) {
      orderRevenue = order.items.reduce((itemSum, item) => {
        return itemSum + item.price * item.quantity;
      }, 0);
    }
    // If your backend also sends a totalAmount field at the top level of the Order object,
    // you might want to use that instead or as a fallback.
    // For now, relying on sum of items.
    return sum + orderRevenue;
  }, 0);

  /**
   * Handles changes for all input fields in the form.
   * Updates the formData state based on the input name and value.
   */
  const handleChange = useCallback((name: string, value: string) => {
    // Handle nested address fields specifically
    if (name.startsWith("address.")) {
      const key = name.split(".")[1] as keyof Address; // Extracts 'latitude', 'pincode', etc.
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [key]: value,
        },
      }));
    } else {
      // Handle other top-level fields
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setSignupError(null); // Clear errors on change
  }, []);

  /**
   * Handles the selection of a new shop image file using ImagePicker.
   */
  const handleImageChange = useCallback(async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Denied",
        "Permission to access camera roll is required!"
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (
      !pickerResult.canceled &&
      pickerResult.assets &&
      pickerResult.assets.length > 0
    ) {
      const selectedAsset = pickerResult.assets[0];
      setShopImageFile(selectedAsset);
      setFormData((prev) => ({ ...prev, shopImage: selectedAsset.uri }));
    }
  }, []);

  /**
   * Fetches current geolocation and reverse geocodes it to get address details.
   */
  const handleFetchLocation = useCallback(async () => {
    console.log(
      "handleFetchLocation triggered: Attempting to get geolocation..."
    );
    setLoadingAddress(true);
    setSignupError(null); // Clear previous errors

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showModal(
          "Permission to access location was denied. Please enable it in settings."
        );
        setLoadingAddress(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      console.log("Geolocation success:", { latitude, longitude });

      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, latitude, longitude },
      }));

      // OpenStreetMap Nominatim API for reverse geocoding
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse`;
      const response = await axios.get(nominatimUrl, {
        params: {
          lat: latitude,
          lon: longitude,
          format: "json",
          addressdetails: 1,
        },
        headers: {
          "User-Agent": "YourAppName/1.0 (your-email@example.com)", // Replace with your app name and email
        },
      });

      console.log("Reverse geocoding success:", response.data);

      const address = response.data.address || {};

      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          pincode: address.postcode || "",
          state: address.state || "",
          district: address.county || address.city_district || "",
          country: address.country || "",
          latitude: latitude, // Ensure latitude/longitude are kept
          longitude: longitude,
        },
      }));
      showModal("Address auto-filled from your location.");
    } catch (error: any) {
      console.error("Error fetching address from coordinates:", error);
      showModal(
        "Could not fetch address details automatically. Please enter manually. Error: " +
          error.message
      );
    } finally {
      setLoadingAddress(false);
    }
  }, [showModal]);

  /**
   * Handles autofilling state, district, and country based on pincode.
   * This function will be triggered onBlur from the pincode input field.
   */
  const handlePincodeBlur = useCallback(async () => {
    const { pincode } = formData.address;

    // Basic pincode validation for India (6 digits)
    if (!pincode || pincode.length !== 6 || isNaN(Number(pincode))) {
      setSignupError("Please enter a valid 6-digit pincode.");
      return;
    }
    setSignupError(null); // Clear previous errors

    try {
      setLoadingAddress(true);
      console.log("Fetching address using pincode:", pincode);

      // Using Nominatim Search API for pincode
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            postalcode: pincode,
            format: "json",
            addressdetails: 1,
            countrycodes: "in", // Limit search to India
          },
          headers: {
            "User-Agent": "YourAppName/1.0 (your-email@example.com)", // Replace with your app name and email
          },
        }
      );

      console.log("Pincode search response:", res.data);

      if (res.data.length > 0) {
        const address = res.data[0].address;

        setFormData((prev) => ({
          // Corrected from setForm to setFormData
          ...prev,
          address: {
            ...prev.address,
            // Note: Nominatim's 'state' and 'county' might not always map perfectly
            // to Indian 'State' and 'District' names. Adjust mapping if needed.
            state: address.state || "",
            district: address.county || address.city_district || "",
            country: address.country || "",
            // Do NOT clear latitude and longitude here if they were already set by geolocation.
            // If you want pincode to override location, uncomment next two lines:
            // latitude: res.data[0].lat || "",
            // longitude: res.data[0].lon || "",
          },
        }));
        showModal("Address details updated based on pincode.");
      } else {
        showModal("No address found for this pincode.");
      }
    } catch (err: any) {
      console.error("Error fetching address from pincode:", err);
      showModal(
        "Failed to fetch address from pincode. Please check the pincode or enter details manually. Error: " +
          err.message
      );
    } finally {
      setLoadingAddress(false);
    }
  }, [formData.address.pincode, showModal]); // Dependency: re-run if pincode changes

  /**
   * Handles saving the updated vendor profile.
   * Dispatches the updateVendorProfile action and provides user feedback.
   */
  const handleSave = useCallback(async () => {
    const dataToUpdate = new FormData();

    // Append all string/number fields
    Object.entries(formData).forEach(([key, value]) => {
      if (
        key !== "address" &&
        key !== "shopImage" &&
        value !== undefined &&
        value !== null
      ) {
        dataToUpdate.append(key, String(value));
      }
    });

    // Append address fields
    if (formData.address) {
      Object.entries(formData.address).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dataToUpdate.append(`address.${key}`, String(value));
        }
      });
    }

    // Append shop image file if selected
    if (shopImageFile) {
      const uriParts = shopImageFile.uri.split(".");
      const fileType = uriParts[uriParts.length - 1];
      const fileName = `shop_image_${Date.now()}.${fileType}`;

      dataToUpdate.append("shopImage", {
        uri: shopImageFile.uri,
        name: fileName,
        type: `image/${fileType}`,
      } as any); // Type assertion needed for FormData in RN
    }

    // Ensure deliveryRange is a number if your backend expects it as such
    if (formData.deliveryRange !== undefined) {
      dataToUpdate.append("deliveryRange", String(formData.deliveryRange));
    }

    // Basic validation before saving
    if (!formData.name || !formData.email || !formData.shopName) {
      Alert.alert(
        "Validation Error",
        "Please fill in all required profile fields (Name, Email, Shop Name)."
      );
      return;
    }
    if (
      !formData.address.latitude ||
      !formData.address.longitude ||
      !formData.address.pincode
    ) {
      Alert.alert(
        "Validation Error",
        "Please provide complete address details including latitude, longitude, and pincode. Use 'Fetch Current Location' or enter pincode to autofill."
      );
      return;
    }

    const result = await dispatch(updateVendorProfile(dataToUpdate));

    if (result.meta.requestStatus === "fulfilled") {
      Alert.alert("Success", "Profile updated successfully!");
      setIsEditing(false);
      setShopImageFile(null); // Clear the file after successful upload
      dispatch(fetchVendorProfile()); // Re-fetch to ensure latest data
    } else {
      Alert.alert(
        "Update Failed",
        (result.payload as string) || "Unknown error occurred."
      );
    }
  }, [dispatch, formData, shopImageFile]);

  /**
   * Handles vendor logout.
   * Prompts for confirmation before dispatching the logoutVendor action.
   */
  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Yes",
        onPress: () => {
          // This dispatch will update the Redux state,
          // causing the AppNavigator in App.tsx to re-render
          // and switch to the AuthFlow, which contains VendorLogin.
          dispatch(logoutVendor());
          Alert.alert("Success", "Logged out successfully!");
        },
      },
    ]);
  }, [dispatch]);

  /**
   * Handles toggling the vendor's online/offline status.
   * Dispatches the toggleVendorStatus async thunk.
   */
  const handleToggleOnlineStatus = useCallback(async () => {
    if (!vendor) return;

    const currentIsOnline = vendor.isOnline;
    const newIsOnlineStatus = !currentIsOnline;

    const result = await dispatch(toggleVendorStatus(newIsOnlineStatus));

    if (result.meta.requestStatus === "fulfilled") {
      Alert.alert(
        "Status Updated",
        `Vendor is now ${newIsOnlineStatus ? "Online" : "Offline"}.`
      );
    } else {
      Alert.alert(
        "Update Failed",
        (result.payload as string) || "Unknown error."
      );
    }
  }, [dispatch, vendor]);

  /**
   * Function to determine status display style based on isApproved and isOnline.
   * This function is kept in the parent as it's used by both child components.
   * @param {boolean} isApproved - Vendor's approval status.
   * @param {boolean} isOnline - Vendor's online status.
   * @returns {JSX.Element} A styled Text component with icon and text.
   */
  const getStatusDisplay = useCallback(
    (isApproved: boolean | undefined, isOnline: boolean | undefined) => {
      let textStyle: any = [styles.statusBase];
      let icon = null;
      let text = "Unknown";

      if (!isApproved) {
        textStyle.push(styles.statusPending);
        icon = <AlertCircle size={12} color="#b45309" />; // Tailwind yellow-800
        text = "Pending Approval";
      } else {
        if (isOnline) {
          textStyle.push(styles.statusOnline);
          icon = <CheckCircle size={12} color="#166534" />; // Tailwind green-800
          text = "Online";
        } else {
          textStyle.push(styles.statusOffline);
          icon = <AlertCircle size={12} color="#4b5563" />; // Tailwind gray-800
          text = "Offline";
        }
      }

      return (
        <View style={textStyle}>
          {icon}
          <Text style={styles.statusText}>{text}</Text>
        </View>
      );
    },
    []
  );

  // --- Conditional Rendering: Access Denied ---
  if (!vendor) {
    return (
      <View style={styles.accessDeniedContainer}>
        <View style={styles.accessDeniedCard}>
          <View style={styles.accessDeniedIconBg}>
            <User size={32} color="#dc2626" />
          </View>
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            No vendor data found. Please login to continue.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("VendorLogin")}
            style={styles.accessDeniedButton}
          >
            <Text style={styles.accessDeniedButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- Main Vendor Dashboard UI ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Vendor Dashboard</Text>
          <Text style={styles.headerWelcome}>
            Welcome, {vendor.name || vendor.shopName}!
          </Text>
        </View>

        <View style={styles.dashboardGrid}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <VendorProfileCard
              vendor={vendor}
              loading={vendorAuthLoading}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              formData={formData}
              handleChange={handleChange}
              handleImageChange={handleImageChange}
              handleSave={handleSave}
              getStatusDisplay={getStatusDisplay}
              handleFetchLocation={handleFetchLocation}
              handlePincodeBlur={handlePincodeBlur}
              loadingAddress={loadingAddress}
              signupError={signupError}
              showModal={showModal}
            />
          </View>

          {/* Quick Actions & Business Stats */}
          <VendorDashboardSidePanel
            vendor={vendor}
            loading={vendorAuthLoading}
            handleToggleOnlineStatus={handleToggleOnlineStatus}
            handleLogout={handleLogout}
            getStatusDisplay={getStatusDisplay}
            totalOrders={totalOrders}
            pendingOrders={pendingOrders}
            totalRevenue={totalRevenue}
            statsLoading={vendorOrdersLoading}
            navigation={navigation}
          />
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Home size={24} color="#005612" />
          <Text style={[styles.navText, { color: "#005612" }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("VendorProductCRUD")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#6c757d" />
          <Text style={[styles.navText, { color: "#6c757d" }]}>
            Add Product
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("VendorOrderList")}
          style={styles.navItem}
          activeOpacity={0.7}
        >
          <View style={styles.navItem}>
            <Receipt size={24} color="#6c757d" />
          </View>
          <Text style={styles.navText}>ORDERS</Text>
        </TouchableOpacity>

        {/* <TouchableOpacity style={styles.navItem}>
          <Receipt size={24} color="#6c757d" />
          <Text style={[styles.navText, { color: "#6c757d" }]}>Orders</Text>
        </TouchableOpacity> */}
        {/* <TouchableOpacity style={styles.navItem}>
          <Search size={24} color="#6c757d" />
          <Text style={[styles.navText, { color: "#6c757d" }]}>Search</Text>
        </TouchableOpacity> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc", // slate-50
  },
  contentContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    paddingBottom: 80, // Add padding at the bottom to prevent content from being hidden by the bottom nav
  },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e293b", // gray-800
    marginBottom: 8,
  },
  headerWelcome: {
    fontSize: 16,
    color: "#475569", // gray-600
  },
  dashboardGrid: {
    flexDirection: "column",
    gap: 32,
  },
  profileSection: {
    flex: 2, // Takes 2/3 of space on larger screens
  },
  // Status Display Styles
  statusBase: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999, // rounded-full
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusPending: {
    backgroundColor: "#fef3c7", // yellow-100
  },
  statusOnline: {
    backgroundColor: "#dcfce7", // green-100
  },
  statusOffline: {
    backgroundColor: "#f3f4f6", // gray-100
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500", // font-medium
  },
  // Access Denied Styles
  accessDeniedContainer: {
    flex: 1,
    backgroundColor: "#f8fafc", // slate-50
    alignItems: "center",
    justifyContent: "center",
  },
  accessDeniedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 32,
    alignItems: "center",
    maxWidth: 400,
    marginHorizontal: 16,
  },
  accessDeniedIconBg: {
    width: 64,
    height: 64,
    backgroundColor: "#fee2e2", // red-100
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b", // gray-800
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: "#475569", // gray-600
    marginBottom: 24,
    textAlign: "center",
  },
  accessDeniedButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#2563eb", // blue-600
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  accessDeniedButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
  },

  // --- Bottom Navigation Bar Styles ---
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingVertical: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  navText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
});
