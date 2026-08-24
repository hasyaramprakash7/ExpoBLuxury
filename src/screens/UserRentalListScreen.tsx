// screens/UserRentalListScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  StatusBar,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { fetchRentals, selectAllRentals, selectRentalLoading, selectRentalPagination } from '../features/rentalSlice';
import { RootState } from '../app/store';
import Toast from 'react-native-toast-message';
import { Colors as AppColors, scale, verticalScale, moderateScale } from '../constants/colors';
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  selectAllAddresses,
} from '../features/locationSlice';
import AddAddressScreen from '../screens/AddAddressScreen';

const { width, height } = Dimensions.get('window');

const isTablet = width >= 768;
const isSmallPhone = width < 375;
const CARD_WIDTH = isTablet ? (width - 48) / 3 : (width - 48) / 2;
const CARD_HEIGHT = isTablet ? 220 : 200;
const HEADER_HEIGHT = 250;

const Colors = {
  royalNavy: '#0B1021',
  champagneGold: '#D4AF37',
  offWhite: '#F8F9FA',
  pureWhite: '#FFFFFF',
  charcoal: '#2D3748',
  slate: '#64748B',
  lightBorder: '#EAEAEA',
  success: '#10B981',
  error: '#EF4444',
  gradientStart: '#0B1021',
  gradientEnd: '#1A1F3A',
  accentGreen: '#1B8C40',
  textDark: '#1C1C1E',
  textGray: '#6B7280',
  textLightGray: '#9CA3AF',
};

const RENTAL_TYPES = ['PG', 'Hotel', 'Apartment', 'Villa', 'Hostel', 'Guest House'];

