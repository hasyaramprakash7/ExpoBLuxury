// src/vendorScreens/VendorOrderList.tsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchVendorOrders,
  updateVendorOrderStatus,
  clearVendorOrderError,
  setOrdersFromCache,
} from "../features/vendor/vendorOrderSlice";
import { RootState, AppDispatch } from "../app/store";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Linking,
  Platform,
  Dimensions,
  PanResponder,
  Animated,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Toast from "react-native-toast-message";
import WhatsappInvoiceSender from "./WhatsappInvoiceSender";
import { ShoppingCart, Truck } from "lucide-react-native";
import { Audio } from "expo-av";

// --- DayJS Configuration ---
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.updateLocale("en", {
  relativeTime: {
    future: "in %s",
    past: "%s ago",
    s: "a few seconds",
    m: "a minute",
    mm: "%d minutes",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },
});

const statusOptions = [
  "all",
  "placed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

// --- Type Definitions ---
type RootStackParamList = {
  AuthStack: undefined;
  UserMainStack: undefined;
  VendorMainStack: undefined;
  DeliveryBoyMainStack: undefined;
  VendorLogin: undefined;
  VendorDashboard: undefined;
  VendorProductCRUD: undefined;
  VendorOrderList: undefined;
  ActiveDeliveryBoys: { orderId: string };
  VendorGenerateInvoice: { orderData: any; vendorData: any };
};

type VendorOrderListNavigationProp = StackNavigationProp<
  RootStackParamList,
  "VendorOrderList"
>;

interface Address {
  fullName?: string;
  street?: string;
  street2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}

interface Order {
  _id: string;
  status: string;
  items: Array<any>;
  user: { name?: string; phone?: string; email?: string };
  address: Address;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  total: number;
  vendorTotal?: number;
  deliveryBoy?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    isAvailable: boolean;
  };
}

interface VendorData {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: Address;
}

// --- Constants ---
const rolexGreen = "#006039";
const rolexGold = "#A37E2C";
const neutralLightGray = "#F8F5F0";
const subtleBorder = "#E5E7EB";
const textGray = "#4B5563";
const headingGray = "#1F2937";
const CACHE_KEY = "vendorOrdersCache";

const SCREEN_WIDTH = Dimensions.get("window").width;
const BUTTON_SIZE = 55;
const PADDING = 15;
const INITIAL_X = SCREEN_WIDTH - BUTTON_SIZE - PADDING;
const INITIAL_Y = Platform.OS === "android" ? 65 : 40;

// --- Audio Sound Object (Global ref to avoid recreation) ---
let soundObject: Audio.Sound | null = null;

// --- Helper: Infer product unit ---
const getProductUnit = (product: any): string => {
  if (product?.unit) return product.unit;
  const name = product?.name?.toLowerCase() || "";
  const category = product?.category?.toLowerCase() || "";
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
  if (product?.sizes?.some((s: string) => /^[A-Z]+$/.test(s) || /^\d+$/.test(s))) {
    return "units";
  }
  return "units";
};

// --- Floating Logistics Buttons Component ---
const FloatingLogisticsButtons = () => {
  const pan = useRef(
    new Animated.ValueXY({ x: INITIAL_X, y: INITIAL_Y }),
  ).current;
  const positionRef = useRef({ x: INITIAL_X, y: INITIAL_Y });
  pan.addListener((value) => (positionRef.current = value));

  const handleOpenLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Toast.show({
        type: "error",
        text1: "Link Error",
        text2: `Cannot open link: ${url}`,
      });
    }
  };

  const snapToEdge = () => {
    const currentX = positionRef.current.x;
    let targetX;
    if (currentX + BUTTON_SIZE / 2 < SCREEN_WIDTH / 2) {
      targetX = PADDING;
    } else {
      targetX = SCREEN_WIDTH - BUTTON_SIZE - PADDING;
    }
    Animated.spring(pan, {
      toValue: { x: targetX, y: positionRef.current.y },
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: positionRef.current.x,
          y: positionRef.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          {
            dx: pan.x,
            dy: pan.y,
          },
        ],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        snapToEdge();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{
        transform: [{ translateX: pan.x }, { translateY: pan.y }],
        position: "absolute",
        zIndex: 100,
        gap: 10,
        alignItems: "center",
      }}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[floatingStyles.buttonBase, { backgroundColor: "#FF6347" }]}
        onPress={() => handleOpenLink("https://app.shiprocket.in/newlogin")}
      >
        <Image
          source={require("../../assets/Shiprocket to hire 100 people, expand to Middle East.jpg")}
          style={floatingStyles.image}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[floatingStyles.buttonBase, { backgroundColor: "#FFC72C" }]}
        onPress={() => handleOpenLink("https://www.rapido.bike/Home")}
      >
        <Image
          source={require("../../assets/Rapido Logo.jpg")}
          style={floatingStyles.image}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- Audio Helper Functions ---
