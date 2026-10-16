// App.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  Platform,
  TouchableOpacity,
  Modal,
  Linking,
  Text as RNText,
} from "react-native";
import { Provider, useDispatch, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import Constants from "expo-constants";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import Toast, { BaseToast, ErrorToast } from "react-native-toast-message";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Font from "expo-font";
import * as SplashScreenExpo from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import * as Notifications from "expo-notifications";
import * as Contacts from "expo-contacts";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { AudioModule } from "expo-audio";
import { useShareIntent } from "expo-share-intent";

import {
  setupNotifications,
  setupLeadNotificationListener,
} from "./src/userScreens/utils/NotificationHelper";
import { store, persistor, RootState, AppDispatch } from "./src/app/store";
import RootGate from "./src/app/RootGate";

// ─────────────────────────────────────────────────────────────
// SAFE SOCKET IMPORTS
// ─────────────────────────────────────────────────────────────
import * as SocketModule from "./src/userScreens/utils/socket";
import * as UseSocketModule from "./src/hooks/useSocket";

const safeConnectUserToSocket = (
  userId: string,
  groupIds: string[] = []
): void => {
  try {
    const fn =
      (SocketModule as any)?.connectUserToSocket ??
      (UseSocketModule as any)?.connectUserToSocket;
    if (typeof fn === "function") {
      fn(userId, groupIds);
    } else {
      console.warn("⚠️ connectUserToSocket not available on socket module");
    }
  } catch (e) {
    console.warn("⚠️ connectUserToSocket failed:", e);
  }
};

const safeDisconnectUserFromSocket = (userId: string): void => {
  try {
    const fn =
      (SocketModule as any)?.disconnectUserFromSocket ??
      (UseSocketModule as any)?.disconnectUserFromSocket;
    if (typeof fn === "function") {
      fn(userId);
    }
  } catch (e) {
    console.warn("⚠️ disconnectUserFromSocket failed:", e);
  }
};

const safeCleanupSocket = (): void => {
  try {
    const fn =
      (UseSocketModule as any)?.cleanupSocket ??
      (SocketModule as any)?.cleanupSocket ??
      (SocketModule as any)?.default?.cleanupSocket;
    if (typeof fn === "function") {
      fn();
    }
  } catch (e) {
    console.warn("⚠️ cleanupSocket failed:", e);
  }
};

import {
  fetchUserProfile,
  fetchAppConfig,
} from "./src/features/user/authSlice";
import { fetchVendorProfile } from "./src/features/vendor/vendorAuthSlice";
import { fetchCart } from "./src/features/cart/cartSlice";
import {
  fetchDeliveryBoyProfile,
  logoutDeliveryBoy,
} from "./src/features/deliveryBoy/deliveryBoyOrderSlice";

// --- Screen Imports ---
import LoginScreen from "./src/userScreens/LoginScreen";
import SignupScreen from "./src/userScreens/SignupScreen";
import UserTabNavigator from "./src/navigation/UserTabNavigator";
import UserProfileScreen from "./src/userScreens/UserProfileScreen";
import UserOrderScreen from "./src/userScreens/UserOrderScreen";
import VendorLoginScreen from "./src/vendorScreens/VendorLoginScreen";
import SignupVendorScreen from "./src/vendorScreens/SignupVendorScreen";
import VendorDashboardScreen from "./src/vendorScreens/VendorDashboardScreen";
import VendorProductCRUDScreen from "./src/vendorScreens/VendorProductCRUD";
import VendorOrderList from "./src/vendorScreens/VendorOrderList";
import AllDeliveryBoys from "./src/vendorScreens/AllDeliveryBoys";
import WhatsappInvoiceSender from "./src/vendorScreens/WhatsappInvoiceSender";
import DeliveryBoyLoginScreen from "./src/deliveryBoyScreens/DeliveryBoyLoginScreen";
import DeliveryBoySignupScreen from "./src/deliveryBoyScreens/DeliveryBoySignupScreen";
import DeliveryBoyDashboardScreen from "./src/deliveryBoyScreens/DeliveryBoyDashboardScreen";
import DeliveryBoyOrdersPage from "./src/deliveryBoyScreens/DeliveryBoyOrders";
import ProductDetailsScreen from "./src/components/ProductDetailsScreen";
import OrderScreen from "./src/screens/OrderScreen";
import CartScreen from "./src/screens/Cart";
import Chatscreen from "./src/screens/ChatScreen";
import ShopListings from "./src/screens/ShopListings";
import ShopReviewsScreen from "./src/screens/ShopReviewsScreen";

import ShopDetails from "./src/screens/ShopDetails";
import CategoryShopsScreen from "./src/screens/CategoryShopsScreen";
import CategoryProductsScreen from "./src/screens/CategoryProductsScreen";
import ShopProductsScreen from "./src/screens/ShopProductsScreen";
import BrandProductsScreen from "./src/screens/BrandProductsScreen";
import ProductSearchScreen from "./src/screens/ProductSearchScreen";
import MyCategoriesScreen from "./src/screens/MyCategoriesScreen";
import InsuranceProductCRUDScreen from "./src/vendorScreens/InsuranceProductCRUDScreen";
import VendorAppointmentsList from "./src/vendorScreens/VendorAppointmentsList";
import InsuranceProductsAndDetails from "./src/screens/InsuranceProductsAndDetails";
import ProductDetailScreen from "./src/components/ProductDetailScreen";
import ProductDetailScreen10 from "./src/components/ProductDetailScreen10";
import FloatingCartButton from "./src/userScreens/utils/FloatingCartButton";
import VendorProductViewsScreen from "./src/vendorScreens/VendorProductViewsScreen";
import UserRentalListScreen from "./src/screens/UserRentalListScreen";
import RentalDetailScreen from "./src/screens/RentalDetailScreen";
import PropertyCRUDScreen from "./src/vendorScreens/PropertyCRUDScreen";
import PropertyDetailScreen from "./src/screens/PropertyDetailScreen";
import VendorChatScreen from "./src/vendorScreens/VendorChatScreen";
import UserPropertyListScreen from "./src/screens/UserPropertyListScreen";
import AddressScreen from "./src/userScreens/AddressScreen";
import RentalCRUDScreen from "./src/screens/RentalCRUDScreen";
import SubscriptionChoiceScreen from "./src/vendorScreens/SubscriptionChoiceScreen";
import SubscriptionManagementScreen from "./src/vendorScreens/SubscriptionManagementScreen";
import SubscriptionPendingScreen from "./src/vendorScreens/SubscriptionPendingScreen";

import HomeScreen from "./src/screens/HomeScreen";
import Search from "./src/screens/UserRentalListScreen";
import AdListScreen from "./src/screens/AdListScreen";
import WebViewScreen from "./src/screens/WebViewScreen";
import AllCategoriesScreen from "./src/screens/AllCategoriesScreen";
import AddAddressScreen from "./src/screens/AddAddressScreen";

import AdManagementScreen from "./src/screens/AdManagementScreen";
import AdGroupDetailScreen from "./src/screens/AdGroupDetailScreen";

import MessagesScreen from "./src/screens/MessagesScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import StoryViewerScreen from "./src/screens/StoryViewerScreen";
import HashtagPostsScreen from "./src/screens/HashtagPostsScreen";
import SearchScreen from "./src/screens/SearchScreen";

import VendorLeadsScreen from "./src/vendorScreens/VendorLeadsScreen";
import {
  navigationRef,
  RootStackParamList,
} from "./src/userScreens/utils/navigationRef";

import VendorTabNavigator from "./src/navigation/VendorTabNavigator";

// ✅ Profile chooser
import ProfileChooserScreen from "./src/screens/ProfileChooserScreen";

// =========================================================================
// GLOBAL FONT & TYPOGRAPHY
// =========================================================================
const GLOBAL_FONT_FAMILY = "System";
if ((RNText as any).defaultProps == null) (RNText as any).defaultProps = {};
(RNText as any).defaultProps.allowFontScaling = true;

const originalRender = (RNText as any).render;
(RNText as any).render = function (...args: any[]) {
  const origin = originalRender.call(this, ...args);
  return React.cloneElement(origin, {
    style: [{ fontFamily: GLOBAL_FONT_FAMILY }, origin.props.style],
  });
};
// =========================================================================

SplashScreenExpo.preventAutoHideAsync();

const CURRENT_APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const PLAY_STORE_LINK =
  "https://play.google.com/store/apps/details?id=com.ram1234567890.BLuxury";
const APP_STORE_LINK = "https://apps.apple.com/us/app/your-app-id";

export const Colors = {
  luxuryBackground: "#0A0A0A",
  luxuryCard: "#1C1C1C",
  luxuryTextPrimary: "#E0E0E0",
  luxuryTextSecondary: "#B0B0B0",
  luxuryAccent: "#FFD700",
  luxuryError: "#FF6347",
  luxurySuccess: "#34C759",
  royalGreen: "#00A651",
  borderGray: "#DDDDDD",
};

const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: Colors.luxurySuccess,
        backgroundColor: Colors.luxuryCard,
        borderRadius: 12,
      }}
      text1Style={{ fontSize: 15, color: Colors.luxuryTextPrimary }}
      text2Style={{ fontSize: 13, color: Colors.luxuryTextSecondary }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: Colors.luxuryError,
        backgroundColor: Colors.luxuryCard,
        borderRadius: 12,
      }}
      text1Style={{ fontSize: 15, color: Colors.luxuryTextPrimary }}
      text2Style={{ fontSize: 13, color: Colors.luxuryTextSecondary }}
    />
  ),
};

