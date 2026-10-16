// src/screens/UserRentalListScreen.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Linking,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import {
  fetchRentals,
  selectAllRentals,
  selectRentalLoading,
  selectRentalPagination,
} from '../features/rentalSlice';
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
import { useDeferredMount } from '../hooks/useDeferredMount';

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

const { width, height } = Dimensions.get('window');

const isTablet = width >= 768;
const isSmallPhone = width < 375;
const HEADER_HEIGHT = 250;

// ─────────────────────────────────────────────────────────────
// 🎨 UNIFIED PALETTE — matches ShopListings feel
// ─────────────────────────────────────────────────────────────
const Royal = {
  gold: '#D4AF37',
  goldSoft: '#E8CC7A',
  goldBright: '#F4DC90',
  goldDim: 'rgba(212,175,55,0.35)',
  goldFaint: 'rgba(212,175,55,0.10)',
  royalGreen: '#0A3D2B',
  royalGreenDeep: '#062318',
  obsidian: '#0B0B0F',
  ivory: '#FFFFFF',
  cream: '#FBF7EE',
  maroon: '#5C1A2B',
  redAlert: '#B91C1C',
  // White surfaces (ShopListings feel)
  whiteBg: '#FFFFFF',
  offWhite: '#F4F4F6',
  softWhite: '#F2F2F7',
  borderLight: 'rgba(0,0,0,0.08)',
  borderMedium: 'rgba(0,0,0,0.15)',
  shadow: 'rgba(0,0,0,0.10)',
  // Text (dark on white)
  textPrimary: '#0B0B0F',
  textSecondary: 'rgba(11,11,15,0.65)',
  textTertiary: 'rgba(11,11,15,0.45)',
  // Accents
  pureBlack: '#000000',
  pureWhite: '#FFFFFF',
};

const Colors = {
  royalNavy: '#0B1021',
  champagneGold: Royal.gold,
  offWhite: Royal.offWhite,
  pureWhite: '#FFFFFF',
  charcoal: '#2D3748',
  slate: '#64748B',
  lightBorder: Royal.borderLight,
  success: '#10B981',
  error: '#EF4444',
  gradientStart: Royal.royalGreenDeep,
  gradientEnd: Royal.royalGreen,
  accentGreen: Royal.royalGreen,
  textDark: Royal.textPrimary,
  textGray: Royal.textSecondary,
  textLightGray: Royal.textTertiary,
  luxuryGold: Royal.gold,
};

