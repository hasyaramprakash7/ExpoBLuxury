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
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';

// Gesture handler imports
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

import Animated, {
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

const { width, height } = Dimensions.get('window');

const isTablet = width >= 768;
const isSmallPhone = width < 375;

const Colors = {
  trueBlack: '#000000',
  luxuryGold: '#fff',
  goldLight: '#F9E2AF',
  pureWhite: '#FFFFFF',
  slate: '#64748B',
  darkSlate: '#475569',
  lightBg: '#000000',
  border: '#E2E8F0',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  black: '#000000',
  offWhite: '#F8F9FA',
  royalNavy: '#0B1021',
  champagneGold: '#D4AF37',
  charcoal: '#2D3748',
  success: '#10B981',
  error: '#EF4444',
  gradientStart: '#0B1021',
  gradientEnd: '#1A1F3A',
};

const PROPERTY_TYPES = ['Independent House/Villa', 'Apartment', 'Plot', 'Commercial', 'Penthouse', 'Studio'];

const FALLBACK_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// --- SUB-COMPONENT: Royal Animated CTA (updated for gold/white) ---
const ViewPropertyCTA = ({ onPress }: { onPress: () => void }) => {
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    arrowTranslateX.value = withRepeat(
      withSequence(
        withTiming(8, { duration: 600 }),
        withTiming(0, { duration: 600 })
      ),
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
      <Animated.View style={animatedArrowStyle}>
        <Ionicons name="arrow-forward" size={18} color={Colors.trueBlack} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- Realistic Chip (unchanged) ---
const RealisticChip = () => (
  <LinearGradient
    colors={['#8A6E2F', '#F9E2AF', '#C5A028', '#8A6E2F']}
    style={styles.chipContainer}
  >
    <View style={[styles.chipLine, { top: '25%', width: '100%' }]} />
    <View style={[styles.chipLine, { top: '50%', width: '100%' }]} />
    <View style={[styles.chipLine, { top: '75%', width: '100%' }]} />
    <View style={[styles.chipLineVertical, { left: '33%', height: '100%' }]} />
    <View style={[styles.chipLineVertical, { left: '66%', height: '100%' }]} />
  </LinearGradient>
);

// --- Property Card (updated with swipe-to-flip) ---
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

  // Flip function
  const flipCard = () => {
    const nextValue = !flipped;
    setFlipped(nextValue);
    rotateY.value = withSpring(nextValue ? 180 : 0, { damping: 12, stiffness: 90 });
  };

  const navigateToDetails = () => {
    navigation.navigate('PropertyDetailScreen', { propertyId: item._id });
  };

  // Gesture handler for swipe
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      // Detect horizontal swipe with enough distance or velocity
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
    width: '100%',
    height: '100%',
  }));

  const displayPrice =
    item.minPriceCr === item.maxPriceCr
      ? `₹${item.minPriceCr} Cr`
      : `₹${item.minPriceCr} - ${item.maxPriceCr} Cr`;

  const coverImage = item.images?.[0] || FALLBACK_IMAGE;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.cardWrapper}>
        {/* FRONT - tap to navigate to details */}
        <Animated.View style={[styles.cardBase, frontAnimatedStyle]}>
          <TouchableOpacity activeOpacity={1} onPress={navigateToDetails} style={{ flex: 1 }}>
            <Image source={{ uri: coverImage }} style={styles.cardBgImage} />
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', '#000']}
              style={StyleSheet.absoluteFillObject}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>PROPERTY TITLE</Text>
                <Text style={styles.boldTitle} numberOfLines={1}>
                  {item.title?.toUpperCase() || 'UNTITLED'}
                </Text>
              </View>
              <View style={styles.specColumn}>
                <Text style={styles.specText}>{item.configuration?.bhk || 'N/A'}</Text>
                <Text style={styles.specTextSub}>
                  {item.areaOptions?.[0]?.superBuiltUpSqFt || item.area || 'N/A'} SQFT
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* BACK - white/gold royal theme */}
        <Animated.View style={[styles.cardBase, styles.cardBack, backAnimatedStyle]}>
          <View style={styles.vCardContainer}>
            <View style={styles.vCardHeader}>
              <View style={styles.vCardLogoArea}>
                <MaterialCommunityIcons name="rhombus-split" size={22} color={Colors.luxuryGold} />
                <Text style={[styles.vCardBrandName, { color: Colors.trueBlack }]}>BLUXURY</Text>
              </View>
              {/* Refresh circle still works as fallback */}
              <TouchableOpacity onPress={flipCard} style={styles.flipIcon}>
                <Ionicons name="refresh-circle" size={24} color={Colors.luxuryGold} />
              </TouchableOpacity>
            </View>
            <View style={styles.vCardMainInfo}>
              <Text style={[styles.vendorName, { color: Colors.trueBlack }]} numberOfLines={1}>
                {vendorName.toUpperCase()}
              </Text>
              <Text style={[styles.vendorTitle, { color: Colors.slate }]} numberOfLines={1}>
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
                    <Ionicons name="call" size={13} color={Colors.luxuryGold} />
                    <Text style={[styles.contactText, { color: Colors.trueBlack }]}>+91 {vendorPhone}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactItem}
                    onPress={() => Linking.openURL(`whatsapp://send?phone=${vendorPhone}`)}
                  >
                    <FontAwesome name="whatsapp" size={14} color={Colors.luxuryGold} />
                    <Text style={[styles.contactText, { color: Colors.trueBlack }]}>WHATSAPP BUSINESS</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <View style={styles.contactItem}>
                <Ionicons name="location-sharp" size={14} color={Colors.luxuryGold} />
                <Text style={[styles.contactText, { color: Colors.trueBlack }]} numberOfLines={1}>
                  {item.location?.locality?.toUpperCase() || item.locality || 'LOCALE'},{' '}
                  {item.location?.city?.toUpperCase() || item.city || 'CITY'}
                </Text>
              </View>
            </View>
            <View style={styles.vCardFooter}>
              <ViewPropertyCTA onPress={navigateToDetails} />
            </View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

