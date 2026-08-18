// screens/RentalCRUDScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Modal,
  RefreshControl,
  Switch,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { RootState } from '../app/store';
import MapView, { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchRentals,
  createRental,
  updateRental,
  deleteRental,
  selectAllRentals,
  selectRentalLoading,
  selectRentalError,
  selectRentalPagination,
  Rental,
} from '../features/rentalSlice';

type RentalType = 'PG' | 'Hotel' | 'Apartment' | 'Villa' | 'Hostel' | 'Guest House';
type AddressType = "Home" | "Work" | "Other";

interface RentalFormData {
  title: string;
  description: string;
  rentalType: RentalType;
  monthlyRent: string;
  deposit: string;
  maintenanceCharges: string;
  isAvailable: boolean;
  availableFrom: string;
  maxGuests: string;
  bedrooms: string;
  bathrooms: string;
  amenities: string[];
  locationCity: string;
  locationLocality: string;
  locationState: string;
  locationPincode: string;
  lat: string;
  lng: string;
}

const initialFormData: RentalFormData = {
  title: '',
  description: '',
  rentalType: 'Apartment',
  monthlyRent: '',
  deposit: '0',
  maintenanceCharges: '0',
  isAvailable: true,
  availableFrom: new Date().toISOString().split('T')[0],
  maxGuests: '2',
  bedrooms: '1',
  bathrooms: '1',
  amenities: [],
  locationCity: '',
  locationLocality: '',
  locationState: '',
  locationPincode: '',
  lat: '',
  lng: '',
};

const RENTAL_TYPES: RentalType[] = ['PG', 'Hotel', 'Apartment', 'Villa', 'Hostel', 'Guest House'];
const AMENITIES_LIST = [
  'WiFi', 'TV', 'Air Conditioning', 'Heating', 'Kitchen', 'Parking',
  'Elevator', 'Gym', 'Pool', 'Security', 'Laundry', 'Pet Friendly',
  'Balcony', 'Furnished',
];

const { width, height } = Dimensions.get('window');

