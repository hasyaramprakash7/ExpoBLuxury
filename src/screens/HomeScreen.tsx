import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  RefreshControl,
  ViewStyle,
  TextStyle,
  ImageSourcePropType,
  NativeScrollEvent,
  ImageBackground,
  Modal,
  TextInput,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useNavigation,
  NavigationProp,
  ParamListBase,
  useFocusEffect,
} from "@react-navigation/native";
import * as Location from "expo-location";

// Redux Imports
import { AppDispatch, RootState } from "../app/store";
import { fetchAllVendorProducts } from "../features/vendor/vendorProductSlices";
import { fetchNearbyVendors } from "../features/vendor/vendorAuthSlice";
import {
  fetchLocationStart,
  fetchLocationSuccess,
  fetchLocationFailure,
  fetchUserAddresses,
  setSelectedAddress,
  saveUserAddress,
  SavedAddress,
  selectAllAddresses,
} from "../features/locationSlice";

// Custom Components
import NewProductCard1 from "../components/NewProductCard10";
import NewProductCard2 from "../components/NewProductCard11";
import ShopCard from "./ShopCard";
import AddAddressScreen from "./AddAddressScreen"; // map picker

// Local Assets
const image = require("../../assets/b4.jpg");
const image1 = require("../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png");
const image2 = require("../../assets/b13.jpg");
const backgroundImage = require("../../assets/b1.jpg");

const { width, height } = Dimensions.get("window");

// --- Colors and Constants ---
const Colors = {
  white: "#FFFFFF",
  lightGray: "#F0F0F0",
  grayText: "#7A7A7A",
  dark: "#0A3D2B",
  darkText: "#0A3D2B",
  orange: "#0A3D2B",
  swiggyOrange: "#0A3D2B",
  borderGray: "#E5E5EA",
  redAlert: "#DC2626",
  greenDark: "#0A3D2B",
  lightgreen: "#23df9eff",
  pinkPrimary: "#ff3d67",
  bluePrimary: "#4285F4",
  successGreen: "#34C759",
  sheetOverlay: "rgba(0, 0, 0, 0.6)",
  sheetBackground: "#F9F9F9",
  accentGreen: "#1B8C40",
};

// --- Type Definitions ---
interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  postalCode?: string;
  fullAddress?: string;
}

interface Vendor {
  _id: string;
  isApproved: boolean;
  isOnline: boolean;
  shopName: string;
  shopImage: string;
  deliveryRange: number;
  address: LocationData;
  distance?: number;
}

interface Product {
  _id: string;
  vendorId: string;
  name: string;
  category: string;
  brandName: string;
  images?: string[];
  price: number;
  stock: number;
}

interface ShopDisplay {
  id: string;
  name: string;
  shopImageUrl: string;
  distance?: number;
  address: LocationData;
  products: { imageUrl: string }[];
}

interface CategoryDisplay {
  name: string;
  imageUrl: string;
}

type AppNavigationProp = NavigationProp<ParamListBase>;

// --- Utility Functions ---
const getCategoryName = (fullCategoryName: string | undefined): string => {
  if (!fullCategoryName) return "";
  const parts = fullCategoryName.split("_");
  return parts[parts.length - 1].replace(/-/g, " ").slice(0, 7);
};

