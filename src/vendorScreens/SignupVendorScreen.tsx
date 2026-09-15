// src/vendorScreens/SignupVendorScreen.tsx
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
  Keyboard,
  Dimensions,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

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

// ─── Responsive helpers ─────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const scale = (size: number) => (SCREEN_W / 375) * size;
const verticalScale = (size: number) => (SCREEN_H / 812) * size;
const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// ─── Type Definitions ──────────────────────────────────────────
type AuthStackParamList = {
  VendorLogin: undefined;
  SignupVendor: undefined;
};

type SignupVendorScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  "SignupVendor"
>;

// ═══════════════════════════════════════════════════════════════
// 🎨 LIGHT THEME — White background + Dark Green accent
// ═══════════════════════════════════════════════════════════════
const COLORS = {
  background: "#FFFFFF",
  card: "#FFFFFF",
  cardMuted: "#F5F7F5",
  cardBorder: "#E4E7E4",
  cardBorderStrong: "#D1D9D1",

  primary: "#166534",
  primaryDark: "#0F4A26",
  primaryLight: "#22C55E",
  primarySoft: "#DCFCE7",
  primarySoftBorder: "#BBF7D0",

  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",

  inputBg: "#FAFAFA",
  inputBorder: "#D1D5DB",
  inputFocusBorder: "#166534",

  error: "#DC2626",
  success: "#16A34A",

  chipBg: "#F3F4F6",
  chipBorder: "#E5E7EB",
  chipText: "#374151",
  chipActiveBg: "#166534",
  chipActiveText: "#FFFFFF",

  scrim: "rgba(17, 24, 39, 0.55)",
};

// ─── Days of week ──────────────────────────────────────────────
const DAYS: Array<{ key: string; label: string; short: string }> = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

type DaySchedule = { open: string; close: string; enabled: boolean };
type CustomHoursMap = Record<string, DaySchedule>;

const buildDefaultCustomHours = (): CustomHoursMap => ({
  monday: { open: "09:00", close: "18:00", enabled: true },
  tuesday: { open: "09:00", close: "18:00", enabled: true },
  wednesday: { open: "09:00", close: "18:00", enabled: true },
  thursday: { open: "09:00", close: "18:00", enabled: true },
  friday: { open: "09:00", close: "18:00", enabled: true },
  saturday: { open: "09:00", close: "18:00", enabled: false },
  sunday: { open: "09:00", close: "18:00", enabled: false },
});

const customHoursToJson = (map: CustomHoursMap): Record<string, { open: string; close: string }> => {
  const out: Record<string, { open: string; close: string }> = {};
  DAYS.forEach(({ key }) => {
    const d = map[key];
    if (d && d.enabled && d.open && d.close) {
      out[key] = { open: d.open, close: d.close };
    }
  });
  return out;
};

// ─── Operating Hours Presets ───────────────────────────────────
const HOURS_PRESETS = [
  {
    label: "Mon-Fri: 9 AM - 6 PM",
    value: JSON.stringify({
      monday: { open: "09:00", close: "18:00" },
      tuesday: { open: "09:00", close: "18:00" },
      wednesday: { open: "09:00", close: "18:00" },
      thursday: { open: "09:00", close: "18:00" },
      friday: { open: "09:00", close: "18:00" },
    }),
  },
  {
    label: "Mon-Sat: 9 AM - 8 PM",
    value: JSON.stringify({
      monday: { open: "09:00", close: "20:00" },
      tuesday: { open: "09:00", close: "20:00" },
      wednesday: { open: "09:00", close: "20:00" },
      thursday: { open: "09:00", close: "20:00" },
      friday: { open: "09:00", close: "20:00" },
      saturday: { open: "09:00", close: "20:00" },
    }),
  },
  {
    label: "24/7",
    value: JSON.stringify({
      monday: { open: "00:00", close: "23:59" },
      tuesday: { open: "00:00", close: "23:59" },
      wednesday: { open: "00:00", close: "23:59" },
      thursday: { open: "00:00", close: "23:59" },
      friday: { open: "00:00", close: "23:59" },
      saturday: { open: "00:00", close: "23:59" },
      sunday: { open: "00:00", close: "23:59" },
    }),
  },
  {
    label: "Sun-Thu: 10 AM - 10 PM",
    value: JSON.stringify({
      sunday: { open: "10:00", close: "22:00" },
      monday: { open: "10:00", close: "22:00" },
      tuesday: { open: "10:00", close: "22:00" },
      wednesday: { open: "10:00", close: "22:00" },
      thursday: { open: "10:00", close: "22:00" },
    }),
  },
  { label: "Custom (enter your own times)", value: "custom" },
];

const DEFAULT_INDIA = { lat: 20.5937, lng: 78.9629 };

// ─── Leaflet HTML builder ──────────────────────────────────────
const buildMapHtml = (lat: number, lng: number) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #F5F7F5; }
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
      }).setView([${lat}, ${lng}], 17);

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

