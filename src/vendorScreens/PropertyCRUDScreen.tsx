// screens/PropertyCRUDScreen.tsx
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
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { RootState } from '../app/store';
import {
  fetchProperties,
  createProperty,
  updateProperty,
  deleteProperty,
  Property,
  selectAllProperties,
  selectPropertyLoading,
  selectPropertyError,
  selectPropertyPagination,
} from '../features/propertySlice';
// 👇 Import AddAddressScreen (exactly the same as rental's map picker)
import AddAddressScreen from '../screens/AddAddressScreen';

// --------------------- Types ---------------------
type PropertyTypeEnum =
  | 'Independent House/Villa'
  | 'Apartment'
  | 'Plot'
  | 'Commercial'
  | 'Penthouse'
  | 'Studio';
type StatusEnum = 'New Launch' | 'Under Construction' | 'Ready to Move' | 'Resale';
type FurnishingEnum = 'Unfurnished' | 'Semi-Furnished' | 'Fully Furnished';
type FacingEnum =
  | 'North'
  | 'South'
  | 'East'
  | 'West'
  | 'North-East'
  | 'North-West'
  | 'South-East'
  | 'South-West'
  | '';
type OwnershipEnum = 'Freehold' | 'Leasehold' | 'Co-operative Society';

interface PropertyFormData {
  title: string;
  propertyType: PropertyTypeEnum;
  status: StatusEnum;
  minPriceCr: string;
  maxPriceCr: string;
  superBuiltUpSqFt: string;
  locationCity: string;
  locationLocality: string;
  locationState: string;
  locationPincode: string;
  lat: string;
  lng: string;
  bhk: string;
  bathrooms: string;
  balconies: string;
  totalFloors: string;
  propertyFloor: string;
  carParkingAvailable: boolean;
  furnishingStatus: FurnishingEnum;
  facing: FacingEnum;
  ownershipType: OwnershipEnum;
  possessionDate: string;
  builtYear: string;
  projectHighlights: string[];
  tags: string[];
  amenities: string[];
  websiteUrl: string;
  virtualTourUrl: string;
  registrationId: string;
  maintenanceCharges: string;
}

const initialFormData: PropertyFormData = {
  title: '',
  propertyType: 'Apartment',
  status: 'Under Construction',
  minPriceCr: '',
  maxPriceCr: '',
  superBuiltUpSqFt: '',
  locationCity: '',
  locationLocality: '',
  locationState: '',
  locationPincode: '',
  lat: '',
  lng: '',
  bhk: '3 BHK',
  bathrooms: '2',
  balconies: '1',
  totalFloors: '',
  propertyFloor: '',
  carParkingAvailable: true,
  furnishingStatus: 'Unfurnished',
  facing: '',
  ownershipType: 'Freehold',
  possessionDate: '2025-12-31',
  builtYear: '',
  projectHighlights: [],
  tags: [],
  amenities: [],
  websiteUrl: '',
  virtualTourUrl: '',
  registrationId: '',
  maintenanceCharges: '',
};

const PROPERTY_TYPES: PropertyTypeEnum[] = [
  'Apartment',
  'Independent House/Villa',
  'Plot',
  'Commercial',
  'Penthouse',
  'Studio',
];
const STATUS_TYPES: StatusEnum[] = [
  'Under Construction',
  'Ready to Move',
  'New Launch',
  'Resale',
];
const FURNISHING_TYPES: FurnishingEnum[] = [
  'Unfurnished',
  'Semi-Furnished',
  'Fully Furnished',
];
const FACING_TYPES: FacingEnum[] = [
  'North',
  'South',
  'East',
  'West',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
];
const OWNERSHIP_TYPES: OwnershipEnum[] = [
  'Freehold',
  'Leasehold',
  'Co-operative Society',
];

const AMENITIES_LIST = [
  'Gymnasium',
  'Swimming Pool',
  'Club House',
  '24/7 Security',
  'Power Backup',
  'Visitor Parking',
  'Elevator/Lift',
  'Kids Play Area',
  'Jogging Track',
  'Landscaped Gardens',
  'Sports Court',
  'CCTV Surveillance',
  'Fire Safety',
  'Water Treatment',
  'Piped Gas',
  'WIFI / Internet',
];

