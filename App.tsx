// App.tsx - Complete updated file
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
  registerForPushNotificationsAsync,
  setupLeadNotificationListener,
} from "./src/userScreens/utils/NotificationHelper";
import { store, persistor, RootState, AppDispatch } from "./src/app/store";
import socket, {
  connectUserToSocket,
  disconnectUserFromSocket,
} from "./src/userScreens/utils/socket";

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
import VendorProductViewsScreen from './src/vendorScreens/VendorProductViewsScreen';
import UserRentalListScreen from './src/screens/UserRentalListScreen';
import RentalDetailScreen from './src/screens/RentalDetailScreen';
import PropertyCRUDScreen from "./src/vendorScreens/PropertyCRUDScreen";
import PropertyDetailScreen from "./src/screens/PropertyDetailScreen";
import VendorChatScreen from "./src/vendorScreens/VendorChatScreen";
import NotificationBell from "./src/components/NotificationBell";
import UserPropertyListScreen from "./src/screens/UserPropertyListScreen";
import AddressScreen from "./src/userScreens/AddressScreen";
import RentalCRUDScreen from './src/screens/RentalCRUDScreen';
import SubscriptionChoiceScreen from './src/vendorScreens/SubscriptionChoiceScreen';
import SubscriptionManagementScreen from './src/vendorScreens/SubscriptionManagementScreen';
import SubscriptionPendingScreen from './src/vendorScreens/SubscriptionPendingScreen';

// ---- User screens added for vendor access ----
import HomeScreen from "./src/screens/HomeScreen";
import Search from "./src/screens/UserRentalListScreen";
import AdListScreen from "./src/screens/AdListScreen";
import WebViewScreen from "./src/screens/WebViewScreen";
import AllCategoriesScreen from './src/screens/AllCategoriesScreen';
import AddAddressScreen from './src/screens/AddAddressScreen';

import VendorLeadsScreen from "./src/vendorScreens/VendorLeadsScreen";
import { navigationRef, RootStackParamList } from "./src/userScreens/utils/navigationRef";

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
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