const shuffleArray = <T extends any[]>(array: T): T => {
  const newArray = [...array] as T;
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// --- STATIC Category Bar Component ---
interface StaticCategoryBarProps {
  categories: CategoryDisplay[];
  handleCategoryPress: (category: { name: string }) => void;
}

const StaticCategoryBar: React.FC<StaticCategoryBarProps> = ({
  categories,
  handleCategoryPress,
}) => {
  return (
    <View style={allStyles.categoriesSection as ViewStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={allStyles.categoriesScrollContainer as ViewStyle}
      >
        {categories.map((category, index) => {
          return (
            <TouchableOpacity
              key={index}
              style={[allStyles.categoryCard as ViewStyle, { zIndex: 1 }]}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.9}
            >
              <View style={allStyles.categoryImageWrapper}>
                <Image
                  source={{
                    uri: category.imageUrl || "https://via.placeholder.com/100",
                  }}
                  style={allStyles.categoryImageSmall}
                />
              </View>
              <Text
                style={allStyles.categoryNameText as TextStyle}
                numberOfLines={1}
              >
                {getCategoryName(category.name)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

interface SectionHeaderProps {
  title: string;
  onPress?: () => void;
  textStyle?: TextStyle;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onPress,
  textStyle,
}) => (
  <View style={allStyles.sectionHeader}>
    <Text style={[allStyles.sectionTitle, textStyle]}>
      {title || "Section"}
    </Text>
    {onPress && (
      <TouchableOpacity style={allStyles.seeAllButton} onPress={onPress}>
        <Text style={[allStyles.seeAllText, textStyle]}>See All</Text>
        <Ionicons
          name="chevron-forward-outline"
          size={16}
          color={textStyle?.color || Colors.grayText}
        />
      </TouchableOpacity>
    )}
  </View>
);

interface ImageBannerProps {
  imageUrl: ImageSourcePropType;
  onPress: () => void;
}

const ImageBanner: React.FC<ImageBannerProps> = ({ imageUrl, onPress }) => (
  <TouchableOpacity onPress={onPress} style={allStyles.imageBannerContainer}>
    <Image source={imageUrl} style={allStyles.imageBanner} resizeMode="cover" />
  </TouchableOpacity>
);

// ==============================================================
// 🔥 LOCATION MODAL – exactly as in UserRentalListScreen
// ==============================================================
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
              <Ionicons name="close" size={24} color={Colors.darkText} />
            </TouchableOpacity>
          </View>

          <ScrollView style={addressModalStyles.addressList} showsVerticalScrollIndicator={false}>
            {/* Use Current Location */}
            <TouchableOpacity
              style={addressModalStyles.currentLocationContainer}
              onPress={onAddAddress}
            >
              <View style={addressModalStyles.currentLocationIcon}>
                <Ionicons name="locate" size={22} color={Colors.swiggyOrange} />
              </View>
              <View style={addressModalStyles.addressInfo}>
                <Text style={addressModalStyles.currentLocationTitle}>
                  Use my current location
                </Text>
                <Text style={addressModalStyles.addressString} numberOfLines={1}>
                  {selectedAddress
                    ? selectedAddress.addressString
                    : "Fetch GPS & find nearby shops"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.grayText} />
            </TouchableOpacity>

            {/* Pick from Map */}
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
              <Ionicons name="chevron-forward" size={18} color={Colors.grayText} />
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
                          color={isSelected ? Colors.swiggyOrange : Colors.darkText}
                        />
                      </View>
                      <View style={addressModalStyles.addressInfo}>
                        <View style={addressModalStyles.addressTypeRow}>
                          <Text
                            style={[
                              addressModalStyles.addressType,
                              isSelected && { color: Colors.swiggyOrange },
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
                          color={Colors.successGreen}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            {isLoading && (
              <View style={addressModalStyles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.swiggyOrange} />
              </View>
            )}
          </ScrollView>

          <View style={addressModalStyles.addAddressFooter}>
            <TouchableOpacity
              style={addressModalStyles.addAddressButton}
              onPress={onAddAddress}
            >
              <Ionicons name="add" size={20} color={Colors.swiggyOrange} />
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
    backgroundColor: Colors.sheetBackground,
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
    borderBottomColor: Colors.borderGray,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.darkText,
    letterSpacing: -0.3,
  },
  addressList: {
    maxHeight: height * 0.55,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.white,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 128, 25, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.swiggyOrange,
    marginBottom: 2,
  },
  addressInfo: {
    flex: 1,
    paddingRight: 10,
  },
  addressString: {
    fontSize: 13,
    color: Colors.grayText,
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
    color: Colors.grayText,
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
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  addressItemSelected: {
    backgroundColor: 'rgba(52, 199, 89, 0.04)',
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
    color: Colors.darkText,
  },
  selectedBadge: {
    marginLeft: 8,
    backgroundColor: Colors.successGreen,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  addAddressFooter: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Colors.swiggyOrange,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

// ==============================================================
// 🔥 MAIN HOME SCREEN
// ==============================================================

const HomeScreen: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<AppNavigationProp>();

  // --- UI State ---
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [numRecommendedProducts, setNumRecommendedProducts] = useState(10);
  const [reentryTrigger, setReentryTrigger] = useState(0);

  // --- Location Modal State ---
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const locationPickerShown = useRef(false);

  // Redux State
  const {
    location: userLocation,
    selectedAddress,
    permissionGranted,
    loading: isLocationLoading,
    addressActionLoading,
    error: locationError,
  } = useSelector((state: RootState) => state.location);

  const addresses = useSelector(selectAllAddresses);

  const { allProducts, loading: productsLoading } = useSelector(
    (state: RootState) => state.vendorProducts,
  );

  const { nearbyVendors, loading: vendorsLoading } = useSelector(
    (state: RootState) => state.vendorAuth,
  );

  const token = useSelector((state: RootState) => state.auth.user?.token);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const isCartEmpty = Object.keys(cartItems).length === 0;

  // Caches & Shuffled State
  const productCache = useRef<Product[]>([]);
  const vendorCache = useRef<(Vendor & { distance: number })[]>([]);
  const categoryCache = useRef<CategoryDisplay[]>([]);
  const [shuffledTopDeals, setShuffledTopDeals] = useState<Product[]>([]);
  const [shuffledRecommendedProducts, setShuffledRecommendedProducts] =
    useState<Product[]>([]);

  // Internal tracking refs
  const lastFetchedCoordsRef = useRef<string | null>(null);
  const initialLocationRequested = useRef(false);

  // Reset and re‑fetch addresses on screen focus
  useFocusEffect(
    useCallback(() => {
      setReentryTrigger((prev) => prev + 1);
      initialLocationRequested.current = false;
      lastFetchedCoordsRef.current = null;
      productCache.current = [];
      vendorCache.current = [];
      categoryCache.current = [];
      if (token) {
        dispatch(fetchUserAddresses(token));
      }
    }, [dispatch, token]),
  );

  useEffect(() => {
    console.log('📦 nearbyVendors in Redux:', nearbyVendors);
  }, [nearbyVendors]);

  // 1. Auto‑request GPS if no saved addresses & no location – but only if we are not showing the map picker
  useEffect(() => {
    if (
      token &&
      !initialLocationRequested.current &&
      addresses.length === 0 &&
      !userLocation?.latitude &&
      !isLocationLoading &&
      !showAddAddress // prevent conflict with map picker
    ) {
      console.log("[HomeScreen] No saved addresses & no location → auto‑requesting GPS");
      initialLocationRequested.current = true;
      handleAddCurrentLocation(); // now uses the same logic as "Use my current location"
    }
  }, [token, addresses.length, userLocation, isLocationLoading, showAddAddress]);

  // 2. Fetch vendors & products when location changes (via selectedAddress or userLocation)
  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      console.log('📍 Dispatching fetchNearbyVendors with:', userLocation);
      dispatch(fetchNearbyVendors({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      }));
    }
  }, [userLocation]);

  // --- NEW: Auto‑open map picker if no location exists on mount ---
  useEffect(() => {
    if (locationPickerShown.current) return;
    if (isLocationLoading || productsLoading || vendorsLoading) return;

    // If we have no selected address and no GPS location, open the map picker
    if (!selectedAddress && !userLocation) {
      console.log('[HomeScreen] No location – opening AddAddressScreen');
      setShowAddAddress(true);
      locationPickerShown.current = true;
    }
  }, [isLocationLoading, productsLoading, vendorsLoading, selectedAddress, userLocation]);

  // --- HANDLERS for location ---

  // Handle "Use my current location"
  const handleAddCurrentLocation = useCallback(async () => {
    if (!token) {
      Alert.alert("Authentication Required", "Please login to add an address.");
      return;
    }

    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "We need location access to find nearby shops.");
        setIsLocating(false);
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = locationData.coords;

      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      let city = '', locality = '', state = '', pincode = '', addressString = '';
      if (geocode.length > 0) {
        const g = geocode[0];
        city = g.city || g.district || '';
        locality = g.street || g.name || g.district || '';
        state = g.region || '';
        pincode = g.postalCode || '';
        addressString = [locality, city, state, pincode].filter(Boolean).join(", ");
      }

      const addressData = {
        type: "Current Location" as "Home" | "Work" | "Other" | "Current Location",
        addressString: addressString || "Current Location",
        landmark: "",
        city,
        pincode,
        latitude,
        longitude,
        isDefault: addresses.length === 0,
      };

      const saved = await dispatch(saveUserAddress({ token, addressData })).unwrap();
      dispatch(setSelectedAddress(saved));
      setShowAddressModal(false);
      // Refresh data with new location
      onRefresh();
      Alert.alert("Success", "Location saved!");
    } catch (error) {
      console.error("Error fetching location:", error);
      Alert.alert("Error", "Could not get your location. Please try again.");
    } finally {
      setIsLocating(false);
    }
  }, [dispatch, token, addresses.length, onRefresh]);

  // Handle selection from saved addresses
  const handleSelectAddress = useCallback((address: SavedAddress) => {
    dispatch(setSelectedAddress(address));
    setShowAddressModal(false);
    onRefresh(); // refresh with new address
  }, [dispatch, onRefresh]);

  // Open map picker (AddAddressScreen)
  const handleOpenMapPicker = useCallback(() => {
    setShowAddressModal(false);
    setShowAddAddress(true);
  }, []);

  // Handle location selected from map (AddAddressScreen)
  const handleLocationFromAddAddress = useCallback((lat: number, lng: number, addressDetails: any) => {
    // Build full address string
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
        .then((saved: any) => {
          dispatch(setSelectedAddress(saved));
          // Refresh data
          onRefresh();
        })
        .catch(console.error);
    } else {
      // Fallback – just update selected address locally (should not happen)
      dispatch(setSelectedAddress(addressData));
      onRefresh();
    }
    setShowAddAddress(false);
  }, [dispatch, token, addresses.length, onRefresh]);

  // --- Refresh function ---
  const onRefresh = useCallback(async () => {
    console.log("[HomeScreen] Pull-to-Refresh Triggered");
    setIsRefreshing(true);

    lastFetchedCoordsRef.current = null;
    initialLocationRequested.current = false;
    productCache.current = [];
    vendorCache.current = [];
    categoryCache.current = [];

    try {
      const promises = [dispatch(fetchAllVendorProducts())];
      if (token) promises.push(dispatch(fetchUserAddresses(token)));
      if (userLocation?.latitude && userLocation?.longitude) {
        promises.push(
          dispatch(
            fetchNearbyVendors({
              lat: userLocation.latitude,
              lng: userLocation.longitude,
            }),
          ),
        );
      }

      await Promise.all(promises);
      setNumRecommendedProducts(10);
      setReentryTrigger((prev) => prev + 1);
      console.log("[HomeScreen] Refresh complete.");
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, token, userLocation]);

  // --- Data transformation (same as before) ---
  const inRangeVendors: (Vendor & { distance?: number })[] = useMemo(() => {
    if (vendorCache.current.length > 0 && !isRefreshing)
      return vendorCache.current as any;
    if (!nearbyVendors) return [];

    const approvedVendors = nearbyVendors.filter((v: Vendor) => v.isApproved);
    vendorCache.current = approvedVendors as any;
    return approvedVendors as any;
  }, [nearbyVendors, isRefreshing]);

  const inRangeProducts: Product[] = useMemo(() => {
    if (productCache.current.length > 0 && !isRefreshing)
      return productCache.current;
    if (!allProducts || inRangeVendors.length === 0) return [];

    const inRangeVendorIds = inRangeVendors.map((vendor) => vendor._id);
    const filteredProducts: Product[] = (allProducts || [])
      .filter((product: Product) => {
        const isInRange = inRangeVendorIds.includes(product.vendorId);
        const hasStock = product.stock > 0;
        return isInRange && hasStock;
      });

    productCache.current = filteredProducts;
    console.log(`📊 [HomeScreen] Filtered products: ${filteredProducts.length}`);
    return filteredProducts;
  }, [allProducts, inRangeVendors, isRefreshing]);

  const shuffleData = useCallback(() => {
    if (inRangeProducts.length > 0) {
      setShuffledTopDeals(shuffleArray(inRangeProducts.slice(0, 5)));
      setShuffledRecommendedProducts(shuffleArray(inRangeProducts));
    } else {
      setShuffledTopDeals([]);
      setShuffledRecommendedProducts([]);
    }
  }, [inRangeProducts]);

  useEffect(() => {
    shuffleData();
  }, [inRangeProducts, reentryTrigger, shuffleData]);

  const topDeals = shuffledTopDeals;
  const recommendedProducts = shuffledRecommendedProducts;

  const uniqueShops: ShopDisplay[] = useMemo(() => {
    if (!inRangeVendors || !inRangeProducts) return [];
    const productsByVendor = inRangeProducts.reduce(
      (acc: { [key: string]: { imageUrl: string }[] }, product) => {
        if (!acc[product.vendorId]) acc[product.vendorId] = [];
        acc[product.vendorId].push({
          imageUrl: product.images?.[0] || "https://via.placeholder.com/50",
        });
        return acc;
      },
      {},
    );

    return inRangeVendors.map((vendor) => ({
      id: vendor._id,
      name: vendor.shopName?.slice(0, 7) || "Shop",
      shopImageUrl: vendor.shopImage,
      distance: vendor.distance,
      address: vendor.address,
      products: productsByVendor[vendor._id] || [],
    }));
  }, [inRangeVendors, inRangeProducts]);

  const uniqueBrands = useMemo(() => {
    if (!inRangeProducts || inRangeProducts.length === 0) return [];
    const brandsMap = new Map<string, { name: string; imageUrl?: string }>();
    inRangeProducts.forEach((product) => {
      if (product.brandName && !brandsMap.has(product.brandName)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.brandName === product.brandName &&
            p.images &&
            p.images.length > 0
        );
        brandsMap.set(product.brandName, {
          name: product.brandName,
          imageUrl: firstImageProduct?.images?.[0] || "https://via.placeholder.com/50",
        });
      }
    });
    return Array.from(brandsMap.values());
  }, [inRangeProducts]);

  const allUniqueCategories: CategoryDisplay[] = useMemo(() => {
    if (categoryCache.current.length > 0 && !isRefreshing)
      return categoryCache.current;
    if (!inRangeProducts || inRangeProducts.length === 0) return [];
    const categoriesMap = new Map<string, CategoryDisplay>();
    inRangeProducts.forEach((product) => {
      if (product.category && !categoriesMap.has(product.category)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.category === product.category && p.images && p.images.length > 0,
        );
        categoriesMap.set(product.category, {
          name: product.category,
          imageUrl:
            firstImageProduct?.images?.[0] || "https://via.placeholder.com/100",
        });
      }
    });
    const finalCategories = Array.from(categoriesMap.values()).sort((a, b) =>
      getCategoryName(a.name).localeCompare(getCategoryName(b.name)),
    ) as CategoryDisplay[];
    categoryCache.current = finalCategories;
    return finalCategories;
  }, [inRangeProducts, isRefreshing]);

  // --- Navigation handlers ---
  const handleShopPress = (shop: ShopDisplay) =>
    navigation.navigate("MyCategoriesScreen" as never, {
      vendorId: shop.id,
      vendorName: shop.name,
    });
  const handleBrandPress = (brand: { name: string }) =>
    navigation.navigate("MyCategoriesScreen" as never, {
      brandName: brand.name,
    });
  const handleCategoryPress = (category: { name: string }) =>
    navigation.navigate("MyCategoriesScreen" as never, {
      categoryName: category.name,
    });
  const handleAdPress1 = () =>
    navigation.navigate("ShopListings" as never);
  const handleFreeShippingBannerPress = () =>
    navigation.navigate("InsuranceProductsAndDetails" as never);
  const handleSearchPress = () => navigation.navigate("ProductSearchScreen" as never);
  const handleProfilePress = () => navigation.navigate("Profile" as never);
  const handleSeeAllPress = (sectionTitle: string) => {
    if (sectionTitle === "Top Deals" && topDeals.length > 0)
      navigation.navigate("MyCategoriesScreen" as never, {
        categoryName: topDeals[0]?.category,
      });
    else if (
      sectionTitle === "All Categories" &&
      allUniqueCategories.length > 0
    )
      navigation.navigate("MyCategoriesScreen" as never, {
        categoryName: allUniqueCategories[0]?.name,
      });
    else if (sectionTitle === "Nearby Shops")
      navigation.navigate("ShopListings" as never);
    else if (sectionTitle === "Popular Brands" && uniqueBrands.length > 0)
      navigation.navigate("MyCategoriesScreen" as never, {
        brandName: uniqueBrands[0]?.name,
      });
  };

  const onScrollEnd = (
    event: { nativeEvent: NativeScrollEvent },
    sectionTitle: string,
  ) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.x >= contentSize.width - layoutMeasurement.width - 5)
      handleSeeAllPress(sectionTitle);
  };

  const handleRecommendedScroll = ({
    nativeEvent,
  }: {
    nativeEvent: NativeScrollEvent;
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50 &&
      numRecommendedProducts < recommendedProducts.length
    ) {
      setNumRecommendedProducts((prev) =>
        Math.min(prev + 10, recommendedProducts.length),
      );
    }
  };

  // --- Category bar ---
  const renderCategoryBar = () => {
    if (allUniqueCategories.length === 0) return null;
    return (
      <StaticCategoryBar
        categories={allUniqueCategories}
        handleCategoryPress={handleCategoryPress}
      />
    );
  };

  // --- Main content ---
  const renderContent = () => {
    if (productsLoading || vendorsLoading || (isLocationLoading && !userLocation)) {
      return (
        <View style={allStyles.loadingContainer as ViewStyle}>
          <ActivityIndicator size="large" color={Colors.swiggyOrange} />
          <Text style={allStyles.loadingText as TextStyle}>
            {isLocationLoading
              ? "Finding your location..."
              : "Loading products..."}
          </Text>
        </View>
      );
    }

    if (locationError) {
      const safeErrorMsg =
        typeof locationError === "string"
          ? locationError
          : (locationError as any)?.message || JSON.stringify(locationError);

      return (
        <View style={allStyles.messageContainer as ViewStyle}>
          <Text style={allStyles.messageTitle as TextStyle}>
            Location Error
          </Text>
          <Text style={allStyles.messageText as TextStyle}>{safeErrorMsg}</Text>
          <TouchableOpacity
            onPress={handleAddCurrentLocation}
            style={allStyles.retryButton as ViewStyle}
          >
            <Text style={allStyles.retryButtonText as TextStyle}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (inRangeProducts.length === 0 && userLocation)
      return (
        <View style={allStyles.messageContainer}>
          <Text style={allStyles.messageTitle}>No Products Available!</Text>
          <Text style={allStyles.messageText}>
            Looks like no products are currently available in your area.
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            style={allStyles.retryButton as ViewStyle}
          >
            <Text style={allStyles.retryButtonText as TextStyle}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );

    return (
      <ScrollView
        style={allStyles.mainContentScrollView as ViewStyle}
        contentContainerStyle={[
          allStyles.contentContainer as ViewStyle,
          !isCartEmpty && { paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.swiggyOrange}
            colors={[Colors.swiggyOrange]}
          />
        }
        onScroll={handleRecommendedScroll}
        scrollEventThrottle={16}
      >
        <View style={allStyles.bannerWrapper as ViewStyle}>
          <ImageBanner imageUrl={image1} onPress={handleAdPress1} />
          {renderCategoryBar()}
        </View>

        {/* Top Deals Section */}
        {topDeals.length > 0 && (
          <ImageBackground
            source={image}
            style={allStyles.horizontalSectionBackground as ViewStyle}
            imageStyle={allStyles.imageBackgroundStyle}
            resizeMode="cover"
          >
            <View style={allStyles.contentOverlay}>
              <SectionHeader
                title="Top Deals"
                onPress={() => handleSeeAllPress("Top Deals")}
                textStyle={{ color: Colors.white }}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                allStyles.horizontalScrollContainer as ViewStyle
              }
              onScrollEndDrag={(event) => onScrollEnd(event, "Top Deals")}
            >
              {topDeals.map((product) => (
                <View
                  key={product._id}
                  style={allStyles.horizontalItemContainer as ViewStyle}
                >
                  <NewProductCard1
                    product={product}
                    isVendorOffline={false}
                    isVendorOutOfRange={false}
                  />
                </View>
              ))}
            </ScrollView>
          </ImageBackground>
        )}

        {/* Nearby Shops Section */}
        {uniqueShops.length > 0 && (
          <View style={allStyles.horizontalSection as ViewStyle}>
            <SectionHeader
              title="Near Shops"
              onPress={() => handleSeeAllPress("Nearby Shops")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                allStyles.shopHorizontalScrollContainer as ViewStyle
              }
              onScrollEndDrag={(event) => onScrollEnd(event, "Nearby Shops")}
            >
              {uniqueShops.slice(0, 8).map((shop, index) => (
                <View
                  key={index}
                  style={[
                    allStyles.shopCardHorizontalWrapper as ViewStyle,
                    { paddingHorizontal: 5 },
                  ]}
                >
                  <ShopCard shop={shop} onPress={() => handleShopPress(shop)} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular Brands Section */}
        {uniqueBrands.length > 0 && (
          <ImageBackground
            source={image2}
            style={allStyles.brandSectionBackground as ViewStyle}
            imageStyle={allStyles.brandImageBackgroundStyle}
            resizeMode="cover"
          >
            <View style={allStyles.contentOverlay}>
              <SectionHeader
                title="Popular Brand"
                onPress={() => handleSeeAllPress("Popular Brands")}
                textStyle={{ color: Colors.white }}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                allStyles.horizontalScrollContainer as ViewStyle
              }
              onScrollEndDrag={(event) => onScrollEnd(event, "Popular Brands")}
            >
              {uniqueBrands.slice(0, 4).map((brand, index) => {
                const productForBrand = inRangeProducts.find(
                  (p) => p.brandName === brand.name,
                );
                if (!productForBrand) return null;
                const vendorForProduct = inRangeVendors.find(
                  (v) => v._id === productForBrand.vendorId,
                );
                const isVendorOffline = vendorForProduct
                  ? !vendorForProduct.isOnline
                  : false;

                return (
                  <View
                    key={index}
                    style={allStyles.horizontalItemContainer as ViewStyle}
                  >
                    <NewProductCard1
                      product={productForBrand}
                      isVendorOffline={isVendorOffline}
                      isVendorOutOfRange={false}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </ImageBackground>
        )}

        {/* Recommended Products Section */}
        {recommendedProducts.length > 0 && (
          <View style={allStyles.gridSection as ViewStyle}>
            <SectionHeader title="Recommended Products" />
            <View style={allStyles.productGridContainer as ViewStyle}>
              {recommendedProducts
                .slice(0, numRecommendedProducts)
                .map((product) => {
                  if (!product) return null;

                  const vendor = inRangeVendors.find(
                    (v) => v._id === product.vendorId,
                  );
                  const isVendorOffline = vendor ? !vendor.isOnline : false;

                  return (
                    <View
                      key={product._id}
                      style={allStyles.itemContainer3Col as ViewStyle}
                    >
                      <NewProductCard2
                        product={product}
                        isVendorOffline={isVendorOffline}
                        isVendorOutOfRange={false}
                      />
                    </View>
                  );
                })}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // ==============================================================
  // RENDER
  // ==============================================================
  return (
    <SafeAreaView
      style={allStyles.safeArea as ViewStyle}
      edges={["top", "left", "right"]}
    >
      <Image
        source={backgroundImage}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
        blurRadius={Platform.OS === "ios" ? 10 : 3}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(245, 246, 248, 0.88)" },
        ]}
      />

      <View style={allStyles.container as ViewStyle}>
        <View style={allStyles.mainHeader}>
          <View style={allStyles.headerTopRow}>
            {/* Location Bar */}
            <TouchableOpacity
              style={allStyles.locationSelector}
              activeOpacity={0.7}
              onPress={() => setShowAddressModal(true)}
            >
              <View style={allStyles.locationIconWrapper}>
                <Ionicons
                  name="location"
                  size={26}
                  color={Colors.swiggyOrange}
                />
              </View>
              <View style={allStyles.locationTextWrapper}>
                <View style={allStyles.locationTitleRow}>
                  <Text style={allStyles.locationTitle}>
                    {selectedAddress?.type ||
                      (userLocation ? "Current Location" : "Select Location")}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={Colors.darkText}
                  />
                </View>
                <Text style={allStyles.locationSubtitle} numberOfLines={1}>
                  {selectedAddress?.addressString ||
                    (userLocation
                      ? "Using GPS location"
                      : "Click here to select an address")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={allStyles.profileButton}
              onPress={handleProfilePress}
            >
              <Ionicons
                name="person-circle-outline"
                size={38}
                color={Colors.darkText}
              />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={allStyles.searchBarContainer}>
            <TouchableOpacity
              onPress={handleSearchPress}
              style={allStyles.searchBar}
              activeOpacity={0.9}
            >
              <View style={allStyles.searchIconGroup}>
                <Ionicons name="search" size={20} color={Colors.swiggyOrange} />
                <Text style={allStyles.searchPlaceholder}>
                  Search for "Biryani"
                </Text>
              </View>
              <View style={allStyles.searchActionsGroup}>
                <View style={allStyles.verticalDivider} />
                <Ionicons
                  name="mic-outline"
                  size={20}
                  color={Colors.swiggyOrange}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {renderContent()}
      </View>

      {/* 🔥 Address Modal */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onSelectAddress={handleSelectAddress}
        onAddAddress={handleAddCurrentLocation}
        selectedAddress={selectedAddress}
        addresses={addresses}
        isLoading={isLocating || isLocationLoading}
        onOpenMap={handleOpenMapPicker}
      />

      {/* 🔥 AddAddressScreen as full-screen modal */}
      <Modal
        visible={showAddAddress}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          // Allow closing only if an address already exists
          if (selectedAddress || addresses.length > 0) {
            setShowAddAddress(false);
          } else {
            Alert.alert("Location Required", "Please select a delivery location.");
          }
        }}
      >
        <AddAddressScreen
          onClose={() => {
            if (selectedAddress || addresses.length > 0) {
              setShowAddAddress(false);
            } else {
              Alert.alert("Location Required", "Please select a delivery location.");
            }
          }}
          onLocationSelect={handleLocationFromAddAddress}
        />
      </Modal>
    </SafeAreaView>
  );
};

// ==============================================================
// STYLES
// ==============================================================
const allStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, backgroundColor: "transparent" },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
  },
  mainHeader: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  locationIconWrapper: { marginRight: 6 },
  locationTextWrapper: { flex: 1 },
  locationTitleRow: { flexDirection: "row", alignItems: "center" },
  locationTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.darkText,
    marginRight: 6,
    letterSpacing: -0.5,
  },
  locationSubtitle: {
    fontSize: 13,
    color: Colors.grayText,
    marginTop: 2,
    fontWeight: "500",
  },
  profileButton: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchBarContainer: { width: "100%" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  searchIconGroup: { flexDirection: "row", alignItems: "center" },
  searchPlaceholder: {
    color: Colors.grayText,
    marginLeft: 10,
    fontSize: 15,
    fontWeight: "600",
  },
  searchActionsGroup: { flexDirection: "row", alignItems: "center" },
  verticalDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.borderGray,
    marginHorizontal: 12,
  },

  // ---- Content styles ----
  mainContentScrollView: { flex: 1, backgroundColor: "transparent" },
  contentContainer: { paddingBottom: 60 },
  bannerWrapper: { position: "relative", marginBottom: 0, width: "100%" },
  imageBannerContainer: { width: "100%", height: 200, marginBottom: 0 },
  imageBanner: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  categoriesSection: {
    position: "absolute",
    bottom: -40,
    left: 0,
    right: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  categoriesScrollContainer: { paddingHorizontal: 8, paddingBottom: 5 },
  categoryCard: {
    width: 80,
    alignItems: "center",
    marginHorizontal: 4,
    borderRadius: 8,
    paddingVertical: 5,
    height: 80,
    justifyContent: "space-between",
    zIndex: 1,
  },
  categoryImageWrapper: {
    width: 70,
    height: 70,
    borderRadius: 56,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  categoryImageSmall: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    borderRadius: 0,
  },
  categoryNameText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    color: Colors.dark,
    marginBottom: 5,
    marginTop: 9,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: Colors.dark },
  seeAllButton: { flexDirection: "row", alignItems: "center" },
  seeAllText: { color: Colors.grayText, marginRight: 2 },
  horizontalSection: {
    marginTop: 10,
    backgroundColor: Colors.white,
    paddingVertical: 10,
  },
  horizontalSectionBackground: {
    marginTop: 20,
    paddingVertical: 10,
    paddingBottom: 60,
    minHeight: 50,
    width: "100%",
  },
  brandSectionBackground: {
    marginTop: 10,
    paddingVertical: 10,
    paddingBottom: 20,
    minHeight: 50,
    width: "100%",
  },
  imageBackgroundStyle: { height: 400 },
  brandImageBackgroundStyle: { height: 290 },
  contentOverlay: {},
  horizontalScrollContainer: { paddingHorizontal: 10 },
  shopHorizontalScrollContainer: {
    paddingBottom: 5,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  shopCardHorizontalWrapper: {
    width: width * 0.88,
    marginRight: 10,
    marginBottom: 10,
  },
  horizontalItemContainer: {
    width: width * 1,
    marginRight: 10,
    height: width * 0.67,
  },
  gridSection: {
    marginTop: 10,
    backgroundColor: "transparent",
    paddingVertical: 10,
  },
  productGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: 10,
  },
  itemContainer3Col: {
    width: "100%",
    marginBottom: 15,
    marginHorizontal: 0,
    paddingHorizontal: 5,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: Colors.dark },
  messageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    minHeight: 300,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.dark,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    textAlign: "center",
    color: Colors.grayText,
    marginBottom: 5,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.orange,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: { color: Colors.white, fontSize: 16, fontWeight: "bold" },
});

export default HomeScreen;