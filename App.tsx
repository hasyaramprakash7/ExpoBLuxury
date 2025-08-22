// App.tsx
// --- App.tsx (Main App entry point) ---
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Provider, useDispatch, useSelector } from "react-redux";
import {
  NavigationContainer,
  NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import Toast, {
  BaseToast,
  ErrorToast,
  InfoToast,
} from "react-native-toast-message";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Font from "expo-font";
import * as SplashScreenExpo from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";

// --- Redux Imports ---
import { store, RootState, AppDispatch } from "./src/app/store";
import { fetchUserProfile } from "./src/features/user/authSlice";
import { fetchVendorProfile } from "./src/features/vendor/vendorAuthSlice";
import { fetchCart } from "./src/features/cart/cartSlice";
import {
  fetchDeliveryBoyProfile,
  logoutDeliveryBoy,
} from "./src/features/deliveryBoy/deliveryBoyOrderSlice";

// --- Screen Imports ---
// User Screens
import LoginScreen from "./src/userScreens/LoginScreen";
import SignupScreen from "./src/userScreens/SignupScreen";
import UserTabNavigator from "./src/navigation/UserTabNavigator";
import UserProfileScreen from "./src/userScreens/UserProfileScreen";
import UserOrderScreen from "./src/userScreens/UserOrderScreen";
// Vendor Screens
import VendorLoginScreen from "./src/vendorScreens/VendorLoginScreen";
import SignupVendorScreen from "./src/vendorScreens/SignupVendorScreen";
import VendorDashboardScreen from "./src/vendorScreens/VendorDashboardScreen";
import VendorProductCRUDScreen from "./src/vendorScreens/VendorProductCRUD";
import VendorOrderList from "./src/vendorScreens/VendorOrderList";
import AllDeliveryBoys from "./src/vendorScreens/AllDeliveryBoys";
import WhatsappInvoiceSender from "./src/vendorScreens/WhatsappInvoiceSender";
// Delivery Boy Screens
import DeliveryBoyLoginScreen from "./src/deliveryBoyScreens/DeliveryBoyLoginScreen";
import DeliveryBoySignupScreen from "./src/deliveryBoyScreens/DeliveryBoySignupScreen";
import DeliveryBoyDashboardScreen from "./src/deliveryBoyScreens/DeliveryBoyDashboardScreen";
import DeliveryBoyOrdersPage from "./src/deliveryBoyScreens/DeliveryBoyOrders";
// General Screens
import ProductDetailsScreen from "./src/components/ProductDetailsScreen";
import OrderScreen from "./src/screens/OrderScreen";
import CartScreen from "./src/screens/Cart";
import ShopListings from "./src/screens/ShopListings";
import ShopDetails from "./src/screens/ShopDetails";
import CategoryProductsScreen from "./src/screens/CategoryProductsScreen";
import ShopProductsScreen from "./src/screens/ShopProductsScreen";
import BrandProductsScreen from "./src/screens/BrandProductsScreen"; // <-- NEW IMPORT

// --- Keep the splash screen visible while we fetch resources ---
SplashScreenExpo.preventAutoHideAsync();

// --- Type Definitions for Navigation ---
interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
}

interface Order {
  _id: string;
  status: string;
  items: Array<any>;
  user: { name?: string };
  address: any;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  deliveryBoy?: any;
}

