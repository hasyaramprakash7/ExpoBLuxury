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

import AddAddressScreen from './AddAddressScreen';

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
// Reusable Dropdown and MultiSelect (unchanged)
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
// Main RentalCRUDScreen Component
// ================================================================
const RentalCRUDScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const rentals = useSelector(selectAllRentals);
  const loading = useSelector(selectRentalLoading);
  const error = useSelector(selectRentalError);
  const { currentPage, hasMore } = useSelector(selectRentalPagination);

  const vendor = useSelector((state: RootState) => state.vendorAuth.vendor);
  const currentVendorId = vendor?._id || vendor?.vendorId;

  const insets = useSafeAreaInsets(); // ✅ for top/bottom spacing

  const [formData, setFormData] = useState<RentalFormData>(initialFormData);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Location screen state
  const [showAddressScreen, setShowAddressScreen] = useState(false);

  // Build a summary string for the selected location
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

  // ========== Location Handler using AddAddressScreen ==========
  const handleLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    console.log('📍 Map location selected:', lat, lng, addressDetails);
    const city = addressDetails.city || '';
    const locality = addressDetails.colony || addressDetails.suburb || addressDetails.neighbourhood || addressDetails.street || '';
    const state = addressDetails.state || '';
    const pincode = addressDetails.pincode || '';
    const country = addressDetails.country || 'India';
    const district = addressDetails.district || '';
    const street = addressDetails.street || '';

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
      await dispatch(fetchRentals({ page: 1, limit: 10, vendorId: currentVendorId }));
    }
    setRefreshing(false);
  }, [dispatch, currentVendorId]);

  const handleLoadMore = () => {
    if (currentVendorId && hasMore && !loading && !refreshing) {
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

  // Image Picker with mount guard – using MediaTypeOptions for compatibility
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
      if (!result.canceled && isMounted.current) {
        setNewImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      if (isMounted.current) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open image picker. Please try again.' });
      }
    }
  };

  // ---- Remove an existing image (already saved on server) ----
  const removeExistingImage = (index: number) => {
    Alert.alert(
      'Remove Image',
      'This image will be deleted from the server. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setExistingImages((prev) => prev.filter((_, i) => i !== index));
            Toast.show({ type: 'info', text1: 'Image marked for removal' });
          }
        },
      ]
    );
  };

  // ---- Remove a newly picked image (not yet uploaded) ----
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
  // Render Form with Location Picker (using AddAddressScreen)
  // ================================================================
  const renderForm = () => {
    const allImages = [...existingImages, ...newImages.map(asset => asset.uri)];

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.formHeader, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={closeForm} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingId ? 'Edit Rental' : 'Add New Rental'}</Text>
          {/* Bell can be added here if needed */}
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Basic Details</Text>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(t) => handleChange('title', t)}
            placeholder="e.g. Cozy 2BHK Apartment"
            placeholderTextColor="#94A3B8"
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={formData.description}
            onChangeText={(t) => handleChange('description', t)}
            placeholder="Describe your rental..."
            placeholderTextColor="#94A3B8"
            multiline
          />

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
              <TextInput
                style={styles.input}
                value={formData.monthlyRent}
                onChangeText={(t) => handleChange('monthlyRent', t)}
                keyboardType="decimal-pad"
                placeholder="e.g. 15000"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Deposit (₹)</Text>
              <TextInput
                style={styles.input}
                value={formData.deposit}
                onChangeText={(t) => handleChange('deposit', t)}
                keyboardType="decimal-pad"
                placeholder="e.g. 30000"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Maintenance (₹)</Text>
              <TextInput
                style={styles.input}
                value={formData.maintenanceCharges}
                onChangeText={(t) => handleChange('maintenanceCharges', t)}
                keyboardType="decimal-pad"
                placeholder="e.g. 2000"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Available From</Text>
              <TextInput
                style={styles.input}
                value={formData.availableFrom}
                onChangeText={(t) => handleChange('availableFrom', t)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
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
              <TextInput
                style={styles.input}
                value={formData.maxGuests}
                onChangeText={(t) => handleChange('maxGuests', t)}
                keyboardType="numeric"
                placeholder="e.g. 4"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Bedrooms</Text>
              <TextInput
                style={styles.input}
                value={formData.bedrooms}
                onChangeText={(t) => handleChange('bedrooms', t)}
                keyboardType="numeric"
                placeholder="e.g. 2"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
          <Text style={styles.label}>Bathrooms</Text>
          <TextInput
            style={styles.input}
            value={formData.bathrooms}
            onChangeText={(t) => handleChange('bathrooms', t)}
            keyboardType="numeric"
            placeholder="e.g. 1"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <MultiSelectPills options={AMENITIES_LIST} selectedValues={formData.amenities} onToggle={handleToggleAmenity} />
        </View>

        {/* LOCATION PICKER */}
        <View style={styles.cardSection}>
          <View style={styles.locationHeader}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity
              style={styles.locationSelectBtn}
              onPress={() => setShowAddressScreen(true)}
            >
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.locationSelectText}>Select</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.locationSummary}
            onPress={() => setShowAddressScreen(true)}
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
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.input}
            value={formData.locationLocality}
            onChangeText={(t) => handleChange('locationLocality', t)}
            placeholder="Locality"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.input}
            value={formData.locationState}
            onChangeText={(t) => handleChange('locationState', t)}
            placeholder="State"
            placeholderTextColor="#94A3B8"
          />
          <TextInput
            style={styles.input}
            value={formData.locationPincode}
            onChangeText={(t) => handleChange('locationPincode', t)}
            placeholder="Pincode"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
          />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <TextInput
                style={styles.input}
                value={formData.lat}
                onChangeText={(t) => handleChange('lat', t)}
                placeholder="Latitude"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfWidth}>
              <TextInput
                style={styles.input}
                value={formData.lng}
                onChangeText={(t) => handleChange('lng', t)}
                placeholder="Longitude"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* IMAGE GALLERY */}
        <View style={[styles.cardSection, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Images</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
            <Ionicons name="images" size={24} color="#1B8C40" />
            <Text style={styles.uploadBtnText}>Select Photos</Text>
          </TouchableOpacity>
          <View style={styles.galleryGrid}>
            {allImages.map((uri, index) => {
              const isNew = index >= existingImages.length;
              const imageIndex = isNew ? index - existingImages.length : index;
              return (
                <View key={index} style={styles.galleryItem}>
                  <Image source={{ uri }} style={styles.galleryImage} />
                  <TouchableOpacity
                    style={styles.deleteBadge}
                    onPress={() => {
                      if (isNew) {
                        removeNewImage(imageIndex);
                      } else {
                        removeExistingImage(imageIndex);
                      }
                    }}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                  {!isNew && (
                    <View style={styles.existingBadge}>
                      <Text style={styles.existingBadgeText}>Saved</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {existingImages.length > 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>
              {existingImages.length} existing image(s) – tap ✕ to remove.
            </Text>
          )}
          {newImages.length > 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
              {newImages.length} new image(s) – will be uploaded.
            </Text>
          )}
        </View>

        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{editingId ? 'Update' : 'Publish'}</Text>}
          </TouchableOpacity>
        </View>

        <Modal
          visible={showAddressScreen}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowAddressScreen(false)}
        >
          <AddAddressScreen
            onClose={() => setShowAddressScreen(false)}
            onLocationSelect={handleLocationSelect}
          />
        </Modal>
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
      <View style={[styles.listHeader, { paddingTop: insets.top + 20 }]}>
        <View>
          <Text style={styles.greetingText}>Vendor Dashboard</Text>
          <Text style={styles.mainTitle}>My Rentals</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => Toast.show({ type: 'info', text1: 'Notifications', text2: 'Coming soon!' })}
          >
            <Ionicons name="notifications-outline" size={24} color="#0F172A" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setIsFormVisible(true);
            }}
            style={styles.floatingAddBtn}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rentals}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
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
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellButton: {
    marginRight: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#E53E3E',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  listContent: { padding: 20 },
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
  formHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#fff' },
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
  galleryItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
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
    zIndex: 2,
  },
  existingBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(27, 140, 64, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  existingBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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