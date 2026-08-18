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
  BackHandler,
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
const HEADER_HEIGHT = height * 0.28;

const CategoryShopsScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { categoryName, categoryImage } = route.params || {};

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
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [showAddAddress, setShowAddAddress] = useState<boolean>(false);
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // ─── Refs & fetch logic ──────────────────────────────────────────
  const initialLocationRequested = useRef(false);
  const isFetchingLocation = useRef(false);
  const isInitialMount = useRef(true);
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFetching = useRef(false);
  const hasFetched = useRef(false);

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
      if (lat && lng) {
        await dispatch(searchDirectoryVendors({ lat, lng, category: categoryName }));
      } else {
        await dispatch(searchDirectoryVendors({ category: categoryName }));
      }

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
  }, [dispatch, currentLocation, categoryName, allProducts, directoryVendors.length]);

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

  // ─── Location Permission & auto‑request ──────────────────────────
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
      dispatch(fetchLocationFailure("Could not get location."));
    } finally {
      isFetchingLocation.current = false;
    }
  };

  // ─── Address handling (same as ShopListings) ──────────────────────
  const handleMapLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
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

  const handleOpenAddAddress = () => {
    setShowAddressModal(false);
    setShowAddAddress(true);
  };

  const handleSelectAddress = (address: any) => {
    if (selectedAddress?.id === address.id || selectedAddress?.addressString === address.addressString) {
      setShowAddressModal(false);
      return;
    }
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
    immediateFetch(true);
  };

  const handleOpenAddressModal = () => {
    if (token) dispatch(fetchUserAddresses(token));
    setShowAddressModal(true);
  };

  const handleAddAddress = async () => {
    // This is called from AddressModal's "Add Address" button – we open the AddAddressScreen
    setShowAddressModal(false);
    setShowAddAddress(true);
  };

  // ─── Refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
    hasFetched.current = false;
    try {
      await Promise.all([ fetchCategoryVendors(true), dispatch(fetchAllVendorProducts()) ]);
    } catch (error) {} finally {
      setIsRefreshing(false);
    }
  }, [fetchCategoryVendors, dispatch]);

  // ─── Lifecycle ────────────────────────────────────────────────────
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

  // ─── Back Handler for modals ────────────────────────────────────
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showAddAddress) {
        setShowAddAddress(false);
        return true;
      }
      if (showAddressModal) {
        setShowAddressModal(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [showAddAddress, showAddressModal]);

  // ─── Vendors with details ────────────────────────────────────────
  const vendorsWithDetails = useMemo(() => {
    const vendors = directoryVendors || [];
    const userLat = userLocation?.latitude;
    const userLng = userLocation?.longitude;

    const result = vendors.map((vendor) => {
      const vendorCopy = JSON.parse(JSON.stringify(vendor));
      const vendorProducts = allProducts.filter((p) => p.vendorId === vendor._id);
      const productImages = vendorProducts.map((p) => p.images && p.images[0]).filter(Boolean);
      let distance = vendor.distance;
      let isInRange = true;

      if (userLat && userLng && vendor.address?.latitude && vendor.address?.longitude) {
        distance = calculateDistance(userLat, userLng, vendor.address.latitude, vendor.address.longitude);
        isInRange = distance <= (vendor.deliveryRange || 10);
      }
      if (!vendor.deliveryRange || vendor.deliveryRange === 0) isInRange = true;

      return {
        ...vendorCopy,
        shopImage: vendor.shopImage || vendor.profileImage || vendor.coverImage,
        productsCount: vendorProducts.length,
        productImages,
        distance,
        isInRange,
      };
    });

    let filtered = result;
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((v) =>
        v.shopName?.toLowerCase().includes(lower) ||
        v.businessType?.toLowerCase().includes(lower) ||
        getFullAddress(v.address).toLowerCase().includes(lower) ||
        v.categories?.some((c) => c.toLowerCase().includes(lower)) ||
        v.tags?.some((t) => t.toLowerCase().includes(lower))
      );
    }

    return filtered.sort((a, b) => {
      if (a.isInRange && b.isInRange) return (a.distance || Infinity) - (b.distance || Infinity);
      if (a.isInRange && !b.isInRange) return -1;
      if (!a.isInRange && b.isInRange) return 1;
      return (a.distance || Infinity) - (b.distance || Infinity);
    });
  }, [directoryVendors, allProducts, userLocation, searchText]);

  const handleCardPress = (shop: any) => navigation.navigate("ShopDetails", { vendor: shop });

  const isLoadingState = isLoading || vendorsLoading || isLocationLoading || isAddressLoading;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* ─── BACKGROUND IMAGE (Fixed) ─────────────────── */}
        <View style={styles.headerBackground}>
          <Image
            source={{ uri: categoryData?.image || 'https://via.placeholder.com/800x400?text=Category' }}
            style={styles.headerImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.7)', '#FFFFFF']}
            locations={[0, 0.2, 0.4, 0.6, 0.85, 1]}
            style={styles.headerGradient}
          />
        </View>

        {/* ─── STICKY HEADER (transparent, white text) ── */}
        <Animated.View style={[styles.stickyHeader, { backgroundColor: 'transparent' }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtnWrapper}>
              <Ionicons name="arrow-back" size={scale(24)} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.topBarRight}>
              <TouchableOpacity style={styles.iconBtnWrapper}>
                <Ionicons name="heart-outline" size={scale(24)} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtnWrapper, { marginLeft: scale(12) }]}>
                <Ionicons name="notifications-outline" size={scale(24)} color="#FFFFFF" />
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

          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={scale(18)} color={Colors.textGray} />
            <TextInput
              style={styles.searchBarInput}
              placeholder={`Search in ${categoryData?.name || 'Category'}...`}
              placeholderTextColor={Colors.textGray}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={scale(18)} color={Colors.textGray} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ─── SCROLL VIEW ────────────────────────────── */}
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: HEADER_HEIGHT + verticalScale(20) }
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

      {/* ─── MODALS ────────────────────────────────── */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleSelectAddress}
        onAddAddress={handleAddAddress}
        selectedAddress={selectedAddress}
        addresses={addresses}
        isLoading={isAddressLoading}
        onOpenMap={handleOpenAddAddress}   // opens AddAddressScreen
      />

      {showAddAddress && (
        <View style={styles.modalOverlay}>
          <AddAddressScreen
            onClose={() => setShowAddAddress(false)}
            onLocationSelect={handleMapLocationSelect}
            onSave={() => {
              setShowAddAddress(false);
            }}
          />
        </View>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────
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
    height: HEADER_HEIGHT,
    zIndex: 1,
  },
  headerImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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