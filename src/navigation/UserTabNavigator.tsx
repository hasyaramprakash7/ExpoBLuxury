import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  createBottomTabNavigator,
  BottomTabScreenProps,
} from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  Image, // <-- IMPORTANT: Import Image
} from "react-native";
import { useSelector } from "react-redux";
import { useNavigation, CommonActions } from "@react-navigation/native";

// Import your tab screens
import HomeScreen from "../screens/HomeScreen";
import OrderScreen from "../screens/OrderScreen";
import PayScreen from "../userScreens/UserOrderScreen";
import GiftScreen from "../screens/MyCategoriesScreen";
import SearchScreen from "../screens/ProductSearchScreen";

// Import your new logo image
const BLuxuryLogo = require("../../assets/Gemini_Generated_Image_z8uyflz8uyflz8uy.png");

// --- Redux Imports (for FloatingCartBar logic) ---
import { RootState } from "../app/store";

// --- Type Definitions ---
interface Product {
  _id: string;
  name: string;
  price: number;
  discountedPrice?: number;
  stock: number;
  isAvailable: boolean;
  images?: string[];
  companyName?: string;
  brand?: string;
  location?: string;
  rating?: number;
  numReviews?: number;
  vendorId?: string;
  vendor?: {
    _id: string;
  };
  bulkPrice?: number;
  bulkMinimumUnits?: number;
  largeQuantityPrice?: number;
  largeQuantityMinimumUnits?: number;
  description?: string;
}

interface CartReduxItem {
  productId: Product;
  quantity: number;
  price: number;
  _id: string;
}

export type BottomTabParamList = {
  Home: undefined;
  Gift: undefined;
  Order: undefined;
  Pay: undefined;
  Search: undefined;
};

const { width, height } = Dimensions.get("window");

