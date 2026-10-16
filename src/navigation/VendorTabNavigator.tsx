// src/navigation/VendorTabNavigator.tsx
import React, { useMemo } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";

// Vendor Screens
import VendorDashboardScreen from "../vendorScreens/VendorDashboardScreen";
import VendorProductCRUDScreen from "../vendorScreens/VendorProductCRUD";
import VendorOrderList from "../vendorScreens/VendorOrderList";
import PropertyCRUDScreen from "../vendorScreens/PropertyCRUDScreen";
import RentalCRUDScreen from "../screens/RentalCRUDScreen";
import VendorLeadsScreen from "../vendorScreens/VendorLeadsScreen";
import VendorProductViewsScreen from "../vendorScreens/VendorProductViewsScreen";
import VendorEditProfileScreen from "../vendorScreens/VendorEditProfileScreen";

// Ad Management Screens
import AdManagementScreen from "../screens/AdManagementScreen";
import AdGroupDetailScreen from "../screens/AdGroupDetailScreen";

// Video Settings (shared with user side)
import VideoSettingsScreen from "../screens/VideoSettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ═════════════════════════════════════════════════════════
// AD STACK
// Wraps AdManagementScreen so it can push AdGroupDetail,
// VendorEditProfile, and VideoSettings from inside itself.
// ═════════════════════════════════════════════════════════
const AdStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AdManagementMain" component={AdManagementScreen} />
    <Stack.Screen name="AdGroupDetail" component={AdGroupDetailScreen} />
    <Stack.Screen
      name="VendorEditProfile"
      component={VendorEditProfileScreen}
    />
    <Stack.Screen
      name="VideoSettings"
      component={VideoSettingsScreen}
    />
  </Stack.Navigator>
);

const VendorTabNavigator = React.memo(() => {
  const activeRole = useSelector((s: RootState) => s.session.activeRole);
  const { vendor } = useSelector((state: RootState) => state.vendorAuth);
  const { stats: leadStats } = useSelector((state: RootState) => state.leads);
  const { total: viewsTotal } = useSelector(
    (state: RootState) => state.productViews
  );

  const totalLeads = useMemo(
    () => leadStats?.total ?? vendor?.totalLeads ?? 0,
    [leadStats, vendor]
  );
  const totalViews = useMemo(
    () => (viewsTotal > 0 ? viewsTotal : vendor?.totalViews ?? 0),
    [viewsTotal, vendor]
  );

  // Never render vendor tabs when activeRole !== 'vendor'.
  if (activeRole !== "vendor") {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        let badge: number | undefined;
        if (route.name === "Leads") {
          badge = totalLeads > 0 ? totalLeads : undefined;
        } else if (route.name === "Views") {
          badge = totalViews > 0 ? totalViews : undefined;
        }

        return {
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: any;
            const sizeIcon = size || 24;
            switch (route.name) {
              case "Dashboard":
                iconName = focused ? "home" : "home-outline";
                break;
              case "Products":
                iconName = focused ? "cube" : "cube-outline";
                break;
              case "Orders":
                iconName = focused ? "bag" : "bag-outline";
                break;
              case "Properties":
                iconName = focused ? "business" : "business-outline";
                break;
              case "Rental":
                iconName = focused ? "calendar" : "calendar-outline";
                break;
              case "Leads":
                iconName = focused ? "megaphone" : "megaphone-outline";
                break;
              case "Views":
                iconName = focused ? "eye" : "eye-outline";
                break;
              case "Ads":
                iconName = focused ? "megaphone" : "megaphone-outline";
                break;
              default:
                iconName = "apps-outline";
            }
            return <Ionicons name={iconName} size={sizeIcon} color={color} />;
          },
          tabBarActiveTintColor: "#166534",
          tabBarInactiveTintColor: "#8E8E93",
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: "bold",
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 6,
            textAlign: "center",
          },
          tabBarStyle: {
            height: 100,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
          },
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={VendorDashboardScreen} />
      <Tab.Screen name="Products" component={VendorProductCRUDScreen} />
      <Tab.Screen name="Orders" component={VendorOrderList} />
      <Tab.Screen name="Properties" component={PropertyCRUDScreen} />
      <Tab.Screen name="Rental" component={RentalCRUDScreen} />
      <Tab.Screen name="Leads" component={VendorLeadsScreen} />
      <Tab.Screen name="Views" component={VendorProductViewsScreen} />
      <Tab.Screen name="Ads" component={AdStack} />
    </Tab.Navigator>
  );
});

export default VendorTabNavigator;