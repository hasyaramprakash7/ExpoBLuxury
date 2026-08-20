// src/screens/ShopListings.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  RefreshControl,
  BackHandler,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { searchDirectoryVendors } from "../features/vendor/vendorAuthSlice";
import { RootState, AppDispatch } from "../app/store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  selectAllAddresses,
} from "../features/locationSlice";
import { fetchCategories } from "../features/categorySlice";
import { LinearGradient } from "expo-linear-gradient";
import { createSelector } from '@reduxjs/toolkit';

import { Colors, getFullAddress, calculateDistance, scale, verticalScale, moderateScale } from "../constants/colors";
import { AddressModal } from "../components/AddressModal";
import { ShopCard } from "../components/ShopCard";
import AdCarousel from "../components/AdCarousel";
import AddAddressScreen from "./AddAddressScreen";

const { width, height } = Dimensions.get("window");
const CATEGORY_DISPLAY_LIMIT = 30;
const FETCH_STALE_MS = 5 * 60 * 1000;

const parseArrayField = (field: any): string[] => {
  if (!field) return [];
  
  if (Array.isArray(field)) {
    if (field.length === 1 && typeof field[0] === 'string' && field[0].startsWith('[')) {
      try {
        const parsed = JSON.parse(field[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim()).filter(Boolean);
        }
      } catch (_) {}
    }
    return field.map(item => String(item).trim()).filter(Boolean);
  }
  
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(Boolean);
      }
      return [String(parsed).trim()].filter(Boolean);
    } catch (_) {
      if (field.includes(',')) {
        return field.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [field.trim()].filter(Boolean);
    }
  }
  
  return [];
};

const selectGenericAds = createSelector(
  (state: RootState) => state.ads?.activeAds || [],
  (activeAds) => activeAds.filter(ad => ad.isProductAd === false)
);

const AdCarouselWithNavigation = ({ limit = 5, title = "Sponsored" }) => {
  const navigation = useNavigation<any>();
  const allGenericAds = useSelector(selectGenericAds);
  
  const genericAds = useMemo(() => {
    return allGenericAds.slice(0, limit);
  }, [allGenericAds, limit]);

  const handleAdPress = useCallback((ad: any) => {
    console.log('🔗 [AdCarousel] Navigating to AdList with:', ad.title, ad._id);
    navigation.navigate('AdList', { 
      selectedAdTitle: ad.title || ad.name || 'Sponsored',
      selectedAdId: ad._id
    });
  }, [navigation]);

  if (!genericAds || genericAds.length === 0) {
    return null;
  }

  return (
    <AdCarousel 
      ads={genericAds} 
      title={title} 
      onAdPress={handleAdPress}
    />
  );
};

const CategoryGridItem = ({
  category,
  onPress,
}: {
  category: { name: string; count: number; image?: string; _id?: string };
  onPress: () => void;
}) => {
  const displayName = typeof category.name === 'string' ? category.name : String(category.name || 'Category');
  
  return (
    <TouchableOpacity
      style={styles.categoryGridItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: category.image || 'https://via.placeholder.com/200x200?text=Category' }}
        style={styles.categoryGridImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.categoryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.categoryTextContainer}>
        <Text style={styles.categoryGridName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.categoryGridCount}>{category.count} shops</Text>
      </View>
    </TouchableOpacity>
  );
};

const CategorySectionHeader = ({ title, count }: { title: string; count: number }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderLeft}>
      <View style={styles.sectionHeaderLine} />
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
    <Text style={styles.sectionHeaderCount}>{count} categories</Text>
  </View>
);