const HIGHLIGHTS_LIST = [
  'Sea View',
  'City Skyline View',
  'Near Highway',
  'Premium Finish',
  'Smart Home Automation',
  'Vastu Compliant',
  'Corner Property',
  'Gated Community',
  'High Rental Yield',
  'Close to Metro',
  'Close to Schools',
  'Close to Hospitals',
  'Airport Nearby',
];

const TAGS_LIST = [
  'Luxury',
  'Investment',
  'Ready to Move',
  'Under Construction',
  'Furnished',
  'Spacious',
  'Affordable',
  'Premium',
  'Exclusive',
  'Negotiable',
  'Urgent Sale',
  'Pet Friendly',
  'Bachelor Friendly',
];

// ================================================================
// 1. Address Modal (without saved addresses – only GPS & Map)
// ================================================================
const { width, height } = Dimensions.get('window');

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
                  {selectedAddressString || "Fetch GPS & fill location"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* Pick from Map – opens AddAddressScreen modal */}
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
// 2. Helper Functions
// ================================================================
const safeParseArray = (data: any): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) {
    if (data.length === 1 && typeof data[0] === 'string' && data[0].startsWith('[') && data[0].endsWith(']')) {
      try {
        const parsed = JSON.parse(data[0]);
        return Array.isArray(parsed) ? parsed : data;
      } catch {
        return data;
      }
    }
    return data;
  }
  if (typeof data === 'string' && data.startsWith('[') && data.endsWith(']')) {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// ================================================================
// 3. Sub‑components: Dropdown, MultiSelectPills
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
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={[
            styles.dropdownButtonText,
            !selectedValue && { color: '#999' },
          ]}
        >
          {selectedValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#64748B" />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.dropdownModalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownOption,
                    selectedValue === item && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      selectedValue === item && styles.dropdownOptionTextActive,
                    ]}
                  >
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
}) => {
  const handleClearAll = () => {
    const valuesToClear = [...selectedValues];
    valuesToClear.forEach((val) => onToggle(val));
  };

  return (
    <View style={styles.pillContainer}>
      {options.map((option) => {
        const isSelected = selectedValues.includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.pill,
              isSelected && styles.pillActive,
            ]}
            onPress={() => onToggle(option)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
              {option}
            </Text>
            {isSelected && (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#1B8C40"
                style={{ marginLeft: 6 }}
              />
            )}
          </TouchableOpacity>
        );
      })}
      {selectedValues.length > 0 && (
        <TouchableOpacity onPress={handleClearAll} style={styles.clearPill}>
          <Text style={styles.clearText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ================================================================
// 4. Main Component – PropertyCRUDScreen
// ================================================================
const PropertyCRUDScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const properties = useSelector(selectAllProperties);
  const loading = useSelector(selectPropertyLoading);
  const error = useSelector(selectPropertyError);
  const { currentPage, hasMore } = useSelector(selectPropertyPagination);

  const vendor = useSelector((state: RootState) => state.vendorAuth.vendor);
  const currentVendorId = vendor?._id || vendor?.vendorId;

  const [formData, setFormData] = useState<PropertyFormData>(initialFormData);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Location modal states
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);

  // 🔥 Enhanced getLocationSummary – falls back to coordinates
  const getLocationSummary = useCallback(() => {
    const parts = [];
    if (formData.locationLocality && formData.locationLocality !== 'Unknown Locality')
      parts.push(formData.locationLocality);
    if (formData.locationCity) parts.push(formData.locationCity);
    if (formData.locationState) parts.push(formData.locationState);
    if (formData.locationPincode) parts.push(formData.locationPincode);

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

  // 🔥 Open AddAddressScreen modal
  const handleOpenAddAddress = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddressModal(true);
  }, []);

  // 🔥 Location callback – exactly same extraction as rental's handleMapLocationSelect
  const handleLocationFromAddAddress = useCallback((lat: number, lng: number, addressDetails: any) => {
    console.log('📍 Property location selected:', { lat, lng, addressDetails });

    // Extract all available address components with fallbacks (exactly like rental)
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
      text2: `📍 ${fullAddress || 'Address filled from map.'}`,
    });
  }, []);

  const handleCloseAddAddress = useCallback(() => {
    setShowAddAddressModal(false);
  }, []);

  // ========== CRUD Logic (unchanged) ==========
  useEffect(() => {
    if (currentVendorId) {
      dispatch(fetchProperties({ vendorId: currentVendorId, page: 1, limit: 10 }));
    } else {
      console.warn('⚠️ No vendor ID found, skipping property fetch.');
    }
  }, [dispatch, currentVendorId]);

  useEffect(() => {
    if (error) {
      Toast.show({ type: 'error', text1: 'Error', text2: error });
    }
  }, [error]);

  const onRefresh = useCallback(async () => {
    if (!currentVendorId) {
      Toast.show({ type: 'info', text1: 'No Vendor', text2: 'Please login again.' });
      return;
    }
    setRefreshing(true);
    await dispatch(fetchProperties({ vendorId: currentVendorId, page: 1, limit: 10 }));
    setRefreshing(false);
  }, [dispatch, currentVendorId]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing && currentVendorId) {
      dispatch(fetchProperties({ vendorId: currentVendorId, page: currentPage + 1, limit: 10 }));
    }
  };

  const renderFooter = () => {
    if (!loading || properties.length === 0 || refreshing) return null;
    return <ActivityIndicator size="small" color="#1B8C40" style={{ padding: 20 }} />;
  };

  const handleChange = (name: keyof PropertyFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleArrayItem = (
    name: 'amenities' | 'projectHighlights' | 'tags',
    value: string
  ) => {
    setFormData((prev) => {
      const currentArray = prev[name];
      if (currentArray.includes(value)) {
        return { ...prev, [name]: currentArray.filter((item) => item !== value) };
      } else {
        return { ...prev, [name]: [...currentArray, value] };
      }
    });
  };

  // ---------- Image Picker ----------
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
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open image picker.' });
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!formData.title) {
      Toast.show({ type: 'error', text1: 'Missing Title' });
      return;
    }
    if (!formData.minPriceCr) {
      Toast.show({ type: 'error', text1: 'Missing Price' });
      return;
    }
    if (!formData.superBuiltUpSqFt) {
      Toast.show({ type: 'error', text1: 'Missing Area' });
      return;
    }
    if (!formData.lat || !formData.lng) {
      Toast.show({ type: 'error', text1: 'Missing Map Coordinates' });
      return;
    }

    const payload: any = {
      title: formData.title,
      propertyType: formData.propertyType,
      status: formData.status,
      minPriceCr: parseFloat(formData.minPriceCr),
      maxPriceCr: parseFloat(formData.maxPriceCr || formData.minPriceCr),
      possessionDate: formData.possessionDate || '2025-12-31',
      builtYear: formData.builtYear ? parseInt(formData.builtYear) : undefined,
      configuration: {
        bhk: formData.bhk || '3 BHK',
        totalFloors: parseInt(formData.totalFloors) || 1,
        bathrooms: parseInt(formData.bathrooms) || 1,
        balconies: parseInt(formData.balconies) || 0,
        propertyFloor: parseInt(formData.propertyFloor) || 1,
        carParkingAvailable: formData.carParkingAvailable,
        furnishingStatus: formData.furnishingStatus || 'Unfurnished',
        facing: formData.facing || undefined,
        ownershipType: formData.ownershipType || 'Freehold',
      },
      location: {
        address: `${formData.locationLocality}, ${formData.locationCity}, ${formData.locationState} ${formData.locationPincode}`,
        city: formData.locationCity || 'Unknown City',
        locality: formData.locationLocality || 'Unknown Locality',
        state: formData.locationState || 'Unknown State',
        zipCode: formData.locationPincode || '',
        coordinates: {
          type: 'Point',
          coordinates: [parseFloat(formData.lng), parseFloat(formData.lat)],
        },
      },
      builder: {
        vendorId: vendor?._id || vendor?.vendorId,
        name: vendor?.name || '',
        phone: vendor?.phone || '',
        shopName: vendor?.shopName || '',
        shopImage: vendor?.shopImage || '',
      },
      websiteUrl: formData.websiteUrl || undefined,
      virtualTourUrl: formData.virtualTourUrl || undefined,
      registrationId: formData.registrationId || undefined,
      maintenanceCharges: formData.maintenanceCharges ? parseFloat(formData.maintenanceCharges) : undefined,
      projectHighlights: formData.projectHighlights || [],
      tags: formData.tags || [],
      amenities: formData.amenities || [],
      areaOptions: [
        {
          optionName: 'Standard',
          superBuiltUpSqFt: parseFloat(formData.superBuiltUpSqFt),
          priceCr: parseFloat(formData.minPriceCr),
          ratePerSqFt: parseFloat(formData.superBuiltUpSqFt) > 0
            ? Math.round((parseFloat(formData.minPriceCr) * 10000000) / parseFloat(formData.superBuiltUpSqFt))
            : 0,
          govtChargesIncluded: false,
        },
      ],
      images: newImages,
    };

    let resultAction;
    if (editingId) {
      resultAction = await dispatch(updateProperty({ id: editingId, payload }));
    } else {
      resultAction = await dispatch(createProperty(payload));
    }

    if (createProperty.fulfilled.match(resultAction) || updateProperty.fulfilled.match(resultAction)) {
      Toast.show({ type: 'success', text1: 'Property saved successfully!' });
      closeForm();
    } else if (resultAction?.payload) {
      Toast.show({ type: 'error', text1: 'Error', text2: resultAction.payload as string });
    } else {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Unknown error occurred.' });
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          dispatch(deleteProperty(id));
        }},
      ]
    );
  };

  const openEditForm = (property: Property) => {
    const hasCoords =
      Array.isArray(property?.location?.coordinates?.coordinates) &&
      property.location.coordinates.coordinates.length === 2;

    const projectHighlights = safeParseArray(property?.projectHighlights);
    const tags = safeParseArray(property?.tags);
    const amenities = safeParseArray(property?.amenities);
    const images = property?.images || [];

    const formDataFromProperty: PropertyFormData = {
      title: property?.title || '',
      propertyType: property?.propertyType || 'Apartment',
      status: property?.status || 'Under Construction',
      minPriceCr: property?.minPriceCr?.toString() || '',
      maxPriceCr: property?.maxPriceCr?.toString() || '',
      superBuiltUpSqFt: property?.areaOptions?.[0]?.superBuiltUpSqFt?.toString() || '',
      locationCity: property?.location?.city || '',
      locationLocality: property?.location?.locality || '',
      locationState: property?.location?.state || '',
      locationPincode: property?.location?.pincode || property?.location?.zipCode || '',
      lat: hasCoords ? property.location.coordinates!.coordinates[1].toString() : '',
      lng: hasCoords ? property.location.coordinates!.coordinates[0].toString() : '',
      bhk: property?.configuration?.bhk || '3 BHK',
      bathrooms: property?.configuration?.bathrooms?.toString() || '2',
      balconies: property?.configuration?.balconies?.toString() || '1',
      totalFloors: property?.configuration?.totalFloors?.toString() || '',
      propertyFloor: property?.configuration?.propertyFloor?.toString() || '',
      carParkingAvailable: property?.configuration?.carParkingAvailable ?? true,
      furnishingStatus: property?.configuration?.furnishingStatus || 'Unfurnished',
      facing: (property?.configuration?.facing as FacingEnum) || '',
      ownershipType: property?.configuration?.ownershipType || 'Freehold',
      possessionDate: property?.possessionDate ? new Date(property.possessionDate).toISOString().split('T')[0] : '2025-12-31',
      builtYear: property?.builtYear?.toString() || '',
      projectHighlights: [...projectHighlights],
      tags: [...tags],
      amenities: [...amenities],
      websiteUrl: property?.websiteUrl || '',
      virtualTourUrl: property?.virtualTourUrl || '',
      registrationId: property?.registrationId || '',
      maintenanceCharges: property?.maintenanceCharges?.toString() || '',
    };

    setFormData(formDataFromProperty);
    setExistingImages([...images]);
    setNewImages([]);
    setEditingId(property?._id || null);
    setIsFormVisible(true);
  };

  const closeForm = () => {
    setFormData(initialFormData);
    setExistingImages([]);
    setNewImages([]);
    setEditingId(null);
    setIsFormVisible(false);
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  // ================================================================
  // Render Form with Location Picker
  // ================================================================
  const renderForm = () => {
    const allImages = [
      ...existingImages,
      ...newImages.map(asset => asset.uri)
    ];

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={closeForm} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editingId ? 'Edit Property' : 'Add New Listing'}
          </Text>
        </View>

        {/* Basic Details */}
        <View style={styles.cardSection}>
          <SectionTitle title="Basic Details" />
          <Text style={styles.label}>Property Title</Text>
          <TextInput style={styles.input} value={formData.title} onChangeText={(t) => handleChange('title', t)} placeholder="e.g. 3BHK Luxury Villa" />

          <Text style={styles.label}>Property Type</Text>
          <View style={styles.pillContainer}>
            {PROPERTY_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pill, formData.propertyType === type && styles.pillActive]}
                onPress={() => handleChange('propertyType', type)}
              >
                <Text style={[styles.pillText, formData.propertyType === type && styles.pillTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Construction Status</Text>
          <View style={styles.pillContainer}>
            {STATUS_TYPES.map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.pill, formData.status === status && styles.pillActive]}
                onPress={() => handleChange('status', status)}
              >
                <Text style={[styles.pillText, formData.status === status && styles.pillTextActive]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Possession Date</Text>
              <TextInput style={styles.input} value={formData.possessionDate} onChangeText={(t) => handleChange('possessionDate', t)} placeholder="YYYY-MM-DD" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Built Year</Text>
              <TextInput style={styles.input} value={formData.builtYear} onChangeText={(t) => handleChange('builtYear', t)} placeholder="e.g. 2022" keyboardType="numeric" />
            </View>
          </View>
        </View>

        {/* Pricing & Area */}
        <View style={styles.cardSection}>
          <SectionTitle title="Pricing & Area" />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Min Price (Cr)</Text>
              <TextInput style={styles.input} value={formData.minPriceCr} onChangeText={(t) => handleChange('minPriceCr', t)} placeholder="e.g. 1.5" keyboardType="decimal-pad" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Max Price (Cr)</Text>
              <TextInput style={styles.input} value={formData.maxPriceCr} onChangeText={(t) => handleChange('maxPriceCr', t)} placeholder="e.g. 2.0" keyboardType="decimal-pad" />
            </View>
          </View>
          <Text style={styles.label}>Super Built-up Area (Sq.Ft)</Text>
          <TextInput style={styles.input} value={formData.superBuiltUpSqFt} onChangeText={(t) => handleChange('superBuiltUpSqFt', t)} placeholder="e.g. 1500" keyboardType="numeric" />
        </View>

        {/* Deep Specifications */}
        <View style={styles.cardSection}>
          <SectionTitle title="Deep Specifications" />
          <Text style={styles.label}>Furnishing Status</Text>
          <View style={styles.pillContainer}>
            {FURNISHING_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pill, formData.furnishingStatus === type && styles.pillActive]}
                onPress={() => handleChange('furnishingStatus', type)}
              >
                <Text style={[styles.pillText, formData.furnishingStatus === type && styles.pillTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <CustomDropdown label="Property Facing" options={FACING_TYPES} selectedValue={formData.facing} onSelect={(val) => handleChange('facing', val)} placeholder="Select Facing Direction" />
          <CustomDropdown label="Ownership Type" options={OWNERSHIP_TYPES} selectedValue={formData.ownershipType} onSelect={(val) => handleChange('ownershipType', val)} placeholder="Select Ownership" />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>BHK Format</Text>
              <TextInput style={styles.input} value={formData.bhk} onChangeText={(t) => handleChange('bhk', t)} placeholder="e.g. 3 BHK" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Total Floors in Bldg</Text>
              <TextInput style={styles.input} value={formData.totalFloors} onChangeText={(t) => handleChange('totalFloors', t)} placeholder="e.g. 15" keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Bathrooms</Text>
              <TextInput style={styles.input} value={formData.bathrooms} onChangeText={(t) => handleChange('bathrooms', t)} placeholder="e.g. 2" keyboardType="numeric" />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Balconies</Text>
              <TextInput style={styles.input} value={formData.balconies} onChangeText={(t) => handleChange('balconies', t)} placeholder="e.g. 1" keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>Property Floor Number</Text>
          <TextInput style={styles.input} value={formData.propertyFloor} onChangeText={(t) => handleChange('propertyFloor', t)} placeholder="e.g. 4" keyboardType="numeric" />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Car Parking Available</Text>
            <TouchableOpacity
              style={[styles.switchTrack, formData.carParkingAvailable && styles.switchTrackActive]}
              onPress={() => handleChange('carParkingAvailable', !formData.carParkingAvailable)}
            >
              <View style={[styles.switchThumb, formData.carParkingAvailable && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ========== LOCATION PICKER ========== */}
        <View style={styles.cardSection}>
          <View style={styles.locationHeader}>
            <SectionTitle title="Location & Map" />
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
            style={[styles.input, { marginBottom: 10 }]}
            value={formData.locationCity}
            onChangeText={(t) => handleChange('locationCity', t)}
            placeholder="City"
          />
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
            value={formData.locationLocality}
            onChangeText={(t) => handleChange('locationLocality', t)}
            placeholder="Locality"
          />
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
            value={formData.locationState}
            onChangeText={(t) => handleChange('locationState', t)}
            placeholder="State"
          />
          <TextInput
            style={[styles.input, { marginBottom: 10 }]}
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

        {/* Legal & External Links */}
        <View style={styles.cardSection}>
          <SectionTitle title="Legal & External Links" />
          <Text style={styles.label}>RERA / Registration ID</Text>
          <TextInput style={styles.input} value={formData.registrationId} onChangeText={(t) => handleChange('registrationId', t)} placeholder="e.g. RERA-AP-12345" />
          <Text style={styles.label}>Monthly Maintenance (₹)</Text>
          <TextInput style={styles.input} value={formData.maintenanceCharges} onChangeText={(t) => handleChange('maintenanceCharges', t)} placeholder="e.g. 5000" keyboardType="numeric" />
          <Text style={styles.label}>Project Website URL</Text>
          <TextInput style={styles.input} value={formData.websiteUrl} onChangeText={(t) => handleChange('websiteUrl', t)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
          <Text style={styles.label}>Virtual Tour URL</Text>
          <TextInput style={styles.input} value={formData.virtualTourUrl} onChangeText={(t) => handleChange('virtualTourUrl', t)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
        </View>

        {/* Highlights & Tags */}
        <View style={styles.cardSection}>
          <SectionTitle title="Highlights & Tags" />
          <Text style={styles.label}>Select Amenities</Text>
          <MultiSelectPills
            options={AMENITIES_LIST}
            selectedValues={formData.amenities}
            onToggle={(val) => handleToggleArrayItem('amenities', val)}
          />
          <Text style={[styles.label, { marginTop: 10 }]}>Project Highlights</Text>
          <MultiSelectPills
            options={HIGHLIGHTS_LIST}
            selectedValues={formData.projectHighlights}
            onToggle={(val) => handleToggleArrayItem('projectHighlights', val)}
          />
          <Text style={[styles.label, { marginTop: 10 }]}>Search Tags</Text>
          <MultiSelectPills
            options={TAGS_LIST}
            selectedValues={formData.tags}
            onToggle={(val) => handleToggleArrayItem('tags', val)}
          />
        </View>

        {/* Property Media */}
        <View style={[styles.cardSection, { marginBottom: 40 }]}>
          <SectionTitle title="Property Media" />
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
            <Ionicons name="images" size={24} color="#1B8C40" />
            <Text style={styles.uploadBtnText}>Select Photos from Gallery</Text>
          </TouchableOpacity>
          <View style={styles.galleryGrid}>
            {allImages.map((uri, index) => {
              const isNew = index >= existingImages.length;
              return (
                <View key={`${uri}-${index}`} style={styles.galleryItem}>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{editingId ? 'Update Property' : 'Publish Listing'}</Text>}
          </TouchableOpacity>
        </View>

        {/* Address Modal (for GPS & Map) */}
        <AddressModal
          visible={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          onAddCurrentLocation={handleAddCurrentLocation}
          onOpenMap={handleOpenAddAddress}
          selectedAddressString={getLocationSummary()}
          isLoading={isLocating}
        />

        {/* 🔥 AddAddressScreen as a full-screen modal */}
        <Modal
          visible={showAddAddressModal}
          animationType="slide"
          transparent={false}
          onRequestClose={handleCloseAddAddress}
        >
          <AddAddressScreen
            onClose={handleCloseAddAddress}
            onLocationSelect={handleLocationFromAddAddress}
          />
        </Modal>
      </ScrollView>
    );
  };

  // ================================================================
  // List View
  // ================================================================
  if (isFormVisible) return renderForm();

  if (loading && properties.length === 0) {
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
          <Text style={styles.mainTitle}>My Properties</Text>
        </View>
        <TouchableOpacity onPress={() => setIsFormVisible(true)} style={styles.floatingAddBtn}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1B8C40" />}
        renderItem={({ item }) => {
          const coverImage = item?.images?.[0] || 'https://via.placeholder.com/300';
          return (
            <View style={styles.listingCard}>
              <View style={styles.listingImageContainer}>
                <Image source={{ uri: coverImage }} style={styles.listingImage} />
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.listingBody}>
                <View style={styles.listingRow}>
                  <Text style={styles.listingPrice}>₹ {item.minPriceCr} Cr</Text>
                  <Text style={styles.listingBhk}>{item.configuration?.bhk}</Text>
                </View>
                <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.listingLocation}>
                  <Ionicons name="location-outline" size={12} /> {item.location?.locality}, {item.location?.city}
                </Text>
                <View style={styles.vendorRow}>
                  <Ionicons name="storefront-outline" size={14} color="#64748B" />
                  <Text style={styles.vendorName}>{item.vendor?.shopName || item.vendor?.name || 'Unknown Vendor'}</Text>
                  {item.vendor?.phone && (
                    <Text style={styles.vendorPhone}>
                      <Ionicons name="call-outline" size={12} /> {item.vendor.phone}
                    </Text>
                  )}
                </View>
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
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={60} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No properties listed yet.</Text>
            <Text style={styles.emptyStateSub}>Tap the + button to add your first listing.</Text>
          </View>
        }
      />
    </View>
  );
};

// ================================================================
// 5. Styles (green & white theme)
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  // ---- Dropdown ----
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
  },
  dropdownButtonText: { fontSize: 15, color: '#1E293B' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  dropdownModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  dropdownOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionActive: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  dropdownOptionText: { fontSize: 16, color: '#475569', textAlign: 'center' },
  dropdownOptionTextActive: { color: '#1B8C40', fontWeight: '700' },

  // ---- Pills ----
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#1B8C40',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pillActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#66BB6A',
    shadowColor: '#1B8C40',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#1B8C40',
  },
  clearPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E53E3E',
  },

  // ---- Header ----
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

  // ---- Listing Card ----
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
  listingImageContainer: { width: '100%', height: 180, backgroundColor: '#E2E8F0' },
  listingImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  listingBody: { padding: 16 },
  listingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listingPrice: { fontSize: 20, fontWeight: '800', color: '#1B8C40' },
  listingBhk: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  listingTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  listingLocation: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
  },
  vendorName: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginLeft: 4 },
  vendorPhone: { fontSize: 12, color: '#64748B', marginLeft: 'auto' },
  listingActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, flex: 1 },
  editBtn: { backgroundColor: '#E8F5E9', marginRight: 10 },
  editBtnText: { color: '#1B8C40', fontWeight: '700', marginLeft: 6 },
  deleteBtn: { backgroundColor: '#FEF2F2', flex: 0.3 },

  // ---- Empty State ----
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptyStateSub: { fontSize: 14, color: '#94A3B8', marginTop: 8 },

  // ---- Form ----
  formContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
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
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    padding: 2,
  },
  switchTrackActive: { backgroundColor: '#1B8C40' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  switchThumbActive: { transform: [{ translateX: 22 }] },

  // ---- Location Picker ----
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

  // ---- Image Upload ----
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
});

export default PropertyCRUDScreen;