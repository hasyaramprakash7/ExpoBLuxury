// src/screens/SignupVendorScreen.tsx
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  SafeAreaView,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";
import MapView, { Marker } from "react-native-maps";

// --- Redux Imports ---
import {
  registerVendor,
  registerVendorWithOtp,
} from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import { fetchCategories } from "../features/categorySlice";
import config from "../config/config";

// --- Constants ---
import {
  BUSINESS_TYPES,
  SERVICES,
  TAGS,
} from "../constants/vendorOptions";

// --- Type Definitions ---
type AuthStackParamList = {
  VendorLogin: undefined;
  SignupVendor: undefined;
};

type SignupVendorScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "SignupVendor"
>;

// --- Color Palette ---
const COLORS = {
  background: "#0A0A0A",
  card: "#1C1C1C",
  cardBorder: "#2C2C2C",
  primary: "#FFD700",
  primaryDark: "#C9A800",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#6B6B6B",
  inputBg: "#1A1A1A",
  inputBorder: "#333333",
  inputFocus: "#FFD700",
  error: "#FF4444",
  success: "#34C759",
  chipBg: "#2A2A2A",
  chipActive: "#FFD700",
};

// Operating Hours Presets
const HOURS_PRESETS = [
  { label: "Mon-Fri: 9 AM - 6 PM", value: JSON.stringify({ monday: { open: "09:00", close: "18:00" }, tuesday: { open: "09:00", close: "18:00" }, wednesday: { open: "09:00", close: "18:00" }, thursday: { open: "09:00", close: "18:00" }, friday: { open: "09:00", close: "18:00" } }) },
  { label: "Mon-Sat: 9 AM - 8 PM", value: JSON.stringify({ monday: { open: "09:00", close: "20:00" }, tuesday: { open: "09:00", close: "20:00" }, wednesday: { open: "09:00", close: "20:00" }, thursday: { open: "09:00", close: "20:00" }, friday: { open: "09:00", close: "20:00" }, saturday: { open: "09:00", close: "20:00" } }) },
  { label: "24/7", value: JSON.stringify({ monday: { open: "00:00", close: "23:59" }, tuesday: { open: "00:00", close: "23:59" }, wednesday: { open: "00:00", close: "23:59" }, thursday: { open: "00:00", close: "23:59" }, friday: { open: "00:00", close: "23:59" }, saturday: { open: "00:00", close: "23:59" }, sunday: { open: "00:00", close: "23:59" } }) },
  { label: "Sun-Thu: 10 AM - 10 PM", value: JSON.stringify({ sunday: { open: "10:00", close: "22:00" }, monday: { open: "10:00", close: "22:00" }, tuesday: { open: "10:00", close: "22:00" }, wednesday: { open: "10:00", close: "22:00" }, thursday: { open: "10:00", close: "22:00" } }) },
  { label: "Custom (enter JSON)", value: "custom" },
];