const loadNewOrderSound = async () => {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/ttsMP3.com_VoiceText_2025-8-18_11-48-44.mp3")
    );
    soundObject = sound;
    await soundObject.setIsLoopingAsync(true);
    return soundObject;
  } catch (error) {
    console.error("Failed to load sound:", error);
    return null;
  }
};

const playNewOrderSound = async () => {
  try {
    if (!soundObject) {
      await loadNewOrderSound();
    }
    if (soundObject) {
      await soundObject.playAsync();
    }
  } catch (error) {
    console.error("Failed to play sound:", error);
  }
};

const stopNewOrderSound = async () => {
  try {
    if (soundObject) {
      await soundObject.stopAsync();
      await soundObject.setPositionAsync(0);
    }
  } catch (error) {
    // Silently handle audio errors
  }
};

const unloadSound = async () => {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }
  } catch (error) {
    // Silently handle audio errors
  }
};

// --- Main Component ---
const VendorOrderList = () => {
  const dispatch: AppDispatch = useDispatch();
  const navigation = useNavigation<VendorOrderListNavigationProp>();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);

  const {
    orders = [],
    loading,
    error,
  } = useSelector((state: RootState) => state.vendorOrders);

  const vendor: VendorData = useSelector(
    (state: RootState) => state.vendorAuth.vendor,
  );
  const vendorId = vendor?._id;

  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [isNewOrderAlertActive, setIsNewOrderAlertActive] = useState(false);
  const [unseenOrderCount, setUnseenOrderCount] = useState(0);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- Load sound on mount ---
  useEffect(() => {
    loadNewOrderSound();
    return () => {
      unloadSound();
    };
  }, []);

  // --- AsyncStorage Caching ---
  const saveOrdersToCache = async (orders: Order[]) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(orders));
    } catch (e) {
      console.warn("Failed to save orders to cache:", e);
    }
  };

  const loadOrdersFromCache = useCallback(async () => {
    try {
      const cachedOrders = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedOrders) {
        const parsedOrders: Order[] = JSON.parse(cachedOrders);
        dispatch(setOrdersFromCache(parsedOrders));
        return true;
      }
    } catch (e) {
      console.warn("Failed to load orders from cache:", e);
    }
    return false;
  }, [dispatch]);

  // --- Fetch Orders ---
  const fetchOrders = useCallback(
    async (
      pageToFetch: number,
      pageSize: number,
      isInitialLoad: boolean,
      isRefresh: boolean = false,
    ) => {
      if (!vendorId) {
        console.warn("VendorOrderList: Vendor ID not available.");
        return;
      }
      if (!isInitialLoad) setIsLoadingMore(true);
      if (isRefresh) setIsRefreshing(true);

      try {
        const response = await dispatch(
          fetchVendorOrders({
            vendorId,
            page: pageToFetch,
            pageSize,
            isPaginated: true,
          }),
        ).unwrap();

        setHasMore(response?.hasMore || false);

        if (pageToFetch === 1) {
          saveOrdersToCache(response?.orders || []);
        }

        if (response?.unseenOrdersCount > 0 && isInitialLoad) {
          setUnseenOrderCount(response.unseenOrdersCount);
          setIsNewOrderAlertActive(true);
          playNewOrderSound();
        }
      } catch (e) {
        console.error("Failed to fetch orders:", e);
        Toast.show({
          type: "error",
          text1: "Fetch Error",
          text2: "Failed to load orders.",
        });
      } finally {
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    },
    [vendorId, dispatch],
  );

  const onRefresh = useCallback(() => {
    setPage(1);
    setHasMore(true);
    fetchOrders(1, PAGE_SIZE, true, true);
  }, [fetchOrders]);

  useEffect(() => {
    if (vendorId && isFocused) {
      const initialLoad = async () => {
        const loadedFromCache = await loadOrdersFromCache();
        setPage(1);
        setHasMore(true);
        fetchOrders(1, PAGE_SIZE, !loadedFromCache);
      };
      initialLoad();
    }
    return () => {
      dispatch(clearVendorOrderError());
      stopNewOrderSound();
    };
  }, [vendorId, dispatch, isFocused, fetchOrders, loadOrdersFromCache]);

  useEffect(() => {
    if (isNewOrderAlertActive) {
      const message =
        unseenOrderCount > 0
          ? `You have ${unseenOrderCount} new orders that were placed while you were away.`
          : "A new order has been placed. Please review it now.";
      Alert.alert("New Order Received! 🔔", message, [
        { text: "OK", onPress: () => {
          stopNewOrderSound();
          setIsNewOrderAlertActive(false);
          setUnseenOrderCount(0);
        }},
      ]);
    }
  }, [isNewOrderAlertActive, unseenOrderCount]);

  // --- Scroll ---
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
    if (isCloseToBottom && !loading && !isLoadingMore && hasMore) {
      setPage((prevPage) => {
        const nextPage = prevPage + 1;
        fetchOrders(nextPage, PAGE_SIZE, false);
        return nextPage;
      });
    }
  };

  // --- Helpers ---
  const handleStatusChange = useCallback(
    (orderId: string, currentOrderStatus: string, newStatus: string) => {
      if (currentOrderStatus === newStatus) return;
      Alert.alert(
        "Confirm Status Change",
        `Are you sure you want to change this order's status to "${newStatus}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes",
            onPress: () => {
              if (newStatus === "processing") {
                stopNewOrderSound();
                setIsNewOrderAlertActive(false);
                setUnseenOrderCount(0);
              }
              dispatch(updateVendorOrderStatus({ orderId, newStatus }))
                .unwrap()
                .then(() => {
                  Toast.show({
                    type: "success",
                    text1: `Order ${orderId.slice(-8)} status updated to ${newStatus}.`,
                  });
                })
                .catch((err) => {
                  Toast.show({
                    type: "error",
                    text1: err.message || "Failed to update order status.",
                  });
                });
            },
          },
        ],
      );
    },
    [dispatch],
  );

  const handleAssignDeliveryBoy = (order: Order) => {
    if (!order || !order._id) {
      Toast.show({ type: "error", text1: "Order data is missing." });
      return;
    }
    if (!vendor || !vendor._id) {
      Toast.show({ type: "error", text1: "Vendor data is missing." });
      return;
    }
    try {
      navigation.navigate("ActiveDeliveryBoys", { orderId: order._id });
    } catch (e) {
      console.error("VendorOrderList: Navigation failed:", e);
      Toast.show({
        type: "error",
        text1: "Navigation Error",
        text2: "Could not open delivery boy list.",
      });
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "placed":
        return {
          backgroundColor: "#FFFBEB",
          color: "#D97706",
          borderColor: "#FEF3C7",
        };
      case "processing":
        return {
          backgroundColor: "#EFF6FF",
          color: "#2563EB",
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
          color: "#059669",
          borderColor: "#D1FAE5",
        };
      case "cancelled":
        return {
          backgroundColor: "#FEF2F2",
          color: "#DC2626",
          borderColor: "#FEE2E2",
        };
      default:
        return {
          backgroundColor: "#F9FAFB",
          color: "#4B5563",
          borderColor: "#E5E7EB",
        };
    }
  };

  const getVendorItemsTotal = (order: Order) => {
    const vendorItems = order.items.filter(
      (item: any) => item.vendorId?.toString() === vendorId?.toString(),
    );
    return vendorItems.reduce(
      (acc: number, item: any) => acc + item.quantity * item.price,
      0,
    );
  };

  const getOrderFinancials = (order: Order) => {
    const vendorItemsTotal = getVendorItemsTotal(order);
    const orderTotalFromApi = order.total;
    const otherVendorItemsTotal = order.items
      .filter((item) => item.vendorId?.toString() !== vendorId?.toString())
      .reduce((sum: number, item: any) => sum + item.quantity * item.price, 0);
    const totalFeesCollected =
      orderTotalFromApi - (vendorItemsTotal + otherVendorItemsTotal);
    const netPayout = order.total - totalFeesCollected;
    return {
      vendorItemsTotal,
      totalFeesCollected,
      netPayout,
    };
  };

  const getGoogleMapsRouteUrl = (
    vendorAddress: Address | undefined,
    customerAddress: Address | undefined,
  ) => {
    const vendorLat = vendorAddress?.latitude;
    const vendorLon = vendorAddress?.longitude;
    const customerLat = customerAddress?.latitude;
    const customerLon = customerAddress?.longitude;

    let origin = "";
    let destination = "";

    if (vendorLat && vendorLon) {
      origin = `${vendorLat},${vendorLon}`;
    } else {
      const vendorFullAddress = `${vendorAddress?.street || ""}, ${
        vendorAddress?.city || ""
      }, ${vendorAddress?.state || ""}, ${vendorAddress?.zipCode || ""}`;
      origin = encodeURIComponent(vendorFullAddress);
    }

    if (customerLat && customerLon) {
      destination = `${customerLat},${customerLon}`;
    } else {
      const customerFullAddress = `${customerAddress?.street || ""}, ${
        customerAddress?.city || ""
      }, ${customerAddress?.state || ""}, ${customerAddress?.zipCode || ""}`;
      destination = encodeURIComponent(customerFullAddress);
    }

    if (!origin || !destination) {
      console.warn("Missing origin or destination for Google Maps URL.");
      return `https://www.google.com/maps/search/?api=1&query=${destination}`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

  const renderStatusUpdateButtons = (order: Order) => {
    let nextStatus = null;
    let buttonText = "";
    switch (order.status) {
      case "placed":
        nextStatus = "processing";
        buttonText = "Start Processing";
        break;
      case "processing":
        nextStatus = "shipped";
        buttonText = "Mark as Shipped";
        break;
      case "shipped":
        nextStatus = "delivered";
        buttonText = "Mark as Delivered";
        break;
      default:
        return null;
    }
    return (
      <View style={{ width: "100%", alignItems: "flex-end", marginTop: 12 }}>
        <TouchableOpacity
          onPress={() =>
            handleStatusChange(order._id, order.status, nextStatus)
          }
          style={[styles.actionButton, { width: "auto", paddingHorizontal: 20 }]}
          disabled={loading}
        >
          <Text style={[styles.actionButtonText, { fontSize: 14 }]}>
            {buttonText}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- Memos ---
  const filteredOrders = useMemo(() => {
    return orders.filter((order: Order) => {
      const matchesStatus =
        filterStatus === "all" || order.status === filterStatus;
      const matchesSearch =
        searchTerm === "" ||
        order._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [orders, filterStatus, searchTerm]);

  const totalGrossRevenueAllOrders = useMemo(() => {
    return orders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + getOrderFinancials(order).netPayout, 0);
  }, [orders, vendorId]);

  const totalDeductionsAllOrders = useMemo(() => {
    return orders
      .filter((order) => order.status !== "cancelled")
      .reduce(
        (sum, order) => sum + getOrderFinancials(order).totalFeesCollected,
        0,
      );
  }, [orders, vendorId]);

  const totalCollectedAllOrders =
    totalGrossRevenueAllOrders + totalDeductionsAllOrders;

  // --- Render ---
  return (
    <View style={styles.container}>
      <FloatingLogisticsButtons />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={rolexGreen}
          />
        }
      >
        <Text style={styles.headerTitle}>
          Your Orders <Text style={{ color: rolexGreen }}>•</Text>{" "}
          <Text style={{ color: rolexGold }}>History</Text>
        </Text>

        {/* Financial Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Financial Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ₹{totalCollectedAllOrders.toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Total Collected (Gross)</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ₹{totalGrossRevenueAllOrders.toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Your Payout (Net)</Text>
            </View>
          </View>
          <View style={styles.deductionDetails}>
            <Text style={styles.deductionText}>
              Total Deductions (Fees & GST): ₹
              {totalDeductionsAllOrders.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
          {statusOptions.map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setFilterStatus(status)}
              style={[
                styles.filterButton,
                filterStatus === status
                  ? { backgroundColor: rolexGreen, transform: [{ scale: 1.05 }] }
                  : { backgroundColor: "#E5E7EB" },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === status
                    ? { color: "white" }
                    : { color: textGray },
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order ID or Customer Name"
          placeholderTextColor={textGray}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />

        {/* States */}
        {loading && page === 1 && orders.length === 0 && (
          <ActivityIndicator
            size="large"
            color={rolexGreen}
            style={styles.messageText}
          />
        )}
        {error && (
          <Text style={styles.errorText}>
            ❌ Error retrieving orders: {error || "An unexpected error occurred."}
          </Text>
        )}
        {!loading && orders.length === 0 && (
          <Text style={styles.messageText}>
            It appears you haven't received any orders yet.
          </Text>
        )}
        {!loading && orders.length > 0 && filteredOrders.length === 0 && (
          <Text style={styles.messageText}>
            No orders found matching your filter/search criteria. Try a
            different filter.
          </Text>
        )}

        {/* Orders List */}
        <View style={styles.ordersList}>
          {filteredOrders.map((order: Order) => {
            const vendorItems = order.items.filter(
              (item: any) => item.vendorId?.toString() === vendorId?.toString(),
            );

            const isOrderAssigned = !!order.deliveryBoy;
            const assignButtonText = isOrderAssigned
              ? `Assigned to: ${order.deliveryBoy?.name || "Unknown"}`
              : assigningOrderId === order._id
                ? "Assigning..."
                : "👤 Assign Delivery Executive";
            const assignButtonDisabled =
              isOrderAssigned || assigningOrderId === order._id;

            return (
              <View key={order._id} style={styles.orderCard}>
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
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      <ShoppingCart
                        size={20}
                        color={headingGray}
                        style={{ marginRight: 5 }}
                      />
                      Your Products in this Order ({vendorItems.length})
                    </Text>
                    {vendorItems.length === 0 ? (
                      <Text style={styles.emptyItemsText}>
                        No products from your shop in this order.
                      </Text>
                    ) : (
                      <View style={styles.itemsGrid}>
                        {vendorItems.map((item: any, idx: number) => {
                          const unit = getProductUnit(item);
                          return (
                            <View
                              key={item._id || item.productId || idx}
                              style={styles.itemCardContent}
                            >
                              <Image
                                source={{
                                  uri:
                                    item.productImage ||
                                    "https://via.placeholder.com/80?text=No+Image",
                                }}
                                style={styles.itemImage}
                              />
                              <View style={styles.itemDetails}>
                                <Text style={styles.itemName} selectable={true}>
                                  {item.name}
                                </Text>
                                {item.size && (
                                  <Text style={styles.itemSizeText}>
                                    Size: {item.size}
                                  </Text>
                                )}
                                <Text style={styles.itemQuantityPrice}>
                                  {item.quantity} {unit} × ₹
                                  {item.price.toFixed(2)}
                                </Text>
                                {item.status && (
                                  <Text
                                    style={[
                                      styles.itemStatusBadge,
                                      getStatusStyles(item.status),
                                    ]}
                                  >
                                    {item.status}
                                  </Text>
                                )}
                              </View>
                              <Text style={styles.itemTotalPrice}>
                                ₹{(item.quantity * item.price).toFixed(2)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={styles.vendorPayoutContainer}>
                    <Text style={styles.orderTotalValueText}>
                      Customer's Total: ₹{order.total.toFixed(2)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.section,
                      { alignItems: "flex-end", marginTop: 16 },
                    ]}
                  >
                    <Text style={styles.sectionHeader}>
                      Update Order Status:
                    </Text>
                    {renderStatusUpdateButtons(order)}
                  </View>

                  <View style={styles.bottomSection}>
                    <View style={styles.addressContainer}>
                      <Text style={styles.sectionHeader}>
                        Delivery Address:
                      </Text>
                      <View style={styles.subCard}>
                        <Text style={styles.addressTextBold} selectable={true}>
                          {order.address?.fullName || "N/A"}
                        </Text>
                        <Text style={styles.addressText} selectable={true}>
                          {order.address?.street}
                        </Text>
                        {order.address?.street2 ? (
                          <Text style={styles.addressText} selectable={true}>
                            {order.address.street2}
                          </Text>
                        ) : null}
                        {order.address?.landmark ? (
                          <Text style={styles.addressText} selectable={true}>
                            Near {order.address.landmark}
                          </Text>
                        ) : null}
                        <Text style={styles.addressText} selectable={true}>
                          {order.address?.city}, {order.address?.state} -{" "}
                          {order.address?.zipCode}
                        </Text>
                        <Text style={styles.addressText} selectable={true}>
                          {order.address?.country}
                        </Text>
                        {order.address?.phone && (
                          <TouchableOpacity
                            onPress={() => {
                              Linking.openURL(`tel:${order.address.phone}`);
                            }}
                          >
                            <Text style={styles.addressPhone} selectable={true}>
                              📞 {order.address.phone}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={styles.paymentContainer}>
                      <Text style={styles.sectionHeader}>Payment Details:</Text>
                      <View style={styles.subCard}>
                        <View style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>
                            Payment Method:
                          </Text>
                          <Text style={styles.paymentValue} selectable={true}>
                            {order.paymentMethod || "N/A"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionButtonsContainer}>
                    <Text style={styles.sectionHeader}>Customer Details:</Text>
                    <Text style={styles.addressTextBold} selectable={true}>
                      {order.user?.name || "Customer N/A"}
                    </Text>
                    {order.user?.phone && (
                      <TouchableOpacity
                        onPress={() => {
                          Linking.openURL(`tel:${order.user?.phone}`);
                        }}
                      >
                        <Text style={styles.addressPhone} selectable={true}>
                          📞 {order.user.phone}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isOrderAssigned && order.deliveryBoy ? (
                    <View style={styles.deliveryBoyCard}>
                      <Text style={styles.deliveryBoyTitle}>
                        <Truck
                          size={18}
                          color="#065F46"
                          style={{ marginRight: 5 }}
                        />
                        Assigned Delivery Executive
                      </Text>
                      <View style={styles.deliveryBoyInfoGrid}>
                        <View style={styles.deliveryBoyDetails}>
                          <Text style={styles.deliveryBoyDetailText}>
                            <Text style={styles.deliveryBoyLabel}>Name:</Text>{" "}
                            <Text selectable={true}>
                              {order.deliveryBoy.name || "N/A"}
                            </Text>
                          </Text>
                          <Text style={styles.deliveryBoyDetailText}>
                            <Text style={styles.deliveryBoyLabel}>Email:</Text>{" "}
                            <Text selectable={true}>
                              {order.deliveryBoy.email || "N/A"}
                            </Text>
                          </Text>
                          {order.deliveryBoy.phone && (
                            <TouchableOpacity
                              onPress={() => {
                                Linking.openURL(
                                  `tel:${order.deliveryBoy?.phone}`,
                                );
                              }}
                            >
                              <Text style={styles.deliveryBoyDetailText}>
                                <Text style={styles.deliveryBoyLabel}>
                                  Phone:
                                </Text>{" "}
                                <Text
                                  style={styles.addressPhone}
                                  selectable={true}
                                >
                                  {order.deliveryBoy.phone}
                                </Text>
                              </Text>
                            </TouchableOpacity>
                          )}
                          <Text style={styles.deliveryBoyDetailText}>
                            <Text style={styles.deliveryBoyLabel}>Status:</Text>{" "}
                            <Text
                              style={[
                                order.deliveryBoy.isAvailable
                                  ? { color: "green" }
                                  : { color: "red" },
                              ]}
                            >
                              {order.deliveryBoy.isAvailable
                                ? "Available"
                                : "Busy"}
                            </Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        onPress={() => handleAssignDeliveryBoy(order)}
                        style={styles.actionButton}
                        disabled={assignButtonDisabled}
                      >
                        <Text style={styles.actionButtonText}>
                          {assignButtonText}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.actionButtonsContainer}>
                    {(vendor?.address || order.address) && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(
                            getGoogleMapsRouteUrl(
                              vendor?.address,
                              order.address,
                            ),
                          )
                        }
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionButtonText}>
                          🗺️ View Route
                        </Text>
                      </TouchableOpacity>
                    )}
                    <WhatsappInvoiceSender
                      orderData={order}
                      vendorData={vendor}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {isLoadingMore && (
          <ActivityIndicator
            size="small"
            color={rolexGreen}
            style={{ marginVertical: 20 }}
          />
        )}

        {!hasMore &&
          orders.length > 0 &&
          filteredOrders.length === orders.length && (
            <Text style={styles.endOfListText}>
              🎉 You've reached the end of the order list.
            </Text>
          )}
      </ScrollView>
      <Toast />
    </View>
  );
};

// --- Styles ---
const floatingStyles = StyleSheet.create({
  buttonBase: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  image: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 999,
    resizeMode: "cover",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: neutralLightGray,
    paddingTop: Platform.OS === "android" ? 50 : 0,
  },
  scrollViewContent: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: headingGray,
  },
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: subtleBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: headingGray,
    textAlign: "center",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: rolexGreen,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: textGray,
    textAlign: "center",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  deductionDetails: {
    marginTop: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: subtleBorder,
    paddingTop: 10,
  },
  deductionText: {
    fontSize: 12,
    color: textGray,
    marginBottom: 4,
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
    borderColor: neutralLightGray,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterButtonText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  searchInput: {
    backgroundColor: "white",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: subtleBorder,
    color: headingGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
    color: rolexGreen,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 10,
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: neutralLightGray,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: 10,
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
    color: "white",
  },
  orderDateText: {
    fontSize: 10,
    opacity: 0.9,
    marginTop: 2,
    color: "white",
    fontWeight: "300",
  },
  orderTotalValueText: {
    fontSize: 22,
    fontWeight: "bold",
    color: rolexGold,
    marginTop: 4,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: headingGray,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: headingGray,
  },
  emptyItemsText: {
    color: textGray,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 16,
  },
  itemsGrid: {
    gap: 12,
  },
  itemCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: subtleBorder,
    borderRadius: 6,
    backgroundColor: "#F9F9F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemImage: {
    width: 60,
    height: 60,
    resizeMode: "cover",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexShrink: 0,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontWeight: "600",
    color: headingGray,
  },
  itemSizeText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  itemQuantityPrice: {
    fontSize: 12,
    color: textGray,
    marginTop: 2,
  },
  itemStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  itemTotalPrice: {
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 2,
  },
  vendorPayoutContainer: {
    marginTop: 16,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: subtleBorder,
    paddingTop: 16,
  },
  bottomSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: subtleBorder,
    flexDirection: "column",
    gap: 16,
  },
  addressContainer: {
    flex: 1,
  },
  paymentContainer: {
    flex: 1,
  },
  subCard: {
    backgroundColor: neutralLightGray,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: subtleBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressTextBold: {
    fontWeight: "600",
    color: headingGray,
  },
  addressText: {
    fontSize: 12,
    color: textGray,
  },
  addressPhone: {
    marginTop: 8,
    fontWeight: "600",
    color: rolexGreen,
    fontSize: 14,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: textGray,
  },
  paymentValue: {
    fontWeight: "600",
    textTransform: "capitalize",
    color: rolexGreen,
    fontSize: 14,
  },
  deliveryBoyCard: {
    marginBottom: 24,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 16,
  },
  deliveryBoyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deliveryBoyInfoGrid: {
    flexDirection: "column",
    gap: 8,
  },
  deliveryBoyDetails: {
    gap: 4,
  },
  deliveryBoyLabel: {
    fontWeight: "bold",
    color: "#065F46",
  },
  deliveryBoyDetailText: {
    color: textGray,
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: "column",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: subtleBorder,
    marginTop: 20,
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: rolexGreen,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  endOfListText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
    color: textGray,
    fontStyle: "italic",
  },
});

export default VendorOrderList;