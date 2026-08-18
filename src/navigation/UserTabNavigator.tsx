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

// ---------- Screen Imports ----------
import ChatScreen from "../navigation/CategoryManagementScreen";
import HomeScreen from "../screens/HomeScreen";
import InsuranceProductsAndDetails from "../navigation/BrowserScreen";
import UserOrderScreen from "../userScreens/UserOrderScreen";
import ProductSearchScreen from "../screens/UserPropertyListScreen";
import Search from "../screens/UserRentalListScreen";
import ShopListings from "../screens/ShopListings";
import AdManagementScreen from "../screens/AdManagementScreen";
import AdListScreen from "../screens/AdListScreen";

const { width } = Dimensions.get("window");

// --- Layout & Color Config ---
const ROYAL_GREEN_PRO = "#166534";
const INACTIVE_COLOR = "#8E8E93";
const CART_ZONE_WIDTH = 80;

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

const unclipShadow = {
  paddingBottom: 15,
  marginBottom: -15,
  paddingHorizontal: 10,
  marginHorizontal: -10,
};

const Tab = createBottomTabNavigator();

// ---------- Dynamic Tab Bar ----------
const ScrollableUnderCartTabBar = ({ state, navigation }) => {
  const scrollViewRef = useRef(null);

  const activeRouteName = state.routes[state.index].name;
  const isPropertyActive = activeRouteName === "RealEstate";

  const navBgColor = isPropertyActive ? "#000000" : "#FFFFFF";
  const navTextColor = isPropertyActive ? "#FFFFFF" : "#333333";
  const dividerColor = isPropertyActive
    ? "rgba(255,255,255,0.2)"
    : "rgba(0,0,0,0.08)";
  const inactiveIconColor = isPropertyActive ? "#888888" : INACTIVE_COLOR;

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const totalCount = useMemo(
    () => cartItems.reduce((s, i) => s + i.quantity, 0),
    [cartItems]
  );

  const routeCount = state.routes.length;
  const SCROLL_ZONE_WIDTH = width - CART_ZONE_WIDTH;
  // ✅ Use a flexible width: at least 65px per item, but distribute remaining space
  const ITEM_WIDTH = Math.max(65, SCROLL_ZONE_WIDTH / routeCount);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      x: Math.max(0, state.index * ITEM_WIDTH - ITEM_WIDTH / 2),
      animated: true,
    });
  }, [state.index, ITEM_WIDTH]);

  return (
    <View style={[tabStyles.mainContainer, { backgroundColor: navBgColor }]}>
      {/* Fixed CART Zone */}
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
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            Cart
          </Text>
        </TouchableOpacity>
        <View
          style={[tabStyles.verticalDivider, { backgroundColor: dividerColor }]}
        />
      </View>

      {/* Scrollable Tabs */}
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
                style={[
                  tabStyles.tabItem,
                  { width: ITEM_WIDTH, minWidth: 60 }, // ✅ ensure minimum width
                ]}
              >
                <View style={tabStyles.iconWrapper}>
                  <Ionicons
                    name={getIcon(route.name, isFocused)}
                    size={24}
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
                  numberOfLines={1}
                  ellipsizeMode="clip"
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

// ---------- Icon & Label Helpers ----------
const getIcon = (name, focused) => {
  const icons = {
    Shops: focused ? "storefront" : "storefront-outline",
    Rental: focused ? "key" : "key-outline",
    Order: focused ? "bag" : "bag-outline",
    RealEstate: focused ? "home" : "home-outline",
    POS: focused ? "calculator" : "calculator-outline",
    Pay: focused ? "wallet" : "wallet-outline",
    AdList: focused ? "list" : "list-outline",
    Home: focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline",
    AdManagement: focused ? "settings" : "settings-outline",
  };
  return icons[name] || "apps-outline";
};

const getLabel = (name) => {
  const labels = {
    Shops: "Shops",
    Rental: "Rental",
    Order: "Shop",
    RealEstate: "Property",
    POS: "POS",
    Pay: "Pay",
    AdList: "Brands",
    Home: "Chat",
    AdManagement: "Ad Mgt",
  };
  return labels[name] || name;
};

// ---------- Main Navigator ----------
const UserTabNavigator = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  const rawPhone = user?.phone || user?.mobile || "";
  let normalizedPhone = rawPhone.replace(/\D/g, "");
  if (normalizedPhone.startsWith("91")) {
    normalizedPhone = normalizedPhone.substring(2);
  }

  const isSpecialUser = normalizedPhone === "7893828468";

  const baseScreens = [
    { name: "Shops", component: ShopListings },
    { name: "Rental", component: Search },
            { name: "AdList", component: AdListScreen },

    { name: "RealEstate", component: ProductSearchScreen },
    { name: "Order", component: HomeScreen },

    { name: "POS", component: InsuranceProductsAndDetails },
    { name: "Pay", component: UserOrderScreen },
  ];

  const extraScreens = isSpecialUser
    ? [
        { name: "Home", component: ChatScreen },
        { name: "AdManagement", component: AdManagementScreen },
      ]
    : [];

  const screens = [...baseScreens, ...extraScreens];

  return (
    <View style={{ flex: 1, backgroundColor: "#F9F9F9" }}>
      <Tab.Navigator
        tabBar={(props) => <ScrollableUnderCartTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {screens.map(({ name, component }) => (
          <Tab.Screen key={name} name={name} component={component} />
        ))}
      </Tab.Navigator>
    </View>
  );
};

// ---------- Styles ----------
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
    textAlign: "center",
  },
  scrollZone: {
    flex: 1,
    overflow: "visible",
  },
  scrollContent: {
    paddingHorizontal: 8,
    alignItems: "center",
    overflow: "visible",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingTop: 6,
    paddingBottom: 10,
    marginHorizontal: 0,
    overflow: "visible",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginTop: 8,
    textAlign: "center",
    flexShrink: 0, // ✅ prevents text from compressing
  },
});

export default UserTabNavigator;