// AddAddressScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  TouchableWithoutFeedback,
  FlatList,
  Modal,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDispatch, RootState } from '../app/store';
import { saveUserAddress, setSelectedAddress, NewAddressPayload } from '../features/locationSlice';

const Colors = {
  white: '#FFFFFF',
  darkText: '#1C1C1E',
  grayText: '#6B7280',
  lightGray: '#F0F0F0',
  darkGreen: '#1B8C40',
  borderGray: '#E5E5EA',
  successGreen: '#34C759',
};

type AddressType = 'Home' | 'Work' | 'Other';

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
  const mapRef = useRef<MapView>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const { token } = useSelector((state: RootState) => state.auth);
  const { addressActionLoading } = useSelector((state: RootState) => state.location);

  const [region, setRegion] = useState<Region | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string>('Locating...');
  const [detailedAddress, setDetailedAddress] = useState<string>('');
  const [selectedType, setSelectedType] = useState<AddressType>('Home');
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  const [addressDetails, setAddressDetails] = useState({
    city: '',
    state: '',
    pincode: '',
    locality: '',
    street: '',
    country: 'India',
    colony: '',
    suburb: '',
    neighbourhood: '',
    district: '',
  });

  const defaultLocation = {
    latitude: 17.6868,
    longitude: 83.2185,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setIsLocating(true);
    setFetchedAddress('Locating your position...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need location access to pin your address.');
        setRegion(defaultLocation);
        setIsLocating(false);
        return;
      }
      let location = await Location.getLastKnownPositionAsync();
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }
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
      console.warn('Error getting location:', error);
      setRegion(defaultLocation);
      setFetchedAddress('Could not determine location');
    } finally {
      setIsLocating(false);
    }
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
          .filter((part) => part && part !== 'Unnamed Road')
          .join(', ');

        setFetchedAddress(addressParts || 'Unknown Location');
        setAddressDetails({
          city: place.city || place.district || '',
          state: place.region || '',
          pincode: place.postalCode || '',
          locality: place.subregion || place.district || '',
          street: place.street || place.name || '',
          country: place.country || 'India',
          colony: place.neighborhood || place.suburb || '',
          suburb: place.suburb || '',
          neighbourhood: place.neighbourhood || '',
          district: place.district || '',
        });
      } else {
        setFetchedAddress('Unknown Location');
        setAddressDetails({
          city: '',
          state: '',
          pincode: '',
          locality: '',
          street: '',
          country: 'India',
          colony: '',
          suburb: '',
          neighbourhood: '',
          district: '',
        });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setFetchedAddress('Could not fetch address details');
    }
  };

  // ========== SEARCH FUNCTIONALITY ==========
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
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=15&countrycodes=in`,
          {
            headers: { 'User-Agent': 'BLuxuryApp/1.0' },
          }
        );
        const data = await response.json();
        
        // Sort results by relevance
        const results = data.sort((a: any, b: any) => {
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
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const selectSearchResult = useCallback((item: any) => {
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
  }, []);

  const handleRegionChangeComplete = (newRegion: Region) => {
    setIsMapMoving(false);
    setRegion(newRegion);
    fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
    // Clear search results when map is moved
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleSaveAddress = () => {
    if (!token && !onLocationSelect) {
      Alert.alert('Error', 'You must be logged in to save an address.');
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
        Alert.alert('Failed to save address', err);
      });
  };

  const handleClose = () => {
    if (onClose) onClose();
    else navigation.goBack();
  };

  return (
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
                onRegionChange={() => setIsMapMoving(true)}
                onRegionChangeComplete={handleRegionChangeComplete}
              />
            ) : (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color={Colors.darkGreen} />
                <Text style={styles.mapLoadingText}>Finding your location...</Text>
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
                  {isMapMoving ? 'Move map to adjust' : 'Location selected here'}
                </Text>
              </View>
              <Ionicons
                name="location"
                size={42}
                color={Colors.darkText}
                style={[styles.markerIcon, isMapMoving && styles.markerIconMoving]}
              />
              <View style={styles.markerShadow} />
            </View>

            {/* Search Bar Overlay */}
            <View style={[styles.searchContainer, { top: Math.max(insets.top, 20) }]}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={Colors.grayText} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search locality, city, pincode..."
                  placeholderTextColor={Colors.grayText}
                  value={searchQuery}
                  onChangeText={searchLocations}
                  onFocus={() => {
                    if (searchQuery.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                />
                {isSearching && <ActivityIndicator size="small" color={Colors.darkGreen} />}
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.grayText} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results Dropdown */}
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
                        <Ionicons name="location-outline" size={18} color={Colors.darkGreen} />
                        <View style={styles.searchResultTextContainer}>
                          <Text style={styles.searchResultText} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                          <Text style={styles.searchResultType}>
                            {item.type || item.class || 'Location'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.grayText} />
                      </TouchableOpacity>
                    )}
                    keyboardShouldPersistTaps="always"
                    style={styles.searchResultsList}
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.closeButton, { top: Math.max(insets.top, 20) }]}
              onPress={handleClose}
            >
              <Ionicons name={onClose ? 'close' : 'arrow-back'} size={24} color={Colors.darkText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.myLocationButton} onPress={getCurrentLocation}>
              <Ionicons name="locate" size={24} color={Colors.darkGreen} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSheet}>
            <View style={styles.locationHeader}>
              <View style={styles.locationIconContainer}>
                <Ionicons name="location" size={24} color={Colors.darkGreen} />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationTitle}>Delivery Location</Text>
                <Text style={styles.locationSubtitle} numberOfLines={2}>
                  {isLocating ? 'Fetching address...' : fetchedAddress}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TextInput
              style={styles.input}
              placeholder="House / Flat / Block No."
              placeholderTextColor={Colors.grayText}
              value={detailedAddress}
              onChangeText={setDetailedAddress}
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
                    onPress={() => setSelectedType(type)}
                  >
                    <Ionicons
                      name={iconName as any}
                      size={16}
                      color={isSelected ? Colors.darkGreen : Colors.darkText}
                    />
                    <Text
                      style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
              disabled={addressActionLoading}
            >
              {addressActionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save Address and Proceed</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  mapContainer: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
  },
  mapLoadingText: { marginTop: 12, color: Colors.darkText, fontWeight: '600' },
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
    backgroundColor: Colors.darkText,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
  },
  markerBubbleMoving: { opacity: 0.5 },
  markerText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  markerIcon: { transform: [{ translateY: 0 }] },
  markerIconMoving: { transform: [{ translateY: -12 }] },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },
  
  // Search styles
  searchContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: Colors.darkText,
    fontSize: 15,
    paddingVertical: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  searchResultsContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  searchResultsList: {
    maxHeight: 250,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  searchResultTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  searchResultText: {
    color: Colors.darkText,
    fontSize: 14,
    fontWeight: '500',
  },
  searchResultType: {
    color: Colors.grayText,
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  
  closeButton: {
    position: 'absolute',
    left: 16,
    backgroundColor: Colors.white,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: Colors.white,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bottomSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginTop: -20,
    zIndex: 5,
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(27, 140, 64, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: { flex: 1 },
  locationTitle: { fontSize: 16, fontWeight: '700', color: Colors.darkText, marginBottom: 4 },
  locationSubtitle: { fontSize: 13, color: Colors.grayText, lineHeight: 18 },
  divider: { height: 1, backgroundColor: Colors.borderGray, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.darkText,
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  saveAsLabel: { fontSize: 14, fontWeight: '600', color: Colors.grayText, marginBottom: 12 },
  typeContainer: { flexDirection: 'row', marginBottom: 24 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: Colors.white,
  },
  typeChipSelected: { borderColor: Colors.darkGreen, backgroundColor: 'rgba(27, 140, 64, 0.05)' },
  typeChipText: { fontSize: 14, fontWeight: '600', color: Colors.darkText, marginLeft: 6 },
  typeChipTextSelected: { color: Colors.darkGreen },
  saveButton: {
    backgroundColor: Colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: Colors.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveButtonText: { color: Colors.white, fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});

export default AddAddressScreen;