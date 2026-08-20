// src/screens/OrderScreen.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  RefreshControl,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  fetchUserOrders,
  cancelUserOrder,
  Order,
  OrderItem,
} from "../features/orders/orderSlice";
import { RootState } from "../app/store";
import Toast from "react-native-toast-message";

// --- Helper: Infer product unit ---
const getProductUnit = (item: OrderItem): string => {
  if (item.unit) return item.unit;
  const name = item.name?.toLowerCase() || "";
  const category = (item as any).category?.toLowerCase() || "";

  if (
    name.includes("kg") ||
    name.includes("gram") ||
    name.includes("gm") ||
    category.includes("grocery") ||
    category.includes("vegetable") ||
    category.includes("fruit") ||
    category.includes("meat") ||
    category.includes("fish") ||
    category.includes("dairy") ||
    category.includes("bakery") ||
    category.includes("spice") ||
    category.includes("oil") ||
    category.includes("flour")
  ) {
    return "kg";
  }

  if ((item as any).sizes?.some((s: string) => /^[A-Z]+$/.test(s) || /^\d+$/.test(s))) {
    return "units";
  }

  return "units";
};

// --- VendorGroup interface ---
interface VendorGroup {
  vendorName: string;
  vendorPhone?: string;
  vendorId: string;
  items: OrderItem[];
  vendorTotal: number;
}

