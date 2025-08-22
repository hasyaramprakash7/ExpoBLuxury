// src/screens/OrderScreen.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import {
  fetchUserOrders,
  cancelUserOrder,
  Order,
  OrderItem,
} from "../features/orders/orderSlice"; // Import types
// import Navbar from "../components/Home/Navbar"; // Adjust path as per your project structure
import { RootState } from "../app/store"; // Assuming you have a RootState defined in your store setup
import Toast from "react-native-toast-message"; // For toast notifications

interface VendorGroup {
  vendorName: string;
  vendorPhone?: string;
  vendorId: string;
  items: OrderItem[];
  vendorTotal: number;
}

const UserOrderScreen: React.FC = () => {
  const dispatch = useDispatch();

  // Access user from auth slice, assuming it's structured this way
  const user = useSelector((state: RootState) => state.auth.user);
  const userId = user?._id; // User ID should ideally come from Redux state directly after login

  const { orders, loading, error } = useSelector(
    (state: RootState) => state.order
  );

  const [activeFilter, setActiveFilter] = useState<string>("All");

  useEffect(() => {
    if (userId) {
      dispatch(fetchUserOrders(userId));
    } else {
      // Potentially handle case where userId is not immediately available,
      // e.g., if user data is still loading or not persisted yet.
      // For now, logging a warning.
      console.warn("User ID not found when trying to fetch orders.");
    }
  }, [userId, dispatch]);

  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order? This action cannot be undone.",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: () => {
            dispatch(cancelUserOrder(orderId))
              .unwrap()
              .then(() => {
                Toast.show({
                  type: "success",
                  text1: "Order cancelled successfully.",
                });
              })
              .catch((err) => {
                Toast.show({
                  type: "error",
                  text1: err || "Failed to cancel order. Please try again.",
                });
              });
          },
        },
      ],
      { cancelable: false }
    );
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (activeFilter === "All") {
        return true;
      }
      return order.status.toLowerCase() === activeFilter.toLowerCase();
    });
  }, [orders, activeFilter]);

  // Group items within each order by vendor
  const ordersGroupedByVendor = useMemo(() => {
    return filteredOrders.map((order) => {
      const vendorsMap = new Map<string, VendorGroup>();
      order.items.forEach((item) => {
        // Ensure vendorId is available for consistent grouping
        const vendorKey = item.vendorId || item.vendorName;
        if (!vendorsMap.has(vendorKey)) {
          vendorsMap.set(vendorKey, {
            vendorName: item.vendorName,
            vendorPhone: item.vendorPhone,
            vendorId: item.vendorId,
            items: [],
            vendorTotal: 0,
          });
        }
        const vendorData = vendorsMap.get(vendorKey)!; // Non-null assertion as we just checked
        vendorData.items.push(item);
        vendorData.vendorTotal += item.quantity * item.price;
      });
      return {
        ...order,
        vendors: Array.from(vendorsMap.values()),
      };
    });
  }, [filteredOrders]);

  // Define the Rolex-inspired colors for consistency
  const rolexGreen = "#006039";
  const rolexGold = "#A37E2C";
  const neutralLightGray = "#F9FAFB";
  const subtleBorder = "#E5E7EB";
  const textGray = "#4B5563";
  const headingGray = "#1F2937";

  const getStatusStyles = (status: Order["status"]) => {
    switch (status) {
      case "placed":
        return {
          backgroundColor: "#FFFBEB",
          color: "#D97706",
          borderColor: "#FEF3C7",
        }; // bg-yellow-50 text-yellow-700 border border-yellow-200
      case "processing":
        return {
          backgroundColor: "#EFF6FF",
          color: "#2563EB",
          borderColor: "#DBEAFE",
        }; // bg-blue-50 text-blue-700 border border-blue-200
      case "shipped":
        return {
          backgroundColor: "#F5F3FF",
          color: "#7C3AED",
          borderColor: "#EDE9FE",
        }; // bg-purple-50 text-purple-700 border border-purple-200
      case "delivered":
        return {
          backgroundColor: "#ECFDF5",
          color: "#059669",
          borderColor: "#D1FAE5",
        }; // bg-green-50 text-green-700 border border-green-200
      case "cancelled":
        return {
          backgroundColor: "#FEF2F2",
          color: "#DC2626",
          borderColor: "#FEE2E2",
        }; // bg-red-50 text-red-700 border border-red-200
      default:
        return {
          backgroundColor: "#F9FAFB",
          color: "#4B5563",
          borderColor: "#E5E7EB",
        }; // bg-gray-50 text-gray-700 border border-gray-200
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.header}>
          Your Orders <Text style={{ color: rolexGreen }}>•</Text>{" "}
          <Text style={{ color: rolexGold }}>History</Text>
        </Text>

        {/* Status Filter Buttons */}
        <View style={styles.filterContainer}>
          {[
            "All",
            "Placed",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled",
          ].map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setActiveFilter(status)}
              style={[
                styles.filterButton,
                activeFilter === status
                  ? {
                      backgroundColor: rolexGreen,
                      transform: [{ scale: 1.05 }],
                    }
                  : { backgroundColor: "#E5E7EB" }, // gray-100
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === status
                    ? { color: "white" }
                    : { color: textGray },
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <ActivityIndicator
            size="large"
            color={rolexGreen}
            style={styles.messageText}
          />
        )}
        {error && (
          <Text style={styles.errorText}>
            ❌ Error retrieving orders:{" "}
            {error || "An unexpected error occurred."}
          </Text>
        )}
        {!loading && orders.length === 0 && (
          <Text style={styles.messageText}>
            It appears you haven't placed any orders yet. Start exploring!
          </Text>
        )}
        {!loading && orders.length > 0 && filteredOrders.length === 0 && (
          <Text style={styles.messageText}>
            No orders found with status:{" "}
            <Text style={{ fontWeight: "600", color: rolexGreen }}>
              {activeFilter}
            </Text>
            . Try a different filter.
          </Text>
        )}

        <View style={styles.ordersList}>
          {ordersGroupedByVendor.map((order) => (
            <View key={order._id} style={styles.orderCard}>
              {/* Order Header */}
              <View
                style={[styles.orderHeader, { backgroundColor: rolexGreen }]}
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
                {/* Cancel Order Button */}
                {["placed", "processing"].includes(order.status) && (
                  <View style={styles.cancelButtonContainer}>
                    <TouchableOpacity
                      onPress={() => handleCancelOrder(order._id)}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelButtonText}>Cancel Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Render items grouped by vendor */}
                {order.vendors.map((vendorData, vendorIdx) => (
                  <View
                    key={vendorData.vendorId || vendorIdx}
                    style={styles.vendorGroupCard}
                  >
                    <Text style={styles.vendorHeader}>
                      Items from{" "}
                      <Text style={{ color: rolexGreen }}>
                        {vendorData.vendorName}
                      </Text>
                      {vendorData.vendorPhone ? (
                        <Text style={{ color: rolexGold, fontSize: 10 }}>
                          {" "}
                          📞{" "}
                          <Text style={styles.callVendorLink}>Call Vendor</Text>
                        </Text>
                      ) : (
                        ""
                      )}
                    </Text>
                    <View style={styles.vendorItemsList}>
                      {vendorData.items.map((item, itemIdx) => (
                        <View
                          key={item.productId || itemIdx}
                          style={styles.itemCard}
                        >
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
                    <View style={styles.vendorTotalContainer}>
                      <Text style={styles.vendorTotalText}>
                        Vendor Total: ₹{vendorData.vendorTotal.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Address and Payment Info */}
                <View style={styles.bottomSection}>
                  <View style={styles.addressContainer}>
                    <Text style={styles.sectionHeader}>Delivery Address:</Text>
                    <View style={styles.addressCard}>
                      <Text style={styles.addressTextBold}>
                        {order.address?.fullName}
                      </Text>
                      <Text style={styles.addressText}>
                        {order.address?.street}
                      </Text>
                      {order.address?.street2 ? (
                        <Text style={styles.addressText}>
                          {order.address.street2}
                        </Text>
                      ) : null}
                      {order.address?.landmark ? (
                        <Text style={styles.addressText}>
                          Near {order.address.landmark}
                        </Text>
                      ) : null}
                      <Text style={styles.addressText}>
                        {order.address?.city}, {order.address?.state} -{" "}
                        {order.address?.zipCode}
                      </Text>
                      <Text style={styles.addressText}>
                        {order.address?.country}
                      </Text>
                      <Text style={styles.addressPhone}>
                        Phone: {order.address?.phone}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.paymentContainer}>
                    <Text style={styles.sectionHeader}>Payment Details:</Text>
                    <View style={styles.paymentCard}>
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Payment Method:</Text>
                        <Text style={styles.paymentValue}>
                          {order.paymentMethod}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Order Total:</Text>
                        <Text style={styles.totalValue}>
                          ₹{order.total?.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      {/* <Navbar /> */}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F5F0", // neutralLightGray
    paddingTop: Platform.OS === "android" ? 50 : 0, // Adjust for status bar on Android
  },
  scrollViewContent: {
    paddingVertical: 10, // py-6 reduced
    paddingHorizontal: 15, // px-3 sm:px-4 lg:px-6 reduced
    paddingBottom: 180, // Space for Navbar
  },
  header: {
    fontSize: 28, // sm:text-4xl reduced
    fontWeight: "bold",
    marginBottom: 20, // mb-6 reduced
    textAlign: "center",
    color: "#1F2937", // headingGray
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8, // gap-2 reduced
    marginBottom: 20, // mb-6 reduced
    justifyContent: "center",
    padding: 6, // p-1.5 reduced
    backgroundColor: "white",
    borderRadius: 8, // rounded-lg reduced
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3, // For Android shadow
    borderWidth: 1,
    borderColor: "#F8F5F0", // gray-100
  },
  filterButton: {
    paddingHorizontal: 12, // px-3 reduced
    paddingVertical: 6, // py-1 reduced
    borderRadius: 20, // rounded-full
    transitionDuration: 300,
    transitionProperty: "transform",
    transitionTimingFunction: "ease-in-out",
  },
  filterButtonText: {
    fontSize: 10, // text-xs reduced
    fontWeight: "600", // font-semibold
    letterSpacing: 0.5, // tracking-wide
  },
  messageText: {
    fontSize: 14, // text-base reduced
    textAlign: "center",
    marginVertical: 10, // my-6 reduced
    color: "#006039", // rolexGreen
  },
  errorText: {
    color: "#DC2626", // red-600
    fontSize: 14, // text-base reduced
    textAlign: "center",
    marginVertical: 10, // my-6 reduced
  },
  ordersList: {
    gap: 16, // space-y-4 reduced
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F8F5F0", // gray-200
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  orderHeader: {
    padding: 12, // p-3 sm:p-4 reduced
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start", // sm:items-center
    gap: 6, // gap-1.5 reduced
    // Linear gradient can be achieved with a library like 'react-native-linear-gradient'
    // For simplicity, using a single color here.
    // If you need the gradient, install and import 'expo-linear-gradient' or 'react-native-linear-gradient'
    // For example: <LinearGradient colors={[rolexGreen, '#009632']} style={styles.orderHeader}>
  },
  orderIdText: {
    fontSize: 14, // text-base sm:text-lg reduced
    fontWeight: "bold",
    letterSpacing: 0.75, // tracking-wide
    color: "white",
  },
  orderDateText: {
    fontSize: 10, // text-2xs reduced
    opacity: 0.9,
    marginTop: 2, // mt-0.5 reduced
    color: "white",
    fontWeight: "300", // font-light
  },
  statusBadge: {
    paddingHorizontal: 8, // px-2 reduced
    paddingVertical: 2, // py-0.5 reduced
    borderRadius: 20, // rounded-full
    alignSelf: "flex-start", // To prevent stretching
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10, // text-2xs reduced
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5, // tracking-wide
  },
  orderBody: {
    padding: 12, // p-3 sm:p-4 reduced
  },
  cancelButtonContainer: {
    alignItems: "flex-end",
    marginBottom: 12, // mb-3 reduced
  },
  cancelButton: {
    paddingHorizontal: 12, // px-3 reduced
    paddingVertical: 6, // py-1 reduced
    backgroundColor: "#DC2626", // red-600
    borderRadius: 6, // rounded-md
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButtonText: {
    color: "white",
    fontSize: 12, // text-xs
    fontWeight: "600",
  },
  vendorGroupCard: {
    marginBottom: 16, // mb-4 reduced
    borderWidth: 1,
    borderColor: "#F8F5F0", // gray-200
    borderRadius: 6, // rounded-md
    padding: 12, // p-3 reduced
    backgroundColor: "#F9FAFB", // neutralLightGray
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  vendorHeader: {
    fontSize: 14, // text-base reduced
    fontWeight: "bold",
    marginBottom: 8, // mb-2 reduced
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#1F2937", // headingGray
  },
  callVendorLink: {
    textDecorationLine: "underline",
    color: "#A37E2C", // rolexGold
  },
  vendorItemsList: {
    gap: 8, // space-y-2 reduced
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start", // sm:items-center
    gap: 8, // gap-2 reduced
    padding: 8, // p-2 reduced
    borderWidth: 1,
    borderColor: "#F8F5F0", // gray-100
    borderRadius: 4, // rounded-sm
    backgroundColor: "#F8F5F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  itemImage: {
    width: 48, // w-12
    height: 48, // h-12
    objectFit: "cover", // object-cover
    borderRadius: 2, // rounded-xs
    borderWidth: 1,
    borderColor: "#E5E7EB", // gray-200
    flexShrink: 0,
  },
  itemDetails: {
    flex: 1,
    fontSize: 12, // text-xs
  },
  itemName: {
    fontWeight: "600", // font-semibold
    color: "#1F2937", // headingGray
  },
  itemQuantityPrice: {
    fontSize: 10, // text-2xs reduced
    color: "#4B5563", // text-gray
    marginTop: 0, // mt-0
  },
  itemTotalPrice: {
    color: "#1F2937", // headingGray
    fontWeight: "bold",
    fontSize: 14, // text-sm sm:text-base reduced
    marginTop: 2, // mt-0.5 sm:mt-0 reduced
  },
  vendorTotalContainer: {
    marginTop: 12, // mt-3 reduced
    paddingTop: 12, // pt-3 reduced
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB", // gray-200
    alignItems: "flex-end",
  },
  vendorTotalText: {
    fontWeight: "bold",
    fontSize: 14, // text-base reduced
    color: "#006039", // rolexGreen
  },
  bottomSection: {
    marginTop: 16, // mt-4 reduced
    paddingTop: 16, // pt-4 reduced
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB", // gray-200
    flexDirection: "column", // grid grid-cols-1 md:grid-cols-2
    gap: 16, // gap-4 reduced
  },
  addressContainer: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14, // text-sm reduced
    fontWeight: "600", // font-semibold
    marginBottom: 8, // mb-2 reduced
    color: "#1F2937", // headingGray
  },
  addressCard: {
    backgroundColor: "#F8F5F0",
    padding: 12, // p-3 reduced
    borderRadius: 6, // rounded-md
    borderWidth: 1,
    borderColor: "#E5E7EB", // gray-200
    fontSize: 12, // text-xs
    color: "#4B5563", // text-gray
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  addressTextBold: {
    fontWeight: "500", // font-medium
  },
  addressText: {
    // default text styles from parent
  },
  addressPhone: {
    marginTop: 6, // mt-1.5 reduced
    fontWeight: "500", // font-medium
    color: "#006039", // rolexGreen
  },
  paymentContainer: {
    flex: 1,
  },
  paymentCard: {
    backgroundColor: "white",
    padding: 12, // p-3 reduced
    borderRadius: 6, // rounded-md
    borderWidth: 1,
    borderColor: "#E5E7EB", // gray-200
    fontSize: 12, // text-xs
    color: "#4B5563", // text-gray
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6, // mb-1.5 reduced
  },
  paymentLabel: {
    // default text styles from parent
  },
  paymentValue: {
    fontWeight: "600", // font-semibold
    textTransform: "capitalize",
    color: "#006039", // rolexGreen
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 14, // text-base sm:text-lg reduced
    marginTop: 12, // mt-3 reduced
    paddingTop: 12, // pt-3 reduced
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB", // gray-200
  },
  totalLabel: {
    // default text styles from parent
  },
  totalValue: {
    color: "#006039", // rolexGreen
  },
});

export default UserOrderScreen;
