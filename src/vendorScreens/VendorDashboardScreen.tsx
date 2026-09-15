// src/vendorScreens/VendorDashboard.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Modal,
  TextInput,
  FlatList,
  Keyboard,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import * as Location from "expo-location";
import axios from "axios";
import { Vendor, Order } from "../types/models";
import { Ionicons } from "@expo/vector-icons";

// ─── Map Colors (matches AddAddressScreen / SignupVendorScreen) ─────
const MAP_COLORS = {
  card: "#1C1C1C",
  cardBorder: "#2C2C2C",
  primary: "#FFD700",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#6B6B6B",
  background: "#0A0A0A",
};

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
  const insets = useSafeAreaInsets();

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

  // ─── Map Picker Modal state (like SignupVendorScreen) ──────────
  const [showMapModal, setShowMapModal] = useState(false);
  const mapWebViewRef = useRef<WebView>(null);
  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [mapAddressDetails, setMapAddressDetails] = useState({
    pincode: "",
    state: "",
    district: "",
    country: "India",
    street: "",
    colony: "",
  });
  const [fetchingAddress, setFetchingAddress] = useState(false);

  // Search inside map
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

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

  // ─── Image Picker: Camera + Gallery, no crop ─────────────────
  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Gallery permission is required to select an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setShopImageFile(asset);
      setFormData((prev) => ({ ...prev, shopImage: asset.uri }));
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setShopImageFile(asset);
      setFormData((prev) => ({ ...prev, shopImage: asset.uri }));
    }
  }, []);

  const handleImageChange = useCallback(() => {
    Alert.alert("Shop Image", "Choose an option", [
      { text: "Camera", onPress: pickFromCamera },
      { text: "Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [pickFromCamera, pickFromGallery]);

  // ─── Map Picker: helpers ─────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setFetchingAddress(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          headers: { "User-Agent": "BLuxuryApp/1.0" },
          params: {
            lat,
            lon: lng,
            format: "json",
            addressdetails: 1,
          },
        }
      );
      const address = response.data.address || {};
      setMapAddressDetails({
        pincode: address.postcode || "",
        state: address.state || "",
        district: address.county || address.city_district || "",
        country: address.country || "India",
        street: address.road || "",
        colony: address.neighbourhood || address.suburb || "",
      });
    } catch (e) {
      Alert.alert("Error", "Could not fetch address details.");
    } finally {
      setFetchingAddress(false);
    }
  }, []);

  const openMapPicker = useCallback(async () => {
    setShowMapModal(true);
    setFetchingAddress(true);
    setMapAddressDetails({
      pincode: "",
      state: "",
      district: "",
      country: "India",
      street: "",
      colony: "",
    });
    setSelectedCoords(null);
    setSearchQuery("");
    setSearchResults([]);

    // Prefer vendor's saved coords first, then device location, then India center
    const savedLat = parseFloat(formData.address.latitude);
    const savedLng = parseFloat(formData.address.longitude);
    if (!isNaN(savedLat) && !isNaN(savedLng) && savedLat && savedLng) {
      setMapInitialCoords({ lat: savedLat, lng: savedLng });
      setSelectedCoords({ lat: savedLat, lng: savedLng });
      reverseGeocode(savedLat, savedLng);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setMapInitialCoords(coords);
        setSelectedCoords(coords);
        reverseGeocode(coords.lat, coords.lng);
      } else {
        const fallback = { lat: 20.5937, lng: 78.9629 };
        setMapInitialCoords(fallback);
        setSelectedCoords(fallback);
        reverseGeocode(fallback.lat, fallback.lng);
      }
    } catch {
      const fallback = { lat: 20.5937, lng: 78.9629 };
      setMapInitialCoords(fallback);
      setSelectedCoords(fallback);
      reverseGeocode(fallback.lat, fallback.lng);
    }
  }, [formData.address.latitude, formData.address.longitude, reverseGeocode]);

  const searchLocations = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search`,
          {
            headers: { "User-Agent": "BLuxuryApp/1.0" },
            params: {
              q: query,
              format: "json",
              addressdetails: 1,
              limit: 15,
              countrycodes: "in",
            },
          }
        );
        const results = response.data;
        const sorted = results.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const cls = item.class || '';
            const type = item.type || '';
            if (['neighbourhood', 'suburb', 'city', 'town', 'village', 'district', 'county', 'state'].includes(type)) return 1;
            if (['highway', 'road', 'street', 'amenity', 'place', 'boundary'].includes(cls)) return 2;
            return 3;
          };
          return getPriority(a) - getPriority(b);
        });
        setSearchResults(sorted);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const selectSearchResult = useCallback((item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setSelectedCoords({ lat, lng: lon });
    if (mapWebViewRef.current) {
      mapWebViewRef.current.injectJavaScript(
        `window.updateMapCenter(${lat}, ${lon}); true;`
      );
    }
    reverseGeocode(lat, lon);
    setSearchQuery("");
    setSearchResults([]);
    Keyboard.dismiss();
  }, [reverseGeocode]);

  const recenterMap = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setSelectedCoords({ lat, lng });
      if (mapWebViewRef.current) {
        mapWebViewRef.current.injectJavaScript(
          `window.updateMapCenter(${lat}, ${lng}); true;`
        );
      }
      reverseGeocode(lat, lng);
    } catch (e) {
      Alert.alert("Error", "Could not get current location.");
    }
  }, [reverseGeocode]);

  const handleMapMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "movestart") {
        setIsMapMoving(true);
        Keyboard.dismiss();
      } else if (data.type === "moveend") {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        if (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180
        ) {
          setIsMapMoving(false);
          setSelectedCoords({ lat, lng });
          reverseGeocode(lat, lng);
          setSearchResults([]);
          setSearchQuery("");
        }
      }
    } catch {}
  }, [reverseGeocode]);

  const generateMapHtml = useMemo(() => {
    if (!mapInitialCoords) return "";
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #1C1C1C; }
          #map { width: 100%; height: 100%; }
          .leaflet-control-attribution { display: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${mapInitialCoords.lat}, ${mapInitialCoords.lng}], 17);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          map.on('movestart', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'movestart' }));
          });

          map.on('moveend', function() {
            var center = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'moveend',
              lat: center.lat,
              lng: center.lng
            }));
          });

          window.updateMapCenter = function(lat, lng) {
            map.setView([lat, lng], 17, { animate: true });
          };
        </script>
      </body>
      </html>
    `;
  }, [mapInitialCoords]);

  const confirmMapAddress = useCallback(() => {
    if (!selectedCoords) {
      Alert.alert("Error", "Please select a location on the map.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      address: {
        latitude: String(selectedCoords.lat),
        longitude: String(selectedCoords.lng),
        pincode: mapAddressDetails.pincode,
        state: mapAddressDetails.state,
        district: mapAddressDetails.district,
        country: mapAddressDetails.country || "India",
        street: mapAddressDetails.street,
        colony: mapAddressDetails.colony,
      },
    }));
    setShowMapModal(false);
    setSearchQuery("");
    setSearchResults([]);
    Alert.alert("Success", "Address filled from selected map location.");
  }, [selectedCoords, mapAddressDetails]);

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
              onPickFromMap={openMapPicker}   // ← NEW prop
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

      {/* ─── Map Picker Modal (Leaflet center-pin like Signup) ─── */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: MAP_COLORS.background }}>
          <View style={{ flex: 1, position: "relative" }}>
            {mapInitialCoords ? (
              <WebView
                ref={mapWebViewRef}
                key={`${mapInitialCoords.lat}-${mapInitialCoords.lng}`}
                style={StyleSheet.absoluteFill}
                source={{ html: generateMapHtml }}
                onMessage={handleMapMessage}
                scrollEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={MAP_COLORS.primary} />
                <Text style={styles.mapLoadingText}>Finding your current location...</Text>
              </View>
            )}

            {/* Center marker */}
            <View style={styles.centerMarkerContainer} pointerEvents="none">
              <View
                style={[
                  styles.markerBubble,
                  isMapMoving && styles.markerBubbleMoving,
                ]}
              >
                <Text style={styles.markerText}>
                  {isMapMoving ? "Move map to adjust" : "Location selected here"}
                </Text>
              </View>
              <Ionicons
                name="location"
                size={42}
                color={MAP_COLORS.primary}
                style={[styles.markerIcon, isMapMoving && styles.markerIconMoving]}
              />
              <View style={styles.markerShadow} />
            </View>

            {/* Search Bar Overlay */}
            <View style={[styles.mapSearchContainer, { top: Math.max(insets.top, 20) }]}>
              <View style={styles.mapSearchBar}>
                <Ionicons name="search" size={20} color={MAP_COLORS.textSecondary} />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search locality, city, pincode..."
                  placeholderTextColor={MAP_COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={searchLocations}
                />
                {isSearching && <ActivityIndicator size="small" color={MAP_COLORS.primary} />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      Keyboard.dismiss();
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={MAP_COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {searchResults.length > 0 && (
                <View style={styles.mapSearchResultsContainer}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item, index) => `${item.place_id || index}`}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.mapSearchResultItem}
                        onPress={() => selectSearchResult(item)}
                      >
                        <Ionicons name="location-outline" size={18} color={MAP_COLORS.primary} />
                        <View style={styles.mapSearchResultTextContainer}>
                          <Text style={styles.mapSearchResultText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                          <Text style={styles.mapSearchResultType}>
                            {item.type || item.class || "Location"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={MAP_COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                    keyboardShouldPersistTaps="always"
                    style={styles.mapSearchResultsList}
                  />
                </View>
              )}
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={[styles.mapCloseButton, { top: Math.max(insets.top, 20) }]}
              onPress={() => setShowMapModal(false)}
            >
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>

            {/* My location button */}
            <TouchableOpacity style={styles.mapMyLocationButton} onPress={recenterMap}>
              <Ionicons name="locate" size={24} color={MAP_COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Bottom sheet */}
          <View style={[styles.mapBottomSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.mapLocationHeader}>
              <View style={styles.mapLocationIconContainer}>
                <Ionicons name="location" size={24} color={MAP_COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapLocationTitle}>Business Location</Text>
                <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                  {fetchingAddress
                    ? "Fetching address..."
                    : [mapAddressDetails.street, mapAddressDetails.colony]
                        .filter(Boolean)
                        .join(", ") || "Move the map to select location"}
                </Text>
                {!fetchingAddress &&
                  (mapAddressDetails.district ||
                    mapAddressDetails.state ||
                    mapAddressDetails.pincode) && (
                    <Text style={styles.mapLocationSubtitle} numberOfLines={1}>
                      {[
                        mapAddressDetails.district,
                        mapAddressDetails.state,
                        mapAddressDetails.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </Text>
                  )}
              </View>
            </View>

            <View style={styles.mapButtonRow}>
              <TouchableOpacity
                style={styles.mapCancelButton}
                onPress={() => setShowMapModal(false)}
              >
                <Text style={styles.mapButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapConfirmButton}
                onPress={confirmMapAddress}
                disabled={fetchingAddress}
              >
                <Text style={[styles.mapButtonText, { color: "#0A0A0A" }]}>
                  {fetchingAddress ? "..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // ─── Map Modal Styles ───────────────────────────────────────
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: MAP_COLORS.card,
  },
  mapLoadingText: { marginTop: 12, color: MAP_COLORS.textPrimary, fontWeight: "600" },

  centerMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -100,
    marginTop: -85,
    width: 200,
    alignItems: "center",
    zIndex: 2,
  },
  markerBubble: {
    backgroundColor: MAP_COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
  },
  markerBubbleMoving: { opacity: 0.6 },
  markerText: { color: MAP_COLORS.textPrimary, fontSize: 12, fontWeight: "600" },
  markerIcon: { transform: [{ translateY: 0 }] },
  markerIconMoving: { transform: [{ translateY: -12 }] },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },

  mapSearchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  mapSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: MAP_COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    height: 50,
  },
  mapSearchInput: {
    flex: 1,
    color: MAP_COLORS.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  mapSearchResultsContainer: {
    backgroundColor: MAP_COLORS.card,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    overflow: "hidden",
  },
  mapSearchResultsList: { maxHeight: 250 },
  mapSearchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: MAP_COLORS.cardBorder,
  },
  mapSearchResultTextContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  mapSearchResultText: { color: MAP_COLORS.textPrimary, fontSize: 14, fontWeight: "500" },
  mapSearchResultType: {
    color: MAP_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
  },

  mapCloseButton: {
    position: "absolute",
    left: 16,
    backgroundColor: MAP_COLORS.card,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    zIndex: 10,
  },
  mapMyLocationButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: MAP_COLORS.card,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    zIndex: 10,
  },

  mapBottomSheet: {
    backgroundColor: MAP_COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    marginTop: -20,
    zIndex: 5,
  },
  mapLocationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  mapLocationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  mapLocationTitle: { fontSize: 16, fontWeight: "700", color: MAP_COLORS.textPrimary, marginBottom: 4 },
  mapLocationSubtitle: { fontSize: 13, color: MAP_COLORS.textSecondary, lineHeight: 18 },
  mapButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  mapCancelButton: {
    flex: 1,
    backgroundColor: MAP_COLORS.cardBorder,
    padding: 14,
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
  },
  mapConfirmButton: {
    flex: 1,
    backgroundColor: MAP_COLORS.primary,
    padding: 14,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: "center",
  },
  mapButtonText: {
    color: MAP_COLORS.textPrimary,
    fontWeight: "bold",
    fontSize: 16,
  },
});