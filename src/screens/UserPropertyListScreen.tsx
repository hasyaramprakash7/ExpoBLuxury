// screens/UserPropertyListScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  Linking,
  StatusBar,
  Animated,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import MapView, { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import {
  fetchProperties,
  selectAllProperties,
  selectPropertyLoading,
  selectPropertyPagination,
} from '../features/propertySlice';
import {
  fetchAllVendors as fetchAllVendorsAuth,
} from '../features/vendor/vendorAuthSlice';
import { RootState } from '../app/store';

import {
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  selectAllAddresses,
} from '../features/locationSlice';

// Import the new AddAddressScreen (WebView based)
import AddAddressScreen from './AddAddressScreen';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const isSmallPhone = width < 375;
const HEADER_HEIGHT = 230;

const Colors = {
  white: '#FFFFFF',
  pureWhite: '#FFFFFF',
  offWhite: '#F8F9FA',
  lightBg: '#F5F6FA',
  border: '#E8ECF0',
  borderLight: '#F0F2F5',
  textPrimary: '#1A1A2E',
  textSecondary: '#4A4A6A',
  textTertiary: '#8A8AAA',
  accentGreen: '#1B8C40',
  accentGreenLight: '#E8F5EE',
  accentGreenDark: '#15692F',
  luxuryGold: '#D4AF37',
  goldLight: '#F9E2AF',
  royalNavy: '#1A1A2E',
  charcoal: '#2D3748',
  slate: '#64748B',
  darkSlate: '#475569',
  success: '#10B981',
  error: '#EF4444',
  shadow: 'rgba(0,0,0,0.06)',
  shadowDark: 'rgba(0,0,0,0.1)',
  glassBorder: 'rgba(0,0,0,0.06)',
  trueBlack: '#000000',
};

const PROPERTY_TYPES = ['Independent House/Villa', 'Apartment', 'Plot', 'Commercial', 'Penthouse', 'Studio'];
const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type AddressType = "Home" | "Work" | "Other";

// ================================================================
// 1. Address Modal (unchanged)
// ================================================================
interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress: (address: any) => void;
  onAddAddress: () => void;
  selectedAddress: any;
  addresses: any[];
  isLoading: boolean;
  onOpenMap: () => void;
}

const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onClose,
  onSelectAddress,
  onAddAddress,
  selectedAddress,
  addresses,
  isLoading,
  onOpenMap,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={addressModalStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={addressModalStyles.bottomSheet}>
          <View style={addressModalStyles.bottomSheetHandle} />
          <View style={addressModalStyles.sheetHeader}>
            <Text style={addressModalStyles.sheetTitle}>Select Location</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={addressModalStyles.addressList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={addressModalStyles.currentLocationContainer} onPress={onAddAddress}>
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={22} color={Colors.accentGreen} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>Use my current location</Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddress ? selectedAddress.addressString : "Fetch GPS & find nearby properties"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity style={[addressModalStyles.currentLocationContainer, { borderTopWidth: 0 }]} onPress={onOpenMap}>
              <View style={[addressModalStyles.currentLocationIcon, { backgroundColor: Colors.accentGreenLight }]}>
                <Ionicons name="map" size={22} color={Colors.accentGreen} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={[addressModalStyles.currentLocationTitle, { color: Colors.accentGreen }]}>Pick from Map</Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>Search and select location on map</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={addressModalStyles.sectionDivider} />

            {addresses.length > 0 && (
              <>
                <Text style={addressModalStyles.savedAddressesHeader}>SAVED ADDRESSES</Text>
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id;
                  let iconName = "location";
                  if (addr.type === "Home") iconName = "home";
                  if (addr.type === "Work") iconName = "briefcase";
                  if (addr.type === "Current Location") iconName = "locate";

                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[addressModalStyles.addressItem, isSelected && addressModalStyles.addressItemSelected]}
                      onPress={() => onSelectAddress(addr)}
                    >
                      <View style={addressModalStyles.iconContainer}>
                        <Ionicons name={iconName as any} size={22} color={isSelected ? Colors.accentGreen : Colors.textSecondary} />
                      </View>
                      <View style={addressModalStyles.addressInfo}>
                        <View style={addressModalStyles.addressTypeRow}>
                          <Text style={[addressModalStyles.addressType, isSelected && { color: Colors.accentGreen }]}>
                            {addr.type}
                          </Text>
                          {isSelected && (
                            <View style={addressModalStyles.selectedBadge}>
                              <Text style={addressModalStyles.selectedBadgeText}>Selected</Text>
                            </View>
                          )}
                        </View>
                        <Text style={addressModalStyles.addressString} numberOfLines={2}>
                          {addr.addressString}
                        </Text>
                        {addr.landmark && <Text style={addressModalStyles.landmarkText}>📍 {addr.landmark}</Text>}
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={24} color={Colors.success} />}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.accentGreen} />
              </View>
            )}
          </ScrollView>

          <View style={addressModalStyles.addAddressFooter}>
            <TouchableOpacity style={addressModalStyles.addAddressButton} onPress={onAddAddress}>
              <Ionicons name="add" size={20} color={Colors.accentGreen} />
              <Text style={addressModalStyles.addAddressButtonText}>Add new address</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const addressModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: height * 0.8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  bottomSheetHandle: { width: 40, height: 5, backgroundColor: Colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, letterSpacing: -0.3 },
  addressList: { maxHeight: height * 0.55 },
  currentLocationContainer: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: Colors.white, marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  currentLocationIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentGreenLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  currentLocationTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  addressInfo: { flex: 1, paddingRight: 10 },
  addressString: { fontSize: 13, color: Colors.textTertiary, lineHeight: 18 },
  landmarkText: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  sectionDivider: { height: 8, backgroundColor: Colors.offWhite, width: '100%' },
  savedAddressesHeader: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  addressItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  addressItemSelected: { backgroundColor: Colors.accentGreenLight },
  iconContainer: { width: 30, alignItems: 'flex-start' },
  addressTypeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  addressType: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  selectedBadge: { marginLeft: 8, backgroundColor: Colors.success, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  selectedBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  addAddressFooter: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  addAddressButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, borderRadius: 12 },
  addAddressButtonText: { color: Colors.accentGreen, fontSize: 16, fontWeight: '700', marginLeft: 8 },
  loadingContainer: { padding: 20, alignItems: 'center' },
});

