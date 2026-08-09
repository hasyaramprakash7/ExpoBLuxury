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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { fetchRentals, selectAllRentals, selectRentalLoading, selectRentalPagination } from '../features/rentalSlice';
import { RootState } from '../app/store';
import Toast from 'react-native-toast-message';

const { width, height } = Dimensions.get('window');

const isTablet = width >= 768;
const isSmallPhone = width < 375;
const CARD_WIDTH = isTablet ? (width - 48) / 3 : (width - 48) / 2;
const CARD_HEIGHT = isTablet ? 220 : 200;

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
};

const RENTAL_TYPES = ['PG', 'Hotel', 'Apartment', 'Villa', 'Hostel', 'Guest House'];

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

const UserRentalListScreen: React.FC = () => {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const rentals = useSelector(selectAllRentals);
  const loading = useSelector(selectRentalLoading);
  const { currentPage, hasMore } = useSelector(selectRentalPagination);

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
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

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

  // Apply filters (accepts overrides for immediate application)
  const applyFilters = useCallback((overrides?: any) => {
    const params = getFilterParams(overrides);
    dispatch(fetchRentals(params));
    // Scroll to top after filter change
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [dispatch, getFilterParams]);

  // Fetch on initial mount and when screen gains focus (refresh with current filters)
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Re-fetch with current filters when returning to screen
      applyFilters();
    }, [applyFilters])
  );

  // Auto-detect location
  const handleAutoDetectLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Location permission required for auto-detection.' });
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

        // Update state
        setCity(detectedCity);
        setLocality(detectedLocality);
        setState(detectedState);
        setPincode(detectedPincode);

        Toast.show({ 
          type: 'success', 
          text1: 'Location Detected', 
          text2: `📍 ${detectedLocality}, ${detectedCity}` 
        });

        // Apply filters with detected location
        applyFilters({
          city: detectedCity || undefined,
          locality: detectedLocality || undefined,
          state: detectedState || undefined,
          pincode: detectedPincode || undefined,
        });
      }
    } catch (error) {
      console.error('❌ Location detection error:', error);
      Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not detect location. Please enter manually.' });
    } finally {
      setIsLocating(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await applyFilters();
    setRefreshing(false);
  }, [applyFilters]);

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

  // Clear all filters
  const clearAllFilters = () => {
    // Reset all state
    setSearchText('');
    setSelectedType('');
    setMinRent('');
    setMaxRent('');
    setCity('');
    setState('');
    setLocality('');
    setPincode('');
    setIsAvailable(true);
    // Apply with all fields empty
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.pureWhite} />

      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <View>
          <Text style={styles.headerSubtitle}>Find Your</Text>
          <Text style={styles.headerTitle}>Perfect Rental</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.locationBtn} 
            onPress={handleAutoDetectLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.champagneGold} />
            ) : (
              <Ionicons name="locate-outline" size={22} color={Colors.champagneGold} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications-outline" size={24} color={Colors.royalNavy} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </Animated.View>

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

      {/* Results Row */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>
          {rentals.length} {rentals.length === 1 ? 'property' : 'properties'} found
        </Text>
        <TouchableOpacity onPress={clearAllFilters} style={styles.clearFiltersBtn}>
          <Text style={styles.clearFiltersText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        ref={flatListRef}
        data={rentals}
        keyExtractor={(item) => item._id}
        numColumns={isTablet ? 3 : 2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <RentalCard item={item} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.champagneGold} />
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

// Styles remain unchanged; keep the existing styles object.
// (They are exactly the same as in your original file)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.offWhite },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 12,
    backgroundColor: Colors.pureWhite,
  },
  headerSubtitle: { fontSize: isSmallPhone ? 12 : 14, color: Colors.slate, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { fontSize: isSmallPhone ? 22 : 28, fontWeight: '800', color: Colors.royalNavy, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.offWhite, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.champagneGold },
  notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.offWhite, justifyContent: 'center', alignItems: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.champagneGold, borderWidth: 2, borderColor: Colors.pureWhite },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureWhite,
    marginHorizontal: 16,
    marginTop: 8,
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
  categoryScroll: { marginTop: 12, maxHeight: 50 },
  categoryContent: { paddingHorizontal: 16, paddingBottom: 4 },
  categoryPill: {
    paddingHorizontal: isSmallPhone ? 14 : 18,
    paddingVertical: isSmallPhone ? 8 : 10,
    borderRadius: 25,
    backgroundColor: Colors.pureWhite,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.lightBorder,
  },
  categoryPillActive: { backgroundColor: Colors.royalNavy, borderColor: Colors.royalNavy, shadowColor: Colors.royalNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  categoryText: { color: Colors.slate, fontWeight: '600', fontSize: isSmallPhone ? 12 : 14 },
  categoryTextActive: { color: Colors.pureWhite },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
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
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.15, paddingHorizontal: 40 },
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
  autoLocateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.royalNavy, paddingVertical: 12, borderRadius: 12, gap: 8, marginBottom: 16 },
  autoLocateText: { color: Colors.pureWhite, fontWeight: '600', fontSize: 15 },
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