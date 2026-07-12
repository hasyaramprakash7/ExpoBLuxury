import React, { useRef, useEffect, useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
} from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";

// Screen Imports
import ChatScreen from "../screens/ChatScreen";
import HomeScreen from "../screens/HomeScreen";
import InsuranceProductsAndDetails from "../screens/InsuranceProductsAndDetails";
import UserOrderScreen from "../userScreens/UserOrderScreen";
import ProductSearchScreen from "../screens/UserPropertyListScreen";
import Search from "../screens/NewArrivals";

const { width } = Dimensions.get("window");

// --- Layout & Color Config ---
const ROYAL_GREEN_PRO = "#166534";
const INACTIVE_COLOR = "#8E8E93";
const CART_ZONE_WIDTH = 80;

const SCROLL_ZONE_WIDTH = width - CART_ZONE_WIDTH;
// Keeps tabs at a readable size; the 6th tab (Search) will just be scrollable!
const ITEM_WIDTH = SCROLL_ZONE_WIDTH / 5;

// --- Shadows ---
const heavyDropShadow = {
  textShadowColor: "rgba(0, 0, 0, 0.25)",
  textShadowOffset: { width: 0, height: 4 },
  textShadowRadius: 6,
};

const activeGlow = {
  textShadowColor: "rgba(22, 101, 52, 0.45)",
  textShadowOffset: { width: 0, height: 4 },
  textShadowRadius: 8,
};

// --- THE FIX FOR CLIPPING ---
// This forces the bounding box of the text/icon to expand
// so the shadow doesn't get sliced off at the edges.
const unclipShadow = {
  paddingBottom: 15,
  marginBottom: -15,
  paddingHorizontal: 10,
  marginHorizontal: -10,
};

const Tab = createBottomTabNavigator();

const ScrollableUnderCartTabBar = ({ state, navigation }) => {
  const scrollViewRef = useRef(null);

  // 1. Identify if the active screen is the Property screen
  const activeRouteName = state.routes[state.index].name;
  const isPropertyActive = activeRouteName === "RealEstate";

  // 2. Define Dynamic Colors based on active screen
  const navBgColor = isPropertyActive ? "#000000" : "#FFFFFF";
  const navTextColor = isPropertyActive ? "#FFFFFF" : "#333333";
  const dividerColor = isPropertyActive
    ? "rgba(255,255,255,0.2)"
    : "rgba(0,0,0,0.08)";
  const inactiveIconColor = isPropertyActive ? "#888888" : INACTIVE_COLOR;

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const totalCount = useMemo(
    () => cartItems.reduce((s, i) => s + i.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      x: Math.max(0, state.index * ITEM_WIDTH - ITEM_WIDTH / 2),
      animated: true,
    });
  }, [state.index]);

  return (
    <View style={[tabStyles.mainContainer, { backgroundColor: navBgColor }]}>
      {/* --- FIXED LEFT ZONE (CART) --- */}
      <View style={tabStyles.fixedCartZone}>
        <TouchableOpacity
          onPress={() => navigation.navigate("CartScreen" as never)}
          activeOpacity={0.6}
          style={tabStyles.cartButton}
        >
          <View style={tabStyles.iconWrapper}>
            <Ionicons
              name="cart-outline"
              size={24}
              color={navTextColor}
              style={[heavyDropShadow, unclipShadow]}
            />
            {totalCount > 0 && (
              <View style={tabStyles.countBadge}>
                <Text style={tabStyles.badgeText}>{totalCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              tabStyles.cartLabelText,
              { color: navTextColor },
              heavyDropShadow,
              unclipShadow,
            ]}
          >
            Cart
          </Text>
        </TouchableOpacity>

        <View
          style={[tabStyles.verticalDivider, { backgroundColor: dividerColor }]}
        />
      </View>

      {/* --- SCROLL ZONE (TABS) --- */}
      <View style={tabStyles.scrollZone}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tabStyles.scrollContent}
          overflow="visible"
          decelerationRate="fast"
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const activeColor = isFocused ? ROYAL_GREEN_PRO : inactiveIconColor;
            const currentShadow = isFocused ? activeGlow : heavyDropShadow;

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                activeOpacity={0.6}
                style={tabStyles.tabItem}
              >
                <View style={tabStyles.iconWrapper}>
                  <Ionicons
                    name={getIcon(route.name, isFocused)}
                    size={22}
                    color={activeColor}
                    style={[currentShadow, unclipShadow]}
                  />
                </View>
                <Text
                  style={[
                    tabStyles.tabLabel,
                    { color: activeColor },
                    currentShadow,
                    unclipShadow,
                  ]}
                >
                  {getLabel(route.name)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const getIcon = (name, focused) => {
  const icons = {
    Home: focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline",
    Order: focused ? "storefront" : "storefront-outline",
    RealEstate: focused ? "home" : "home-outline",
    Ram: focused ? "shield-checkmark" : "shield-outline",
    Pay: focused ? "wallet" : "wallet-outline",
    Search: focused ? "search" : "search-outline",
  };
  return icons[name] || "apps-outline";
};

const getLabel = (name) => {
  const labels = {
    Home: "Chat",
    Order: "Shop",
    RealEstate: "Property",
    Ram: "Insurance",
    Pay: "Pay",
    Search: "Search",
  };
  return labels[name] || name;
};

const UserTabNavigator = () => {
  return (
    <View style={{ flex: 1, backgroundColor: "#F9F9F9" }}>
      <Tab.Navigator
        tabBar={(props) => <ScrollableUnderCartTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >

        <Tab.Screen name="Order" component={HomeScreen} />
        <Tab.Screen name="RealEstate" component={ProductSearchScreen} />
                        <Tab.Screen name="Ai" component={Search} />

        <Tab.Screen name="Home" component={ChatScreen} />
        <Tab.Screen name="Ram" component={InsuranceProductsAndDetails} />
        <Tab.Screen name="Pay" component={UserOrderScreen} />
      </Tab.Navigator>
    </View>
  );
};

// --- Styles ---
const tabStyles = StyleSheet.create({
  mainContainer: {
    width: width,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.02)",
    paddingTop: 6,
    height: Platform.OS === "ios" ? 100 : 95,
    paddingBottom: Platform.OS === "ios" ? 38 : 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 20,
    overflow: "visible",
  },
  fixedCartZone: {
    width: CART_ZONE_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    overflow: "visible",
  },
  cartButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingTop: 6,
    paddingBottom: 10,
    overflow: "visible",
  },
  verticalDivider: {
    height: "55%",
    width: 1,
    borderRadius: 1,
  },
  iconWrapper: {
    position: "relative",
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  countBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: ROYAL_GREEN_PRO,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  cartLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  scrollZone: {
    flex: 1,
    overflow: "visible",
  },
  scrollContent: {
    paddingHorizontal: 10,
    alignItems: "center",
    overflow: "visible",
  },
  tabItem: {
    width: ITEM_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingTop: 6,
    paddingBottom: 10,
    marginHorizontal: 4,
    overflow: "visible",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});

export default UserTabNavigator;