// --- MAIN SCREEN (unchanged) ---
const UserPropertyListScreen: React.FC = () => {
  // ... (all state and logic exactly as before)
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const properties = useSelector(selectAllProperties);
  const loading = useSelector(selectPropertyLoading);
  const { currentPage, hasMore } = useSelector(selectPropertyPagination);

  const vendors = useSelector((state: RootState) => state.vendorAuth.allVendors) ?? [];
  const vendorsLoading = useSelector((state: RootState) => state.vendorAuth.loading) ?? false;

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
  const [isLocating, setIsLocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const getFilterParams = useCallback((overrides: any = {}) => {
    return {
      page: 1,
      limit: 10,
      q: searchText || undefined,
      propertyType: selectedType || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      city: city || undefined,
      state: state || undefined,
      locality: locality || undefined,
      pincode: pincode || undefined,
      vendorId: selectedVendorId || undefined,
      ...overrides,
    };
  }, [searchText, selectedType, minPrice, maxPrice, city, state, locality, pincode, selectedVendorId]);

  const applyFilters = useCallback((overrides?: any) => {
    const params = getFilterParams(overrides);
    dispatch(fetchProperties(params));
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setFiltersVisible(false);
  }, [dispatch, getFilterParams]);

  const clearAllFilters = () => {
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

  const handleAutoDetectLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Location permission is required for auto‑detection.',
        });
        setIsLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const { city: detectedCity, region, district, postalCode, street, name } = geocode[0];
        const finalCity = detectedCity || district || region || '';
        const finalLocality = street || name || district || '';
        const finalState = region || '';
        const finalPincode = postalCode || '';

        setCity(finalCity);
        setLocality(finalLocality);
        setState(finalState);
        setPincode(finalPincode);

        Toast.show({
          type: 'success',
          text1: 'Location Detected',
          text2: `📍 ${finalLocality || finalCity}`,
        });

        applyFilters({
          city: finalCity || undefined,
          locality: finalLocality || undefined,
          state: finalState || undefined,
          pincode: finalPincode || undefined,
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Location Error',
        text2: 'Could not detect location. Please enter manually.',
      });
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    applyFilters();
    dispatch(fetchAllVendorsAuth());
  }, []);

  useFocusEffect(
    useCallback(() => {
      applyFilters();
    }, [applyFilters])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([applyFilters(), dispatch(fetchAllVendorsAuth())]);
    setRefreshing(false);
  }, [applyFilters, dispatch]);

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
        <ActivityIndicator size="small" color={Colors.luxuryGold} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.trueBlack} />

      <RNAnimated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View>
          <Text style={styles.headerSubtitle}>PRIVATE COLLECTION</Text>
          <Text style={styles.headerTitle}>BLUXURY LISTINGS</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={handleAutoDetectLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.luxuryGold} />
            ) : (
              <Ionicons name="locate-outline" size={22} color={Colors.luxuryGold} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color={Colors.pureWhite} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </RNAnimated.View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={Colors.luxuryGold} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search properties by title or highlights..."
          placeholderTextColor={Colors.darkSlate}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => applyFilters({ q: searchText })}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => setFiltersVisible(true)} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={22} color={Colors.black} />
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

      <View style={styles.resultsRow}>
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
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <PropertyCard item={item} vendors={vendors} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.luxuryGold} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="home-outline" size={48} color={Colors.luxuryGold} />
              </View>
              <Text style={styles.emptyTitle}>No Properties Found</Text>
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
                <Ionicons name="close" size={24} color={Colors.pureWhite} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <TouchableOpacity
                style={styles.autoLocateBtn}
                onPress={handleAutoDetectLocation}
                disabled={isLocating}
              >
                <Ionicons name="locate" size={20} color={Colors.pureWhite} />
                <Text style={styles.autoLocateText}>
                  {isLocating ? 'Detecting...' : 'Auto-Detect Location'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.filterLabel}>Search by Name</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="Search properties..."
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={Colors.darkSlate}
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
                  <ActivityIndicator size="small" color={Colors.luxuryGold} style={{ marginLeft: 10 }} />
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
                    placeholderTextColor={Colors.darkSlate}
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
                    placeholderTextColor={Colors.darkSlate}
                    keyboardType="decimal-pad"
                    value={maxPrice}
                    onChangeText={setMaxPrice}
                  />
                </View>
              </View>

              <Text style={styles.filterLabel}>Location</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="City"
                placeholderTextColor={Colors.darkSlate}
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="State"
                placeholderTextColor={Colors.darkSlate}
                value={state}
                onChangeText={setState}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Locality"
                placeholderTextColor={Colors.darkSlate}
                value={locality}
                onChangeText={setLocality}
              />
              <TextInput
                style={styles.filterInput}
                placeholder="Pincode"
                placeholderTextColor={Colors.darkSlate}
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
                    colors={[Colors.luxuryGold, '#C5A028']}
                    style={styles.applyGradient}
                  >
                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.trueBlack} />
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