const AppUpdateOverlay = () => {
  const appConfig = useSelector((state: RootState) => state.auth.appConfig);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (appConfig) {
      const latestVersion =
        Platform.OS === "ios"
          ? appConfig.latestIOSVersion
          : appConfig.latestAndroidVersion;
      if (
        latestVersion &&
        compareVersions(latestVersion, CURRENT_APP_VERSION) > 0
      ) {
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
    } catch (error) {
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
    (state: RootState) => state.vendorAuth,
  );
  const { deliveryBoy } = useSelector(
    (state: RootState) => state.deliveryBoyAuth,
  );
  const { groups } = useSelector((state: RootState) => state.chat);

  const [isInitializing, setIsInitializing] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [permissionsDone, setPermissionsDone] = useState(false);
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  // Setup notification listeners
  useEffect(() => {
    const subscriptions = setupLeadNotificationListener();
    return () => {
      if (subscriptions?.foregroundSubscription) {
        subscriptions.foregroundSubscription.remove();
      }
      if (subscriptions?.responseSubscription) {
        subscriptions.responseSubscription.remove();
      }
    };
  }, []);

  // Handle notification responses
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('🔔 Notification tapped:', data);
        
        if (!data || !data.type) {
          console.warn('⚠️ Notification missing type data');
          return;
        }

        switch (data.type) {
          case 'view':
            if (data.vendorId) {
              navigationRef.current?.navigate('ShopDetails', { 
                vendorId: data.vendorId 
              });
            } else {
              navigationRef.current?.navigate('ShopListings');
            }
            break;
            
          case 'lead':
            if (vendorAuthToken) {
              navigationRef.current?.navigate('VendorLeads');
            } else {
              navigationRef.current?.navigate('VendorLogin');
            }
            break;
            
          case 'product':
            if (data.id) {
              navigationRef.current?.navigate('ProductDetails', { productId: data.id });
            }
            break;
            
          case 'property':
            if (data.id) {
              navigationRef.current?.navigate('PropertyDetailScreen', { propertyId: data.id });
            }
            break;
            
          case 'rental':
            if (data.id) {
              navigationRef.current?.navigate('RentalDetail', { rentalId: data.id });
            }
            break;
            
          case 'chat':
            navigationRef.current?.navigate('ChatScreen');
            break;
            
          case 'daily_update':
            if (vendorAuthToken) {
              navigationRef.current?.navigate('VendorDashboard');
            }
            break;
            
          default:
            navigationRef.current?.navigate('UserTabs');
            break;
        }
      }
    );
    return () => subscription.remove();
  }, [vendorAuthToken]);

  useEffect(() => {
    const currentUserId = vendor?._id || user?._id || deliveryBoy?._id;
    if (currentUserId) {
      const myGroupIds = groups?.map((g) => g._id) || [];
      connectUserToSocket(currentUserId, myGroupIds);
    }
    return () => {
      if (currentUserId) disconnectUserFromSocket(currentUserId);
    };
  }, [user?._id, vendor?._id, deliveryBoy?._id, groups]);

  useEffect(() => {
    async function loadResourcesAndAuth() {
      try {
        await Font.loadAsync(Ionicons.font);
        setFontsLoaded(true);
        const permStatus = await AsyncStorage.getItem("permissionsGranted");
        if (permStatus === "true") setPermissionsDone(true);
        await setupNotifications();
        dispatch(fetchAppConfig() as any);
        const [userToken, vendorToken, deliveryBoyToken] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("vendorToken"),
          SecureStore.getItemAsync("deliveryBoyToken"),
        ]);
        
        if (deliveryBoyToken) {
          console.log('🔐 DeliveryBoy token found');
          await dispatch(fetchDeliveryBoyProfile() as any)
            .unwrap()
            .then((deliveryBoyData) => {
              console.log('✅ DeliveryBoy profile fetched:', deliveryBoyData);
              if (deliveryBoyData?._id) {
                registerForPushNotificationsAsync(deliveryBoyData._id);
              }
            })
            .catch(() => dispatch(logoutDeliveryBoy()));
        }
        
        if (userToken) {
          console.log('🔐 User token found');
          await dispatch(fetchUserProfile() as any)
            .unwrap()
            .then((userData) => {
              console.log('✅ User profile fetched:', userData);
              if (userData?._id) {
                registerForPushNotificationsAsync(userData._id);
              }
            })
            .catch(() => {});
          dispatch(fetchCart() as any);
        }
        
        if (vendorToken) {
          console.log('🔐 Vendor token found, fetching profile...');
          try {
            const vendorData = await dispatch(fetchVendorProfile() as any).unwrap();
            console.log('✅ Vendor profile fetched:', vendorData);
            if (vendorData?._id) {
              console.log('📱 Registering push token for vendor:', vendorData._id);
              await registerForPushNotificationsAsync(vendorData._id);
            } else {
              console.warn('⚠️ Vendor _id missing from profile data');
            }
          } catch (error) {
            console.error('❌ Failed to fetch vendor profile:', error);
          }
        }
      } catch (e) {
        console.error('❌ Error in loadResourcesAndAuth:', e);
      } finally {
        setIsInitializing(false);
      }
    }
    loadResourcesAndAuth();
  }, [dispatch]);

  const onLayoutRootView = useCallback(async () => {
    if (!isInitializing && fontsLoaded) await SplashScreenExpo.hideAsync();
  }, [isInitializing, fontsLoaded]);

  if (isInitializing || !fontsLoaded) {
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

  let MainNavigator;
  if (vendorAuthToken) {
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Existing vendor screens */}
        <Stack.Screen name="VendorDashboard" component={VendorDashboardScreen} />
        <Stack.Screen name="RentalCRUD" component={RentalCRUDScreen} />
        <Stack.Screen name="SubscriptionChoice" component={SubscriptionChoiceScreen} />
        <Stack.Screen name="SubscriptionManagement" component={SubscriptionManagementScreen} />
        <Stack.Screen name="SubscriptionPending" component={SubscriptionPendingScreen} />
        <Stack.Screen name="VendorProductViews" component={VendorProductViewsScreen} />
        <Stack.Screen name="VendorProductCRUD" component={VendorProductCRUDScreen} />
        <Stack.Screen name="VendorChatScreen" component={VendorChatScreen} />
        <Stack.Screen name="VendorOrderList" component={VendorOrderList} />
        <Stack.Screen name="ActiveDeliveryBoys" component={AllDeliveryBoys} />
        <Stack.Screen name="VendorGenerateInvoice" component={WhatsappInvoiceSender} />
        <Stack.Screen name="InsuranceProductCRUD" component={InsuranceProductCRUDScreen} />
        <Stack.Screen name="PropertyCRUDScreen" component={PropertyCRUDScreen} />
        <Stack.Screen name="VendorAppointmentsList" component={VendorAppointmentsList} />
        <Stack.Screen name="VendorLeads" component={VendorLeadsScreen} />
        <Stack.Screen name="CategoryShopsScreen" component={CategoryShopsScreen} />
        {/* User-facing screens for vendor access */}
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen name="ProductSearchScreen" component={ProductSearchScreen} />
        <Stack.Screen name="Search" component={Search} />
        <Stack.Screen name="InsuranceProductsAndDetails" component={InsuranceProductsAndDetails} />
        <Stack.Screen name="UserOrderScreen" component={UserOrderScreen} />
        <Stack.Screen name="ChatScreen" component={Chatscreen} />
        <Stack.Screen name="ShopListings" component={ShopListings} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen name="AddAddressScreen" component={AddAddressScreen} />
        <Stack.Screen name="AllCategoriesScreen" component={AllCategoriesScreen} />
      </Stack.Navigator>
    );
  } else if (deliveryBoy?._id) {
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DeliveryBoyDashboard" component={DeliveryBoyDashboardScreen} />
        <Stack.Screen name="DeliveryBoyOrders" component={DeliveryBoyOrdersPage} />
      </Stack.Navigator>
    );
  } else if (user?.token) {
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="UserTabs" component={UserTabNavigator} />
        <Stack.Screen name="AddressScreen" component={AddressScreen} />
        <Stack.Screen name="Profile" component={UserProfileScreen} />
        <Stack.Screen name="ChatScreen" component={Chatscreen} />
        <Stack.Screen name="CartScreen" component={CartScreen} />
        <Stack.Screen name="OrderScreen" component={OrderScreen} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="UserOrderScreen" component={UserOrderScreen} />
        <Stack.Screen name="ShopListings" component={ShopListings} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen name="CategoryShopsScreen" component={CategoryShopsScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        <Stack.Screen name="ShopProducts" component={ShopProductsScreen} />
        <Stack.Screen name="BrandProducts" component={BrandProductsScreen} />
        <Stack.Screen name="ProductSearchScreen" component={ProductSearchScreen} />
        <Stack.Screen name="MyCategoriesScreen" component={MyCategoriesScreen} />
        <Stack.Screen name="InsuranceProductsAndDetails" component={InsuranceProductsAndDetails} />
        <Stack.Screen name="ProductDetailScreen" component={ProductDetailScreen} options={{ presentation: "transparentModal" }} />
        <Stack.Screen name="ProductDetailScreen10" component={ProductDetailScreen10} />
        <Stack.Screen name="PropertyDetailScreen" component={PropertyDetailScreen} />
        <Stack.Screen name="UserPropertyListScreen" component={UserPropertyListScreen} />
        <Stack.Screen name="RentalList" component={UserRentalListScreen} />
        <Stack.Screen name="RentalDetail" component={RentalDetailScreen} />
        <Stack.Screen name="AdListScreen" component={AdListScreen} />
        <Stack.Screen name="WebViewScreen" component={WebViewScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllCategoriesScreen" component={AllCategoriesScreen} />
        <Stack.Screen name="AddAddressScreen" component={AddAddressScreen} />
        
        {/* ✅ ADD Vendor Login/Signup screens here for user to switch to vendor */}
        <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
        <Stack.Screen name="SignupVendor" component={SignupVendorScreen} />
      </Stack.Navigator>
    );
  } else {
    MainNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
        <Stack.Screen name="SignupVendor" component={SignupVendorScreen} />
        <Stack.Screen name="DeliveryBoyLogin" component={DeliveryBoyLoginScreen} />
        <Stack.Screen name="DeliveryBoySignup" component={DeliveryBoySignupScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
      {MainNavigator}
      {user?.token && !vendorAuthToken && !deliveryBoy?._id && <FloatingCartButton />}
      <AppUpdateOverlay />
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AppNavigator />
            <Toast config={toastConfig} />
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
  loadingText: { color: Colors.luxuryTextPrimary, fontSize: 16, marginTop: 10 },
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