// screens/RentalCRUDScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { RootState } from '../app/store';
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

// --- Custom Dropdown (unchanged) ---
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

// --- Multi-Select Pills ---
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

// --- Main Component ---
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

  useEffect(() => {
    if (currentVendorId) {
      console.log('🔄 Fetching rentals for vendor:', currentVendorId);
      dispatch(fetchRentals({ page: 1, limit: 10 }));
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
    console.log('🔄 Refreshing rentals...');
    setRefreshing(true);
    await dispatch(fetchRentals({ page: 1, limit: 10 }));
    setRefreshing(false);
  }, [dispatch]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing) {
      console.log(`📄 Loading more rentals: page ${currentPage + 1}`);
      dispatch(fetchRentals({ page: currentPage + 1, limit: 10 }));
    }
  };

  const renderFooter = () => {
    if (!loading || rentals.length === 0) return null;
    return <ActivityIndicator size="small" color="#4A148C" style={{ padding: 20 }} />;
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

  // ---------- GPS ----------
  const handleUseGps = async () => {
    console.log('📍 Using GPS to fill location...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('❌ Location permission denied.');
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location permission required.' });
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      console.log(`📍 GPS coordinates: ${latitude}, ${longitude}`);
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const { city, region, district, postalCode, street, name } = geocode[0];
        console.log('📍 Reverse geocoded:', { city, region, district, postalCode, street, name });
        setFormData((prev) => ({
          ...prev,
          lat: latitude.toString(),
          lng: longitude.toString(),
          locationCity: city || district || region || prev.locationCity,
          locationLocality: street || name || district || prev.locationLocality,
          locationState: region || prev.locationState,
          locationPincode: postalCode || prev.locationPincode,
        }));
        Toast.show({ type: 'success', text1: 'Location filled from GPS' });
      } else {
        console.log('📍 No reverse geocode result, using only coordinates.');
        setFormData((prev) => ({
          ...prev,
          lat: latitude.toString(),
          lng: longitude.toString(),
        }));
        Toast.show({ type: 'info', text1: 'Coordinates filled, enter address manually.' });
      }
    } catch (err) {
      console.error('❌ GPS error:', err);
      Toast.show({ type: 'error', text1: 'GPS Error', text2: 'Could not get location.' });
    }
  };

  // ---------- Image Picker (FIXED) ----------
  const pickImages = async () => {
  console.log('📸 Opening image picker...');
  try {
    // 1. Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log(`📸 Media library permission status: ${status}`);
    if (status !== 'granted') {
      console.warn('❌ Media library permission denied.');
      Toast.show({ type: 'error', text1: 'Permission required', text2: 'Allow access to your photo library.' });
      return;
    }

    // 2. Launch picker – FIXED: use MediaTypeOptions.Images
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,  // <-- changed
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: false,
    });

    console.log('📸 Picker result:', JSON.stringify(result, null, 2));

    if (!result.canceled) {
      console.log(`📸 Selected ${result.assets.length} images.`);
      setNewImages((prev) => [...prev, ...result.assets]);
    } else {
      console.log('📸 Image picker cancelled.');
    }
  } catch (error) {
    console.error('❌ Image picker error:', error);
    Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open image picker.' });
  }
};

  const removeNewImage = (index: number) => {
    console.log(`🗑️ Removing new image at index ${index}`);
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- Submit ----------
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

  // ✅ FIX: send existing images when editing
  if (editingId) {
    payload.existingImages = JSON.stringify(existingImages);
    console.log('📸 Sending existingImages:', existingImages);
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
    console.log(`🗑️ Attempting to delete rental ${id}`);
    Alert.alert(
      'Delete Rental',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          console.log(`🗑️ Dispatching deleteRental for ${id}`);
          dispatch(deleteRental(id));
        }},
      ]
    );
  };

  const openEditForm = (rental: Rental) => {
    console.log(`✏️ Opening edit form for rental ${rental._id}`);
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
    console.log('📋 Pre-filled form data:', formDataFromRental);
    setFormData(formDataFromRental);
    setExistingImages(rental.images || []);
    setNewImages([]);
    setEditingId(rental._id);
    setIsFormVisible(true);
  };

  const closeForm = () => {
    console.log('🔒 Closing form');
    setFormData(initialFormData);
    setExistingImages([]);
    setNewImages([]);
    setEditingId(null);
    setIsFormVisible(false);
  };

  // --- Render Form ---
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
            <Switch value={formData.isAvailable} onValueChange={(val) => handleChange('isAvailable', val)} trackColor={{ true: '#4A148C' }} />
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

        <View style={styles.cardSection}>
          <View style={[styles.row, { alignItems: 'center', marginBottom: 10 }]}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity onPress={handleUseGps} style={styles.gpsBtn}>
              <Ionicons name="navigate" size={14} color="#fff" />
              <Text style={styles.gpsBtnText}>Use GPS</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 15 }}>
            GPS will fill coordinates and address details.
          </Text>
          <TextInput style={styles.input} value={formData.locationCity} onChangeText={(t) => handleChange('locationCity', t)} placeholder="City" />
          <TextInput style={styles.input} value={formData.locationLocality} onChangeText={(t) => handleChange('locationLocality', t)} placeholder="Locality" />
          <TextInput style={styles.input} value={formData.locationState} onChangeText={(t) => handleChange('locationState', t)} placeholder="State" />
          <TextInput style={styles.input} value={formData.locationPincode} onChangeText={(t) => handleChange('locationPincode', t)} placeholder="Pincode" keyboardType="numeric" />
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <TextInput style={styles.input} value={formData.lat} onChangeText={(t) => handleChange('lat', t)} placeholder="Latitude" keyboardType="numeric" />
            </View>
            <View style={styles.halfWidth}>
              <TextInput style={styles.input} value={formData.lng} onChangeText={(t) => handleChange('lng', t)} placeholder="Longitude" keyboardType="numeric" />
            </View>
          </View>
        </View>

        <View style={[styles.cardSection, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Images</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImages}>
            <Ionicons name="images" size={24} color="#4A148C" />
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
      </ScrollView>
    );
  };

  // --- List View ---
  if (isFormVisible) return renderForm();

  if (loading && rentals.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A148C" />
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
        <TouchableOpacity onPress={() => {
          console.log('➕ Add rental button pressed');
          setIsFormVisible(true);
        }} style={styles.floatingAddBtn}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A148C" />}
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
                  <Ionicons name="pencil-outline" size={18} color="#4A148C" />
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

// --- Styles (unchanged) ---
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
    backgroundColor: '#4A148C',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4A148C',
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
  listingPrice: { fontSize: 20, fontWeight: '800', color: '#4A148C' },
  listingType: { fontSize: 13, fontWeight: '600', color: '#475569', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  listingTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  listingLocation: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  listingActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, flex: 1 },
  editBtn: { backgroundColor: '#F3E8FF', marginRight: 10 },
  editBtnText: { color: '#4A148C', fontWeight: '700', marginLeft: 6 },
  deleteBtn: { backgroundColor: '#FEF2F2', flex: 0.3 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
  emptyStateSub: { fontSize: 14, color: '#94A3B8', marginTop: 8 },
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
  pillActive: { backgroundColor: '#F3E8FF', borderColor: '#C084FC' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  pillTextActive: { color: '#4A148C' },
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
  dropdownOptionActive: { backgroundColor: '#F3E8FF', borderRadius: 8, paddingHorizontal: 10 },
  dropdownOptionText: { fontSize: 16, color: '#475569', textAlign: 'center' },
  dropdownOptionTextActive: { color: '#4A148C', fontWeight: '700' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
  },
  uploadBtnText: { color: '#4A148C', fontWeight: '700', fontSize: 15, marginLeft: 10 },
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
    backgroundColor: '#4A148C',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4A148C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
});

export default RentalCRUDScreen;