// --- Styles (updated for white/gold back card) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.trueBlack },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 12,
    backgroundColor: Colors.trueBlack,
  },
  headerSubtitle: {
    fontSize: isSmallPhone ? 10 : 12,
    color: Colors.luxuryGold,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: isSmallPhone ? 18 : 24,
    fontWeight: '800',
    color: Colors.pureWhite,
    marginTop: 2,
    letterSpacing: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.luxuryGold,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.luxuryGold,
    borderWidth: 2,
    borderColor: Colors.trueBlack,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: Colors.pureWhite },
  filterBtn: {
    backgroundColor: Colors.luxuryGold,
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
  },

  categoryScroll: { marginTop: 4, maxHeight: 45, marginBottom: 8 },
  categoryContent: { paddingHorizontal: 16, paddingBottom: 4 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    height: 34,
    justifyContent: 'center',
  },
  categoryPillActive: { backgroundColor: Colors.luxuryGold, borderColor: Colors.luxuryGold },
  categoryText: { color: Colors.slate, fontWeight: '600', fontSize: 12 },
  categoryTextActive: { color: Colors.trueBlack, fontWeight: 'bold' },

  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultsText: { fontSize: isSmallPhone ? 12 : 13, color: Colors.slate, fontWeight: '500' },
  clearFiltersBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  clearFiltersText: { fontSize: isSmallPhone ? 11 : 12, color: Colors.luxuryGold, fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 100 },
  cardWrapper: { width: '100%', aspectRatio: 1.586, marginBottom: 20 },
  cardBase: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: Colors.trueBlack,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    backgroundColor: Colors.pureWhite,
    borderColor: Colors.luxuryGold,
    borderWidth: 1,
  },
  cardBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.65,
  },
  chipContainer: { width: 40, height: 28, borderRadius: 5, overflow: 'hidden' },
  chipLine: { position: 'absolute', height: 0.5, backgroundColor: 'rgba(0,0,0,0.2)' },
  chipLineVertical: { position: 'absolute', width: 0.5, backgroundColor: 'rgba(0,0,0,0.2)' },
  chipBrandGroup: { flexDirection: 'row', alignItems: 'center' },
  frontHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
  brandText: { color: Colors.pureWhite, fontSize: 9, letterSpacing: 2, fontWeight: 'bold', marginLeft: 10 },
  glassBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  frontBody: { paddingHorizontal: 22, flex: 1, justifyContent: 'center' },
  miniLabel: { color: Colors.luxuryGold, fontSize: 8, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
  priceValue: { color: '#fff', fontSize: 24, fontWeight: '300', letterSpacing: 1 },
  frontFooter: { flexDirection: 'row', alignItems: 'flex-end', padding: 16 },
  boldTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
  specColumn: { alignItems: 'flex-end' },
  specText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  specTextSub: { color: Colors.luxuryGold, fontSize: 8, fontWeight: 'bold' },

  vCardContainer: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: Colors.pureWhite,
  },
  vCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vCardLogoArea: { flexDirection: 'row', alignItems: 'center' },
  vCardBrandName: {
    color: Colors.trueBlack,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginLeft: 6,
  },
  flipIcon: { padding: 4 },
  vCardMainInfo: { marginTop: 4 },
  vendorName: {
    color: Colors.trueBlack,
    fontSize: 16,
    fontWeight: 'bold',
  },
  vendorTitle: {
    color: Colors.slate,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 1,
  },
  goldDivider: { width: 30, height: 2, backgroundColor: Colors.luxuryGold, marginTop: 6 },
  contactGrid: { marginVertical: 4 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  contactText: {
    color: Colors.trueBlack,
    fontSize: 9.5,
    marginLeft: 10,
    fontWeight: '500',
  },
  vCardFooter: { width: '100%' },
  ctaButton: {
    backgroundColor: Colors.luxuryGold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 0,
  },
  ctaText: {
    color: Colors.trueBlack,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginRight: 10,
  },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.15, paddingHorizontal: 40 },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: isSmallPhone ? 18 : 20, fontWeight: '700', color: Colors.pureWhite, marginBottom: 8 },
  emptySubtitle: { fontSize: isSmallPhone ? 13 : 14, color: Colors.slate, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: Colors.luxuryGold },
  emptyBtnText: { color: Colors.luxuryGold, fontWeight: '600', fontSize: isSmallPhone ? 13 : 14 },

  footerLoader: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  footerText: { fontSize: 12, color: Colors.slate },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.pureWhite },
  modalCloseBtn: { padding: 4 },
  modalScroll: { marginBottom: 10 },

  autoLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.luxuryGold,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  autoLocateText: { color: Colors.trueBlack, fontWeight: '600', fontSize: 15 },

  filterLabel: { fontSize: isSmallPhone ? 13 : 14, fontWeight: '600', color: Colors.luxuryGold, marginTop: 16, marginBottom: 8 },
  filterInput: {
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: '#000',
    borderRadius: 12,
    padding: isSmallPhone ? 12 : 14,
    marginBottom: 8,
    fontSize: isSmallPhone ? 14 : 16,
    color: Colors.pureWhite,
  },

  vendorScroll: { flexDirection: 'row', marginTop: 4, marginBottom: 6 },
  vendorOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginRight: 8,
    marginBottom: 6,
  },
  vendorOptionActive: { backgroundColor: Colors.luxuryGold, borderColor: Colors.luxuryGold },
  vendorOptionText: { color: Colors.slate, fontSize: 12, fontWeight: '500' },
  vendorOptionTextActive: { color: Colors.trueBlack, fontWeight: 'bold' },

  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  rangeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    backgroundColor: '#000',
    paddingHorizontal: 12,
  },
  rangePrefix: { fontSize: isSmallPhone ? 14 : 16, color: Colors.slate, fontWeight: '600', marginRight: 4 },
  rangeInput: { flex: 1, paddingVertical: isSmallPhone ? 12 : 14, fontSize: isSmallPhone ? 14 : 16, color: Colors.pureWhite },
  rangeDash: { fontSize: 18, color: Colors.slate, fontWeight: '300' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: Platform.OS === 'ios' ? 20 : 10 },
  clearFiltersModalBtn: {
    flex: 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  clearFiltersModalText: { color: Colors.slate, fontWeight: '600', fontSize: 15 },
  applyButton: { flex: 0.6, borderRadius: 16, overflow: 'hidden' },
  applyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  applyButtonText: { color: Colors.trueBlack, fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
});

export default UserPropertyListScreen;