const ShopListings = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const targetVendorId = route.params?.vendorId;

  console.log('🔷 [ShopListings] Screen initialized');

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

  const categories = useSelector((state: RootState) => state.categories?.categories || []);
  const categoriesLoading = useSelector((state: RootState) => state.categories?.loading || false);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [showAddAddress, setShowAddAddress] = useState<boolean>(false);
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const initialLocationRequested = useRef(false);
  const isFetchingLocation = useRef(false);
  const isInitialMount = useRef(true);
  const fetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isFetching = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const locationPickerShown = useRef(false);
  const isNavigatingAway = useRef(false);

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

  useEffect(() => {
    if (categories.length === 0 && !categoriesLoading) {
      console.log('🔷 [ShopListings] Fetching categories...');
      dispatch(fetchCategories());
    }
  }, [dispatch, categories.length, categoriesLoading]);

  const getCurrentLocation = useCallback(() => {
    let lat = userLocation?.latitude;
    let lng = userLocation?.longitude;
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      lat = selectedAddress.latitude;
      lng = selectedAddress.longitude;
    }
    return { lat, lng };
  }, [userLocation, selectedAddress]);

  const fetchDirectoryVendors = useCallback(async (options?: { force?: boolean, category?: string }) => {
    console.log('🔷 [ShopListings] fetchDirectoryVendors called', { 
      options, 
      isFetching: isFetching.current,
      directoryVendorsLength: directoryVendors?.length 
    });
    
    if (isFetching.current) {
      console.log('⏭️ [ShopListings] Fetch already in progress, skipping');
      return;
    }
    const { lat, lng } = getCurrentLocation();
    isFetching.current = true;
    console.log('🔄 [ShopListings] fetchDirectoryVendors executing', { lat, lng, category: options?.category });

    try {
      const params: any = {};
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
      }
      if (options?.category) {
        params.category = options.category;
      }
      
      console.log('📤 [ShopListings] Dispatching searchDirectoryVendors with params:', params);
      await dispatch(searchDirectoryVendors(params));
      
      if (!allProducts || allProducts.length === 0) {
        console.log('📤 [ShopListings] Fetching products...');
        await dispatch(fetchAllVendorProducts());
      }
      if (categories.length === 0 && !categoriesLoading) {
        console.log('📤 [ShopListings] Fetching categories...');
        await dispatch(fetchCategories());
      }
      lastFetchTime.current = Date.now();
      console.log('✅ [ShopListings] Fetch completed, lastFetchTime updated');
    } catch (error) {
      console.error('❌ [ShopListings] Error fetching vendors:', error);
    } finally {
      isFetching.current = false;
      setIsInitialLoading(false);
      console.log('🏁 [ShopListings] isInitialLoading set to false');
    }
  }, [dispatch, getCurrentLocation, allProducts, categories.length, categoriesLoading, directoryVendors?.length]);

  const immediateFetch = useCallback(() => {
    console.log('🔷 [ShopListings] immediateFetch called', { 
      directoryVendorsLength: directoryVendors?.length,
      lastFetchTime: lastFetchTime.current 
    });
    
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
    const now = Date.now();
    const shouldFetch = 
      (!directoryVendors || directoryVendors.length === 0) ||
      (now - lastFetchTime.current > FETCH_STALE_MS);
    if (shouldFetch) {
      console.log('🔄 [ShopListings] immediateFetch – fetching all vendors');
      fetchDirectoryVendors({});
    } else {
      console.log('⏭️ [ShopListings] immediateFetch skipped – data is fresh');
    }
  }, [fetchDirectoryVendors, directoryVendors]);

  const debouncedFetch = useCallback(() => {
    console.log('🔷 [ShopListings] debouncedFetch called');
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
    fetchTimeout.current = setTimeout(() => {
      const now = Date.now();
      const shouldFetch = 
        (!directoryVendors || directoryVendors.length === 0) ||
        (now - lastFetchTime.current > FETCH_STALE_MS);
      if (shouldFetch) {
        console.log('🔄 [ShopListings] debouncedFetch – fetching all vendors');
        fetchDirectoryVendors({});
      } else {
        console.log('⏭️ [ShopListings] debouncedFetch skipped – data is fresh');
      }
      fetchTimeout.current = null;
    }, 300);
  }, [fetchDirectoryVendors, directoryVendors]);

  const handleRequestLocation = async () => {
    console.log('🔷 [ShopListings] handleRequestLocation called');
    if (isFetchingLocation.current) return;
    isFetchingLocation.current = true;
    dispatch(fetchLocationStart());
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      console.log('📍 [ShopListings] Location permission status:', status);
      if (status !== "granted") {
        dispatch(fetchLocationFailure("Permission to access location was denied."));
        Alert.alert("Permission Required", "This app needs location access to find nearby shops.");
        isFetchingLocation.current = false;
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = locationData.coords.latitude;
      const lng = locationData.coords.longitude;
      console.log('📍 [ShopListings] Got location:', { lat, lng });
      dispatch(fetchLocationSuccess({ latitude: lat, longitude: lng }));
      immediateFetch();
    } catch (locError) {
      console.error("Error fetching user location:", locError);
      dispatch(fetchLocationFailure("Could not get your location."));
    } finally {
      isFetchingLocation.current = false;
    }
  };

  useEffect(() => {
    console.log('🔷 [ShopListings] useEffect - location check', {
      token: !!token,
      initialLocationRequested: initialLocationRequested.current,
      addressesLength: addresses.length,
      hasLocation: !!userLocation?.latitude,
      isLocationLoading
    });
    
    if (
      token &&
      !initialLocationRequested.current &&
      addresses.length === 0 &&
      !userLocation?.latitude &&
      !isLocationLoading
    ) {
      console.log("[ShopListings] No saved addresses & no location → auto‑requesting GPS");
      initialLocationRequested.current = true;
      handleRequestLocation();
    }
  }, [token, addresses.length, userLocation, isLocationLoading]);

  useEffect(() => {
    console.log('🔷 [ShopListings] useEffect - location picker check', {
      locationPickerShown: locationPickerShown.current,
      isInitialLoading,
      isLocationLoading,
      hasSelectedAddress: !!selectedAddress,
      hasUserLocation: !!userLocation
    });
    
    if (locationPickerShown.current) return;
    if (isInitialLoading || isLocationLoading) return;

    if (!selectedAddress && !userLocation) {
      console.log('[ShopListings] No location found – opening AddAddressScreen');
      setShowAddAddress(true);
      locationPickerShown.current = true;
    }
  }, [isInitialLoading, isLocationLoading, selectedAddress, userLocation]);

  const handleMapLocationSelect = useCallback((lat: number, lng: number, addressDetails: any) => {
    console.log('🔷 [ShopListings] handleMapLocationSelect called', { lat, lng });
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
    immediateFetch();
  }, [dispatch, token, addresses.length, immediateFetch]);

  const handleOpenAddressModal = () => {
    console.log('🔷 [ShopListings] Opening address modal');
    if (token) dispatch(fetchUserAddresses(token));
    setShowAddressModal(true);
  };

  const handleSelectAddress = (address: any) => {
    console.log('🔷 [ShopListings] Selecting address:', address.addressString);
    if (
      selectedAddress?.id === address.id ||
      selectedAddress?.addressString === address.addressString
    ) {
      setShowAddressModal(false);
      return;
    }
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
    immediateFetch();
  };

  const handleOpenAddAddress = () => {
    console.log('🔷 [ShopListings] Opening add address');
    setShowAddressModal(false);
    setShowAddAddress(true);
  };

  const handleCloseAddAddress = () => {
    console.log('🔷 [ShopListings] Closing add address');
    setShowAddAddress(false);
  };

  const handleAddAddress = async () => {
    console.log('🔷 [ShopListings] handleAddAddress called');
    if (!token) {
      Alert.alert("Authentication Required", "Please login to add an address.");
      return;
    }
    setIsAddressLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "We need location access to fetch your address.");
        setIsAddressLoading(false);
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const exactLat = parseFloat(locationData.coords.latitude.toFixed(8));
      const exactLng = parseFloat(locationData.coords.longitude.toFixed(8));

      let geocode = await Location.reverseGeocodeAsync({
        latitude: exactLat,
        longitude: exactLng,
      });
      let generatedAddressString = "";
      let generatedCity = "";
      let generatedPincode = "";
      if (geocode.length > 0) {
        const g = geocode[0];
        generatedCity = g.city || g.district || "";
        generatedPincode = g.postalCode || "";
        generatedAddressString = [g.name, g.street, generatedCity, g.region, generatedPincode]
          .filter(Boolean)
          .join(", ");
      }
      const addressData = {
        type: "Home" as const,
        addressString: generatedAddressString,
        landmark: "",
        city: generatedCity,
        pincode: generatedPincode,
        latitude: exactLat,
        longitude: exactLng,
        isDefault: addresses.length === 0,
      };
      await dispatch(saveUserAddress({ token, addressData })).unwrap();
      if (token) dispatch(fetchUserAddresses(token));
      setShowAddressModal(false);
      Alert.alert("Success", "Address added successfully!");
      immediateFetch();
    } catch (error) {
      Alert.alert("Error", "Could not save address. Please try again.");
      console.error(error);
    } finally {
      setIsAddressLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    console.log('🔄 [ShopListings] Pull-to-refresh triggered');
    setIsRefreshing(true);
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
      fetchTimeout.current = null;
    }
    try {
      await Promise.all([
        fetchDirectoryVendors({}),
        dispatch(fetchAllVendorProducts()),
        dispatch(fetchCategories()),
      ]);
      console.log('✅ [ShopListings] Refresh completed');
    } catch (error) {
      console.error('❌ [ShopListings] Refresh error:', error);
      Alert.alert("Refresh Failed", "Could not refresh data.");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchDirectoryVendors, dispatch]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const loadInitialData = async () => {
        console.log('🚀 [ShopListings] Initial load started');
        if (!directoryVendors || directoryVendors.length === 0) {
          await fetchDirectoryVendors({});
        }
        if (!allProducts || allProducts.length === 0) {
          await dispatch(fetchAllVendorProducts());
        }
        if (token) {
          dispatch(fetchUserAddresses(token));
        }
        if (categories.length === 0 && !categoriesLoading) {
          await dispatch(fetchCategories());
        }
        setIsInitialLoading(false);
        console.log('✅ [ShopListings] Initial load completed');
      };
      loadInitialData();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 [ShopListings] Screen focused, isNavigatingAway:', isNavigatingAway.current);
      
      if (isNavigatingAway.current) {
        isNavigatingAway.current = false;
        console.log('🔄 [ShopListings] Returning from navigation, fetching all vendors');
        fetchDirectoryVendors({});
        return;
      }
      
      const now = Date.now();
      const shouldFetch = 
        (!directoryVendors || directoryVendors.length === 0) ||
        (now - lastFetchTime.current > FETCH_STALE_MS);

      if (shouldFetch && !isInitialMount.current) {
        console.log('🔄 [ShopListings] Fetching all vendors due to focus (stale or empty)');
        fetchDirectoryVendors({});
      } else {
        console.log('⏭️ [ShopListings] Skipping fetch – data is fresh');
      }

      if (categories.length === 0 && !categoriesLoading) {
        dispatch(fetchCategories());
      }

      return () => {
        isNavigatingAway.current = true;
        console.log('📱 [ShopListings] Screen unfocused, setting isNavigatingAway=true');
      };
    }, [fetchDirectoryVendors, directoryVendors, categories.length, categoriesLoading, dispatch])
  );

  useEffect(() => {
    if (isInitialMount.current) return;
    const lat = userLocation?.latitude;
    const lng = userLocation?.longitude;
    if (lat && lng) {
      console.log('📍 [ShopListings] Location changed, triggering debouncedFetch');
      debouncedFetch();
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (isInitialMount.current) return;
    const lat = selectedAddress?.latitude;
    const lng = selectedAddress?.longitude;
    if (lat && lng) {
      console.log('📍 [ShopListings] Selected address changed, triggering debouncedFetch');
      debouncedFetch();
    }
  }, [selectedAddress?.latitude, selectedAddress?.longitude]);

  useEffect(() => {
    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
        fetchTimeout.current = null;
      }
    };
  }, []);

  const { displayCategories, hasMoreCategories } = useMemo(() => {
    console.log('🔷 [ShopListings] Computing displayCategories', { 
      categoriesLength: categories?.length,
      directoryVendorsLength: directoryVendors?.length 
    });
    
    if (!categories || categories.length === 0) {
      return { displayCategories: [], hasMoreCategories: false };
    }

    const shopCountMap = new Map<string, number>();
    const categoryNameMap = new Map<string, string>();
    
    (directoryVendors || []).forEach((vendor) => {
      if (vendor) {
        const vendorCategories = parseArrayField(vendor.categories);
        vendorCategories.forEach((cat: string) => {
          if (cat) {
            const normalized = cat.toLowerCase();
            shopCountMap.set(normalized, (shopCountMap.get(normalized) || 0) + 1);
            if (!categoryNameMap.has(normalized)) {
              categoryNameMap.set(normalized, cat);
            }
          }
        });
      }
    });

    const fullList = categories.map((category) => {
      const categoryName = typeof category.name === 'string' ? category.name : String(category.name || '');
      const normalizedName = categoryName.toLowerCase();
      const count = shopCountMap.get(normalizedName) || 0;
      const displayName = categoryNameMap.get(normalizedName) || categoryName;
      return {
        name: displayName,
        count: count,
        image: category.image || category.icon,
        _id: category._id,
      };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });

    const display = fullList.slice(0, CATEGORY_DISPLAY_LIMIT);
    const hasMore = fullList.length > CATEGORY_DISPLAY_LIMIT;
    console.log('✅ [ShopListings] Categories computed:', display.length, 'displayed, hasMore:', hasMore);
    return { displayCategories: display, hasMoreCategories: hasMore };
  }, [categories, directoryVendors]);

  const filteredVendors = useMemo(() => {
    const filtered = (directoryVendors || []).filter(v => v && v._id);
    console.log('🔷 [ShopListings] filteredVendors:', filtered.length);
    return filtered;
  }, [directoryVendors]);

  const vendorsWithDetails = useMemo(() => {
    console.log('🔷 [ShopListings] Computing vendorsWithDetails', { 
      filteredVendorsLength: filteredVendors.length,
      allProductsLength: allProducts?.length 
    });
    
    const vendors = filteredVendors;
    const userLat = userLocation?.latitude;
    const userLng = userLocation?.longitude;

    const result = vendors.map((vendor) => {
      const vendorProducts = (allProducts || []).filter((p) => p.vendorId === vendor._id);
      const productImages = vendorProducts.map((p) => p.images && p.images[0]).filter(Boolean);

      const vendorCategories = parseArrayField(vendor.categories);

      let distance = vendor.distance;
      let isInRange = true;
      if (userLat && userLng && vendor.address?.latitude && vendor.address?.longitude) {
        const calculatedDistance = calculateDistance(
          userLat,
          userLng,
          vendor.address.latitude,
          vendor.address.longitude
        );
        distance = calculatedDistance;
        const deliveryRange = vendor.deliveryRange || 10;
        isInRange = calculatedDistance <= deliveryRange;
      }
      if (!vendor.deliveryRange || vendor.deliveryRange === 0) {
        isInRange = true;
      }

      return {
        ...vendor,
        categories: vendorCategories,
        shopImage: vendor.shopImage || vendor.profileImage || vendor.coverImage,
        productsCount: vendorProducts.length,
        productImages,
        distance,
        isInRange,
      };
    });

    const sorted = result.sort((a, b) => {
      if (a.isInRange && b.isInRange) return (a.distance || Infinity) - (b.distance || Infinity);
      if (a.isInRange && !b.isInRange) return -1;
      if (!a.isInRange && b.isInRange) return 1;
      return (a.distance || Infinity) - (b.distance || Infinity);
    });
    
    console.log('✅ [ShopListings] vendorsWithDetails computed:', sorted.length);
    return sorted;
  }, [filteredVendors, allProducts, userLocation]);

  const handleCardPress = (shop: any) => {
    console.log('🔷 [ShopListings] Navigating to ShopDetails:', shop.shopName);
    navigation.navigate("ShopDetails", { vendor: shop });
  };

  const isLoading = 
    (isInitialLoading && (!directoryVendors || directoryVendors.length === 0)) || 
    isLocationLoading || 
    isAddressLoading;

  useEffect(() => {
    console.log('📊 [ShopListings] isLoading:', isLoading, {
      isInitialLoading,
      vendorCount: directoryVendors?.length || 0,
      isLocationLoading,
      isAddressLoading,
      categoriesLoading,
    });
  }, [isLoading, isInitialLoading, directoryVendors, isLocationLoading, isAddressLoading, categoriesLoading]);

  const renderContent = () => {
    console.log('🎨 [ShopListings] renderContent called, isLoading:', isLoading, 'isRefreshing:', isRefreshing);
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
          <Text style={styles.loadingText}>Finding nearby shops...</Text>
        </View>
      );
    }

    if (!userLocation && !targetVendorId && addresses.length === 0 && !isLoading) {
      return (
        <View style={styles.messageContainer}>
          <Ionicons name="location-outline" size={scale(60)} color={Colors.textLightGray} />
          <Text style={styles.messageTitle}>Location Required</Text>
          <Text style={styles.messageText}>Set your location to see nearby sellers.</Text>
          <TouchableOpacity onPress={handleOpenAddressModal} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Select Location</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={vendorsWithDetails}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ShopCard shop={item} onPress={() => handleCardPress(item)} />
        )}
        contentContainerStyle={styles.flatlistContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentGreen}
            colors={[Colors.accentGreen]}
          />
        }
        ListHeaderComponent={
          !targetVendorId && displayCategories.length > 0 ? (
            <>
              <CategorySectionHeader
                title="Browse Categories"
                count={displayCategories.length + (hasMoreCategories ? '+' : '')}
              />
              <View style={styles.categoryGridContainer}>
                <FlatList
                  data={displayCategories}
                  keyExtractor={(item) => item.name}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.categoryGridContent}
                  renderItem={({ item }) => (
                    <CategoryGridItem
                      category={item}
                      onPress={() => {
                        console.log('🔷 [ShopListings] Navigating to category:', item.name);
                        navigation.navigate('CategoryShopsScreen', {
                          categoryName: item.name,
                          categoryImage: item.image,
                        });
                      }}
                    />
                  )}
                />
              </View>
              {hasMoreCategories && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => navigation.navigate('AllCategoriesScreen')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>Show More Categories</Text>
                  <Ionicons name="arrow-forward" size={scale(16)} color={Colors.accentGreen} />
                </TouchableOpacity>
              )}
              <AdCarouselWithNavigation limit={5} title="Sponsored" />
            </>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={scale(60)} color={Colors.textLightGray} />
            <Text style={styles.emptyText}>No shops found</Text>
            <Text style={styles.emptySubText}>
              Try changing your location or clear the filters.
            </Text>
            <TouchableOpacity
              onPress={handleOpenAddressModal}
              style={[styles.retryButton, { marginTop: verticalScale(10) }]}
            >
              <Text style={styles.retryButtonText}>Change Location</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <TouchableOpacity
          style={styles.locationBar}
          onPress={handleOpenAddressModal}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={scale(20)} color={Colors.accentGreen} />
          <Text style={styles.locationBarText} numberOfLines={1}>
            {selectedAddress?.addressString ||
             (userLocation ? "Using GPS location" : "Select a location")}
          </Text>
          <Ionicons name="chevron-down" size={scale(16)} color={Colors.textGray} />
        </TouchableOpacity>

        {!targetVendorId && (
          <TouchableOpacity
            style={styles.searchBarContainer}
            onPress={() => navigation.navigate('AllCategoriesScreen')}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={scale(20)} color={Colors.textGray} />
            <Text style={styles.searchBarPlaceholder}>Browse categories & shops...</Text>
            <Ionicons name="chevron-forward" size={scale(16)} color={Colors.textGray} />
          </TouchableOpacity>
        )}

        {renderContent()}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    marginHorizontal: scale(16),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    borderColor: '#E5E5E5',
    marginTop: verticalScale(12),
  },
  locationBarText: {
    flex: 1,
    color: Colors.textDark,
    fontSize: moderateScale(14),
    marginLeft: scale(8),
    marginRight: scale(8),
    fontWeight: '500',
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(15),
    marginHorizontal: scale(16),
    marginVertical: verticalScale(10),
    borderWidth: 1,
    borderColor: "#E5E5E5",
    paddingVertical: verticalScale(12),
  },
  searchBarPlaceholder: {
    flex: 1,
    marginLeft: scale(10),
    fontSize: moderateScale(15),
    color: Colors.textGray,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    marginTop: verticalScale(4),
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderLine: {
    width: scale(4),
    height: scale(20),
    backgroundColor: Colors.accentGreen,
    borderRadius: moderateScale(2),
    marginRight: scale(8),
  },
  sectionHeaderTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: Colors.textDark,
  },
  sectionHeaderCount: {
    fontSize: moderateScale(12),
    color: Colors.textLightGray,
  },
  categoryGridContainer: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
  },
  categoryGridContent: {
    paddingBottom: verticalScale(4),
  },
  categoryGridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: scale(4),
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A1A',
  },
  categoryGridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  categoryGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  categoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: scale(10),
    alignItems: 'center',
  },
  categoryGridName: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: verticalScale(2),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  categoryGridCount: {
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    marginHorizontal: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginTop: verticalScale(4),
  },
  showMoreText: {
    fontSize: moderateScale(14),
    color: Colors.accentGreen,
    fontWeight: '600',
    marginRight: scale(6),
  },
  flatlistContainer: { paddingBottom: verticalScale(30), paddingTop: verticalScale(4) },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: verticalScale(10), fontSize: moderateScale(16), color: Colors.textGray },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scale(20),
  },
  messageTitle: {
    fontSize: moderateScale(20),
    fontWeight: "bold",
    marginBottom: verticalScale(10),
    color: Colors.textDark,
  },
  messageText: {
    fontSize: moderateScale(16),
    color: Colors.textGray,
    textAlign: "center",
    marginBottom: verticalScale(5),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: verticalScale(50),
    paddingHorizontal: scale(20),
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
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: verticalScale(6),
  },
  retryButton: {
    marginTop: verticalScale(20),
    backgroundColor: Colors.accentGreen,
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(25),
    borderRadius: moderateScale(8),
  },
  retryButtonText: { color: Colors.cardWhite, fontWeight: "bold" },
});

export default ShopListings;