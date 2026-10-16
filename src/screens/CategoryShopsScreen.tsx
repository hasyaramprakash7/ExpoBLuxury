// src/screens/CategoryShopsScreen.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  RefreshControl,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { RootState, AppDispatch } from "../app/store";
import { searchDirectoryVendors } from "../features/vendor/vendorAuthSlice";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { Colors, getFullAddress, calculateDistance, scale, verticalScale, moderateScale } from "../constants/colors";
import { ShopCard } from "../components/ShopCard";
import { MapPickerModal } from "../components/MapPickerModal";
import { AddressModal } from "../components/AddressModal";
import AddAddressScreen from "./AddAddressScreen";
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  selectAllAddresses,
} from "../features/locationSlice";
import * as Location from "expo-location";

const { width, height } = Dimensions.get("window");
const HEADER_IMAGE_HEIGHT = height * 0.28;

// ✅ Helper to parse categories from vendor - handles all formats
const parseVendorCategories = (categories: any): string[] => {
  if (!categories) return [];

  if (Array.isArray(categories)) {
    if (categories.length === 1 && typeof categories[0] === 'string') {
      try {
        const parsed = JSON.parse(categories[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim());
        }
      } catch (_) {}
    }
    return categories.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof categories === 'string') {
    try {
      const parsed = JSON.parse(categories);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      if (categories.includes(',')) {
        return categories.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [categories.trim()].filter(Boolean);
    }
  }

  return [];
};

const CategoryShopsScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { categoryName, categoryImage, radius: passedRadius } = route.params || {};
  const [radius, setRadius] = useState<number>(passedRadius || 10);

  const { location: userLocation, selectedAddress, loading: isLocationLoading } = useSelector(
    (state: RootState) => state.location,
  );
  const addresses = useSelector(selectAllAddresses);
  const { directoryVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth,
  );
  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts,
  );
  const token = useSelector((state: RootState) => state.auth.user?.token);
  const { categories } = useSelector((state: RootState) => state.categories);

  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);
  const [showAddAddress, setShowAddAddress] = useState<boolean>(false);
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(false);
  const [mapPickerCoords, setMapPickerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  // Measured header height — updated via onLayout for pixel-perfect slide
  const [headerHeight, setHeaderHeight] = useState<number>(HEADER_IMAGE_HEIGHT + 200);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ─── Header fully slides off screen (including search bar) ─────
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight],
    extrapolate: 'clamp',
  });

  // ─── Floating sticky search bar fades in on scroll ─────────────
  const stickySearchOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.4, headerHeight * 0.7],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const stickySearchTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.7],
    outputRange: [-10, 0],
    extrapolate: 'clamp',
  });

  // ─── Animated title / subtitle / icon colors ───────────────────
  const titleColor = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.5, headerHeight],
    outputRange: ['#FFFFFF', '#777777', '#1A1A1A'],
    extrapolate: 'clamp',
  });

  const subtitleColor = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.5, headerHeight],
    outputRange: ['rgba(255,255,255,0.9)', Colors.textGray, Colors.textGray],
    extrapolate: 'clamp',
  });

  const iconColor = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.5, headerHeight],
    outputRange: ['#FFFFFF', '#777777', '#1A1A1A'],
    extrapolate: 'clamp',
  });

  // ─── Refs & fetch logic ────────────────────────────────────────
  const initialLocationRequested = useRef(false);
  const isFetchingLocation = useRef(false);
  const isInitialMount = useRef(true);
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFetching = useRef(false);
  const hasFetched = useRef(false);

  // ─── Debounce search text (300ms) ──────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchText]);

  const currentLocation = useMemo(() => {
    let lat = userLocation?.latitude;
    let lng = userLocation?.longitude;
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      lat = selectedAddress.latitude;
      lng = selectedAddress.longitude;
    }
    return { lat, lng };
  }, [userLocation, selectedAddress]);

  const categoryData = useMemo(() => {
    if (categoryImage) return { name: categoryName, image: categoryImage };
    const found = categories.find(c => c.name.toLowerCase() === categoryName?.toLowerCase());
    return found ? { name: found.name, image: found.image } : { name: categoryName, image: null };
  }, [categories, categoryName, categoryImage]);

  const fetchCategoryVendors = useCallback(async (force = false) => {
    if (isFetching.current) return;
    if (!force && hasFetched.current && directoryVendors.length > 0) return;

    const { lat, lng } = currentLocation;
    isFetching.current = true;
    setIsLoading(true);

    try {
      const params: any = {
        category: categoryName,
        radius: radius,
      };
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
      }
      await dispatch(searchDirectoryVendors(params));

      if (!allProducts || allProducts.length === 0) {
        await dispatch(fetchAllVendorProducts());
      }
      hasFetched.current = true;
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('❌ [CategoryShops] Error fetching vendors:', error);
    } finally {
      isFetching.current = false;
      setIsLoading(false);
    }
  }, [dispatch, currentLocation, categoryName, radius, allProducts, directoryVendors.length]);

  const debouncedFetch = useCallback((force = false) => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    fetchTimeout.current = setTimeout(() => {
      fetchCategoryVendors(force);
      fetchTimeout.current = null;
    }, 300);
  }, [fetchCategoryVendors]);

  const immediateFetch = useCallback((force = false) => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    fetchCategoryVendors(force);
  }, [fetchCategoryVendors]);

  useEffect(() => {
    if (token && !initialLocationRequested.current && addresses.length === 0 && !userLocation?.latitude && !isLocationLoading) {
      initialLocationRequested.current = true;
      handleRequestLocation();
    }
  }, [token, addresses.length, userLocation, isLocationLoading]);

  const handleRequestLocation = async () => {
    if (isFetchingLocation.current) return;
    isFetchingLocation.current = true;
    dispatch(fetchLocationStart());
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dispatch(fetchLocationFailure("Permission denied."));
        isFetchingLocation.current = false;
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      dispatch(fetchLocationSuccess({ latitude: locationData.coords.latitude, longitude: locationData.coords.longitude }));
      immediateFetch(true);
    } catch (locError) {
      console.error('❌ [CategoryShops] Error getting location:', locError);
      dispatch(fetchLocationFailure("Could not get location."));
    } finally {
      isFetchingLocation.current = false;
    }
  };

  const handleMapLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    hasFetched.current = false;
    dispatch(fetchLocationSuccess({ latitude: lat, longitude: lng }));

    const addressString = [
      addressDetails.street,
      addressDetails.colony,
      addressDetails.city,
      addressDetails.district,
      addressDetails.state,
      addressDetails.pincode,
      addressDetails.country,
    ].filter(Boolean).join(", ");

    const addressData = {
      type: "Home" as const,
      addressString: addressString || "Selected location",
      landmark: "",
      city: addressDetails.city || "",
      pincode: addressDetails.pincode || "",
      latitude: lat,
      longitude: lng,
      isDefault: addresses.length === 0,
    };

    if (token) {
      dispatch(saveUserAddress({ token, addressData }))
        .unwrap()
        .then(() => {
          if (token) dispatch(fetchUserAddresses(token));
        })
        .catch(console.error);
    }
    dispatch(setSelectedAddress(addressData));
    setShowAddAddress(false);
    immediateFetch(true);
  }, [dispatch, token, addresses.length, immediateFetch]);

  const handleMapPickerSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    hasFetched.current = false;
    dispatch(fetchLocationSuccess({ latitude: lat, longitude: lng }));
    const addressString = [
      addressDetails.street, addressDetails.colony, addressDetails.city,
      addressDetails.district, addressDetails.state, addressDetails.pincode, addressDetails.country
    ].filter(Boolean).join(", ");

    const addressData = {
      type: "Home" as "Home" | "Work" | "Other",
      addressString: addressString || "Selected location",
      landmark: "", city: addressDetails.city || "", pincode: addressDetails.pincode || "",
      latitude: lat, longitude: lng, isDefault: addresses.length === 0,
    };

    if (token) dispatch(saveUserAddress({ token, addressData })).unwrap().then(() => dispatch(fetchUserAddresses(token)));
    dispatch(setSelectedAddress(addressData));
    setShowMapPicker(false);
    immediateFetch(true);
  }, [dispatch, token, addresses.length, immediateFetch]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    hasFetched.current = false;
    try {
      await Promise.all([fetchCategoryVendors(true), dispatch(fetchAllVendorProducts())]);
    } catch (error) {
      console.error('❌ [CategoryShops] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCategoryVendors, dispatch]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      immediateFetch(true);
      if (!allProducts || allProducts.length === 0) dispatch(fetchAllVendorProducts());
      if (token) dispatch(fetchUserAddresses(token));
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) return;
    if (userLocation?.latitude && userLocation?.longitude) {
      hasFetched.current = false;
      debouncedFetch(true);
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (isInitialMount.current) return;
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      hasFetched.current = false;
      debouncedFetch(true);
    }
  }, [selectedAddress?.latitude, selectedAddress?.longitude]);

  useFocusEffect(
    useCallback(() => {
      if (directoryVendors.length === 0 && hasLoadedOnce) {
        hasFetched.current = false;
        immediateFetch(true);
      }
    }, [directoryVendors.length, hasLoadedOnce, immediateFetch])
  );

  const vendorsWithDetails = useMemo(() => {
    const vendors = directoryVendors || [];
    const userLat = userLocation?.latitude;
    const userLng = userLocation?.longitude;

    const result = vendors.map((vendor) => {
      const vendorCopy = { ...vendor };
      const vendorProducts = allProducts.filter((p) => p.vendorId === vendor._id);
      const productImages = vendorProducts.map((p) => p.images && p.images[0]).filter(Boolean);
      let distance = vendor.distance;
      let isInRange = true;

      if (userLat && userLng && vendor.address?.latitude && vendor.address?.longitude) {
        distance = calculateDistance(userLat, userLng, vendor.address.latitude, vendor.address.longitude);
        isInRange = distance <= (vendor.deliveryRange || 10);
      }
      if (!vendor.deliveryRange || vendor.deliveryRange === 0) isInRange = true;

      const parsedCategories = parseVendorCategories(vendor.categories);

      return {
        ...vendorCopy,
        shopImage: vendor.shopImage || vendor.profileImage || vendor.coverImage,
        productsCount: vendorProducts.length,
        productImages,
        distance,
        isInRange,
        categories: parsedCategories,
      };
    });

    let filtered = result;
    if (categoryName) {
      const categoryLower = categoryName.toLowerCase();
      filtered = filtered.filter((v) => {
        const vendorCategories = v.categories || [];
        const matches = vendorCategories.some((c: string) =>
          String(c).toLowerCase().includes(categoryLower) ||
          categoryLower.includes(String(c).toLowerCase())
        );
        return matches;
      });
    }

    // Debounced search filter
    if (debouncedSearchText) {
      const lower = debouncedSearchText.toLowerCase();
      filtered = filtered.filter((v) =>
        v.shopName?.toLowerCase().includes(lower) ||
        v.businessType?.toLowerCase().includes(lower) ||
        getFullAddress(v.address).toLowerCase().includes(lower) ||
        v.categories?.some((c: string) => String(c).toLowerCase().includes(lower)) ||
        v.tags?.some((t: string) => String(t).toLowerCase().includes(lower))
      );
    }

    const sorted = filtered.sort((a, b) => {
      if (a.isInRange && b.isInRange) return (a.distance || Infinity) - (b.distance || Infinity);
      if (a.isInRange && !b.isInRange) return -1;
      if (!a.isInRange && b.isInRange) return 1;
      return (a.distance || Infinity) - (b.distance || Infinity);
    });

    return sorted;
  }, [directoryVendors, allProducts, userLocation, debouncedSearchText, categoryName]);

  const handleCardPress = useCallback((shop: any) => {
    navigation.navigate("ShopDetails", { vendor: shop });
  }, [navigation]);

  const handleOpenAddressModal = useCallback(() => {
    if (token) dispatch(fetchUserAddresses(token));
    setShowAddressModal(true);
  }, [dispatch, token]);

  const handleSelectAddress = useCallback((address: any) => {
    if (selectedAddress?.id === address.id) {
      setShowAddressModal(false);
      return;
    }
    hasFetched.current = false;
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
    immediateFetch(true);
  }, [dispatch, selectedAddress, immediateFetch]);

  const handleOpenAddAddress = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddress(true);
  }, []);

  const handleCloseAddAddress = useCallback(() => {
    setShowAddAddress(false);
  }, []);

  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setMapPickerCoords(
      userLocation?.latitude
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : selectedAddress?.latitude
        ? { lat: selectedAddress.latitude, lng: selectedAddress.longitude }
        : null
    );
    setShowMapPicker(true);
  }, [userLocation, selectedAddress]);

  const handleAddAddress = useCallback(async () => {
    setShowAddressModal(false);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchText("");
    setDebouncedSearchText("");
  }, []);

  const isLoadingState = isLoading || vendorsLoading || isLocationLoading || isAddressLoading;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ── Header image + gradient — slides fully off screen ── */}
        <Animated.View
          style={[
            styles.headerBackground,
            {
              height: headerHeight,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          {categoryData?.image ? (
            <Image
              source={{ uri: categoryData.image }}
              style={styles.headerImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.headerImage, styles.headerImageFallback]}>
              <Ionicons name="storefront" size={scale(64)} color="rgba(255,255,255,0.35)" />
            </View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.7)', '#FFFFFF']}
            locations={[0, 0.2, 0.4, 0.6, 0.85, 1]}
            style={styles.headerGradient}
          />
        </Animated.View>

        {/* ── Sticky header — slides fully off screen on scroll ── */}
        <Animated.View
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          style={[
            styles.stickyHeader,
            { transform: [{ translateY: headerTranslateY }] },
          ]}
        >
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtnWrapper}>
              <View style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={scale(22)} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.iconBtnWrapper}>
                <View style={styles.iconBtn}>
                  <Ionicons name="heart-outline" size={scale(22)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtnWrapper, { marginLeft: scale(8) }]}>
                <View style={styles.iconBtn}>
                  <Ionicons name="notifications-outline" size={scale(22)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.categoryTitleContainer}>
            <Text style={styles.categoryTitle}>
              {categoryData?.name || 'Category'}
            </Text>
            <Text style={styles.categorySubtitle}>
              {vendorsWithDetails.length} {vendorsWithDetails.length === 1 ? 'shop' : 'shops'} available
            </Text>
          </View>

          <TouchableOpacity style={styles.locationBar} onPress={handleOpenAddressModal} activeOpacity={0.7}>
            <View style={styles.locationIconContainer}>
              <Ionicons name="location-sharp" size={scale(16)} color={Colors.accentGreen} />
            </View>
            <Text style={styles.locationBarText} numberOfLines={1}>
              {selectedAddress?.addressString || (userLocation ? "Using GPS location" : "Select a location")}
            </Text>
            <Ionicons name="chevron-down" size={scale(14)} color={Colors.textGray} />
          </TouchableOpacity>

          {/* Header search bar — visible only at top */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={scale(18)} color={Colors.textGray} />
            <TextInput
              style={styles.searchBarInput}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={scale(18)} color={Colors.textGray} />
                
              </TouchableOpacity>
            )}
          </View> 
        </Animated.View>

        {/* ── Floating sticky search bar (appears only on scroll) ── */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.stickySearchWrapper,
            {
              opacity: stickySearchOpacity,
              transform: [{ translateY: stickySearchTranslateY }],
            },
          ]}
        >
          <View style={styles.stickySearchBar}>
            <Ionicons name="search" size={scale(18)} color={Colors.textGray} />
            <TextInput
              style={styles.stickySearchInput}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={scale(18)} color={Colors.textGray} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + verticalScale(20) },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentGreen}
              colors={[Colors.accentGreen]}
            />
          }
        >
          <View style={styles.whiteSection}>
            <View style={styles.resultsRow}>
              <Text style={styles.resultsText}>
                {vendorsWithDetails.length} {vendorsWithDetails.length === 1 ? 'shop' : 'shops'} found
              </Text>
            </View>

            {isLoadingState && vendorsWithDetails.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.accentGreen} />
                <Text style={styles.loadingText}>Finding shops...</Text>
              </View>
            ) : vendorsWithDetails.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="storefront-outline" size={scale(50)} color={Colors.textLightGray} />
                <Text style={styles.emptyText}>No shops found in this category</Text>
                <Text style={styles.emptySubText}>Try changing your location or search terms</Text>
                <TouchableOpacity onPress={handleOpenAddressModal} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Change Location</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.shopListContainer}>
                {vendorsWithDetails.map((item) => (
                  <ShopCard key={item._id} shop={item} onPress={() => handleCardPress(item)} />
                ))}
              </View>
            )}
            <View style={{ height: verticalScale(40) }} />
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleSelectAddress}
        onAddAddress={handleAddAddress}
        selectedAddress={selectedAddress}
        addresses={addresses}
        isLoading={isAddressLoading}
        onOpenMap={handleOpenAddAddress}
      />

      {showAddAddress && (
        <View style={styles.modalOverlay}>
          <AddAddressScreen
            onClose={handleCloseAddAddress}
            onLocationSelect={handleMapLocationSelect}
            onSave={() => {
              setShowAddAddress(false);
            }}
          />
        </View>
      )}

      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onLocationSelect={handleMapPickerSelect}
        initialLat={mapPickerCoords?.lat}
        initialLng={mapPickerCoords?.lng}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerImageFallback: {
    backgroundColor: Colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? verticalScale(50) : verticalScale(40),
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    zIndex: 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: verticalScale(10),
    zIndex: 100,
  },
  topBarRight: { flexDirection: 'row' },
  iconBtnWrapper: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: {
    width: '100%',
    height: '100%',
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryTitleContainer: {
    paddingHorizontal: scale(4),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(2),
  },
  categoryTitle: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  categorySubtitle: {
    fontSize: moderateScale(13),
    marginTop: verticalScale(2),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    marginTop: verticalScale(6),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  locationIconContainer: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationBarText: {
    flex: 1,
    color: Colors.textDark,
    fontSize: moderateScale(13),
    marginLeft: scale(10),
    marginRight: scale(8),
    fontWeight: '500',
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    marginTop: verticalScale(10),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: scale(8),
    fontSize: moderateScale(14),
    paddingVertical: verticalScale(12),
    color: Colors.textDark,
  },
  clearSearchBtn: { padding: scale(4) },

  // ── Floating sticky search bar ─────────────────────────────────
  stickySearchWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? verticalScale(48) : verticalScale(38),
    left: 0,
    right: 0,
    zIndex: 60,
    paddingHorizontal: scale(16),
    alignItems: 'center',
  },
  stickySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  stickySearchInput: {
    flex: 1,
    marginLeft: scale(8),
    fontSize: moderateScale(14),
    paddingVertical: verticalScale(10),
    color: Colors.textDark,
  },

  scrollView: {
    flex: 1,
    zIndex: 5,
  },
  scrollContent: {
    paddingBottom: verticalScale(20),
  },
  whiteSection: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(30),
    borderTopRightRadius: moderateScale(30),
    marginTop: verticalScale(10),
    paddingTop: verticalScale(8),
    minHeight: height * 0.5,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(4),
  },
  resultsText: {
    fontSize: moderateScale(13),
    color: Colors.textGray,
    fontWeight: '500',
  },
  shopListContainer: {
    paddingHorizontal: scale(8),
    paddingTop: verticalScale(4),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: verticalScale(40),
    minHeight: verticalScale(200),
  },
  loadingText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(14),
    color: Colors.textGray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: verticalScale(40),
    paddingHorizontal: scale(20),
    minHeight: verticalScale(200),
  },
  emptyText: {
    fontSize: moderateScale(18),
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: verticalScale(12),
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: moderateScale(14),
    color: Colors.textLightGray,
    textAlign: 'center',
    marginTop: verticalScale(6),
  },
  retryButton: {
    marginTop: verticalScale(20),
    backgroundColor: Colors.accentGreen,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(8),
  },
  retryButtonText: {
    color: Colors.cardWhite,
    fontWeight: "bold",
    fontSize: moderateScale(14),
  },
});

export default CategoryShopsScreen;