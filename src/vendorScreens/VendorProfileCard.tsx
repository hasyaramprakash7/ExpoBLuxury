// src/vendorScreens/VendorProfileCard.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { Vendor } from "../types/models";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../app/store";
import { fetchCategories } from "../features/categorySlice";
import {
  BUSINESS_TYPES,
  SERVICES,
  TAGS,
} from "../constants/vendorOptions";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface VendorFormData extends Vendor {
  categories: string[];
  services: string[];
  tags: string[];
  operatingHours: any;
  isVerified: boolean;
  isPremium: boolean;
}

interface VendorProfileCardProps {
  vendor: Vendor;
  loading: boolean;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  formData: VendorFormData;
  handleChange: (name: string, value: any) => void;
  handleImageChange: () => void;
  handleSave: () => void;
  getStatusDisplay: (
    isApproved: boolean | undefined,
    isOnline: boolean | undefined
  ) => JSX.Element;
  categories: any[];
  categoriesLoading: boolean;
}

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const HOURS_PRESETS = [
  { label: "Mon-Fri: 9 AM - 6 PM", value: JSON.stringify({ monday: { open: "09:00", close: "18:00" }, tuesday: { open: "09:00", close: "18:00" }, wednesday: { open: "09:00", close: "18:00" }, thursday: { open: "09:00", close: "18:00" }, friday: { open: "09:00", close: "18:00" } }) },
  { label: "Mon-Sat: 9 AM - 8 PM", value: JSON.stringify({ monday: { open: "09:00", close: "20:00" }, tuesday: { open: "09:00", close: "20:00" }, wednesday: { open: "09:00", close: "20:00" }, thursday: { open: "09:00", close: "20:00" }, friday: { open: "09:00", close: "20:00" }, saturday: { open: "09:00", close: "20:00" } }) },
  { label: "24/7", value: JSON.stringify({ monday: { open: "00:00", close: "23:59" }, tuesday: { open: "00:00", close: "23:59" }, wednesday: { open: "00:00", close: "23:59" }, thursday: { open: "00:00", close: "23:59" }, friday: { open: "00:00", close: "23:59" }, saturday: { open: "00:00", close: "23:59" }, sunday: { open: "00:00", close: "23:59" } }) },
  { label: "Sun-Thu: 10 AM - 10 PM", value: JSON.stringify({ sunday: { open: "10:00", close: "22:00" }, monday: { open: "10:00", close: "22:00" }, tuesday: { open: "10:00", close: "22:00" }, wednesday: { open: "10:00", close: "22:00" }, thursday: { open: "10:00", close: "22:00" } }) },
  { label: "Custom (enter JSON)", value: "custom" },
];

const LUXURY_COLORS = {
  primary: '#1B5E20',
  primaryLight: '#2E7D32',
  primaryDark: '#0D3B0E',
  gold: '#C9A84C',
  goldLight: '#E8D5A3',
  white: '#FFFFFF',
  cream: '#FDF8F0',
  darkText: '#1A1A1A',
  grayText: '#6B7280',
  lightGray: '#F5F0E8',
  borderGold: '#D4C5A0',
  shadow: 'rgba(27, 94, 32, 0.2)',
  inputBg: '#F8F5F0',
  inputBorder: '#E0DCD5',
  cardBg: '#FFFFFF',
  cardShadow: 'rgba(27, 94, 32, 0.08)',
  statusPending: '#FEF3C7',
  statusOnline: '#DCFCE7',
  statusOffline: '#F3F4F6',
};

const MAP_COLORS = {
  card: "#1C1C1C",
  cardBorder: "#2C2C2C",
  primary: "#FFD700",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textMuted: "#6B6B6B",
  background: "#0A0A0A",
};

