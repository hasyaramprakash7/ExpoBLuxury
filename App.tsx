// App.tsx
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
import axios from "axios";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
import ShopListings from "./src/screens/ShopListings";
import ShopDetails from "./src/screens/ShopDetails";
import CategoryProductsScreen from "./src/screens/CategoryProductsScreen";
import ShopProductsScreen from "./src/screens/ShopProductsScreen";
import BrandProductsScreen from "./src/screens/BrandProductsScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ProductSearchScreen from "./src/screens/ProductSearchScreen";
import MyCategoriesScreen from "./src/screens/MyCategoriesScreen";
import InsuranceProductCRUDScreen from "./src/vendorScreens/InsuranceProductCRUDScreen";
import VendorAppointmentsList from "./src/vendorScreens/VendorAppointmentsList";
import InsuranceProductsAndDetails from "./src/screens/InsuranceProductsAndDetails";
import ProductDetailScreen from "./src/components/ProductDetailScreen";

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
  DeliveryBoyOrders: { id: string };
  DeliveryBoyPickups: { id: string };
  DeliveryBoyHistory: { id: string };
  VendorGenerateInvoice: { orderData: Order; vendorData: Vendor };
  ShopListings: undefined;
  ShopDetails: { vendorId: string; vendorName: string };
  CategoryProducts: { categoryName: string };
  ShopProducts: { vendorId: string; vendorName: string };
  BrandProducts: { brandName: string };
  InsuranceProductCRUD: undefined;
  VendorAppointmentsList: undefined;
  InsuranceProductsAndDetails: undefined; // <-- Corrected this entry
  ProductDetailScreen: { productId: string }; // <-- Added this new screen for Insurance product details
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
  luxuryBackground: "#0A0A0A",
  luxuryCard: "#1C1C1C",
  luxuryTextPrimary: "#E0E0E0",
  luxuryTextSecondary: "#B0B0B0",
  luxuryAccent: "#FFD700",
  luxuryError: "#FF6347",
  luxurySuccess: "#34C759",
  royalGreen: "#00A651",
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
  const {
    token: vendorAuthToken,
    loading: vendorLoading,
    error: vendorError,
  } = useSelector((state: RootState) => state.vendorAuth);
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
          dispatch(fetchDeliveryBoyProfile() as any)
            .unwrap()
            .catch(() => {
              dispatch(logoutDeliveryBoy());
            });
        }
        if (userToken) {
          dispatch(fetchUserProfile() as any);
          dispatch(fetchCart() as any);
        }
        if (vendorToken) {
          dispatch(fetchVendorProfile() as any);
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

  let StackNavigator;
  let initialAuthRoute = "Login";

  if (vendorAuthToken) {
    StackNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="VendorDashboard"
          component={VendorDashboardScreen}
        />
        <Stack.Screen
          name="VendorProductCRUD"
          component={VendorProductCRUDScreen}
        />
        <Stack.Screen name="VendorOrderList" component={VendorOrderList} />
        <Stack.Screen
          name="InsuranceProductCRUD"
          component={InsuranceProductCRUDScreen}
        />
        <Stack.Screen
          name="VendorAppointmentsList"
          component={VendorAppointmentsList}
        />
        <Stack.Screen name="ActiveDeliveryBoys" component={AllDeliveryBoys} />
        <Stack.Screen
          name="VendorGenerateInvoice"
          component={WhatsappInvoiceSender}
        />
      </Stack.Navigator>
    );
  } else if (!!deliveryBoy?._id) {
    StackNavigator = (
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
  } else if (user?.token) {
    StackNavigator = (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
          
        <Stack.Screen name="Search" component={ProductSearchScreen} />
        <Stack.Screen
          name="InsuranceProductsAndDetails"
          component={InsuranceProductsAndDetails}
        />
        <Stack.Screen // <-- New entry for the specific insurance product detail screen
          name="ProductDetailScreen"
          component={ProductDetailScreen}
        />
        <Stack.Screen
          name="MyCategoriesScreen"
          component={MyCategoriesScreen}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="ShopProducts" component={ShopProductsScreen} />
        <Stack.Screen name="BrandProducts" component={BrandProductsScreen} />
      </Stack.Navigator>
    );
  } else {
    if (vendorError) {
      initialAuthRoute = "VendorLogin";
    }

    StackNavigator = (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initialAuthRoute}
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AppNavigator />
          <Toast config={toastConfig} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
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