const compareVersions = (v1: string, v2: string) => {
  const p1 = v1.split(".").map(Number);
  const p2 = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
};

/**
 * Reads the current active role directly from the Redux store.
 * RootGate guarantees session.activeRole is already decided by the
 * time AppNavigator's bootstrap effect runs, so this is safe to call.
 */
const getActiveRoleFromStore = (): string | null => {
  try {
    const s = store.getState() as RootState;
    return (s.session?.activeRole as string | null) ?? null;
  } catch {
    return null;
  }
};

const AppUpdateOverlay = () => {
  const appConfig = useSelector((state: RootState) => state.auth.appConfig);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (appConfig) {
      const latest =
        Platform.OS === "ios"
          ? appConfig.latestIOSVersion
          : appConfig.latestAndroidVersion;
      if (latest && compareVersions(latest, CURRENT_APP_VERSION) > 0) {
        setShowUpdate(true);
      }
    }
  }, [appConfig]);

  const handleUpdate = () =>
    Linking.openURL(Platform.OS === "ios" ? APP_STORE_LINK : PLAY_STORE_LINK);

  if (!showUpdate) return null;

  return (
    <Modal transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            backgroundColor: "#1C1C1C",
            padding: 25,
            borderRadius: 15,
            width: "85%",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#333",
          }}
        >
          <Ionicons
            name="cloud-download"
            size={60}
            color={Colors.luxuryAccent}
          />
          <Text
            style={{
              fontSize: 22,
              fontWeight: "bold",
              color: Colors.luxuryTextPrimary,
              marginTop: 15,
            }}
          >
            Update Required
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: Colors.luxuryTextSecondary,
              marginTop: 10,
              textAlign: "center",
              marginBottom: 25,
              lineHeight: 22,
            }}
          >
            A newer version of BLuxury is available. Please update the app to
            continue.
          </Text>
          <TouchableOpacity
            onPress={handleUpdate}
            style={{
              backgroundColor: Colors.luxuryAccent,
              paddingVertical: 14,
              paddingHorizontal: 30,
              borderRadius: 25,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: Colors.luxuryBackground,
              }}
            >
              Update Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const PermissionGate = ({ onComplete }: { onComplete: () => void }) => {
  const [loading, setLoading] = useState(false);
  const requestAll = async () => {
    setLoading(true);
    try {
      await Notifications.requestPermissionsAsync();
      await Location.requestForegroundPermissionsAsync();
      await Contacts.requestPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await AudioModule.requestRecordingPermissionsAsync();
      await AsyncStorage.setItem("permissionsGranted", "true");
      onComplete();
    } catch {
      await AsyncStorage.setItem("permissionsGranted", "true");
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={appStyles.gateContainer}>
      <View style={appStyles.gateIconContainer}>
        <Ionicons
          name="shield-checkmark"
          size={70}
          color={Colors.luxuryAccent}
        />
      </View>
      <Text style={appStyles.gateTitle}>Welcome to Bluxury!</Text>
      <Text style={appStyles.gateSubtitle}>
        To provide you with the best experience, we require a few permissions.
      </Text>
      <TouchableOpacity
        style={appStyles.gateButton}
        onPress={requestAll}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Colors.luxuryBackground} />
        ) : (
          <Text style={appStyles.gateButtonText}>Grant Access</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { token: vendorAuthToken, vendor } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const { deliveryBoy } = useSelector(
    (state: RootState) => state.deliveryBoyAuth
  );
  const { groups } = useSelector((state: RootState) => state.chat);
  const activeRole = useSelector(
    (state: RootState) => state.session?.activeRole ?? null
  );

  const hasHydrated = useSelector(
    (state: any) =>
      state.bootstrap?.hydrated ??
      state.session?.hasHydrated ??
      false
  );

  const [isInitializing, setIsInitializing] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [permissionsDone, setPermissionsDone] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  // Notification listeners
  useEffect(() => {
    const subs = setupLeadNotificationListener();
    return () => {
      subs?.foregroundSubscription?.remove();
      subs?.responseSubscription?.remove();
    };
  }, []);

  // Legacy socket connection (chat groups) — fully guarded
  useEffect(() => {
    const currentUserId = vendor?._id || user?._id || deliveryBoy?._id;
    if (currentUserId) {
      const myGroupIds = Array.isArray(groups)
        ? groups.map((g: any) => g?._id).filter(Boolean)
        : [];
      safeConnectUserToSocket(currentUserId, myGroupIds);
    }
    return () => {
      if (currentUserId) {
        safeDisconnectUserFromSocket(currentUserId);
      }
    };
  }, [user?._id, vendor?._id, deliveryBoy?._id, groups]);

  // Global socket cleanup on unmount — fully guarded
  useEffect(() => {
    return () => {
      safeCleanupSocket();
    };
  }, []);

  useEffect(() => {
    async function loadResourcesAndAuth() {
      try {
        await Font.loadAsync(Ionicons.font);
        setFontsLoaded(true);

        const permStatus = await AsyncStorage.getItem("permissionsGranted");
        if (permStatus === "true") setPermissionsDone(true);

        await setupNotifications();
        dispatch(fetchAppConfig() as any);

        // ✅ Read active role FIRST so we only hit role-specific endpoints
        const role = getActiveRoleFromStore();
        console.log(`[App/bootstrap] activeRole = '${role}'`);

        const [userToken, vendorToken, deliveryBoyToken] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("vendorToken"),
          SecureStore.getItemAsync("deliveryBoyToken"),
        ]);

        // ── Delivery Boy (only when its role is active) ──
        if (
          role === "deliveryBoy" &&
          deliveryBoyToken &&
          deliveryBoyToken !== "null"
        ) {
          await dispatch(fetchDeliveryBoyProfile() as any)
            .unwrap()
            .catch(() => dispatch(logoutDeliveryBoy()));
        }

        // ── User (only when user role is active) ──
        if (role === "user" && userToken && userToken !== "null") {
          await dispatch(fetchUserProfile() as any)
            .unwrap()
            .catch(() => {});
          dispatch(fetchCart() as any);
        }

        // ── Vendor (only when vendor role is active) ──
        if (role === "vendor" && vendorToken && vendorToken !== "null") {
          try {
            await dispatch(fetchVendorProfile() as any).unwrap();
          } catch (e) {
            console.warn(
              "⚠️ Vendor profile fetch failed — keeping cached vendor:",
              e
            );
          }
        }

        // If no role is decided yet (fresh install / both sessions present),
        // do NOT proactively fetch either profile. RootGate will decide the
        // role, and the corresponding navigator's screens will hydrate.
      } catch (e) {
        console.error("❌ loadResourcesAndAuth error:", e);
      } finally {
        setIsInitializing(false);
      }
    }
    loadResourcesAndAuth();
  }, [dispatch]);

  const onLayoutRootView = useCallback(async () => {
    if (!isInitializing && fontsLoaded) await SplashScreenExpo.hideAsync();
  }, [isInitializing, fontsLoaded]);

  if (isInitializing || !fontsLoaded || !hasHydrated) {
    return (
      <View style={appStyles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.luxuryAccent} />
        <Text style={appStyles.loadingText}>Loading luxury experience...</Text>
      </View>
    );
  }

  if (!permissionsDone) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <PermissionGate onComplete={() => setPermissionsDone(true)} />
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ROUTING BY ACTIVE ROLE
  // ─────────────────────────────────────────────────────────────
  const hasUserSession = !!user?.token;
  const hasVendorSession = !!vendorAuthToken || !!vendor?._id;

  const shouldShowChooser =
    !activeRole ||
    (activeRole === "user" && !hasUserSession) ||
    (activeRole === "vendor" && !hasVendorSession);

  let MainNavigator;

  if (shouldShowChooser) {
    // ── PROFILE CHOOSER (+ login / signup screens) ──
    MainNavigator = (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="ProfileChooser"
      >
        <Stack.Screen name="ProfileChooser" component={ProfileChooserScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
        <Stack.Screen name="SignupVendor" component={SignupVendorScreen} />
        <Stack.Screen
          name="DeliveryBoyLogin"
          component={DeliveryBoyLoginScreen}
        />
        <Stack.Screen
          name="DeliveryBoySignup"
          component={DeliveryBoySignupScreen}
        />
      </Stack.Navigator>
    );
  } else if (activeRole === "vendor") {
    // ── VENDOR FULL APP ──
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="VendorTabs" component={VendorTabNavigator} />
        <Stack.Screen
          name="VendorProductViews"
          component={VendorProductViewsScreen}
        />
        <Stack.Screen name="VendorChatScreen" component={VendorChatScreen} />
        <Stack.Screen
          name="VendorProductCRUD"
          component={VendorProductCRUDScreen}
        />
        <Stack.Screen name="VendorOrderList" component={VendorOrderList} />
        <Stack.Screen name="ActiveDeliveryBoys" component={AllDeliveryBoys} />
        <Stack.Screen
          name="VendorGenerateInvoice"
          component={WhatsappInvoiceSender}
        />
        <Stack.Screen
          name="InsuranceProductCRUD"
          component={InsuranceProductCRUDScreen}
        />
        <Stack.Screen
          name="PropertyCRUDScreen"
          component={PropertyCRUDScreen}
        />
        <Stack.Screen
          name="VendorAppointmentsList"
          component={VendorAppointmentsList}
        />
        <Stack.Screen name="VendorLeads" component={VendorLeadsScreen} />
        <Stack.Screen name="RentalCRUD" component={RentalCRUDScreen} />
        <Stack.Screen
          name="SubscriptionChoice"
          component={SubscriptionChoiceScreen}
        />
        <Stack.Screen
          name="SubscriptionManagement"
          component={SubscriptionManagementScreen}
        />
        <Stack.Screen
          name="SubscriptionPending"
          component={SubscriptionPendingScreen}
        />
        <Stack.Screen
          name="CategoryShopsScreen"
          component={CategoryShopsScreen}
        />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen
          name="ProductSearchScreen"
          component={ProductSearchScreen}
        />
        <Stack.Screen name="Search" component={Search} />
        <Stack.Screen
          name="InsuranceProductsAndDetails"
          component={InsuranceProductsAndDetails}
        />
        <Stack.Screen name="UserOrderScreen" component={UserOrderScreen} />
        <Stack.Screen name="ChatScreen" component={Chatscreen} />
        <Stack.Screen name="ShopListings" component={ShopListings} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen name="AddAddressScreen" component={AddAddressScreen} />
        <Stack.Screen
          name="AllCategoriesScreen"
          component={AllCategoriesScreen}
        />
        <Stack.Screen
          name="UserPropertyListScreen"
          component={UserPropertyListScreen}
        />
        <Stack.Screen
          name="PropertyDetailScreen"
          component={PropertyDetailScreen}
        />
        <Stack.Screen name="RentalList" component={UserRentalListScreen} />
        <Stack.Screen name="RentalDetail" component={RentalDetailScreen} />
        <Stack.Screen name="AdListScreen" component={AdListScreen} />
        <Stack.Screen name="AdManagement" component={AdManagementScreen} />
        <Stack.Screen name="AdGroupDetail" component={AdGroupDetailScreen} />
        <Stack.Screen name="WebViewScreen" component={WebViewScreen} />

        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen
          name="StoryViewer"
          component={StoryViewerScreen}
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="HashtagPosts" component={HashtagPostsScreen} />
        <Stack.Screen name="SearchScreen" component={SearchScreen} />
      </Stack.Navigator>
    );
  } else if (activeRole === "user") {
    // ── USER FULL APP ──
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="UserTabs" component={UserTabNavigator} />
        <Stack.Screen name="AddressScreen" component={AddressScreen} />
        <Stack.Screen name="Profile" component={UserProfileScreen} />
        <Stack.Screen name="CartScreen" component={CartScreen} />
        <Stack.Screen name="OrderScreen" component={OrderScreen} />
        <Stack.Screen
          name="ProductDetails"
          component={ProductDetailsScreen}
        />
        <Stack.Screen name="UserOrderScreen" component={UserOrderScreen} />
        <Stack.Screen name="ShopListings" component={ShopListings} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen name="ShopReviews" component={ShopReviewsScreen} />
        <Stack.Screen
          name="CategoryShopsScreen"
          component={CategoryShopsScreen}
        />
        <Stack.Screen
          name="CategoryProducts"
          component={CategoryProductsScreen}
        />
        <Stack.Screen name="ShopProducts" component={ShopProductsScreen} />
        <Stack.Screen name="BrandProducts" component={BrandProductsScreen} />
        <Stack.Screen
          name="ProductSearchScreen"
          component={ProductSearchScreen}
        />
        <Stack.Screen
          name="MyCategoriesScreen"
          component={MyCategoriesScreen}
        />
        <Stack.Screen
          name="InsuranceProductsAndDetails"
          component={InsuranceProductsAndDetails}
        />
        <Stack.Screen
          name="ProductDetailScreen"
          component={ProductDetailScreen}
          options={{ presentation: "transparentModal" }}
        />
        <Stack.Screen
          name="ProductDetailScreen10"
          component={ProductDetailScreen10}
        />
        <Stack.Screen
          name="PropertyDetailScreen"
          component={PropertyDetailScreen}
        />
        <Stack.Screen
          name="UserPropertyListScreen"
          component={UserPropertyListScreen}
        />
        <Stack.Screen name="RentalList" component={UserRentalListScreen} />
        <Stack.Screen name="RentalDetail" component={RentalDetailScreen} />
        <Stack.Screen name="AdListScreen" component={AdListScreen} />
        <Stack.Screen name="AdGroupDetail" component={AdGroupDetailScreen} />
        <Stack.Screen
          name="WebViewScreen"
          component={WebViewScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AllCategoriesScreen"
          component={AllCategoriesScreen}
        />
        <Stack.Screen name="AddAddressScreen" component={AddAddressScreen} />
        <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
        <Stack.Screen name="SignupVendor" component={SignupVendorScreen} />

        <Stack.Screen name="Messages" component={MessagesScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen
          name="StoryViewer"
          component={StoryViewerScreen}
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen name="HashtagPosts" component={HashtagPostsScreen} />
        <Stack.Screen name="SearchScreen" component={SearchScreen} />
      </Stack.Navigator>
    );
  } else if (activeRole === "deliveryBoy") {
    // ── DELIVERY BOY ──
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="DeliveryBoyDashboard"
          component={DeliveryBoyDashboardScreen}
        />
        <Stack.Screen
          name="DeliveryBoyOrders"
          component={DeliveryBoyOrdersPage}
        />
      </Stack.Navigator>
    );
  } else {
    // Fallback — should not reach here
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="ProfileChooser"
          component={ProfileChooserScreen}
        />
      </Stack.Navigator>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
      {MainNavigator}
      {activeRole === "user" && hasUserSession && <FloatingCartButton />}
      <AppUpdateOverlay />
    </NavigationContainer>
  );
};

/**
 * Inner shell — everything that needs Redux/PersistGate context.
 */
const AppShell = () => (
  <RootGate>
    <AppNavigator />
    <Toast config={toastConfig} />
  </RootGate>
);

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AppShell />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </PersistGate>
    </Provider>
  );
}

const appStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.luxuryBackground,
  },
  loadingText: {
    color: Colors.luxuryTextPrimary,
    fontSize: 16,
    marginTop: 10,
  },
  gateContainer: {
    flex: 1,
    backgroundColor: Colors.luxuryBackground,
    padding: 25,
    justifyContent: "center",
  },
  gateIconContainer: { alignItems: "center", marginBottom: 30 },
  gateTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.luxuryAccent,
    textAlign: "center",
    marginBottom: 10,
  },
  gateSubtitle: {
    fontSize: 16,
    color: Colors.luxuryTextSecondary,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  gateButton: {
    backgroundColor: Colors.luxuryAccent,
    padding: 18,
    borderRadius: 30,
    alignItems: "center",
  },
  gateButtonText: {
    color: Colors.luxuryBackground,
    fontSize: 18,
    fontWeight: "bold",
  },
});