// ================================================================
// 2. SUB-COMPONENTS
//    UPDATED: PropertyCard now shows full address with location icon
// ================================================================
const ViewPropertyCTA = ({ onPress }: { onPress: () => void }) => {
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    arrowTranslateX.value = withRepeat(
      withSequence(withTiming(8, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1,
      true
    );
  }, []);

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.ctaButton}>
      <Text style={styles.ctaText}>VIEW PROPERTY</Text>
      <ReAnimated.View style={animatedArrowStyle}>
        <Ionicons name="arrow-forward" size={18} color={Colors.white} />
      </ReAnimated.View>
    </TouchableOpacity>
  );
};

const RealisticChip = () => (
  <LinearGradient colors={['#D4AF37', '#F9E2AF', '#C5A028', '#D4AF37']} style={styles.chipContainer}>
    <View style={[styles.chipLine, { top: '25%', width: '100%' }]} />
    <View style={[styles.chipLine, { top: '50%', width: '100%' }]} />
    <View style={[styles.chipLine, { top: '75%', width: '100%' }]} />
    <View style={[styles.chipLineVertical, { left: '33%', height: '100%' }]} />
    <View style={[styles.chipLineVertical, { left: '66%', height: '100%' }]} />
  </LinearGradient>
);

const PropertyCard = ({ item, vendors }: { item: any; vendors: any[] }) => {
  const navigation = useNavigation<any>();
  const [flipped, setFlipped] = useState(false);
  const rotateY = useSharedValue(0);

  const fullVendor = item.vendor?.vendorId
    ? vendors.find((v) => v._id === item.vendor.vendorId)
    : null;
  const vendorName = fullVendor?.name || item.vendor?.name || 'Agent';
  const vendorShopName = fullVendor?.shopName || item.vendor?.shopName || 'Real Estate';
  const vendorPhone = fullVendor?.phone || item.vendor?.phone || '';

  const flipCard = () => {
    const nextValue = !flipped;
    setFlipped(nextValue);
    rotateY.value = withSpring(nextValue ? 180 : 0, { damping: 12, stiffness: 90 });
  };

  const navigateToDetails = () => {
    navigation.navigate('PropertyDetailScreen', { propertyId: item._id });
  };

  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      if (Math.abs(translationX) > 50 || Math.abs(velocityX) > 500) {
        runOnJS(flipCard)();
      }
    });

  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotateY.value}deg` }],
    zIndex: rotateY.value > 90 ? 0 : 1,
    opacity: rotateY.value > 90 ? 0 : 1,
  }));

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${rotateY.value + 180}deg` }],
    zIndex: rotateY.value > 90 ? 1 : 0,
    opacity: rotateY.value > 90 ? 1 : 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  const displayPrice =
    item.minPriceCr === item.maxPriceCr
      ? `₹${item.minPriceCr} Cr`
      : `₹${item.minPriceCr} - ${item.maxPriceCr} Cr`;

  const coverImage = item.images?.[0] || FALLBACK_IMAGE;

  // Build full address string from all available fields
  const fullAddress = [
    item.location?.address,
    item.location?.locality,
    item.location?.city,
    item.location?.state,
    item.location?.pincode || item.location?.zipCode
  ].filter(Boolean).join(', ') || 'Location not specified';

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.cardWrapper}>
        <ReAnimated.View style={[styles.cardBase, frontAnimatedStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={navigateToDetails} style={styles.cardTouchable}>
            <Image 
              source={{ uri: coverImage }} 
              style={styles.cardBgImage} 
              resizeMode="cover"
              onError={() => console.log('Image failed to load:', coverImage)}
            />
            <LinearGradient 
              colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} 
              style={styles.cardGradient} 
            />
            
            <View style={styles.frontHeader}>
              <View style={styles.chipBrandGroup}>
                <RealisticChip />
                <Text style={styles.brandText}>BLACK EDITION</Text>
              </View>
              <View style={styles.glassBadge}>
                <Text style={styles.badgeText}>{item.propertyType?.toUpperCase() || 'PROPERTY'}</Text>
              </View>
            </View>
            
            <View style={styles.frontBody}>
              <Text style={styles.miniLabel}>ESTATE VALUATION</Text>
              <Text style={styles.priceValue}>{displayPrice}</Text>
            </View>
            
            <View style={styles.frontFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.miniLabel}>PROPERTY TITLE</Text>
                <Text style={styles.boldTitle} numberOfLines={1}>
                  {item.title?.toUpperCase() || 'UNTITLED'}
                </Text>
                {/* Full address with location icon */}
                <View style={styles.addressRow}>
                  <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {fullAddress}
                  </Text>
                </View>
              </View>
              <View style={styles.specColumn}>
                <Text style={styles.specText}>{item.configuration?.bhk || 'N/A'}</Text>
                <Text style={styles.specTextSub}>
                  {item.areaOptions?.[0]?.superBuiltUpSqFt || item.area || 'N/A'} SQFT
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </ReAnimated.View>

        <ReAnimated.View style={[styles.cardBase, styles.cardBack, backAnimatedStyle]}>
          <View style={styles.vCardContainer}>
            <View style={styles.vCardHeader}>
              <View style={styles.vCardLogoArea}>
                <MaterialCommunityIcons name="rhombus-split" size={22} color={Colors.accentGreen} />
                <Text style={[styles.vCardBrandName, { color: Colors.textPrimary }]}>BLUXURY</Text>
              </View>
              <TouchableOpacity onPress={flipCard} style={styles.flipIcon}>
                <Ionicons name="refresh-circle" size={24} color={Colors.accentGreen} />
              </TouchableOpacity>
            </View>
            <View style={styles.vCardMainInfo}>
              <Text style={[styles.vendorName, { color: Colors.textPrimary }]} numberOfLines={1}>
                {vendorName.toUpperCase()}
              </Text>
              <Text style={[styles.vendorTitle, { color: Colors.textSecondary }]} numberOfLines={1}>
                {vendorShopName.toUpperCase()}
              </Text>
              <View style={styles.goldDivider} />
            </View>
            <View style={styles.contactGrid}>
              {vendorPhone ? (
                <>
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`tel:${vendorPhone}`)}
                  >
                    <Ionicons name="call" size={14} color={Colors.accentGreen} />
                    <Text style={[styles.contactText, { color: Colors.textSecondary }]}>+91 {vendorPhone}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`whatsapp://send?phone=${vendorPhone}`)}
                  >
                    <FontAwesome name="whatsapp" size={14} color={Colors.accentGreen} />
                    <Text style={[styles.contactText, { color: Colors.textSecondary }]}>WHATSAPP BUSINESS</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <View style={styles.contactItem}>
                <Ionicons name="location-sharp" size={14} color={Colors.accentGreen} />
                <Text style={[styles.contactText, { color: Colors.textSecondary }]} numberOfLines={1}>
                  {item.location?.locality?.toUpperCase() || item.locality || 'LOCALE'},{' '}
                  {item.location?.city?.toUpperCase() || item.city || 'CITY'}
                </Text>
              </View>
            </View>
            <View style={styles.vCardFooter}>
              <ViewPropertyCTA onPress={navigateToDetails} />
            </View>
          </View>
        </ReAnimated.View>
      </View>
    </GestureDetector>
  );
};