// Create Animated FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// Address Modal Component (Without Delete Option)
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
              <Ionicons name="close" size={24} color={Colors.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView style={addressModalStyles.addressList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={addressModalStyles.currentLocationContainer}
              onPress={onAddAddress}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={22} color={Colors.royalNavy} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Use my current location
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddress
                    ? selectedAddress.addressString
                    : "Fetch GPS & find nearby rentals"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[addressModalStyles.currentLocationContainer, { borderTopWidth: 0 }]}
              onPress={onOpenMap}
            >
              <View style={[addressModalStyles.currentLocationIcon, { backgroundColor: 'rgba(27, 140, 64, 0.1)' }]}>
                <Ionicons name="map" size={22} color={Colors.accentGreen} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={[addressModalStyles.currentLocationTitle, { color: Colors.accentGreen }]}>
                  Pick from Map
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  Search and select location on map
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textGray} />
            </TouchableOpacity>

            <View style={addressModalStyles.sectionDivider} />

            {addresses.length > 0 && (
              <>
                <Text style={addressModalStyles.savedAddressesHeader}>
                  SAVED ADDRESSES
                </Text>
                {addresses.map((addr) => {
                  const isSelected = selectedAddress?.id === addr.id;
                  let iconName = "location";
                  if (addr.type === "Home") iconName = "home";
                  if (addr.type === "Work") iconName = "briefcase";
                  if (addr.type === "Current Location") iconName = "locate";

                  return (
                    <TouchableOpacity
                      key={addr.id}
                      style={[
                        addressModalStyles.addressItem,
                        isSelected && addressModalStyles.addressItemSelected,
                      ]}
                      onPress={() => onSelectAddress(addr)}
                    >
                      <View style={addressModalStyles.iconContainer}>
                        <Ionicons
                          name={iconName as any}
                          size={22}
                          color={isSelected ? Colors.royalNavy : Colors.textDark}
                        />
                      </View>
                      <View style={addressModalStyles.addressInfo}>
                        <View style={addressModalStyles.addressTypeRow}>
                          <Text
                            style={[
                              addressModalStyles.addressType,
                              isSelected && { color: Colors.royalNavy },
                            ]}
                          >
                            {addr.type}
                          </Text>
                          {isSelected && (
                            <View style={addressModalStyles.selectedBadge}>
                              <Text style={addressModalStyles.selectedBadgeText}>
                                Selected
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={addressModalStyles.addressString} numberOfLines={2}>
                          {addr.addressString}
                        </Text>
                        {addr.landmark && (
                          <Text style={addressModalStyles.landmarkText}>
                            📍 {addr.landmark}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color={Colors.success}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.royalNavy} />
              </View>
            )}
          </ScrollView>

          <View style={addressModalStyles.addAddressFooter}>
            <TouchableOpacity
              style={addressModalStyles.addAddressButton}
              onPress={onAddAddress}
            >
              <Ionicons name="add" size={20} color={Colors.royalNavy} />
              <Text style={addressModalStyles.addAddressButtonText}>
                Add new address
              </Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: Colors.offWhite,
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
    borderBottomColor: Colors.lightBorder,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textDark,
    letterSpacing: -0.3,
  },
  addressList: {
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.pureWhite,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.lightBorder,
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
    color: Colors.royalNavy,
    marginBottom: 2,
  },
  addressInfo: {
    flex: 1,
    paddingRight: 10,
  },
  addressString: {
    fontSize: 13,
    color: Colors.textGray,
    lineHeight: 18,
  },
  landmarkText: {
    fontSize: 12,
    color: Colors.textLightGray,
    marginTop: 2,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F0F0F0',
    width: '100%',
  },
  savedAddressesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.pureWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightBorder,
  },
  addressItemSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
  },
  iconContainer: {
    width: 30,
    alignItems: 'flex-start',
  },
  addressTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressType: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textDark,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Colors.pureWhite,
    fontSize: 11,
    fontWeight: '700',
  },
  addAddressFooter: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: Colors.pureWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.lightBorder,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pureWhite,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Colors.royalNavy,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

// Rental Card Component
const RentalCard = ({ item }: { item: any }) => {
  const navigation = useNavigation<any>();
  const coverImage = item.images?.[0] || 'https://via.placeholder.com/600x400';
  const isAvailable = item.isAvailable !== false;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_WIDTH }]}
      onPress={() => navigation.navigate('RentalDetail', { rentalId: item._id })}
      activeOpacity={0.9}
    >
      <View style={[styles.cardImageWrapper, { height: CARD_HEIGHT }]}>
        <Image source={{ uri: coverImage }} style={styles.cardImage} />
        <LinearGradient
          colors={['transparent', 'rgba(11, 16, 33, 0.8)']}
          style={styles.imageGradient}
        />
        
        <View style={[styles.statusBadge, isAvailable ? styles.availableBadge : styles.bookedBadge]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {isAvailable ? 'Available' : 'Booked'}
          </Text>
        </View>

        <View style={styles.typeBadge}>
          <Ionicons name="home-outline" size={isSmallPhone ? 10 : 12} color={Colors.pureWhite} />
          <Text style={styles.typeText}>{item.rentalType}</Text>
        </View>

        <View style={styles.priceOverlay}>
          <Text style={styles.priceOverlayText}>₹{item.monthlyRent?.toLocaleString() || 'N/A'}</Text>
          <Text style={styles.priceOverlaySub}>/month</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        
        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={isSmallPhone ? 12 : 14} color={Colors.champagneGold} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.location?.locality || item.city}, {item.location?.city || item.state}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.specsContainer}>
            {item.bedrooms && (
              <View style={styles.specItem}>
                <Ionicons name="bed-outline" size={isSmallPhone ? 12 : 14} color={Colors.slate} />
                <Text style={styles.specText}>{item.bedrooms}</Text>
              </View>
            )}
            {item.bathrooms && (
              <View style={styles.specItem}>
                <Ionicons name="water-outline" size={isSmallPhone ? 12 : 14} color={Colors.slate} />
                <Text style={styles.specText}>{item.bathrooms}</Text>
              </View>
            )}
            {item.maxGuests && (
              <View style={styles.specItem}>
                <Ionicons name="people-outline" size={isSmallPhone ? 12 : 14} color={Colors.slate} />
                <Text style={styles.specText}>{item.maxGuests}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main Component
const UserRentalListScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const rentals = useSelector(selectAllRentals);
  const loading = useSelector(selectRentalLoading);
  const { currentPage, hasMore } = useSelector(selectRentalPagination);
  
  const addresses = useSelector(selectAllAddresses);
  const selectedAddress = useSelector((state: RootState) => state.location.selectedAddress);
  const userLocation = useSelector((state: RootState) => state.location.location);
  const locationLoading = useSelector((state: RootState) => state.location.loading);
  const token = useSelector((state: RootState) => state.auth.user?.token);

  const [searchText, setSearchText] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [minRent, setMinRent] = useState<string>('');
  const [maxRent, setMaxRent] = useState<string>('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  
  // ✅ Animated header
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);
  
  // Store complete state for restoration
  const savedState = useRef({
    scrollOffset: 0,
    isHeaderHidden: false,
    headerTranslateYValue: 0,
  });
  const isNavigatingAway = useRef(false);

  const flatListRef = useRef<FlatList>(null);

  // Load addresses when token is available
  useEffect(() => {
    if (token) {
      dispatch(fetchUserAddresses(token));
    }
  }, [dispatch, token]);

  // Update filter fields when selectedAddress changes
  useEffect(() => {
    if (selectedAddress) {
      setCity(selectedAddress.city || '');
      setLocality(selectedAddress.locality || '');
      setState(selectedAddress.state || '');
      setPincode(selectedAddress.pincode || '');
    }
  }, [selectedAddress]);

  // ✅ PRESERVE scroll position when returning to screen
  useFocusEffect(
    useCallback(() => {
      console.log('📱 [RentalList] Screen FOCUSED');
      console.log('📱 [RentalList] Current saved scroll position:', savedState.current.scrollOffset);

      isNavigatingAway.current = false;

      // ✅ RESTORE scroll position instead of resetting to top
      if (savedState.current.scrollOffset > 10) {
        console.log('📍 [RentalList] Restoring scroll to:', savedState.current.scrollOffset);
        
        // Restore header state
        if (savedState.current.isHeaderHidden) {
          isHeaderHidden.current = true;
          headerTranslateY.setValue(-HEADER_HEIGHT);
        } else {
          isHeaderHidden.current = false;
          headerTranslateY.setValue(0);
        }
        
        // Restore scroll position with multiple attempts
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
      } else {
        console.log('🔄 [RentalList] No saved position, staying at top');
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToOffset({
              offset: 0,
              animated: false,
            });
          }
        }, 100);
      }

      // Refresh data
      if (token) {
        dispatch(fetchUserAddresses(token));
      }
      applyFilters();

      return () => {
        // ✅ SAVE current scroll position when leaving
        console.log('💾 [RentalList] Saving scroll position:', lastScrollY.current);
        savedState.current.scrollOffset = lastScrollY.current;
        savedState.current.isHeaderHidden = isHeaderHidden.current;
        isNavigatingAway.current = true;
        console.log('📱 [RentalList] Screen UNFOCUSED - saved at:', savedState.current.scrollOffset);
      };
    }, [dispatch, token, applyFilters])
  );

  // Add beforeRemove listener for better scroll saving
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Save scroll position before screen is removed
      savedState.current.scrollOffset = lastScrollY.current;
      savedState.current.isHeaderHidden = isHeaderHidden.current;
      console.log('💾 [RentalList] Before remove, saving scroll:', savedState.current.scrollOffset);
    });

    return unsubscribe;
  }, [navigation]);

  // Helper to build filter object from current state
  const getFilterParams = useCallback((overrides: any = {}) => {
    return {
      page: 1,
      limit: 10,
      q: searchText || undefined,
      rentalType: selectedType || undefined,
      minRent: minRent ? Number(minRent) : undefined,
      maxRent: maxRent ? Number(maxRent) : undefined,
      city: city || undefined,
      state: state || undefined,
      locality: locality || undefined,
      pincode: pincode || undefined,
      isAvailable,
      ...overrides,
    };
  }, [searchText, selectedType, minRent, maxRent, city, state, locality, pincode, isAvailable]);

  // Apply filters
  const applyFilters = useCallback((overrides?: any) => {
    const params = getFilterParams(overrides);
    dispatch(fetchRentals(params));
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [dispatch, getFilterParams]);

  // Handle location selection from AddAddressScreen
  const handleLocationFromAddAddress = useCallback((lat: number, lng: number, addressDetails: any) => {
    console.log('📍 Location selected from AddAddressScreen:', { lat, lng, addressDetails });

    const city = addressDetails.city || addressDetails.district || '';
    const locality = addressDetails.colony || addressDetails.suburb || addressDetails.neighbourhood || addressDetails.street || addressDetails.district || '';
    const state = addressDetails.state || '';
    const pincode = addressDetails.pincode || '';
    const country = addressDetails.country || 'India';
    const street = addressDetails.street || '';
    const fullAddress = addressDetails.addressString || addressDetails.fullAddress || '';

    const addressParts = [
      street,
      addressDetails.colony,
      addressDetails.suburb,
      addressDetails.neighbourhood,
      locality,
      city,
      addressDetails.district,
      state,
      pincode,
      country,
    ].filter(Boolean);
    const displayAddress = addressParts.join(', ') || fullAddress;

    const addressData = {
      type: "Home" as "Home" | "Work" | "Other" | "Current Location",
      addressString: displayAddress || "Selected location",
      landmark: "",
      city: city || '',
      pincode: pincode || '',
      latitude: lat,
      longitude: lng,
      isDefault: addresses.length === 0,
      state: state || '',
      locality: locality || '',
    };

    if (token) {
      dispatch(saveUserAddress({ token, addressData }))
        .unwrap()
        .then((savedAddress: any) => {
          dispatch(setSelectedAddress(savedAddress));
          setCity(savedAddress.city || '');
          setLocality(savedAddress.locality || '');
          setState(state);
          setPincode(savedAddress.pincode || '');
          applyFilters({
            city: savedAddress.city || undefined,
            locality: savedAddress.locality || undefined,
            state: state || undefined,
            pincode: savedAddress.pincode || undefined,
          });
          Toast.show({
            type: 'success',
            text1: 'Location Saved',
            text2: `📍 ${displayAddress}`,
          });
        })
        .catch((error: any) => {
          console.error('Failed to save address:', error);
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
        });
    } else {
      setCity(city);
      setLocality(locality);
      setState(state);
      setPincode(pincode);
      applyFilters({ city, locality, state, pincode });
      Toast.show({ type: 'info', text1: 'Location Updated', text2: displayAddress });
    }
    setShowAddAddressModal(false);
  }, [dispatch, token, addresses.length, applyFilters]);

  // Handle address selection from saved addresses
  const handleSelectAddress = useCallback((address: any) => {
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
    applyFilters({
      city: address.city || undefined,
      locality: address.locality || undefined,
      state: address.state || undefined,
      pincode: address.pincode || undefined,
    });
  }, [dispatch, applyFilters]);

  // Handle add current location
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
        const { city, region, district, postalCode, street, name } = geocode[0];
        const detectedCity = city || district || region || '';
        const detectedLocality = street || name || district || '';
        const detectedState = region || '';
        const detectedPincode = postalCode || '';

        const addressString = [detectedLocality, detectedCity, detectedState, detectedPincode].filter(Boolean).join(", ");
        
        const addressData = {
          type: "Current Location" as "Home" | "Work" | "Other" | "Current Location",
          addressString: addressString || "Current Location",
          landmark: "",
          city: detectedCity,
          pincode: detectedPincode,
          latitude: latitude,
          longitude: longitude,
          isDefault: addresses.length === 0,
        };

        dispatch(saveUserAddress({ token, addressData }))
          .unwrap()
          .then((savedAddress: any) => {
            dispatch(setSelectedAddress(savedAddress));
            setCity(detectedCity);
            setLocality(detectedLocality);
            setState(detectedState);
            setPincode(detectedPincode);
            setShowAddressModal(false);
            Toast.show({ 
              type: 'success', 
              text1: 'Location Detected', 
              text2: `📍 ${detectedLocality}, ${detectedCity}` 
            });
            applyFilters({
              city: detectedCity || undefined,
              locality: detectedLocality || undefined,
              state: detectedState || undefined,
              pincode: detectedPincode || undefined,
            });
          })
          .catch((error: any) => {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
          });
      }
    } catch (error) {
      console.error('❌ Location detection error:', error);
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not detect location.' });
    } finally {
      setIsLocating(false);
    }
  }, [dispatch, token, addresses.length, applyFilters]);

  // Open AddAddressScreen modal
  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddressModal(true);
  }, []);

  // Initial fetch
  useEffect(() => {
    applyFilters();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (token) {
      await dispatch(fetchUserAddresses(token));
    }
    await applyFilters();
    setRefreshing(false);
  }, [dispatch, token, applyFilters]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing) {
      const nextPage = currentPage + 1;
      const params = getFilterParams();
      dispatch(fetchRentals({
        ...params,
        page: nextPage,
      }));
    }
  };

  const renderFooter = () => {
    if (!loading || rentals.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.champagneGold} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const clearAllFilters = () => {
    setSearchText('');
    setSelectedType('');
    setMinRent('');
    setMaxRent('');
    setCity('');
    setState('');
    setLocality('');
    setPincode('');
    setIsAvailable(true);
    applyFilters({
      q: '',
      rentalType: '',
      minRent: undefined,
      maxRent: undefined,
      city: '',
      state: '',
      locality: '',
      pincode: '',
      isAvailable: true,
    });
    setFiltersVisible(false);
  };

  // ✅ Handle scroll for header animation - UPDATED with state saving
  const handleScroll = (event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    // ✅ Save state continuously
    savedState.current.scrollOffset = currentScrollY;
    savedState.current.isHeaderHidden = isHeaderHidden.current;
    savedState.current.headerTranslateYValue = currentScrollY > 20 ? -HEADER_HEIGHT : 0;

    // Only trigger animation when scrolling significantly
    if (currentScrollY > 20) {
      if (diff > 5 && !isHeaderHidden.current) {
        // Scrolling DOWN - Hide header with smooth spring animation
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
        // Scrolling UP - Show header with smooth spring animation
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
      // At the top - Always show header
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

  // Show loading state
  if (locationLoading && addresses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.champagneGold} />
        <Text style={styles.loadingText}>Loading locations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.pureWhite} />

      {/* ✅ ANIMATED HEADER */}
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
            <Text style={styles.headerSubtitle}>Find Your</Text>
            <Text style={styles.headerTitle}>Perfect Rental</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.locationBtn} 
              onPress={() => setShowAddressModal(true)}
            >
              <Ionicons name="location-outline" size={22} color={Colors.champagneGold} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons name="notifications-outline" size={24} color={Colors.royalNavy} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Bar */}
        <TouchableOpacity 
          style={styles.locationBar} 
          onPress={() => setShowAddressModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={scale(18)} color={Colors.accentGreen} />
          <Text style={styles.locationBarText} numberOfLines={1}>
            {selectedAddress?.addressString || city || locality || "Select a location"}
          </Text>
          <Ionicons name="chevron-down" size={scale(16)} color={Colors.textGray} />
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={Colors.slate} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, location, or pincode..."
            placeholderTextColor={Colors.slate}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => applyFilters({ q: searchText })}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={() => setFiltersVisible(true)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={22} color={Colors.pureWhite} />
          </TouchableOpacity>
        </View>

        {/* Category Scroll */}
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
              applyFilters({ rentalType: '' });
            }}
          >
            <Text style={[styles.categoryText, !selectedType && styles.categoryTextActive]}>All</Text>
          </TouchableOpacity>
          {RENTAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.categoryPill, selectedType === type && styles.categoryPillActive]}
              onPress={() => {
                setSelectedType(type);
                applyFilters({ rentalType: type });
              }}
            >
              <Text style={[styles.categoryText, selectedType === type && styles.categoryTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Main Content with Animated FlatList */}
      <AnimatedFlatList
        ref={flatListRef}
        data={rentals}
        keyExtractor={(item) => item._id}
        numColumns={isTablet ? 3 : 2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[styles.listContent, { paddingTop: HEADER_HEIGHT + 10 }]}
        renderItem={({ item }) => <RentalCard item={item} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.champagneGold} />
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            {/* Results Row - Inside FlatList for scrolling */}
            <View style={styles.resultsRow}>
              <Text style={styles.resultsText}>
                {rentals.length} {rentals.length === 1 ? 'property' : 'properties'} found
              </Text>
              <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="home-outline" size={48} color={Colors.champagneGold} />
              </View>
              <Text style={styles.emptyTitle}>No Rentals Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your filters or search terms
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={clearAllFilters}>
                <Text style={styles.emptyBtnText}>Clear Filters</Text>
              </TouchableOpacity>
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
      <Modal
        visible={showAddAddressModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddAddressModal(false)}
      >
        <AddAddressScreen
          onClose={() => setShowAddAddressModal(false)}
          onLocationSelect={handleLocationFromAddAddress}
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
                <Ionicons name="close" size={24} color={Colors.royalNavy} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.filterLabel}>Search by Name</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Search rentals..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={Colors.slate}
              />

              <Text style={styles.filterLabel}>Rent Range (₹/month)</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Min"
                    keyboardType="numeric"
                    value={minRent}
                    onChangeText={setMinRent}
                    placeholderTextColor={Colors.slate}
                  />
                </View>
                <Text style={styles.rangeDash}>–</Text>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="Max"
                    keyboardType="numeric"
                    value={maxRent}
                    onChangeText={setMaxRent}
                    placeholderTextColor={Colors.slate}
                  />
                </View>
              </View>

              <Text style={styles.filterLabel}>Location</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="City"
                value={city}
                onChangeText={setCity}
                placeholderTextColor={Colors.slate}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="State"
                value={state}
                onChangeText={setState}
                placeholderTextColor={Colors.slate}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Locality"
                value={locality}
                onChangeText={setLocality}
                placeholderTextColor={Colors.slate}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Pincode"
                value={pincode}
                onChangeText={setPincode}
                keyboardType="numeric"
                placeholderTextColor={Colors.slate}
              />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Available Only</Text>
                  <Text style={styles.switchSubtext}>Show only available rentals</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: Colors.lightBorder, true: Colors.champagneGold }}
                  thumbColor={isAvailable ? Colors.royalNavy : Colors.pureWhite}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.clearFiltersModalBtn} onPress={clearAllFilters}>
                  <Text style={styles.clearFiltersModalText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyButton} onPress={() => {
                  setFiltersVisible(false);
                  applyFilters();
                }}>
                  <LinearGradient
                    colors={[Colors.royalNavy, Colors.gradientEnd]}
                    style={styles.applyGradient}
                  >
                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.pureWhite} />
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

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.offWhite },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: Colors.pureWhite,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.slate,
  },
  // ✅ HEADER CONTAINER - Fixed at top
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.pureWhite,
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
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerSubtitle: { fontSize: isSmallPhone ? 12 : 14, color: Colors.slate, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { fontSize: isSmallPhone ? 22 : 28, fontWeight: '800', color: Colors.royalNavy, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: Colors.offWhite, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: Colors.champagneGold 
  },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.offWhite, justifyContent: 'center', alignItems: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.champagneGold, borderWidth: 2, borderColor: Colors.pureWhite },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureWhite,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.royalNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  locationBarText: {
    flex: 1,
    color: Colors.textDark,
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureWhite,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: isSmallPhone ? 2 : 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
    shadowColor: Colors.royalNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: isSmallPhone ? 10 : 12, marginLeft: 8, fontSize: isSmallPhone ? 14 : 16, color: Colors.royalNavy },
  filterBtn: { backgroundColor: Colors.royalNavy, padding: isSmallPhone ? 8 : 10, borderRadius: 12, marginLeft: 8 },
  categoryScroll: { marginTop: 6, maxHeight: 50, paddingBottom: 4 },
  categoryContent: { paddingHorizontal: 16, paddingBottom: 4 },
  categoryPill: {
    paddingHorizontal: isSmallPhone ? 14 : 18,
    paddingVertical: isSmallPhone ? 6 : 8,
    borderRadius: 25,
    backgroundColor: Colors.pureWhite,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  categoryPillActive: { backgroundColor: Colors.royalNavy, borderColor: Colors.royalNavy, shadowColor: Colors.royalNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  categoryText: { color: Colors.slate, fontWeight: '600', fontSize: isSmallPhone ? 12 : 14 },
  categoryTextActive: { color: Colors.pureWhite },
  resultsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 4 
  },
  resultsText: { fontSize: isSmallPhone ? 12 : 13, color: Colors.slate, fontWeight: '500' },
  clearFiltersBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  clearFiltersText: { fontSize: isSmallPhone ? 11 : 12, color: Colors.champagneGold, fontWeight: '600' },
  listContent: { padding: 8, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: 8 },
  card: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: Colors.pureWhite, shadowColor: Colors.royalNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  cardImageWrapper: { position: 'relative', width: '100%', backgroundColor: Colors.offWhite },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  statusBadge: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  availableBadge: { backgroundColor: 'rgba(16, 185, 129, 0.9)' },
  bookedBadge: { backgroundColor: 'rgba(239, 68, 68, 0.9)' },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.pureWhite, marginRight: 4 },
  statusText: { color: Colors.pureWhite, fontSize: isSmallPhone ? 8 : 10, fontWeight: '700', letterSpacing: 0.5 },
  typeBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212, 175, 55, 0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 3 },
  typeText: { color: Colors.pureWhite, fontSize: isSmallPhone ? 8 : 10, fontWeight: '700', letterSpacing: 0.5 },
  priceOverlay: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'baseline' },
  priceOverlayText: { color: Colors.pureWhite, fontSize: isSmallPhone ? 14 : 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  priceOverlaySub: { color: Colors.pureWhite, fontSize: isSmallPhone ? 9 : 11, fontWeight: '500', marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cardBody: { padding: isSmallPhone ? 8 : 12 },
  cardTitle: { fontSize: isSmallPhone ? 13 : 15, fontWeight: '700', color: Colors.royalNavy, marginBottom: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  locationText: { fontSize: isSmallPhone ? 10 : 12, color: Colors.slate, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-start' },
  specsContainer: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.offWhite, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  specText: { fontSize: isSmallPhone ? 9 : 11, color: Colors.charcoal, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.1, paddingHorizontal: 40 },
  emptyIconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: isSmallPhone ? 18 : 20, fontWeight: '700', color: Colors.royalNavy, marginBottom: 8 },
  emptySubtitle: { fontSize: isSmallPhone ? 13 : 14, color: Colors.slate, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: Colors.champagneGold },
  emptyBtnText: { color: Colors.champagneGold, fontWeight: '600', fontSize: isSmallPhone ? 13 : 14 },
  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText: { fontSize: 12, color: Colors.slate },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(11, 16, 33, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.pureWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', shadowColor: Colors.royalNavy, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.lightBorder },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.royalNavy },
  modalCloseBtn: { padding: 4 },
  modalScroll: { marginBottom: 10 },
  filterLabel: { fontSize: isSmallPhone ? 13 : 14, fontWeight: '600', color: Colors.royalNavy, marginTop: 16, marginBottom: 8 },
  filterInput: { borderWidth: 1, borderColor: Colors.lightBorder, borderRadius: 12, padding: isSmallPhone ? 12 : 14, marginBottom: 8, fontSize: isSmallPhone ? 14 : 16, color: Colors.royalNavy, backgroundColor: Colors.offWhite },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangeInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.lightBorder, borderRadius: 12, backgroundColor: Colors.offWhite, paddingHorizontal: 12 },
  rangePrefix: { fontSize: isSmallPhone ? 14 : 16, color: Colors.slate, fontWeight: '600', marginRight: 4 },
  rangeInput: { flex: 1, paddingVertical: isSmallPhone ? 12 : 14, fontSize: isSmallPhone ? 14 : 16, color: Colors.royalNavy },
  rangeDash: { fontSize: 18, color: Colors.slate, fontWeight: '300' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.lightBorder },
  switchLabel: { fontSize: isSmallPhone ? 14 : 16, fontWeight: '600', color: Colors.royalNavy },
  switchSubtext: { fontSize: isSmallPhone ? 11 : 12, color: Colors.slate, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  clearFiltersModalBtn: { flex: 0.4, justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.lightBorder },
  clearFiltersModalText: { color: Colors.slate, fontWeight: '600', fontSize: 15 },
  applyButton: { flex: 0.6, borderRadius: 16, overflow: 'hidden' },
  applyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  applyButtonText: { color: Colors.pureWhite, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
});

export default UserRentalListScreen;