// ═══════════════════════════════════════════════════════════════
// NUMBER STEPPER — reusable hour/minute picker
// ═══════════════════════════════════════════════════════════════
const NumberStepper = ({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
}) => {
  const pad = (n: number) => String(n).padStart(2, "0");

  const bump = (delta: number) => {
    const num = parseInt(value, 10);
    const safe = Number.isFinite(num) ? num : min;
    let next = safe + delta;
    if (next < min) next = max;
    if (next > max) next = min;
    onChange(pad(next));
  };

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 2);
    onChange(cleaned);
  };

  const handleBlur = () => {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num)) {
      onChange(pad(min));
    } else {
      const clamped = Math.max(min, Math.min(max, num));
      onChange(pad(clamped));
    }
  };

  return (
    <View style={stepperStyles.wrap}>
      <TouchableOpacity
        style={stepperStyles.btn}
        onPress={() => bump(-1)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="remove" size={moderateScale(14)} color={COLORS.primary} />
      </TouchableOpacity>
      <TextInput
        style={stepperStyles.input}
        value={value}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      <TouchableOpacity
        style={stepperStyles.btn}
        onPress={() => bump(1)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="add" size={moderateScale(14)} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
};

const stepperStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
  btn: {
    width: moderateScale(30),
    height: moderateScale(34),
    borderRadius: moderateScale(8),
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primarySoftBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    width: moderateScale(42),
    height: moderateScale(34),
    marginHorizontal: scale(4),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    color: COLORS.textPrimary,
    fontSize: moderateScale(15),
    textAlign: "center",
    paddingVertical: 0,
    fontWeight: "800",
  },
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function SignupVendorScreen() {
  const navigation = useNavigation<SignupVendorScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { loading, error } = useSelector(
    (state: RootState) => state.vendorAuth,
  );

  const { categories: categoryOptions, loading: categoriesLoading } = useSelector(
    (state: RootState) => state.categories,
  );

  useEffect(() => {
    if (categoryOptions.length === 0 && !categoriesLoading) {
      dispatch(fetchCategories());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Modal visibility
  const [showBusinessTypeModal, setShowBusinessTypeModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [showCustomHoursModal, setShowCustomHoursModal] = useState(false);

  // ─── Custom Hours state ─────────────────────────────────────
  const [customHours, setCustomHours] = useState<CustomHoursMap>(buildDefaultCustomHours);

  // ─── Map Picker Modal ────────────────────────────────────────
  const [showMapModal, setShowMapModal] = useState(false);
  const mapWebViewRef = useRef<WebView>(null);
  const lastGeocodedKeyRef = useRef<string>("");
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Search states for other modals
  const [searchBusinessType, setSearchBusinessType] = useState("");
  const [searchCategories, setSearchCategories] = useState("");
  const [searchServices, setSearchServices] = useState("");
  const [searchTags, setSearchTags] = useState("");

  const getString = (value: any): string => {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    return value || "";
  };

  // ─── Handlers ─────────────────────────────────────────────────
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

  // ─── Custom Hours handlers ──────────────────────────────────
  const updateDaySchedule = useCallback(
    (dayKey: string, patch: Partial<DaySchedule>) => {
      setCustomHours((prev) => ({
        ...prev,
        [dayKey]: { ...prev[dayKey], ...patch },
      }));
    },
    []
  );

  const copyToAllDays = useCallback(() => {
    const src = customHours.monday;
    setCustomHours((prev) => {
      const next: CustomHoursMap = { ...prev };
      DAYS.forEach(({ key }) => {
        next[key] = { ...prev[key], open: src.open, close: src.close };
      });
      return next;
    });
    Alert.alert("Applied", "Monday's times copied to all days.");
  }, [customHours]);

  const enableAllDays = useCallback((enabled: boolean) => {
    setCustomHours((prev) => {
      const next: CustomHoursMap = { ...prev };
      DAYS.forEach(({ key }) => {
        next[key] = { ...prev[key], enabled };
      });
      return next;
    });
  }, []);

  const applyCustomHours = useCallback(() => {
    const atLeastOneDay = DAYS.some(({ key }) => customHours[key].enabled);
    if (!atLeastOneDay) {
      Alert.alert("Error", "Please enable at least one day.");
      return;
    }
    for (const { key } of DAYS) {
      const d = customHours[key];
      if (!d.enabled) continue;
      const oh = parseInt(d.open.split(":")[0], 10);
      const om = parseInt(d.open.split(":")[1] ?? "0", 10);
      const ch = parseInt(d.close.split(":")[0], 10);
      const cm = parseInt(d.close.split(":")[1] ?? "0", 10);
      if (
        !Number.isFinite(oh) || !Number.isFinite(om) ||
        !Number.isFinite(ch) || !Number.isFinite(cm) ||
        oh < 0 || oh > 23 || om < 0 || om > 59 ||
        ch < 0 || ch > 23 || cm < 0 || cm > 59
      ) {
        Alert.alert("Error", `Invalid time for ${key}. Use 24-hour HH:MM (00-23 : 00-59).`);
        return;
      }
    }
    const json = customHoursToJson(customHours);
    setForm((prev) => ({ ...prev, operatingHours: JSON.stringify(json) }));
    setShowCustomHoursModal(false);
  }, [customHours]);

  // ─── Image Picker ────────────────────────────────────────────
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
      setForm((prev) => ({ ...prev, shopImage: result.assets[0] }));
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
      setForm((prev) => ({ ...prev, shopImage: result.assets[0] }));
    }
  }, []);

  const handlePickImage = useCallback(() => {
    if (otpSent) return;
    Alert.alert("Shop Image", "Choose an option", [
      { text: "Camera", onPress: pickFromCamera },
      { text: "Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [otpSent, pickFromCamera, pickFromGallery]);

  // ─── Location: Get current device location for form autofill ──
  const handleFetchLocation = useCallback(async () => {
    setLoadingAddress(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Permission to access location was denied.");
      setLoadingAddress(false);
      return;
    }
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (geocode && geocode.length > 0) {
        const place: any = geocode[0];
        setForm((prev) => ({
          ...prev,
          address: {
            latitude: String(latitude),
            longitude: String(longitude),
            pincode: getString(place.postalCode),
            state: getString(place.region),
            district: getString(place.district || place.city || place.subregion),
            country: getString(place.country || "India"),
            street: getString(place.street || place.name),
            colony: getString(place.neighborhood || place.suburb),
          },
        }));
        Alert.alert("Success", "Address auto-filled from your location.");
      } else {
        setForm((prev) => ({
          ...prev,
          address: {
            ...prev.address,
            latitude: String(latitude),
            longitude: String(longitude),
            country: "India",
          },
        }));
        Alert.alert("Info", "Location captured. Please fill address details.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not fetch address. Please enter it manually.");
    } finally {
      setLoadingAddress(false);
    }
  }, []);

  // ─── MAP PICKER: Reverse geocode ─────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastGeocodedKeyRef.current === key) return;
    lastGeocodedKeyRef.current = key;

    setFetchingAddress(true);

    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (geocode && geocode.length > 0) {
        const place: any = geocode[0];
        const details = {
          pincode: getString(place.postalCode),
          state: getString(place.region),
          district: getString(place.district || place.city || place.subregion),
          country: getString(place.country || "India"),
          street: getString(place.street || place.name),
          colony: getString(place.neighborhood || place.suburb),
        };
        setMapAddressDetails(details);
      }
    } catch (e) {
      // ignore
    } finally {
      setFetchingAddress(false);
    }
  }, []);

  // ─── Open map modal ──────────────────────────────────────────
  const openMapModal = useCallback(async () => {
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
    lastGeocodedKeyRef.current = "";

    const savedLat = parseFloat(form.address.latitude);
    const savedLng = parseFloat(form.address.longitude);
    if (!isNaN(savedLat) && !isNaN(savedLng) && savedLat !== 0 && savedLng !== 0) {
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
        setMapInitialCoords(DEFAULT_INDIA);
        setSelectedCoords(DEFAULT_INDIA);
        reverseGeocode(DEFAULT_INDIA.lat, DEFAULT_INDIA.lng);
      }
    } catch {
      setMapInitialCoords(DEFAULT_INDIA);
      setSelectedCoords(DEFAULT_INDIA);
      reverseGeocode(DEFAULT_INDIA.lat, DEFAULT_INDIA.lng);
    }
  }, [form.address.latitude, form.address.longitude, reverseGeocode]);

  useEffect(() => {
    if (!showMapModal) {
      lastGeocodedKeyRef.current = "";
    }
  }, [showMapModal]);

  // ─── Search locations ────────────────────────────────────────
  const searchLocations = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query || query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=15&countrycodes=in`,
          { headers: { "User-Agent": "BLuxuryApp/1.0" } }
        );
        const data = await response.json();
        const sorted = data.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const cls = item.class || "";
            const type = item.type || "";
            if (["neighbourhood", "suburb", "city", "town", "village", "district", "county", "state"].includes(type)) return 1;
            if (["highway", "road", "street", "amenity", "place", "boundary"].includes(cls)) return 2;
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

  // ─── Recenter ────────────────────────────────────────────────
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

  // ─── Map message handler ─────────────────────────────────────
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
          !isNaN(lat) && !isNaN(lng) &&
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
    } catch (e) {
      // ignore
    }
  }, [reverseGeocode]);

  // ─── Memoized WebView source ─────────────────────────────────
  const webViewSource = useMemo(() => {
    if (!mapInitialCoords) return undefined;
    return { html: buildMapHtml(mapInitialCoords.lat, mapInitialCoords.lng) };
  }, [mapInitialCoords?.lat, mapInitialCoords?.lng]);

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
      country: mapAddressDetails.country || "India",
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

  // ─── Validation ──────────────────────────────────────────────
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

  // ─── OTP & Submit ────────────────────────────────────────────
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
            <Ionicons name="close-circle" size={moderateScale(16)} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  ), [removeChip]);

  // ─── Reusable searchable modal ───────────────────────────────
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
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>{title}</Text>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={moderateScale(18)} color={COLORS.textSecondary} />
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
                      <Ionicons name="checkmark-circle" size={moderateScale(22)} color={COLORS.primary} />
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

  // ─── Categories Modal ────────────────────────────────────────
  const renderCategoriesModal = useCallback(() => {
    const filteredCategories = categoryOptions.filter((cat) =>
      cat.name.toLowerCase().includes(searchCategories.toLowerCase())
    );

    return (
      <Modal visible={showCategoriesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Select Categories</Text>
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={moderateScale(18)} color={COLORS.textSecondary} />
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
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: verticalScale(20) }} />
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
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                          {imageSource ? (
                            <Image
                              source={{ uri: imageSource }}
                              style={styles.categoryImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.categoryImage, { backgroundColor: COLORS.primarySoft, justifyContent: "center", alignItems: "center" }]}>
                              <Ionicons name="apps-outline" size={moderateScale(18)} color={COLORS.primary} />
                            </View>
                          )}
                          <Text style={styles.modalItemText}>{item.name}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={moderateScale(22)} color={COLORS.primary} />
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

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={() => dispatch(fetchCategories())}
                  disabled={categoriesLoading}
                >
                  <Ionicons name="refresh-outline" size={moderateScale(18)} color={COLORS.primary} />
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

  // ─── Operating Hours Modal ───────────────────────────────────
  const renderHoursPresetsModal = useCallback(() => (
    <Modal visible={showHoursModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalGrabber} />
          <Text style={styles.modalTitle}>Select Operating Hours</Text>
          <FlatList
            data={HOURS_PRESETS}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => {
              const isCustom = item.value === "custom";
              const isSelected = isCustom
                ? !!form.operatingHours &&
                  !HOURS_PRESETS.some(
                    (p) => p.value !== "custom" && p.value === form.operatingHours
                  )
                : form.operatingHours === item.value;
              return (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    if (isCustom) {
                      setShowHoursModal(false);
                      setTimeout(() => setShowCustomHoursModal(true), 220);
                    } else {
                      setForm((prev) => ({ ...prev, operatingHours: item.value }));
                      setShowHoursModal(false);
                    }
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={moderateScale(22)} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowHoursModal(false)}>
            <Text style={styles.modalDoneText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ), [showHoursModal, form.operatingHours]);

  // ─── Custom Hours Modal ─────────────────────────────────────
  const renderCustomHoursModal = useMemo(() => {
    if (!showCustomHoursModal) return null;

    return (
      <Modal
        visible={showCustomHoursModal}
        animationType="slide"
        onRequestClose={() => setShowCustomHoursModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={customHoursStyles.header}>
              <TouchableOpacity
                onPress={() => setShowCustomHoursModal(false)}
                style={customHoursStyles.headerBtn}
              >
                <Ionicons name="close" size={moderateScale(20)} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={customHoursStyles.headerTitle}>Custom Operating Hours</Text>
              <TouchableOpacity
                onPress={applyCustomHours}
                style={[customHoursStyles.headerBtn, customHoursStyles.headerApply]}
              >
                <Text style={customHoursStyles.headerApplyText}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={customHoursStyles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={customHoursStyles.quickRow}>
                <TouchableOpacity
                  style={customHoursStyles.quickBtn}
                  onPress={() => enableAllDays(true)}
                >
                  <Ionicons name="checkmark-done" size={moderateScale(14)} color={COLORS.primary} />
                  <Text style={customHoursStyles.quickText}>Open all</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={customHoursStyles.quickBtn}
                  onPress={() => enableAllDays(false)}
                >
                  <Ionicons name="close" size={moderateScale(14)} color={COLORS.primary} />
                  <Text style={customHoursStyles.quickText}>Close all</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={customHoursStyles.quickBtn}
                  onPress={copyToAllDays}
                >
                  <Ionicons name="copy-outline" size={moderateScale(14)} color={COLORS.primary} />
                  <Text style={customHoursStyles.quickText}>Copy Mon → all</Text>
                </TouchableOpacity>
              </View>

              <Text style={customHoursStyles.hint}>
                Use the number keys to enter times in 24-hour format. Hour 00–23, minute 00–59.
              </Text>

              {DAYS.map(({ key, label }) => {
                const d = customHours[key];
                const [oh, om] = d.open.split(":");
                const [ch, cm] = d.close.split(":");
                return (
                  <View
                    key={key}
                    style={[
                      customHoursStyles.dayCard,
                      !d.enabled && customHoursStyles.dayCardDisabled,
                    ]}
                  >
                    <View style={customHoursStyles.dayHeader}>
                      <Text style={customHoursStyles.dayLabel}>{label}</Text>
                      <Switch
                        value={d.enabled}
                        onValueChange={(v) => updateDaySchedule(key, { enabled: v })}
                        trackColor={{ false: COLORS.cardBorderStrong, true: COLORS.primaryLight }}
                        thumbColor={d.enabled ? COLORS.primary : "#FFFFFF"}
                        ios_backgroundColor={COLORS.cardBorder}
                      />
                    </View>

                    <View style={customHoursStyles.timeRow}>
                      <Text style={customHoursStyles.rowLabel}>Open</Text>
                      <View style={customHoursStyles.timeGroup}>
                        <NumberStepper
                          value={oh ?? "09"}
                          onChange={(v) =>
                            updateDaySchedule(key, { open: `${v}:${om ?? "00"}` })
                          }
                          min={0}
                          max={23}
                        />
                        <Text style={customHoursStyles.colon}>:</Text>
                        <NumberStepper
                          value={om ?? "00"}
                          onChange={(v) =>
                            updateDaySchedule(key, { open: `${oh ?? "09"}:${v}` })
                          }
                          min={0}
                          max={59}
                        />
                      </View>
                    </View>

                    <View style={customHoursStyles.timeRow}>
                      <Text style={customHoursStyles.rowLabel}>Close</Text>
                      <View style={customHoursStyles.timeGroup}>
                        <NumberStepper
                          value={ch ?? "18"}
                          onChange={(v) =>
                            updateDaySchedule(key, { close: `${v}:${cm ?? "00"}` })
                          }
                          min={0}
                          max={23}
                        />
                        <Text style={customHoursStyles.colon}>:</Text>
                        <NumberStepper
                          value={cm ?? "00"}
                          onChange={(v) =>
                            updateDaySchedule(key, { close: `${ch ?? "18"}:${v}` })
                          }
                          min={0}
                          max={59}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={{ height: verticalScale(30) }} />
            </ScrollView>

            <View
              style={[
                customHoursStyles.bottomBar,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <TouchableOpacity
                style={customHoursStyles.cancelBtn}
                onPress={() => setShowCustomHoursModal(false)}
              >
                <Text style={customHoursStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={customHoursStyles.applyBtn}
                onPress={applyCustomHours}
              >
                <Ionicons name="checkmark" size={moderateScale(18)} color={COLORS.textOnPrimary} />
                <Text style={customHoursStyles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }, [
    showCustomHoursModal,
    customHours,
    insets.bottom,
    updateDaySchedule,
    applyCustomHours,
    copyToAllDays,
    enableAllDays,
  ]);

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
      {icon && <Ionicons name={icon as any} size={moderateScale(18)} color={COLORS.primary} style={styles.dropdownIcon} />}
      <Text style={[styles.dropdownText, !value && { color: COLORS.textMuted }]}>
        {value || placeholder || `Select ${label}`}
      </Text>
      <Ionicons name="chevron-down" size={moderateScale(18)} color={COLORS.textSecondary} />
    </TouchableOpacity>
  ), []);

  // ─── Map Modal ────────────────────────────────────────────────
  const renderMapModal = useMemo(() => {
    if (!showMapModal) return null;

    const addressLine1 = [mapAddressDetails.street, mapAddressDetails.colony]
      .filter(Boolean)
      .join(", ");
    const addressLine2Parts: string[] = [];
    if (mapAddressDetails.district) addressLine2Parts.push(mapAddressDetails.district);
    if (mapAddressDetails.state) addressLine2Parts.push(mapAddressDetails.state);
    if (mapAddressDetails.pincode) addressLine2Parts.push(mapAddressDetails.pincode);
    const addressLine2 = addressLine2Parts.join(", ");

    return (
      <Modal visible={showMapModal} animationType="slide" onRequestClose={() => setShowMapModal(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={{ flex: 1, position: "relative" }}>
            {mapInitialCoords && webViewSource ? (
              <WebView
                ref={mapWebViewRef}
                style={StyleSheet.absoluteFill}
                source={webViewSource}
                onMessage={handleMapMessage}
                scrollEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
              />
            ) : (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.mapLoadingText}>Finding your current location...</Text>
              </View>
            )}

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
                size={moderateScale(44)}
                color={COLORS.primary}
                style={[styles.markerIcon, isMapMoving && styles.markerIconMoving]}
              />
              <View style={styles.markerShadow} />
            </View>

            <View style={[styles.searchContainer, { top: Math.max(insets.top, 20) }]}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={moderateScale(18)} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search locality, city, pincode..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={searchLocations}
                  returnKeyType="search"
                />
                {isSearching && <ActivityIndicator size="small" color={COLORS.primary} />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      Keyboard.dismiss();
                    }}
                  >
                    <Ionicons name="close-circle" size={moderateScale(18)} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {searchResults.length > 0 && (
                <View style={styles.searchResultsContainer}>
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item, index) => `${item.place_id || index}`}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => selectSearchResult(item)}
                      >
                        <Ionicons name="location-outline" size={moderateScale(16)} color={COLORS.primary} />
                        <View style={styles.searchResultTextContainer}>
                          <Text style={styles.searchResultText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                          <Text style={styles.searchResultType}>
                            {item.type || item.class || "Location"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={moderateScale(14)} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                    keyboardShouldPersistTaps="always"
                    style={styles.searchResultsList}
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.mapCloseButton, { top: Math.max(insets.top, 20) }]}
              onPress={() => setShowMapModal(false)}
            >
              <Ionicons name="close" size={moderateScale(22)} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mapMyLocationButton} onPress={recenterMap}>
              <Ionicons name="locate" size={moderateScale(22)} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.mapBottomSheet, { paddingBottom: insets.bottom + verticalScale(20) }]}>
            <View style={styles.mapLocationHeader}>
              <View style={styles.mapLocationIconContainer}>
                <Ionicons name="location" size={moderateScale(22)} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapLocationTitle}>Business Location</Text>

                {fetchingAddress ? (
                  <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                    Fetching address...
                  </Text>
                ) : (addressLine1 || addressLine2) ? (
                  <>
                    {!!addressLine1 && (
                      <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                        📍 {addressLine1}
                      </Text>
                    )}
                    {!!addressLine2 && (
                      <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                        {addressLine2}
                      </Text>
                    )}
                  </>
                ) : selectedCoords ? (
                  <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                    Lat: {selectedCoords.lat.toFixed(6)}, Lng: {selectedCoords.lng.toFixed(6)}
                  </Text>
                ) : (
                  <Text style={styles.mapLocationSubtitle} numberOfLines={2}>
                    Move the map to select a location
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.mapButtonRow}>
              <TouchableOpacity
                style={styles.mapCancelButton}
                onPress={() => setShowMapModal(false)}
              >
                <Text style={styles.mapCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapConfirmButton}
                onPress={confirmMapAddress}
                disabled={fetchingAddress || !selectedCoords}
              >
                <Text style={styles.mapConfirmButtonText}>
                  {fetchingAddress ? "..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [
    showMapModal,
    mapInitialCoords,
    webViewSource,
    handleMapMessage,
    isMapMoving,
    insets.top,
    insets.bottom,
    searchQuery,
    searchResults,
    isSearching,
    mapAddressDetails,
    fetchingAddress,
    selectedCoords,
    searchLocations,
    selectSearchResult,
    recenterMap,
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
          keyboardShouldPersistTaps="handled"
        >
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

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Ionicons name="person-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name *"
                placeholderTextColor={COLORS.textMuted}
                value={form.name}
                onChangeText={(val) => handleChange("name", val)}
                editable={!otpSent}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
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

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
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
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={moderateScale(18)} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="call-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
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

            <View style={styles.inputGroup}>
              <Ionicons name="storefront-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Shop Name *"
                placeholderTextColor={COLORS.textMuted}
                value={form.shopName}
                onChangeText={(val) => handleChange("shopName", val)}
                editable={!otpSent}
              />
            </View>

            <DropdownField
              label="Business Type"
              value={form.businessType}
              onPress={() => setShowBusinessTypeModal(true)}
              icon="business-outline"
              placeholder="Select Business Type *"
            />

            <View style={styles.inputGroup}>
              <Ionicons name="document-text-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="GST Number (Optional)"
                placeholderTextColor={COLORS.textMuted}
                value={form.gstNo}
                onChangeText={(val) => handleChange("gstNo", val)}
                editable={!otpSent}
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="navigate-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
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

            <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={otpSent}>
              <FontAwesome name="image" size={moderateScale(22)} color={COLORS.primary} />
              <Text style={styles.imagePickerText}>
                {form.shopImage ? "Change Shop Image" : "Select Shop Image"}
              </Text>
            </TouchableOpacity>
            {form.shopImage && (
              <Image
                source={{ uri: form.shopImage.uri }}
                style={styles.imagePreviewFull}
                resizeMode="contain"
              />
            )}

            <Text style={styles.sectionTitle}>Business Address</Text>
            <View style={{ flexDirection: "row", gap: scale(10), marginBottom: verticalScale(10) }}>
              <TouchableOpacity
                style={[styles.locationButton, { flex: 1 }]}
                onPress={handleFetchLocation}
                disabled={loadingAddress || otpSent}
              >
                {loadingAddress ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <>
                    <FontAwesome name="map-marker" size={moderateScale(18)} color={COLORS.textOnPrimary} />
                    <Text style={styles.locationButtonText}>Use Current</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationButton, styles.locationButtonPrimary, { flex: 1 }]}
                onPress={openMapModal}
                disabled={otpSent}
              >
                <Ionicons name="map-outline" size={moderateScale(18)} color={COLORS.textOnPrimary} />
                <Text style={styles.locationButtonText}>Pick from Map</Text>
              </TouchableOpacity>
            </View>

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
                <Ionicons name={field.icon as any} size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
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

            <Text style={styles.sectionTitle}>Directory Information</Text>

            <DropdownField
              label="Categories"
              value={form.categories.length > 0 ? `${form.categories.length} selected` : ""}
              onPress={() => {
                dispatch(fetchCategories());
                setShowCategoriesModal(true);
              }}
              icon="apps-outline"
              placeholder="Select Categories"
            />
            {renderChips("categories", form.categories)}

            <DropdownField
              label="Services"
              value={form.services.length > 0 ? `${form.services.length} selected` : ""}
              onPress={() => setShowServicesModal(true)}
              icon="construct-outline"
              placeholder="Select Services"
            />
            {renderChips("services", form.services)}

            <DropdownField
              label="Tags"
              value={form.tags.length > 0 ? `${form.tags.length} selected` : ""}
              onPress={() => setShowTagsModal(true)}
              icon="pricetags-outline"
              placeholder="Select Tags"
            />
            {renderChips("tags", form.tags)}

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
              <TouchableOpacity
                style={styles.editCustomHoursBtn}
                onPress={() => setShowCustomHoursModal(true)}
              >
                <Ionicons name="create-outline" size={moderateScale(16)} color={COLORS.primary} />
                <Text style={styles.editCustomHoursText}>Edit custom hours</Text>
              </TouchableOpacity>
            )}

            {registerMethod === "otp" && otpSent && (
              <View style={styles.inputGroup}>
                <Ionicons name="key-outline" size={moderateScale(18)} color={COLORS.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { letterSpacing: scale(5), textAlign: "center", fontSize: moderateScale(20) }]}
                  placeholder="Enter 6-Digit OTP"
                  placeholderTextColor={COLORS.textMuted}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error as string}</Text>}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={registerMethod === "password" ? handleSubmit : otpSent ? handleSubmit : handleSendOtp}
              disabled={loading || sendingOtp}
            >
              {loading || sendingOtp ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
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
      {renderCustomHoursModal}
      {renderMapModal}
    </SafeAreaView>
  );
}

// ─── Custom Hours Modal Styles ─────────────────────────────────
const customHoursStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
  },
  headerBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.cardMuted,
  },
  headerApply: {
    backgroundColor: COLORS.primary,
    width: "auto",
    paddingHorizontal: scale(14),
  },
  headerApplyText: {
    color: COLORS.textOnPrimary,
    fontWeight: "800",
    fontSize: moderateScale(13),
  },
  headerTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: moderateScale(15),
    textAlign: "center",
    marginHorizontal: scale(8),
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
  },
  quickRow: {
    flexDirection: "row",
    gap: scale(8),
    marginBottom: verticalScale(12),
    flexWrap: "wrap",
  },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(10),
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primarySoftBorder,
  },
  quickText: {
    color: COLORS.primary,
    fontSize: moderateScale(12),
    fontWeight: "700",
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
    marginBottom: verticalScale(12),
  },
  dayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    marginBottom: verticalScale(10),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  dayCardDisabled: {
    opacity: 0.5,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(8),
  },
  dayLabel: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: moderateScale(14),
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(6),
  },
  rowLabel: {
    width: scale(52),
    color: COLORS.textSecondary,
    fontSize: moderateScale(11),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  timeGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  colon: {
    color: COLORS.textSecondary,
    fontWeight: "800",
    fontSize: moderateScale(18),
    marginHorizontal: scale(4),
  },
  bottomBar: {
    flexDirection: "row",
    gap: scale(10),
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    backgroundColor: COLORS.background,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: "center",
    backgroundColor: COLORS.cardMuted,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cancelText: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: moderateScale(14),
  },
  applyBtn: {
    flex: 1.4,
    flexDirection: "row",
    gap: scale(6),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  applyText: {
    color: COLORS.textOnPrimary,
    fontWeight: "800",
    fontSize: moderateScale(14),
  },
});

// ─── Main Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { paddingBottom: verticalScale(40) },
  header: { alignItems: "center", paddingTop: verticalScale(20), paddingBottom: verticalScale(10) },
  logoContainer: { flexDirection: "row", alignItems: "center", marginBottom: verticalScale(8) },
  logoCircle: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoB: { color: COLORS.textOnPrimary, fontSize: moderateScale(26), fontWeight: "bold" },
  logoText: { fontSize: moderateScale(30), fontWeight: "bold", color: COLORS.primary, marginLeft: scale(8) },
  title: { fontSize: moderateScale(22), fontWeight: "bold", color: COLORS.textPrimary, marginTop: verticalScale(8) },
  subtitle: { fontSize: moderateScale(13), color: COLORS.textSecondary, marginBottom: verticalScale(16) },

  toggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.cardMuted,
    borderRadius: moderateScale(12),
    marginHorizontal: scale(20),
    padding: scale(4),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: verticalScale(20),
  },
  toggleButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(10),
    alignItems: "center",
  },
  activeToggle: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: moderateScale(15), fontWeight: "600", color: COLORS.textSecondary },
  activeToggleText: { color: COLORS.textOnPrimary },

  form: { paddingHorizontal: scale(20) },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(14),
    minHeight: moderateScale(52),
    height: moderateScale(52),
  },
  inputIcon: { marginRight: scale(10) },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: moderateScale(15),
    height: "100%",
    paddingVertical: 0,
  },
  eyeIcon: { padding: scale(8) },

  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(14),
    minHeight: moderateScale(52),
    height: moderateScale(52),
  },
  dropdownIcon: { marginRight: scale(10) },
  dropdownText: { flex: 1, color: COLORS.textPrimary, fontSize: moderateScale(15) },

  imagePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    borderWidth: 1,
    borderColor: COLORS.primarySoftBorder,
    marginBottom: verticalScale(14),
  },
  imagePickerText: { color: COLORS.primary, marginLeft: scale(10), fontWeight: "700", fontSize: moderateScale(14) },
  imagePreviewFull: {
    width: "100%",
    height: verticalScale(220),
    borderRadius: moderateScale(12),
    alignSelf: "center",
    marginBottom: verticalScale(14),
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.cardMuted,
  },

  sectionTitle: {
    fontSize: moderateScale(17),
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginTop: verticalScale(14),
    marginBottom: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: verticalScale(8),
  },

  locationButton: {
    flexDirection: "row",
    backgroundColor: COLORS.primaryDark,
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(10),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(14),
  },
  locationButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  locationButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: "700",
    marginLeft: scale(8),
    fontSize: moderateScale(13),
  },

  chipContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: verticalScale(12) },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    marginRight: scale(8),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: COLORS.primarySoftBorder,
  },
  chipText: { color: COLORS.primary, fontSize: moderateScale(13), marginRight: scale(6), fontWeight: "600" },

  errorText: { color: COLORS.error, textAlign: "center", marginBottom: verticalScale(8), fontSize: moderateScale(13) },

  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(12),
    alignItems: "center",
    marginTop: verticalScale(8),
    marginBottom: verticalScale(16),
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: { color: COLORS.textOnPrimary, fontSize: moderateScale(17), fontWeight: "bold" },

  loginLink: { alignItems: "center" },
  linkText: { color: COLORS.textSecondary, fontSize: moderateScale(13) },
  linkHighlight: { color: COLORS.primary, fontWeight: "bold" },

  editCustomHoursBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    paddingVertical: verticalScale(10),
    marginTop: verticalScale(-6),
    marginBottom: verticalScale(12),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
  },
  editCustomHoursText: { color: COLORS.primary, fontWeight: "700", fontSize: moderateScale(13) },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.scrim,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(20),
    maxHeight: "75%",
  },
  modalGrabber: {
    alignSelf: "center",
    width: scale(40),
    height: verticalScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: COLORS.cardBorderStrong,
    marginTop: verticalScale(8),
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: moderateScale(19),
    fontWeight: "bold",
    paddingVertical: verticalScale(16),
    textAlign: "center",
  },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(12),
    height: moderateScale(44),
  },
  modalSearchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: moderateScale(15),
    paddingVertical: 0,
    marginLeft: scale(8),
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  modalItemText: { color: COLORS.textPrimary, fontSize: moderateScale(15), marginLeft: scale(12), flex: 1 },
  modalDoneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(10),
    alignItems: "center",
    marginTop: verticalScale(12),
  },
  modalDoneText: { color: COLORS.textOnPrimary, fontSize: moderateScale(15), fontWeight: "bold" },

  categoryImage: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    marginRight: scale(8),
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    marginTop: verticalScale(8),
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: moderateScale(10),
  },
  refreshText: {
    color: COLORS.primary,
    marginLeft: scale(8),
    fontWeight: '700',
    fontSize: moderateScale(13),
  },

  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.cardMuted,
  },
  mapLoadingText: { marginTop: verticalScale(12), color: COLORS.textPrimary, fontWeight: "600", fontSize: moderateScale(14) },

  centerMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -scale(100),
    marginTop: -verticalScale(85),
    width: scale(200),
    alignItems: "center",
    zIndex: 2,
  },
  markerBubble: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(5),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  markerBubbleMoving: { opacity: 0.6 },
  markerText: { color: COLORS.textPrimary, fontSize: moderateScale(12), fontWeight: "600" },
  markerIcon: { transform: [{ translateY: 0 }] },
  markerIconMoving: { transform: [{ translateY: -12 }] },
  markerShadow: {
    width: scale(8),
    height: verticalScale(4),
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: moderateScale(4),
    marginTop: -verticalScale(6),
    transform: [{ scaleX: 2.5 }],
  },

  searchContainer: {
    position: "absolute",
    left: scale(16),
    right: scale(16),
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    height: moderateScale(50),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: moderateScale(14),
    paddingVertical: 0,
    marginLeft: scale(10),
    marginRight: scale(8),
  },
  searchResultsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    marginTop: verticalScale(4),
    maxHeight: verticalScale(250),
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchResultsList: { maxHeight: verticalScale(250) },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  searchResultTextContainer: { flex: 1, marginLeft: scale(12), marginRight: scale(8) },
  searchResultText: { color: COLORS.textPrimary, fontSize: moderateScale(13), fontWeight: "500" },
  searchResultType: {
    color: COLORS.textSecondary,
    fontSize: moderateScale(11),
    marginTop: verticalScale(2),
    textTransform: "capitalize",
  },

  mapCloseButton: {
    position: "absolute",
    left: scale(16),
    backgroundColor: "#FFFFFF",
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  mapMyLocationButton: {
    position: "absolute",
    right: scale(16),
    bottom: verticalScale(24),
    backgroundColor: "#FFFFFF",
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  mapBottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(20),
    borderTopWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: -verticalScale(20),
    zIndex: 5,
  },
  mapLocationHeader: { flexDirection: "row", alignItems: "center", marginBottom: verticalScale(16) },
  mapLocationIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  mapLocationTitle: { fontSize: moderateScale(15), fontWeight: "700", color: COLORS.textPrimary, marginBottom: verticalScale(4) },
  mapLocationSubtitle: { fontSize: moderateScale(12), color: COLORS.textSecondary, lineHeight: moderateScale(18) },
  mapButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(8),
  },
  mapCancelButton: {
    flex: 1,
    backgroundColor: COLORS.cardMuted,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(10),
    marginRight: scale(8),
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  mapCancelButtonText: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: moderateScale(15),
  },
  mapConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(10),
    marginLeft: scale(8),
    alignItems: "center",
  },
  mapConfirmButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: "bold",
    fontSize: moderateScale(15),
  },
});