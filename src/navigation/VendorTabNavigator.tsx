import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { View, Text, StyleSheet } from "react-native";

// ----- Vendor Screen Imports -----
import VendorDashboardScreen from "../vendorScreens/VendorDashboardScreen";
import VendorProductCRUDScreen from "../vendorScreens/VendorProductCRUD";
import VendorOrderList from "../vendorScreens/VendorOrderList";
import AllDeliveryBoys from "../vendorScreens/AllDeliveryBoys";
import WhatsappInvoiceSender from "../vendorScreens/WhatsappInvoiceSender";
import InsuranceProductCRUDScreen from "../vendorScreens/InsuranceProductCRUDScreen";
import PropertyCRUDScreen from "../vendorScreens/PropertyCRUDScreen";
import VendorAppointmentsList from "../screens/RentalCRUDScreen";
import VendorLeadsScreen from "../vendorScreens/VendorLeadsScreen";
import VendorChatScreen from "../vendorScreens/VendorProductViewsScreen";

const Tab = createBottomTabNavigator();

const VendorTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
            case "DeliveryBoys":
              iconName = focused ? "people" : "people-outline";
              break;
            case "Invoices":
              iconName = focused ? "document-text" : "document-text-outline";
              break;
            case "Insurance":
              iconName = focused ? "medical" : "medical-outline";
              break;
            case "Properties":
              iconName = focused ? "business" : "business-outline";
              break;
            case "Appointments":
              iconName = focused ? "calendar" : "calendar-outline";
              break;
            case "Leads":
              iconName = focused ? "megaphone" : "megaphone-outline";
              break;
            case "Chat":
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            default:
              iconName = "apps-outline";
          }
          return <Ionicons name={iconName} size={sizeIcon} color={color} />;
        },
        tabBarActiveTintColor: "#166534",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          height: 100,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={VendorDashboardScreen} />
      <Tab.Screen name="Products" component={VendorProductCRUDScreen} />
      <Tab.Screen name="Orders" component={VendorOrderList} />
      {/* <Tab.Screen name="DeliveryBoys" component={AllDeliveryBoys} /> */}
      {/* <Tab.Screen name="Invoices" component={WhatsappInvoiceSender} />
      <Tab.Screen name="Insurance" component={InsuranceProductCRUDScreen} /> */}
      <Tab.Screen name="Properties" component={PropertyCRUDScreen} />
      <Tab.Screen name="Rental" component={VendorAppointmentsList} />
      <Tab.Screen name="Leads" component={VendorLeadsScreen} />
      <Tab.Screen name="Views" component={VendorChatScreen} />
    </Tab.Navigator>
  );
};

export default VendorTabNavigator;