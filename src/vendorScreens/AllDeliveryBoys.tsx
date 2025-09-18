// AllDeliveryBoys.tsx (Updated for React Native/Expo)

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Truck,
  Badge,
  Package,
  CreditCard,
  AlertTriangle,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  fetchOrderById,
  assignDeliveryBoy as assignOrderThunk,
} from "../features/orders/orderSlice";
import { RootState, AppDispatch } from "../app/store";
import { RootStackParamList } from "../../App";
import config from "../../src/config/config"; // Import the config file

// Define the route and navigation prop types for this screen
type AssignDeliveryBoyRouteProp = RouteProp<
  RootStackParamList,
  "ActiveDeliveryBoys"
>;
type AssignDeliveryBoyNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ActiveDeliveryBoys"
>;

// Helper to get the vendor token from AsyncStorage
const getVendorToken = async () => {
  try {
    return await AsyncStorage.getItem("vendorToken");
  } catch (e) {
    console.error("Failed to get vendor token from AsyncStorage", e);
    return null;
  }
};

const AllDeliveryBoys = () => {
  const dispatch = useDispatch<AppDispatch>();
  const route = useRoute<AssignDeliveryBoyRouteProp>();
  const navigation = useNavigation<AssignDeliveryBoyNavigationProp>();

  const { orderId } = route.params;

  // Use local state for delivery boys
  const [allDeliveryBoys, setAllDeliveryBoys] = useState([]);
  const [deliveryBoyLoading, setDeliveryBoyLoading] = useState(false);
  const [deliveryBoyError, setDeliveryBoyError] = useState<string | null>(null);

  const orderState = useSelector((state: RootState) => state.order);
  const {
    selectedOrder: orderDetails,
    isLoading: orderLoading,
    error: orderError,
  } = orderState || {
    selectedOrder: null,
    isLoading: false,
    error: null,
  };

  const hasBeenAssigned = !!orderDetails?.deliveryBoy;

  // Fetch delivery boys and order details on component mount
  useEffect(() => {
    const fetchDeliveryBoys = async () => {
      setDeliveryBoyLoading(true);
      setDeliveryBoyError(null);
      try {
        const response = await fetch(`${config.apiUrl}/deliveryboy/all`);
        if (!response.ok) {
          throw new Error("Failed to fetch delivery boys");
        }
        const data = await response.json();
        setAllDeliveryBoys(data);
      } catch (error: any) {
        setDeliveryBoyError(error.message);
      } finally {
        setDeliveryBoyLoading(false);
      }
    };

    if (orderId) {
      dispatch(fetchOrderById(orderId));
    }
    fetchDeliveryBoys();
  }, [orderId, dispatch]);

  const handleAssign = async (
    deliveryBoyId: string,
    deliveryBoyName: string
  ) => {
    if (!orderDetails) {
      Toast.show({ type: "error", text1: "Order details are missing." });
      return;
    }

    if (hasBeenAssigned) {
      Toast.show({ type: "info", text1: "Order is already assigned." });
      return;
    }

    Alert.alert(
      "Confirm Assignment",
      `Are you sure you want to assign this order to ${deliveryBoyName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Assign",
          onPress: async () => {
            const token = await getVendorToken();
            if (!token) {
              Toast.show({
                type: "error",
                text1: "Authentication failed.",
                text2: "Please log in as a vendor to assign orders.",
              });
              return;
            }

            try {
              const result = await dispatch(
                assignOrderThunk({ orderId: orderDetails._id, deliveryBoyId })
              ).unwrap();

              if (result.success) {
                Toast.show({
                  type: "success",
                  text1: "✅ Delivery boy assigned successfully.",
                  text2: `${deliveryBoyName} is on the way!`,
                });
                navigation.goBack();
              } else {
                Toast.show({
                  type: "error",
                  text1: "❌ Assignment failed.",
                  text2: result.message || "An unexpected error occurred.",
                });
              }
            } catch (err: any) {
              Toast.show({
                type: "error",
                text1: "❌ Assignment failed.",
                text2: err.message || "Network error or server is unreachable.",
              });
            }
          },
        },
      ]
    );
  };

  if (orderLoading || deliveryBoyLoading || !orderId) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#4B5563" />
        <Text style={styles.loadingText}>
          {orderId
            ? "Loading order and delivery boys..."
            : "Order ID is missing."}
        </Text>
      </View>
    );
  }

  if (orderError || deliveryBoyError) {
    return (
      <View style={styles.centeredContainer}>
        <AlertTriangle color="red" size={48} />
        <Text style={styles.errorText}>{orderError || deliveryBoyError}</Text>
      </View>
    );
  }

  if (!orderDetails) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="red" />
        <Text style={styles.errorText}>
          Order not found or could not be loaded.
        </Text>
      </View>
    );
  }

  const assignedDeliveryBoy = orderDetails?.deliveryBoy
    ? allDeliveryBoys.find((boy) => boy._id === orderDetails.deliveryBoy)
    : null;

  if (hasBeenAssigned && assignedDeliveryBoy) {
    return (
      <ScrollView style={styles.container}>
        <View style={[styles.card, styles.assignedCard]}>
          <View style={styles.assignedHeader}>
            <Truck size={32} color="white" />
            <Text style={styles.assignedTitle}>Order Assigned!</Text>
          </View>
          <View style={styles.assignedContent}>
            <Text style={styles.assignedText}>
              Order #
              <Text style={styles.orderIdText}>
                {orderDetails?._id.slice(-8)}
              </Text>{" "}
              is assigned to:
            </Text>
            <View style={styles.boyInfo}>
              <User size={20} color="#065F46" />
              <Text style={styles.boyNameAssigned}>
                {assignedDeliveryBoy.name}
              </Text>
            </View>
            <View style={styles.boyInfo}>
              <Phone size={20} color="#065F46" />
              <Text style={styles.boyDetailText}>
                {assignedDeliveryBoy.phone}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back to Orders</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assign Delivery Boy</Text>
        <Text style={styles.headerSubtitle}>
          Order #
          <Text style={styles.orderIdHighlight}>
            {orderDetails?._id.slice(-8)}
          </Text>
        </Text>
      </View>

      <View style={styles.orderDetailsCard}>
        <Text style={styles.cardTitle}>Order Details</Text>
        <Text style={styles.detailText}>
          <Text style={styles.detailLabel}>Customer:</Text>{" "}
          {orderDetails?.userId?.name || "N/A"}
        </Text>
        <Text style={styles.detailText}>
          <Text style={styles.detailLabel}>Total:</Text> ₹
          {orderDetails?.total?.toFixed(2) || "N/A"}
        </Text>
        <Text style={styles.detailText}>
          <Text style={styles.detailLabel}>Address:</Text>{" "}
          {orderDetails?.address?.street || "N/A"},{" "}
          {orderDetails?.address?.city || "N/A"}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Select an Available Delivery Boy</Text>

      {allDeliveryBoys.length === 0 ? (
        <View style={styles.emptyState}>
          <User size={48} color="#9CA3AF" />
          <Text style={styles.noDataText}>No delivery boys found.</Text>
        </View>
      ) : (
        allDeliveryBoys.map((boy) => (
          <TouchableOpacity
            key={boy._id}
            style={styles.deliveryBoyCard}
            onPress={() => handleAssign(boy._id, boy.name)}
            disabled={!boy.isAvailable}
          >
            <View>
              <Text style={styles.boyName}>{boy.name}</Text>
              <Text style={styles.boyDetail}>Phone: {boy.phone}</Text>
            </View>
            <View
              style={[
                styles.statusIndicator,
                !boy.isAvailable && styles.offlineStatus,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  !boy.isAvailable && styles.offlineText,
                ]}
              >
                {boy.isAvailable ? "Available" : "Offline"}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    padding: 16,
    marginVertical:40
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#4B5563",
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
  },
  headerTitle: {
    paddingTop:30,
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 4,
  },
  orderIdHighlight: {
    fontWeight: "bold",
    color: "#1F2937",
  },
  orderDetailsCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: "bold",
    color: "#1F2937",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
    color: "#1F2937",
  },
  emptyState: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    marginTop: 20,
  },
  noDataText: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 10,
    fontSize: 16,
  },
  deliveryBoyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    
  },
  boyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  boyDetail: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  offlineStatus: {
    backgroundColor: "#E5E7EB",
  },
  statusText: {
    color: "#065F46",
    fontWeight: "bold",
    fontSize: 12,
    marginLeft: 4,
  },
  offlineText: {
    color: "#6B7280",
  },
  // Styles for Assigned Card
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  assignedCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  assignedHeader: {
    backgroundColor: "#065F46",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  assignedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginLeft: 10,
  },
  assignedContent: {
    padding: 20,
  },
  assignedText: {
    fontSize: 16,
    color: "#10B981",
    marginBottom: 10,
  },
  orderIdText: {
    fontWeight: "bold",
    color: "#065F46",
  },
  boyInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginLeft: 8,
  },
  boyNameAssigned: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#065F46",
  },
  boyDetailText: {
    fontSize: 16,
    marginLeft: 8,
    color: "#10B981",
  },
  backButton: {
    backgroundColor: "#4B5563",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  backButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default AllDeliveryBoys;