// ─── Leaflet map HTML builder (module-scope, pure) ──────────────
const buildMapHtml = (lat: number, lng: number) => `
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

const DEFAULT_INDIA = { lat: 20.5937, lng: 78.9629 };

export default function VendorProfileCard({
  vendor,
  loading,
  isEditing,
  setIsEditing,
  formData,
  handleChange,
  handleImageChange,
  handleSave,
  getStatusDisplay,
  categories,
  categoriesLoading,
}: VendorProfileCardProps) {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();

  const [showBusinessTypeModal, setShowBusinessTypeModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);

  const [searchBusinessType, setSearchBusinessType] = useState("");
  const [searchCategories, setSearchCategories] = useState("");
  const [searchServices, setSearchServices] = useState("");
  const [searchTags, setSearchTags] = useState("");

  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [customServiceInput, setCustomServiceInput] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");

  // ─── Map picker state ─────────────────────────────────────────
  const [showMapModal, setShowMapModal] = useState(false);
  const mapWebViewRef = useRef<WebView>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastGeocodedKeyRef = useRef<string>('');

  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [fetchingAddress, setFetchingAddress] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  const [mapAddressDetails, setMapAddressDetails] = useState({
    pincode: '',
    state: '',
    district: '',
    country: 'India',
    street: '',
    colony: '',
  });

  const [loadingAddress, setLoadingAddress] = useState(false);

  // ─── Fetch categories when editing if empty ────────────────────
  useEffect(() => {
    if (isEditing && categories.length === 0 && !categoriesLoading) {
      dispatch(fetchCategories());
    }
  }, [isEditing, categories.length, categoriesLoading, dispatch]);

  const getString = (value: any): string => {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    return value || '';
  };

  // ─── Reverse geocode (stable, deduped) ────────────────────────
  const fetchAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

    if (lastGeocodedKeyRef.current === key) {
      console.log('⏭️ [Map] Skipping geocode (same coords):', key);
      return;
    }
    lastGeocodedKeyRef.current = key;

    console.log('🔍 [Map] Reverse geocoding:', latitude, longitude);
    setFetchingAddress(true);

    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });

      if (geocode && geocode.length > 0) {
        const place: any = geocode[0];
        const details = {
          pincode: getString(place.postalCode),
          state: getString(place.region),
          district: getString(place.district || place.city || place.subregion),
          country: getString(place.country || 'India'),
          street: getString(place.street || place.name),
          colony: getString(place.neighborhood || place.suburb),
        };
        console.log('✅ [Map] Address details:', details);
        setMapAddressDetails(details);
      } else {
        console.warn('⚠️ [Map] Geocode returned empty array');
      }
    } catch (error) {
      console.error('❌ [Map] Geocode failed:', error);
    } finally {
      setFetchingAddress(false);
    }
  }, []);

  // ─── Get current device location ──────────────────────────────
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapInitialCoords(DEFAULT_INDIA);
        setSelectedCoords(DEFAULT_INDIA);
        fetchAddressFromCoords(DEFAULT_INDIA.lat, DEFAULT_INDIA.lng);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setMapInitialCoords(coords);
      setSelectedCoords(coords);
      if (mapWebViewRef.current) {
        mapWebViewRef.current.injectJavaScript(
          `window.updateMapCenter(${coords.lat}, ${coords.lng}); true;`
        );
      }
      fetchAddressFromCoords(coords.lat, coords.lng);
    } catch (error) {
      console.error('❌ [Map] getCurrentLocation failed:', error);
      setMapInitialCoords(DEFAULT_INDIA);
      setSelectedCoords(DEFAULT_INDIA);
      fetchAddressFromCoords(DEFAULT_INDIA.lat, DEFAULT_INDIA.lng);
    }
  }, [fetchAddressFromCoords]);

  // ─── Modal open effect ────────────────────────────────────────
  useEffect(() => {
    if (!showMapModal) {
      lastGeocodedKeyRef.current = '';
      return;
    }

    // Reset state every time the modal opens
    lastGeocodedKeyRef.current = '';
    setMapAddressDetails({
      pincode: "",
      state: "",
      district: "",
      country: "India",
      street: "",
      colony: "",
    });
    setSearchQuery("");
    setSearchResults([]);
    setFetchingAddress(true);

    const lat = parseFloat(formData.address.latitude);
    const lng = parseFloat(formData.address.longitude);

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      setMapInitialCoords({ lat, lng });
      setSelectedCoords({ lat, lng });
      fetchAddressFromCoords(lat, lng);
    } else {
      setMapInitialCoords(null);
      setSelectedCoords(null);
      getCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMapModal]);

  // ─── Search ───────────────────────────────────────────────────
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
          { headers: { 'User-Agent': 'BLuxuryApp/1.0' } }
        );
        const data = await response.json();

        const sorted = data.sort((a: any, b: any) => {
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
      } catch (error) {
        console.error('❌ [Map] Search failed:', error);
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
    fetchAddressFromCoords(lat, lon);

    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    Keyboard.dismiss();
  }, [fetchAddressFromCoords]);

  // ─── Map message handler ──────────────────────────────────────
  const handleMapMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'movestart') {
        setIsMapMoving(true);
        Keyboard.dismiss();
      } else if (data.type === 'moveend') {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        if (
          !isNaN(lat) && !isNaN(lng) &&
          lat >= -90 && lat <= 90 &&
          lng >= -180 && lng <= 180
        ) {
          setIsMapMoving(false);
          setSelectedCoords({ lat, lng });
          fetchAddressFromCoords(lat, lng);
          setSearchResults([]);
          setSearchQuery('');
        }
      }
    } catch (err) {
      // ignore parse errors
    }
  }, [fetchAddressFromCoords]);

  // ─── Recenter to current location ─────────────────────────────
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
      fetchAddressFromCoords(lat, lng);
    } catch (e) {
      Alert.alert("Error", "Could not get current location.");
    }
  }, [fetchAddressFromCoords]);

  // ─── Confirm map address ──────────────────────────────────────
  const confirmMapAddress = useCallback(() => {
    if (!selectedCoords) {
      Alert.alert("Error", "Please select a location on the map.");
      return;
    }

    const finalAddress = {
      latitude: String(selectedCoords.lat),
      longitude: String(selectedCoords.lng),
      pincode: getString(mapAddressDetails.pincode),
      state: getString(mapAddressDetails.state),
      district: getString(mapAddressDetails.district),
      country: getString(mapAddressDetails.country || "India"),
      street: getString(mapAddressDetails.street),
      colony: getString(mapAddressDetails.colony),
    };

    handleChange("address", finalAddress);
    setShowMapModal(false);
    setSelectedCoords(null);
    setSearchQuery("");
    setSearchResults([]);
    Alert.alert("Success", "Address filled from selected map location.");
  }, [selectedCoords, mapAddressDetails, handleChange]);

  // ─── Categorical toggle / add helpers ─────────────────────────
  const toggleSelection = useCallback((
    field: "categories" | "services" | "tags",
    value: string
  ) => {
    const current = formData[field] || [];
    const newArray = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    handleChange(field, newArray);
  }, [formData, handleChange]);

  const addCustomItem = useCallback((
    field: "categories" | "services" | "tags",
    inputValue: string,
    setInput: (val: string) => void
  ) => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      Alert.alert("Error", "Please enter a value.");
      return;
    }
    const current = formData[field] || [];
    if (current.includes(trimmed)) {
      Alert.alert("Already added", `"${trimmed}" is already in the list.`);
      return;
    }
    handleChange(field, [...current, trimmed]);
    setInput("");
  }, [formData, handleChange]);

  const renderChips = useCallback((field: string, values: string[]) => {
    if (!values || !Array.isArray(values) || values.length === 0) return null;
    return (
      <View style={styles.chipContainer}>
        {values.map((v, index) => (
          <View key={`${field}-${v}-${index}`} style={styles.chip}>
            <Text style={styles.chipText}>{v}</Text>
            <TouchableOpacity
              onPress={() => {
                const newValues = values.filter((item) => item !== v);
                handleChange(field, newValues);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={LUXURY_COLORS.grayText} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }, [handleChange]);

  // ─── Reusable searchable modal ────────────────────────────────
  const renderSearchableModal = useCallback((
    visible: boolean,
    onClose: () => void,
    title: string,
    options: string[],
    selected: string[],
    onToggle: (value: string) => void,
    searchText: string,
    setSearchText: (text: string) => void,
    customInput: string,
    setCustomInput: (text: string) => void,
    onAddCustom: () => void,
    multiSelect: boolean = true,
  ) => {
    const filteredOptions = options.filter((opt) =>
      opt.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: LUXURY_COLORS.white }]}>
            <Text style={[styles.modalTitle, { color: LUXURY_COLORS.primaryDark }]}>{title}</Text>

            <View style={[styles.modalSearchContainer, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
              <Ionicons name="search" size={20} color={LUXURY_COLORS.grayText} />
              <TextInput
                style={[styles.modalSearchInput, { color: LUXURY_COLORS.darkText }]}
                placeholder="Search or type new..."
                placeholderTextColor={LUXURY_COLORS.grayText}
                value={searchText}
                onChangeText={setSearchText}
                autoFocus
              />
              {multiSelect && (
                <TouchableOpacity onPress={onAddCustom} style={{ paddingHorizontal: 8 }}>
                  <Ionicons name="add-circle" size={28} color={LUXURY_COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredOptions}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, { borderBottomColor: LUXURY_COLORS.inputBorder }]}
                    onPress={() => onToggle(item)}
                  >
                    <Text style={[styles.modalItemText, { color: LUXURY_COLORS.darkText }]}>{item}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={LUXURY_COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              extraData={selected}
            />

            <TouchableOpacity
              style={[styles.modalDoneButton, { backgroundColor: LUXURY_COLORS.primary }]}
              onPress={onClose}
            >
              <Text style={[styles.modalDoneText, { color: LUXURY_COLORS.white }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }, []);

  const renderCategoriesModal = useCallback(() => {
    const filteredCategories = categories.filter((cat) =>
      cat.name.toLowerCase().includes(searchCategories.toLowerCase())
    );

    return (
      <Modal visible={showCategoriesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: LUXURY_COLORS.white }]}>
            <Text style={[styles.modalTitle, { color: LUXURY_COLORS.primaryDark }]}>Select Categories</Text>

            <View style={[styles.modalSearchContainer, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
              <Ionicons name="search" size={20} color={LUXURY_COLORS.grayText} />
              <TextInput
                style={[styles.modalSearchInput, { color: LUXURY_COLORS.darkText }]}
                placeholder="Search or type new category..."
                placeholderTextColor={LUXURY_COLORS.grayText}
                value={searchCategories}
                onChangeText={setSearchCategories}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => {
                  const trimmed = searchCategories.trim();
                  if (!trimmed) return;
                  if (formData.categories.includes(trimmed)) {
                    Alert.alert("Already added", `"${trimmed}" is already selected.`);
                    return;
                  }
                  handleChange("categories", [...formData.categories, trimmed]);
                  setSearchCategories("");
                }}
                style={{ paddingHorizontal: 8 }}
              >
                <Ionicons name="add-circle" size={28} color={LUXURY_COLORS.primary} />
              </TouchableOpacity>
            </View>

            {categoriesLoading ? (
              <ActivityIndicator size="large" color={LUXURY_COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <>
                <FlatList
                  data={filteredCategories}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => {
                    const isSelected = formData.categories.includes(item.name);
                    const imageSource = item.image || item.icon;
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, { borderBottomColor: LUXURY_COLORS.inputBorder }]}
                        onPress={() => toggleSelection("categories", item.name)}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {imageSource ? (
                            <Image source={{ uri: imageSource }} style={styles.categoryImage} resizeMode="cover" />
                          ) : (
                            <View style={[styles.categoryImage, { backgroundColor: LUXURY_COLORS.inputBg, justifyContent: "center", alignItems: "center" }]}>
                              <Ionicons name="apps-outline" size={20} color={LUXURY_COLORS.grayText} />
                            </View>
                          )}
                          <Text style={[styles.modalItemText, { color: LUXURY_COLORS.darkText }]}>{item.name}</Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={LUXURY_COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  extraData={formData.categories}
                />
                <TouchableOpacity
                  style={[styles.refreshButton, { borderColor: LUXURY_COLORS.primary }]}
                  onPress={() => dispatch(fetchCategories())}
                  disabled={categoriesLoading}
                >
                  <Ionicons name="refresh-outline" size={20} color={LUXURY_COLORS.primary} />
                  <Text style={[styles.refreshText, { color: LUXURY_COLORS.primary }]}>
                    {categoriesLoading ? 'Loading...' : 'Refresh Categories'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.modalDoneButton, { backgroundColor: LUXURY_COLORS.primary }]}
              onPress={() => setShowCategoriesModal(false)}
            >
              <Text style={[styles.modalDoneText, { color: LUXURY_COLORS.white }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }, [showCategoriesModal, categories, categoriesLoading, searchCategories, formData.categories, toggleSelection, dispatch, handleChange]);

  const renderHoursPresetsModal = useCallback(() => (
    <Modal visible={showHoursModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: LUXURY_COLORS.white }]}>
          <Text style={[styles.modalTitle, { color: LUXURY_COLORS.primaryDark }]}>Select Operating Hours</Text>
          <FlatList
            data={HOURS_PRESETS}
            keyExtractor={(item) => item.label}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, { borderBottomColor: LUXURY_COLORS.inputBorder }]}
                onPress={() => {
                  if (item.value === "custom") {
                    setShowHoursModal(false);
                  } else {
                    handleChange("operatingHours", item.value);
                    setShowHoursModal(false);
                  }
                }}
              >
                <Text style={[styles.modalItemText, { color: LUXURY_COLORS.darkText }]}>{item.label}</Text>
                {formData.operatingHours === item.value && (
                  <Ionicons name="checkmark-circle" size={24} color={LUXURY_COLORS.primary} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity
            style={[styles.modalDoneButton, { backgroundColor: LUXURY_COLORS.grayText }]}
            onPress={() => setShowHoursModal(false)}
          >
            <Text style={[styles.modalDoneText, { color: LUXURY_COLORS.white }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ), [showHoursModal, formData.operatingHours, handleChange]);

  const DropdownField = useCallback(({
    label,
    value,
    onPress,
    icon,
    placeholder,
    selectedItems,
    isArrayField = false,
  }: {
    label: string;
    value: string | number;
    onPress: () => void;
    icon?: string;
    placeholder?: string;
    selectedItems?: string[];
    isArrayField?: boolean;
  }) => {
    let displayText = '';
    if (isArrayField && selectedItems && Array.isArray(selectedItems)) {
      if (selectedItems.length > 0) displayText = selectedItems.join(', ');
    } else if (value) {
      displayText = String(value);
    }

    return (
      <TouchableOpacity
        style={[styles.dropdownField, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {icon && <Ionicons name={icon as any} size={20} color={LUXURY_COLORS.primary} style={styles.dropdownIcon} />}
        <Text
          style={[
            styles.dropdownText,
            { color: displayText ? LUXURY_COLORS.darkText : LUXURY_COLORS.grayText }
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {displayText || placeholder || `Select ${label}`}
        </Text>
        <Ionicons name="chevron-down" size={20} color={LUXURY_COLORS.grayText} />
      </TouchableOpacity>
    );
  }, []);

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
        handleChange("address", {
          latitude: String(latitude),
          longitude: String(longitude),
          pincode: getString(place.postalCode),
          state: getString(place.region),
          district: getString(place.district || place.city || place.subregion),
          country: getString(place.country || "India"),
          street: getString(place.street || place.name),
          colony: getString(place.neighborhood || place.suburb),
        });
        Alert.alert("Success", "Address auto-filled from your location.");
      } else {
        handleChange("address", {
          latitude: String(latitude),
          longitude: String(longitude),
          pincode: "",
          state: "",
          district: "",
          country: "India",
          street: "",
          colony: "",
        });
        Alert.alert("Info", "Location captured. Please fill address details.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not fetch address. Please enter it manually.");
    } finally {
      setLoadingAddress(false);
    }
  }, [handleChange]);

  // ─── Memoized WebView source (prevents reload loops) ──────────
  const webViewSource = useMemo(() => {
    if (!mapInitialCoords) return undefined;
    return { html: buildMapHtml(mapInitialCoords.lat, mapInitialCoords.lng) };
  }, [mapInitialCoords?.lat, mapInitialCoords?.lng]);

  // ─── Map modal ────────────────────────────────────────────────
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
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: MAP_COLORS.background }}>
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
                <ActivityIndicator size="large" color={MAP_COLORS.primary} />
                <Text style={styles.mapLoadingText}>Finding your current location...</Text>
              </View>
            )}

            {/* Center marker overlay */}
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

            {/* Search bar */}
            <View style={[styles.searchContainer, { top: Math.max(insets.top, 20) }]}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={MAP_COLORS.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search locality, city, pincode..."
                  placeholderTextColor={MAP_COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={searchLocations}
                  returnKeyType="search"
                />
                {isSearching && <ActivityIndicator size="small" color={MAP_COLORS.primary} />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      Keyboard.dismiss();
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={MAP_COLORS.textSecondary} />
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
                        <Ionicons name="location-outline" size={18} color={MAP_COLORS.primary} />
                        <View style={styles.searchResultTextContainer}>
                          <Text style={styles.searchResultText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                          <Text style={styles.searchResultType}>
                            {item.type || item.class || 'Location'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={MAP_COLORS.textSecondary} />
                      </TouchableOpacity>
                    )}
                    keyboardShouldPersistTaps="always"
                    style={styles.searchResultsList}
                  />
                </View>
              )}
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={[styles.closeButton, { top: Math.max(insets.top, 20) }]}
              onPress={() => setShowMapModal(false)}
            >
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>

            {/* My location button */}
            <TouchableOpacity style={styles.myLocationButton} onPress={recenterMap}>
              <Ionicons name="locate" size={24} color={MAP_COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Bottom sheet */}
          <View style={[styles.mapBottomSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.locationHeader}>
              <View style={styles.locationIconContainer}>
                <Ionicons name="location" size={24} color={MAP_COLORS.primary} />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationTitle}>Business Location</Text>

                {fetchingAddress ? (
                  <Text style={styles.locationSubtitle} numberOfLines={2}>
                    Fetching address...
                  </Text>
                ) : (addressLine1 || addressLine2) ? (
                  <>
                    {!!addressLine1 && (
                      <Text style={styles.locationSubtitle} numberOfLines={2}>
                        📍 {addressLine1}
                      </Text>
                    )}
                    {!!addressLine2 && (
                      <Text style={styles.locationSubtitle} numberOfLines={2}>
                        {addressLine2}
                      </Text>
                    )}
                  </>
                ) : selectedCoords ? (
                  <Text style={styles.locationSubtitle} numberOfLines={2}>
                    Lat: {selectedCoords.lat.toFixed(6)}, Lng: {selectedCoords.lng.toFixed(6)}
                  </Text>
                ) : (
                  <Text style={styles.locationSubtitle} numberOfLines={2}>
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
                <Text style={[styles.mapButtonText, { color: MAP_COLORS.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mapConfirmButton}
                onPress={confirmMapAddress}
                disabled={fetchingAddress || !selectedCoords}
              >
                <Text style={[styles.mapButtonText, { color: "#0A0A0A" }]}>
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
    mapAddressDetails,
    fetchingAddress,
    searchQuery,
    searchResults,
    isSearching,
    selectedCoords,
    searchLocations,
    selectSearchResult,
    recenterMap,
    confirmMapAddress,
  ]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: LUXURY_COLORS.white }]}>
        <ActivityIndicator size="large" color={LUXURY_COLORS.primary} />
        <Text style={[styles.loadingText, { color: LUXURY_COLORS.grayText }]}>Loading vendor profile...</Text>
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={[styles.noDataContainer, { backgroundColor: LUXURY_COLORS.white }]}>
        <Ionicons name="alert-circle" size={24} color="#dc2626" />
        <Text style={[styles.noDataText, { color: '#dc2626' }]}>No vendor data available.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: LUXURY_COLORS.white }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: LUXURY_COLORS.primaryDark }]}>Your Profile</Text>
        {!isEditing ? (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.editButton, { backgroundColor: LUXURY_COLORS.primary }]}>
            <Ionicons name="create-outline" size={16} color={LUXURY_COLORS.white} />
            <Text style={[styles.editButtonText, { color: LUXURY_COLORS.white }]}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.cancelButton, { borderColor: LUXURY_COLORS.inputBorder, backgroundColor: LUXURY_COLORS.white }]}>
            <Ionicons name="close-outline" size={16} color={LUXURY_COLORS.grayText} />
            <Text style={[styles.cancelButtonText, { color: LUXURY_COLORS.grayText }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.profileGrid}>
        <View style={[styles.imageContainer, { borderColor: LUXURY_COLORS.inputBorder }]}>
          <Image
            source={{
              uri: formData.shopImage || "https://via.placeholder.com/300x300?text=Shop+Image",
            }}
            style={styles.shopImage}
            resizeMode="contain"
          />
          {isEditing && (
            <TouchableOpacity onPress={handleImageChange} style={[styles.imageUploadOverlay, { backgroundColor: 'rgba(27, 94, 32, 0.5)' }]}>
              <Ionicons name="cloud-upload-outline" size={28} color={LUXURY_COLORS.white} />
              <Text style={{ color: LUXURY_COLORS.white, fontWeight: "600", marginTop: 6, fontSize: 12 }}>
                Change
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.shopInfo}>
          <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Shop Name:</Text>
          <Text style={[styles.shopNameText, { color: LUXURY_COLORS.primaryDark }]}>{vendor.shopName}</Text>
          <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Status:</Text>
          {getStatusDisplay(vendor.isApproved, vendor.isOnline)}
        </View>
      </View>

      {!isEditing ? (
        <View style={styles.readOnlyContainer}>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Name:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.name}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Email:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.email}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Phone:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.phone}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Business:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.businessType || "N/A"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>GST:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.gstNo || "N/A"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Delivery Range:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>{formData.deliveryRange} km</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Address:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>
              {[formData.address.street, formData.address.colony, formData.address.district, formData.address.state]
                .filter(Boolean).join(', ')}
              {formData.address.pincode ? ` - ${formData.address.pincode}` : ''}
              {formData.address.country ? `, ${formData.address.country}` : ''}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Categories:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>
              {Array.isArray(formData.categories) ? formData.categories.join(', ') : formData.categories || 'N/A'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Services:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>
              {Array.isArray(formData.services) ? formData.services.join(', ') : formData.services || 'N/A'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: LUXURY_COLORS.inputBorder }]}>
            <Text style={[styles.label, { color: LUXURY_COLORS.grayText }]}>Tags:</Text>
            <Text style={[styles.value, { color: LUXURY_COLORS.darkText }]}>
              {Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags || 'N/A'}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.editForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="person-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Vendor Name *"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.name}
              onChangeText={(t) => handleChange("name", t)}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="mail-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Email *"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.email}
              onChangeText={(t) => handleChange("email", t)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="call-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Phone"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.phone}
              onChangeText={(t) => handleChange("phone", t)}
              keyboardType="phone-pad"
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="storefront-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Shop Name *"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.shopName}
              onChangeText={(t) => handleChange("shopName", t)}
            />
          </View>

          <DropdownField
            label="Business Type"
            value={formData.businessType}
            onPress={() => setShowBusinessTypeModal(true)}
            icon="business-outline"
            placeholder="Select Business Type *"
          />

          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="document-text-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="GST Number"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.gstNo}
              onChangeText={(t) => handleChange("gstNo", t)}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="navigate-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Delivery Range (km)"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={String(formData.deliveryRange)}
              onChangeText={(t) => handleChange("deliveryRange", t)}
              keyboardType="numeric"
            />
          </View>

          <Text style={[styles.sectionTitle, { color: LUXURY_COLORS.primaryDark, borderBottomColor: LUXURY_COLORS.inputBorder }]}>Address</Text>

          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="navigate-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Street"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.street}
              onChangeText={(t) => handleChange("address", { ...formData.address, street: t })}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="home-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Colony / Locality"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.colony}
              onChangeText={(t) => handleChange("address", { ...formData.address, colony: t })}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="mail-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Pincode *"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.pincode}
              onChangeText={(t) => handleChange("address", { ...formData.address, pincode: t })}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="flag-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="State"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.state}
              onChangeText={(t) => handleChange("address", { ...formData.address, state: t })}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="home-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="District"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.district}
              onChangeText={(t) => handleChange("address", { ...formData.address, district: t })}
            />
          </View>
          <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
            <Ionicons name="earth-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: LUXURY_COLORS.darkText }]}
              placeholder="Country"
              placeholderTextColor={LUXURY_COLORS.grayText}
              value={formData.address.country}
              onChangeText={(t) => handleChange("address", { ...formData.address, country: t })}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8, backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
              <Ionicons name="location-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: LUXURY_COLORS.darkText }]}
                placeholder="Latitude *"
                placeholderTextColor={LUXURY_COLORS.grayText}
                value={formData.address.latitude}
                onChangeText={(t) => handleChange("address", { ...formData.address, latitude: t })}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
              <Ionicons name="location-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: LUXURY_COLORS.darkText }]}
                placeholder="Longitude *"
                placeholderTextColor={LUXURY_COLORS.grayText}
                value={formData.address.longitude}
                onChangeText={(t) => handleChange("address", { ...formData.address, longitude: t })}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            <TouchableOpacity
              style={[styles.locationButton, { flex: 1, backgroundColor: LUXURY_COLORS.primary }]}
              onPress={handleFetchLocation}
              disabled={loadingAddress}
            >
              {loadingAddress ?
                <ActivityIndicator color={LUXURY_COLORS.white} /> :
                <><FontAwesome name="map-marker" size={20} color={LUXURY_COLORS.white} /><Text style={[styles.locationButtonText, { color: LUXURY_COLORS.white }]}>Use Current</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.locationButton, { flex: 1, backgroundColor: LUXURY_COLORS.gold }]}
              onPress={() => setShowMapModal(true)}
            >
              <Ionicons name="map-outline" size={20} color={LUXURY_COLORS.primaryDark} />
              <Text style={[styles.locationButtonText, { color: LUXURY_COLORS.primaryDark }]}>Pick from Map</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: LUXURY_COLORS.primaryDark, borderBottomColor: LUXURY_COLORS.inputBorder }]}>Directory Information</Text>

          <DropdownField
            label="Categories"
            value=""
            selectedItems={formData.categories}
            isArrayField={true}
            onPress={() => { dispatch(fetchCategories()); setShowCategoriesModal(true); }}
            icon="apps-outline"
            placeholder="Select Categories"
          />
          {renderChips("categories", formData.categories)}

          <DropdownField
            label="Services"
            value=""
            selectedItems={formData.services}
            isArrayField={true}
            onPress={() => setShowServicesModal(true)}
            icon="construct-outline"
            placeholder="Select Services"
          />
          {renderChips("services", formData.services)}

          <DropdownField
            label="Tags"
            value=""
            selectedItems={formData.tags}
            isArrayField={true}
            onPress={() => setShowTagsModal(true)}
            icon="pricetags-outline"
            placeholder="Select Tags"
          />
          {renderChips("tags", formData.tags)}

          <DropdownField
            label="Operating Hours"
            value={
              formData.operatingHours
                ? (() => {
                    const preset = HOURS_PRESETS.find(p => p.value === formData.operatingHours);
                    return preset ? preset.label : "Custom";
                  })()
                : ""
            }
            onPress={() => setShowHoursModal(true)}
            icon="time-outline"
            placeholder="Select Operating Hours"
          />
          {formData.operatingHours && !HOURS_PRESETS.some(p => p.value === formData.operatingHours) && (
            <View style={[styles.inputGroup, { backgroundColor: LUXURY_COLORS.inputBg, borderColor: LUXURY_COLORS.inputBorder }]}>
              <Ionicons name="code-outline" size={20} color={LUXURY_COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: "top", color: LUXURY_COLORS.darkText }]}
                placeholder='Custom JSON, e.g. {"monday":{"open":"09:00","close":"18:00"}}'
                placeholderTextColor={LUXURY_COLORS.grayText}
                value={formData.operatingHours}
                onChangeText={(val) => handleChange("operatingHours", val)}
                multiline
              />
            </View>
          )}

          <View style={styles.saveButtonContainer}>
            <TouchableOpacity onPress={handleSave} disabled={loading} style={[styles.saveButton, { backgroundColor: LUXURY_COLORS.primary }]}>
              {loading ? (
                <><ActivityIndicator size="small" color={LUXURY_COLORS.white} /><Text style={[styles.saveButtonText, { color: LUXURY_COLORS.white }]}>Saving...</Text></>
              ) : (
                <><Ionicons name="save-outline" size={20} color={LUXURY_COLORS.white} /><Text style={[styles.saveButtonText, { color: LUXURY_COLORS.white }]}>Save Changes</Text></>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {renderSearchableModal(
        showBusinessTypeModal,
        () => setShowBusinessTypeModal(false),
        "Select Business Type",
        BUSINESS_TYPES,
        [formData.businessType],
        (value) => handleChange("businessType", value),
        searchBusinessType,
        setSearchBusinessType,
        "",
        () => {},
        () => {},
        false
      )}

      {renderCategoriesModal()}

      {renderSearchableModal(
        showServicesModal,
        () => setShowServicesModal(false),
        "Select Services",
        SERVICES,
        formData.services,
        (value) => toggleSelection("services", value),
        searchServices,
        setSearchServices,
        customServiceInput,
        setCustomServiceInput,
        () => addCustomItem("services", customServiceInput, setCustomServiceInput),
        true
      )}

      {renderSearchableModal(
        showTagsModal,
        () => setShowTagsModal(false),
        "Select Tags",
        TAGS,
        formData.tags,
        (value) => toggleSelection("tags", value),
        searchTags,
        setSearchTags,
        customTagInput,
        setCustomTagInput,
        () => addCustomItem("tags", customTagInput, setCustomTagInput),
        true
      )}

      {renderHoursPresetsModal()}
      {renderMapModal}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LUXURY_COLORS.white,
    borderRadius: 16,
    shadowColor: LUXURY_COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    padding: 24,
  },
  loadingContainer: {
    backgroundColor: LUXURY_COLORS.white,
    borderRadius: 16,
    padding: 24,
    height: 256,
    alignItems: "center",
    justifyContent: "center"
  },
  loadingText: { marginLeft: 12, fontSize: 16 },
  noDataContainer: {
    backgroundColor: LUXURY_COLORS.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  noDataText: { marginTop: 8 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonText: { fontSize: 14, fontWeight: "600", marginLeft: 8 },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 14, fontWeight: "500", marginLeft: 8 },
  profileGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap"
  },
  imageContainer: {
    width: 180,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    marginRight: 20,
    marginBottom: 12,
    backgroundColor: LUXURY_COLORS.inputBg,
    justifyContent: "center",
    alignItems: "center"
  },
  shopImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  imageUploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center"
  },
  shopInfo: { flex: 1, marginTop: 16, minWidth: 160 },
  label: { fontSize: 12, fontWeight: "500" },
  shopNameText: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  readOnlyContainer: { marginTop: 8 },
  infoRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1
  },
  value: { flex: 1, fontSize: 14 },
  editForm: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: LUXURY_COLORS.inputBorder },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    paddingVertical: 0
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 8
  },
  dropdownField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52
  },
  dropdownIcon: { marginRight: 10 },
  dropdownText: { flex: 1, fontSize: 16 },
  locationButton: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14
  },
  locationButtonText: { fontWeight: "bold", marginLeft: 10 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LUXURY_COLORS.inputBg,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: LUXURY_COLORS.inputBorder
  },
  chipText: { color: LUXURY_COLORS.darkText, fontSize: 14, marginRight: 6 },
  readOnlyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 8
  },
  inputLabel: { fontSize: 14, fontWeight: "500" },
  readOnlyValue: { fontSize: 14, fontWeight: "500" },
  saveButtonContainer: { marginTop: 24, alignItems: "flex-end" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveButtonText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "75%"
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", paddingVertical: 16, textAlign: "center" },
  modalSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 44
  },
  modalSearchInput: { flex: 1, fontSize: 16, paddingVertical: 0, marginLeft: 8 },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  modalItemText: { fontSize: 16, marginLeft: 12 },
  modalDoneButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12
  },
  modalDoneText: { fontSize: 16, fontWeight: "bold" },
  categoryImage: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10
  },
  refreshText: { marginLeft: 8, fontWeight: '600' },

  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MAP_COLORS.card,
  },
  mapLoadingText: { marginTop: 12, fontWeight: '600', color: MAP_COLORS.textPrimary },

  centerMarkerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -100,
    marginTop: -85,
    width: 200,
    alignItems: 'center',
    zIndex: 2,
  },
  markerBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
    backgroundColor: MAP_COLORS.card,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
  },
  markerBubbleMoving: { opacity: 0.6 },
  markerText: { fontSize: 12, fontWeight: '600', color: MAP_COLORS.textPrimary },
  markerIcon: { transform: [{ translateY: 0 }] },
  markerIconMoving: { transform: [{ translateY: -12 }] },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },

  searchContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    height: 50,
    backgroundColor: MAP_COLORS.card,
    borderColor: MAP_COLORS.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    marginLeft: 10,
    marginRight: 8,
    color: MAP_COLORS.textPrimary,
  },
  searchResultsContainer: {
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: MAP_COLORS.card,
    borderColor: MAP_COLORS.cardBorder,
  },
  searchResultsList: { maxHeight: 250 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: MAP_COLORS.cardBorder,
  },
  searchResultTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  searchResultText: {
    fontSize: 14,
    fontWeight: '500',
    color: MAP_COLORS.textPrimary,
  },
  searchResultType: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
    color: MAP_COLORS.textSecondary,
  },

  closeButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MAP_COLORS.card,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    zIndex: 10,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MAP_COLORS.card,
    borderWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    zIndex: 10,
  },
  mapBottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    backgroundColor: MAP_COLORS.card,
    borderTopWidth: 1,
    borderColor: MAP_COLORS.cardBorder,
    marginTop: -20,
    zIndex: 5,
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  locationTextContainer: { flex: 1 },
  locationTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: MAP_COLORS.textPrimary },
  locationSubtitle: { fontSize: 13, lineHeight: 18, color: MAP_COLORS.textSecondary },
  divider: { height: 1, marginBottom: 16 },
  mapAddressPreview: { marginBottom: 16 },
  mapAddressText: { fontSize: 14, lineHeight: 22, color: MAP_COLORS.textPrimary },
  mapButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  mapCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: MAP_COLORS.cardBorder,
  },
  mapConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: MAP_COLORS.primary,
  },
  mapButtonText: { fontWeight: 'bold', fontSize: 16, color: MAP_COLORS.textPrimary },
});