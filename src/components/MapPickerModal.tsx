// components/MapPickerModalOSM.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import MapView, { UrlTile, Region } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number, addressDetails: any) => void;
  initialLat?: number;
  initialLng?: number;
}

type AddressType = 'Home' | 'Work' | 'Other';

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLat,
  initialLng,
}) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string>('Locating...');
  const [detailedAddress, setDetailedAddress] = useState<string>('');
  const [selectedType, setSelectedType] = useState<AddressType>('Home');
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);

  const [addressDetails, setAddressDetails] = useState({
    pincode: '',
    state: '',
    district: '',
    city: '',
    country: 'India',
    street: '',
    colony: '',
    suburb: '',
    neighbourhood: '',
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const defaultLocation = {
    latitude: 17.6868,
    longitude: 83.2185,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // ---- Logging helper ----
  const log = (message: string, data?: any) => {
    console.log(`🗺️ [MapPicker] ${message}`, data || '');
  };

  // ---- Lifecycle logs ----
  useEffect(() => {
    log('Modal visibility changed', { visible, initialLat, initialLng });
    if (visible) {
      log('Modal opened – initiating location');
      getCurrentLocation();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && initialLat && initialLng) {
      log('Initial coordinates provided', { initialLat, initialLng });
      const newRegion = {
        latitude: initialLat,
        longitude: initialLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      fetchAddressFromCoords(initialLat, initialLng);
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [visible, initialLat, initialLng]);

  // ---- Location helpers ----
  const getCurrentLocation = async () => {
    log('getCurrentLocation called');
    setIsLocating(true);
    setFetchedAddress('Locating your position...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      log('Location permission status', status);
      if (status !== 'granted') {
        log('Permission denied');
        Alert.alert('Permission Denied', 'We need location access to pin your address.');
        setRegion(defaultLocation);
        setIsLocating(false);
        return;
      }

      log('Fetching last known position...');
      let location = await Location.getLastKnownPositionAsync();
      if (!location) {
        log('No last known position, fetching current position...');
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
      log('Location obtained', { 
        latitude: location.coords.latitude, 
        longitude: location.coords.longitude 
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
      fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
    } catch (error) {
      log('Error getting location', error);
      setRegion(defaultLocation);
      setFetchedAddress('Could not determine location');
    } finally {
      setIsLocating(false);
    }
  };

  const fetchAddressFromCoords = async (latitude: number, longitude: number) => {
    log('fetchAddressFromCoords called', { latitude, longitude });
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      log('Reverse geocode response', geocode.length > 0 ? 'success' : 'empty');
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
          .filter((part) => part && part !== 'Unnamed Road')
          .join(', ');

        log('Parsed address', addressParts);
        setFetchedAddress(addressParts || 'Unknown Location');
        setAddressDetails({
          pincode: place.postalCode || '',
          state: place.region || '',
          district: place.district || '',
          city: place.city || '',
          country: place.country || 'India',
          street: place.street || place.name || '',
          colony: place.subregion || place.district || '',
          suburb: place.suburb || '',
          neighbourhood: place.neighbourhood || '',
        });
      } else {
        log('No geocode data found');
        setFetchedAddress('Unknown Location');
      }
    } catch (error) {
      log('Geocoding error', error);
      setFetchedAddress('Could not fetch address details');
    }
  };

  // ---- Search using Nominatim ----
  const searchLocations = (query: string) => {
    log('Search triggered', query);
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
      log('Executing search for', query);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=15&countrycodes=in`,
          { headers: { 'User-Agent': 'BLuxuryApp/1.0' } }
        );
        const data = await response.json();
        log('Search results count', data.length);
        const results = data.sort((a: any, b: any) => {
          const getPriority = (item: any) => {
            const cls = item.class || '';
            const type = item.type || '';
            if (['neighbourhood', 'suburb', 'city', 'town', 'village', 'district', 'county', 'state'].includes(type))
              return 1;
            if (['highway', 'road', 'street', 'amenity', 'place', 'boundary'].includes(cls)) return 2;
            return 3;
          };
          return getPriority(a) - getPriority(b);
        });
        setSearchResults(results);
      } catch (error) {
        log('Search error', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const selectSearchResult = (item: any) => {
    log('Search result selected', item);
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    const newRegion = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 1000);
    fetchAddressFromCoords(lat, lon);

    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setIsSearching(false);
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    log('Region change complete', newRegion);
    setIsMapMoving(false);
    setRegion(newRegion);
    fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const confirmLocation = () => {
    log('Confirm location pressed', { region, detailedAddress, fetchedAddress });
    if (!region) {
      log('No region selected – showing toast');
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please select a location on the map.' });
      return;
    }

    const finalAddressString = detailedAddress.trim()
      ? `${detailedAddress.trim()}, ${fetchedAddress}`
      : fetchedAddress;

    const addressData = {
      ...addressDetails,
      street: detailedAddress.trim() || addressDetails.street,
      addressString: finalAddressString,
      type: selectedType,
      city: addressDetails.city || '',
      state: addressDetails.state || '',
      pincode: addressDetails.pincode || '',
      colony: addressDetails.colony || addressDetails.suburb || '',
      district: addressDetails.district || '',
      country: addressDetails.country || 'India',
    };

    log('Final address data', addressData);
    onLocationSelect(region.latitude, region.longitude, addressData);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.mapContainer}>
              {region ? (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={region}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  onRegionChange={() => {
                    log('Map region change started');
                    setIsMapMoving(true);
                  }}
                  onRegionChangeComplete={handleRegionChangeComplete}
                >
                  {/* OpenStreetMap tile layer (free, no API key) */}
                  <UrlTile
                    urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maximumZ={19}
                    tileSize={256}
                  />
                </MapView>
              ) : (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color="#1B8C40" />
                  <Text style={styles.mapLoadingText}>Finding your location...</Text>
                </View>
              )}

              {/* Center Marker */}
              <View style={styles.centerMarkerContainer} pointerEvents="none">
                <View style={[styles.markerBubble, isMapMoving && styles.markerBubbleMoving]}>
                  <Text style={styles.markerText}>
                    {isMapMoving ? 'Move map to adjust' : 'Location selected here'}
                  </Text>
                </View>
                <Ionicons name="location" size={42} color="#1A1A2E" />
                <View style={styles.markerShadow} />
              </View>

              {/* Search */}
              <View style={[styles.searchContainer, { top: Math.max(insets.top, 20) }]}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color="#8A8AAA" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search locality, city, pincode..."
                    placeholderTextColor="#8A8AAA"
                    value={searchQuery}
                    onChangeText={searchLocations}
                    onFocus={() => {
                      log('Search input focused');
                      if (searchQuery.length > 0) setShowSearchResults(true);
                    }}
                  />
                  {isSearching && <ActivityIndicator size="small" color="#1B8C40" />}
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        log('Search cleared');
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color="#8A8AAA" />
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
                          <Ionicons name="location-outline" size={18} color="#1B8C40" />
                          <View style={styles.searchResultTextContainer}>
                            <Text style={styles.searchResultText} numberOfLines={2}>
                              {item.display_name}
                            </Text>
                            <Text style={styles.searchResultType}>
                              {item.type || item.class || 'Location'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#8A8AAA" />
                        </TouchableOpacity>
                      )}
                      keyboardShouldPersistTaps="always"
                      style={styles.searchResultsList}
                    />
                  </View>
                )}
              </View>

              {/* Close & My Location buttons */}
              <TouchableOpacity
                style={[styles.closeButton, { top: Math.max(insets.top, 20) }]}
                onPress={() => {
                  log('Close button pressed');
                  onClose();
                }}
              >
                <Ionicons name="close" size={24} color="#1A1A2E" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.myLocationButton}
                onPress={() => {
                  log('My location button pressed');
                  getCurrentLocation();
                }}
              >
                <Ionicons name="locate" size={24} color="#1B8C40" />
              </TouchableOpacity>
            </View>

            {/* Bottom Sheet */}
            <View style={styles.bottomSheet}>
              <View style={styles.locationHeader}>
                <View style={styles.locationIconContainer}>
                  <Ionicons name="location" size={24} color="#1B8C40" />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationTitle}>Property Location</Text>
                  <Text style={styles.locationSubtitle} numberOfLines={2}>
                    {isLocating ? 'Fetching address...' : fetchedAddress}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <TextInput
                style={styles.input}
                placeholder="House / Flat / Block No."
                placeholderTextColor="#8A8AAA"
                value={detailedAddress}
                onChangeText={(text) => {
                  log('Detailed address changed', text);
                  setDetailedAddress(text);
                }}
              />

              <Text style={styles.saveAsLabel}>Save as</Text>
              <View style={styles.typeContainer}>
                {(['Home', 'Work', 'Other'] as AddressType[]).map((type) => {
                  const isSelected = selectedType === type;
                  let iconName = 'location-outline';
                  if (type === 'Home') iconName = 'home-outline';
                  if (type === 'Work') iconName = 'briefcase-outline';

                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                      onPress={() => {
                        log('Address type selected', type);
                        setSelectedType(type);
                      }}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={16}
                        color={isSelected ? '#1B8C40' : '#1A1A2E'}
                      />
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    log('Cancel button pressed');
                    onClose();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={confirmLocation}>
                  <Text style={styles.confirmButtonText}>Confirm Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ---- Styles (unchanged) ----
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  mapLoadingText: { marginTop: 12, color: '#1A1A2E', fontWeight: '600' },

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
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
  },
  markerBubbleMoving: { opacity: 0.5 },
  markerText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },

  searchContainer: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    height: 50,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#1A1A2E',
    fontSize: 15,
    paddingVertical: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  searchResultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  searchResultsList: { maxHeight: 250 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  searchResultTextContainer: { flex: 1, marginLeft: 12, marginRight: 8 },
  searchResultText: { color: '#1A1A2E', fontSize: 14, fontWeight: '500' },
  searchResultType: { color: '#8A8AAA', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },

  closeButton: {
    position: 'absolute',
    left: 16,
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },

  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 15,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    marginTop: -20,
    zIndex: 5,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: { flex: 1 },
  locationTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  locationSubtitle: { fontSize: 13, color: '#8A8AAA', lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#E8ECF0', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A2E',
    backgroundColor: '#F8F9FA',
    marginBottom: 20,
  },
  saveAsLabel: { fontSize: 14, fontWeight: '600', color: '#8A8AAA', marginBottom: 12 },
  typeContainer: { flexDirection: 'row', marginBottom: 24 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  typeChipSelected: { borderColor: '#1B8C40', backgroundColor: '#E8F5EE' },
  typeChipText: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginLeft: 6 },
  typeChipTextSelected: { color: '#1B8C40' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  cancelButtonText: { color: '#1A1A2E', fontSize: 16, fontWeight: '600' },
  confirmButton: {
    flex: 2,
    backgroundColor: '#1B8C40',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#1B8C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});