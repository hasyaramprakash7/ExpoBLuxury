// src/vendorScreens/VendorDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  logoutVendor,
  updateVendorProfile,
  fetchVendorProfile,
  toggleVendorStatus,
  fetchSubscriptionStatus,
  verifySubscription,
  fetchVendorStats,
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
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
import * as ImagePicker from "expo-image-picker";
import { Vendor, Order } from "../types/models";
import { Ionicons } from "@expo/vector-icons";

interface VendorFormData extends Vendor {
  categories: string[];
  services: string[];
  tags: string[];
  operatingHours: any;
  isVerified: boolean;
  isPremium: boolean;
}

type RootStackParamList = {
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorCRUD: undefined;
  VendorOrderList: undefined;
  VendorActiveDeliveryBoys: { orderId: string };
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
  VendorChatScreen: undefined;
  VendorProductCRUD: undefined;
  SubscriptionChoice: undefined;
  SubscriptionManagement: undefined;
  SubscriptionPending: undefined;
};

type VendorDashboardNavigationProp = StackNavigationProp<
  RootStackParamList,
  "VendorDashboard"
>;

export default function VendorDashboard() {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<VendorDashboardNavigationProp>();

  const { vendor, loading: vendorAuthLoading, subscriptionStatus } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const {
    orders: vendorOrders,
    loading: vendorOrdersLoading,
  } = useSelector((state: RootState) => state.vendorOrders);
  const { categories, loading: categoriesLoading } = useSelector(
    (state: RootState) => state.categories
  );

  const [isEditing, setIsEditing] = useState(false);
  const [shopImageFile, setShopImageFile] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formData, setFormData] = useState<VendorFormData>({
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
      street: "",
      colony: "",
    },
    isOnline: false,
    isApproved: false,
    categories: [],
    services: [],
    tags: [],
    operatingHours: null,
    isVerified: false,
    isPremium: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchVendorProfile()),
        dispatch(fetchVendorStats()),
        dispatch(fetchSubscriptionStatus()),
        dispatch(fetchVendorOrders(vendor?._id || "")),
      ]);
    } catch (error) {
      Alert.alert("Refresh Failed", "Could not refresh dashboard data.");
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, vendor?._id]);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchSubscriptionStatus());
    }, [dispatch])
  );

  useEffect(() => {
    if (!vendorAuthLoading) {
      const effectiveStatus = subscriptionStatus || "inactive";
      if (effectiveStatus === "inactive" || effectiveStatus === "expired") {
        navigation.replace("SubscriptionChoice");
      }
    }
  }, [subscriptionStatus, vendorAuthLoading, navigation]);

  const parseArrayField = useCallback((field: any): string[] => {
    if (!field) return [];

    if (Array.isArray(field)) {
      if (field.length === 1 && typeof field[0] === 'string' && field[0].startsWith('[')) {
        try {
          const parsed = JSON.parse(field[0]);
          if (Array.isArray(parsed)) {
            return parsed.map(item => String(item).trim()).filter(Boolean);
          }
        } catch (_) {}
      }
      return field.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof field === 'string') {
      try {
        const parsed = JSON.parse(field);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim()).filter(Boolean);
        }
        return [String(parsed).trim()].filter(Boolean);
      } catch (_) {
        if (field.includes(',')) {
          return field.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [field.trim()].filter(Boolean);
      }
    }

    return [];
  }, []);

  useEffect(() => {
    if (vendor) {
      const parsedCategories = parseArrayField(vendor.categories);
      const parsedServices = parseArrayField(vendor.services);
      const parsedTags = parseArrayField(vendor.tags);

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
          street: vendor.address?.street || "",
          colony: vendor.address?.colony || "",
        },
        isOnline: vendor.isOnline || false,
        isApproved: vendor.isApproved || false,
        categories: parsedCategories,
        services: parsedServices,
        tags: parsedTags,
        operatingHours: vendor.operatingHours || null,
        isVerified: vendor.isVerified || false,
        isPremium: vendor.isPremium || false,
      });
      setIsEditing(false);
      setShopImageFile(null);
    }
  }, [vendor, parseArrayField]);

  useEffect(() => {
    if (vendor?._id) dispatch(fetchVendorOrders(vendor._id));
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

  const handleChange = useCallback((name: string, value: any) => {
    if (name === "address") {
      const sanitized = Object.keys(value).reduce((acc, key) => {
        const val = value[key];
        acc[key] = Array.isArray(val) ? val.filter(Boolean).join(', ') : String(val || '');
        return acc;
      }, {} as any);
      setFormData((prev) => ({ ...prev, address: sanitized }));
    } else if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      const sanitized = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value || '');
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: sanitized },
      }));
    } else if (name === "categories" || name === "services" || name === "tags") {
      const arr = Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : [];
      setFormData((prev) => ({ ...prev, [name]: arr }));
    } else if (name.startsWith("operatingHours.")) {
      const parts = name.split(".");
      const day = parts[1];
      const field = parts[2];
      setFormData((prev) => {
        const currentHours = prev.operatingHours || {};
        return {
          ...prev,
          operatingHours: {
            ...currentHours,
            [day]: {
              ...currentHours[day],
              [field]: value,
            },
          },
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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

  const handleSave = useCallback(async () => {
    const dataToUpdate = new FormData();
    const adminOnlyFields = ['isVerified', 'isPremium', 'isApproved'];

    Object.entries(formData).forEach(([key, value]) => {
      if (key === "address" || key === "operatingHours" || key === "shopImage") return;
      if (adminOnlyFields.includes(key)) return;
      if (Array.isArray(value)) {
        dataToUpdate.append(key, JSON.stringify(value));
      } else if (value !== undefined && value !== null) {
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

    if (formData.operatingHours) {
      const hoursValue = typeof formData.operatingHours === 'string'
        ? formData.operatingHours
        : JSON.stringify(formData.operatingHours);
      dataToUpdate.append("operatingHours", hoursValue);
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
      Alert.alert("Validation Error", "Fill all required fields.");
      return;
    }
    if (!formData.address.latitude || !formData.address.longitude || !formData.address.pincode) {
      Alert.alert("Validation Error", "Complete address is required.");
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
      { text: "Yes", onPress: () => dispatch(logoutVendor()) },
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

  if (vendorAuthLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#009632" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  if (subscriptionStatus === "pending") {
    const [verifying, setVerifying] = useState(false);
    const handleVerifyPayment = async () => {
      setVerifying(true);
      try {
        const result = await dispatch(verifySubscription()).unwrap();
        Alert.alert(
          "Verification Result",
          `Status: ${result.subscriptionStatus}\nRazorpay: ${result.razorpayStatus}`
        );
        if (result.subscriptionStatus === "active") navigation.replace("VendorDashboard");
      } catch (error) {
        Alert.alert("Error", error as string || "Verification failed");
      } finally {
        setVerifying(false);
      }
    };
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pendingContainer}>
          <ActivityIndicator size="large" color="#009632" />
          <Text style={styles.pendingTitle}>Payment Pending</Text>
          <Text style={styles.pendingSubtitle}>Your subscription is being processed.</Text>
          <TouchableOpacity style={styles.pendingButton} onPress={() => dispatch(fetchSubscriptionStatus())}>
            <Text style={styles.pendingButtonText}>Check Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pendingButton, styles.pendingVerifyButton]}
            onPress={handleVerifyPayment}
            disabled={verifying}
          >
            <Text style={styles.pendingButtonText}>
              {verifying ? "Verifying..." : "Verify Payment"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pendingButton, styles.pendingCancelButton]}
            onPress={() => navigation.replace("SubscriptionChoice")}
          >
            <Text style={styles.pendingButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#009632"
            colors={["#009632"]}
          />
        }
        showsVerticalScrollIndicator={false}
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
              categories={categories}
              categoriesLoading={categoriesLoading}
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

        <TouchableOpacity
          style={styles.subscriptionButton}
          onPress={() => navigation.navigate("SubscriptionManagement")}
        >
          <Ionicons name="card-outline" size={20} color="#fff" />
          <Text style={styles.subscriptionButtonText}>Manage Subscription</Text>
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0c0d0e" },
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#475569", marginTop: 10 },
  subscriptionButton: {
    flexDirection: "row",
    backgroundColor: "#009632",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  subscriptionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  pendingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  pendingTitle: { fontSize: 24, fontWeight: "bold", color: "#1e293b", marginTop: 20 },
  pendingSubtitle: { fontSize: 16, color: "#475569", marginTop: 10, textAlign: "center" },
  pendingButton: {
    backgroundColor: "#009632",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 200,
    alignItems: "center",
  },
  pendingVerifyButton: { backgroundColor: "#2563eb" },
  pendingCancelButton: { backgroundColor: "#64748b" },
  pendingButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});