export default function SignupVendorScreen() {
  const navigation = useNavigation<SignupVendorScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector(
    (state: RootState) => state.vendorAuth,
  );

  // ─── Categories from Redux ──────────────────────────────────
  const { categories: categoryOptions, loading: categoriesLoading } = useSelector(
    (state: RootState) => state.categories,
  );

  // ─── Debug: Log categories when they change ────────────────
  useEffect(() => {
    console.log('📦 [SignupVendor] Categories in Redux:', categoryOptions.length, categoryOptions);
  }, [categoryOptions]);

  // ─── Fetch categories on mount ─────────────────────────────
  useEffect(() => {
    console.log('🔄 [SignupVendor] useEffect for fetch. Categories length:', categoryOptions.length, 'Loading:', categoriesLoading);
    if (categoryOptions.length === 0 && !categoriesLoading) {
      console.log('🚀 [SignupVendor] Dispatching fetchCategories');
      dispatch(fetchCategories());
    }
  }, []);

  // ─── FORM STATE ──────────────────────────────────────────────
  const [registerMethod, setRegisterMethod] = useState<"otp" | "password">("otp");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    shopName: "",
    shopImage: null as ImagePicker.ImagePickerAsset | null,
    businessType: "",
    gstNo: "",
    deliveryRange: "0",
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
    categories: [] as string[],
    services: [] as string[],
    tags: [] as string[],
    operatingHours: "",
  });

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // Modal visibility states
  const [showBusinessTypeModal, setShowBusinessTypeModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);

  // ─── Map Picker Modal ─────────────────────────────────────────
  const [showMapModal, setShowMapModal] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapAddressDetails, setMapAddressDetails] = useState({
    pincode: "",
    state: "",
    district: "",
    country: "India",
    street: "",
    colony: "",
  });
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ─── Search state ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Search states for other modals
  const [searchBusinessType, setSearchBusinessType] = useState("");
  const [searchCategories, setSearchCategories] = useState("");
  const [searchServices, setSearchServices] = useState("");
  const [searchTags, setSearchTags] = useState("");

  // ─── Get user location (for map) ─────────────────────────────
  const getUserLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 500);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (showMapModal) getUserLocation();
  }, [showMapModal]);

  // ─── Handlers ──────────────────────────────────────────────────
  const handleChange = useCallback((name: string, value: string) => {
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  const toggleSelection = useCallback((
    field: "categories" | "services" | "tags",
    value: string
  ) => {
    setForm((prev) => {
      const current = prev[field];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  }, []);

  const removeChip = useCallback((field: "categories" | "services" | "tags", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((v) => v !== value),
    }));
  }, []);

  // ─── Image Picker ─────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setForm((prev) => ({ ...prev, shopImage: result.assets[0] }));
    }
  }, []);

  // ─── Location: Get current device location ───────────────────
  const handleFetchLocation = useCallback(async () => {
    setLoadingAddress(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Permission to access location was denied.");
      setLoadingAddress(false);
      return;
    }
    try {
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          headers: { "User-Agent": "BLuxuryApp/1.0" },
          params: {
            lat: latitude,
            lon: longitude,
            format: "json",
            addressdetails: 1,
          },
        }
      );
      const address = response.data.address || {};
      setForm((prev) => ({
        ...prev,
        address: {
          latitude: String(latitude),
          longitude: String(longitude),
          pincode: address.postcode || "",
          state: address.state || "",
          district: address.county || address.city_district || "",
          country: address.country || "India",
          street: address.road || "",
          colony: address.neighbourhood || address.suburb || "",
        },
      }));
      Alert.alert("Success", "Address auto-filled from your location.");
    } catch (e) {
      Alert.alert("Error", "Could not fetch address. Please enter it manually.");
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  // ─── MAP PICKER: Reverse geocode ─────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setFetchingAddress(true);
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          headers: { "User-Agent": "BLuxuryApp/1.0" },
          params: {
            lat: lat,
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

  // ─── Search locations ─────────────────────────────────────────
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
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
    reverseGeocode(lat, lon);
    setSearchQuery("");
    setSearchResults([]);
  }, [reverseGeocode]);

  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedCoords({ lat: latitude, lng: longitude });
    reverseGeocode(latitude, longitude);
  }, [reverseGeocode]);

  const confirmMapAddress = useCallback(() => {
    if (!selectedCoords) {
      Alert.alert("Error", "Please select a location on the map.");
      return;
    }
    const finalAddress = {
      latitude: String(selectedCoords.lat),
      longitude: String(selectedCoords.lng),
      pincode: mapAddressDetails.pincode,
      state: mapAddressDetails.state,
      district: mapAddressDetails.district,
      country: mapAddressDetails.country,
      street: mapAddressDetails.street,
      colony: mapAddressDetails.colony,
    };
    setForm((prev) => ({ ...prev, address: finalAddress }));
    setShowMapModal(false);
    setSelectedCoords(null);
    setSearchQuery("");
    setSearchResults([]);
    Alert.alert("Success", "Address filled from selected map location.");
  }, [selectedCoords, mapAddressDetails]);

  // ─── Validation ───────────────────────────────────────────────
  const validateForm = useCallback(() => {
    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.phone ||
      !form.shopName ||
      !form.businessType
    ) {
      Alert.alert("Validation Error", "Please fill all required fields.");
      return false;
    }
    const { address } = form;
    if (
      !address.latitude ||
      !address.longitude ||
      !address.pincode ||
      !address.state ||
      !address.district ||
      !address.country
    ) {
      Alert.alert("Validation Error", "Please fill all address fields (latitude, longitude, pincode, state, district, country).");
      return false;
    }
    return true;
  }, [form]);

  // ─── OTP & Submit ─────────────────────────────────────────────
  const handleSendOtp = useCallback(async () => {
    if (!validateForm()) return;
    setSendingOtp(true);
    try {
      const url = `${config.apiUrl}/vendors/send-otp`;
      await axios.post(url, { phone: form.phone });
      setOtpSent(true);
      Alert.alert("Success", "OTP Sent to your phone");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setSendingOtp(false);
    }
  }, [validateForm, form.phone]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (registerMethod === "otp" && !otpCode) {
      Alert.alert("Validation Error", "Please enter the OTP.");
      return;
    }

    const formData = new FormData();
    Object.keys(form).forEach((key) => {
      if (key === "gstNo" && form.gstNo === "") return;
      if (key === "address") {
        formData.append("address", JSON.stringify(form.address));
      } else if (key === "shopImage" && form.shopImage) {
        const uriParts = form.shopImage.uri.split(".");
        const fileType = uriParts[uriParts.length - 1];
        formData.append("shopImage", {
          uri: form.shopImage.uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      } else if (key === "categories" || key === "services" || key === "tags") {
        const value = form[key as keyof typeof form];
        formData.append(key, JSON.stringify(value));
      } else if (key === "operatingHours") {
        const value = form.operatingHours.trim();
        if (value === "") {
          formData.append("operatingHours", null);
        } else {
          try {
            const parsed = JSON.parse(value);
            formData.append("operatingHours", JSON.stringify(parsed));
          } catch (e) {
            Alert.alert("Error", "Operating Hours must be a valid JSON object.");
            return;
          }
        }
      } else {
        formData.append(key, form[key as keyof typeof form] as string);
      }
    });

    if (registerMethod === "otp") {
      formData.append("otp", otpCode);
    }

    const action = registerMethod === "otp" ? registerVendorWithOtp : registerVendor;
    const result = await dispatch(action(formData as any));

    if (action.rejected.match(result)) {
      const errorMessage = typeof result.payload === "string" ? result.payload : "Registration failed.";
      Alert.alert("Registration Failed", errorMessage);
    }
  }, [validateForm, registerMethod, otpCode, form, dispatch]);

  // ─── Render chips ─────────────────────────────────────────────
  const renderChips = useCallback((field: "categories" | "services" | "tags", values: string[]) => (
    <View style={styles.chipContainer}>
      {values.map((v) => (
        <View key={v} style={styles.chip}>
          <Text style={styles.chipText}>{v}</Text>
          <TouchableOpacity onPress={() => removeChip(field, v)}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  ), [removeChip]);

  // ─── Reusable searchable modal (for simple string lists) ────
  const renderSearchableModal = useCallback((
    visible: boolean,
    onClose: () => void,
    title: string,
    options: string[],
    selected: string[],
    onToggle: (value: string) => void,
    searchText: string,
    setSearchText: (text: string) => void,
    multiSelect: boolean = true,
  ) => {
    const filteredOptions = options.filter((opt) =>
      opt.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search..."
                placeholderTextColor={COLORS.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredOptions}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item);
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      if (multiSelect) {
                        onToggle(item);
                      } else {
                        onToggle(item);
                        onClose();
                      }
                    }}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              initialNumToRender={20}
              maxToRenderPerBatch={30}
              windowSize={10}
            />
            <TouchableOpacity style={styles.modalDoneButton} onPress={onClose}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }, []);

  // ─── Categories Modal (with images) ──────────────────────────
  const renderCategoriesModal = useCallback(() => {
    console.log('🔄 [SignupVendor] Rendering categories modal. Total categories:', categoryOptions.length);
    const filteredCategories = categoryOptions.filter((cat) =>
      cat.name.toLowerCase().includes(searchCategories.toLowerCase())
    );
    console.log('🔍 [SignupVendor] Filtered categories:', filteredCategories.length);

    return (
      <Modal visible={showCategoriesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Categories</Text>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search categories..."
                placeholderTextColor={COLORS.textMuted}
                value={searchCategories}
                onChangeText={setSearchCategories}
                autoFocus
              />
            </View>
            {categoriesLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <>
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => {
                    const isSelected = form.categories.includes(item.name);
                    const imageSource = item.image || item.icon;
                    return (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => toggleSelection("categories", item.name)}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {imageSource ? (
                            <Image
                              source={{ uri: imageSource }}
                              style={styles.categoryImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.categoryImage, { backgroundColor: COLORS.inputBg, justifyContent: "center", alignItems: "center" }]}>
                              <Ionicons name="apps-outline" size={20} color={COLORS.textSecondary} />
                            </View>
                          )}
                          <Text style={styles.modalItemText}>{item.name}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  initialNumToRender={20}
                  maxToRenderPerBatch={30}
                  windowSize={10}
                />

                {/* Refresh Button */}
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={() => {
                    console.log('🔄 [SignupVendor] Manual refresh categories');
                    dispatch(fetchCategories());
                  }}
                  disabled={categoriesLoading}
                >
                  <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.refreshText}>
                    {categoriesLoading ? 'Loading...' : 'Refresh Categories'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowCategoriesModal(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }, [showCategoriesModal, categoryOptions, categoriesLoading, searchCategories, form.categories, toggleSelection, dispatch]);

  // ─── Operating Hours Presets Modal ───────────────────────────
  const renderHoursPresetsModal = useCallback(() => (
    <Modal visible={showHoursModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Operating Hours</Text>
          <FlatList
            data={HOURS_PRESETS}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  if (item.value === "custom") {
                    setShowHoursModal(false);
                  } else {
                    setForm((prev) => ({ ...prev, operatingHours: item.value }));
                    setShowHoursModal(false);
                  }
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
                {form.operatingHours === item.value && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowHoursModal(false)}>
            <Text style={styles.modalDoneText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ), [showHoursModal, form.operatingHours]);

  // ─── Dropdown field helper ────────────────────────────────────
  const DropdownField = useCallback(({
    label,
    value,
    onPress,
    icon,
    placeholder,
  }: {
    label: string;
    value: string | number;
    onPress: () => void;
    icon?: string;
    placeholder?: string;
  }) => (
    <TouchableOpacity style={styles.dropdownField} onPress={onPress} activeOpacity={0.7}>
      {icon && <Ionicons name={icon as any} size={20} color={COLORS.primary} style={styles.dropdownIcon} />}
      <Text style={[styles.dropdownText, !value && { color: COLORS.textMuted }]}>
        {value || placeholder || `Select ${label}`}
      </Text>
      <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  ), []);

  // ─── Map Modal ─────────────────────────────────────────────────
  const renderMapModal = useMemo(() => {
    if (!showMapModal) return null;
    return (
      <Modal visible={showMapModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "black" }}>
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: userLocation?.lat || 20.5937,
                longitude: userLocation?.lng || 78.9629,
                latitudeDelta: userLocation ? 0.02 : 5,
                longitudeDelta: userLocation ? 0.02 : 5,
              }}
              onPress={handleMapPress}
              showsUserLocation
            >
              {selectedCoords && (
                <Marker
                  coordinate={{
                    latitude: selectedCoords.lat,
                    longitude: selectedCoords.lng,
                  }}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setSelectedCoords({ lat: latitude, lng: longitude });
                    reverseGeocode(latitude, longitude);
                  }}
                  pinColor={COLORS.primary}
                />
              )}
            </MapView>
          </View>

          {/* Search Bar Overlay */}
          <View style={styles.mapSearchContainer}>
            <View style={styles.mapSearchBar}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Search locality, city, pincode..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={searchLocations}
              />
              {isSearching && <ActivityIndicator size="small" color={COLORS.primary} />}
            </View>
            {searchResults.length > 0 && (
              <View style={styles.mapSearchResults}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.mapSearchResultItem}
                      onPress={() => selectSearchResult(item)}
                    >
                      <Text style={styles.mapSearchResultText} numberOfLines={1}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyboardShouldPersistTaps="always"
                />
              </View>
            )}
          </View>

          {/* Bottom bar */}
          <View style={styles.mapBottomBar}>
            {fetchingAddress ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                {selectedCoords ? (
                  <View style={styles.mapAddressPreview}>
                    <Text style={styles.mapAddressText}>
                      📍 {mapAddressDetails.street || "Street"}, {mapAddressDetails.colony || "Colony"}
                    </Text>
                    <Text style={styles.mapAddressText}>
                      {mapAddressDetails.district && `${mapAddressDetails.district}, `}
                      {mapAddressDetails.state && `${mapAddressDetails.state}`}
                      {mapAddressDetails.pincode && ` - ${mapAddressDetails.pincode}`}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.mapAddressText}>Search or tap on map to select location</Text>
                )}
              </>
            )}
            <View style={styles.mapButtonRow}>
              <TouchableOpacity style={styles.mapCancelButton} onPress={() => setShowMapModal(false)}>
                <Text style={styles.mapButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapConfirmButton} onPress={confirmMapAddress}>
                <Text style={[styles.mapButtonText, { color: "#0A0A0A" }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [
    showMapModal,
    userLocation,
    selectedCoords,
    mapAddressDetails,
    fetchingAddress,
    searchQuery,
    searchResults,
    isSearching,
    handleMapPress,
    reverseGeocode,
    searchLocations,
    selectSearchResult,
    confirmMapAddress,
  ]);

  // ─── Main Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoB}>B</Text>
              </View>
              <Text style={styles.logoText}>Luxury</Text>
            </View>
            <Text style={styles.title}>Become a Vendor</Text>
            <Text style={styles.subtitle}>Join our premium marketplace</Text>
          </View>

          {/* Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, registerMethod === "otp" && styles.activeToggle]}
              onPress={() => setRegisterMethod("otp")}
            >
              <Text style={[styles.toggleText, registerMethod === "otp" && styles.activeToggleText]}>
                OTP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, registerMethod === "password" && styles.activeToggle]}
              onPress={() => {
                setRegisterMethod("password");
                setOtpSent(false);
              }}
            >
              <Text style={[styles.toggleText, registerMethod === "password" && styles.activeToggleText]}>
                Password
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name *"
                placeholderTextColor={COLORS.textMuted}
                value={form.name}
                onChangeText={(val) => handleChange("name", val)}
                editable={!otpSent}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor={COLORS.textMuted}
                value={form.email}
                onChangeText={(val) => handleChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!otpSent}
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password *"
                placeholderTextColor={COLORS.textMuted}
                value={form.password}
                onChangeText={(val) => handleChange("password", val)}
                secureTextEntry={!showPassword}
                editable={!otpSent}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Ionicons name="call-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number *"
                placeholderTextColor={COLORS.textMuted}
                value={form.phone}
                onChangeText={(val) => handleChange("phone", val)}
                keyboardType="phone-pad"
                editable={!otpSent}
              />
            </View>

            {/* Shop Name */}
            <View style={styles.inputGroup}>
              <Ionicons name="storefront-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Shop Name *"
                placeholderTextColor={COLORS.textMuted}
                value={form.shopName}
                onChangeText={(val) => handleChange("shopName", val)}
                editable={!otpSent}
              />
            </View>

            {/* Business Type */}
            <DropdownField
              label="Business Type"
              value={form.businessType}
              onPress={() => setShowBusinessTypeModal(true)}
              icon="business-outline"
              placeholder="Select Business Type *"
            />

            {/* GST */}
            <View style={styles.inputGroup}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="GST Number (Optional)"
                placeholderTextColor={COLORS.textMuted}
                value={form.gstNo}
                onChangeText={(val) => handleChange("gstNo", val)}
                editable={!otpSent}
              />
            </View>

            {/* Delivery Range */}
            <View style={styles.inputGroup}>
              <Ionicons name="navigate-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Delivery Range (km, default 0)"
                placeholderTextColor={COLORS.textMuted}
                value={form.deliveryRange}
                onChangeText={(val) => handleChange("deliveryRange", val)}
                keyboardType="numeric"
                editable={!otpSent}
              />
            </View>

            {/* Shop Image */}
            <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={otpSent}>
              <FontAwesome name="image" size={24} color={COLORS.primary} />
              <Text style={styles.imagePickerText}>
                {form.shopImage ? "Change Shop Image" : "Select Shop Image"}
              </Text>
            </TouchableOpacity>
            {form.shopImage && (
              <Image source={{ uri: form.shopImage.uri }} style={styles.imagePreview} />
            )}

            {/* Address Section */}
            <Text style={styles.sectionTitle}>Business Address</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.locationButton, { flex: 1 }]}
                onPress={handleFetchLocation}
                disabled={loadingAddress || otpSent}
              >
                {loadingAddress ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesome name="map-marker" size={20} color="white" />
                    <Text style={styles.locationButtonText}>Use Current</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationButton, { flex: 1, backgroundColor: COLORS.primary }]}
                onPress={() => setShowMapModal(true)}
                disabled={otpSent}
              >
                <Ionicons name="map-outline" size={20} color="#0A0A0A" />
                <Text style={[styles.locationButtonText, { color: "#0A0A0A" }]}>Pick from Map</Text>
              </TouchableOpacity>
            </View>

            {/* Address fields */}
            {[
              { key: "street", icon: "navigate-outline", placeholder: "Street / Road" },
              { key: "colony", icon: "home-outline", placeholder: "Colony / Neighbourhood" },
              { key: "pincode", icon: "mail-outline", placeholder: "Pincode", numeric: true },
              { key: "state", icon: "flag-outline", placeholder: "State" },
              { key: "district", icon: "home-outline", placeholder: "District" },
              { key: "country", icon: "earth-outline", placeholder: "Country" },
              { key: "latitude", icon: "location-outline", placeholder: "Latitude", numeric: true },
              { key: "longitude", icon: "location-outline", placeholder: "Longitude", numeric: true },
            ].map((field) => (
              <View key={field.key} style={styles.inputGroup}>
                <Ionicons name={field.icon as any} size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={`${field.placeholder} *`}
                  placeholderTextColor={COLORS.textMuted}
                  value={form.address[field.key as keyof typeof form.address]}
                  onChangeText={(val) => handleChange(`address.${field.key}`, val)}
                  keyboardType={field.numeric ? "numeric" : "default"}
                  editable={!otpSent}
                />
              </View>
            ))}

            {/* Directory Information */}
            <Text style={styles.sectionTitle}>Directory Information</Text>

            {/* Categories (with image modal) */}
            <DropdownField
              label="Categories"
              value={form.categories.length > 0 ? `${form.categories.length} selected` : ""}
              onPress={() => {
                // 🔥 Force fresh fetch when opening modal
                dispatch(fetchCategories());
                setShowCategoriesModal(true);
              }}
              icon="apps-outline"
              placeholder="Select Categories"
            />
            {renderChips("categories", form.categories)}

            {/* Services */}
            <DropdownField
              label="Services"
              value={form.services.length > 0 ? `${form.services.length} selected` : ""}
              onPress={() => setShowServicesModal(true)}
              icon="construct-outline"
              placeholder="Select Services"
            />
            {renderChips("services", form.services)}

            {/* Tags */}
            <DropdownField
              label="Tags"
              value={form.tags.length > 0 ? `${form.tags.length} selected` : ""}
              onPress={() => setShowTagsModal(true)}
              icon="pricetags-outline"
              placeholder="Select Tags"
            />
            {renderChips("tags", form.tags)}

            {/* Operating Hours */}
            <DropdownField
              label="Operating Hours"
              value={
                form.operatingHours
                  ? (() => {
                      const preset = HOURS_PRESETS.find(p => p.value === form.operatingHours);
                      return preset ? preset.label : "Custom";
                    })()
                  : ""
              }
              onPress={() => setShowHoursModal(true)}
              icon="time-outline"
              placeholder="Select Operating Hours"
            />
            {form.operatingHours && !HOURS_PRESETS.some(p => p.value === form.operatingHours) && (
              <View style={styles.inputGroup}>
                <Ionicons name="code-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                  placeholder='Custom JSON, e.g. {"monday":{"open":"09:00","close":"18:00"}}'
                  placeholderTextColor={COLORS.textMuted}
                  value={form.operatingHours}
                  onChangeText={(val) => handleChange("operatingHours", val)}
                  multiline
                  editable={!otpSent}
                />
              </View>
            )}

            {/* OTP Input */}
            {registerMethod === "otp" && otpSent && (
              <View style={styles.inputGroup}>
                <Ionicons name="key-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { letterSpacing: 5, textAlign: "center", fontSize: 20 }]}
                  placeholder="Enter 6-Digit OTP"
                  placeholderTextColor={COLORS.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                />
              </View>
            )}

            {/* Error Message */}
            {error && <Text style={styles.errorText}>{error as string}</Text>}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={registerMethod === "password" ? handleSubmit : otpSent ? handleSubmit : handleSendOtp}
              disabled={loading || sendingOtp}
            >
              {loading || sendingOtp ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {registerMethod === "password"
                    ? "Register"
                    : otpSent
                    ? "Verify & Register"
                    : "Get OTP"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("VendorLogin")} style={styles.loginLink}>
              <Text style={styles.linkText}>Already a vendor? <Text style={styles.linkHighlight}>Login here</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {renderSearchableModal(
        showBusinessTypeModal,
        () => setShowBusinessTypeModal(false),
        "Select Business Type",
        BUSINESS_TYPES,
        [form.businessType],
        (value) => setForm((prev) => ({ ...prev, businessType: value })),
        searchBusinessType,
        setSearchBusinessType,
        false
      )}
      {renderCategoriesModal()}
      {renderSearchableModal(
        showServicesModal,
        () => setShowServicesModal(false),
        "Select Services",
        SERVICES,
        form.services,
        (value) => toggleSelection("services", value),
        searchServices,
        setSearchServices,
        true
      )}
      {renderSearchableModal(
        showTagsModal,
        () => setShowTagsModal(false),
        "Select Tags",
        TAGS,
        form.tags,
        (value) => toggleSelection("tags", value),
        searchTags,
        setSearchTags,
        true
      )}
      {renderHoursPresetsModal()}
      {renderMapModal}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { paddingBottom: 40 },
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 10 },
  logoContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoB: { color: "#0A0A0A", fontSize: 28, fontWeight: "bold" },
  logoText: { fontSize: 32, fontWeight: "bold", color: COLORS.primary, marginLeft: 8 },
  title: { fontSize: 24, fontWeight: "bold", color: COLORS.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },

  toggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginHorizontal: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  activeToggle: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 16, fontWeight: "600", color: COLORS.textSecondary },
  activeToggleText: { color: "#0A0A0A" },

  form: { paddingHorizontal: 20 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 12,
    marginBottom: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    height: "100%",
    paddingVertical: 0,
  },
  eyeIcon: { padding: 8 },

  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 12,
    marginBottom: 14,
    height: 52,
  },
  dropdownIcon: { marginRight: 10 },
  dropdownText: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },

  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 14,
  },
  imagePickerText: { color: COLORS.primary, marginLeft: 10, fontWeight: "600" },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignSelf: "center",
    marginBottom: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginTop: 14,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 8,
  },

  locationButton: {
    flexDirection: "row",
    backgroundColor: COLORS.primaryDark,
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  locationButtonText: { color: "white", fontWeight: "bold", marginLeft: 10 },

  chipContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.chipBg,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chipText: { color: COLORS.textPrimary, fontSize: 14, marginRight: 6 },

  errorText: { color: COLORS.error, textAlign: "center", marginBottom: 8 },

  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonText: { color: "#0A0A0A", fontSize: 18, fontWeight: "bold" },

  loginLink: { alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  linkHighlight: { color: COLORS.primary, fontWeight: "bold" },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "75%",
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "bold",
    paddingVertical: 16,
    textAlign: "center",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44,
  },
  modalSearchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
    marginLeft: 8,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  modalItemText: { color: COLORS.textPrimary, fontSize: 16, marginLeft: 12 },
  modalDoneButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  modalDoneText: { color: "#0A0A0A", fontSize: 16, fontWeight: "bold" },

  categoryImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },

  // Refresh button for categories
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
  },
  refreshText: {
    color: COLORS.primary,
    marginLeft: 8,
    fontWeight: '600',
  },

  // Map Modal styles
  mapSearchContainer: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  mapSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    height: 48,
  },
  mapSearchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 16,
    paddingVertical: 0,
    marginLeft: 8,
  },
  mapSearchResults: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  mapSearchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  mapSearchResultText: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  mapBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  mapAddressPreview: {
    marginBottom: 12,
  },
  mapAddressText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    textAlign: "center",
  },
  mapButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  mapCancelButton: {
    flex: 1,
    backgroundColor: COLORS.cardBorder,
    padding: 12,
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
  },
  mapConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: "center",
  },
  mapButtonText: {
    color: COLORS.textPrimary,
    fontWeight: "bold",
    fontSize: 16,
  },
});