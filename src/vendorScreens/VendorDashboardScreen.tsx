import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  logoutVendor,
  updateVendorProfile,
  fetchVendorProfile,
  toggleVendorStatus,
} from "../features/vendor/vendorAuthSlice";
import { fetchVendorOrders } from "../features/vendor/vendorOrderSlice";
import { RootState, AppDispatch } from "../app/store";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import VendorProfileCard from "./VendorProfileCard";
import VendorDashboardSidePanel from "./VendorDashboardSidePanel";
import {
  User,
  AlertCircle,
  CheckCircle,
  Home,
  Receipt,
  MessageCircle,
} from "lucide-react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import { Vendor, Order, Address } from "../types/models";
import { Ionicons } from "@expo/vector-icons";

type RootStackParamList = {
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorCRUD: undefined;
  VendorOrderList: undefined;
  VendorActiveDeliveryBoys: { orderId: string };
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
  VendorChatScreen: undefined;
  VendorProductCRUD: undefined;
};

type VendorDashboardNavigationProp = StackNavigationProp<
  RootStackParamList,
  "VendorDashboard"
>;

export default function VendorDashboard() {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<VendorDashboardNavigationProp>();

  const { vendor, loading: vendorAuthLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const {
    orders: vendorOrders,
    loading: vendorOrdersLoading,
  } = useSelector((state: RootState) => state.vendorOrders);

  const [isEditing, setIsEditing] = useState(false);
  const [shopImageFile, setShopImageFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Vendor>({
    _id: "",
    name: "",
    email: "",
    phone: "",
    shopName: "",
    shopImage: "",
    businessType: "",
    gstNo: "",
    deliveryRange: 0,
    address: {
      latitude: "",
      longitude: "",
      pincode: "",
      state: "",
      district: "",
      country: "India",
    },
    isOnline: false,
    isApproved: false,
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        _id: vendor._id,
        name: vendor.name || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        shopName: vendor.shopName || "",
        shopImage: vendor.shopImage || "",
        businessType: vendor.businessType || "",
        gstNo: vendor.gstNo || "",
        deliveryRange: vendor.deliveryRange || 0,
        address: {
          latitude: vendor.address?.latitude?.toString() || "",
          longitude: vendor.address?.longitude?.toString() || "",
          pincode: vendor.address?.pincode || "",
          state: vendor.address?.state || "",
          district: vendor.address?.district || "",
          country: vendor.address?.country || "India",
        },
        isOnline: vendor.isOnline || false,
        isApproved: vendor.isApproved || false,
      });
      setIsEditing(false);
      setShopImageFile(null);
    }
  }, [vendor]);

  useEffect(() => {
    if (vendor?._id) {
      dispatch(fetchVendorOrders(vendor._id));
    }
  }, [dispatch, vendor?._id]);

  const totalOrders = vendorOrders.length;
  const pendingOrders = vendorOrders.filter(
    (order) => order.status === "placed" || order.status === "processing"
  ).length;
  const totalRevenue = vendorOrders.reduce((sum, order) => {
    if (order.items && Array.isArray(order.items)) {
      return sum + order.items.reduce((s, item) => s + item.price * item.quantity, 0);
    }
    return sum;
  }, 0);

  const showModal = (message: string) => Alert.alert("Information", message);

  const handleChange = useCallback((name: string, value: string) => {
    if (name.startsWith("address.")) {
      const key = name.split(".")[1] as keyof Address;
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setSignupError(null);
  }, []);

  const handleImageChange = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Denied", "Camera roll access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setShopImageFile(asset);
      setFormData((prev) => ({ ...prev, shopImage: asset.uri }));
    }
  }, []);

  // ---------- FIXED: Fetch Current Location (uses Expo reverseGeocode) ----------
  const handleFetchLocation = useCallback(async () => {
    setLoadingAddress(true);
    setSignupError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showModal("Location permission denied. Please enable it in settings.");
        setLoadingAddress(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      // Store as strings
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        },
      }));

      // Reverse geocode using Expo (no API key, reliable)
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const geo = geocode[0];
        setFormData((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            pincode: geo.postalCode || prev.address.pincode,
            state: geo.region || prev.address.state,
            district: geo.district || prev.address.district,
            country: geo.country || prev.address.country,
          },
        }));
        showModal("Address auto-filled from your location.");
      } else {
        showModal("Could not get address details. Please enter manually.");
      }
    } catch (error: any) {
      console.error("Location fetch error:", error);
      showModal("Failed to fetch location: " + error.message);
    } finally {
      setLoadingAddress(false);
    }
  }, [showModal]);

  // ---------- FIXED: Pincode auto-fill using PostPIN India API ----------
  const handlePincodeBlur = useCallback(async () => {
    const pincode = formData.address.pincode;
    if (!pincode || pincode.length !== 6 || isNaN(Number(pincode))) {
      setSignupError("Please enter a valid 6-digit pincode.");
      return;
    }
    setSignupError(null);
    setLoadingAddress(true);

    try {
      // Use free PostPIN India API
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = response.data;

      if (data && data[0]?.Status === "Success") {
        const postOffice = data[0].PostOffice[0];
        if (postOffice) {
          setFormData((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              state: postOffice.State || prev.address.state,
              district: postOffice.District || prev.address.district,
              country: postOffice.Country || prev.address.country,
            },
          }));
          showModal("Address details updated from pincode.");
        } else {
          showModal("No address found for this pincode.");
        }
      } else {
        showModal("Invalid pincode or no data found.");
      }
    } catch (error: any) {
      console.error("Pincode fetch error:", error);
      showModal("Failed to fetch pincode details: " + error.message);
    } finally {
      setLoadingAddress(false);
    }
  }, [formData.address.pincode, showModal]);

  const handleSave = useCallback(async () => {
    const dataToUpdate = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (key !== "address" && key !== "shopImage" && value !== undefined && value !== null) {
        dataToUpdate.append(key, String(value));
      }
    });

    if (formData.address) {
      Object.entries(formData.address).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dataToUpdate.append(`address.${key}`, String(value));
        }
      });
    }

    if (shopImageFile) {
      const uriParts = shopImageFile.uri.split(".");
      const fileType = uriParts[uriParts.length - 1];
      const fileName = `shop_image_${Date.now()}.${fileType}`;
      dataToUpdate.append("shopImage", {
        uri: shopImageFile.uri,
        name: fileName,
        type: `image/${fileType}`,
      } as any);
    }

    if (!formData.name || !formData.email || !formData.shopName) {
      Alert.alert("Validation Error", "Please fill all required fields.");
      return;
    }
    if (!formData.address.latitude || !formData.address.longitude || !formData.address.pincode) {
      Alert.alert(
        "Validation Error",
        "Please provide complete address (latitude, longitude, pincode). Use 'Fetch Location' or enter pincode."
      );
      return;
    }

    const result = await dispatch(updateVendorProfile(dataToUpdate));
    if (result.meta.requestStatus === "fulfilled") {
      Alert.alert("Success", "Profile updated!");
      setIsEditing(false);
      setShopImageFile(null);
      dispatch(fetchVendorProfile());
    } else {
      Alert.alert("Update Failed", (result.payload as string) || "Unknown error.");
    }
  }, [dispatch, formData, shopImageFile]);

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: () => {
          dispatch(logoutVendor());
          Alert.alert("Success", "Logged out!");
        },
      },
    ]);
  }, [dispatch]);

  const handleToggleOnlineStatus = useCallback(async () => {
    if (!vendor) return;
    const newStatus = !vendor.isOnline;
    const result = await dispatch(toggleVendorStatus(newStatus));
    if (result.meta.requestStatus === "fulfilled") {
      Alert.alert("Status Updated", `Vendor is now ${newStatus ? "Online" : "Offline"}.`);
    } else {
      Alert.alert("Update Failed", (result.payload as string) || "Error.");
    }
  }, [dispatch, vendor]);

  const getStatusDisplay = useCallback(
    (isApproved: boolean | undefined, isOnline: boolean | undefined) => {
      let textStyle: any[] = [styles.statusBase];
      let icon = null;
      let text = "Unknown";
      if (!isApproved) {
        textStyle.push(styles.statusPending);
        icon = <AlertCircle size={12} color="#b45309" />;
        text = "Pending Approval";
      } else {
        if (isOnline) {
          textStyle.push(styles.statusOnline);
          icon = <CheckCircle size={12} color="#166534" />;
          text = "Online";
        } else {
          textStyle.push(styles.statusOffline);
          icon = <AlertCircle size={12} color="#4b5563" />;
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

  if (!vendor) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.accessDeniedContainer}>
          <View style={styles.accessDeniedCard}>
            <View style={styles.accessDeniedIconBg}>
              <User size={32} color="#dc2626" />
            </View>
            <Text style={styles.accessDeniedTitle}>Access Denied</Text>
            <Text style={styles.accessDeniedText}>Please login to continue.</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("VendorLogin")}
              style={styles.accessDeniedButton}
            >
              <Text style={styles.accessDeniedButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Vendor Dashboard</Text>
          <Text style={styles.headerWelcome}>Welcome, {vendor.name || vendor.shopName}!</Text>
        </View>

        <View style={styles.dashboardGrid}>
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

      <View style={styles.bottomNav}>
        <TouchableOpacity
          onPress={() => navigation.navigate("VendorChatScreen")}
          style={styles.navItem}
        >
          <MessageCircle size={24} color="#6c757d" />
          <Text style={styles.navText}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Home size={24} color="#005612" />
          <Text style={[styles.navText, { color: "#005612" }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("VendorProductCRUD")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#6c757d" />
          <Text style={styles.navText}>Add Product</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("VendorOrderList")}
        >
          <Receipt size={24} color="#6c757d" />
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- STYLES (unchanged) ----------
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  contentContainer: { paddingVertical: 32, paddingHorizontal: 16, paddingBottom: 80 },
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#1e293b", marginBottom: 8 },
  headerWelcome: { fontSize: 16, color: "#475569" },
  dashboardGrid: { flexDirection: "column", gap: 32 },
  profileSection: { flex: 2 },
  statusBase: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  statusPending: { backgroundColor: "#fef3c7" },
  statusOnline: { backgroundColor: "#dcfce7" },
  statusOffline: { backgroundColor: "#f3f4f6" },
  statusText: { fontSize: 12, fontWeight: "500" },
  accessDeniedContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  accessDeniedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    maxWidth: 400,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  accessDeniedIconBg: {
    width: 64,
    height: 64,
    backgroundColor: "#fee2e2",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  accessDeniedTitle: { fontSize: 20, fontWeight: "600", color: "#1e293b", marginBottom: 8 },
  accessDeniedText: { fontSize: 16, color: "#475569", marginBottom: 24, textAlign: "center" },
  accessDeniedButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#2563eb",
  },
  accessDeniedButtonText: { fontSize: 14, fontWeight: "500", color: "#ffffff" },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 10,
  },
  navItem: { alignItems: "center", justifyContent: "center", padding: 8 },
  navText: { fontSize: 12, fontWeight: "500", marginTop: 4 },
});