const RENTAL_TYPES = ['PG', 'Hotel', 'Apartment', 'Villa', 'Hostel', 'Guest House'];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// ================================================================
// 👑 Address Modal — ShopListings-style (White bg + black accents)
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
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 12;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={addressModalStyles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={addressModalStyles.bottomSheet}>
          <View style={addressModalStyles.bottomSheetContent}>
            <View style={addressModalStyles.bottomSheetHandle} />

            <View style={addressModalStyles.sheetHeader}>
              <View style={addressModalStyles.sheetTitleRow}>
                <Ionicons name="diamond" size={14} color={Royal.pureBlack} />
                <Text style={addressModalStyles.sheetTitle}>SELECT LOCATION</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={Royal.pureBlack} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={addressModalStyles.addressList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <TouchableOpacity
                style={addressModalStyles.currentLocationContainer}
                onPress={onAddAddress}
                activeOpacity={0.75}
              >
                <View style={addressModalStyles.currentLocationIcon}>
                  <Ionicons name="locate" size={20} color={Royal.pureBlack} />
                </View>
                <View style={addressModalStyles.addressInfo}>
                  <Text style={addressModalStyles.currentLocationTitle}>
                    Use my current location
                  </Text>
                  <Text style={addressModalStyles.addressString} numberOfLines={1}>
                    {selectedAddress
                      ? selectedAddress.addressString
                      : 'Fetch GPS & find nearby rentals'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Royal.pureBlack} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  addressModalStyles.currentLocationContainer,
                  { borderTopWidth: 0 },
                ]}
                onPress={onOpenMap}
                activeOpacity={0.75}
              >
                <View style={addressModalStyles.currentLocationIcon}>
                  <Ionicons name="map" size={20} color={Royal.pureBlack} />
                </View>
                <View style={addressModalStyles.addressInfo}>
                  <Text style={addressModalStyles.currentLocationTitle}>
                    Pick from Map
                  </Text>
                  <Text style={addressModalStyles.addressString} numberOfLines={1}>
                    Search and select a location on map
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Royal.pureBlack} />
              </TouchableOpacity>

              <View style={addressModalStyles.sectionDivider} />

              {addresses.length > 0 && (
                <>
                  <Text style={addressModalStyles.savedAddressesHeader}>
                    SAVED ADDRESSES
                  </Text>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddress?.id === addr.id;
                    let iconName = 'location';
                    if (addr.type === 'Home') iconName = 'home';
                    if (addr.type === 'Work') iconName = 'briefcase';
                    if (addr.type === 'Current Location') iconName = 'locate';

                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[
                          addressModalStyles.addressItem,
                          isSelected && addressModalStyles.addressItemSelected,
                        ]}
                        onPress={() => onSelectAddress(addr)}
                        activeOpacity={0.75}
                      >
                        <View style={addressModalStyles.iconContainer}>
                          <Ionicons
                            name={iconName as any}
                            size={20}
                            color={Royal.pureBlack}
                          />
                        </View>
                        <View style={addressModalStyles.addressInfo}>
                          <View style={addressModalStyles.addressTypeRow}>
                            <Text
                              style={[
                                addressModalStyles.addressType,
                                isSelected && { color: Royal.pureBlack },
                              ]}
                            >
                              {addr.type}
                            </Text>
                            {isSelected && (
                              <View style={addressModalStyles.selectedBadge}>
                                <Text style={addressModalStyles.selectedBadgeText}>
                                  SELECTED
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={addressModalStyles.addressString}
                            numberOfLines={2}
                          >
                            {addr.addressString}
                          </Text>
                          {addr.landmark && (
                            <Text style={addressModalStyles.landmarkText}>
                              ◆ {addr.landmark}
                            </Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={Royal.pureBlack}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {isLoading && (
                <View style={addressModalStyles.loadingContainer}>
                  <ActivityIndicator size="small" color={Royal.pureBlack} />
                </View>
              )}
            </ScrollView>

            <View
              style={[
                addressModalStyles.addAddressFooter,
                { paddingBottom: footerPaddingBottom },
              ]}
            >
              <TouchableOpacity
                style={addressModalStyles.addAddressButton}
                onPress={onAddAddress}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color={Royal.pureWhite} />
                <Text style={addressModalStyles.addAddressButtonText}>
                  ADD NEW ADDRESS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const addressModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.45)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Royal.whiteBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    maxHeight: height * 0.88,
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
  },
  bottomSheetContent: {
    paddingTop: 12,
    backgroundColor: Royal.whiteBg,
  },
  bottomSheetHandle: {
    width: 42,
    height: 4,
    backgroundColor: Royal.pureBlack,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.55,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Royal.borderLight,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 2,
  },
  addressList: { flexGrow: 0, maxHeight: height * 0.55 },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    backgroundColor: Royal.whiteBg,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Royal.offWhite,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Royal.pureBlack,
    marginBottom: 2,
  },
  addressInfo: { flex: 1, paddingRight: 10 },
  addressString: {
    fontSize: 12,
    color: Royal.pureBlack,
    lineHeight: 18,
    opacity: 0.7,
  },
  landmarkText: {
    fontSize: 11,
    color: Royal.pureBlack,
    marginTop: 3,
    fontWeight: '700',
    opacity: 0.7,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Royal.borderLight,
    width: '100%',
  },
  savedAddressesHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: Royal.pureBlack,
    opacity: 0.7,
    letterSpacing: 2,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Royal.whiteBg,
    borderBottomWidth: 1,
    borderBottomColor: Royal.borderLight,
  },
  addressItemSelected: { backgroundColor: 'rgba(0,0,0,0.04)' },
  iconContainer: { width: 30, alignItems: 'flex-start' },
  addressTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressType: {
    fontSize: 14,
    fontWeight: '800',
    color: Royal.pureBlack,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Royal.pureBlack,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Royal.pureWhite,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  addAddressFooter: {
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: Royal.whiteBg,
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Royal.pureBlack,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Royal.pureWhite,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginLeft: 8,
  },
  loadingContainer: { padding: 20, alignItems: 'center' },
});

// ================================================================
// 👑 Rental Card — ShopListings-style card (white/black accents)
// ================================================================
const RentalViewCTA = ({ onPress }: { onPress: () => void }) => {
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    arrowTranslateX.value = withRepeat(
      withSequence(withTiming(6, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1,
      true
    );
  }, []);

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.ctaButton}>
      <Text style={styles.ctaText}>VIEW RENTAL</Text>
      <ReAnimated.View style={animatedArrowStyle}>
        <Ionicons name="arrow-forward" size={14} color={Royal.pureWhite} />
      </ReAnimated.View>
    </TouchableOpacity>
  );
};

