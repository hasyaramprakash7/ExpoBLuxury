// src/screens/DeliveryBoyOrdersPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "../../App";
import { fetchOrdersByDeliveryBoy } from "../features/deliveryBoy/deliveryBoyOrderSlice";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import dayjs from "dayjs";

type RootStackParamList = {
  DeliveryBoyOrders: { id: string };
};
type DeliveryBoyOrdersPageRouteProp = RouteProp<
  RootStackParamList,
  "DeliveryBoyOrders"
>;

const colors = {
  rolexGreen: "#006039",
  rolexGold: "#A37E2C",
  neutralLightGray: "#F8F5F0",
  subtleBorder: "#E5E7EB",
  textGray: "#4B5563",
  headingGray: "#1F2937",
  white: "white",
  red: "#DC2626",
  yellow: "#D97706",
  blue: "#2563EB",
  green: "#059669",
};

export default function DeliveryBoyOrdersPage() {
  const route = useRoute<DeliveryBoyOrdersPageRouteProp>();
  const { id } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const {
    assignedOrders: orders,
    loading,
    error,
  } = useSelector((state: RootState) => state.deliveryBoyAuth);
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activeMap, setActiveMap] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<
    "all" | "placed" | "shipped" | "delivered" | "cancelled" | "processing"
  >("all");

  const orderStatuses = [
    "all",
    "placed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "Delivery boy ID is missing.");
      return;
    }
    dispatch(fetchOrdersByDeliveryBoy(id));
  }, [id, dispatch]);

  useEffect(() => {
    const startLocationWatch = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Permission to access location was denied.");
        return;
      }
      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (position) => {
          setMyLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      );
      return () => watchId.remove();
    };
    startLocationWatch();
  }, []);

  const handleNavigation = (toLat?: number, toLng?: number) => {
    if (!myLocation || !toLat || !toLng) {
      Alert.alert(
        "Error",
        "Your location or the delivery address is unavailable."
      );
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&origin=${myLocation.lat},${myLocation.lng}&destination=${toLat},${toLng}`;
    Linking.openURL(url).catch((err) =>
      console.error("Failed to open Google Maps", err)
    );
  };

  const handlePhoneCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch((err) =>
      console.error("Failed to open phone dialer", err)
    );
  };

  const toggleMap = (orderId: string) => {
    setActiveMap(activeMap === orderId ? null : orderId);
  };

  const sortedAndFilteredOrders = useMemo(() => {
    const sortedList = [...orders];

    const filteredList = sortedList.filter((order) => {
      if (activeStatus === "all") {
        return true;
      }
      return order.status.toLowerCase() === activeStatus.toLowerCase();
    });

    return filteredList.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, activeStatus]);

  const getStatusStyles = (
    status: "placed" | "shipped" | "delivered" | "cancelled" | "processing"
  ) => {
    switch (status) {
      case "placed":
        return {
          backgroundColor: "#FFFBEB",
          color: colors.yellow,
          borderColor: "#FEF3C7",
        };
      case "processing":
        return {
          backgroundColor: "#EFF6FF",
          color: colors.blue,
          borderColor: "#DBEAFE",
        };
      case "shipped":
        return {
          backgroundColor: "#F5F3FF",
          color: "#7C3AED",
          borderColor: "#EDE9FE",
        };
      case "delivered":
        return {
          backgroundColor: "#ECFDF5",
          color: colors.green,
          borderColor: "#D1FAE5",
        };
      case "cancelled":
        return {
          backgroundColor: "#FEF2F2",
          color: colors.red,
          borderColor: "#FEE2E2",
        };
      default:
        return {
          backgroundColor: "#F9FAFB",
          color: colors.textGray,
          borderColor: colors.subtleBorder,
        };
    }
  };

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.rolexGreen} />
        <Text style={styles.messageText}>
          Fetching your assigned deliveries...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.header}>
          Your Deliveries <Text style={{ color: colors.rolexGreen }}>•</Text>{" "}
          <Text style={{ color: colors.rolexGold }}>History</Text>
        </Text>

        <View style={styles.filterContainer}>
          {orderStatuses.map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() =>
                setActiveStatus(
                  status as
                    | "all"
                    | "placed"
                    | "shipped"
                    | "delivered"
                    | "cancelled"
                    | "processing"
                )
              }
              style={[
                styles.filterButton,
                activeStatus === status
                  ? {
                      backgroundColor: colors.rolexGreen,
                      transform: [{ scale: 1.05 }],
                    }
                  : { backgroundColor: colors.subtleBorder },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  activeStatus === status
                    ? { color: colors.white }
                    : { color: colors.textGray },
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <Text style={styles.errorText}>
            ❌ Error retrieving orders:{" "}
            {error || "An unexpected error occurred."}
          </Text>
        )}
        {!loading &&
          orders.length > 0 &&
          sortedAndFilteredOrders.length === 0 && (
            <Text style={styles.messageText}>
              No orders found with status:{" "}
              <Text style={{ fontWeight: "600", color: colors.rolexGreen }}>
                {activeStatus.charAt(0).toUpperCase() + activeStatus.slice(1)}
              </Text>
              . Try a different filter.
            </Text>
          )}
        {!loading && orders.length === 0 && (
          <Text style={styles.messageText}>
            It appears you don't have any assigned deliveries yet.
          </Text>
        )}

        <View style={styles.ordersList}>
          {sortedAndFilteredOrders.map((order) => {
            const deliveryLat = order.address?.latitude;
            const deliveryLng = order.address?.longitude;
            const showMap = activeMap === order._id;
            const orderTotal = order.total;

            return (
              <View key={order._id} style={styles.orderCard}>
                <View
                  style={[
                    styles.orderHeader,
                    { backgroundColor: colors.rolexGreen },
                  ]}
                >
                  <View>
                    <Text style={styles.orderIdText}>
                      Order #{order._id.slice(-8).toUpperCase()}
                    </Text>
                    <Text style={styles.orderDateText}>
                      Placed on:{" "}
                      {dayjs(order.createdAt).format("MMM D, YYYY [at] h:mm A")}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusBadge, getStatusStyles(order.status)]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusStyles(order.status).color },
                      ]}
                    >
                      {order.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderBody}>
                  <View style={styles.vendorGroupCard}>
                    <Text style={styles.vendorHeader}>Order Items</Text>
                    <View style={styles.vendorItemsList}>
                      {order.items.map((item, idx) => (
                        <View key={idx} style={styles.itemCard}>
                          <Image
                            source={{
                              uri:
                                item.productImage ||
                                "https://via.placeholder.com/100?text=No+Image",
                            }}
                            style={styles.itemImage}
                          />
                          <View style={styles.itemDetails}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemQuantityPrice}>
                              Qty:{" "}
                              <Text style={{ fontWeight: "500" }}>
                                {item.quantity}
                              </Text>{" "}
                              × ₹{item.price.toFixed(2)}
                            </Text>
                          </View>
                          <Text style={styles.itemTotalPrice}>
                            ₹{(item.quantity * item.price).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.bottomSection}>
                    <View style={styles.addressContainer}>
                      <Text style={styles.sectionHeader}>
                        Customer Details:
                      </Text>
                      <View style={styles.addressCard}>
                        <Text style={styles.addressTextBold}>
                          {order.address?.fullName || "N/A"}
                        </Text>
                        <Text style={styles.addressText}>
                          {`${order.address?.street || ""}, ${
                            order.address?.city || ""
                          }, ${order.address?.state || ""}`}
                        </Text>
                        <Text style={styles.addressText}>
                          {order.address?.country} -{" "}
                          {order.address?.zipCode || "N/A"}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            order.address?.phone &&
                            handlePhoneCall(order.address.phone)
                          }
                        >
                          <Text style={styles.addressPhone}>
                            Phone: {order.address?.phone || "N/A"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.paymentContainer}>
                      <Text style={styles.sectionHeader}>Order Total:</Text>
                      <View style={styles.paymentCard}>
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>
                            Payment Method:
                          </Text>
                          <Text style={styles.paymentValue}>
                            {order.paymentMethod || "N/A"}
                          </Text>
                        </View>
                        <View style={styles.totalRow}>
                          <Text style={styles.totalLabel}>Grand Total:</Text>
                          <Text style={styles.totalValue}>
                            ₹{orderTotal?.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.navigateButton}
                      onPress={() => handleNavigation(deliveryLat, deliveryLng)}
                    >
                      <Ionicons
                        name="navigate-circle-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.navigateButtonText}>
                        Start Navigation
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.mapButton}
                      onPress={() => toggleMap(order._id)}
                    >
                      <Ionicons
                        name={activeMap === order._id ? "map" : "map-outline"}
                        size={20}
                        color={colors.headingGray}
                      />
                      <Text style={styles.mapButtonText}>
                        {activeMap === order._id ? "Hide Map" : "View Map"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showMap && (
                    <View style={styles.mapContainer}>
                      <Text style={styles.mapPlaceholderText}>
                        Map integration not available in this preview.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutralLightGray,
    paddingTop: Platform.OS === "android" ? 50 : 0,
  },
  scrollViewContent: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    paddingBottom: 180,
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: colors.headingGray,
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
    justifyContent: "center",
    padding: 6,
    backgroundColor: colors.white,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    transitionDuration: 300,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
  },
  filterButtonText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutralLightGray,
  },
  messageText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
    color: colors.rolexGreen,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.subtleBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  orderHeader: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  orderIdText: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.75,
    color: colors.white,
  },
  orderDateText: {
    fontSize: 10,
    opacity: 0.9,
    marginTop: 2,
    color: colors.white,
    fontWeight: "300",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  orderBody: {
    padding: 12,
  },
  vendorGroupCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
    borderRadius: 6,
    padding: 12,
    backgroundColor: colors.neutralLightGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  vendorHeader: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: colors.headingGray,
  },
  vendorItemsList: {
    gap: 8,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 4,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  itemImage: {
    width: 48,
    height: 48,
    resizeMode: "cover",
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontWeight: "600",
    color: colors.headingGray,
    fontSize: 12,
  },
  itemQuantityPrice: {
    fontSize: 10,
    color: colors.textGray,
  },
  itemTotalPrice: {
    color: colors.headingGray,
    fontWeight: "bold",
    fontSize: 14,
  },
  bottomSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.subtleBorder,
    flexDirection: "column",
    gap: 16,
  },
  addressContainer: {
    flex: 1,
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: colors.headingGray,
  },
  addressCard: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  addressTextBold: {
    fontWeight: "500",
    color: colors.headingGray,
    fontSize: 12,
  },
  addressText: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  addressPhone: {
    marginTop: 6,
    fontWeight: "500",
    color: colors.rolexGreen,
    fontSize: 12,
  },
  paymentContainer: {
    flex: 1,
    marginTop: 16,
  },
  paymentCard: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    alignItems: "center",
  },
  paymentLabel: {
    fontSize: 12,
    color: colors.textGray,
  },
  paymentValue: {
    fontWeight: "600",
    textTransform: "capitalize",
    color: colors.rolexGreen,
    fontSize: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.subtleBorder,
  },
  totalLabel: {
    fontWeight: "bold",
    fontSize: 14,
    color: colors.headingGray,
  },
  totalValue: {
    fontWeight: "bold",
    fontSize: 14,
    color: colors.rolexGreen,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 12,
  },
  navigateButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.rolexGreen,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  navigateButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 12,
  },
  mapButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.subtleBorder,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  mapButtonText: {
    color: colors.headingGray,
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 12,
  },
  mapContainer: {
    height: 200,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.subtleBorder,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  mapPlaceholderText: {
    color: colors.textGray,
    fontStyle: "italic",
    fontSize: 14,
    textAlign: "center",
  },
});
