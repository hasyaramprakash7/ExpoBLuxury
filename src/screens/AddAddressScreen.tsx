// AddAddressScreen.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  FlatList,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { AppDispatch, RootState } from "../app/store";
import {
  saveUserAddress,
  setSelectedAddress,
  NewAddressPayload,
} from "../features/locationSlice";

// ─────────────────────────────────────────────────────────────
// 👑 ROYAL PALETTE
// ─────────────────────────────────────────────────────────────
const Royal = {
  gold: "#D4AF37",
  goldSoft: "#E8CC7A",
  goldBright: "#F4DC90",
  goldDim: "rgba(212,175,55,0.35)",
  goldFaint: "rgba(212,175,55,0.10)",
  royalGreen: "#0A3D2B",
  royalGreenDeep: "#062318",
  obsidian: "#0B0B0F",
  ivory: "#FBF7EE",
  cream: "#FAF3E0",
  maroon: "#5C1A2B",
};

type AddressType = "Home" | "Work" | "Other";

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

interface AddAddressScreenProps {
  onClose: () => void;
  onSave?: () => void;
  onLocationSelect?: (lat: number, lng: number, addressDetails: any) => void;
}

const AddAddressScreen: React.FC<AddAddressScreenProps> = ({
  onClose,
  onSave,
  onLocationSelect,
}) => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();

  const webViewRef = useRef<WebView>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { token } = useSelector((state: RootState) => state.auth);
  const { addressActionLoading } = useSelector(
    (state: RootState) => state.location
  );

  const [initialCoords, setInitialCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string>("Locating...");
  const [detailedAddress, setDetailedAddress] = useState<string>("");
  const [selectedType, setSelectedType] = useState<AddressType>("Home");
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  const [addressDetails, setAddressDetails] = useState({
    city: "",
    state: "",
    pincode: "",
    locality: "",
    street: "",
    country: "India",
    colony: "",
    suburb: "",
    neighbourhood: "",
    district: "",
  });

  const defaultLocation = { latitude: 17.6868, longitude: 83.2185 };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setIsLocating(true);
    setFetchedAddress("Locating your exact position...");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need location access to pin your address."
        );
        handleLocationFound(defaultLocation.latitude, defaultLocation.longitude);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (location?.coords) {
        handleLocationFound(location.coords.latitude, location.coords.longitude);
      } else {
        handleLocationFound(defaultLocation.latitude, defaultLocation.longitude);
      }
    } catch (error) {
      console.warn("Error getting live location:", error);
      handleLocationFound(defaultLocation.latitude, defaultLocation.longitude);
      setFetchedAddress("Could not determine current location");
    }
  };

  const handleLocationFound = (lat: number, lng: number) => {
    if (!initialCoords) {
      setInitialCoords({ lat, lng });
    } else {
      webViewRef.current?.injectJavaScript(
        `window.updateMapCenter(${lat}, ${lng}); true;`
      );
    }
    setRegion({ latitude: lat, longitude: lng });
    fetchAddressFromCoords(lat, lng);
    setIsLocating(false);
  };

  const fetchAddressFromCoords = async (latitude: number, longitude: number) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const place = geocode[0];
        const addressParts = [
          place.name,
          place.street,
          place.subregion,
          place.district,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ]
          .filter((part) => part && part !== "Unnamed Road")
          .join(", ");

        setFetchedAddress(addressParts || "Unknown Location");
        setAddressDetails({
          city: place.city || place.district || "",
          state: place.region || "",
          pincode: place.postalCode || "",
          locality: place.subregion || place.district || "",
          street: place.street || place.name || "",
          country: place.country || "India",
          colony: place.neighborhood || place.suburb || "",
          suburb: place.suburb || "",
          neighbourhood: place.neighbourhood || "",
          district: place.district || "",
        });
      } else {
        setFetchedAddress("Unknown Location");
        setAddressDetails({
          city: "",
          state: "",
          pincode: "",
          locality: "",
          street: "",
          country: "India",
          colony: "",
          suburb: "",
          neighbourhood: "",
          district: "",
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setFetchedAddress("Could not fetch address details");
    }
  };

  const searchLocations = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearchResults(query.length > 0);

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
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1&limit=15&countrycodes=in`,
          { headers: { "User-Agent": "BLuxuryApp/1.0" } }
        );
        const data = await response.json();
        const results = data.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const cls = item.class || "";
            const type = item.type || "";
            if (
              [
                "neighbourhood",
                "suburb",
                "city",
                "town",
                "village",
                "district",
                "county",
                "state",
              ].includes(type)
            )
              return 1;
            if (
              ["highway", "road", "street", "amenity", "place", "boundary"].includes(
                cls
              )
            )
              return 2;
            return 3;
          };
          return getPriority(a) - getPriority(b);
        });
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const selectSearchResult = useCallback((item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    Keyboard.dismiss();
    handleLocationFound(lat, lon);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
    setIsSearching(false);
  }, []);

  const handleMapMessage = (event: any) => {
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
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          setIsMapMoving(false);
          setRegion({ latitude: lat, longitude: lng });
          fetchAddressFromCoords(lat, lng);
          setSearchResults([]);
          setShowSearchResults(false);
          setSearchQuery("");
        }
      }
    } catch (error) {
      console.warn("WebView Message Parsing Error:", error);
    }
  };

  const handleSaveAddress = () => {
    if (!token && !onLocationSelect) {
      Alert.alert("Error", "You must be logged in to save an address.");
      return;
    }
    if (!region) return;

    const finalAddressString = detailedAddress.trim()
      ? `${detailedAddress.trim()}, ${fetchedAddress}`
      : fetchedAddress;

    if (onLocationSelect) {
      onLocationSelect(region.latitude, region.longitude, {
        ...addressDetails,
        fullAddress: finalAddressString,
        addressString: finalAddressString,
      });
      onClose();
      return;
    }

    const addressData: NewAddressPayload = {
      type: selectedType,
      addressString: finalAddressString,
      latitude: region.latitude,
      longitude: region.longitude,
      city: addressDetails.city,
      pincode: addressDetails.pincode,
      state: addressDetails.state,
      locality: addressDetails.locality,
    };

    dispatch(saveUserAddress({ token, addressData }))
      .unwrap()
      .then((savedAddress) => {
        dispatch(setSelectedAddress(savedAddress));
        if (onSave) onSave();
        onClose();
      })
      .catch((err) => {
        Alert.alert("Failed to save address", err);
      });
  };

  const handleClose = () => {
    if (onClose) onClose();
    else navigation.goBack();
  };

  const generateMapHtml = useMemo(() => {
    if (!initialCoords) return "";
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: ${Royal.ivory}; }
          #map { width: 100%; height: 100%; }
          .leaflet-control-attribution { display: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false, attributionControl: false })
            .setView([${initialCoords.lat}, ${initialCoords.lng}], 17);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
          map.on('movestart', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'movestart' }));
          });
          map.on('moveend', function() {
            var center = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'moveend', lat: center.lat, lng: center.lng
            }));
          });
          window.updateMapCenter = function(lat, lng) {
            map.setView([lat, lng], 17, { animate: true });
          };
        </script>
      </body>
      </html>
    `;
  }, [initialCoords]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* ─── Map area ─── */}
        <View style={styles.mapContainer}>
          {initialCoords ? (
            <WebView
              ref={webViewRef}
              style={styles.map}
              source={{ html: generateMapHtml }}
              onMessage={handleMapMessage}
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={Royal.gold} />
              <Text style={styles.mapLoadingText}>
                Finding your current location…
              </Text>
              <View style={styles.goldHairline} />
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
              <View style={styles.markerBubbleCrown}>
                <Ionicons name="diamond" size={8} color={Royal.gold} />
              </View>
              <Text style={styles.markerText}>
                {isMapMoving ? "Move map to adjust" : "Location selected here"}
              </Text>
            </View>
            <View style={styles.markerPinWrap}>
              <LinearGradient
                colors={[Royal.goldBright, Royal.gold, Royal.goldSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.markerPinGold}
              >
                <Ionicons
                  name="location"
                  size={22}
                  color={Royal.obsidian}
                  style={[isMapMoving && styles.markerIconMoving]}
                />
              </LinearGradient>
            </View>
            <View style={styles.markerShadow} />
          </View>

          {/* Search bar */}
          <View style={[styles.searchContainer, { top: Math.max(insets.top, 20) }]}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Royal.gold} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search locality, city, pincode..."
                placeholderTextColor={Royal.royalGreen}
                value={searchQuery}
                onChangeText={searchLocations}
                onFocus={() => {
                  if (searchQuery.length > 0) setShowSearchResults(true);
                }}
              />
              {isSearching && (
                <ActivityIndicator size="small" color={Royal.gold} />
              )}
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                    Keyboard.dismiss();
                  }}
                >
                  <Ionicons name="close-circle" size={20} color={Royal.gold} />
                </TouchableOpacity>
              )}
            </View>

            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.place_id || index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => selectSearchResult(item)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={Royal.gold}
                      />
                      <View style={styles.searchResultTextContainer}>
                        <Text
                          style={styles.searchResultText}
                          numberOfLines={2}
                        >
                          {item.display_name}
                        </Text>
                        <Text style={styles.searchResultType}>
                          {(item.type || item.class || "Location").toUpperCase()}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Royal.gold}
                      />
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
            onPress={handleClose}
          >
            <Ionicons
              name={onClose ? "close" : "arrow-back"}
              size={22}
              color={Royal.gold}
            />
          </TouchableOpacity>

          {/* My location button */}
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={getCurrentLocation}
          >
            <Ionicons name="locate" size={22} color={Royal.gold} />
          </TouchableOpacity>
        </View>

        {/* ─── Bottom sheet ─── */}
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
          <LinearGradient
            colors={["rgba(212,175,55,0)", Royal.gold, "rgba(212,175,55,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sheetTopHairline}
            pointerEvents="none"
          />
          <View style={styles.sheetHandle} />

          <View style={styles.locationHeader}>
            <View style={styles.locationIconRing}>
              <LinearGradient
                colors={[Royal.goldBright, Royal.gold, Royal.goldSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.locationIconContainer}
              >
                <Ionicons name="location" size={20} color={Royal.obsidian} />
              </LinearGradient>
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationTitle}>DELIVERY LOCATION</Text>
              <Text style={styles.locationSubtitle} numberOfLines={2}>
                {isLocating ? "Fetching address…" : fetchedAddress}
              </Text>
            </View>
          </View>

          <View style={styles.goldDivider}>
            <View style={styles.goldDividerLine} />
            <Ionicons
              name="diamond-outline"
              size={10}
              color={Royal.gold}
              style={{ marginHorizontal: 8 }}
            />
            <View style={styles.goldDividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="House / Flat / Block No."
            placeholderTextColor={Royal.royalGreen}
            value={detailedAddress}
            onChangeText={setDetailedAddress}
          />

          <Text style={styles.saveAsLabel}>SAVE AS</Text>
          <View style={styles.typeContainer}>
            {(["Home", "Work", "Other"] as AddressType[]).map((type) => {
              const isSelected = selectedType === type;
              let iconName = "location-outline";
              if (type === "Home") iconName = "home-outline";
              if (type === "Work") iconName = "briefcase-outline";
              return (
                <TouchableOpacity
                  key={type}
                  style={styles.typeChipWrapper}
                  onPress={() => setSelectedType(type)}
                  activeOpacity={0.85}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={[Royal.goldBright, Royal.gold, Royal.goldSoft]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.typeChip}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={14}
                        color={Royal.obsidian}
                      />
                      <Text style={[styles.typeChipText, styles.typeChipTextSelected]}>
                        {type.toUpperCase()}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.typeChip}>
                      <Ionicons
                        name={iconName as any}
                        size={14}
                        color={Royal.gold}
                      />
                      <Text style={styles.typeChipText}>
                        {type.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAddress}
            disabled={addressActionLoading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Royal.goldBright, Royal.gold, Royal.goldSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.saveButtonShimmer}
              pointerEvents="none"
            />
            {addressActionLoading ? (
              <ActivityIndicator color={Royal.obsidian} />
            ) : (
              <View style={styles.saveButtonInner}>
                <Text style={styles.saveButtonText}>SAVE ADDRESS & PROCEED</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={Royal.obsidian}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────
// 👑 Royal Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.ivory },
  mapContainer: { flex: 1, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Royal.ivory,
  },
  mapLoadingText: {
    marginTop: 14,
    color: Royal.royalGreenDeep,
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 13,
  },
  goldHairline: {
    width: 48,
    height: 1,
    backgroundColor: Royal.gold,
    marginTop: 12,
    opacity: 0.6,
  },

  // ─── Marker ───
  centerMarkerContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -100,
    marginTop: -100,
    width: 200,
    alignItems: "center",
    zIndex: 2,
  },
  markerBubble: {
    backgroundColor: Royal.obsidian,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Royal.gold,
    alignItems: "center",
  },
  markerBubbleMoving: { opacity: 0.6 },
  markerBubbleCrown: {
    position: "absolute",
    top: -6,
    backgroundColor: Royal.obsidian,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  markerText: {
    color: Royal.ivory,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  markerPinWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Royal.ivory,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  markerPinGold: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  markerIconMoving: { transform: [{ translateY: -4 }] },
  markerShadow: {
    width: 14,
    height: 5,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 4,
    marginTop: 3,
    transform: [{ scaleX: 2 }],
  },

  // ─── Search ───
  searchContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Royal.ivory,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    height: 52,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    color: Royal.royalGreenDeep,
    fontSize: 14,
    paddingVertical: 0,
    marginLeft: 10,
    marginRight: 8,
    fontWeight: "500",
  },
  searchResultsContainer: {
    backgroundColor: Royal.ivory,
    borderRadius: 14,
    marginTop: 8,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: Royal.goldDim,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
  },
  searchResultsList: { maxHeight: 260 },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Royal.goldFaint,
  },
  searchResultTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  searchResultText: {
    color: Royal.royalGreenDeep,
    fontSize: 13,
    fontWeight: "600",
  },
  searchResultType: {
    color: Royal.gold,
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 1.2,
    fontWeight: "800",
  },

  // ─── Floating controls ───
  closeButton: {
    position: "absolute",
    left: 16,
    backgroundColor: Royal.ivory,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Royal.goldDim,
    elevation: 5,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  myLocationButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: Royal.ivory,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Royal.goldDim,
    elevation: 5,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },

  // ─── Bottom sheet ───
  bottomSheet: {
    backgroundColor: Royal.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Royal.goldDim,
    elevation: 18,
    shadowColor: Royal.obsidian,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    marginTop: -24,
    zIndex: 5,
    overflow: "hidden",
  },
  sheetTopHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 3,
    backgroundColor: Royal.gold,
    opacity: 0.55,
    alignSelf: "center",
    marginBottom: 16,
  },

  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  locationIconRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: Royal.gold,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    backgroundColor: Royal.goldFaint,
  },
  locationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  locationTextContainer: { flex: 1 },
  locationTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: Royal.gold,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 13,
    color: Royal.royalGreenDeep,
    lineHeight: 18,
    fontWeight: "500",
  },

  goldDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  goldDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Royal.goldDim,
  },

  input: {
    borderWidth: 1,
    borderColor: Royal.goldDim,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: Royal.royalGreenDeep,
    backgroundColor: Royal.cream,
    marginBottom: 20,
    fontWeight: "500",
  },

  saveAsLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: Royal.gold,
    marginBottom: 10,
    letterSpacing: 2.5,
  },
  typeContainer: { flexDirection: "row", marginBottom: 24 },
  typeChipWrapper: {
    marginRight: 10,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Royal.goldDim,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: Royal.ivory,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: "800",
    color: Royal.royalGreenDeep,
    marginLeft: 6,
    letterSpacing: 1.2,
  },
  typeChipTextSelected: { color: Royal.obsidian },

  saveButton: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Royal.goldSoft,
    elevation: 4,
    shadowColor: Royal.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  saveButtonShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  saveButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveButtonText: {
    color: Royal.obsidian,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
});

export default AddAddressScreen;