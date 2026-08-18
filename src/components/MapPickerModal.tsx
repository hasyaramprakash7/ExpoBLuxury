// src/components/MapPickerModal.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import axios from "axios";
import { Colors, scale, verticalScale, moderateScale } from "../constants/colors";

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number, addressDetails: any) => void;
  initialLat?: number;
  initialLng?: number;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLat,
  initialLng,
}) => {
  const mapRef = useRef<MapView>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [addressDetails, setAddressDetails] = useState({
    pincode: "",
    state: "",
    district: "",
    city: "",
    country: "India",
    street: "",
    colony: "",
  });
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get user location
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
    } catch (e) {
      // ignore
    }
  }, []);

  // Reverse geocode
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
      setAddressDetails({
        pincode: address.postcode || "",
        state: address.state || "",
        district: address.county || address.city_district || "",
        city: address.city || address.town || address.village || "",
        country: address.country || "India",
        street: address.road || "",
        colony: address.neighbourhood || address.suburb || "",
      });
      setFetchingAddress(false);
    } catch (e) {
      setFetchingAddress(false);
    }
  }, []);

  // Search locations
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
        const results = response.data.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const cls = item.class || '';
            const type = item.type || '';
            if (['neighbourhood', 'suburb', 'city', 'town', 'village', 'district', 'county', 'state'].includes(type)) return 1;
            if (['highway', 'road', 'street', 'amenity', 'place', 'boundary'].includes(cls)) return 2;
            return 3;
          };
          return getPriority(a) - getPriority(b);
        });
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  // Select search result
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

  // Handle map press
  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedCoords({ lat: latitude, lng: longitude });
    reverseGeocode(latitude, longitude);
  }, [reverseGeocode]);

  // Confirm location
  const confirmLocation = useCallback(() => {
    if (!selectedCoords) {
      Alert.alert("Error", "Please select a location on the map.");
      return;
    }
    onLocationSelect(selectedCoords.lat, selectedCoords.lng, addressDetails);
    onClose();
  }, [selectedCoords, addressDetails, onLocationSelect, onClose]);

  // Get user location when modal opens
  useEffect(() => {
    if (visible) {
      getUserLocation();
    }
  }, [visible, getUserLocation]);

  // Set initial location if provided
  useEffect(() => {
    if (visible && initialLat && initialLng) {
      setSelectedCoords({ lat: initialLat, lng: initialLng });
      reverseGeocode(initialLat, initialLng);
    }
  }, [visible, initialLat, initialLng, reverseGeocode]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={mapModalStyles.container}>
        <View style={mapModalStyles.mapContainer}>
          <MapView
            ref={mapRef}
            style={mapModalStyles.map}
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
                pinColor={Colors.accentGreen}
              />
            )}
          </MapView>
        </View>

        {/* Search Bar Overlay */}
        <View style={mapModalStyles.searchContainer}>
          <View style={mapModalStyles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textLightGray} />
            <TextInput
              style={mapModalStyles.searchInput}
              placeholder="Search locality, city, pincode..."
              placeholderTextColor={Colors.textLightGray}
              value={searchQuery}
              onChangeText={searchLocations}
            />
            {isSearching && <ActivityIndicator size="small" color={Colors.accentGreen} />}
          </View>
          {searchResults.length > 0 && (
            <View style={mapModalStyles.searchResults}>
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={mapModalStyles.searchResultItem}
                    onPress={() => selectSearchResult(item)}
                  >
                    <Text style={mapModalStyles.searchResultText} numberOfLines={1}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="always"
              />
            </View>
          )}
        </View>

        {/* Bottom Bar */}
        <View style={mapModalStyles.bottomBar}>
          {fetchingAddress ? (
            <ActivityIndicator color={Colors.accentGreen} />
          ) : (
            <>
              {selectedCoords ? (
                <View style={mapModalStyles.addressPreview}>
                  <Text style={mapModalStyles.addressText}>
                    📍 {addressDetails.street || "Street"}, {addressDetails.colony || "Colony"}
                  </Text>
                  <Text style={mapModalStyles.addressText}>
                    {addressDetails.city && `${addressDetails.city}, `}
                    {addressDetails.district && `${addressDetails.district}, `}
                    {addressDetails.state && `${addressDetails.state}`}
                    {addressDetails.pincode && ` - ${addressDetails.pincode}`}
                  </Text>
                </View>
              ) : (
                <Text style={mapModalStyles.addressText}>Search or tap on map to select location</Text>
              )}
            </>
          )}
          <View style={mapModalStyles.buttonRow}>
            <TouchableOpacity style={mapModalStyles.cancelButton} onPress={onClose}>
              <Text style={mapModalStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={mapModalStyles.confirmButton} onPress={confirmLocation}>
              <Text style={[mapModalStyles.buttonText, { color: "#0A0A0A" }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const mapModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#333",
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    paddingVertical: 0,
    marginLeft: 8,
  },
  searchResults: {
    backgroundColor: "#1C1C1C",
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: "#333",
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  searchResultText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1C1C1C",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  addressPreview: {
    marginBottom: 12,
  },
  addressText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 10,
    marginRight: 8,
    alignItems: "center",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.accentGreen,
    padding: 12,
    borderRadius: 10,
    marginLeft: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});