const RentalCardInner = ({ item }: { item: any }) => {
  const navigation = useNavigation<any>();
  const [flipped, setFlipped] = useState(false);
  const rotateY = useSharedValue(0);

  const coverImage: string | undefined = item.images?.[0];
  const isAvailable = item.isAvailable !== false;

  const fullAddress =
    [
      item.location?.address,
      item.location?.locality,
      item.location?.city,
      item.location?.state,
      item.location?.pincode,
    ]
      .filter(Boolean)
      .join(', ') || 'Location not specified';

  const rentDisplay = item.monthlyRent
    ? `₹${Number(item.monthlyRent).toLocaleString()}`
    : '₹—';

  const flipCard = useCallback(() => {
    const nextValue = !flipped;
    setFlipped(nextValue);
    rotateY.value = withSpring(nextValue ? 180 : 0, { damping: 12, stiffness: 90 });
  }, [flipped, rotateY]);

  const navigateToDetails = useCallback(() => {
    navigation.navigate('RentalDetail', { rentalId: item._id });
  }, [navigation, item._id]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan().onEnd((event) => {
        const { translationX, velocityX } = event;
        if (Math.abs(translationX) > 50 || Math.abs(velocityX) > 500) {
          runOnJS(flipCard)();
        }
      }),
    [flipCard]
  );

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

  const specsLine = useMemo(
    () =>
      [
        item.bedrooms ? `${item.bedrooms} BHK` : null,
        item.bathrooms ? `${item.bathrooms} BATH` : null,
        item.maxGuests ? `${item.maxGuests} GUESTS` : null,
      ]
        .filter(Boolean)
        .join(' • '),
    [item.bedrooms, item.bathrooms, item.maxGuests]
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.cardWrapper}>
        {/* ---------- FRONT ---------- */}
        <ReAnimated.View style={[styles.cardBase, frontAnimatedStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={navigateToDetails} style={styles.cardTouchable}>
            {coverImage ? (
              <Image
                source={{ uri: coverImage, cache: 'force-cache' }}
                style={styles.cardBgImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[Royal.royalGreenDeep, Royal.royalGreen, Royal.obsidian]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBgImage}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.75)']}
              style={styles.cardGradient}
            />

            <View style={styles.frontHeader}>
              <View style={styles.glassBadge}>
                <Text style={styles.badgeText}>
                  {(item.rentalType || 'RENTAL').toString().toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.frontBody}>
              <Text style={styles.miniLabel}>MONTHLY RENT</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.priceValue}>{rentDisplay}</Text>
                <Text style={styles.priceValueSub}>/month</Text>
              </View>
              <View
                style={[
                  styles.availablePill,
                  !isAvailable && { backgroundColor: 'rgba(185,28,28,0.92)' },
                ]}
              >
                <View style={styles.availableDot} />
                <Text style={styles.availablePillText}>
                  {isAvailable ? 'AVAILABLE' : 'BOOKED'}
                </Text>
              </View>
            </View>

            <View style={styles.frontFooter}>
              <View style={styles.footerLeft}>
                <Text style={styles.miniLabel}>RENTAL TITLE</Text>
                <Text style={styles.boldTitle} numberOfLines={1}>
                  {(item.title || 'UNTITLED').toString().toUpperCase()}
                </Text>
                <View style={styles.addressRow}>
                  <Ionicons name="location-sharp" size={11} color={Royal.goldSoft} />
                  <Text style={styles.locationText} numberOfLines={2}>
                    {fullAddress}
                  </Text>
                </View>
              </View>
              <View style={styles.specColumn}>
                <Text style={styles.specText}>
                  {item.bedrooms ? `${item.bedrooms} BHK` : '—'}
                </Text>
                <Text style={styles.specTextSub}>
                  {item.bathrooms ? `${item.bathrooms} BATH` : ''}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </ReAnimated.View>

        {/* ---------- BACK ---------- */}
        <ReAnimated.View style={[styles.cardBase, styles.cardBack, backAnimatedStyle]}>
          <View style={styles.vCardContainer}>
            <View style={styles.vCardHeader}>
              <View style={styles.vCardLogoArea}>
                <Ionicons name="diamond" size={16} color={Royal.pureBlack} />
                <Text style={styles.vCardBrandName}>BLUXURY</Text>
              </View>
              <TouchableOpacity onPress={flipCard} style={styles.flipIcon}>
                <Ionicons name="refresh-circle" size={24} color={Royal.pureBlack} />
              </TouchableOpacity>
            </View>

            <View style={styles.vCardMainInfo}>
              <Text style={styles.vendorName} numberOfLines={1}>
                {(item.rentalType || 'RENTAL').toString().toUpperCase()}
              </Text>
              <Text style={styles.vendorTitle} numberOfLines={1}>
                {(item.title || 'PROPERTY').toString().toUpperCase()}
              </Text>
              <View style={styles.goldDivider} />
            </View>

            <View style={styles.contactGrid}>
              {item.contactPhone ? (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${item.contactPhone}`)}
                >
                  <Ionicons name="call" size={14} color={Royal.pureBlack} />
                  <Text style={styles.contactText}>+91 {item.contactPhone}</Text>
                </TouchableOpacity>
              ) : null}

              {item.contactPhone ? (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() =>
                    Linking.openURL(`whatsapp://send?phone=${item.contactPhone}`)
                  }
                >
                  <FontAwesome name="whatsapp" size={14} color={Royal.pureBlack} />
                  <Text style={styles.contactText}>WHATSAPP</Text>
                </TouchableOpacity>
              ) : null}

              {specsLine ? (
                <View style={styles.contactItem}>
                  <Ionicons name="home" size={14} color={Royal.pureBlack} />
                  <Text style={styles.contactText} numberOfLines={1}>
                    {specsLine}
                  </Text>
                </View>
              ) : null}

              <View style={styles.contactItem}>
                <Ionicons name="location-sharp" size={14} color={Royal.pureBlack} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {(item.location?.locality || 'LOCALE').toString().toUpperCase()},{' '}
                  {(item.location?.city || 'CITY').toString().toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.vCardFooter}>
              <RentalViewCTA onPress={navigateToDetails} />
            </View>
          </View>
        </ReAnimated.View>
      </View>
    </GestureDetector>
  );
};