const UserOrderScreen: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const userId = user?._id;

  const { orders, loading, error } = useSelector(
    (state: RootState) => state.order
  );

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // --- Fetch orders ---
  const fetchOrders = useCallback(async () => {
    if (!userId) {
      console.warn("User ID not found.");
      return;
    }
    try {
      await dispatch(fetchUserOrders(userId)).unwrap();
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to refresh orders",
        text2: err as string,
      });
    }
  }, [dispatch, userId]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchOrders();
    }
  }, [userId, fetchOrders]);

  // --- Pull-to-refresh handler ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  // --- Manual refresh button handler ---
  const handleRefreshPress = useCallback(() => {
    if (!loading && !refreshing) {
      onRefresh();
    }
  }, [loading, refreshing, onRefresh]);

  // --- Cancel order ---
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            dispatch(cancelUserOrder(orderId))
              .unwrap()
              .then(() => Toast.show({ type: "success", text1: "Order cancelled." }))
              .catch((err) => Toast.show({ type: "error", text1: err || "Cancel failed." }));
          },
        },
      ],
      { cancelable: false }
    );
  };

  // --- Filter and deduplicate orders ---
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((order) => {
      if (activeFilter === "All") return true;
      return order.status.toLowerCase() === activeFilter.toLowerCase();
    });
    const uniqueMap = new Map<string, Order>();
    filtered.forEach((order) => uniqueMap.set(order._id, order));
    return Array.from(uniqueMap.values());
  }, [orders, activeFilter]);

  // Group by vendor
  const ordersGroupedByVendor = useMemo(() => {
    return filteredOrders.map((order) => {
      const vendorsMap = new Map<string, VendorGroup>();
      order.items.forEach((item) => {
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
        const vendorData = vendorsMap.get(vendorKey)!;
        vendorData.items.push(item);
        vendorData.vendorTotal += item.quantity * item.price;
      });
      return {
        ...order,
        vendors: Array.from(vendorsMap.values()),
      };
    });
  }, [filteredOrders]);

  // --- Colors ---
  const rolexGreen = "#006039";
  const rolexGold = "#A37E2C";
  const textGray = "#4B5563";

  const getStatusStyles = (status: Order["status"]) => {
    switch (status) {
      case "placed":
        return { backgroundColor: "#FFFBEB", color: "#D97706", borderColor: "#FEF3C7" };
      case "processing":
        return { backgroundColor: "#EFF6FF", color: "#2563EB", borderColor: "#DBEAFE" };
      case "shipped":
        return { backgroundColor: "#F5F3FF", color: "#7C3AED", borderColor: "#EDE9FE" };
      case "delivered":
        return { backgroundColor: "#ECFDF5", color: "#059669", borderColor: "#D1FAE5" };
      case "cancelled":
        return { backgroundColor: "#FEF2F2", color: "#DC2626", borderColor: "#FEE2E2" };
      default:
        return { backgroundColor: "#F9FAFB", color: "#4B5563", borderColor: "#E5E7EB" };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[rolexGreen]} />
        }
      >
        {/* Header with Refresh Button */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>
            Your Orders <Text style={{ color: rolexGreen }}>•</Text>{" "}
            <Text style={{ color: rolexGold }}>History</Text>
          </Text>
          <TouchableOpacity
            onPress={handleRefreshPress}
            disabled={loading || refreshing}
            style={styles.refreshButton}
          >
            <Ionicons
              name="refresh-outline"
              size={24}
              color={loading || refreshing ? "#aaa" : rolexGreen}
            />
          </TouchableOpacity>
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {["All", "Placed", "Processing", "Shipped", "Delivered", "Cancelled"].map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setActiveFilter(status)}
              style={[
                styles.filterButton,
                activeFilter === status
                  ? { backgroundColor: rolexGreen, transform: [{ scale: 1.05 }] }
                  : { backgroundColor: "#E5E7EB" },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  activeFilter === status ? { color: "white" } : { color: textGray },
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !refreshing && <ActivityIndicator size="large" color={rolexGreen} style={styles.messageText} />}
        {error && <Text style={styles.errorText}>❌ Error: {error}</Text>}
        {!loading && orders.length === 0 && (
          <Text style={styles.messageText}>No orders yet. Start shopping!</Text>
        )}
        {!loading && orders.length > 0 && filteredOrders.length === 0 && (
          <Text style={styles.messageText}>
            No orders with status: <Text style={{ fontWeight: "600", color: rolexGreen }}>{activeFilter}</Text>
          </Text>
        )}

        <View style={styles.ordersList}>
          {ordersGroupedByVendor.map((order) => (
            <View key={order._id} style={styles.orderCard}>
              {/* Order Header */}
              <View style={[styles.orderHeader, { backgroundColor: rolexGreen }]}>
                <View>
                  <Text style={styles.orderIdText}>Order #{order._id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.orderDateText}>
                    Placed on: {dayjs(order.createdAt).format("MMM D, YYYY [at] h:mm A")}
                  </Text>
                </View>
                <View style={[styles.statusBadge, getStatusStyles(order.status)]}>
                  <Text style={[styles.statusBadgeText, { color: getStatusStyles(order.status).color }]}>
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.orderBody}>
                {/* Cancel Button */}
                {["placed", "processing"].includes(order.status) && (
                  <View style={styles.cancelButtonContainer}>
                    <TouchableOpacity onPress={() => handleCancelOrder(order._id)} style={styles.cancelButton}>
                      <Text style={styles.cancelButtonText}>Cancel Order</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Vendor Groups */}
                {order.vendors.map((vendorData, vendorIdx) => (
                  <View key={vendorData.vendorId || vendorIdx} style={styles.vendorGroupCard}>
                    <Text style={styles.vendorHeader}>
                      Items from <Text style={{ color: rolexGreen }}>{vendorData.vendorName}</Text>
                      {vendorData.vendorPhone && (
                        <Text style={{ color: rolexGold, fontSize: 10 }}>
                          {" "}
                          📞 <Text style={styles.callVendorLink}>Call Vendor</Text>
                        </Text>
                      )}
                    </Text>

                    <View style={styles.vendorItemsList}>
                      {vendorData.items.map((item, itemIdx) => {
                        // --- UNIQUE KEY: use item._id if exists, otherwise combine productId and size ---
                        const uniqueKey = item._id || `${item.productId}_${item.size || 'default'}`;
                        const unit = getProductUnit(item);
                        return (
                          <View key={uniqueKey} style={styles.itemCard}>
                            <Image
                              source={{
                                uri: item.productImage || "https://via.placeholder.com/100?text=No+Image",
                              }}
                              style={styles.itemImage}
                            />
                            <View style={styles.itemDetails}>
                              <View style={styles.itemNameRow}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {item.size && (
                                  <View style={styles.sizeBadge}>
                                    <Text style={styles.sizeText}>{item.size}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.itemQuantityPrice}>
                                Qty: <Text style={{ fontWeight: "500" }}>{item.quantity} {unit}</Text> × ₹{item.price.toFixed(2)}
                              </Text>
                            </View>
                            <Text style={styles.itemTotalPrice}>
                              ₹{(item.quantity * item.price).toFixed(2)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.vendorTotalContainer}>
                      <Text style={styles.vendorTotalText}>Vendor Total: ₹{vendorData.vendorTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                ))}

                {/* Address and Payment */}
                <View style={styles.bottomSection}>
                  <View style={styles.addressContainer}>
                    <Text style={styles.sectionHeader}>Delivery Address:</Text>
                    <View style={styles.addressCard}>
                      <Text style={styles.addressTextBold}>{order.address?.fullName}</Text>
                      <Text style={styles.addressText}>{order.address?.street}</Text>
                      {order.address?.street2 && <Text style={styles.addressText}>{order.address.street2}</Text>}
                      {order.address?.landmark && <Text style={styles.addressText}>Near {order.address.landmark}</Text>}
                      <Text style={styles.addressText}>
                        {order.address?.city}, {order.address?.state} - {order.address?.zipCode}
                      </Text>
                      <Text style={styles.addressText}>{order.address?.country}</Text>
                      <Text style={styles.addressPhone}>Phone: {order.address?.phone}</Text>
                    </View>
                  </View>

                  <View style={styles.paymentContainer}>
                    <Text style={styles.sectionHeader}>Payment Details:</Text>
                    <View style={styles.paymentCard}>
                      <View style={styles.paymentRow}>
                        <Text style={styles.paymentLabel}>Payment Method:</Text>
                        <Text style={styles.paymentValue}>{order.paymentMethod}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Order Total:</Text>
                        <Text style={styles.totalValue}>₹{order.total?.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <Toast />
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F5F0", paddingTop: Platform.OS === "android" ? 50 : 0 },
  scrollViewContent: { paddingVertical: 10, paddingHorizontal: 15, paddingBottom: 180 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  header: { fontSize: 28, fontWeight: "bold", color: "#1F2937" },
  refreshButton: {
    padding: 8,
    borderRadius: 30,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
    justifyContent: "center",
    padding: 6,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F8F5F0",
  },
  filterButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterButtonText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  messageText: { fontSize: 14, textAlign: "center", marginVertical: 10, color: "#006039" },
  errorText: { color: "#DC2626", fontSize: 14, textAlign: "center", marginVertical: 10 },
  ordersList: { gap: 16 },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F8F5F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  orderHeader: { padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 },
  orderIdText: { fontSize: 14, fontWeight: "bold", letterSpacing: 0.75, color: "white" },
  orderDateText: { fontSize: 10, opacity: 0.9, marginTop: 2, color: "white", fontWeight: "300" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, alignSelf: "flex-start", borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  orderBody: { padding: 12 },
  cancelButtonContainer: { alignItems: "flex-end", marginBottom: 12 },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#DC2626",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButtonText: { color: "white", fontSize: 12, fontWeight: "600" },
  vendorGroupCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F8F5F0",
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#F9FAFB",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#1F2937",
  },
  callVendorLink: { textDecorationLine: "underline", color: "#A37E2C" },
  vendorItemsList: { gap: 8 },
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#F8F5F0",
    borderRadius: 4,
    backgroundColor: "#F8F5F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  itemImage: { width: 48, height: 48, resizeMode: "cover", borderRadius: 2, borderWidth: 1, borderColor: "#E5E7EB", flexShrink: 0 },
  itemDetails: { flex: 1 },
  itemNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  itemName: { fontWeight: "600", color: "#1F2937", marginRight: 4 },
  sizeBadge: { backgroundColor: "#006039", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 12, marginLeft: 4 },
  sizeText: { fontSize: 9, fontWeight: "600", color: "white" },
  itemQuantityPrice: { fontSize: 10, color: "#4B5563", marginTop: 0 },
  itemTotalPrice: { color: "#1F2937", fontWeight: "bold", fontSize: 14, marginTop: 2 },
  vendorTotalContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB", alignItems: "flex-end" },
  vendorTotalText: { fontWeight: "bold", fontSize: 14, color: "#006039" },
  bottomSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB", flexDirection: "column", gap: 16 },
  addressContainer: { flex: 1 },
  sectionHeader: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#1F2937" },
  addressCard: {
    backgroundColor: "#F8F5F0",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  addressTextBold: { fontWeight: "500" },
  addressText: { fontSize: 12, color: "#4B5563" },
  addressPhone: { marginTop: 6, fontWeight: "500", color: "#006039" },
  paymentContainer: { flex: 1 },
  paymentCard: {
    backgroundColor: "white",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  paymentLabel: { fontSize: 12, color: "#4B5563" },
  paymentValue: { fontWeight: "600", textTransform: "capitalize", color: "#006039" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontWeight: "bold",
    fontSize: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  totalLabel: { fontSize: 12, color: "#4B5563" },
  totalValue: { color: "#006039", fontWeight: "bold" },
});

export default UserOrderScreen;