interface Vendor {
  _id: string;
  shopName: string;
  address?: {
    latitude?: number;
    longitude?: number;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  VendorLogin: undefined;
  SignupVendor: undefined;
  VendorDashboard: undefined;
  VendorProductCRUD: undefined;
  VendorOrderList: undefined;
  // This route is for a specific assignment, requiring an orderId
  ActiveDeliveryBoys: { orderId: string };
  UserTabs: NavigatorScreenParams<BottomTabParamList>;
  Profile: undefined;
  ProductDetails: { product: Product };
  OrderScreen: undefined;
  UserOrderScreen: undefined;
  CartScreen: undefined;
  DeliveryBoyLogin: undefined;
  DeliveryBoySignup: undefined;
  DeliveryBoyDashboard: undefined;
  // FIX: This screen expects an 'id' parameter.
  DeliveryBoyOrders: { id: string };
  DeliveryBoyPickups: { id: string };
  DeliveryBoyHistory: { id: string };
  // This screen expects orderData and vendorData, which are objects
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
  ShopListings: undefined;
  ShopDetails: { vendorId: string; vendorName: string };
  CategoryProducts: { categoryName: string };
  ShopProducts: { vendorId: string; vendorName: string };
  BrandProducts: { brandName: string }; // <-- NEW TYPE DEFINITION
};

export type BottomTabParamList = {
  Home: undefined;
  Gift: undefined;
  Order: undefined;
  Pay: undefined;
  Search: undefined;
};

// --- Color Palette ---
const Colors = {
  starbucksGreen: "#00704A",
  starbucksDarkGreen: "#0A3D2B",
  starbucksGold: "#FFD700",
  backgroundDark: "#FFFFFF",
  backgroundLighterDark: "#FFFFFF",
  textDarkBrown: "#4A2C2A",
  textWhite: "#FFFFFF",
  grayText: "gray",
  borderGray: "#DDDDDD",
  success: "#38A169",
  warning: "#DD6B20",
  error: "#E53E3E",
  luxuryBackground: "#0A0A0A", // Main background color (black)
  luxuryCard: "#1C1C1C", // Background for cards, toasts, etc.
  luxuryTextPrimary: "#E0E0E0", // Primary text color (white)
  luxuryTextSecondary: "#B0B0B0", // Secondary text color (light gray)
  luxuryAccent: "#FFD700", // Accent color (gold)
  luxuryError: "#FF6347", // Error color (coral)
  luxurySuccess: "#34C759", // Success color (green)
  royalGreen: "#00A651", // Added for the 'Order' button color
};

// --- Toast Configuration ---
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: Colors.luxurySuccess,
        backgroundColor: Colors.luxuryCard,
        height: "auto",
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.borderGray,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: Colors.luxuryTextPrimary,
      }}
      text2Style={{
        fontSize: 13,
        color: Colors.luxuryTextSecondary,
      }}
      renderLeadingIcon={() => (
        <Ionicons
          name="checkmark-circle"
          size={24}
          color={Colors.luxurySuccess}
          style={{ marginRight: 10, marginLeft: 5 }}
        />
      )}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: Colors.luxuryError,
        backgroundColor: Colors.luxuryCard,
        height: "auto",
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.borderGray,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: Colors.luxuryTextPrimary,
      }}
      text2Style={{
        fontSize: 13,
        color: Colors.luxuryTextSecondary,
      }}
      renderLeadingIcon={() => (
        <Ionicons
          name="close-circle"
          size={24}
          color={Colors.luxuryError}
          style={{ marginRight: 10, marginLeft: 5 }}
        />
      )}
    />
  ),
  info: (props: any) => (
    <InfoToast
      {...props}
      style={{
        borderLeftColor: Colors.luxuryTextSecondary,
        backgroundColor: Colors.luxuryCard,
        height: "auto",
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.borderGray,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: Colors.luxuryTextPrimary,
      }}
      text2Style={{
        fontSize: 13,
        color: Colors.luxuryTextSecondary,
      }}
      renderLeadingIcon={() => (
        <Ionicons
          name="information-circle"
          size={24}
          color={Colors.luxuryTextSecondary}
          style={{ marginRight: 10, marginLeft: 5 }}
        />
      )}
    />
  ),
  warning: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: Colors.warning,
        backgroundColor: Colors.luxuryCard,
        height: "auto",
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.borderGray,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: Colors.luxuryTextPrimary,
      }}
      text2Style={{
        fontSize: 13,
        color: Colors.luxuryTextSecondary,
      }}
      renderLeadingIcon={() => (
        <Ionicons
          name="alert-circle"
          size={24}
          color={Colors.warning}
          style={{ marginRight: 10, marginLeft: 5 }}
        />
      )}
    />
  ),
  starbucksGoldToast: ({ text1, text2, props }: any) => (
    <View style={appStyles.starbucksGoldToastContainer}>
      <Ionicons
        name="star"
        size={24}
        color={Colors.royalGreen}
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={appStyles.starbucksGoldText1}>{text1}</Text>
        <Text style={appStyles.starbucksGoldText2}>{text2}</Text>
      </View>
    </View>
  ),
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const LoadingScreen = () => (
  <View style={appStyles.loadingContainer}>
    <ActivityIndicator size="large" color={Colors.luxuryAccent} />
    <Text style={appStyles.loadingText}>Loading...</Text>
  </View>
);

const AppNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();

  const { user, loading: userLoading } = useSelector(
    (state: RootState) => state.auth
  );
  const { token: vendorAuthToken, loading: vendorLoading } = useSelector(
    (state: RootState) => state.vendorAuth
  );
  const { deliveryBoy, isLoading: deliveryBoyLoading } = useSelector(
    (state: RootState) => state.deliveryBoyAuth
  );

  const [isInitializing, setIsInitializing] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadResourcesAndAuth() {
      try {
        await Font.loadAsync(Ionicons.font);
        setFontsLoaded(true);

        const [userToken, vendorToken, deliveryBoyToken] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("vendorToken"),
          SecureStore.getItemAsync("deliveryBoyToken"),
        ]);

        if (deliveryBoyToken) {
          dispatch(fetchDeliveryBoyProfile())
            .unwrap()
            .catch(() => {
              dispatch(logoutDeliveryBoy());
            });
        }
        if (userToken) {
          dispatch(fetchUserProfile());
          dispatch(fetchCart());
        }
        if (vendorToken) {
          dispatch(fetchVendorProfile());
        }
      } catch (e) {
        console.error("Failed to load resources or tokens", e);
        Toast.show({
          type: "error",
          text1: "Initialization Error",
          text2: "Failed to load app data. Please restart the app.",
        });
      } finally {
        setIsInitializing(false);
      }
    }
    loadResourcesAndAuth();
  }, [dispatch]);

  const onLayoutRootView = useCallback(async () => {
    if (
      !isInitializing &&
      fontsLoaded &&
      !userLoading &&
      !vendorLoading &&
      !deliveryBoyLoading
    ) {
      await SplashScreenExpo.hideAsync();
    }
  }, [
    isInitializing,
    fontsLoaded,
    userLoading,
    vendorLoading,
    deliveryBoyLoading,
  ]);

  if (
    isInitializing ||
    !fontsLoaded ||
    userLoading ||
    vendorLoading ||
    deliveryBoyLoading
  ) {
    return <LoadingScreen />;
  }

  // Determine the correct navigation stack to render based on authentication state
  let StackNavigator;

  if (vendorAuthToken) {
    // Vendor Flow
    StackNavigator = (
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // All headers are now hidden
        }}
      >
        <Stack.Screen
          name="VendorDashboard"
          component={VendorDashboardScreen}
        />
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
      </Stack.Navigator>
    );
  } else if (!!deliveryBoy?._id) {
    // Delivery Boy Flow
    StackNavigator = (
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // All headers are now hidden
        }}
      >
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
  } else if (user?.token) {
    // User Flow
    StackNavigator = (
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // All headers are now hidden
        }}
      >
        <Stack.Screen name="UserTabs" component={UserTabNavigator} />
        <Stack.Screen name="Profile" component={UserProfileScreen} />
        <Stack.Screen name="OrderScreen" component={OrderScreen} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="UserOrderScreen" component={UserOrderScreen} />
        <Stack.Screen name="CartScreen" component={CartScreen} />
        <Stack.Screen name="ShopListings" component={ShopListings} />
        <Stack.Screen name="ShopDetails" component={ShopDetails} />
        <Stack.Screen
          name="CategoryProducts"
          component={CategoryProductsScreen}
        />
        <Stack.Screen name="ShopProducts" component={ShopProductsScreen} />
        <Stack.Screen name="BrandProducts" component={BrandProductsScreen} />
      </Stack.Navigator>
    );
  } else {
    // Authentication Flow
    StackNavigator = (
      <Stack.Navigator
        screenOptions={{
          headerShown: false, // All headers are now hidden
        }}
      >
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
  }

  return (
    <NavigationContainer onReady={onLayoutRootView}>
      {StackNavigator}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppNavigator />
        <Toast config={toastConfig} />
      </SafeAreaProvider>
    </Provider>
  );
}

const appStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.luxuryBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.luxuryBackground,
  },
  loadingText: {
    color: Colors.luxuryTextPrimary,
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
  },
  starbucksGoldToastContainer: {
    height: 60,
    width: "90%",
    backgroundColor: Colors.luxuryCard,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  starbucksGoldText1: {
    fontSize: 15,
    fontWeight: "bold",
    color: Colors.royalGreen,
  },
  starbucksGoldText2: {
    fontSize: 13,
    color: Colors.luxuryTextSecondary,
  },
});