// --- Modern Color Palette ---
const Colors = {
  starbucksGreen: "#0A3D2B",
  starbucksDarkGreen: "#0A3D2B",
  starbucksLightGreen: "#0A3D2B",
  starbucksAccent: "#0A3D2B",
  textWhite: "#F8F5F0",
  textDark: "#1A1A1A",
  grayText: "black",
  lightGray: "#F8FAFC",
  borderGray: "#E5E7EB",
  glassWhite: "rgba(255, 255, 255, 0.95)",
  shadowDark: "rgba(0, 0, 0, 0.1)",
  gradientStart: "#0A3D2B",
  gradientEnd: "#0A3D2B",
  goldenYellow: "#FFD700", // New color for the logo's shadow/background
  goldenShadow: "#0A3D2B", // A darker golden for shadow
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

// Custom Tab Bar Button with the new logo
const CustomOrderTabBarButton = ({ onPress, focused }) => {
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  const opacityValue = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: focused ? 1.1 : 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(opacityValue, {
        toValue: focused ? 0.9 : 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, [focused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
        duration: 100,
      }),
      Animated.spring(scaleValue, {
        toValue: focused ? 1.1 : 1,
        useNativeDriver: true,
        duration: 100,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity
      style={tabStyles.customButtonContainer}
      onPress={handlePress}
      activeOpacity={1}
    >
      {/*
        The delivery badge is removed to simplify the design and match the new logo.
        If you want to keep it, you can uncomment the following block.
      */}
      {/* <Animated.View
        style={[
          tabStyles.deliveryBadge,
          {
            transform: [{ scale: scaleValue }],
          },
        ]}
      >
        <View style={tabStyles.deliveryBadgeInner}>
          <View style={tabStyles.deliveryDot} />
          <Text style={tabStyles.deliveryText}>Delivery</Text>
        </View>
      </Animated.View> */}

      {/* Main Order Button with the B Luxury logo */}
      <Animated.View
        style={[
          tabStyles.customButton,
          {
            transform: [{ scale: scaleValue }],
            opacity: opacityValue,
          },
          focused && tabStyles.customButtonFocused,
        ]}
      >
        <Image
          source={BLuxuryLogo}
          style={tabStyles.orderButtonLogo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Floating Action Indicator */}
      {focused && (
        <View style={tabStyles.actionIndicator}>
          <View style={tabStyles.actionDot} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// --- Floating Cart Bar Component ---
const FloatingCartBar = () => {
  const navigation = useNavigation();
  const cartItems = useSelector(
    (state: RootState) => state.cart.items as CartReduxItem[]
  );

  // Re-define pricing constants here, consistent with CartScreen
  const DELIVERY_CHARGE = 75;
  const FREE_DELIVERY_THRESHOLD = 200;
  const PLATFORM_FEE_RATE = 0.03; // 19%
  const GST_RATE = 0.05; // 5% GST

  // Helper function to calculate effective price
  const getEffectivePrice = useCallback(
    (product: Product, quantity: number): number => {
      let price = product.discountedPrice || product.price || 0;

      if (
        product.largeQuantityPrice &&
        product.largeQuantityMinimumUnits &&
        quantity >= product.largeQuantityMinimumUnits
      ) {
        price = product.largeQuantityPrice;
      } else if (
        product.bulkPrice &&
        product.bulkMinimumUnits &&
        quantity >= product.bulkMinimumUnits
      ) {
        price = product.bulkPrice;
      }
      return price;
    },
    []
  );

  // Get the primary item name (or default to "Date Cortado")
  const primaryItemName = useMemo(() => {
    if (cartItems.length === 0) return "Date Cortado";

    const firstItem = cartItems[0];
    const productName = firstItem.productId?.name || "Item";

    if (cartItems.length > 1) {
      const uniqueProducts = new Set(
        cartItems.map((item) => item.productId?._id)
      );
      if (uniqueProducts.size > 1) {
        return `${cartItems.length} Items`;
      }
    }
    return productName;
  }, [cartItems]);

  // Memoize pricing calculations
  const pricingBreakdown = useMemo(() => {
    const discountedSubtotal = cartItems.reduce((sum, item) => {
      const product = item.productId || {};
      const effectivePrice = getEffectivePrice(product, item.quantity);
      return sum + effectivePrice * item.quantity;
    }, 0);

    const deliveryCharge =
      discountedSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
    const platformFee = discountedSubtotal * PLATFORM_FEE_RATE;
    const gstAmount = (discountedSubtotal + platformFee) * GST_RATE;
    const finalTotal =
      discountedSubtotal + deliveryCharge + platformFee + gstAmount;

    return {
      finalTotal,
      itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [
    cartItems,
    getEffectivePrice,
    DELIVERY_CHARGE,
    FREE_DELIVERY_THRESHOLD,
    PLATFORM_FEE_RATE,
    GST_RATE,
  ]);

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <View style={tabStyles.floatingCartBar}>
      <View style={tabStyles.floatingCartTextContainer}>
        <Text style={tabStyles.floatingCartLabel}>{primaryItemName}</Text>
        <Text style={tabStyles.floatingCartPrice}>
          ₹{pricingBreakdown.finalTotal.toFixed(2)}
        </Text>
      </View>
      <TouchableOpacity
        style={tabStyles.floatingCartButton}
        onPress={() => {
          const state = navigation.getState();
          const currentRoute = state.routes[state.index];

          if (currentRoute.name === "Gift") {
            console.log("Already on Cart tab, not navigating again.");
          } else {
            navigation.navigate("CartScreen");
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={tabStyles.floatingCartButtonText}>View Cart</Text>
      </TouchableOpacity>
    </View>
  );
};

const UserTabNavigator = () => {
  const cartItems = useSelector((state: RootState) => state.cart.items);

  return (
    <View style={tabStyles.navigatorContainer}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap;
            const iconColor = focused ? Colors.starbucksGreen : Colors.grayText;
            const iconSize = focused ? 20 : 18;

            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Gift") {
              // CHANGE: Updated icon for the Categories screen
              iconName = focused ? "grid" : "grid-outline";
            } else if (route.name === "Order") {
              // The icon for "Order" is rendered directly within CustomOrderTabBarButton
              return null; // Return null so the default icon isn't rendered
            } else if (route.name === "Pay") {
              // CHANGE: Renamed from Pay to Order
              iconName = focused ? "card" : "card-outline";
            } else if (route.name === "Search") {
              iconName = focused ? "search" : "search-outline";
            } else {
              iconName = "help-circle-outline";
            }

            return (
              <View style={focused ? tabStyles.focusedIconContainer : null}>
                <Ionicons name={iconName} size={iconSize} color={iconColor} />
                {focused && <View style={tabStyles.iconIndicator} />}
              </View>
            );
          },
          tabBarActiveTintColor: Colors.starbucksGreen,
          tabBarInactiveTintColor: Colors.grayText,
          tabBarStyle: {
            backgroundColor: Colors.textWhite,
            borderTopWidth: 0,
            height: 85,
            paddingBottom: 1,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 50,
            shadowColor: Colors.shadowDark,
            shadowOffset: {
              width: 0,
              height: -8,
            },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            zIndex: 1001,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "900",
            letterSpacing: 0.3,
          },
          tabBarItemStyle: {
            paddingVertical: 4,
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Home" }}
        />
        <Tab.Screen
          name="Gift"
          component={GiftScreen}
          options={{ title: "Categories" }}
        />
        <Tab.Screen
          name="Order"
          component={OrderScreen}
          options={{
            title: "",
            tabBarButton: (props) => <CustomOrderTabBarButton {...props} />,
          }}
        />
        <Tab.Screen
          name="Pay"
          component={PayScreen}
          options={{ title: "order" }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: "Search" }}
        />
      </Tab.Navigator>

      {cartItems.length > 0 && <FloatingCartBar />}
    </View>
  );
};

const tabStyles = StyleSheet.create({
  navigatorContainer: {
    flex: 1,
    position: "relative",
  },
  screenContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.lightGray,
    padding: 20,
  },
  modernCard: {
    backgroundColor: Colors.textWhite,
    padding: 32,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: Colors.shadowDark,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 200,
  },
  modernText: {
    color: Colors.textDark,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  subText: {
    color: Colors.grayText,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  customButtonContainer: {
    top: -40,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    zIndex: 10,
    paddingBottom: 16,
  },
  // The original delivery badge styles are commented out.
  // Uncomment them if you want to use the badge.
  // deliveryBadge: {
  //  marginBottom: 1,
  //  zIndex: 4,
  // },
  // deliveryBadgeInner: {
  //  backgroundColor: Colors.glassWhite,
  //  paddingHorizontal: 10,
  //  paddingVertical: 5,
  //  borderRadius: 20,
  //  flexDirection: "row",
  //  alignItems: "center",
  //  shadowColor: Colors.shadowDark,
  //  shadowOffset: { width: 0, height: 4 },
  //  shadowOpacity: 0.15,
  //  shadowRadius: 8,
  //  elevation: 8,
  //  borderWidth: 1,
  //  borderColor: "rgba(255, 255, 255, 0.3)",
  // },
  // deliveryDot: {
  //  width: 8,
  //  height: 8,
  //  borderRadius: 4,
  //  backgroundColor: Colors.starbucksAccent,
  //  marginRight: 8,
  // },
  // deliveryText: {
  //  color: Colors.starbucksGreen,
  //  fontSize: 12,
  //  fontWeight: "700",
  //  letterSpacing: 0.5,
  // },

  // Updated custom button styles for the new logo
  customButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent", // The image itself will provide the background
    shadowColor: Colors.goldenShadow, // Use a golden shadow
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    // No `buttonGradient` or `buttonInner` views are needed
  },
  customButtonFocused: {
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  // New style for the logo image
  orderButtonLogo: {
    width: "100%", // The image takes the full width of the button container
    height: "100%", // The image takes the full height of the button container
    borderRadius: 36,
  },

  focusRing: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: Colors.starbucksAccent,
    top: -2,
    left: -2,
  },
  actionIndicator: {
    position: "absolute",
    bottom: -8,
    alignItems: "center",
  },
  actionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.starbucksAccent,
    marginTop: 4,
  },
  focusedIconContainer: {
    alignItems: "center",
  },
  iconIndicator: {
    width: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.starbucksGreen,
    marginTop: 4,
  },

  // --- Floating Cart Bar Styles ---
  floatingCartBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 90 : 75,
    backgroundColor: "#0A3D2B",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 999,
    minHeight: 75,
  },
  floatingCartTextContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  floatingCartLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 2,
  },
  floatingCartPrice: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  floatingCartButton: {
    backgroundColor: "#F8F5F0",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingCartButtonText: {
    color: "#0A3D2B",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default UserTabNavigator;