// ================================================================
// 1. Map Picker Modal - Updated with AddAddressScreen UI
// ================================================================
interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (lat: number, lng: number, addressDetails: any) => void;
  initialLat?: number;
  initialLng?: number;
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLat,
  initialLng,
}) => {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  
  const [region, setRegion] = useState<Region | null>(null);
  const [fetchedAddress, setFetchedAddress] = useState<string>("Locating...");
  const [detailedAddress, setDetailedAddress] = useState<string>("");
  const [selectedType, setSelectedType] = useState<AddressType>("Home");
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [addressDetails, setAddressDetails] = useState({
    pincode: "",
    state: "",
    district: "",
    city: "",
    country: "India",
    street: "",
    colony: "",
    suburb: "",
    neighbourhood: "",
  });

  const defaultLocation = {
    latitude: 17.6868,
    longitude: 83.2185,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && initialLat && initialLng) {
      const newRegion = {
        latitude: initialLat,
        longitude: initialLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(newRegion);
      fetchAddressFromCoords(initialLat, initialLng);
    }
  }, [visible, initialLat, initialLng]);

  const getCurrentLocation = async () => {
    setIsLocating(true);
    setFetchedAddress("Locating your position...");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "We need location access to pin your address."
        );
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
      console.warn("Error getting location:", error);
      setRegion(defaultLocation);
      setFetchedAddress("Could not determine location");
    } finally {
      setIsLocating(false);
    }
  };

  const fetchAddressFromCoords = async (latitude: number, longitude: number) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (geocode.length > 0) {
        const place = geocode[0];
        
        // Build comprehensive address parts
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
        
        // Store all address components
        setAddressDetails({
          pincode: place.postalCode || "",
          state: place.region || "",
          district: place.district || "",
          city: place.city || "",
          country: place.country || "India",
          street: place.street || place.name || "",
          colony: place.subregion || place.district || "",
          suburb: place.suburb || "",
          neighbourhood: place.neighbourhood || "",
        });
      } else {
        setFetchedAddress("Unknown Location");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setFetchedAddress("Could not fetch address details");
    }
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    setIsMapMoving(false);
    setRegion(newRegion);
    fetchAddressFromCoords(newRegion.latitude, newRegion.longitude);
  };

  const confirmLocation = () => {
    if (!region) {
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

    onLocationSelect(region.latitude, region.longitude, addressData);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={mapModalStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={mapModalStyles.container}>
            {/* MAP SECTION */}
            <View style={mapModalStyles.mapContainer}>
              {region ? (
                <MapView
                  ref={mapRef}
                  style={mapModalStyles.map}
                  initialRegion={region}
                  showsUserLocation={true}
                  showsMyLocationButton={false}
                  onRegionChange={() => setIsMapMoving(true)}
                  onRegionChangeComplete={handleRegionChangeComplete}
                />
              ) : (
                <View style={mapModalStyles.mapLoading}>
                  <ActivityIndicator size="large" color="#1B8C40" />
                  <Text style={mapModalStyles.mapLoadingText}>
                    Finding your location...
                  </Text>
                </View>
              )}

              {/* Fixed Center Pin */}
              <View style={mapModalStyles.centerMarkerContainer} pointerEvents="none">
                <View
                  style={[
                    mapModalStyles.markerBubble,
                    isMapMoving && mapModalStyles.markerBubbleMoving,
                  ]}
                >
                  <Text style={mapModalStyles.markerText}>
                    {isMapMoving
                      ? "Move map to adjust"
                      : "Location selected here"}
                  </Text>
                </View>
                <Ionicons
                  name="location"
                  size={42}
                  color="#1C1C1E"
                  style={[
                    mapModalStyles.markerIcon,
                    isMapMoving && mapModalStyles.markerIconMoving,
                  ]}
                />
                <View style={mapModalStyles.markerShadow} />
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={[mapModalStyles.closeButton, { top: Math.max(insets.top, 20) }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>

              {/* Re-center Button */}
              <TouchableOpacity
                style={mapModalStyles.myLocationButton}
                onPress={getCurrentLocation}
              >
                <Ionicons name="locate" size={24} color="#1B8C40" />
              </TouchableOpacity>
            </View>

            {/* BOTTOM SHEET */}
            <View style={mapModalStyles.bottomSheet}>
              <View style={mapModalStyles.locationHeader}>
                <View style={mapModalStyles.locationIconContainer}>
                  <Ionicons
                    name="location"
                    size={24}
                    color="#1B8C40"
                  />
                </View>
                <View style={mapModalStyles.locationTextContainer}>
                  <Text style={mapModalStyles.locationTitle}>Property Location</Text>
                  <Text style={mapModalStyles.locationSubtitle} numberOfLines={2}>
                    {isLocating ? "Fetching address..." : fetchedAddress}
                  </Text>
                </View>
              </View>

              <View style={mapModalStyles.divider} />

              <TextInput
                style={mapModalStyles.input}
                placeholder="House / Flat / Block No."
                placeholderTextColor="#6B7280"
                value={detailedAddress}
                onChangeText={setDetailedAddress}
              />

              <Text style={mapModalStyles.saveAsLabel}>Save as</Text>
              <View style={mapModalStyles.typeContainer}>
                {(["Home", "Work", "Other"] as AddressType[]).map((type) => {
                  const isSelected = selectedType === type;
                  let iconName = "location-outline";
                  if (type === "Home") iconName = "home-outline";
                  if (type === "Work") iconName = "briefcase-outline";

                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        mapModalStyles.typeChip,
                        isSelected && mapModalStyles.typeChipSelected,
                      ]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={16}
                        color={isSelected ? "#1B8C40" : "#1C1C1E"}
                      />
                      <Text
                        style={[
                          mapModalStyles.typeChipText,
                          isSelected && mapModalStyles.typeChipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={mapModalStyles.buttonRow}>
                <TouchableOpacity
                  style={mapModalStyles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={mapModalStyles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={mapModalStyles.confirmButton}
                  onPress={confirmLocation}
                >
                  <Text style={mapModalStyles.confirmButtonText}>
                    Confirm Location
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const mapModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#F0F0F0',
  },
  mapLoadingText: {
    marginTop: 12,
    color: '#1C1C1E',
    fontWeight: "600",
  },
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
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 5,
  },
  markerBubbleMoving: {
    opacity: 0.5,
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: "600",
  },
  markerIcon: {
    transform: [{ translateY: 0 }],
  },
  markerIconMoving: {
    transform: [{ translateY: -12 }],
  },
  markerShadow: {
    width: 8,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 4,
    marginTop: -6,
    transform: [{ scaleX: 2.5 }],
  },
  closeButton: {
    position: "absolute",
    left: 16,
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  myLocationButton: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginTop: -20,
    zIndex: 5,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(27, 140, 64, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: '#1C1C1E',
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1C1C1E',
    backgroundColor: '#F9F9F9',
    marginBottom: 20,
  },
  saveAsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: '#6B7280',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: "row",
    marginBottom: 24,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  typeChipSelected: {
    borderColor: '#1B8C40',
    backgroundColor: "rgba(27, 140, 64, 0.05)",
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: '#1C1C1E',
    marginLeft: 6,
  },
  typeChipTextSelected: {
    color: '#1B8C40',
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#1B8C40',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: '#1B8C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});

// ================================================================
// 2. Address Modal (without delete option)
// ================================================================
interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onAddCurrentLocation: () => void;
  onOpenMap: () => void;
  selectedAddressString?: string;
  isLoading?: boolean;
}

const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onClose,
  onAddCurrentLocation,
  onOpenMap,
  selectedAddressString,
  isLoading,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={addressModalStyles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={addressModalStyles.bottomSheet}>
          <View style={addressModalStyles.bottomSheetHandle} />

          <View style={addressModalStyles.sheetHeader}>
            <Text style={addressModalStyles.sheetTitle}>Select Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={addressModalStyles.addressList} showsVerticalScrollIndicator={false}>
            {/* Use Current Location */}
            <TouchableOpacity
              style={addressModalStyles.currentLocationContainer}
              onPress={onAddCurrentLocation}
              disabled={isLoading}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={22} color="#0B1021" />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Use my current location
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddressString || "Fetch GPS & find nearby rentals"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* Pick from Map */}
            <TouchableOpacity
              style={[addressModalStyles.currentLocationContainer, { borderTopWidth: 0 }]}
              onPress={onOpenMap}
            >
              <View style={[addressModalStyles.currentLocationIcon, { backgroundColor: 'rgba(27, 140, 64, 0.1)' }]}>
                <Ionicons name="map" size={22} color="#1B8C40" />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={[addressModalStyles.currentLocationTitle, { color: "#1B8C40" }]}>
                  Pick from Map
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  Search and select location on map
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color="#0B1021" />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const addressModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#F8F9FA',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: height * 0.8,
    overflow: 'hidden',
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    letterSpacing: -0.3,
  },
  addressList: {
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11, 16, 33, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0B1021',
    marginBottom: 2,
  },
  addressInfo: {
    flex: 1,
    paddingRight: 10,
  },
  addressString: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

// ================================================================
// 3. Main RentalCRUD Component
// ================================================================
const RentalCRUDScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const rentals = useSelector(selectAllRentals);
  const loading = useSelector(selectRentalLoading);
  const error = useSelector(selectRentalError);
  const { currentPage, hasMore } = useSelector(selectRentalPagination);

  const vendor = useSelector((state: RootState) => state.vendorAuth.vendor);
  const currentVendorId = vendor?._id || vendor?.vendorId;

  const [formData, setFormData] = useState<RentalFormData>(initialFormData);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Location modal states
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerCoords, setMapPickerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Build a summary string for the selected location
  const getLocationSummary = useCallback(() => {
    const parts = [];
    if (formData.locationLocality && formData.locationLocality !== 'Unknown Locality') 
      parts.push(formData.locationLocality);
    if (formData.locationCity) parts.push(formData.locationCity);
    if (formData.locationState) parts.push(formData.locationState);
    if (formData.locationPincode) parts.push(formData.locationPincode);
    
    // If we have coordinates but no address, show coordinates
    if (parts.length === 0 && formData.lat && formData.lng) {
      return `📍 ${parseFloat(formData.lat).toFixed(6)}, ${parseFloat(formData.lng).toFixed(6)}`;
    }
    
    return parts.length ? parts.join(', ') : 'Select a location';
  }, [formData]);

  // ========== Location Handlers ==========
  const handleAddCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location permission required.' });
        setIsLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const { city, region, district, postalCode, street, name, subregion } = geocode[0];
        const detectedCity = city || district || region || '';
        const detectedLocality = street || name || subregion || district || '';
        const detectedState = region || '';
        const detectedPincode = postalCode || '';

        setFormData((prev) => ({
          ...prev,
          lat: latitude.toString(),
          lng: longitude.toString(),
          locationCity: detectedCity,
          locationLocality: detectedLocality,
          locationState: detectedState,
          locationPincode: detectedPincode,
        }));

        Toast.show({
          type: 'success',
          text1: 'Location Detected',
          text2: `📍 ${detectedLocality}, ${detectedCity}`,
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          lat: latitude.toString(),
          lng: longitude.toString(),
        }));
        Toast.show({ type: 'info', text1: 'Coordinates filled', text2: 'Enter address manually.' });
      }
    } catch (error) {
      console.error('❌ Location detection error:', error);
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not detect location.' });
    } finally {
      setIsLocating(false);
      setShowAddressModal(false);
    }
  }, []);

  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setMapPickerCoords(
      formData.lat && formData.lng
        ? { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) }
        : null
    );
    setShowMapPicker(true);
  }, [formData.lat, formData.lng]);

  const handleMapLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    console.log('📍 Map location selected:', lat, lng, addressDetails);
    
    // Extract all available address components with fallbacks
    const city = addressDetails.city || '';
    const locality = addressDetails.colony || addressDetails.suburb || addressDetails.neighbourhood || addressDetails.street || '';
    const state = addressDetails.state || '';
    const pincode = addressDetails.pincode || '';
    const country = addressDetails.country || 'India';
    const district = addressDetails.district || '';
    const street = addressDetails.street || '';
    
    // Build a comprehensive address string for display
    const addressParts = [
      street,
      addressDetails.colony,
      addressDetails.suburb,
      addressDetails.neighbourhood,
      locality,
      city,
      district,
      state,
      pincode,
      country,
    ].filter(Boolean);
    
    const fullAddress = addressParts.join(', ');
    
    // Update form data with all available address fields
    setFormData((prev) => ({
      ...prev,
      lat: lat.toString(),
      lng: lng.toString(),
      locationCity: city,
      locationLocality: locality || city || 'Unknown Locality',
      locationState: state,
      locationPincode: pincode,
    }));
    
    Toast.show({ 
      type: 'success', 
      text1: 'Location Set', 
      text2: `📍 ${fullAddress || 'Address filled from map.'}` 
    });
  }, []);

  // ========== Existing CRUD Logic ==========
  useEffect(() => {
    if (currentVendorId) {
      console.log('🔄 Fetching rentals for vendor:', currentVendorId);
      // ✅ Pass vendorId
      dispatch(fetchRentals({ page: 1, limit: 10, vendorId: currentVendorId }));
    } else {
      console.warn('⚠️ No vendor ID found, skipping rental fetch.');
    }
  }, [dispatch, currentVendorId]);

  useEffect(() => {
    if (error) {
      console.error('❌ Rental error from Redux:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error });
    }
  }, [error]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (currentVendorId) {
      // ✅ Pass vendorId
      await dispatch(fetchRentals({ page: 1, limit: 10, vendorId: currentVendorId }));
    }
    setRefreshing(false);
  }, [dispatch, currentVendorId]);

  const handleLoadMore = () => {
    if (currentVendorId && hasMore && !loading && !refreshing) {
      // ✅ Pass vendorId
      dispatch(fetchRentals({ page: currentPage + 1, limit: 10, vendorId: currentVendorId }));
    }
  };

  const renderFooter = () => {
    if (!loading || rentals.length === 0) return null;
    return <ActivityIndicator size="small" color="#1B8C40" style={{ padding: 20 }} />;
  };

  const handleChange = (name: keyof RentalFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleAmenity = (value: string) => {
    setFormData((prev) => {
      const current = prev.amenities;
      if (current.includes(value)) {
        return { ...prev, amenities: current.filter((item) => item !== value) };
      } else {
        return { ...prev, amenities: [...current, value] };
      }
    });
  };

  // Image Picker
  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission required', text2: 'Allow access to your photo library.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        base64: false,
      });
      if (!result.canceled) {
        setNewImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open image picker.' });
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit
  const handleSubmit = async () => {
    console.log('🚀 Submitting rental form...');
    if (!formData.title) {
      Toast.show({ type: 'error', text1: 'Title required' });
      return;
    }
    if (!formData.monthlyRent) {
      Toast.show({ type: 'error', text1: 'Rent required' });
      return;
    }
    if (!formData.lat || !formData.lng) {
      Toast.show({ type: 'error', text1: 'Location coordinates required' });
      return;
    }

    const payload: any = {
      title: formData.title,
      description: formData.description || '',
      rentalType: formData.rentalType,
      monthlyRent: parseFloat(formData.monthlyRent),
      deposit: parseFloat(formData.deposit || '0'),
      maintenanceCharges: parseFloat(formData.maintenanceCharges || '0'),
      isAvailable: formData.isAvailable,
      availableFrom: formData.availableFrom || new Date().toISOString().split('T')[0],
      maxGuests: formData.maxGuests ? parseInt(formData.maxGuests) : undefined,
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
      amenities: formData.amenities || [],
      location: {
        city: formData.locationCity || 'Unknown City',
        locality: formData.locationLocality || 'Unknown Locality',
        state: formData.locationState || 'Unknown State',
        pincode: formData.locationPincode || '',
        coordinates: {
          type: 'Point',
          coordinates: [parseFloat(formData.lng), parseFloat(formData.lat)],
        },
      },
      vendor: {
        vendorId: vendor?._id || vendor?.vendorId,
        name: vendor?.name || '',
        contact: vendor?.phone || '',
      },
      images: newImages,
    };

    if (editingId) {
      payload.existingImages = JSON.stringify(existingImages);
    }

    let resultAction;
    if (editingId) {
      resultAction = await dispatch(updateRental({ id: editingId, payload }));
    } else {
      resultAction = await dispatch(createRental(payload));
    }

    if (createRental.fulfilled.match(resultAction) || updateRental.fulfilled.match(resultAction)) {
      Toast.show({ type: 'success', text1: 'Rental saved successfully!' });
      closeForm();
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: resultAction?.payload as string || 'Unknown error' });
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Rental',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          dispatch(deleteRental(id));
        }},
      ]
    );
  };

  const openEditForm = (rental: Rental) => {
    const coords = rental.location?.coordinates?.coordinates || [];
    const hasCoords = coords.length === 2;
    const formDataFromRental = {
      title: rental.title || '',
      description: rental.description || '',
      rentalType: rental.rentalType || 'Apartment',
      monthlyRent: rental.monthlyRent?.toString() || '',
      deposit: rental.deposit?.toString() || '0',
      maintenanceCharges: rental.maintenanceCharges?.toString() || '0',
      isAvailable: rental.isAvailable ?? true,
      availableFrom: rental.availableFrom ? new Date(rental.availableFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      maxGuests: rental.maxGuests?.toString() || '',
      bedrooms: rental.bedrooms?.toString() || '',
      bathrooms: rental.bathrooms?.toString() || '',
      amenities: rental.amenities || [],
      locationCity: rental.location?.city || '',
      locationLocality: rental.location?.locality || '',
      locationState: rental.location?.state || '',
      locationPincode: rental.location?.pincode || '',
      lat: hasCoords ? coords[1].toString() : '',
      lng: hasCoords ? coords[0].toString() : '',
    };
    setFormData(formDataFromRental);
    setExistingImages(rental.images || []);
    setNewImages([]);
    setEditingId(rental._id);
    setIsFormVisible(true);
  };

  const closeForm = () => {
    setFormData(initialFormData);
    setExistingImages([]);
    setNewImages([]);
    setEditingId(null);
    setIsFormVisible(false);
  };

  // ================================================================
  // Render Form with Location Picker
  // ================================================================
  const renderForm = () => {
    const allImages = [...existingImages, ...newImages.map(asset => asset.uri)];

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={closeForm} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Rental' : 'Add New Rental'}</Text>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Basic Details</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={formData.title} onChangeText={(t) => handleChange('title', t)} placeholder="e.g. Cozy 2BHK Apartment" />
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80 }]} value={formData.description} onChangeText={(t) => handleChange('description', t)} placeholder="Describe your rental..." multiline />

          <CustomDropdown
            label="Rental Type"
            options={RENTAL_TYPES}
            selectedValue={formData.rentalType}
            onSelect={(val) => handleChange('rentalType', val)}
            placeholder="Select type"
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Monthly Rent (₹)</Text>
              <TextInput style={styles.input} value={formData.monthlyRent} onChangeText={(t) => handleChange('monthlyRent', t)} keyboardType="decimal-pad" placeholder="e.g. 15000" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Deposit (₹)</Text>
              <TextInput style={styles.input} value={formData.deposit} onChangeText={(t) => handleChange('deposit', t)} keyboardType="decimal-pad" placeholder="e.g. 30000" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Maintenance (₹)</Text>
              <TextInput style={styles.input} value={formData.maintenanceCharges} onChangeText={(t) => handleChange('maintenanceCharges', t)} keyboardType="decimal-pad" placeholder="e.g. 2000" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Available From</Text>
              <TextInput style={styles.input} value={formData.availableFrom} onChangeText={(t) => handleChange('availableFrom', t)} placeholder="YYYY-MM-DD" />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Available Now</Text>
            <Switch value={formData.isAvailable} onValueChange={(val) => handleChange('isAvailable', val)} trackColor={{ true: '#1B8C40' }} thumbColor={formData.isAvailable ? '#FFFFFF' : '#F4F3F4'} />
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Capacity & Rooms</Text>
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Max Guests</Text>
              <TextInput style={styles.input} value={formData.maxGuests} onChangeText={(t) => handleChange('maxGuests', t)} keyboardType="numeric" placeholder="e.g. 4" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Bedrooms</Text>
              <TextInput style={styles.input} value={formData.bedrooms} onChangeText={(t) => handleChange('bedrooms', t)} keyboardType="numeric" placeholder="e.g. 2" />
            </View>
          </View>
          <Text style={styles.label}>Bathrooms</Text>
          <TextInput style={styles.input} value={formData.bathrooms} onChangeText={(t) => handleChange('bathrooms', t)} keyboardType="numeric" placeholder="e.g. 1" />
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <MultiSelectPills options={AMENITIES_LIST} selectedValues={formData.amenities} onToggle={handleToggleAmenity} />
        </View>

        {/* ========== LOCATION PICKER ========== */}
        <View style={styles.cardSection}>
          <View style={styles.locationHeader}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity
              style={styles.locationSelectBtn}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.locationSelectText}>Select</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.locationSummary}
            onPress={() => setShowAddressModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-sharp" size={20} color="#1B8C40" />
            <Text style={styles.locationSummaryText} numberOfLines={1}>
              {getLocationSummary()}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6B7280" />
          </TouchableOpacity>

          {formData.lat && formData.lng && (
            <Text style={styles.coordsHint}>
              📌 {parseFloat(formData.lat).toFixed(6)}, {parseFloat(formData.lng).toFixed(6)}
            </Text>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Manual Override (optional)</Text>
          <TextInput
            style={styles.input}
            value={formData.locationCity}
            onChangeText={(t) => handleChange('locationCity', t)}
            placeholder="City"
          />
          <TextInput
            style={styles.input}
            value={formData.locationLocality}
            onChangeText={(t) => handleChange('locationLocality', t)}
            placeholder="Locality"
          />
          <TextInput
            style={styles.input}
            value={formData.locationState}
            onChangeText={(t) => handleChange('locationState', t)}
            placeholder="State"
          />
          <TextInput
            style={styles.input}
            value={formData.locationPincode}
            onChangeText={(t) => handleChange('locationPincode', t)}
            placeholder="Pincode"
            keyboardType="numeric"
          />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <TextInput
                style={styles.input}
                value={formData.lat}
                onChangeText={(t) => handleChange('lat', t)}
                placeholder="Latitude"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfWidth}>
              <TextInput
                style={styles.input}
                value={formData.lng}
                onChangeText={(t) => handleChange('lng', t)}
                placeholder="Longitude"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={[styles.cardSection, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Images</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
            <Ionicons name="images" size={24} color="#1B8C40" />
            <Text style={styles.uploadBtnText}>Select Photos</Text>
          </TouchableOpacity>
          <View style={styles.galleryGrid}>
            {allImages.map((uri, index) => {
              const isNew = index >= existingImages.length;
              return (
                <View key={index} style={styles.galleryItem}>
                  <Image source={{ uri }} style={styles.galleryImage} />
                  {isNew && (
                    <TouchableOpacity style={styles.deleteBadge} onPress={() => removeNewImage(index - existingImages.length)}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
          {existingImages.length > 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>
              {existingImages.length} existing image(s) – new images will be added.
            </Text>
          )}
        </View>

        <View style={styles.stickyFooter}>
          <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{editingId ? 'Update' : 'Publish'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <AddressModal
          visible={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onAddCurrentLocation={handleAddCurrentLocation}
          onOpenMap={handleOpenMapPicker}
          selectedAddressString={getLocationSummary()}
          isLoading={isLocating}
        />

        <MapPickerModal
          visible={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onLocationSelect={handleMapLocationSelect}
          initialLat={mapPickerCoords?.lat}
          initialLng={mapPickerCoords?.lng}
        />
      </ScrollView>
    );
  };

  // ================================================================
  // List View
  // ================================================================
  if (isFormVisible) return renderForm();

  if (loading && rentals.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B8C40" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.greetingText}>Vendor Dashboard</Text>
          <Text style={styles.mainTitle}>My Rentals</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setIsFormVisible(true);
          }}
          style={styles.floatingAddBtn}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rentals}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B8C40" />}
        renderItem={({ item }) => (
          <View style={styles.listingCard}>
            <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/300' }} style={styles.listingImage} />
            <View style={styles.listingBody}>
              <View style={styles.listingRow}>
                <Text style={styles.listingPrice}>₹{item.monthlyRent}/mo</Text>
                <Text style={styles.listingType}>{item.rentalType}</Text>
              </View>
              <Text style={styles.listingTitle}>{item.title}</Text>
              <Text style={styles.listingLocation}>{item.location?.locality}, {item.location?.city}</Text>
              <View style={styles.listingActions}>
                <TouchableOpacity onPress={() => openEditForm(item)} style={[styles.actionBtn, styles.editBtn]}>
                  <Ionicons name="pencil-outline" size={18} color="#1B8C40" />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)} style={[styles.actionBtn, styles.deleteBtn]}>
                  <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bed-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No rentals listed yet.</Text>
            <Text style={styles.emptyStateSub}>Tap the + button to add your first rental.</Text>
          </View>
        }
      />
    </View>
  );
};

// ================================================================
// Reusable Dropdown and MultiSelect
// ================================================================
const CustomDropdown = ({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder,
}: {
  label: string;
  options: string[];
  selectedValue: string;
  onSelect: (val: any) => void;
  placeholder: string;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setModalVisible(true)}>
        <Text style={[styles.dropdownButtonText, !selectedValue && { color: '#999' }]}>
          {selectedValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownOption, selectedValue === item && styles.dropdownOptionActive]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, selectedValue === item && styles.dropdownOptionTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const MultiSelectPills = ({
  options,
  selectedValues,
  onToggle,
}: {
  options: string[];
  selectedValues: string[];
  onToggle: (val: string) => void;
}) => (
  <View style={styles.pillContainer}>
    {options.map((option) => {
      const isSelected = selectedValues.includes(option);
      return (
        <TouchableOpacity
          key={option}
          style={[styles.pill, isSelected && styles.pillActive]}
          onPress={() => onToggle(option)}
        >
          <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
            {option} {isSelected && '✓'}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ================================================================
// Styles
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  greetingText: { fontSize: 14, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  mainTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  floatingAddBtn: {
    backgroundColor: '#1B8C40',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1B8C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  listContent: { padding: 20, paddingBottom: 100 },
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  listingImage: { width: '100%', height: 180, resizeMode: 'cover' },
  listingBody: { padding: 16 },
  listingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listingPrice: { fontSize: 20, fontWeight: '800', color: '#1B8C40' },
  listingType: { fontSize: 13, fontWeight: '600', color: '#475569', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  listingTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  listingLocation: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  listingActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, flex: 1 },
  editBtn: { backgroundColor: '#E8F5E9', marginRight: 10 },
  editBtnText: { color: '#1B8C40', fontWeight: '700', marginLeft: 6 },
  deleteBtn: { backgroundColor: '#FEF2F2', flex: 0.3 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptyStateSub: { fontSize: 14, color: '#94A3B8', marginTop: 8 },

  // Form styles
  formContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  formHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#fff' },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  cardSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfWidth: { width: '48%' },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
    marginBottom: 20,
  },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent' },
  pillActive: { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  pillTextActive: { color: '#1B8C40' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  dropdownButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dropdownButtonText: { fontSize: 15, color: '#1E293B' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dropdownModalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 16, textAlign: 'center' },
  dropdownOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dropdownOptionActive: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10 },
  dropdownOptionText: { fontSize: 16, color: '#475569', textAlign: 'center' },
  dropdownOptionTextActive: { color: '#1B8C40', fontWeight: '700' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#66BB6A',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
  },
  uploadBtnText: { color: '#1B8C40', fontWeight: '700', fontSize: 15, marginLeft: 10 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryItem: { width: '30%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F1F5F9' },
  galleryImage: { width: '100%', height: '100%', borderRadius: 12 },
  deleteBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#E53E3E',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitBtn: {
    backgroundColor: '#1B8C40',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#1B8C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  // Location picker styles
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B8C40',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  locationSelectText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  locationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  locationSummaryText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  coordsHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default RentalCRUDScreen;