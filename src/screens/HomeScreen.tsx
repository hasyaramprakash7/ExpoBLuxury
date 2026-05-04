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
} from "../features/locationSlice";

// Custom Components
import NewProductCard1 from "../components/NewProductCard10";
import NewProductCard2 from "../components/NewProductCard11";
import ShopCard from "./ShopCard";
import NewArrivals from "./NewArrivals";

// Local Assets
const image = require("../../assets/b4.jpg");
const image1 = require("../../assets/WhatsApp Image 2026-01-19 at 2.30.39 AM.jpeg");
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

// ========================================================
// 🔥 GLOBAL LOCKS TO PREVENT INFINITE UNMOUNT/REMOUNT LOOPS
// ========================================================
let globalLastFetchedCoords: string | null = null;
let hasBootstrappedAddresses = false;

const HomeScreen: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<AppNavigationProp>();

  // --- UI State ---
  const [isAddressModalVisible, setAddressModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [numRecommendedProducts, setNumRecommendedProducts] = useState(10);
  const [reentryTrigger, setReentryTrigger] = useState(0);

  // --- Address Form State ---
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    type: "Home" as "Home" | "Work" | "Other",
    addressString: "",
    latitude: 0,
    longitude: 0,
  });

  // Redux State
  const {
    location: userLocation,
    savedAddresses,
    selectedAddress,
    permissionGranted,
    loading: isLocationLoading,
    addressActionLoading,
    error: locationError,
  } = useSelector((state: RootState) => state.location);

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

  useFocusEffect(
    useCallback(() => {
      setReentryTrigger((prev) => prev + 1);
    }, []),
  );

  useEffect(() => {
    if (token && savedAddresses.length === 0 && !hasBootstrappedAddresses) {
      console.log("[HomeScreen] Fetching addresses from API...");
      hasBootstrappedAddresses = true;
      dispatch(fetchUserAddresses(token));
    }
  }, [dispatch, token, savedAddresses.length]);

  useEffect(() => {
    if (
      !isLocationLoading &&
      savedAddresses.length === 0 &&
      !isAddressModalVisible &&
      token
    ) {
      console.log(
        "[HomeScreen] FORCE OPENING Address Modal - User has no active location context in DB.",
      );
      setAddressModalVisible(true);
    }
  }, [isLocationLoading, savedAddresses.length, token, isAddressModalVisible]);

  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const currentCoords = `${userLocation.latitude.toFixed(4)},${userLocation.longitude.toFixed(4)}`;

      if (globalLastFetchedCoords !== currentCoords) {
        console.log(
          `[HomeScreen] New GPS detected. Fetching H3 Data for Lat: ${userLocation.latitude}`,
        );
        globalLastFetchedCoords = currentCoords;

        dispatch(
          fetchNearbyVendors({
            lat: userLocation.latitude,
            lng: userLocation.longitude,
          }),
        );
        dispatch(fetchAllVendorProducts());
      }
    }
  }, [dispatch, userLocation?.latitude, userLocation?.longitude]);

  const handleRequestLocation = async () => {
    dispatch(fetchLocationStart());
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dispatch(
          fetchLocationFailure("Permission to access location was denied."),
        );
        Alert.alert("Permission Required", "This app needs location access.");
        return;
      }
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      dispatch(
        fetchLocationSuccess({
          latitude: locationData.coords.latitude,
          longitude: locationData.coords.longitude,
        }),
      );
    } catch (locError) {
      console.error("Error fetching user location:", locError);
      dispatch(fetchLocationFailure("Could not get your location."));
    }
  };

  const onRefresh = useCallback(async () => {
    console.log("[HomeScreen] Pull-to-Refresh Triggered");
    setIsRefreshing(true);

    globalLastFetchedCoords = null;
    hasBootstrappedAddresses = false;

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
    const filteredProducts: Product[] = (allProducts || []).filter(
      (product: Product) => inRangeVendorIds.includes(product.vendorId),
    );

    productCache.current = filteredProducts;
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
    if (inRangeProducts.length === 0) return [];
    const brandsMap = new Map<string, { name: string; imageUrl?: string }>();
    inRangeProducts.forEach((product) => {
      if (product.brandName && !brandsMap.has(product.brandName)) {
        const firstImageProduct = inRangeProducts.find(
          (p) =>
            p.brandName === product.brandName &&
            p.images &&
            p.images.length > 0,
        );
        brandsMap.set(product.brandName, {
          name: product.brandName,
          imageUrl: firstImageProduct?.images?.[0],
        });
      }
    });
    return Array.from(brandsMap.values());
  }, [inRangeProducts]);

  const allUniqueCategories: CategoryDisplay[] = useMemo(() => {
    if (categoryCache.current.length > 0 && !isRefreshing)
      return categoryCache.current;
    if (inRangeProducts.length === 0) return [];
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

  const handleSelectAddress = (address: SavedAddress) => {
    dispatch(setSelectedAddress(address));
    setAddressModalVisible(false);
  };

  const handleInitiateAddAddress = async () => {
    if (!token) {
      Alert.alert("Authentication Required", "Please login to add an address.");
      return;
    }

    try {
      dispatch(fetchLocationStart());
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dispatch(fetchLocationFailure("Permission denied"));
        Alert.alert(
          "Permission Required",
          "We need location access to fetch your address.",
        );
        return;
      }

      console.log("[HomeScreen] Fetching GPS Coordinates...");
      let locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const exactLat = parseFloat(locationData.coords.latitude.toFixed(8));
      const exactLng = parseFloat(locationData.coords.longitude.toFixed(8));

      console.log("[HomeScreen] Reverse Geocoding Coordinates...");
      let geocode = await Location.reverseGeocodeAsync({
        latitude: exactLat,
        longitude: exactLng,
      });
      let generatedAddressString = "";

      if (geocode.length > 0) {
        const g = geocode[0];
        generatedAddressString = [
          g.name,
          g.street,
          g.city || g.district,
          g.region,
          g.postalCode,
        ]
          .filter(Boolean)
          .join(", ");
      }

      setAddressForm({
        type: "Home",
        addressString: generatedAddressString,
        latitude: exactLat,
        longitude: exactLng,
      });

      dispatch(
        fetchLocationSuccess({ latitude: exactLat, longitude: exactLng }),
      );
      setIsEditingAddress(true);
    } catch (error) {
      dispatch(fetchLocationFailure("Error fetching location"));
      Alert.alert("Error", "Could not fetch your exact location.");
      console.error(error);
    }
  };

  const submitNewAddressForm = async () => {
    if (!addressForm.addressString.trim()) {
      Alert.alert("Required", "Address details cannot be empty.");
      return;
    }

    try {
      await dispatch(
        saveUserAddress({ token, addressData: addressForm }),
      ).unwrap();
      setIsEditingAddress(false);
      setAddressModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Could not save address to the database.");
      console.error(error);
    }
  };

  const closeFormAndGoBack = () => {
    setIsEditingAddress(false);
  };

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
    navigation.navigate("UserPropertyListScreen" as never);
  const handleFreeShippingBannerPress = () =>
    navigation.navigate("InsuranceProductsAndDetails" as never);
  const handleSearchPress = () => navigation.navigate("Search" as never);
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

  const renderAddressModal = () => (
    <Modal
      visible={isAddressModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        if (savedAddresses.length > 0) setAddressModalVisible(false);
      }}
    >
      <View style={allStyles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => {
            if (savedAddresses.length > 0) {
              setAddressModalVisible(false);
            } else {
              Alert.alert(
                "Required",
                "Please add a delivery location to continue.",
              );
            }
          }}
        />

        <View style={allStyles.bottomSheet}>
          {(isLocationLoading || addressActionLoading) && (
            <View style={allStyles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.swiggyOrange} />
            </View>
          )}

          <View style={allStyles.bottomSheetHandle} />

          <View style={allStyles.sheetHeader}>
            <Text style={allStyles.sheetTitle}>
              {isEditingAddress ? "Confirm Address" : "Select a location"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (isEditingAddress) {
                  closeFormAndGoBack();
                } else if (savedAddresses.length > 0) {
                  setAddressModalVisible(false);
                } else {
                  Alert.alert("Required", "Please add a delivery location.");
                }
              }}
            >
              <Ionicons name="close" size={24} color={Colors.darkText} />
            </TouchableOpacity>
          </View>

          {isEditingAddress ? (
            <ScrollView
              style={allStyles.addressList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20 }}
            >
              <Text style={allStyles.inputLabel}>
                Complete Address / Landmark
              </Text>
              <TextInput
                style={allStyles.addressInput}
                value={addressForm.addressString}
                onChangeText={(text) =>
                  setAddressForm({ ...addressForm, addressString: text })
                }
                placeholder="House No, Building, Landmark..."
                multiline
              />

              <Text style={allStyles.inputLabel}>Save As</Text>
              <View style={allStyles.typeRow}>
                {["Home", "Work", "Other"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      allStyles.typeBadge,
                      addressForm.type === type && allStyles.typeBadgeActive,
                    ]}
                    onPress={() =>
                      setAddressForm({ ...addressForm, type: type as any })
                    }
                  >
                    <Text
                      style={[
                        allStyles.typeBadgeText,
                        addressForm.type === type &&
                          allStyles.typeBadgeTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={allStyles.coordText}>
                GPS: {addressForm.latitude}, {addressForm.longitude}
              </Text>

              <TouchableOpacity
                style={[
                  allStyles.addAddressButton,
                  { marginTop: 30, backgroundColor: Colors.swiggyOrange },
                ]}
                onPress={submitNewAddressForm}
              >
                <Text
                  style={[
                    allStyles.addAddressButtonText,
                    { color: Colors.white, marginLeft: 0 },
                  ]}
                >
                  Save & Proceed
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView
              style={allStyles.addressList}
              showsVerticalScrollIndicator={false}
            >
              {!permissionGranted && (
                <View style={allStyles.permissionBanner}>
                  <View style={allStyles.permissionTextContainer}>
                    <View style={allStyles.permissionRow}>
                      <Ionicons
                        name="alert-circle"
                        size={18}
                        color={Colors.redAlert}
                      />
                      <Text style={allStyles.permissionTitle}>
                        Device location is off
                      </Text>
                    </View>
                    <Text style={allStyles.permissionSubtitle}>
                      Turn on device location to ensure accurate delivery
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={allStyles.grantButton}
                    onPress={handleInitiateAddAddress}
                  >
                    <Text style={allStyles.grantButtonText}>Enable</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={allStyles.currentLocationContainer}
                onPress={() => {
                  console.log(
                    "[HomeScreen] 'Use Current Location' selected - Navigating to Save Form",
                  );
                  handleInitiateAddAddress();
                }}
              >
                <View style={allStyles.currentLocationIcon}>
                  <Ionicons
                    name="locate"
                    size={22}
                    color={Colors.swiggyOrange}
                  />
                </View>
                <View style={allStyles.addressInfo}>
                  <Text style={allStyles.currentLocationTitle}>
                    Use my current location
                  </Text>
                  <Text style={allStyles.addressString} numberOfLines={1}>
                    Fetch GPS & save delivery address
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.grayText}
                />
              </TouchableOpacity>

              <View style={allStyles.sectionDivider} />

              {savedAddresses.length > 0 && (
                <>
                  <Text style={allStyles.savedAddressesHeader}>
                    SAVED ADDRESSES
                  </Text>
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddress?.id === addr.id;
                    let iconName = "location";
                    if (addr.type === "Home") iconName = "home";
                    if (addr.type === "Work") iconName = "briefcase";

                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[
                          allStyles.addressItem,
                          isSelected && allStyles.addressItemSelected,
                        ]}
                        onPress={() => handleSelectAddress(addr)}
                      >
                        <View style={allStyles.iconContainer}>
                          <Ionicons
                            name={iconName as any}
                            size={22}
                            color={
                              isSelected ? Colors.swiggyOrange : Colors.darkText
                            }
                          />
                        </View>
                        <View style={allStyles.addressInfo}>
                          <Text
                            style={[
                              allStyles.addressType,
                              isSelected && { color: Colors.swiggyOrange },
                            ]}
                          >
                            {addr.type}
                          </Text>
                          <Text
                            style={allStyles.addressString}
                            numberOfLines={2}
                          >
                            {addr.addressString}
                          </Text>
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
              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          {!isEditingAddress && (
            <View style={allStyles.addAddressFooter}>
              <TouchableOpacity
                style={allStyles.addAddressButton}
                onPress={handleInitiateAddAddress}
              >
                <Ionicons name="add" size={20} color={Colors.swiggyOrange} />
                <Text style={allStyles.addAddressButtonText}>
                  Add new address
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const isLoading =
    productsLoading ||
    vendorsLoading ||
    (isLocationLoading && !isAddressModalVisible);

  const renderCategoryBar = () => {
    if (allUniqueCategories.length === 0) return null;
    return (
      <StaticCategoryBar
        categories={allUniqueCategories}
        handleCategoryPress={handleCategoryPress}
      />
    );
  };

  const renderContent = () => {
    if (isLoading)
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

    // 🔥 THE FIX: Safely stringify locationError before rendering
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
            onPress={handleInitiateAddAddress}
            style={allStyles.retryButton as ViewStyle}
          >
            <Text style={allStyles.retryButtonText as TextStyle}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (inRangeProducts.length === 0 && userLocation)
      return (
        <View style={allStyles.messageContainer as ViewStyle}>
          <Text style={allStyles.messageTitle as TextStyle}>No Prdts Nby!</Text>
          <Text style={allStyles.messageText as TextStyle}>
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
                                            <NewArrivals/>

        <TouchableOpacity
          style={allStyles.freeShippingBanner as ViewStyle}
          onPress={handleFreeShippingBannerPress}
        >
          <View style={allStyles.bannerTextContainer as ViewStyle}>
            <Text style={allStyles.bannerTitle as TextStyle}>
              <Text style={allStyles.bannerTitleBold as TextStyle}>
                TATA ALA 10% Returns
              </Text>
            </Text>
            <Text style={allStyles.bannerSubtitle as TextStyle}>
              Unlock exclusive perks with Savings Booster
            </Text>
          </View>
          <Ionicons
            name="arrow-forward-outline"
            size={24}
            color={Colors.darkText}
          />
        </TouchableOpacity>

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

        {recommendedProducts.length > 0 && (
          <View style={allStyles.gridSection as ViewStyle}>
            <SectionHeader title="Recommended Products" />
            <View style={allStyles.productGridContainer as ViewStyle}>
              {recommendedProducts
                .slice(0, numRecommendedProducts)
                .map((product) => {
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
            <TouchableOpacity
              style={allStyles.locationSelector}
              activeOpacity={0.7}
              onPress={() => setAddressModalVisible(true)}
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
                    "Click here to select an address"}
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
      {renderAddressModal()}
    </SafeAreaView>
  );
};

// --- Stylesheet Definition ---
const allStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, backgroundColor: "transparent" },
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.sheetOverlay,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: Colors.sheetBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: height * 0.8,
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#D1D5DB",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.darkText,
    letterSpacing: -0.3,
  },
  addressList: { maxHeight: height * 0.55 },
  permissionBanner: {
    backgroundColor: "#FEE2E2",
    margin: 20,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  permissionTextContainer: { flex: 1, marginRight: 12 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  permissionTitle: {
    color: Colors.redAlert,
    fontWeight: "700",
    fontSize: 15,
    marginLeft: 6,
  },
  permissionSubtitle: { color: "#991B1B", fontSize: 13, lineHeight: 18 },
  grantButton: {
    backgroundColor: Colors.white,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  grantButtonText: { color: Colors.redAlert, fontWeight: "bold", fontSize: 13 },
  currentLocationContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: Colors.white,
    marginTop: 10,
  },
  currentLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(252, 128, 25, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.swiggyOrange,
    marginBottom: 2,
  },
  sectionDivider: { height: 8, backgroundColor: "#F0F0F0", width: "100%" },
  savedAddressesHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.grayText,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  addressItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderGray,
  },
  addressItemSelected: { backgroundColor: "rgba(52, 199, 89, 0.04)" },
  iconContainer: { width: 30, alignItems: "flex-start" },
  addressInfo: { flex: 1, paddingRight: 10 },
  addressType: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.darkText,
    marginBottom: 4,
  },
  addressString: { fontSize: 13, color: Colors.grayText, lineHeight: 18 },
  addAddressFooter: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 10,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addAddressButtonText: {
    color: Colors.swiggyOrange,
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },

  // Edit Form Styles
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.darkText,
    marginBottom: 8,
    marginTop: 15,
  },
  addressInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
    color: Colors.darkText,
  },
  typeRow: { flexDirection: "row", marginTop: 5 },
  typeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderGray,
    marginRight: 10,
    backgroundColor: Colors.white,
  },
  typeBadgeActive: {
    backgroundColor: "rgba(252, 128, 25, 0.1)",
    borderColor: Colors.swiggyOrange,
  },
  typeBadgeText: { fontSize: 14, color: Colors.grayText, fontWeight: "600" },
  typeBadgeTextActive: { color: Colors.swiggyOrange },
  coordText: {
    fontSize: 12,
    color: Colors.grayText,
    marginTop: 25,
    fontStyle: "italic",
  },

  // Page Content Styles
  mainContentScrollView: { flex: 1, backgroundColor: "transparent" },
  contentContainer: { paddingBottom: 60 },
  bannerWrapper: { position: "relative", marginBottom: 0, width: "100%" },
  freeShippingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    marginHorizontal: 0,
    marginTop: 43,
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.borderGray,
  },
  bannerTextContainer: { flex: 1 },
  bannerTitle: { fontSize: 16, color: Colors.dark },
  bannerTitleBold: { fontWeight: "bold", color: Colors.orange },
  bannerSubtitle: { fontSize: 12, color: Colors.grayText },
  imageBannerContainer: { width: "100%", height: 90, marginBottom: 0 },
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
    marginTop: 10,
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