// ================================================================
// 3. MAIN SCREEN (unchanged)
// ================================================================
const UserPropertyListScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const properties = useSelector(selectAllProperties);
  const loading = useSelector(selectPropertyLoading);
  const { currentPage, hasMore } = useSelector(selectPropertyPagination);

  const vendors = useSelector((state: RootState) => state.vendorAuth.allVendors) ?? [];
  const vendorsLoading = useSelector((state: RootState) => state.vendorAuth.loading) ?? false;

  const addresses = useSelector(selectAllAddresses);
  const selectedAddress = useSelector((state: RootState) => state.location.selectedAddress);
  const locationLoading = useSelector((state: RootState) => state.location.loading);
  const token = useSelector((state: RootState) => state.auth.user?.token);

  const [searchText, setSearchText] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddressScreen, setShowAddAddressScreen] = useState(false);

  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);

  const savedState = useRef({
    scrollOffset: 0,
    isHeaderHidden: false,
    headerTranslateYValue: 0,
  });
  const isNavigatingAway = useRef(false);

  const flatListRef = useRef<FlatList>(null);

  const prevSelectedAddressRef = useRef<any>(null);
  const initialFilterApplied = useRef(false);

  // Load addresses when token available
  useEffect(() => {
    if (token) {
      console.log('🔑 [PropertyList] Token available, fetching addresses');
      dispatch(fetchUserAddresses(token));
    }
  }, [dispatch, token]);

  // Sync local filters when selectedAddress changes
  useEffect(() => {
    if (selectedAddress) {
      console.log('📍 [PropertyList] selectedAddress updated:', {
        city: selectedAddress.city,
        locality: selectedAddress.locality,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
      });
      setCity(selectedAddress.city || '');
      setLocality(selectedAddress.locality || '');
      setState(selectedAddress.state || '');
      setPincode(selectedAddress.pincode || '');
    }
  }, [selectedAddress]);

  // Initialize local state from selectedAddress on first mount
  useEffect(() => {
    if (selectedAddress) {
      setCity(selectedAddress.city || '');
      setLocality(selectedAddress.locality || '');
      setState(selectedAddress.state || '');
      setPincode(selectedAddress.pincode || '');
    }
  }, []);

  // WATCH: selectedAddress changes → apply filters
  useEffect(() => {
    if (!selectedAddress) return;

    if (!initialFilterApplied.current) {
      initialFilterApplied.current = true;
      prevSelectedAddressRef.current = selectedAddress;
      return;
    }

    const prev = prevSelectedAddressRef.current;
    if (prev) {
      const hasChanged =
        prev.city !== selectedAddress.city ||
        prev.locality !== selectedAddress.locality ||
        prev.state !== selectedAddress.state ||
        prev.pincode !== selectedAddress.pincode;

      if (hasChanged) {
        console.log('🔄 [PropertyList] Address changed – re-fetching');
        applyFilters();
      }
    }
    prevSelectedAddressRef.current = selectedAddress;
  }, [selectedAddress]);

  // Build filter params
  const getFilterParams = useCallback((overrides: any = {}) => {
    const finalCity = overrides.city !== undefined ? overrides.city : (selectedAddress?.city ?? city);
    const finalLocality = overrides.locality !== undefined ? overrides.locality : (selectedAddress?.locality ?? locality);
    const finalState = overrides.state !== undefined ? overrides.state : (selectedAddress?.state ?? state);
    const finalPincode = overrides.pincode !== undefined ? overrides.pincode : (selectedAddress?.pincode ?? pincode);

    const params = {
      page: 1,
      limit: 10,
      q: searchText || undefined,
      propertyType: selectedType || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      city: finalCity || undefined,
      state: finalState || undefined,
      locality: finalLocality || undefined,
      pincode: finalPincode || undefined,
      vendorId: selectedVendorId || undefined,
      ...overrides,
    };

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    console.log('📦 [PropertyList] Final params:', params);
    return params;
  }, [searchText, selectedType, minPrice, maxPrice, city, state, locality, pincode, selectedVendorId, selectedAddress]);

  // Apply filters
  const applyFilters = useCallback((overrides?: any) => {
    const params = getFilterParams(overrides);
    console.log('🚀 [PropertyList] Dispatching fetchProperties');
    dispatch(fetchProperties(params));
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setFiltersVisible(false);
  }, [dispatch, getFilterParams]);

  // Clear all filters
  const clearAllFilters = () => {
    console.log('🧹 [PropertyList] Clearing all filters');
    setSearchText('');
    setSelectedType('');
    setMinPrice('');
    setMaxPrice('');
    setCity('');
    setState('');
    setLocality('');
    setPincode('');
    setSelectedVendorId('');
    applyFilters({
      q: '',
      propertyType: '',
      minPrice: undefined,
      maxPrice: undefined,
      city: '',
      state: '',
      locality: '',
      pincode: '',
      vendorId: '',
    });
    setFiltersVisible(false);
  };

  // Location Handlers
  const handleSelectAddress = useCallback((address: any) => {
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
  }, [dispatch]);

  const handleAddCurrentLocation = useCallback(async () => {
    if (!token) {
      Toast.show({ type: 'error', text1: 'Authentication Required', text2: 'Please login to save address' });
      return;
    }
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
        const { city: detectedCity, region, district, postalCode, street, name, subregion } = geocode[0];
        const finalCity = detectedCity || district || region || '';
        const finalLocality = street || name || subregion || district || '';
        const finalState = region || '';
        const finalPincode = postalCode || '';

        const addressString = [finalLocality, finalCity, finalState, finalPincode].filter(Boolean).join(", ");

        const addressData = {
          type: "Current Location" as "Home" | "Work" | "Other" | "Current Location",
          addressString: addressString || "Current Location",
          landmark: "",
          city: finalCity,
          pincode: finalPincode,
          latitude: latitude,
          longitude: longitude,
          isDefault: addresses.length === 0,
        };

        dispatch(saveUserAddress({ token, addressData }))
          .unwrap()
          .then((savedAddress: any) => {
            dispatch(setSelectedAddress(savedAddress));
            setCity(finalCity);
            setLocality(finalLocality);
            setState(finalState);
            setPincode(finalPincode);
            setShowAddressModal(false);
            Toast.show({
              type: 'success',
              text1: 'Location Detected',
              text2: `📍 ${finalLocality || finalCity}`,
            });
          })
          .catch((error: any) => {
            console.error('❌ Failed to save location:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
          });
      }
    } catch (error) {
      console.error('❌ Location error:', error);
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not detect location.' });
    } finally {
      setIsLocating(false);
    }
  }, [dispatch, token, addresses.length]);

  // Open AddAddressScreen (WebView map picker)
  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddressScreen(true);
  }, []);

  // Callback from AddAddressScreen when location is selected
  const handleMapLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    const city = addressDetails.city || '';
    const locality = addressDetails.locality || addressDetails.colony || addressDetails.suburb || addressDetails.street || '';
    const state = addressDetails.state || '';
    const pincode = addressDetails.pincode || '';
    const fullAddress = addressDetails.fullAddress || addressDetails.addressString || '';

    const addressData = {
      type: "Home" as "Home" | "Work" | "Other" | "Current Location",
      addressString: fullAddress || "Selected location",
      landmark: "",
      city: city,
      pincode: pincode,
      latitude: lat,
      longitude: lng,
      isDefault: addresses.length === 0,
    };

    if (token) {
      dispatch(saveUserAddress({ token, addressData }))
        .unwrap()
        .then((savedAddress: any) => {
          dispatch(setSelectedAddress(savedAddress));
          setCity(city);
          setLocality(locality || city);
          setState(state);
          setPincode(pincode);
          Toast.show({ type: 'success', text1: 'Location Saved', text2: `📍 ${fullAddress}` });
        })
        .catch((error: any) => {
          console.error('❌ Failed to save map location:', error);
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
        });
    } else {
      setCity(city);
      setLocality(locality);
      setState(state);
      setPincode(pincode);
      applyFilters();
    }
    setShowAddAddressScreen(false);
  }, [dispatch, token, addresses.length, applyFilters]);

  // Lifecycle
  useEffect(() => {
    console.log('🔄 [PropertyList] Component mounted – initial fetch');
    if (selectedAddress) {
      initialFilterApplied.current = true;
      prevSelectedAddressRef.current = selectedAddress;
    }
    applyFilters();
    dispatch(fetchAllVendorsAuth());
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 [PropertyList] Screen FOCUSED');

      isNavigatingAway.current = false;

      if (savedState.current.scrollOffset > 10) {
        if (savedState.current.isHeaderHidden) {
          isHeaderHidden.current = true;
          headerTranslateY.setValue(-HEADER_HEIGHT);
        } else {
          isHeaderHidden.current = false;
          headerTranslateY.setValue(0);
        }
        const restoreScroll = (attempt = 0) => {
          if (flatListRef.current) {
            flatListRef.current.scrollToOffset({
              offset: savedState.current.scrollOffset,
              animated: false,
            });
          }
          if (attempt < 3) {
            setTimeout(() => restoreScroll(attempt + 1), 100 * (attempt + 1));
          }
        };
        restoreScroll(0);
      }

      if (token) {
        dispatch(fetchUserAddresses(token));
      }
      applyFilters();
      dispatch(fetchAllVendorsAuth());

      return () => {
        savedState.current.scrollOffset = lastScrollY.current;
        savedState.current.isHeaderHidden = isHeaderHidden.current;
        isNavigatingAway.current = true;
      };
    }, [dispatch, token, applyFilters])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      savedState.current.scrollOffset = lastScrollY.current;
      savedState.current.isHeaderHidden = isHeaderHidden.current;
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (token) {
        await dispatch(fetchUserAddresses(token)).unwrap();
      }
      await applyFilters();
      await dispatch(fetchAllVendorsAuth());
    } catch (error) {
      console.error('❌ Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [applyFilters, dispatch, token]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing) {
      const nextPage = currentPage + 1;
      const params = getFilterParams();
      dispatch(fetchProperties({ ...params, page: nextPage }));
    }
  };

  const renderFooter = () => {
    if (!loading || properties.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.accentGreen} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const getLocationSummary = useCallback(() => {
    if (selectedAddress?.addressString) return selectedAddress.addressString;
    const parts = [];
    if (locality) parts.push(locality);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (pincode) parts.push(pincode);
    return parts.length ? parts.join(', ') : 'Select a location';
  }, [selectedAddress, locality, city, state, pincode]);

  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    savedState.current.scrollOffset = currentScrollY;
    savedState.current.isHeaderHidden = isHeaderHidden.current;

    if (currentScrollY > 20) {
      if (diff > 5 && !isHeaderHidden.current) {
        isHeaderHidden.current = true;
        savedState.current.isHeaderHidden = true;
        Animated.spring(headerTranslateY, {
          toValue: -HEADER_HEIGHT,
          useNativeDriver: true,
          damping: 20,
          mass: 0.5,
          stiffness: 150,
        }).start();
      } else if (diff < -5 && isHeaderHidden.current) {
        isHeaderHidden.current = false;
        savedState.current.isHeaderHidden = false;
        Animated.spring(headerTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          mass: 0.5,
          stiffness: 150,
        }).start();
      }
    } else {
      if (isHeaderHidden.current) {
        isHeaderHidden.current = false;
        savedState.current.isHeaderHidden = false;
        Animated.spring(headerTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          mass: 0.5,
          stiffness: 150,
        }).start();
      }
    }

    lastScrollY.current = currentScrollY;
  };

  if (locationLoading && addresses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accentGreen} />
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      <Animated.View
        style={[
          styles.headerContainer,
          {
            transform: [{ translateY: headerTranslateY }],
          }
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>PRIVATE COLLECTION</Text>
            <Text style={styles.headerTitle}>BLUXURY LISTINGS</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="location-outline" size={22} color={Colors.accentGreen} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.locationBar}
          onPress={() => setShowAddressModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={18} color={Colors.accentGreen} />
          <Text style={styles.locationBarText} numberOfLines={1}>
            {getLocationSummary()}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search properties by title or highlights..."
            placeholderTextColor={Colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => applyFilters({ q: searchText })}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => setFiltersVisible(true)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          <TouchableOpacity
            style={[styles.categoryPill, !selectedType && styles.categoryPillActive]}
            onPress={() => {
              setSelectedType('');
              applyFilters({ propertyType: '' });
            }}
          >
            <Text style={[styles.categoryText, !selectedType && styles.categoryTextActive]}>All</Text>
          </TouchableOpacity>
          {PROPERTY_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.categoryPill, selectedType === type && styles.categoryPillActive]}
              onPress={() => {
                setSelectedType(type);
                applyFilters({ propertyType: type });
              }}
            >
              <Text style={[styles.categoryText, selectedType === type && styles.categoryTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      <View style={[styles.resultsRow, { paddingTop: HEADER_HEIGHT + 4 }]}>
        <Text style={styles.resultsText}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
        </Text>
        <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
          <Text style={styles.clearFiltersText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={properties}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.listContent]}
        renderItem={({ item }) => <PropertyCard item={item} vendors={vendors} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentGreen} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="home-outline" size={48} color={Colors.accentGreen} />
              </View>
              <Text style={styles.emptyTitle}>No Properties Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your filters or search terms
              </Text>
            </View>
          ) : null
        }
      />

      {/* Address Modal */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleSelectAddress}
        onAddAddress={handleAddCurrentLocation}
        selectedAddress={selectedAddress}
        addresses={addresses}
        isLoading={isLocating || locationLoading}
        onOpenMap={handleOpenMapPicker}
      />

      {/* AddAddressScreen as a full-screen modal */}
      <Modal visible={showAddAddressScreen} animationType="slide" onRequestClose={() => setShowAddAddressScreen(false)}>
        <AddAddressScreen
          onClose={() => setShowAddAddressScreen(false)}
          onLocationSelect={handleMapLocationSelect}
        />
      </Modal>

      {/* Filter Modal */}
      <Modal visible={filtersVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFiltersVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFiltersVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.filterLabel}>Search by Name</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Search properties..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.filterLabel}>Vendor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vendorScroll}>
                <TouchableOpacity
                  style={[styles.vendorOption, !selectedVendorId && styles.vendorOptionActive]}
                  onPress={() => {
                    setSelectedVendorId('');
                    applyFilters({ vendorId: '' });
                  }}
                >
                  <Text style={[styles.vendorOptionText, !selectedVendorId && styles.vendorOptionTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {vendorsLoading ? (
                  <ActivityIndicator size="small" color={Colors.accentGreen} style={{ marginLeft: 10 }} />
                ) : (
                  vendors.map((vendor) => (
                    <TouchableOpacity
                      key={vendor._id}
                      style={[styles.vendorOption, selectedVendorId === vendor._id && styles.vendorOptionActive]}
                      onPress={() => {
                        setSelectedVendorId(vendor._id);
                        applyFilters({ vendorId: vendor._id });
                      }}
                    >
                      <Text
                        style={[
                          styles.vendorOptionText,
                          selectedVendorId === vendor._id && styles.vendorOptionTextActive,
                        ]}
                      >
                        {vendor.shopName || vendor.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <Text style={styles.filterLabel}>Price Range (Cr)</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={minPrice}
                    onChangeText={setMinPrice}
                  />
                </View>
                <Text style={styles.rangeDash}>–</Text>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>

              <Text style={styles.filterLabel}>Location (Manual Override)</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="City"
                placeholderTextColor={Colors.textTertiary}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="State"
                placeholderTextColor={Colors.textTertiary}
                value={state}
                onChangeText={setState}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Locality"
                placeholderTextColor={Colors.textTertiary}
                value={locality}
                onChangeText={setLocality}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Pincode"
                placeholderTextColor={Colors.textTertiary}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.clearFiltersModalBtn} onPress={clearAllFilters}>
                  <Text style={styles.clearFiltersModalText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyButton} onPress={() => {
                  setFiltersVisible(false);
                  applyFilters();
                }}>
                  <LinearGradient
                    colors={[Colors.accentGreen, Colors.accentGreenDark]}
                    style={styles.applyGradient}
                  >
                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ================================================================
// 4. STYLES
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  loadingText: { marginTop: 12, fontSize: 14, color: Colors.textTertiary },

  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    shadowColor: Colors.royalNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerSubtitle: {
    fontSize: isSmallPhone ? 10 : 12,
    color: Colors.accentGreen,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: isSmallPhone ? 18 : 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
    letterSpacing: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentGreen,
    borderWidth: 2,
    borderColor: Colors.white,
  },

  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.offWhite,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationBarText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: Colors.textPrimary },
  filterBtn: {
    backgroundColor: Colors.accentGreen,
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },

  categoryScroll: { marginTop: 4, maxHeight: 45, marginBottom: 4 },
  categoryContent: { paddingHorizontal: 16, paddingBottom: 4 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.offWhite,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 34,
    justifyContent: 'center',
  },
  categoryPillActive: { backgroundColor: Colors.accentGreen, borderColor: Colors.accentGreen },
  categoryText: { color: Colors.textTertiary, fontWeight: '600', fontSize: 12 },
  categoryTextActive: { color: Colors.white, fontWeight: 'bold' },

  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  resultsText: { fontSize: isSmallPhone ? 12 : 13, color: Colors.textTertiary, fontWeight: '500' },
  clearFiltersBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  clearFiltersText: { fontSize: isSmallPhone ? 11 : 12, color: Colors.accentGreen, fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 100 },
  cardWrapper: { width: '100%', aspectRatio: 1.586, marginBottom: 20 },
  cardTouchable: {
    flex: 1,
    position: 'relative',
  },
  cardBase: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backfaceVisibility: 'hidden',
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBack: {
    backgroundColor: Colors.white,
    borderColor: Colors.accentGreen,
    borderWidth: 1,
  },
  cardBgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chipContainer: { width: 40, height: 28, borderRadius: 5, overflow: 'hidden' },
  chipLine: { position: 'absolute', height: 0.5, backgroundColor: 'rgba(0,0,0,0.2)' },
  chipLineVertical: { position: 'absolute', width: 0.5, backgroundColor: 'rgba(0,0,0,0.2)' },
  chipBrandGroup: { flexDirection: 'row', alignItems: 'center' },
  frontHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    alignItems: 'center',
    zIndex: 2,
  },
  brandText: { color: Colors.white, fontSize: 9, letterSpacing: 2, fontWeight: 'bold', marginLeft: 10 },
  glassBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  frontBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    paddingHorizontal: 22,
    zIndex: 2,
  },
  miniLabel: { color: Colors.luxuryGold, fontSize: 8, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
  priceValue: { color: '#fff', fontSize: 24, fontWeight: '300', letterSpacing: 1 },
  frontFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    zIndex: 2,
  },
  footerLeft: {
    flex: 1,
  },
  boldTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
    lineHeight: 13,
    flex: 1,
  },
  specColumn: { alignItems: 'flex-end' },
  specText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  specTextSub: { color: Colors.luxuryGold, fontSize: 8, fontWeight: 'bold' },

  vCardContainer: { padding: 16, flex: 1, justifyContent: 'space-between', backgroundColor: Colors.white },
  vCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vCardLogoArea: { flexDirection: 'row', alignItems: 'center' },
  vCardBrandName: { color: Colors.textPrimary, fontSize: 11, fontWeight: 'bold', letterSpacing: 3, marginLeft: 6 },
  flipIcon: { padding: 4 },
  vCardMainInfo: { marginTop: 4 },
  vendorName: { color: Colors.textPrimary, fontSize: 16, fontWeight: 'bold' },
  vendorTitle: { color: Colors.textTertiary, fontSize: 9, fontWeight: '600', marginTop: 2, letterSpacing: 1 },
  goldDivider: { width: 30, height: 2, backgroundColor: Colors.accentGreen, marginTop: 6 },
  contactGrid: { marginVertical: 4 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  contactText: { color: Colors.textSecondary, fontSize: 9.5, marginLeft: 10, fontWeight: '500' },
  vCardFooter: { width: '100%' },
  ctaButton: { backgroundColor: Colors.accentGreen, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 0 },
  ctaText: { color: Colors.white, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginRight: 10 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.15, paddingHorizontal: 40 },
  emptyIconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accentGreenLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: isSmallPhone ? 18 : 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: isSmallPhone ? 13 : 14, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: Colors.accentGreen },
  emptyBtnText: { color: Colors.accentGreen, fontWeight: '600', fontSize: isSmallPhone ? 13 : 14 },

  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText: { fontSize: 12, color: Colors.textTertiary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalCloseBtn: { padding: 4 },

  filterLabel: { fontSize: isSmallPhone ? 13 : 14, fontWeight: '600', color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  filterInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    borderRadius: 12,
    padding: isSmallPhone ? 12 : 14,
    marginBottom: 8,
    fontSize: isSmallPhone ? 14 : 16,
    color: Colors.textPrimary,
  },
  modalScroll: { marginBottom: 10 },

  vendorScroll: { flexDirection: 'row', marginTop: 4, marginBottom: 6 },
  vendorOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 6,
  },
  vendorOptionActive: { backgroundColor: Colors.accentGreen, borderColor: Colors.accentGreen },
  vendorOptionText: { color: Colors.textTertiary, fontSize: 12, fontWeight: '500' },
  vendorOptionTextActive: { color: Colors.white, fontWeight: 'bold' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  rangeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.offWhite,
    paddingHorizontal: 12,
  },
  rangePrefix: { fontSize: isSmallPhone ? 14 : 16, color: Colors.textTertiary, fontWeight: '600', marginRight: 4 },
  rangeInput: { flex: 1, paddingVertical: isSmallPhone ? 12 : 14, fontSize: isSmallPhone ? 14 : 16, color: Colors.textPrimary },
  rangeDash: { fontSize: 18, color: Colors.textTertiary, fontWeight: '300' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  clearFiltersModalBtn: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearFiltersModalText: { color: Colors.textTertiary, fontWeight: '600', fontSize: 15 },
  applyButton: { flex: 0.6, borderRadius: 16, overflow: 'hidden' },
  applyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  applyButtonText: { color: Colors.white, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
});

export default UserPropertyListScreen;