const RentalCard = React.memo(
  RentalCardInner,
  (prev, next) => prev.item._id === next.item._id
);

// ================================================================
// Main Component
// ================================================================
const UserRentalListScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const rentals = useSelector(selectAllRentals);
  const loading = useSelector(selectRentalLoading);
  const { currentPage, hasMore } = useSelector(selectRentalPagination);

  const addresses = useSelector(selectAllAddresses);
  const selectedAddress = useSelector((state: RootState) => state.location.selectedAddress);
  const userLocation = useSelector((state: RootState) => state.location.location);
  const locationLoading = useSelector((state: RootState) => state.location.loading);
  const token = useSelector((state: RootState) => state.auth.user?.token);

  const ready = useDeferredMount();

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

  const savedScrollOffset = useRef(0);
  const flatListRef = useRef<FlatList>(null);
  const prevSelectedAddressRef = useRef<any>(null);
  const initialFilterApplied = useRef(false);
  const lastFetchAtRef = useRef<number>(0);
  const isNavigatingAway = useRef(false);

  useEffect(() => {
    if (token) {
      dispatch(fetchUserAddresses(token));
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (selectedAddress) {
      setCity(selectedAddress.city || '');
      setLocality(selectedAddress.locality || '');
      setState(selectedAddress.state || '');
      setPincode(selectedAddress.pincode || '');
    }
  }, [selectedAddress]);

  const getFilterParams = useCallback((overrides: any = {}) => {
    const finalCity = overrides.city !== undefined ? overrides.city : (selectedAddress?.city ?? city);
    const finalLocality = overrides.locality !== undefined ? overrides.locality : (selectedAddress?.locality ?? locality);
    const finalState = overrides.state !== undefined ? overrides.state : (selectedAddress?.state ?? state);
    const finalPincode = overrides.pincode !== undefined ? overrides.pincode : (selectedAddress?.pincode ?? pincode);

    const params = {
      page: 1,
      limit: 10,
      q: searchText || undefined,
      rentalType: selectedType || undefined,
      minRent: minRent ? Number(minRent) : undefined,
      maxRent: maxRent ? Number(maxRent) : undefined,
      city: finalCity || undefined,
      state: finalState || undefined,
      locality: finalLocality || undefined,
      pincode: finalPincode || undefined,
      isAvailable,
      ...overrides,
    };

    return params;
  }, [searchText, selectedType, minRent, maxRent, city, state, locality, pincode, isAvailable, selectedAddress]);

  const applyFilters = useCallback((overrides?: any) => {
    const params = getFilterParams(overrides);
    lastFetchAtRef.current = Date.now();
    dispatch(fetchRentals(params));
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [dispatch, getFilterParams]);

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
        applyFilters();
      }
    }
    prevSelectedAddressRef.current = selectedAddress;
  }, [selectedAddress, applyFilters]);

  const handleLocationFromAddAddress = useCallback((lat: number, lng: number, addressDetails: any) => {
    const cityVal = addressDetails.city || addressDetails.district || '';
    const localityVal = addressDetails.colony || addressDetails.suburb || addressDetails.neighbourhood || addressDetails.street || addressDetails.district || '';
    const stateVal = addressDetails.state || '';
    const pincodeVal = addressDetails.pincode || '';
    const country = addressDetails.country || 'India';
    const street = addressDetails.street || '';
    const fullAddress = addressDetails.addressString || addressDetails.fullAddress || '';

    const addressParts = [
      street,
      addressDetails.colony,
      addressDetails.suburb,
      addressDetails.neighbourhood,
      localityVal,
      cityVal,
      addressDetails.district,
      stateVal,
      pincodeVal,
      country,
    ].filter(Boolean);
    const displayAddress = addressParts.join(', ') || fullAddress;

    const addressData = {
      type: "Home" as "Home" | "Work" | "Other" | "Current Location",
      addressString: displayAddress || "Selected location",
      landmark: "",
      city: cityVal || '',
      pincode: pincodeVal || '',
      latitude: lat,
      longitude: lng,
      isDefault: addresses.length === 0,
      state: stateVal || '',
      locality: localityVal || '',
    };

    if (token) {
      dispatch(saveUserAddress({ token, addressData }))
        .unwrap()
        .then((savedAddress: any) => {
          dispatch(setSelectedAddress(savedAddress));
          setShowAddAddressModal(false);
          Toast.show({ type: 'success', text1: 'Location Saved', text2: `📍 ${displayAddress}` });
        })
        .catch(() => {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
        });
    } else {
      setCity(cityVal);
      setLocality(localityVal);
      setState(stateVal);
      setPincode(pincodeVal);
      applyFilters({ city: cityVal, locality: localityVal, state: stateVal, pincode: pincodeVal });
      setShowAddAddressModal(false);
      Toast.show({ type: 'info', text1: 'Location Updated', text2: displayAddress });
    }
  }, [dispatch, token, addresses.length, applyFilters]);

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
          latitude,
          longitude,
          isDefault: addresses.length === 0,
        };

        dispatch(saveUserAddress({ token, addressData }))
          .unwrap()
          .then((savedAddress: any) => {
            dispatch(setSelectedAddress(savedAddress));
            setShowAddressModal(false);
            Toast.show({
              type: 'success',
              text1: 'Location Detected',
              text2: `📍 ${detectedLocality}, ${detectedCity}`,
            });
          })
          .catch(() => {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save location' });
          });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not detect location.' });
    } finally {
      setIsLocating(false);
    }
  }, [dispatch, token, addresses.length]);

  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddressModal(true);
  }, []);

  useEffect(() => {
    if (selectedAddress) {
      initialFilterApplied.current = true;
      prevSelectedAddressRef.current = selectedAddress;
    }
    if (rentals.length === 0) {
      applyFilters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      isNavigatingAway.current = false;

      if (token) {
        dispatch(fetchUserAddresses(token));
      }

      const now = Date.now();
      const stale = now - lastFetchAtRef.current > 60_000;
      if (rentals.length === 0 || stale) {
        lastFetchAtRef.current = now;
        applyFilters();
      }

      return () => {
        isNavigatingAway.current = true;
      };
    }, [dispatch, token, applyFilters, rentals.length])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (token) {
        await dispatch(fetchUserAddresses(token)).unwrap();
      }
      await applyFilters();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, token, applyFilters]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !refreshing) {
      const nextPage = currentPage + 1;
      const params = getFilterParams();
      dispatch(fetchRentals({ ...params, page: nextPage }));
    }
  };

  const renderFooter = () => {
    if (!loading || rentals.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Royal.pureBlack} />
        <Text style={styles.footerText}>LOADING MORE…</Text>
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

  const renderItem = useCallback(
    ({ item }: { item: any }) => <RentalCard item={item} />,
    []
  );

  const keyExtractor = useCallback((item: any) => item._id, []);

  const getLocationSummary = useCallback(() => {
    if (selectedAddress?.addressString) return selectedAddress.addressString;
    const parts: string[] = [];
    if (locality) parts.push(locality);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (pincode) parts.push(pincode);
    return parts.length ? parts.join(', ') : 'Select a location';
  }, [selectedAddress, locality, city, state, pincode]);

  if (locationLoading && addresses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Royal.pureBlack} />
        <Text style={styles.loadingText}>Loading locations…</Text>
        <View style={styles.loadingDivider} />
      </View>
    );
  }

  // Header content — part of the scrollable FlatList (ShopListings feel)
  const renderTopHeader = useCallback(() => {
    return (
      <View
        style={[
          styles.headerScrollContent,
          { paddingTop: insets.top + 8 },
        ]}
      >
        {/* 1. Location bar */}
        <TouchableOpacity
          style={styles.glassPill}
          onPress={() => setShowAddressModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location" size={18} color={Royal.pureBlack} />
          <Text style={styles.locationBarText} numberOfLines={1}>
            {getLocationSummary()}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Royal.pureBlack} />
        </TouchableOpacity>

        {/* 2. Search bar */}
        <TouchableOpacity
          style={[styles.glassPill, styles.searchBarExtraMargin]}
          onPress={() => setFiltersVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={18} color={Royal.pureBlack} />
          <Text style={styles.searchBarPlaceholder}>
            {searchText || 'Search the royal collection...'}
          </Text>
          <Ionicons name="options-outline" size={18} color={Royal.pureBlack} />
        </TouchableOpacity>

        {/* 3. Results row */}
        <View style={styles.resultsRow}>
          <Ionicons name="key-outline" size={16} color={Royal.pureBlack} />
          <Text style={styles.resultsLabel}>
            {rentals.length} {rentals.length === 1 ? 'RENTAL' : 'RENTALS'} FOUND
          </Text>
          <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
            <Text style={styles.clearFiltersText}>CLEAR ALL</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Rental type chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetScrollContent}
          style={styles.presetScrollView}
        >
          <TouchableOpacity
            style={[
              styles.presetChipWrapper,
              !selectedType && styles.presetChipWrapperActive,
            ]}
            onPress={() => {
              setSelectedType('');
              applyFilters({ rentalType: '' });
            }}
          >
            <View
              style={!selectedType ? styles.presetChipActive : styles.presetChipGlass}
            >
              <Text
                style={
                  !selectedType ? styles.presetChipTextActive : styles.presetChipText
                }
              >
                ALL
              </Text>
            </View>
          </TouchableOpacity>
          {RENTAL_TYPES.map((type) => {
            const isActive = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.presetChipWrapper,
                  isActive && styles.presetChipWrapperActive,
                ]}
                onPress={() => {
                  setSelectedType(type);
                  applyFilters({ rentalType: type });
                }}
              >
                <View
                  style={isActive ? styles.presetChipActive : styles.presetChipGlass}
                >
                  <Text
                    style={
                      isActive ? styles.presetChipTextActive : styles.presetChipText
                    }
                  >
                    {type.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [
    insets.top,
    getLocationSummary,
    rentals.length,
    selectedType,
    searchText,
    applyFilters,
    clearAllFilters,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Royal.whiteBg} />

      {ready ? (
        <AnimatedFlatList
          ref={flatListRef}
          data={rentals}
          keyExtractor={keyExtractor}
          numColumns={1}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Royal.pureBlack}
              colors={[Royal.pureBlack]}
            />
          }
          onScroll={(e) => {
            savedScrollOffset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={renderTopHeader()}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="home-outline" size={28} color={Royal.pureBlack} />
                </View>
                <Text style={styles.emptyTitle}>NO RENTALS FOUND</Text>
                <View style={styles.emptyDivider} />
                <Text style={styles.emptySubText}>
                  Try adjusting your filters or search terms.
                </Text>
                <TouchableOpacity
                  onPress={clearAllFilters}
                  style={styles.retryButton}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryButtonText}>CLEAR FILTERS</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      ) : (
        <View style={{ flex: 1, paddingTop: 200 }}>
          <ActivityIndicator size="small" color={Royal.pureBlack} />
        </View>
      )}

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

      <Modal
        visible={showAddAddressModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddAddressModal(false)}
        statusBarTranslucent
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: Royal.whiteBg }}
          edges={["top", "bottom", "left", "right"]}
        >
          <AddAddressScreen
            onClose={() => setShowAddAddressModal(false)}
            onLocationSelect={handleLocationFromAddAddress}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={filtersVisible} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFiltersVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="diamond" size={12} color={Royal.pureBlack} />
                <Text style={styles.modalTitle}>FILTERS</Text>
              </View>
              <TouchableOpacity onPress={() => setFiltersVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={Royal.pureBlack} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.filterLabel}>SEARCH BY NAME</Text>
              <TextInput
                style={styles.filterInput}
                placeholder=""
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={Royal.textTertiary}
              />

              <Text style={styles.filterLabel}>RENT RANGE (₹/MONTH)</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder=""
                    keyboardType="numeric"
                    value={minRent}
                    onChangeText={setMinRent}
                    placeholderTextColor={Royal.textTertiary}
                  />
                </View>
                <Text style={styles.rangeDash}>–</Text>
                <View style={styles.rangeInputWrapper}>
                  <Text style={styles.rangePrefix}>₹</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder=""
                    keyboardType="numeric"
                    value={maxRent}
                    onChangeText={setMaxRent}
                    placeholderTextColor={Royal.textTertiary}
                  />
                </View>
              </View>

              <Text style={styles.filterLabel}>LOCATION</Text>
              <TextInput style={styles.filterInput} placeholder="" value={city} onChangeText={setCity} placeholderTextColor={Royal.textTertiary} />
              <TextInput style={styles.filterInput} placeholder="" value={state} onChangeText={setState} placeholderTextColor={Royal.textTertiary} />
              <TextInput style={styles.filterInput} placeholder="" value={locality} onChangeText={setLocality} placeholderTextColor={Royal.textTertiary} />
              <TextInput style={styles.filterInput} placeholder="" value={pincode} onChangeText={setPincode} keyboardType="numeric" placeholderTextColor={Royal.textTertiary} />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Available Only</Text>
                  <Text style={styles.switchSubtext}>Show only available rentals</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: Royal.borderMedium, true: Royal.pureBlack }}
                  thumbColor={isAvailable ? Royal.pureWhite : Royal.offWhite}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.clearFiltersModalBtn} onPress={clearAllFilters}>
                  <Text style={styles.clearFiltersModalText}>CLEAR ALL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => {
                    setFiltersVisible(false);
                    applyFilters();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.applyButtonText}>APPLY FILTERS</Text>
                  <Ionicons name="arrow-forward" size={16} color={Royal.pureWhite} />
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
// 👑 Styles — ShopListings unified feel (white bg + black accents)
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Royal.offWhite },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Royal.offWhite,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 13,
    color: Royal.pureBlack,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loadingDivider: {
    width: 48,
    height: 1.5,
    backgroundColor: Royal.pureBlack,
    marginTop: 12,
    opacity: 0.4,
  },

  // Header content (inside scroll view)
  headerScrollContent: {
    backgroundColor: Royal.whiteBg,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Royal.borderLight,
  },

  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    backgroundColor: Royal.offWhite,
    marginTop: 4,
    shadowColor: Royal.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBarExtraMargin: {
    marginTop: 8,
    marginBottom: 4,
  },
  locationBarText: {
    flex: 1,
    color: Royal.pureBlack,
    fontSize: 13,
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  searchBarPlaceholder: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: Royal.pureBlack,
    opacity: 0.55,
    fontWeight: '500',
  },

  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 4,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Royal.pureBlack,
    marginLeft: 6,
    marginRight: 6,
    flex: 1,
    letterSpacing: 0.5,
  },
  clearFiltersBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  clearFiltersText: {
    fontSize: 11,
    color: Royal.pureBlack,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.7,
  },

  presetScrollView: {
    flexGrow: 0,
    marginBottom: 6,
    marginTop: 2,
  },
  presetScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    columnGap: 8,
  },
  presetChipWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Royal.borderLight,
    backgroundColor: Royal.softWhite,
  },
  presetChipWrapperActive: {
    borderColor: Royal.pureBlack,
    backgroundColor: Royal.pureBlack,
  },
  presetChipGlass: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Royal.pureBlack,
  },
  presetChipText: {
    fontSize: 11,
    color: Royal.pureBlack,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  presetChipTextActive: {
    color: Royal.pureWhite,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
  },

  listContent: { paddingBottom: 40 },

  // Card
  cardWrapper: {
    width: '100%',
    aspectRatio: 1.586,
    marginBottom: 16,
  },
  cardTouchable: { flex: 1, position: 'relative' },
  cardBase: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: Royal.whiteBg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Royal.borderLight,
    backfaceVisibility: 'hidden',
    shadowColor: Royal.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardBack: {
    backgroundColor: Royal.whiteBg,
    borderColor: Royal.borderLight,
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
  cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  frontHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 18,
    zIndex: 4,
  },
  glassBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  badgeText: {
    color: Royal.pureBlack,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  frontBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '40%',
    paddingHorizontal: 22,
    zIndex: 3,
  },
  miniLabel: {
    color: Royal.goldSoft,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  priceValue: { color: Royal.pureWhite, fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  priceValueSub: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '600', marginLeft: 4 },

  availablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  availableDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Royal.pureWhite, marginRight: 5 },
  availablePillText: {
    color: Royal.pureWhite,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  frontFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    zIndex: 3,
  },
  footerLeft: { flex: 1 },
  boldTitle: {
    color: Royal.pureWhite,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  locationText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    marginLeft: 4,
    letterSpacing: 0.3,
    lineHeight: 13,
    flex: 1,
  },
  specColumn: { alignItems: 'flex-end' },
  specText: { color: Royal.pureWhite, fontSize: 12, fontWeight: '900' },
  specTextSub: { color: Royal.goldSoft, fontSize: 8, fontWeight: '900', letterSpacing: 1 },

  // Back card
  vCardContainer: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: Royal.whiteBg,
  },
  vCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vCardLogoArea: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vCardBrandName: {
    color: Royal.pureBlack,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  flipIcon: { padding: 4 },
  vCardMainInfo: { marginTop: 4 },
  vendorName: {
    color: Royal.pureBlack,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  vendorTitle: {
    color: Royal.pureBlack,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: 1.6,
    opacity: 0.7,
  },
  goldDivider: {
    width: 34,
    height: 2,
    backgroundColor: Royal.pureBlack,
    marginTop: 8,
    borderRadius: 1,
    opacity: 0.85,
  },
  contactGrid: { marginVertical: 4 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  contactText: {
    color: Royal.pureBlack,
    fontSize: 10,
    marginLeft: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  vCardFooter: { width: '100%' },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Royal.pureBlack,
    borderWidth: 1,
    borderColor: Royal.pureBlack,
  },
  ctaText: {
    color: Royal.pureWhite,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginRight: 10,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Royal.borderLight,
    marginBottom: 18,
    backgroundColor: Royal.offWhite,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Royal.pureBlack,
    marginTop: 4,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  emptyDivider: {
    width: 36,
    height: 1.5,
    backgroundColor: Royal.pureBlack,
    marginVertical: 10,
    opacity: 0.55,
  },
  emptySubText: {
    fontSize: 12,
    color: Royal.pureBlack,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: Royal.pureBlack,
    borderWidth: 1,
    borderColor: Royal.pureBlack,
  },
  retryButtonText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 11,
  },

  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText: {
    fontSize: 11,
    color: Royal.pureBlack,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.6,
  },

  // Filters modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,12,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Royal.whiteBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Royal.borderLight,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Royal.pureBlack,
    letterSpacing: 2,
  },
  modalCloseBtn: { padding: 4 },
  modalScroll: { marginBottom: 10 },
  filterLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: Royal.pureBlack,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 2,
    opacity: 0.8,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: Royal.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    fontSize: 14,
    color: Royal.pureBlack,
    backgroundColor: Royal.offWhite,
    fontWeight: '500',
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Royal.borderLight,
    borderRadius: 12,
    backgroundColor: Royal.offWhite,
    paddingHorizontal: 12,
  },
  rangePrefix: {
    fontSize: 16,
    color: Royal.pureBlack,
    fontWeight: '800',
    marginRight: 4,
  },
  rangeInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: Royal.pureBlack,
    fontWeight: '500',
  },
  rangeDash: { fontSize: 18, color: Royal.pureBlack, fontWeight: '300' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Royal.borderLight,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Royal.pureBlack,
  },
  switchSubtext: {
    fontSize: 12,
    color: Royal.pureBlack,
    marginTop: 2,
    opacity: 0.6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  clearFiltersModalBtn: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Royal.borderLight,
    backgroundColor: Royal.offWhite,
  },
  clearFiltersModalText: {
    color: Royal.pureBlack,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.6,
  },
  applyButton: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Royal.pureBlack,
    gap: 8,
  },
  applyButtonText: {
    color: Royal.pureWhite,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 2,
  },
});

export default UserRentalListScreen;